import { DetectedBox } from '../types';

// YoloParser는 TFLite 모델의 숫자 배열 출력값을 사람이 다루기 쉬운 감지 박스 목록으로 바꿉니다.
// 모델 export 방식에 따라 출력 shape가 [1,N,6], [1,F,B], [1,B,F]처럼 달라질 수 있어 여러 포맷을 방어적으로 처리합니다.

// 모델 학습/라벨 순서와 반드시 일치해야 합니다. classId=0이면 "person"으로 해석됩니다.
const COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "bus", "truck", "traffic light",
    "stop sign", "bench", "dog", "bollard", "kickboard"
];

// YOLO raw output이 feature-major인지 box-major인지 구분하기 위한 내부 타입입니다.
// FxB: feature가 먼저, box가 뒤. BxF: box가 먼저, feature가 뒤.
type Layout = "FxB" | "BxF";

export class YoloParser {
    /**
     * TFLite 모델의 원본 raw 1차원 숫자 배열 출력을 파싱하여 
     * 사람이 처리하기 쉬운 DetectedBox[] 객체 리스트로 통합 변환합니다.
     * NMS(Non-Maximum Suppression)를 내장하고 있어 중복 박스를 정리합니다.
     * 
     * @param data - 모델이 출력한 raw 1차원 float32 데이터 배열
     * @param dims - 출력 Tensor의 shape 차원 정보 (예: [1, 84, 8400] 등)
     * @param confThreshold - 탐지 신뢰도 임계값 (기본값: 0.25)
     * @param iouThreshold - NMS 중복 박스 제거 시 기준이 될 IoU 임계값 (기본값: 0.45)
     * @param modelInputSize - 모델 학습 시의 정방형 입력 해상도 크기 (기본값: 640)
     * @returns 필터링이 완료된 최종 객체 탐지 박스 배열
     */
    static parse(
        data: number[],
        dims: number[] = [],
        confThreshold: number = 0.25,
        iouThreshold: number = 0.45,
        modelInputSize: number = 640
    ): DetectedBox[] {
        // 데이터가 없으면 감지 결과도 없습니다.
        if (!data || data.length === 0) return [];

        // dims는 Tensor shape입니다. 숫자가 아닌 값이 섞여 들어와도 안전하게 걸러냅니다.
        const d = (Array.isArray(dims) ? dims : []).map((v) => Number(v)).filter((v) => Number.isFinite(v));

        // ✅ 1) 최우선: [1, N, 6] 또는 [N, 6] (후처리 완료된 detection list)
        // 일반적으로 row = [x1, y1, x2, y2, score, classId]
        // 이 포맷은 모델이 이미 후보 박스와 클래스까지 뽑아준 형태라 가장 해석이 단순합니다.
        const maybeDetList =
            (d.length === 3 && d[0] === 1 && d[2] === 6) ||
            (d.length === 2 && d[1] === 6);

        if (maybeDetList) {
            const N = d.length === 3 ? d[1] : d[0];
            const expected = N * 6;

            if (data.length !== expected) {
                console.warn(`[YoloParser] DetList length mismatch. Expected ${expected}, got ${data.length}`, { dims: d });
                // 그래도 가능한 만큼만 처리
            }

            const boxes: DetectedBox[] = [];
            const rows = Math.floor(data.length / 6);

            for (let i = 0; i < rows; i++) {
                // 한 행은 6개 숫자입니다: x1, y1, x2, y2, score, classId.
                const off = i * 6;

                let x1 = data[off + 0];
                let y1 = data[off + 1];
                let x2 = data[off + 2];
                let y2 = data[off + 3];
                const score = data[off + 4];
                const classIdRaw = data[off + 5];

                if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2) || !isFinite(score) || !isFinite(classIdRaw)) {
                    continue;
                }
                if (score < confThreshold) continue;

                // ✅ 좌표가 픽셀(0~640 등)인지 0~1 정규화인지 자동 판별
                // 값이 1.5보다 크면 픽셀로 간주 (대부분 0~640 범위)
                // 정규화 좌표라면 보통 0~1 범위이고, 픽셀 좌표라면 10, 300처럼 1보다 훨씬 큽니다.
                const maxAbs = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));
                if (maxAbs > 1.5) {
                    x1 /= modelInputSize;
                    y1 /= modelInputSize;
                    x2 /= modelInputSize;
                    y2 /= modelInputSize;
                }

                // 정렬 보정 (혹시 x1>x2로 들어오면 swap)
                // 모델/후처리 구현에 따라 좌상단/우하단 순서가 뒤집힌 데이터를 방어합니다.
                if (x2 < x1) [x1, x2] = [x2, x1];
                if (y2 < y1) [y1, y2] = [y2, y1];

                // clamp
                // 화면 밖으로 살짝 튀어나온 좌표는 0~1 범위로 잘라 UI 계산을 안정화합니다.
                x1 = clamp01(x1); y1 = clamp01(y1); x2 = clamp01(x2); y2 = clamp01(y2);

                const w = clamp01(x2 - x1);
                const h = clamp01(y2 - y1);
                if (w <= 0 || h <= 0) continue;

                const cx = clamp01(x1 + w / 2);
                const cy = clamp01(y1 + h / 2);

                const classId = Math.max(0, Math.round(classIdRaw));
                boxes.push({
                    classId,
                    className: COCO_CLASSES[classId] || `class_${classId}`,
                    score,
                    x: cx,
                    y: cy,
                    w,
                    h
                });
            }

            // 이 포맷은 보통 이미 NMS/TopK가 된 결과라 NMS는 약하게만 적용
            return this.nms(boxes, iouThreshold);
        }

        // ✅ 2) 그 외: raw YOLO 출력(84/85, transpose 등) 처리 (기존 로직 확장)
        const inferred = this.inferRawShape(data.length, d);
        if (!inferred) {
            console.warn("[YoloParser] Unable to infer raw shape.", { dims: d, dataLen: data.length });
            return [];
        }

        const { numBoxes, numFeatures, layout } = inferred;

        const knownClassCount = COCO_CLASSES.length;
        // 일부 YOLO 출력은 [x,y,w,h,obj,classes...]이고, 일부는 [x,y,w,h,classes...]입니다.
        // objectness가 있으면 class probability와 곱해서 최종 score를 만듭니다.
        const hasObjectness =
            numFeatures === knownClassCount + 5 ||
            (numFeatures !== knownClassCount + 4 && numFeatures === 85);
        const classStart = hasObjectness ? 5 : 4;
        const numClasses = Math.max(0, numFeatures - classStart);

        if (numClasses <= 0) return [];
        if (data.length !== numBoxes * numFeatures) {
            console.warn(`[YoloParser] Raw length mismatch. Expected ${numBoxes * numFeatures}, got ${data.length}`, inferred);
            return [];
        }

        const boxes: DetectedBox[] = [];

        for (let i = 0; i < numBoxes; i++) {
            // raw YOLO는 보통 중심 좌표(cx,cy)와 너비/높이(w,h)를 냅니다.
            let cx = this.read(data, layout, numBoxes, numFeatures, i, 0);
            let cy = this.read(data, layout, numBoxes, numFeatures, i, 1);
            let w = this.read(data, layout, numBoxes, numFeatures, i, 2);
            let h = this.read(data, layout, numBoxes, numFeatures, i, 3);

            if (!isFinite(cx) || !isFinite(cy) || !isFinite(w) || !isFinite(h)) continue;

            // Ultralytics YOLO TFLite raw output is usually xywh in model pixels.
            const maxAbs = Math.max(Math.abs(cx), Math.abs(cy), Math.abs(w), Math.abs(h));
            if (maxAbs > 1.5) {
                cx /= modelInputSize;
                cy /= modelInputSize;
                w /= modelInputSize;
                h /= modelInputSize;
            }

            const obj = hasObjectness ? this.read(data, layout, numBoxes, numFeatures, i, 4) : 1.0;

            let bestScore = -Infinity;
            let bestClass = -1;

            // 각 클래스 확률 중 가장 높은 클래스를 이 박스의 예측 클래스로 선택합니다.
            for (let c = 0; c < numClasses; c++) {
                const clsProb = this.read(data, layout, numBoxes, numFeatures, i, classStart + c);
                const score = hasObjectness ? (obj * clsProb) : clsProb;
                if (score > bestScore) {
                    bestScore = score;
                    bestClass = c;
                }
            }

            if (bestScore > confThreshold && bestClass >= 0) {
                boxes.push({
                    classId: bestClass,
                    className: COCO_CLASSES[bestClass] || `class_${bestClass}`,
                    score: bestScore,
                    x: clamp01(cx),
                    y: clamp01(cy),
                    w: clamp01(w),
                    h: clamp01(h)
                });
            }
        }

        return this.nms(boxes, iouThreshold);
    }

    private static inferRawShape(
        dataLen: number,
        dims: number[]
    ): { numBoxes: number; numFeatures: number; layout: Layout } | null {
        // Tensor shape가 있으면 먼저 shape를 믿고 feature 수와 box 수를 추론합니다.
        // [1, F, B] or [1, B, F]
        if (dims.length >= 3 && dims[0] === 1) {
            const a = dims[1];
            const b = dims[2];
            if (a * b === dataLen) {
                const aLooksF = a >= 6 && a <= 300;
                const bLooksF = b >= 6 && b <= 300;
                // feature 수는 보통 6~300 사이이고, box 수는 2100/8400처럼 훨씬 큽니다.
                if (aLooksF && !bLooksF) return { numBoxes: b, numFeatures: a, layout: "FxB" };
                if (bLooksF && !aLooksF) return { numBoxes: a, numFeatures: b, layout: "BxF" };
                return { numBoxes: b, numFeatures: a, layout: "FxB" };
            }
        }

        // [F, B] or [B, F]
        if (dims.length === 2) {
            const a = dims[0];
            const b = dims[1];
            if (a * b === dataLen) {
                const aLooksF = a >= 6 && a <= 300;
                const bLooksF = b >= 6 && b <= 300;
                if (aLooksF && !bLooksF) return { numBoxes: b, numFeatures: a, layout: "FxB" };
                if (bLooksF && !aLooksF) return { numBoxes: a, numFeatures: b, layout: "BxF" };
                return { numBoxes: b, numFeatures: a, layout: "FxB" };
            }
        }

        // shape 없으면 boxes 후보로 역산
        // YOLO 계열에서 자주 나오는 후보 박스 개수를 기준으로 dataLen을 나눠 feature 수를 추정합니다.
        const boxCandidates = [8400, 2100, 33600];
        for (const boxes of boxCandidates) {
            if (dataLen % boxes === 0) {
                const features = dataLen / boxes;
                if (features >= 6 && features <= 300) {
                    return { numBoxes: boxes, numFeatures: features, layout: "FxB" };
                }
            }
        }

        return null;
    }

    private static read(
        data: number[],
        layout: Layout,
        numBoxes: number,
        numFeatures: number,
        boxIndex: number,
        featureIndex: number
    ): number {
        // 같은 1차원 배열이라도 layout에 따라 "feature 먼저"인지 "box 먼저"인지 인덱스 공식이 달라집니다.
        return layout === "FxB"
            ? data[featureIndex * numBoxes + boxIndex]
            : data[boxIndex * numFeatures + featureIndex];
    }

    private static nms(boxes: DetectedBox[], iouThreshold: number): DetectedBox[] {
        if (boxes.length === 0) return [];

        // NMS(Non-Maximum Suppression): 같은 물체를 여러 박스가 잡았을 때 가장 확신 높은 박스만 남기는 후처리입니다.
        boxes.sort((a, b) => b.score - a.score);

        const result: DetectedBox[] = [];
        const active = new Array(boxes.length).fill(true);

        for (let i = 0; i < boxes.length; i++) {
            if (!active[i]) continue;
            result.push(boxes[i]);

            for (let j = i + 1; j < boxes.length; j++) {
                if (!active[j]) continue;
                const iou = this.calculateIoU(boxes[i], boxes[j]);
                // IoU가 임계값보다 크면 두 박스가 같은 물체를 가리킨다고 보고 낮은 점수 박스를 제거합니다.
                if (iou > iouThreshold) active[j] = false;
            }
        }
        return result;
    }

    private static calculateIoU(a: DetectedBox, b: DetectedBox): number {
        // IoU는 두 박스의 교집합 면적 / 합집합 면적입니다. 1이면 완전히 겹치고, 0이면 겹치지 않습니다.
        const A = this.getCoords(a);
        const B = this.getCoords(b);

        const x1 = Math.max(A.x1, B.x1);
        const y1 = Math.max(A.y1, B.y1);
        const x2 = Math.min(A.x2, B.x2);
        const y2 = Math.min(A.y2, B.y2);

        const iw = Math.max(0, x2 - x1);
        const ih = Math.max(0, y2 - y1);
        const inter = iw * ih;

        const areaA = Math.max(0, A.x2 - A.x1) * Math.max(0, A.y2 - A.y1);
        const areaB = Math.max(0, B.x2 - B.x1) * Math.max(0, B.y2 - B.y1);
        const union = areaA + areaB - inter;

        return union === 0 ? 0 : inter / union;
    }

    private static getCoords(box: DetectedBox) {
        // 중심 좌표(cx,cy,w,h)를 좌상단/우하단(x1,y1,x2,y2) 형태로 변환합니다.
        return {
            x1: box.x - box.w / 2,
            y1: box.y - box.h / 2,
            x2: box.x + box.w / 2,
            y2: box.y + box.h / 2
        };
    }
}

/**
 * 주어진 임의의 숫자를 0.0 ~ 1.0 사잇값으로 보정(Clamping)합니다.
 * 
 * @param v - 보정 대상 숫자
 * @returns 0과 1 사이로 강제 조정된 값
 */
function clamp01(v: number) {
    // 좌표를 0~1 범위에 가둡니다. UI 계산과 이미지 그리기에서 범위 밖 값으로 인한 오류를 줄입니다.
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}
