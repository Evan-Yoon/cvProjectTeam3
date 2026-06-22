import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import * as tf from "@tensorflow/tfjs";
import * as tflite from "@tensorflow/tfjs-tflite";
import { sendHazardReport } from "../src/api/report";
import { YoloParser, DetectedBox } from "../src/utils/YoloParser";

const MODEL_INPUT_SIZE = 640;
// public/wasm/ 에 위치한 모델/런타임 (Vite·Capacitor 모두 루트에서 서빙됨)
const WASM_PREFIX = "/wasm/";
const MODEL_FILE = "best_float32.tflite"; // baseline float32 TFLite 모델
const REPORT_POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 10000,
};

type TFLiteModel = Awaited<ReturnType<typeof tflite.loadTFLiteModel>>;

const LABELS_KO: Record<string, string> = {
  "person": "사람", "bicycle": "자전거", "car": "자동차", "motorcycle": "오토바이",
  "bus": "버스", "truck": "트럭", "traffic light": "신호등", "stop sign": "정지 표지판",
  "bench": "벤치", "dog": "개", "bollard": "볼라드", "kickboard": "킥보드"
};

const RISK_LEVELS: Record<string, number> = {
  "car": 3, "bus": 3, "truck": 3, "motorcycle": 3, "bicycle": 3, "kickboard": 3,
  "person": 2, "dog": 2,
  "traffic light": 1, "bollard": 1, "stop sign": 1, "bench": 1
};

interface VisionCameraProps {
  onSpeak?: (text: string, isObstacle?: boolean) => void;
}

const VisionCamera: React.FC<VisionCameraProps> = ({ onSpeak }) => {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState<string>("모델 로딩 중...");
  const [inferenceInfo, setInferenceInfo] = useState<string>("");
  const [isModelReady, setIsModelReady] = useState(false);
  const isMounted = useRef(true);
  const isRunningRef = useRef(false);
  const lastFrameWarnAtRef = useRef(0);
  const modelRef = useRef<TFLiteModel | null>(null);
  const onSpeakRef = useRef(onSpeak);

  useEffect(() => {
    onSpeakRef.current = onSpeak;
  }, [onSpeak]);

  // 1) tfjs-tflite 로 모델 로드 (WebView 내 JS 추론, GuidingScreen 진입 시 1회)
  useEffect(() => {
    isMounted.current = true;

    const loadModel = async () => {
      try {
        setStatus("모델 로딩 중...");
        await tf.ready();
        tflite.setWasmPath(WASM_PREFIX);
        console.log("📥 tfjs-tflite 모델 로드...", MODEL_FILE);
        const model = await tflite.loadTFLiteModel(`${WASM_PREFIX}${MODEL_FILE}`);
        if (!isMounted.current) return;
        console.log("🧠 TFLite model inputs", model.inputs);
        console.log("🧠 TFLite model outputs", model.outputs);
        modelRef.current = model;
        setIsModelReady(true);
        console.log("✅ tfjs-tflite: 모델 로드 완료", MODEL_FILE);
        setStatus("모델 준비 완료");
      } catch (error: any) {
        const msg = error?.message ?? String(error);
        console.error("❌ tfjs-tflite: 모델 로드 실패:", msg);
        if (isMounted.current) {
          setIsModelReady(false);
          setStatus(`모델 로드 실패: ${msg}`);
        }
      }
    };

    loadModel();
    return () => {
      isMounted.current = false;
      modelRef.current = null;
    };
  }, []);

  // 2) 3초마다 촬영 → 추론 → 전송
  useEffect(() => {
    if (!isModelReady) return;
    console.log("▶️ 객체탐지 루프 시작");

    const runDetection = async () => {
      console.log("⏱️ 객체탐지 tick");
      if (!isMounted.current) return;
      if (!webcamRef.current) {
        console.warn("📷 Webcam ref가 아직 준비되지 않음");
        return;
      }
      if (isRunningRef.current) {
        console.warn("⏳ 이전 객체탐지가 아직 진행 중");
        return;
      }
      const model = modelRef.current;
      if (!model) {
        console.warn("🧠 모델 ref가 아직 준비되지 않음");
        return;
      }
      isRunningRef.current = true;

      try {
        // 스크린샷 (base64 JPEG)
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          const now = Date.now();
          if (now - lastFrameWarnAtRef.current > 5000) {
            console.warn("📷 카메라 프레임 없음: getScreenshot()이 null을 반환함");
            lastFrameWarnAtRef.current = now;
          }
          if (isMounted.current) setStatus("카메라 프레임 대기 중...");
          return;
        }
        console.log("📷 카메라 프레임 캡처 완료", imageSrc.length);

        // "data:image/jpeg;base64," 헤더 제거
        const base64 = imageSrc.split(",")[1];

        // 1) 웹캠 프레임을 640x640 레터박스 캔버스에 그림 (모델 입력 + 시각화 공용)
        const img = new Image();
        img.src = imageSrc;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("이미지 로드 실패"));
        });

        const canvas = document.createElement("canvas");
        canvas.width = MODEL_INPUT_SIZE;
        canvas.height = MODEL_INPUT_SIZE;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

        const scale = Math.min(MODEL_INPUT_SIZE / img.width, MODEL_INPUT_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (MODEL_INPUT_SIZE - w) / 2, (MODEL_INPUT_SIZE - h) / 2, w, h);

        // 2) tfjs-tflite 추론 ([1,640,640,3] float 0~1 입력)
        const t0 = performance.now();
        const input = tf.tidy(() =>
          tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0)
        );
        // tfjs(4.22)와 tfjs-tflite(alpha)의 Tensor 타입 정체성이 달라 경계에서 any 처리
        console.log("🧠 TFLite predict 시작", input.shape);
        const out: any = model.predict(input as any);
        const outputTensor: any = Array.isArray(out)
          ? out[0]
          : (out && typeof out.data === "function")
            ? out
            : Object.values(out)[0];
        const shape: number[] = outputTensor.shape;
        console.log("🧠 TFLite output shape", shape);
        const flat = Array.from(await outputTensor.data()) as number[];
        const inferenceMs = performance.now() - t0;
        tf.dispose([input, outputTensor]);

        // YoloParser로 박스 파싱
        const boxes: DetectedBox[] = YoloParser.parse(flat, shape, 0.3, 0.5);
        console.log("📦 파싱 박스 수", boxes.length);

        let infoMsg = `시간: ${inferenceMs.toFixed(0)}ms`;
        let calculatedDistance = 0.0;
        let calculatedDirection = "C";
        let primaryHazardType = "감지X";
        let primaryBox: DetectedBox | null = null;
        let reportBox: DetectedBox | null = null;
        let finalImageBase64 = base64;

        if (boxes.length > 0) {
          infoMsg += ` | 📦객체: ${boxes.length}개`;

          // 레터박스 캔버스 위에 바운딩박스 시각화
          ctx.lineWidth = 2;
          ctx.font = "bold 20px Arial";

          let maxY = 0;
          boxes.forEach((box) => {
            const bx = box.x * MODEL_INPUT_SIZE;
            const by = box.y * MODEL_INPUT_SIZE;
            const bw = box.w * MODEL_INPUT_SIZE;
            const bh = box.h * MODEL_INPUT_SIZE;
            const boxBottom = box.y + box.h / 2;

            if (boxBottom > maxY && (box.x + box.w / 2) > 0.33 && (box.x - box.w / 2) < 0.66 && boxBottom > 0.66) {
              maxY = boxBottom;
              primaryBox = box;
            }

            ctx.strokeStyle = "#00FF00";
            ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
            const labelText = `${box.className} ${(box.score * 100).toFixed(0)}%`;
            const textWidth = ctx.measureText(labelText).width;
            ctx.fillStyle = "#00FF00";
            ctx.fillRect(bx - bw / 2, by - bh / 2 - 25, textWidth + 10, 25);
            ctx.fillStyle = "black";
            ctx.fillText(labelText, bx - bw / 2 + 5, by - bh / 2 - 5);
          });

          finalImageBase64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
          reportBox = primaryBox ?? boxes.reduce((best, box) => box.score > best.score ? box : best, boxes[0]);

          if (primaryBox) {
            const pb = primaryBox as DetectedBox;
            const maxSizeRatio = Math.max(pb.w, pb.h);
            calculatedDistance = parseFloat(Math.max(0.5, Math.min(20.0, 1.0 / (maxSizeRatio + 0.001))).toFixed(2));
            calculatedDirection = pb.x < 0.33 ? "L" : pb.x > 0.66 ? "R" : "C";
            primaryHazardType = pb.className;

            const riskLevel = RISK_LEVELS[pb.className] || 1;
            const distText = Math.round(calculatedDistance);
            const labelKo = LABELS_KO[pb.className] || pb.className;
            const speak = onSpeakRef.current;
            if (speak) {
              if (riskLevel === 3 && calculatedDistance <= 5.0)
                speak(`약 ${distText}미터 앞에 ${labelKo} 확인됨.`, true);
              else if (riskLevel === 2 && calculatedDistance <= 3.0)
                speak(`약 ${distText}미터 앞에 ${labelKo} 확인됨.`, true);
            }

            infoMsg += ` | 타겟: ${primaryHazardType} (${calculatedDirection}, ${calculatedDistance}m)`;
          } else if (reportBox) {
            primaryHazardType = reportBox.className;
            infoMsg += ` | 감지: ${primaryHazardType}`;
          }
        } else {
          infoMsg += " | 객체없음";
        }

        setInferenceInfo(infoMsg);
        console.log(`🔍 추론 완료: ${infoMsg}`);

        if (reportBox) {
          // 리포트 전송
          let position;
          try {
            position = await Geolocation.getCurrentPosition(REPORT_POSITION_OPTIONS);
          } catch (locationError) {
            console.warn("신고 위치 확보 실패 - 신고 전송 생략:", locationError);
            if (isMounted.current) setStatus("위치 대기 중...");
            return;
          }

          await sendHazardReport({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            hazard_type: primaryHazardType,
            risk_level: RISK_LEVELS[reportBox.className] || 1,
            description: `모니터링 ${new Date().toLocaleTimeString()} / ${infoMsg}`,
            imageBase64: finalImageBase64,
            label: reportBox.className,
          });

          if (isMounted.current) {
            setStatus("전송 완료");
            setTimeout(() => { if (isMounted.current) setStatus("모니터링 중..."); }, 1000);
          }
        } else if (isMounted.current) {
          console.log("📭 감지된 객체 없음 - 신고 전송 생략");
          setStatus("모니터링 중...");
        }
      } catch (error) {
        console.error("루프 에러:", error);
        if (isMounted.current) {
          setStatus("에러 발생");
          setInferenceInfo(`에러: ${String(error)}`);
        }
      } finally {
        isRunningRef.current = false;
      }
    };

    const firstLoopTimeout = window.setTimeout(runDetection, 500);
    const loopInterval = window.setInterval(runDetection, 3000);

    return () => {
      console.log("⏹️ 객체탐지 루프 종료");
      clearTimeout(firstLoopTimeout);
      clearInterval(loopInterval);
    };
  }, [isModelReady]);

  return (
    <div className="relative w-full h-full bg-black flex justify-center items-center overflow-hidden">
      <Webcam
        ref={webcamRef}
        audio={false}
        muted
        playsInline
        screenshotFormat="image/jpeg"
        screenshotQuality={0.85}
        forceScreenshotSourceSize
        videoConstraints={{
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 640 },
        }}
        onUserMedia={() => {
          console.log("📷 카메라 스트림 준비 완료");
          if (isMounted.current) setStatus("카메라 준비 완료");
        }}
        onUserMediaError={(error) => {
          console.error("❌ 카메라 스트림 시작 실패:", error);
          if (isMounted.current) setStatus(`카메라 오류: ${String(error)}`);
        }}
        style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-50">
        <div className="bg-black/60 px-3 py-1 rounded-full">
          <p className="text-yellow-400 font-mono text-xs font-bold animate-pulse">{status}</p>
        </div>
        {inferenceInfo && (
          <div className="bg-blue-900/80 px-3 py-1 rounded-lg border border-blue-400">
            <p className="text-white font-mono text-[10px] whitespace-pre-wrap max-w-[200px]">{inferenceInfo}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisionCamera;
