import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { speak } from '../src/utils/audio'; // 경로 확인 필요
import NpuTflite from '../NpuTfliteBridge'; // 경로 확인 필요

// ---------------------------
// 1. Constants & Config
// ---------------------------
interface DetectedObject {
    bbox: [number, number, number, number];
    classIndex: number;
    score: number;
}

const THRESHOLD = 0.5;
const CLASS_NAMES = ["Stop block broken", "Stop block normal", "Straight block broken", "Straight block normal"];

// TTS 메시지 매핑
const TTS_MESSAGES: { [key: number]: string } = {
    0: "전방에 파손된 점자 블록이 있습니다.",
    1: "전방에 멈춤 블록이 있습니다.",
    2: "전방에 파손된 유도 블록이 있습니다.",
    3: "직진 유도 블록입니다."
};

const VisionCamera: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState<string>("카메라 초기화 중...");

    // Refs for Loop Control
    const isRunning = useRef<boolean>(true);
    const lastSpokenTime = useRef<number>(0);
    const isProcessing = useRef<boolean>(false); // 중복 실행 방지 락

    // ---------------------------
    // 2. Load Model
    // ---------------------------
    useEffect(() => {
        const loadModel = async () => {
            try {
                setStatus("AI 모델 로딩 중...");
                // ★ VisionCamera.tsx 파일 내 모델 경로 수정 (public 폴더 기준 / 붙이기)
                const res = await NpuTflite.loadModel({ modelPath: "best_float16.tflite" });
                setStatus(`준비 완료 (${res.delegate})`);
                setModelLoaded(true);
            } catch (err: any) {
                setStatus(`모델 오류: ${err.message}`);
                console.error("Model Load Error:", err);
            }
        };
        loadModel();

        return () => {
            isRunning.current = false;
        };
    }, []);

    // ---------------------------
    // 3. Post-Processing & TTS
    // ---------------------------
    const processOutput = (outputTensor: any, imgWidth: number, imgHeight: number): DetectedObject[] => {
        const shape = outputTensor.shape;
        const data = outputTensor.dataSync() as Float32Array;

        if (!shape || shape.length < 3) return [];

        // YOLO 출력 형상 파악 (Transpose 여부 확인)
        const dim1 = shape[1];
        const dim2 = shape[2];
        const isTransposed = dim1 < dim2;

        const numChannels = isTransposed ? dim1 : dim2;
        const numAnchors = isTransposed ? dim2 : dim1;

        // ★ 중요: 모델에 따라 4 또는 5 (xywh + class... vs xywh + obj + class...)
        // 일반적인 TFLite export는 4인 경우가 많음
        const scoreStartIdx = 4;

        const detections: DetectedObject[] = [];

        for (let i = 0; i < numAnchors; i++) {
            let maxScore = 0;
            let classIndex = -1;

            // 클래스 점수 중 가장 높은 것 찾기
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
                        (cx - w / 2) * imgWidth,  // x (좌상단)
                        (cy - h / 2) * imgHeight, // y (좌상단)
                        w * imgWidth,             // width
                        h * imgHeight             // height
                    ],
                    classIndex,
                    score: maxScore
                });
            }
        }

        // 점수 높은 순 정렬 후 상위 5개만 리턴
        detections.sort((a, b) => b.score - a.score);
        return detections.slice(0, 5);
    };

    const handleTTS = (detections: DetectedObject[]) => {
        if (detections.length === 0) return;

        const topDet = detections[0];
        const now = Date.now();

        // 3초 쿨다운 (말 너무 많이 하는 것 방지)
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

        // 캔버스 크기를 영상 크기와 동기화 (비율 깨짐 방지)
        if (canvasRef.current.width !== videoWidth || canvasRef.current.height !== videoHeight) {
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
        }

        ctx.clearRect(0, 0, videoWidth, videoHeight);

        detections.forEach(det => {
            const [x, y, w, h] = det.bbox;
            const label = `${CLASS_NAMES[det.classIndex]} ${Math.round(det.score * 100)}%`;

            // 박스 그리기
            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, w, h);

            // 텍스트 배경
            ctx.fillStyle = '#00FF00';
            const textWidth = ctx.measureText(label).width;
            ctx.fillRect(x, y - 25, textWidth + 10, 25);

            // 텍스트
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(label, x + 5, y - 5);
        });
    };

    // ---------------------------
    // 4. Real-time Inference Loop
    // ---------------------------
    const detectFrame = useCallback(async () => {
        if (!isRunning.current || !modelLoaded || !webcamRef.current?.video) return;
        if (isProcessing.current) return; // 이전 프레임 처리 중이면 스킵

        isProcessing.current = true;

        try {
            const video = webcamRef.current.video;

            // 비디오가 준비되지 않았으면 대기
            if (video.readyState !== 4) {
                isProcessing.current = false;
                setTimeout(detectFrame, 100);
                return;
            }

            const imageSrc = webcamRef.current.getScreenshot();

            if (imageSrc) {
                const base64Data = imageSrc.split(',')[1];
                const result = await NpuTflite.detect({ image: base64Data });

                if (result && result.data) {
                    const outputTensor = {
                        dataSync: () => Float32Array.from(result.data),
                        shape: result.shape
                    };

                    // 비디오 원본 크기 (화면 표시 크기가 아님)
                    const vWidth = video.videoWidth;
                    const vHeight = video.videoHeight;

                    const detections = processOutput(outputTensor, vWidth, vHeight);
                    drawResults(detections, vWidth, vHeight);
                    handleTTS(detections);
                }
            }
        } catch (error: any) {
            console.error("Predict Error:", error);
        } finally {
            isProcessing.current = false;
            // 다음 프레임 요청 (50ms 딜레이)
            if (isRunning.current) {
                setTimeout(detectFrame, 50);
            }
        }
    }, [modelLoaded]);

    // 모델 로드되면 루프 시작
    useEffect(() => {
        if (modelLoaded) {
            detectFrame();
        }
    }, [modelLoaded, detectFrame]);

    return (
        <div className="relative w-full h-full bg-black flex justify-center items-center overflow-hidden">
            {/* ★ 중요: object-cover를 쓰면 화면은 꽉 차지만 좌표가 밀림.
         정확도를 위해 object-contain 사용 권장 (여백이 생길 수 있음).
         데모의 퀄리티를 위해 일단은 contain으로 좌표 정확도를 확보하세요.
      */}
            <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "environment" }}
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }}
            />

            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }}
            />

            {/* 상태 표시 오버레이 */}
            <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full z-50">
                <p className="text-yellow-400 font-mono text-xs font-bold animate-pulse">{status}</p>
            </div>
        </div>
    );
};

export default VisionCamera;