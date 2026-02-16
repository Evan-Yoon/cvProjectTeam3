import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation"; // 위치 정보 가져오기
import { speak } from "../src/utils/audio";
import NpuTflite from "../NpuTfliteBridge";
import { sendHazardReport } from "../src/api/report"; // ★ 서버 전송 API import

// ---------------------------
// 1. Constants & Config
// ---------------------------
interface DetectedObject {
    bbox: [number, number, number, number];
    classIndex: number;
    score: number;
}

const THRESHOLD = 0.5;
const CLASS_NAMES = [
    "Stop block broken",
    "Stop block normal",
    "Straight block broken",
    "Straight block normal",
];

// TTS 메시지 매핑
const TTS_MESSAGES: { [key: number]: string } = {
    0: "전방에 파손된 점자 블록이 있습니다.",
    1: "전방에 멈춤 블록이 있습니다.",
    2: "전방에 파손된 유도 블록이 있습니다.",
    3: "직진 유도 블록입니다.",
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
  const isMounted = useRef(true); // 컴포넌트 마운트 상태 확인용

  // ---------------------------
  // ★ [추가된 기능] 5초마다 자동 촬영 및 업로드
  // ---------------------------
    useEffect(() => {
    isMounted.current = true;

    const autoCaptureInterval = setInterval(async () => {
      // 1. 카메라가 준비되지 않았으면 패스
        if (!webcamRef.current || !webcamRef.current.video) return;

        try {
        // 2. 현재 스크린샷 찍기 (Base64)
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        // Base64 헤더 제거 ('data:image/jpeg;base64,' 부분 자르기)
        const base64Data = imageSrc.split(",")[1];

        // 3. 현재 위치 가져오기
        // (주의: 실내에서는 GPS가 안 잡힐 수 있으니 타임아웃 설정 추천)
        const pos = await Geolocation.getCurrentPosition({ timeout: 5000 });

        console.log("📸 5초 자동 촬영: 서버 전송 시도...");

        // 4. 서버로 전송 (위험도는 일단 0으로 고정)
        await sendHazardReport({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          hazard_type: "Auto_Capture", // 자동 기록용 태그
          risk_level: 0, // 위험도 0
            imageBase64: base64Data,
            description: "5초 주기 자동 기록 데이터",
        });

        console.log("✅ 서버 업로드 성공");
        } catch (error) {
        console.error("❌ 자동 업로드 실패:", error);
        }
    }, 5000); // 5000ms = 5초

    // 컴포넌트가 꺼질 때 타이머 정리
    return () => {
        isMounted.current = false;
        clearInterval(autoCaptureInterval);
    };
    }, []);

  // ---------------------------
  // 2. Load Model
  // ---------------------------
    useEffect(() => {
    const loadModel = async () => {
        try {
        setStatus("AI 모델 로딩 중...");
        // 모델 경로 (public 폴더 기준)
        const res = await NpuTflite.loadModel({
            modelPath: "best_float16.tflite",
        });
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
    const processOutput = (
    outputTensor: any,
    imgWidth: number,
    imgHeight: number,
    ): DetectedObject[] => {
    const shape = outputTensor.shape;
    const data = outputTensor.dataSync() as Float32Array;

    if (!shape || shape.length < 3) return [];

    const dim1 = shape[1];
    const dim2 = shape[2];
    const isTransposed = dim1 < dim2;

    const numChannels = isTransposed ? dim1 : dim2;
    const numAnchors = isTransposed ? dim2 : dim1;
    const scoreStartIdx = 4;

    const detections: DetectedObject[] = [];

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
            h * imgHeight,
            ],
            classIndex,
            score: maxScore,
        });
        }
    }

    detections.sort((a, b) => b.score - a.score);
    return detections.slice(0, 5);
    };

    const handleTTS = (detections: DetectedObject[]) => {
    if (detections.length === 0) return;

    const topDet = detections[0];
    const now = Date.now();

    if (now - lastSpokenTime.current > 3000) {
        const msg = TTS_MESSAGES[topDet.classIndex];
        if (msg) {
        speak(msg);
        lastSpokenTime.current = now;
        }
    }
    };

    const drawResults = (
    detections: DetectedObject[],
    videoWidth: number,
    videoHeight: number,
    ) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;

    if (
        canvasRef.current.width !== videoWidth ||
        canvasRef.current.height !== videoHeight
    ) {
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
    }

    ctx.clearRect(0, 0, videoWidth, videoHeight);

    detections.forEach((det) => {
        const [x, y, w, h] = det.bbox;
      const label = `${CLASS_NAMES[det.classIndex]} ${Math.round(det.score * 100)}%`;

        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = "#00FF00";
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x, y - 25, textWidth + 10, 25);

        ctx.fillStyle = "#000000";
        ctx.font = "bold 16px Arial";
        ctx.fillText(label, x + 5, y - 5);
    });
    };

  // ---------------------------
  // 4. Real-time Inference Loop
  // ---------------------------
    const detectFrame = useCallback(async () => {
    if (!isRunning.current || !modelLoaded || !webcamRef.current?.video) return;
    if (isProcessing.current) return;

    isProcessing.current = true;

    try {
        const video = webcamRef.current.video;
        if (video.readyState !== 4) {
        isProcessing.current = false;
        setTimeout(detectFrame, 100);
        return;
        }

        const imageSrc = webcamRef.current.getScreenshot();

        if (imageSrc) {
        const base64Data = imageSrc.split(",")[1];
        const result = await NpuTflite.detect({ image: base64Data });

        if (result && result.data) {
            const outputTensor = {
            dataSync: () => Float32Array.from(result.data),
            shape: result.shape,
            };

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
        if (isRunning.current) {
        setTimeout(detectFrame, 50);
        }
    }
    }, [modelLoaded]);

    useEffect(() => {
        if (modelLoaded) {
        detectFrame();
    }
    }, [modelLoaded, detectFrame]);

    return (
    <div className="relative w-full h-full bg-black flex justify-center items-center overflow-hidden">
        <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "environment" }}
        style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "contain",
        }}
        />

        <canvas
        ref={canvasRef}
        style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "contain",
        }}
        />

      {/* 상태 표시 오버레이 */}
        <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full z-50">
        <p className="text-yellow-400 font-mono text-xs font-bold animate-pulse">
            {status}
        </p>
        </div>
    </div>
    );
};

export default VisionCamera;
