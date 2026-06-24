import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import * as tf from "@tensorflow/tfjs";
import * as tflite from "@tensorflow/tfjs-tflite";
import { sendHazardReport } from "../src/api/report";
import { YoloParser, DetectedBox } from "../src/utils/YoloParser";

// VisionCamera는 안내 중 하단 카메라 화면과 AI 장애물 감지를 담당합니다.
// 흐름은 "카메라 프레임 캡처 -> 640x640 전처리 -> TFLite 추론 -> YOLO 박스 파싱 -> 위험물 신고/음성 경고"입니다.

// 모델이 기대하는 정사각형 입력 크기입니다. YOLO/TFLite 모델 export 때의 입력 크기와 맞아야 합니다.
const MODEL_INPUT_SIZE = 640;
// public/wasm/ 에 위치한 모델/런타임 (Vite·Capacitor 모두 루트에서 서빙됨)
const WASM_PREFIX = "/wasm/";
const MODEL_FILE = "best_float32.tflite"; // baseline float32 TFLite 모델
// 장애물 신고 직전에 현재 위치를 한 번 가져올 때 사용하는 GPS 옵션입니다.
const REPORT_POSITION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 10000,
};

// loadTFLiteModel이 반환하는 모델 타입을 직접 추론해 별도 타입 선언 부담을 줄입니다.
type TFLiteModel = Awaited<ReturnType<typeof tflite.loadTFLiteModel>>;

// 모델 라벨은 영어 className으로 나오지만, 사용자 음성 안내는 한국어로 읽어야 합니다.
const LABELS_KO: Record<string, string> = {
  "person": "사람", "bicycle": "자전거", "car": "자동차", "motorcycle": "오토바이",
  "bus": "버스", "truck": "트럭", "traffic light": "신호등", "stop sign": "정지 표지판",
  "bench": "벤치", "dog": "개", "bollard": "볼라드", "kickboard": "킥보드"
};

// 위험도는 백엔드 신고 risk_level과 사용자 음성 경고 조건에 같이 쓰입니다.
const RISK_LEVELS: Record<string, number> = {
  "car": 3, "bus": 3, "truck": 3, "motorcycle": 3, "bicycle": 3, "kickboard": 3,
  "person": 2, "dog": 2,
  "traffic light": 1, "bollard": 1, "stop sign": 1, "bench": 1
};

interface VisionCameraProps {
  // GuidingScreen의 safeSpeak를 넘겨받습니다. 장애물 경고는 isObstacle=true로 우선순위를 높입니다.
  onSpeak?: (text: string, isObstacle?: boolean) => void;
}

const VisionCamera: React.FC<VisionCameraProps> = ({ onSpeak }) => {
  // react-webcam 컴포넌트 인스턴스에 접근해 getScreenshot()을 호출하기 위한 ref입니다.
  const webcamRef = useRef<Webcam>(null);
  // status/inferenceInfo는 화면 오른쪽 위 디버그 뱃지에 표시됩니다.
  const [status, setStatus] = useState<string>("모델 로딩 중...");
  const [inferenceInfo, setInferenceInfo] = useState<string>("");
  const [isModelReady, setIsModelReady] = useState(false);
  // 비동기 모델 로드/추론 중 화면이 사라졌을 때 state 업데이트를 막는 생존 플래그입니다.
  const isMounted = useRef(true);
  // 3초 주기 루프가 겹치지 않도록 "현재 추론 중" 여부를 저장합니다.
  const isRunningRef = useRef(false);
  const lastFrameWarnAtRef = useRef(0);
  // 모델 객체는 크고 렌더링과 무관하므로 state가 아니라 ref에 저장합니다.
  const modelRef = useRef<TFLiteModel | null>(null);
  // onSpeak prop이 바뀌어도 detection interval을 다시 만들지 않도록 최신 콜백만 ref에 보관합니다.
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
        // tf.ready()는 TensorFlow.js 백엔드 초기화가 끝날 때까지 기다립니다.
        await tf.ready();
        // tfjs-tflite가 wasm 런타임 파일을 찾을 위치를 지정합니다.
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
    // 모델이 준비되기 전에는 카메라 추론 루프를 시작하지 않습니다.
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
        // react-webcam은 현재 비디오 프레임을 data URL 문자열로 캡처합니다.
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
        // 백엔드에는 순수 Base64 이미지 문자열만 보내므로 앞의 MIME 헤더를 잘라냅니다.
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
        // 원본 영상 비율을 유지한 채 남는 영역을 검게 채우는 letterbox 방식입니다.
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

        const scale = Math.min(MODEL_INPUT_SIZE / img.width, MODEL_INPUT_SIZE / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (MODEL_INPUT_SIZE - w) / 2, (MODEL_INPUT_SIZE - h) / 2, w, h);

        // 2) tfjs-tflite 추론 ([1,640,640,3] float 0~1 입력)
        const t0 = performance.now();
        const input = tf.tidy(() =>
          // fromPixels: 캔버스를 Tensor로 변환, div(255): 0~255 픽셀값을 0~1로 정규화, expandDims: batch 차원 추가.
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
        // Tensor 데이터는 GPU/wasm 메모리에 있을 수 있으므로 await data()로 JS 배열로 꺼냅니다.
        const flat = Array.from(await outputTensor.data()) as number[];
        const inferenceMs = performance.now() - t0;
        // tf.dispose를 하지 않으면 3초 루프마다 Tensor 메모리가 누적됩니다.
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
          // 이 캔버스는 모델 입력으로도 쓰고, 신고 이미지에 박스를 그리는 용도로도 재사용합니다.
          ctx.lineWidth = 2;
          ctx.font = "bold 20px Arial";

          let maxY = 0;
          boxes.forEach((box) => {
            // YoloParser의 box 좌표는 0~1 정규화 값이므로 640 픽셀 기준으로 다시 환산합니다.
            const bx = box.x * MODEL_INPUT_SIZE;
            const by = box.y * MODEL_INPUT_SIZE;
            const bw = box.w * MODEL_INPUT_SIZE;
            const bh = box.h * MODEL_INPUT_SIZE;
            const boxBottom = box.y + box.h / 2;

            // 화면 중앙 하단에 가까운 객체를 "당장 앞의 장애물"로 간주합니다.
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

          // 박스가 그려진 캔버스를 다시 JPEG Base64로 만들어 신고 이미지로 사용합니다.
          finalImageBase64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];
          // 중앙 하단 장애물이 있으면 우선 신고하고, 없으면 confidence가 가장 높은 박스를 신고합니다.
          reportBox = primaryBox ?? boxes.reduce((best, box) => box.score > best.score ? box : best, boxes[0]);

          if (primaryBox) {
            const pb = primaryBox as DetectedBox;
            const maxSizeRatio = Math.max(pb.w, pb.h);
            // 실제 거리 측정이 아니라 "화면에서 크게 보일수록 가깝다"는 단순 추정값입니다.
            calculatedDistance = parseFloat(Math.max(0.5, Math.min(20.0, 1.0 / (maxSizeRatio + 0.001))).toFixed(2));
            // 박스 중심 x 좌표를 기준으로 왼쪽/중앙/오른쪽 방향을 대략 분류합니다.
            calculatedDirection = pb.x < 0.33 ? "L" : pb.x > 0.66 ? "R" : "C";
            primaryHazardType = pb.className;

            const riskLevel = RISK_LEVELS[pb.className] || 1;
            const distText = Math.round(calculatedDistance);
            const labelKo = LABELS_KO[pb.className] || pb.className;
            const speak = onSpeakRef.current;
            if (speak) {
              // 위험도가 높은 이동체는 5m, 사람/동물은 3m 이내로 추정될 때만 음성 경고합니다.
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
            // 신고 데이터에는 객체 정보뿐 아니라 현재 GPS 좌표가 필요합니다.
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
        // 성공/실패와 관계없이 다음 interval tick이 다시 실행될 수 있도록 잠금을 풉니다.
        isRunningRef.current = false;
      }
    };

    // 첫 감지는 빠르게 한 번 실행하고, 이후에는 3초마다 반복합니다.
    const firstLoopTimeout = window.setTimeout(runDetection, 500);
    const loopInterval = window.setInterval(runDetection, 3000);

    return () => {
      // GuidingScreen을 떠나면 카메라 추론 루프를 반드시 멈춥니다.
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
        // forceScreenshotSourceSize는 비디오 원본 해상도 기준으로 캡처해 추론 입력 품질을 유지합니다.
        forceScreenshotSourceSize
        videoConstraints={{
          // environment는 후면 카메라를 우선 요청합니다.
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
