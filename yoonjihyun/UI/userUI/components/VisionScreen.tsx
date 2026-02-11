import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

// ---------------------------
// 1. 설정 및 상수 정의
// ---------------------------
interface DetectedObject {
    bbox: [number, number, number, number];
    classIndex: number;
    score: number;
}

const MODEL_INPUT_SIZE = 736;
const THRESHOLD = 0.3;
const CLASS_NAMES = ["Stop block broken", "Stop block normal", "Straight block broken", "Straight block normal"];

const VisionScreen: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);

    // Concurrency Lock
    const isInferring = useRef<boolean>(false);

    const [model, setModel] = useState<any>(null);
    const [status, setStatus] = useState<string>("초기화 중...");
    const [lastInferenceInfo, setLastInferenceInfo] = useState<string>("-");
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 10)); // max 10 logs
        console.log(msg);
    };

    // ---------------------------
    // 2. 모델 로드
    // ---------------------------
    useEffect(() => {
        const loadModel = async () => {
            const tf = (window as any).tf;
            const tflite = (window as any).tflite;

            if (!tf || !tflite) {
                setStatus("엔진 로딩 대기...");
                setTimeout(loadModel, 1000);
                return;
            }

            try {
                // Optimize TFJS backend (Preprocessing)
                addLog(`Backend: ${tf.getBackend()}`);
                await tf.setBackend('webgl');
                addLog(`New Backend: ${tf.getBackend()}`);
                await tf.ready();

                setStatus("모델 확인 중...");
                const modelUrl = `${window.location.origin}/best_int8.tflite`;
                addLog(`Checking: ${modelUrl}`);

                const response = await fetch(modelUrl, { method: 'HEAD' });
                if (!response.ok) throw new Error(`Model 404: ${response.status}`);

                setStatus("모델 로딩...");
                tflite.setWasmPath(`${window.location.origin}/wasm/`);

                // Load with threads
                const loadedModel = await tflite.loadTFLiteModel(modelUrl, {
                    numThreads: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2,
                    enableWebgl: true // Try enabling WebGL delegate if supported
                });

                if (loadedModel) {
                    setModel(loadedModel);
                    setStatus("준비 완료!");
                    addLog("Model loaded!");
                }
            } catch (err: any) {
                setStatus(`Error: ${err.message}`);
                addLog(`Error: ${err.message}`);
            }
        };

        loadModel();
    }, []);

    // ---------------------------
    // 3. 후처리
    // ---------------------------
    const processOutput = (outputTensor: any, imgWidth: number, imgHeight: number): DetectedObject[] => {
        const detections: DetectedObject[] = [];
        const shape = outputTensor.shape;
        const data = outputTensor.dataSync() as Float32Array;

        if (shape.length < 3) return [];

        const isTransposed = shape[1] < shape[2];
        const numChannels = isTransposed ? shape[1] : shape[2];
        const numAnchors = isTransposed ? shape[2] : shape[1];

        // Debug Log occasionally
        if (Math.random() < 0.05) {
            addLog(`Shp:${shape} C:${numChannels} A:${numAnchors}`);
        }

        const scoreStartIdx = 4;
        let maxScoreFound = 0;

        for (let i = 0; i < numAnchors; i++) {
            let maxScore = -1;
            let classIndex = -1;

            for (let c = 0; c < CLASS_NAMES.length; c++) {
                let val = 0;
                const channelIdx = scoreStartIdx + c;

                if (isTransposed) {
                    val = data[channelIdx * numAnchors + i];
                } else {
                    val = data[i * numChannels + channelIdx];
                }

                if (val > maxScore) {
                    maxScore = val;
                    classIndex = c;
                }
            }

            if (maxScore > maxScoreFound) maxScoreFound = maxScore;

            if (maxScore > THRESHOLD) {
                let cx, cy, w, h;
                if (isTransposed) {
                    cx = data[0 * numAnchors + i];
                    cy = data[1 * numAnchors + i];
                    w = data[2 * numAnchors + i];
                    h = data[3 * numAnchors + i];
                } else {
                    cx = data[i * numChannels + 0];
                    cy = data[i * numChannels + 1];
                    w = data[i * numChannels + 2];
                    h = data[i * numChannels + 3];
                }

                detections.push({
                    bbox: [(cx - w / 2) * imgWidth, (cy - h / 2) * imgHeight, w * imgWidth, h * imgHeight],
                    classIndex,
                    score: maxScore
                });
            }
        }

        if (detections.length === 0 && Math.random() < 0.1) {
            addLog(`MaxScore: ${maxScoreFound.toFixed(4)}`);
        }

        detections.sort((a, b) => b.score - a.score);
        return detections.slice(0, 20);
    };

    const drawResults = (detections: DetectedObject[], videoWidth: number, videoHeight: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        ctx.clearRect(0, 0, videoWidth, videoHeight);

        detections.forEach(det => {
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 4;
            ctx.strokeRect(det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3]);

            ctx.fillStyle = '#00FF00';
            ctx.font = '18px Arial';
            ctx.fillText(`${CLASS_NAMES[det.classIndex]} ${(det.score * 100).toFixed(0)}%`, det.bbox[0] + 5, det.bbox[1] - 10);
        });
    };

    // ---------------------------
    // 4. 추론 실행 (Inference)
    // ---------------------------
    const runInference = useCallback(async () => {
        const tf = (window as any).tf;
        if (!webcamRef.current || !model || !debugCanvasRef.current || !tf) return;

        // Prevent overlapping inferences
        if (isInferring.current) {
            // addLog("Skip: Busy");
            return;
        }

        isInferring.current = true;
        const startTime = performance.now();

        try {
            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4) {
                isInferring.current = false;
                return;
            }

            // 1. Draw Video to Debug Canvas (Confirm Source)
            const dbgCtx = debugCanvasRef.current.getContext('2d', { willReadFrequently: true });
            if (dbgCtx) {
                dbgCtx.drawImage(video, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
            }

            // 2. Unblock UI (Allow canvas paint)
            await new Promise(resolve => setTimeout(resolve, 20));

            // 3. TFJS Scope
            tf.engine().startScope();

            addLog("Predicting...");

            // Read from Canvas
            const img = tf.browser.fromPixels(debugCanvasRef.current);
            const resized = tf.image.resizeBilinear(img, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
            const input = tf.cast(tf.expandDims(resized), 'float32').div(tf.scalar(255));

            // Predict
            const result = (model as any).predict(input);
            addLog("Predict done");

            let outputTensor = result;
            if (Array.isArray(result)) {
                outputTensor = result[0];
            } else if (result && typeof result === 'object' && !result.dataSync && !Array.isArray(result)) {
                const keys = Object.keys(result);
                if (keys.length > 0) outputTensor = result[keys[0]];
            }

            if (outputTensor) {
                const detections = processOutput(outputTensor, video.clientWidth, video.clientHeight);
                drawResults(detections, video.clientWidth, video.clientHeight);
                setLastInferenceInfo(`${(performance.now() - startTime).toFixed(0)}ms / Detect: ${detections.length}`);
            }

            tf.engine().endScope();

        } catch (error: any) {
            addLog(`InferErr: ${error.message}`);
            try { tf.engine().endScope(); } catch (e) { }
        } finally {
            isInferring.current = false;
        }
    }, [model]);

    useEffect(() => {
        if (!model) return;
        const interval = setInterval(runInference, 2000); // 2s
        return () => clearInterval(interval);
    }, [model, runInference]);

    return (
        <div className="h-full w-full bg-black flex flex-col items-center justify-start pt-10">
            <h1 className="text-yellow-400 text-2xl font-bold mb-4">WalkMate Vision</h1>

            <div className="relative w-full max-w-sm aspect-square bg-gray-800 rounded-xl overflow-hidden border-2 border-yellow-400">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment", width: 640, height: 640 }}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            </div>

            <div className="mt-4 w-full max-w-sm px-4">
                <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-700 mb-2">
                    <p className="text-white font-bold">{status}</p>
                    <p className="text-yellow-400 text-sm">{lastInferenceInfo}</p>
                </div>

                {/* Debug Info Area */}
                <div className="flex gap-2 h-32">
                    {/* Log Console */}
                    <div className="flex-1 bg-black/80 p-2 rounded border border-gray-600 overflow-y-auto">
                        {logs.map((log, i) => (
                            <p key={i} className="text-green-400 text-xs font-mono">{log}</p>
                        ))}
                    </div>

                    {/* Input Debug View */}
                    <div className="w-32 bg-gray-900 rounded border border-gray-600 flex flex-col items-center justify-center">
                        <p className="text-white text-[10px] mb-1">Input View</p>
                        <canvas
                            ref={debugCanvasRef}
                            width={MODEL_INPUT_SIZE}
                            height={MODEL_INPUT_SIZE}
                            className="w-28 h-28 object-contain bg-black"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisionScreen;