import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import { sendHazardReport } from "../src/api/report";
import NpuTflite from "../NpuTfliteBridge";
import { YoloParser, DetectedBox } from "../src/utils/YoloParser";

const VisionCamera: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState<string>("모델 로딩 중...");
  const [inferenceInfo, setInferenceInfo] = useState<string>(""); // 디버깅용 추론 정보
  const isMounted = useRef(true);
  const [modelLoaded, setModelLoaded] = useState(false);

  // 1. 모델 로드 (앱 시작 시 한 번만)
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("🛠️ YOLO11 모델 로드 시도...");
        // public/wasm/yolo11n_float32.tflite 경로 사용
        const result = await NpuTflite.loadModel({ modelPath: "wasm/yolo11n_float32.tflite" });
        console.log("✅ 모델 로드 성공:", result);
        setStatus("모델 준비 완료");
        setModelLoaded(true);
      } catch (error) {
        console.error("❌ 모델 로드 실패:", error);
        setStatus("모델 로드 실패");
      }
    };
    loadModel();
  }, []);

  // 2. 통합 루프: 3초마다 촬영 -> 추론 -> 전송
  useEffect(() => {
    if (!modelLoaded) return;

    isMounted.current = true;
    const loopInterval = setInterval(async () => {
      if (!isMounted.current || !webcamRef.current) return;

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      try {
        // [1] 이미지 캡처 (Base64 헤더 제거)
        const base64Data = imageSrc.split(",")[1];

        // [2] NPU 추론 실행
        const startTime = performance.now();
        const result = await NpuTflite.detect({ image: base64Data });
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(0);

        // 결과 파싱 및 그리기
        let infoMsg = `시간: ${duration}ms`;
        let finalImageBase64 = base64Data;

        if (result && result.data && result.data.length > 0) {
          infoMsg += ` | 데이터: ${result.data.length}개`;

          // 파서 호출
          const boxes = YoloParser.parse(result.data, result.shape || []);

          if (boxes.length > 0) {
            infoMsg += ` | 📦객체: ${boxes.length}개`;

            // [Canvas Drawing Logic]
            const img = new Image();
            img.src = imageSrc;
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              ctx.drawImage(img, 0, 0);

              ctx.lineWidth = 3;
              ctx.font = "bold 24px Arial";

              boxes.forEach((box) => {
                const x = box.x * canvas.width;
                const y = box.y * canvas.height;
                const w = box.w * canvas.width;
                const h = box.h * canvas.height;

                const left = x - w / 2;
                const top = y - h / 2;

                ctx.strokeStyle = "#00FF00";
                ctx.strokeRect(left, top, w, h);

                const label = `${box.className} ${(box.score * 100).toFixed(0)}%`;
                const textWidth = ctx.measureText(label).width;

                ctx.fillStyle = "#00FF00";
                ctx.fillRect(left, top - 30, textWidth + 10, 30);

                ctx.fillStyle = "black";
                ctx.fillText(label, left + 5, top - 6);
              });

              finalImageBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
            }
          } else {
            infoMsg += " | ⚪객체없음";
          }
        }
        setInferenceInfo(infoMsg);
        console.log(`🔍 추론 완료: ${infoMsg}`);

        // [3] 리포트 전송
        const position = await Geolocation.getCurrentPosition();

        console.log("📤 3초 주기 데이터 전송 중...");
        await sendHazardReport({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          hazard_type: "Periodic_Monitor",
          risk_level: 1,
          description: `모니터링 (3초 주기) ${new Date().toLocaleTimeString()} / ${infoMsg}`,
          imageBase64: finalImageBase64
        });

        setStatus("전송 완료");
        setTimeout(() => setStatus("모니터링 중..."), 1000);

      } catch (error) {
        console.error("루프 에러:", error);
        setStatus("에러 발생");
        setInferenceInfo(`에러: ${error}`);
      }
    }, 3000); // 3초 주기

    return () => {
      isMounted.current = false;
      clearInterval(loopInterval);
    };
  }, [modelLoaded]);

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
          objectFit: "cover",
        }}
      />

      {/* 상태 표시 */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-50">
        <div className="bg-black/60 px-3 py-1 rounded-full">
          <p className="text-yellow-400 font-mono text-xs font-bold animate-pulse">
            {status}
          </p>
        </div>
        {inferenceInfo && (
          <div className="bg-blue-900/80 px-3 py-1 rounded-lg border border-blue-400">
            <p className="text-white font-mono text-[10px] whitespace-pre-wrap max-w-[200px]">
              {inferenceInfo}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisionCamera;