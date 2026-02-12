import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';

// ---------------------------
// 1. Constants & Config
// ---------------------------
interface DetectedObject {
    bbox: [number, number, number, number];
    classIndex: number;
    score: number;
}

const MODEL_INPUT_SIZE = 320;
const THRESHOLD = 0.3; // Minimum score to show
const CLASS_NAMES = ["Stop block broken", "Stop block normal", "Straight block broken", "Straight block normal"];

const VisionScreen: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [model, setModel] = useState<any>(null);
    const [status, setStatus] = useState<string>("Initializing...");
    const [perfInfo, setPerfInfo] = useState<string>("-");
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [cameraKey, setCameraKey] = useState(0); // For forcing camera restart

    const isRunning = useRef<boolean>(true); // To stop loop on unmount

    const addLog = (msg: string) => {
        setDebugLogs(prev => [msg, ...prev].slice(0, 8));
        console.log(msg);
    };

    const restartCamera = () => {
        addLog("Restarting Camera...");
        setCameraKey(prev => prev + 1);
    };

    // ---------------------------
    // 2. Load Model (CPU Mode)
    // ---------------------------
    useEffect(() => {
        const loadModel = async () => {
            const tf = (window as any).tf;
            const tflite = (window as any).tflite;

            if (!tf || !tflite) {
                setStatus("Waiting for TF...");
                setTimeout(loadModel, 500);
                return;
            }

            try {
                setStatus("Loading Model...");
                const modelUrl = `${window.location.origin}/best_int8.tflite`;

                // Verify file exists
                const res = await fetch(modelUrl, { method: 'HEAD' });
                if (!res.ok) throw new Error(`Model missing: ${res.status}`);

                tflite.setWasmPath(`${window.location.origin}/wasm/`);

                // Load Model (WebGL + Single Thread = Safe & Fast)
                addLog("Loading (WebGL + 1 Thread)...");
                const loadedModel = await tflite.loadTFLiteModel(modelUrl, {
                    numThreads: 1, // CRITICAL: Keep 1 to avoid SAB deadlock
                    enableWebgl: true // Enable GPU
                });

                if (loadedModel) {
                    setModel(loadedModel);
                    const backend = tf.getBackend();
                    setStatus(`Ready! (${backend})`);
                    addLog(`Loaded! Backend: ${backend}`);
                }
            } catch (err: any) {
                setStatus(`Error: ${err.message}`);
                addLog(`Load Err: ${err.message}`);
            }
        };
        loadModel();

        return () => { isRunning.current = false; };
    }, []);


    // ---------------------------
    // 3. Post-Processing
    // ---------------------------
    const processOutput = (outputTensor: any, imgWidth: number, imgHeight: number): DetectedObject[] => {
        const detections: DetectedObject[] = [];
        const shape = outputTensor.shape; // e.g. [1, 5, 2100] or [1, 2100, 5]
        const data = outputTensor.dataSync() as Float32Array;

        if (!shape || shape.length < 3) return [];

        // Determine output layout (Transposed or Normal)
        const dim1 = shape[1];
        const dim2 = shape[2];
        const isTransposed = dim1 < dim2; // True if [1, 5, 2100] (Channels < Anchors)

        const numChannels = isTransposed ? dim1 : dim2;
        const numAnchors = isTransposed ? dim2 : dim1;

        // Logging first frame or occasionally
        if (Math.random() < 0.01) {
            addLog(`Shape:[${shape}] Ch:${numChannels} An:${numAnchors}`);
        }

        const scoreStartIdx = 4; // x, y, w, h, [classes...]

        for (let i = 0; i < numAnchors; i++) {
            // Find class with max score for this anchor
            let maxScore = 0;
            let classIndex = -1;

            for (let c = 0; c < CLASS_NAMES.length; c++) {
                let val = 0;
                // Access logic based on layout
                if (isTransposed) {
                    // [1, Channels, Anchors] -> data[channel * numAnchors + anchor]
                    val = data[(scoreStartIdx + c) * numAnchors + i];
                } else {
                    // [1, Anchors, Channels] -> data[anchor * numChannels + channel]
                    val = data[i * numChannels + (scoreStartIdx + c)];
                }

                if (val > maxScore) {
                    maxScore = val;
                    classIndex = c;
                }
            }

            if (maxScore > THRESHOLD) {
                // Extract Box (cx, cy, w, h)
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
                    bbox: [
                        (cx - w / 2) * imgWidth,
                        (cy - h / 2) * imgHeight,
                        w * imgWidth,
                        h * imgHeight
                    ],
                    classIndex,
                    score: maxScore
                });
            }
        }

        // Non-Maximum Suppression (Simple)
        detections.sort((a, b) => b.score - a.score);
        return detections.slice(0, 5); // Return top 5
    };

    const drawResults = (detections: DetectedObject[], videoWidth: number, videoHeight: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        // Sync Canvas to Video Size
        if (canvasRef.current.width !== videoWidth) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
        }

        ctx.clearRect(0, 0, videoWidth, videoHeight);

        detections.forEach(det => {
            const [x, y, w, h] = det.bbox;
            const label = `${CLASS_NAMES[det.classIndex]} ${Math.round(det.score * 100)}%`;

            // Box
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);

            // Label Background
            ctx.fillStyle = '#00FF00';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y - 25, textWidth + 10, 25);

            // Label Text
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(label, x + 5, y - 5);
        });
    };


    // ---------------------------
    // 4. Real-time Inference Loop
    // ---------------------------
    const detectFrame = useCallback(async () => {
        if (!isRunning.current) return;

        const tf = (window as any).tf;
        const video = webcamRef.current?.video;

        if (model && video && video.readyState === 4) {
            const startTime = performance.now();

            // Start Clean Scope
            tf.engine().startScope();

            try {
                // 1. From Video -> Tensor (Fastest method)
                const img = tf.browser.fromPixels(video);

                // 2. Resize & Normalize
                const resized = tf.image.resizeBilinear(img, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
                const input = tf.cast(tf.expandDims(resized), 'float32').div(tf.scalar(255));

                // 3. Predict
                addLog(`Pred Start (${video.videoWidth}x${video.videoHeight})`);
                const result = await model.predict(input);
                addLog("Pred End");

                // 4. Handle Output
                let outputTensor = result;
                // Handle dict/array outputs if necessary (TFLite sometimes wraps it)
                if (Array.isArray(result)) outputTensor = result[0];
                else if (result && result.shape === undefined) {
                    const keys = Object.keys(result);
                    outputTensor = result[keys[0]];
                }

                if (outputTensor) {
                    // Process on CPU
                    const detections = processOutput(outputTensor, video.videoWidth, video.videoHeight);
                    drawResults(detections, video.videoWidth, video.videoHeight);

                    const time = (performance.now() - startTime).toFixed(0);
                    setPerfInfo(`${time}ms | ${detections.length} obj`);

                    if (detections.length > 0) {
                        // Force log if detections found
                        console.log(`Detections: ${detections.length}`);
                    }
                }

            } catch (error: any) {
                console.error("Predict Error:", error);
                addLog(`Pred Err: ${error.message}`);
            } finally {
                // Cleanup Tensors
                tf.engine().endScope();
            }

            // Queue next frame
            // Use setTimeout to allow UI/Event Loop to breathe (fix "Resource failed to close")
            setTimeout(() => {
                if (isRunning.current) detectFrame();
            }, 10);

        } else {
            // Video not ready debugging
            if (model && (!video || video.readyState !== 4)) {
                if (Math.random() < 0.05) { // Throttle log
                    addLog(`Waiting Video... RS:${video?.readyState}`);
                }
            }

            // Retry
            setTimeout(() => {
                if (isRunning.current) detectFrame();
            }, 100);
        }
    }, [model]);


    // Start Loop when model ready
    useEffect(() => {
        if (model) {
            addLog("Starting Loop...");
            detectFrame();
        }
    }, [model, detectFrame]);


    return (
        <div className="h-full w-full bg-black flex flex-col items-center pt-10">
            <h1 className="text-yellow-400 text-2xl font-bold mb-4">WalkMate Live</h1>

            {/* Camera Area */}
            <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 overflow-hidden border-2 border-yellow-400 rounded-2xl mx-4">
                <Webcam
                    key={cameraKey}
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "environment" }} // Auto Resolution
                    className="absolute inset-0 w-full h-full object-cover"
                    onUserMediaError={(e) => addLog(`Cam Err: ${e}`)}
                    onUserMedia={() => addLog("Camera Started")}
                />
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
            </div>

            {/* Controls */}
            <div className="w-full max-w-md px-4 mt-2 flex justify-between items-center">
                <button
                    onClick={restartCamera}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 text-sm active:bg-gray-700"
                >
                    Restart Camera
                </button>
                <div className="text-right">
                    <p className="text-white font-bold text-sm">{status}</p>
                    <p className="text-yellow-400 font-mono text-xs">{perfInfo}</p>
                </div>
            </div>

            {/* Mini Console */}
            <div className="w-full max-w-md px-4 mt-2">
                <div className="bg-black/80 h-24 p-2 rounded border border-gray-700 overflow-y-auto">
                    {debugLogs.map((l, i) => (
                        <p key={i} className="text-green-500 text-[10px] font-mono leading-tight">{l}</p>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VisionScreen;