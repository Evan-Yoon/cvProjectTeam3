import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { speak } from './utils/audio';
import NpuTflite from '../NpuTfliteBridge';

// ---------------------------
// 1. Constants & Config
// ---------------------------
interface DetectedObject {
    bbox: [number, number, number, number];
    classIndex: number;
    score: number;
}

const MODEL_INPUT_SIZE = 320;
const THRESHOLD = 0.5; // Slightly higher threshold for voice alerts to reduce spam
const CLASS_NAMES = ["Stop block broken", "Stop block normal", "Straight block broken", "Straight block normal"];

// Mapping class names to friendly TTS messages
const TTS_MESSAGES: { [key: number]: string } = {
    0: "Broken stop block ahead.",
    1: "Stop block ahead.",
    2: "Broken path ahead.",
    3: "Straight path ahead."
};

const VisionCamera: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState<string>("Initializing Camera...");
    const isRunning = useRef<boolean>(true);
    const lastSpokenTime = useRef<number>(0); // To debounce TTS

    // ---------------------------
    // 2. Load Model (Native NPU)
    // ---------------------------
    useEffect(() => {
        const loadModel = async () => {
            try {
                setStatus("Loading GPU Model...");
                const res = await NpuTflite.loadModel({ modelPath: "best_int8.tflite" });
                setStatus(`Ready! (${res.delegate})`);
                setModelLoaded(true);
            } catch (err: any) {
                setStatus(`Error: ${err.message}`);
                console.error("Model Load Error:", err);
            }
        };
        loadModel();

        return () => { isRunning.current = false; };
    }, []);

    // ---------------------------
    // 3. Post-Processing & TTS
    // ---------------------------
    const processOutput = (outputTensor: any, imgWidth: number, imgHeight: number): DetectedObject[] => {
        const detections: DetectedObject[] = [];
        const shape = outputTensor.shape;
        const data = outputTensor.dataSync() as Float32Array;

        if (!shape || shape.length < 3) return [];

        const dim1 = shape[1];
        const dim2 = shape[2];
        const isTransposed = dim1 < dim2;

        const numChannels = isTransposed ? dim1 : dim2;
        const numAnchors = isTransposed ? dim2 : dim1;
        const scoreStartIdx = 4;

        for (let i = 0; i < numAnchors; i++) {
            let maxScore = 0;
            let classIndex = -1;

            for (let c = 0; c < CLASS_NAMES.length; c++) {
                let val = 0;
                if (isTransposed) {
                    val = data[(scoreStartIdx + c) * numAnchors + i];
                } else {
                    val = data[i * numChannels + (scoreStartIdx + c)];
                }

                if (val > maxScore) {
                    maxScore = val;
                    classIndex = c;
                }
            }

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

        detections.sort((a, b) => b.score - a.score);
        return detections.slice(0, 5);
    };

    const handleTTS = (detections: DetectedObject[]) => {
        if (detections.length === 0) return;

        // Get top detection
        const topDet = detections[0];
        const now = Date.now();

        // Debounce: Only speak every 3 seconds to avoid spamming
        if (now - lastSpokenTime.current > 3000) {
            const msg = TTS_MESSAGES[topDet.classIndex];
            if (msg) {
                speak(msg);
                lastSpokenTime.current = now;
            }
        }
    };

    const drawResults = (detections: DetectedObject[], videoWidth: number, videoHeight: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        if (canvasRef.current.width !== videoWidth) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
        }

        ctx.clearRect(0, 0, videoWidth, videoHeight);

        detections.forEach(det => {
            const [x, y, w, h] = det.bbox;
            const label = `${CLASS_NAMES[det.classIndex]} ${Math.round(det.score * 100)}%`;

            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);

            ctx.fillStyle = '#00FF00';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y - 25, textWidth + 10, 25);

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

        const video = webcamRef.current?.video;

        if (modelLoaded && webcamRef.current) {
            try {
                const imageSrc = webcamRef.current.getScreenshot();

                if (imageSrc) {
                    const base64Data = imageSrc.split(',')[1];
                    const result = await NpuTflite.detect({ image: base64Data });

                    if (result && result.data) {
                        const outputTensor = {
                            dataSync: () => Float32Array.from(result.data),
                            shape: result.shape
                        };

                        const vWidth = video?.videoWidth || 320;
                        const vHeight = video?.videoHeight || 320;

                        const detections = processOutput(outputTensor, vWidth, vHeight);
                        drawResults(detections, vWidth, vHeight);
                        handleTTS(detections);
                    }
                }

            } catch (error: any) {
                console.error("Predict Error:", error);
            }

            setTimeout(() => {
                if (isRunning.current) detectFrame();
            }, 50); // 50ms (20fps target) - Slightly slower than 10ms to save battery with TTS

        } else {
            setTimeout(() => {
                if (isRunning.current) detectFrame();
            }, 100);
        }
    }, [modelLoaded]);

    useEffect(() => {
        if (modelLoaded) {
            detectFrame();
        }
    }, [modelLoaded, detectFrame]);

    return (
        <div className="relative w-full h-full bg-black">
            <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                className="absolute inset-0 w-full h-full object-cover opacity-60" // Dimmed for UI visibility
            />
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            {/* Status Overlay */}
            <div className="absolute top-4 right-4 bg-black/50 px-2 py-1 rounded">
                <p className="text-yellow-400 font-mono text-xs">{status}</p>
            </div>
        </div>
    );
};

export default VisionCamera;
