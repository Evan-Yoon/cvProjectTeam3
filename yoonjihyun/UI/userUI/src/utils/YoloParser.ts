export interface DetectedBox {
    classId: number;
    className: string;
    score: number;
    x: number; // center x (normalized 0~1)
    y: number; // center y (normalized 0~1)
    w: number; // width (normalized 0~1)
    h: number; // height (normalized 0~1)
}

const COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
    "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
    "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
    "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
    "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
    "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

type Layout = "FxB" | "BxF";

export class YoloParser {
    static parse(
        data: number[],
        dims: number[] = [],
        confThreshold: number = 0.25,
        iouThreshold: number = 0.45,
        modelInputSize: number = 640 // ✅ 픽셀 좌표 자동 정규화에 사용
    ): DetectedBox[] {
        if (!data || data.length === 0) return [];

        const d = (Array.isArray(dims) ? dims : []).map((v) => Number(v)).filter((v) => Number.isFinite(v));

        // ✅ 1) 최우선: [1, N, 6] 또는 [N, 6] (후처리 완료된 detection list)
        // 일반적으로 row = [x1, y1, x2, y2, score, classId]
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
                const maxAbs = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));
                if (maxAbs > 1.5) {
                    x1 /= modelInputSize;
                    y1 /= modelInputSize;
                    x2 /= modelInputSize;
                    y2 /= modelInputSize;
                }

                // 정렬 보정 (혹시 x1>x2로 들어오면 swap)
                if (x2 < x1) [x1, x2] = [x2, x1];
                if (y2 < y1) [y1, y2] = [y2, y1];

                // clamp
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

        const hasObjectness = (numFeatures - 5) > 0; // 85인 경우 true일 가능성 높음
        const classStart = hasObjectness ? 5 : 4;
        const numClasses = Math.max(0, numFeatures - classStart);

        if (numClasses <= 0) return [];
        if (data.length !== numBoxes * numFeatures) {
            console.warn(`[YoloParser] Raw length mismatch. Expected ${numBoxes * numFeatures}, got ${data.length}`, inferred);
            return [];
        }

        const boxes: DetectedBox[] = [];

        for (let i = 0; i < numBoxes; i++) {
            const cx = this.read(data, layout, numBoxes, numFeatures, i, 0);
            const cy = this.read(data, layout, numBoxes, numFeatures, i, 1);
            const w = this.read(data, layout, numBoxes, numFeatures, i, 2);
            const h = this.read(data, layout, numBoxes, numFeatures, i, 3);

            if (!isFinite(cx) || !isFinite(cy) || !isFinite(w) || !isFinite(h)) continue;

            const obj = hasObjectness ? this.read(data, layout, numBoxes, numFeatures, i, 4) : 1.0;

            let bestScore = -Infinity;
            let bestClass = -1;

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
        // [1, F, B] or [1, B, F]
        if (dims.length >= 3 && dims[0] === 1) {
            const a = dims[1];
            const b = dims[2];
            if (a * b === dataLen) {
                const aLooksF = a >= 6 && a <= 300;
                const bLooksF = b >= 6 && b <= 300;
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
        return layout === "FxB"
            ? data[featureIndex * numBoxes + boxIndex]
            : data[boxIndex * numFeatures + featureIndex];
    }

    private static nms(boxes: DetectedBox[], iouThreshold: number): DetectedBox[] {
        if (boxes.length === 0) return [];

        boxes.sort((a, b) => b.score - a.score);

        const result: DetectedBox[] = [];
        const active = new Array(boxes.length).fill(true);

        for (let i = 0; i < boxes.length; i++) {
            if (!active[i]) continue;
            result.push(boxes[i]);

            for (let j = i + 1; j < boxes.length; j++) {
                if (!active[j]) continue;
                const iou = this.calculateIoU(boxes[i], boxes[j]);
                if (iou > iouThreshold) active[j] = false;
            }
        }
        return result;
    }

    private static calculateIoU(a: DetectedBox, b: DetectedBox): number {
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
        return {
            x1: box.x - box.w / 2,
            y1: box.y - box.h / 2,
            x2: box.x + box.w / 2,
            y2: box.y + box.h / 2
        };
    }
}

function clamp01(v: number) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}
