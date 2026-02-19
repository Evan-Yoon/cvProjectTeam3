import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import { sendHazardReport } from "../src/api/report";
import NpuTflite from "../NpuTfliteBridge";
import { YoloParser, DetectedBox } from "../src/utils/YoloParser";

const MODEL_PATH = "wasm/yolo26n_float32.tflite";

const VisionCamera: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);

  const [status, setStatus] = useState<string>("모델 로딩 중...");
  const [inferenceInfo, setInferenceInfo] = useState<string>("");

  const isMounted = useRef(true);
  const [modelLoaded, setModelLoaded] = useState(false);

  // ✅ setInterval + async 중첩 실행 방지
  const isRunningRef = useRef(false);

  // 1) 모델 로드 (앱 시작 시 1회)
  useEffect(() => {
    isMounted.current = true;

    const loadModel = async () => {
      try {
        console.log("🛠️ YOLO26n TFLite 모델 로드 시도...", MODEL_PATH);
        const result = await NpuTflite.loadModel({ modelPath: MODEL_PATH });
        console.log("✅ 모델 로드 성공:", result);

        if (!isMounted.current) return;
        setStatus("모델 준비 완료");
        setModelLoaded(true);
      } catch (error) {
        console.error("❌ 모델 로드 실패:", error);
        if (!isMounted.current) return;
        setStatus("모델 로드 실패");
        setModelLoaded(false);
      }
    };

    loadModel();

    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * ✅ YOLO TFLite 출력(data/shape)이 플랫폼/브릿지별로 달라질 수 있어 정규화
   * - 대표 형태:
   *   (1, 84, 8400) / (1, 85, 8400)
   *   (8400, 84) / (8400, 85)
   *   shape 누락 + data 길이로 추정
   */
  const normalizeYoloOutput = (
    data: any,
    shape: any
  ): { flat: number[]; normShape: number[] } => {
    // data -> number[]
    let flat: number[] = [];
    if (Array.isArray(data)) {
      flat = data.map((v) => Number(v));
    } else if (data && typeof data.length === "number") {
      flat = Array.from(data as ArrayLike<number>, (v) => Number(v));
    } else {
      flat = [];
    }

    // shape -> number[]
    let normShape: number[] = [];
    if (Array.isArray(shape) && shape.length) {
      normShape = shape.map((v) => Number(v));
    }

    // shape 없으면 data 길이로 추정
    if (normShape.length === 0 && flat.length > 0) {
      // 640 기준 8400 boxes가 가장 흔함 (P3/P4/P5 합)
      // 다른 입력(320/1280)도 방어적으로 포함
      const boxCandidates = [8400, 2100, 33600];

      for (const n of boxCandidates) {
        if (flat.length % n === 0) {
          const attrs = flat.length / n; // 84, 85, 9 등
          normShape = [1, attrs, n];
          break;
        }
      }
    }

    // (boxes, attrs) 형태면 (1, attrs, boxes)로 표준화
    if (normShape.length === 2) {
      const a = normShape[0];
      const b = normShape[1];

      // attrs 범위(대략 6~300)를 이용해 판별
      if (b >= 6 && b <= 300) {
        // (boxes, attrs)
        normShape = [1, b, a];
      } else if (a >= 6 && a <= 300) {
        // (attrs, boxes) -> 이미 괜찮지만 표준으로 맞춤
        normShape = [1, a, b];
      }
    }

    return { flat, normShape };
  };

  // 2) 통합 루프: 3초마다 촬영 -> 추론 -> 전송
  useEffect(() => {
    if (!modelLoaded) return;

    const loopInterval = setInterval(async () => {
      if (!isMounted.current || !webcamRef.current) return;
      if (isRunningRef.current) return; // ✅ 중첩 방지
      isRunningRef.current = true;

      try {
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        // [Step 1] Letterbox Preprocessing (640x640) - ✅ 변경하지 않음
        const img = new Image();
        img.src = imageSrc;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("이미지 로드 실패"));
        });

        const modelInputSize = 640;
        const canvas = document.createElement("canvas");
        canvas.width = modelInputSize;
        canvas.height = modelInputSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Fill with black (padding)
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, modelInputSize, modelInputSize);

        // Resize with aspect ratio preserved
        const scale = Math.min(modelInputSize / img.width, modelInputSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const tx = (modelInputSize - w) / 2;
        const ty = (modelInputSize - h) / 2;

        // Draw image centered (letterboxed)
        ctx.drawImage(img, tx, ty, w, h);

        // Inference용 Base64 extraction (Letterboxed Image)
        const letterboxedBase64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

        // [Step 2] NPU 추론 실행
        const startTime = performance.now();
        const result = await NpuTflite.detect({ image: letterboxedBase64 });
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(0);

        // [Step 3] 결과 파싱 및 그리기 (same canvas)
        let infoMsg = `시간: ${duration}ms`;

        if (result && result.data && (result.data.length ?? 0) > 0) {
          infoMsg += ` | 데이터: ${result.data.length}개`;
          if (result.shape) infoMsg += ` | Shape: [${result.shape.join("x")}]`;

          const { flat, normShape } = normalizeYoloOutput(result.data, result.shape);

          // ✅ 파서 입력 안정화
          const boxes: DetectedBox[] = YoloParser.parse(flat, normShape);

          if (boxes.length > 0) {
            infoMsg += ` | 📦객체: ${boxes.length}개`;

            ctx.lineWidth = 2;
            ctx.font = "bold 20px Arial";

            boxes.forEach((box) => {
              // YOLO 결과는 0~1 정규화된 좌표 가정
              const x = box.x * modelInputSize;
              const y = box.y * modelInputSize;
              const width = box.w * modelInputSize;
              const height = box.h * modelInputSize;

              const left = x - width / 2;
              const top = y - height / 2;

              // 박스
              ctx.strokeStyle = "#00FF00";
              ctx.strokeRect(left, top, width, height);

              // 라벨
              const labelText = `${box.className} ${(box.score * 100).toFixed(0)}%`;
              const textWidth = ctx.measureText(labelText).width;

              ctx.fillStyle = "#00FF00";
              ctx.fillRect(left, top - 25, textWidth + 10, 25);

              ctx.fillStyle = "black";
              ctx.fillText(labelText, left + 5, top - 5);
            });
          } else {
            infoMsg += " | ⚪객체없음";
          }
        } else {
          infoMsg += " | 출력없음";
        }

        setInferenceInfo(infoMsg);
        console.log(`🔍 추론 완료: ${infoMsg}`);

        // [Step 4] 리포트 전송 (Letterboxed + Boxes Image)
        const finalImageBase64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
        const position = await Geolocation.getCurrentPosition();

        console.log("📤 3초 주기 데이터 전송 중...");
        await sendHazardReport({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          hazard_type: "Periodic_Monitor",
          risk_level: 1,
          description: `모니터링 (3초 주기) ${new Date().toLocaleTimeString()} / ${infoMsg}`,
          imageBase64: finalImageBase64,
        });

        setStatus("전송 완료");
        setTimeout(() => {
          if (isMounted.current) setStatus("모니터링 중...");
        }, 1000);
      } catch (error) {
        console.error("루프 에러:", error);
        setStatus("에러 발생");
        setInferenceInfo(`에러: ${String(error)}`);
      } finally {
        isRunningRef.current = false;
      }
    }, 3000);

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
