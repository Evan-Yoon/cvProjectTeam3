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

export class YoloParser {
    static parse(
        data: number[],
        dims: number[],
        confThreshold: number = 0.25,
        iouThreshold: number = 0.45
    ): DetectedBox[] {
        if (!data || data.length === 0) return [];

        const numBoxes = 8400;
        const numFeatures = 84;

        // Check layout
        // Standard: [1, 8400, 84] -> dims[1] == 8400
        // Transposed: [1, 84, 8400] -> dims[1] == 84 (dims[2] == 8400)
        let isTransposed = false;
        if (dims && dims.length >= 3) {
            // YOLO usually exports as [1, 84, 8400] (Features x Boxes)
            // But some runtimes/exporters might give [1, 8400, 84]
            if (dims[1] === 84 && dims[2] === 8400) {
                isTransposed = true;
            }
        }

        // double check if data length matches
        if (data.length !== numBoxes * numFeatures) {
            console.warn(`Data length mismatch. Expected ${numBoxes * numFeatures}, got ${data.length}`);
            return [];
        }

        const boxes: DetectedBox[] = [];

        // Loop through all 8400 anchors
        for (let i = 0; i < numBoxes; i++) {
            let cx, cy, w, h;

            if (isTransposed) {
                // Layout: [Feature, Box] -> Index = Feature * 8400 + Box
                // 0: cx, 1: cy, 2: w, 3: h
                cx = data[0 * numBoxes + i];
                cy = data[1 * numBoxes + i];
                w = data[2 * numBoxes + i];
                h = data[3 * numBoxes + i];
            } else {
                // Layout: [Box, Feature] -> Index = Box * 84 + Feature
                const offset = i * numFeatures;
                cx = data[offset + 0];
                cy = data[offset + 1];
                w = data[offset + 2];
                h = data[offset + 3];
            }

            // Find best class
            let maxScore = -Infinity;
            let classId = -1;

            for (let c = 0; c < 80; c++) {
                let score;
                if (isTransposed) {
                    // Class probabilities start at index 4
                    score = data[(4 + c) * numBoxes + i];
                } else {
                    const offset = i * numFeatures;
                    score = data[offset + 4 + c];
                }

                if (score > maxScore) {
                    maxScore = score;
                    classId = c;
                }
            }

            if (maxScore > confThreshold) {
                boxes.push({
                    classId,
                    className: COCO_CLASSES[classId] || "unknown",
                    score: maxScore,
                    x: cx,
                    y: cy,
                    w: w,
                    h: h
                });
            }
        }

        return this.nms(boxes, iouThreshold);
    }

    private static nms(boxes: DetectedBox[], iouThreshold: number): DetectedBox[] {
        if (boxes.length === 0) return [];

        // Sort by score descending
        boxes.sort((a, b) => b.score - a.score);

        const result: DetectedBox[] = [];
        const active = new Array(boxes.length).fill(true);

        for (let i = 0; i < boxes.length; i++) {
            if (!active[i]) continue;
            result.push(boxes[i]);

            for (let j = i + 1; j < boxes.length; j++) {
                if (!active[j]) continue;

                const iou = this.calculateIoU(boxes[i], boxes[j]);
                if (iou > iouThreshold) {
                    active[j] = false;
                }
            }
        }

        return result;
    }

    private static calculateIoU(a: DetectedBox, b: DetectedBox): number {
        // Convert center-wh to top-left-bottom-right
        const boxA = this.getCoords(a);
        const boxB = this.getCoords(b);

        const x1 = Math.max(boxA.x1, boxB.x1);
        const y1 = Math.max(boxA.y1, boxB.y1);
        const x2 = Math.min(boxA.x2, boxB.x2);
        const y2 = Math.min(boxA.y2, boxB.y2);

        const intersectionW = Math.max(0, x2 - x1);
        const intersectionH = Math.max(0, y2 - y1);
        const intersectionArea = intersectionW * intersectionH;

        const areaA = (boxA.x2 - boxA.x1) * (boxA.y2 - boxA.y1);
        const areaB = (boxB.x2 - boxB.x1) * (boxB.y2 - boxB.y1);

        const unionArea = areaA + areaB - intersectionArea;

        return unionArea === 0 ? 0 : intersectionArea / unionArea;
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
