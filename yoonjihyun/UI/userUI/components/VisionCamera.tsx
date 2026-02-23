import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import { sendHazardReport } from "../src/api/report";
import NpuTflite from "../NpuTfliteBridge";
import { YoloParser, DetectedBox } from "../src/utils/YoloParser";

const MODEL_PATH = "wasm/yolo26n_float32.tflite";

const LABELS_KO: Record<string, string> = {
  "person": "사람", "bicycle": "자전거", "car": "자동차", "motorcycle": "오토바이",
  "airplane": "비행기", "bus": "버스", "train": "기차", "truck": "트럭",
  "boat": "보트", "traffic light": "신호등", "fire hydrant": "소화전",
  "stop sign": "정지 표지판", "parking meter": "주차 요금소", "bench": "벤치",
  "bird": "새", "cat": "고양이", "dog": "개", "horse": "말", "sheep": "양", "cow": "소",
  "elephant": "코끼리", "bear": "곰", "zebra": "얼룩말", "giraffe": "기린", "backpack": "배낭",
  "umbrella": "우산", "handbag": "핸드백", "tie": "넥타이", "suitcase": "여행 가방",
  "frisbee": "프리스비", "skis": "스키", "snowboard": "스노우보드", "sports ball": "스포츠 공",
  "kite": "연", "baseball bat": "야구 방망이", "baseball glove": "야구 글러브", "skateboard": "스케이트보드",
  "surfboard": "서핑보드", "tennis racket": "테니스 라켓", "bottle": "병", "wine glass": "와인 잔",
  "cup": "컵", "fork": "포크", "knife": "나이프", "spoon": "숟가락", "bowl": "그릇",
  "banana": "바나나", "apple": "사과", "sandwich": "샌드위치", "orange": "오렌지", "broccoli": "브로콜리",
  "carrot": "당근", "hot dog": "핫도그", "pizza": "피자", "donut": "도넛", "cake": "케이크",
  "chair": "의자", "couch": "소파", "potted plant": "화분", "bed": "침대", "dining table": "식탁",
  "toilet": "화장실", "tv": "TV", "laptop": "노트북", "mouse": "마우스", "remote": "리모컨",
  "keyboard": "키보드", "cell phone": "휴대폰", "microwave": "전자레인지", "oven": "오븐",
  "toaster": "토스터", "sink": "싱크대", "refrigerator": "냉장고", "book": "책", "clock": "시계",
  "vase": "꽃병", "scissors": "가위", "teddy bear": "곰인형", "hair drier": "헤어드라이어", "toothbrush": "칫솔"
};

interface VisionCameraProps {
  onSpeak?: (text: string, isObstacle?: boolean) => void;
}

const VisionCamera: React.FC<VisionCameraProps> = ({ onSpeak }) => {
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

  const normalizeYoloOutput = (
    data: any,
    shape: any
  ): { flat: number[]; normShape: number[] } => {
    let flat: number[] = [];
    if (Array.isArray(data)) {
      flat = data.map((v) => Number(v));
    } else if (data && typeof data.length === "number") {
      flat = Array.from(data as ArrayLike<number>, (v) => Number(v));
    } else {
      flat = [];
    }

    let normShape: number[] = [];
    if (Array.isArray(shape) && shape.length) {
      normShape = shape.map((v) => Number(v));
    }

    if (normShape.length === 0 && flat.length > 0) {
      const boxCandidates = [8400, 2100, 33600];
      for (const n of boxCandidates) {
        if (flat.length % n === 0) {
          const attrs = flat.length / n;
          normShape = [1, attrs, n];
          break;
        }
      }
    }

    if (normShape.length === 2) {
      const a = normShape[0];
      const b = normShape[1];

      if (b >= 6 && b <= 300) {
        normShape = [1, b, a];
      } else if (a >= 6 && a <= 300) {
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

        // [Step 1] Letterbox Preprocessing (640x640)
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

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, modelInputSize, modelInputSize);

        const scale = Math.min(modelInputSize / img.width, modelInputSize / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const tx = (modelInputSize - w) / 2;
        const ty = (modelInputSize - h) / 2;

        ctx.drawImage(img, tx, ty, w, h);

        const letterboxedBase64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1];

        // [Step 2] NPU 추론 실행
        const startTime = performance.now();
        const result = await NpuTflite.detect({ image: letterboxedBase64 });
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(0);

        // [Step 3] 결과 파싱 및 그리기
        let infoMsg = `시간: ${duration}ms`;

        // ★ DB 전송을 위한 거리 및 방향 초기값 설정 (NOT NULL 제약조건 방어)
        let calculatedDistance = 0.0;
        let calculatedDirection = 'C';
        let primaryHazardType = "정면 근접 객체 감지X";
        let boxes: DetectedBox[] = [];
        let primaryBox: DetectedBox | null = null;

        if (result && result.data && (result.data.length ?? 0) > 0) {
          infoMsg += ` | 데이터: ${result.data.length}개`;
          if (result.shape) infoMsg += ` | Shape: [${result.shape.join("x")}]`;

          const { flat, normShape } = normalizeYoloOutput(result.data, result.shape);

          // 더 많은 객체(희미한 객체)를 잡기 위해 신뢰도 임계값(confThreshold)을 기본 0.25에서 0.15로 낮춥니다.
          // 또한 겹친 객체를 더 많이 남기기 위해 iouThreshold를 기본 0.45에서 0.5로 높여서 전달합니다.
          boxes = YoloParser.parse(flat, normShape, 0.15, 0.5);

          if (boxes.length > 0) {
            infoMsg += ` | 📦객체: ${boxes.length}개`;

            ctx.lineWidth = 2;
            ctx.font = "bold 20px Arial";

            // ---------------------------------------------------------------------
            // [학습 포인트: 가장 위협이 되는(가까운) 주 객체 찾기]
            // 여러 객체가 발견되었을 때, 박스의 밑부분(바닥)이 그려진 Y좌표가 가장 큰(가장 아래쪽에 있는) 것을 
            // '가장 가까이 있는 주 방해물'로 판단합니다.
            // ---------------------------------------------------------------------
            let maxY = 0; // maxArea 대신 Y 좌표 보관용 변수 생성

            boxes.forEach((box) => {
              const x = box.x * modelInputSize;
              const y = box.y * modelInputSize;
              const width = box.w * modelInputSize;
              const height = box.h * modelInputSize;

              const left = x - width / 2;
              const top = y - height / 2;

              // 박스 밑부분(바닥) 좌표 계산 (박스 중심 y + 박스 높이의 절반)
              const boxBottom = box.y + box.h / 2;

              // 박스 좌/우 경계 계산
              const boxLeft = box.x - box.w / 2;
              const boxRight = box.x + box.w / 2;

              // 화면 중앙 영역(0.33 ~ 0.66 비율)과 조금이라도 겹치면서,
              // 박스 밑바닥(boxBottom)이 화면 아래쪽 1/3 (y > 0.66) 영역까지 내려온 객체 중
              // 화면 가장 아래쪽(바닥)인 객체를 골라냅니다.
              if (boxBottom > maxY && boxRight > 0.33 && boxLeft < 0.66 && boxBottom > 0.66) {
                maxY = boxBottom;
                primaryBox = box;
              }

              // 캔버스에 그리기
              ctx.strokeStyle = "#00FF00";
              ctx.strokeRect(left, top, width, height);

              const labelText = `${box.className} ${(box.score * 100).toFixed(0)}%`;
              const textWidth = ctx.measureText(labelText).width;

              ctx.fillStyle = "#00FF00";
              ctx.fillRect(left, top - 25, textWidth + 10, 25);

              ctx.fillStyle = "black";
              ctx.fillText(labelText, left + 5, top - 5);
            });

            // ★ 찾은 primaryBox(주요 타겟)를 맨 위에 빨간색으로 한 번 더 덧그리기
            if (primaryBox) {
              const px = primaryBox.x * modelInputSize;
              const py = primaryBox.y * modelInputSize;
              const pwidth = primaryBox.w * modelInputSize;
              const pheight = primaryBox.h * modelInputSize;
              const pleft = px - pwidth / 2;
              const ptop = py - pheight / 2;

              ctx.lineWidth = 1; // 눈에 확 띄게 테두리를 약간 두껍게 설정
              ctx.strokeStyle = "#FF0000"; // 테두리 선: 빨간색
              ctx.strokeRect(pleft, ptop, pwidth, pheight);

              const labelText = `${primaryBox.className} ${(primaryBox.score * 100).toFixed(0)}%`;
              const textWidth = ctx.measureText(labelText).width;

              ctx.fillStyle = "#FF0000"; // 이름 배경 박스: 빨간색
              ctx.fillRect(pleft, ptop - 25, textWidth + 10, 25);

              ctx.fillStyle = "white"; // 글씨 색상: 흰색(가독성)
              ctx.fillText(labelText, pleft + 5, ptop - 5);
            }

            if (primaryBox) {
              // ---------------------------------------------------------------------
              // [학습 포인트: 거리 계산 공식 적용]
              // 화면에서 차지하는 비율이 클수록 거리가 가깝습니다. (가상 핀홀 카메라 원리 적용)
              // 1.0 / Math.max(w, h)를 사용하여, 꽉 차면(1.0) 약 1m, 10%면(0.1) 10m로 추산합니다.
              // ---------------------------------------------------------------------
              const maxSizeRatio = Math.max(primaryBox.w, primaryBox.h);
              // 너무 큰 값(무한대)을 방지하기 위해 최대 20m, 최소 0.5m로 제한합니다.
              calculatedDistance = parseFloat(Math.max(0.5, (Math.min(20.0, 1.0 / (maxSizeRatio + 0.001))) / 2.0).toFixed(2));

              if (onSpeak) {
                const labelKo = LABELS_KO[primaryBox.className] || primaryBox.className;
                const distanceText = Math.round(calculatedDistance);
                onSpeak(`약 ${distanceText}미터 앞에 ${labelKo}이 있습니다.`, true);
              }

              // ---------------------------------------------------------------------
              // [학습 포인트: 방향 판단 로직]
              // YOLO 결과의 box.x는 0 ~ 1 사이의 중심점 좌표입니다.
              // 0 ~ 0.33은 좌측, 0.33 ~ 0.66은 정면, 0.66 ~ 1.0은 우측입니다.
              // ---------------------------------------------------------------------
              if (primaryBox.x < 0.33) {
                calculatedDirection = 'L'; // 좌측
              } else if (primaryBox.x > 0.66) {
                calculatedDirection = 'R'; // 우측
              } else {
                calculatedDirection = 'C'; // 정면(중앙)
              }

              primaryHazardType = primaryBox.className;
              infoMsg += ` | 타겟: ${primaryHazardType} (${calculatedDirection}, ${calculatedDistance}m)`;
            } else {
              infoMsg += " | 타겟없음(중앙 하단 객체 없음)";
            }
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

        // ★ API 명세에 맞게 distance와 direction 데이터를 추가하여 전송합니다.
        // 객체가 없을 때는 기본값(거리: 0, 방향: 'C')이 전송됩니다.
        await sendHazardReport({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          hazard_type: boxes && boxes.length > 0 ? primaryHazardType : "1/3으로 나눴을때 가운데면서 아래에서부터 절반까지 안에서 객체감지X",
          risk_level: boxes && boxes.length > 0 ? 3 : 1, // 객체가 감지되면 위험도를 높입니다.
          description: `모니터링 ${new Date().toLocaleTimeString()} / ${infoMsg}`,
          imageBase64: finalImageBase64,
          distance: calculatedDistance,   // float 데이터 전송
          direction: calculatedDirection,  // string 데이터 전송
          x: primaryBox ? primaryBox.x : 0.0,
          y: primaryBox ? primaryBox.y : 0.0,
          w: primaryBox ? primaryBox.w : 0.0,
          h: primaryBox ? primaryBox.h : 0.0,
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