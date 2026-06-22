# WalkMate AI Model Development Report

## 1. 결론 요약

WalkMate의 AI 모델은 `yolo11n.pt`를 기반으로 한국 보행 환경에서 위험 요소를 감지하도록 파인튜닝한 YOLO11n 객체 탐지 모델이다. 최종 선택된 모델은 `model/exp_comparison/baseline/weights/best.pt`이며, 앱 배포용 변환 산출물은 현재 `model/exp_comparison/baseline/weights/best_float32.tflite` 기준으로 정리되어 있다.

확인된 최종 지표는 다음과 같다.

| 실험 | best epoch | precision | recall | mAP50 | mAP50-95 | train box loss | val box loss |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 20 | 0.7551 | 0.6053 | 0.6772 | 0.4768 | 1.1652 | 1.1662 |
| adamw_cos | 20 | 0.7408 | 0.6036 | 0.6654 | 0.4638 | 1.1904 | 1.1892 |
| heavy_aug | 20 | 0.7492 | 0.5920 | 0.6638 | 0.4621 | 1.1914 | 1.1934 |

baseline이 세 실험 중 `mAP50`, `mAP50-95`, box loss 모두 가장 좋았기 때문에 최종 모델로 선택된 흐름이 타당하다. 현재 앱 연동 상태는 최근 실기기 테스트와 코드 수정 내용을 반영해 다음처럼 정리된다.

- 현재 런타임 모델은 `UI/userUI/components/VisionCamera.tsx`의 `MODEL_FILE = "best_float32.tflite"` 설정에 따라 baseline float32 TFLite다.
- `model/exp_comparison/baseline/weights/best_float32.tflite`, `UI/userUI/public/wasm/best_float32.tflite`, `UI/userUI/ios/App/App/public/wasm/best_float32.tflite`는 SHA-256이 모두 동일하다.
- `UI/userUI/src/utils/YoloParser.ts`의 클래스 배열은 모델 학습 클래스와 같은 12개로 정리되어 있다.
- TFLite export 로그의 출력 shape `(1, 16, 8400)`은 `4 bbox + 12 class score` 구조로 처리한다.
- 앱의 탐지 confidence threshold는 현재 `0.30`이다.

즉, 모델 개발 산출물과 앱 탑재 상태는 baseline float32 TFLite를 기준으로 정리되어 있다.

---

## 2. 모델 개발 목표

프로젝트의 AI 모델 목표는 시각장애인 보행 보조 상황에서 카메라 프레임 안의 위험 요소를 실시간 감지하는 것이다. 단순 객체 탐지 모델이 아니라, 앱의 자동 신고 로직과 연결되어 다음 정보를 만들어내는 것이 목적이다.

- 보행 환경의 주요 객체 감지
- 객체별 위험도 분류를 위한 class id 제공
- 바운딩 박스 좌표를 통한 거리/방향 추정
- 위험 객체 발견 시 신고 이미지와 위치 정보를 백엔드로 전송

모델이 다루도록 설계된 클래스는 총 12개다.

| ID | class | 의미 | 출처/정책 |
|---:|---|---|---|
| 0 | person | 보행자 | COCO 원본 0번을 0번으로 리매핑 |
| 1 | bicycle | 자전거 | COCO 원본 1번을 1번으로 리매핑 |
| 2 | car | 승용차 | COCO 원본 2번을 2번으로 리매핑 |
| 3 | motorcycle | 오토바이 | COCO 원본 3번을 3번으로 리매핑 |
| 4 | bus | 버스 | COCO 원본 5번을 4번으로 리매핑 |
| 5 | truck | 트럭 | COCO 원본 7번을 5번으로 리매핑 |
| 6 | traffic light | 신호등 | COCO 원본 9번을 6번으로 리매핑 |
| 7 | stop sign | 정지 표지판 | COCO 원본 11번을 7번으로 리매핑 |
| 8 | bench | 벤치 | COCO 원본 13번을 8번으로 리매핑 |
| 9 | dog | 반려견 | COCO 원본 16번을 9번으로 리매핑 |
| 10 | bollard | 볼라드 | Roboflow bollard 데이터셋 0번을 10번으로 리매핑 |
| 11 | kickboard | 전동 킥보드 | Roboflow kickboard 데이터셋 1번을 11번으로 리매핑 |

---

## 3. 데이터셋 확보

`model/total.ipynb`는 세 종류의 데이터를 사용한다.

### 3.1 COCO 2017

노트북은 COCO 2017의 `train2017`, `val2017`, `test2017`, `annotations_trainval2017` 다운로드를 시도한다. COCO는 80개 클래스를 갖고 있지만 WalkMate는 이 중 보행 환경과 관련 있는 10개 클래스만 남긴다.

사용한 COCO 원본 클래스는 다음과 같다.

| COCO 원본 ID | 통합 ID | class |
|---:|---:|---|
| 0 | 0 | person |
| 1 | 1 | bicycle |
| 2 | 2 | car |
| 3 | 3 | motorcycle |
| 5 | 4 | bus |
| 7 | 5 | truck |
| 9 | 6 | traffic light |
| 11 | 7 | stop sign |
| 13 | 8 | bench |
| 16 | 9 | dog |

COCO 정제 정책은 두 가지다.

- 필터링 후 대상 클래스가 하나도 없는 이미지/라벨은 삭제한다.
- `person`만 단독으로 남는 이미지는 데이터 편향을 줄이기 위해 삭제한다.

노트북 실행 출력 기준 COCO 정제 결과는 다음과 같다.

| split | 정제/리매핑 완료 | 빈 라벨 삭제 | person 단독 삭제 |
|---|---:|---:|---:|
| train2017 | 29,419 | 42,493 | 45,354 |
| val2017 | 1,265 | 1,786 | 1,901 |
| test2017 | 0 | 0 | 0 |

### 3.2 Roboflow kickboard dataset

노트북은 Roboflow workspace `test-w9qag`, project `-1-pshya-r07yo`, version 1을 `datasets/kickboard-dataset`으로 다운로드한다.

전처리 정책은 다음과 같다.

- 기존 `person` 라벨 0번을 삭제한다. 이유는 원본 YOLO11n으로 person/차량 등 일반 객체를 다시 자동 라벨링하기 위해서다.
- 킥보드 라벨을 class 11로 바꾼다.
- 원본 YOLO11n으로 COCO 계열 0-9번 객체를 자동 라벨링해서 기존 킥보드 라벨에 append한다.

노트북 실행 출력 기준 정제 결과는 다음과 같다.

| 단계 | 결과 |
|---|---:|
| person 라벨 제거 파일 수 | 312개 |
| 제거된 person 객체 수 | 532개 |
| class 1 -> 11 리매핑 파일 수 | 2,503개 |
| class 11로 변환된 kickboard 객체 수 | 3,172개 |
| 자동 라벨링 train 처리 이미지 | 2,185장 |
| train에 추가된 일반 객체 수 | 1,855개 |
| 자동 라벨링 valid 처리 이미지 | 215장 |
| valid에 추가된 일반 객체 수 | 157개 |
| 자동 라벨링 test 처리 이미지 | 107장 |
| test에 추가된 일반 객체 수 | 114개 |

현재 repo의 label 파일 기준 객체 분포는 다음과 같다.

| class | 객체 수 |
|---|---:|
| person | 1,115 |
| bicycle | 72 |
| car | 601 |
| motorcycle | 244 |
| bus | 12 |
| truck | 44 |
| traffic light | 7 |
| stop sign | 3 |
| bench | 28 |
| kickboard | 3,172 |

주의: 현재 `model/datasets/kickboard-dataset/data.yaml`은 여전히 `nc: 1`, `names: ['kickboard']`로 되어 있다. 통합 학습에는 노트북에서 새로 만든 `datasets/coco_total/data.yaml`을 사용하므로 학습 자체에는 문제가 없었지만, 이 데이터셋을 단독으로 다시 학습하려면 `data.yaml`은 현재 라벨 분포와 맞지 않는다.

### 3.3 Roboflow bollard dataset

노트북은 Roboflow workspace `test-w9qag`, project `bollard-v2gn5-t7lrj-ycf6t`, version 1을 `datasets/bollard-dataset`으로 다운로드한다.

전처리 정책은 다음과 같다.

- `tubular-marker-normal` 라벨은 사용하지 않는 것으로 결정했다.
- bollard 원본 class 0을 통합 class 10으로 바꾼다.
- 원본 YOLO11n으로 COCO 계열 0-9번 객체를 자동 라벨링해서 기존 bollard 라벨에 append한다.

노트북 실행 출력 기준 정제 결과는 다음과 같다.

| 단계 | 결과 |
|---|---:|
| tubular-marker-normal 제거 파일 수 | 0개 |
| 제거된 객체 수 | 0개 |
| class 0 -> 10 리매핑 파일 수 | 1,640개 |
| class 10으로 변환된 bollard 객체 수 | 3,377개 |
| 자동 라벨링 train 처리 이미지 | 1,610장 |
| train에 추가된 일반 객체 수 | 3,633개 |
| 자동 라벨링 valid 처리 이미지 | 81장 |
| valid에 추가된 일반 객체 수 | 40개 |
| 자동 라벨링 test 처리 이미지 | 1장 |
| test에 추가된 일반 객체 수 | 2개 |

현재 repo의 label 파일 기준 객체 분포는 다음과 같다.

| class | 객체 수 |
|---|---:|
| person | 379 |
| bicycle | 10 |
| car | 2,973 |
| motorcycle | 27 |
| bus | 53 |
| truck | 73 |
| traffic light | 96 |
| stop sign | 7 |
| bench | 57 |
| bollard | 3,377 |

주의: 현재 `model/datasets/bollard-dataset/data.yaml`은 `nc: 11`, `names: {10: bollard}` 형태다. 이 파일도 통합 학습용 최종 yaml이 아니라, 병합 전 소스 데이터셋의 중간 메타데이터로 보는 것이 맞다.

### 3.4 직접 촬영 테스트셋

노트북은 iPhone 12 mini로 촬영한 집 앞 사진을 Roboflow/SAM3로 라벨링하고, 직접 검수한 `testphoto` 데이터를 현장 검증용으로 사용한다.

현재 repo 기준 구성은 다음과 같다.

| 경로 | 내용 |
|---|---:|
| `model/testphoto/images/` | 실제 촬영 이미지 7장 |
| `model/testphoto/labels/` | 수동 검수 라벨 7개 |
| `model/testphoto/comparison_results/` | 예측/정답 대조 이미지 7장 |
| `model/testphoto/data.yaml` | 12개 클래스 정의 |

현재 `testphoto` 라벨 객체 분포는 다음과 같다.

| class | 객체 수 |
|---|---:|
| car | 24 |
| traffic light | 1 |
| bollard | 3 |

노트북은 이 데이터를 정량 평가셋으로 쓰지는 않았고, baseline `best.pt` 결과를 정답 박스와 시각적으로 대조하는 용도로 사용했다. 따라서 `testphoto`에 대한 별도 mAP/precision/recall 수치는 없다.

---

## 4. 라벨 형식과 전처리 이슈

노트북의 라벨 전처리 목표는 12개 클래스를 통일하고, segmentation 형식 라벨을 detection bbox 형식으로 학습 가능하게 만드는 것이다.

학습 로그에는 다음 경고가 반복된다.

```text
Box and segment counts should be equal, but got len(segments) = 167084, len(boxes) = 176769.
To resolve this only boxes will be used and all segments will be removed.
```

즉, 통합 학습 데이터에는 bbox 라벨과 segment 라벨이 섞여 있었고, Ultralytics가 detect 학습을 위해 segment를 버리고 boxes만 사용했다. 결과적으로 학습은 진행됐지만, 데이터 품질 관점에서는 다음이 남는다.

- 일부 polygon 라벨이 bbox로 완전히 정규화되지 않은 흔적이 있다.
- Ultralytics가 fallback으로 boxes만 사용했기 때문에 학습은 가능했다.
- 재학습 품질을 올리려면 통합 전 모든 라벨을 YOLO detect bbox 5열 형식으로 명시 변환하는 것이 좋다.

---

## 5. 학습 전략 결정

노트북은 처음에 순차 학습을 고려했다.

1. COCO 정제 데이터 10개 클래스로 먼저 학습
2. kickboard/bollard 데이터셋을 추가로 학습

하지만 최종 전략은 순차 학습이 아니라 단일 통합 학습으로 결정했다. 이유는 다음과 같다.

### 5.1 순차 학습을 피한 이유

1. 망각과 과적합 위험  
   2단계에서 kickboard/bollard 중심의 상대적으로 작은 데이터만 계속 보게 되면, 1단계에서 배운 일반 도로 객체 특징을 잃을 수 있다.

2. 오토 라벨링 노이즈 집중 학습 위험  
   YOLO11n이 자동으로 붙인 person/car 등 일반 객체 라벨은 완벽하지 않다. 2단계에서 이 노이즈가 집중 학습되면 일반 객체 성능이 오히려 떨어질 수 있다.

3. `yolo11n.pt` 자체가 이미 COCO 기반 사전학습 모델  
   이미 COCO 특징을 가진 사전학습 모델이므로, WalkMate용 통합 데이터셋을 한 번에 파인튜닝하는 것이 더 안정적이라고 판단했다.

### 5.2 최종 선택: 단일 통합 학습

최종 데이터셋은 COCO 정제 데이터, bollard 데이터, kickboard 데이터를 모두 섞은 뒤 랜덤 분할한다.

노트북 실행 출력 기준 통합 데이터 수집 결과는 다음과 같다.

| 출처 | 수집 수 |
|---|---:|
| COCO train2017 | 29,419 |
| COCO val2017 | 1,265 |
| bollard train | 1,610 |
| bollard valid | 81 |
| bollard test | 1 |
| kickboard train | 2,185 |
| kickboard valid | 215 |
| kickboard test | 107 |
| 합계 | 34,883 |

랜덤 분할 결과는 다음과 같다.

| split | 비율 | 이미지-라벨 페어 |
|---|---:|---:|
| train | 80% | 27,906 |
| val | 10% | 3,488 |
| test | 10% | 3,489 |

노트북은 `sklearn.model_selection.train_test_split`을 사용했고, `random_state=42`로 재현성을 확보했다. 파일명 충돌을 피하기 위해 `coco_`, `bollard_`, `kickboard_` 접두사를 붙여 복사했다.

주의: 현재 repo에는 `model/datasets/coco_total/` 통합 데이터셋 폴더가 없다. 따라서 현재 checkout만으로는 전체 학습을 즉시 재현할 수 없고, 원본 다운로드 및 통합 생성 셀을 다시 실행해야 한다.

---

## 6. 학습 환경과 모델 구조

노트북 학습 로그 기준 환경은 다음과 같다.

| 항목 | 값 |
|---|---|
| 모델 | YOLO11n |
| 시작 가중치 | `yolo11n.pt` |
| task | detect |
| 입력 크기 | 640 |
| batch | 16 |
| epoch | 20 |
| device | `mps` |
| 하드웨어 | Apple M4, Mac Mini 16GB로 설계 |
| Ultralytics | 8.4.70 학습 로그 |
| torch | 2.12.0 MPS 학습 로그 |
| pretrained transfer | 448/499 items |
| 클래스 수 | 12 |

### Colab 작업 캡처

모델 학습 데이터 준비와 TFLite 변환 과정에서는 로컬 환경만 사용하지 않고 Google Colab도 함께 활용했다. 아래 캡처는 Colab에서 Google Drive를 mount하고 통합 데이터셋 압축 파일을 풀며 학습/변환 작업을 이어가던 화면이다. 로컬 macOS 환경에서는 TensorFlow/TFLite 변환 호환성 문제가 있었기 때문에, 최종 앱 탑재용 `best_float32.tflite` 생성은 Colab 환경에서 처리한 흐름으로 보는 것이 맞다.

![Google Colab에서 모델 학습 데이터 준비와 변환 작업을 진행한 화면](capture/capture_colab.png)

모델 구조 로그의 핵심은 다음과 같다.

| 항목 | 값 |
|---|---:|
| YOLO11n layers | 182 |
| parameters | 2,592,180 |
| gradients | 2,592,164 |
| GFLOPs | 6.5 |
| Detect head class count | 12 |

학습 후 fused 모델 로그는 다음과 같다.

| 항목 | 값 |
|---|---:|
| fused layers | 101 |
| parameters | 2,584,492 |
| GFLOPs | 6.3 |

---

## 7. 하이퍼파라미터 비교 실험

노트북은 M4 Mac Mini 16GB 환경에서 실행 가능한 범위로 3개 실험을 설계했다.

실제 저장된 `args.yaml` 기준 하이퍼파라미터는 다음과 같다. 노트북의 설계 설명에는 batch/cache를 더 공격적으로 잡은 부분이 있지만, 실제 결과 파일 기준으로는 batch 16, cache False가 적용됐다.

| 실험 | optimizer | lr0 | cos_lr | mixup | hsv_v | patience | batch | epochs | cache | workers |
|---|---|---:|---|---:|---:|---:|---:|---:|---|---:|
| baseline | auto | 0.01 | False | 0.00 | 0.4 | 0 | 16 | 20 | False | 4 |
| adamw_cos | AdamW | 0.001 | True | 0.00 | 0.4 | 0 | 16 | 20 | False | 4 |
| heavy_aug | AdamW | 0.001 | True | 0.15 | 0.4 | 0 | 16 | 20 | False | 4 |

### 7.1 baseline

baseline은 YOLO 기본 방향에 가까운 설정이다.

- `optimizer=auto`
- `cos_lr=False`
- `mixup=0`
- `lr0=0.01`로 기록되어 있으나, Ultralytics 로그상 `optimizer=auto`가 실제로는 AdamW(lr=0.000625, momentum=0.9)를 자동 선택했다.

20 epoch 결과:

| 지표 | epoch 1 | epoch 20 |
|---|---:|---:|
| train/box_loss | 1.3636 | 1.1652 |
| train/cls_loss | 2.1149 | 0.9815 |
| train/dfl_loss | 1.2514 | 1.1359 |
| precision | 0.6318 | 0.7551 |
| recall | 0.4852 | 0.6053 |
| mAP50 | 0.5289 | 0.6772 |
| mAP50-95 | 0.3374 | 0.4768 |
| val/box_loss | 1.3416 | 1.1662 |
| val/cls_loss | 1.6076 | 0.9970 |
| val/dfl_loss | 1.2367 | 1.1226 |

train box loss와 val box loss가 거의 같은 수준으로 끝나므로, 20 epoch 구간에서는 심한 과적합 징후가 크지 않다.

### 7.2 adamw_cos

adamw_cos는 fine-tuning 안정성을 위해 직접 `AdamW`, 낮은 `lr0=0.001`, `cos_lr=True`를 적용한 실험이다.

20 epoch 결과:

| 지표 | epoch 1 | epoch 20 |
|---|---:|---:|
| train/box_loss | 1.4968 | 1.1904 |
| train/cls_loss | 1.9083 | 1.0224 |
| train/dfl_loss | 1.3565 | 1.1572 |
| precision | 0.4628 | 0.7408 |
| recall | 0.2905 | 0.6036 |
| mAP50 | 0.2867 | 0.6654 |
| mAP50-95 | 0.1673 | 0.4638 |
| val/box_loss | 1.6521 | 1.1892 |
| val/cls_loss | 2.1968 | 1.0282 |
| val/dfl_loss | 1.4593 | 1.1432 |

초반 성능은 baseline보다 낮았지만 후반에 많이 회복했다. 다만 최종 mAP50-95는 baseline보다 낮다.

### 7.3 heavy_aug

heavy_aug는 소수 클래스와 야외 환경 대응을 위해 `mixup=0.15`를 추가한 실험이다.

20 epoch 결과:

| 지표 | epoch 1 | epoch 20 |
|---|---:|---:|
| train/box_loss | 1.5876 | 1.1914 |
| train/cls_loss | 2.0475 | 1.0259 |
| train/dfl_loss | 1.4257 | 1.1602 |
| precision | 0.5483 | 0.7492 |
| recall | 0.2762 | 0.5920 |
| mAP50 | 0.2955 | 0.6638 |
| mAP50-95 | 0.1716 | 0.4621 |
| val/box_loss | 1.6325 | 1.1934 |
| val/cls_loss | 2.1356 | 1.0374 |
| val/dfl_loss | 1.4749 | 1.1473 |

heavy augmentation은 일반화 목적은 타당하지만, 20 epoch 실험에서는 baseline을 넘지 못했다. 소수 클래스인 bollard/kickboard에는 도움이 될 여지가 있지만 전체 mAP 기준 최종 모델로 선택되지는 않았다.

---

## 8. 실험 결과 해석

세 실험 모두 best epoch가 20으로 기록되어 있다. 이는 20 epoch 시점까지 성능이 계속 상승했음을 의미한다. 따라서 시간이 더 있었다면 추가 epoch 학습으로 성능이 더 좋아졌을 가능성이 있다.

baseline 선택 근거는 다음과 같다.

1. 전체 mAP50이 가장 높다.
2. 전체 mAP50-95가 가장 높다.
3. train/val box loss가 가장 낮다.
4. train/val box loss 차이가 작아 과적합 신호가 크지 않다.
5. 실험 목적이 앱 탑재용 실시간 모델이므로, 복잡한 튜닝보다 안정적인 baseline이 합리적이다.

단, 평가지표 해석에는 제약이 있다.

- Val/Test가 통합 데이터셋에서 랜덤 분할됐다.
- COCO 이미지에는 bollard/kickboard 라벨이 원래 없다.
- 따라서 모델이 COCO 이미지 안의 실제 bollard/kickboard를 감지하더라도 정답 라벨이 없으면 false positive로 계산될 수 있다.
- 이 구조 때문에 전체 mAP는 실제 현장 성능보다 낮게 측정될 수 있다.
- 반대로 Roboflow 데이터의 자동 라벨링 오차가 일부 포함되어 있으면 일부 지표는 왜곡될 수 있다.

---

## 9. 클래스별 성능 로그

노트북의 heavy_aug 검증 로그에는 클래스별 성능이 남아 있다. baseline의 클래스별 표는 현재 노트북 출력에서 온전한 형태로 분리되어 있지 않지만, heavy_aug의 클래스별 경향은 다음과 같다.

| class | precision | recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|
| person | 0.781 | 0.565 | 0.676 | 0.426 |
| bicycle | 0.739 | 0.409 | 0.493 | 0.283 |
| car | 0.710 | 0.532 | 0.616 | 0.400 |
| motorcycle | 0.765 | 0.588 | 0.682 | 0.437 |
| bus | 0.821 | 0.724 | 0.806 | 0.661 |
| truck | 0.624 | 0.407 | 0.507 | 0.353 |
| traffic light | 0.714 | 0.434 | 0.492 | 0.272 |
| stop sign | 0.727 | 0.686 | 0.740 | 0.628 |
| bench | 0.635 | 0.266 | 0.338 | 0.214 |
| dog | 0.732 | 0.716 | 0.747 | 0.542 |
| bollard | 0.820 | 0.873 | 0.911 | 0.605 |
| kickboard | 0.912 | 0.909 | 0.957 | 0.722 |

이 표만 보면 bollard/kickboard는 강하게 나온다. 그러나 이 값은 heavy_aug 기준이며, 최종 선택된 baseline의 클래스별 최종 표는 현재 repo 산출물만으로 별도 추출하지 않았다. 또한 소수 클래스 검증셋이 충분히 대표적인지 별도 확인이 필요하다.

---

## 10. 현장 이미지 검증

노트북은 baseline `best.pt`를 사용해 두 종류의 시각 검증을 수행했다.

### 10.1 단일 이미지 검증

`datasets/bollard-dataset/train/images/...jpg` 예시 이미지를 대상으로 `conf=0.50`, `iou=0.45` 조건에서 예측 이미지를 `temp_detection_result.jpg`로 저장했다.

노트북 출력:

```text
모델 로드 완료: exp_comparison/baseline/weights/best.pt
객체 탐지 성공! (결과 저장 완료: temp_detection_result.jpg)
```

### 10.2 직접 촬영 testphoto 검증

`model/testphoto/images`의 7장을 대상으로 정답 라벨과 예측 박스를 한 이미지에 그렸다.

- 초록색: ground truth
- 빨간색: prediction
- 결과 저장 위치: `model/testphoto/comparison_results`

노트북 출력 기준 7장 전체 결과가 생성됐다. 다만 이 단계는 정량 평가가 아니라 시각적 sanity check다.

---

## 11. 모델 산출물

현재 repo에 남아 있는 baseline 산출물은 다음과 같다.

| 파일 | 용도 | 크기 |
|---|---|---:|
| `model/exp_comparison/baseline/weights/best.pt` | 최종 선택 PyTorch 가중치 | 5.2 MB |
| `model/exp_comparison/baseline/weights/last.pt` | 마지막 epoch 가중치 | 5.2 MB |
| `model/exp_comparison/baseline/weights/best_float32.tflite` | 현재 앱 런타임에서 선택하는 TFLite float32 변환본 | 10 MB |

baseline 폴더에는 다음 분석 이미지도 남아 있다.

- `results.png`
- `labels.jpg`
- `confusion_matrix.png`
- `confusion_matrix_normalized.png`
- `BoxF1_curve.png`
- `BoxP_curve.png`
- `BoxR_curve.png`
- `BoxPR_curve.png`
- train/val batch 시각화 이미지

전체 산출물 용량:

| 경로 | 용량 |
|---|---:|
| `model/exp_comparison/baseline` | 45 MB |
| `model/exp_comparison/adamw_cos` | 19 MB |
| `model/exp_comparison/heavy_aug` | 19 MB |
| `model/testphoto` | 61 MB |
| `UI/userUI/public/wasm` | 30 MB |

---

## 12. TFLite 변환 과정

노트북은 baseline `best.pt`를 앱에서 쓰기 위해 TFLite로 변환하려 했다. 현재 앱 런타임은 float32 TFLite 파일을 사용한다.

### 12.1 로컬 변환 시도

변환 의도는 다음 구조다.

```python
model = YOLO(model_path)
model.export(format="tflite", imgsz=640)
```

하지만 노트북 cell 45는 다음 이유로 실패했다.

```text
모델 파일을 찾을 수 없습니다: model/exp_comparison/baseline/weights/best.pt
```

이는 노트북 실행 위치가 `model/` 디렉토리였을 가능성이 높기 때문이다. 해당 cwd라면 올바른 상대 경로는 `exp_comparison/baseline/weights/best.pt`다.

이후 cell 46은 올바른 상대 경로로 모델을 찾았지만 macOS + Python 3.13 이상 환경에서 TensorFlow/TFLite export가 막혔다.

```text
TensorFlow exports not supported on macOS with Python>=3.13:
the ai-edge-litert macOS wheel fails to load
```

### 12.2 Colab 변환 결과

결국 Colab에서 `best.pt`를 업로드하고 변환했다. Colab 로그 기준:

- Python 3.12.13
- Ultralytics 8.4.75
- torch 2.11.0+cpu
- ONNX export 성공
- TensorFlow SavedModel export 성공
- TFLite export 성공
- 최종 `best_saved_model/best_float32.tflite` 생성

권장 변환 방식은 Colab 또는 Linux 환경에서 경로를 명확히 지정하는 것이다.

```python
from ultralytics import YOLO

model = YOLO("exp_comparison/baseline/weights/best.pt")
model.export(
    format="tflite",
    imgsz=640
)
```

현재 앱은 이 float32 TFLite 산출물을 `UI/userUI/public/wasm/best_float32.tflite`로 복사해 사용한다.

---

## 13. 앱 연동 상태

### 13.1 현재 앱이 실제로 로드하는 파일

현재 `UI/userUI/components/VisionCamera.tsx`에는 다음 상수가 있다.

```ts
const MODEL_FILE = "best_float32.tflite";
```

따라서 현재 코드 기준 런타임은 `UI/userUI/public/wasm/best_float32.tflite`를 로드한다.

### 13.2 모델 파일 복사 상태

현재 float32 파일은 모델 산출물, 웹 public 폴더, iOS bundle 폴더에서 모두 같은 파일이다.

SHA-256:

| 파일 | SHA-256 |
|---|---|
| `model/exp_comparison/baseline/weights/best_float32.tflite` | `d47fdc028108fb2af2f42de5a20239a35e50bac2480bcd5e211ca55bb7c797ac` |
| `UI/userUI/public/wasm/best_float32.tflite` | `d47fdc028108fb2af2f42de5a20239a35e50bac2480bcd5e211ca55bb7c797ac` |
| `UI/userUI/ios/App/App/public/wasm/best_float32.tflite` | `d47fdc028108fb2af2f42de5a20239a35e50bac2480bcd5e211ca55bb7c797ac` |

따라서 현재 앱 번들 관점에서는 float32 파일이 모델 산출물과 앱 public 경로에 동일하게 복사되어 있다.

### 13.3 모델 입력 전처리

현재 앱 전처리는 다음 흐름이다.

1. `react-webcam`에서 JPEG 스크린샷을 얻는다.
2. 640 x 640 canvas를 만든다.
3. 원본 프레임을 비율 유지 방식으로 640 x 640 안에 letterbox 형태로 그린다.
4. `tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0)`로 `[1, 640, 640, 3]` float 입력을 만든다.
5. `@tensorflow/tfjs-tflite`의 `loadTFLiteModel`로 모델을 로드하고 `predict`한다.
6. 출력 tensor를 flat array로 바꿔 `YoloParser.parse()`에 넘긴다.

이 전처리 방향은 TFLite export 로그의 input shape과 맞다.

```text
inputs_0: TensorSpec(shape=(1, 640, 640, 3), dtype=tf.float32, name='images')
```

### 13.4 출력 후처리 상태

TFLite export 로그의 output shape은 다음과 같다.

```text
Output Type: TensorSpec(shape=(1, 16, 8400), dtype=tf.float32)
```

12-class YOLO detect 모델에서 `16`은 `4 bbox + 12 class score` 구조로 처리된다.

클래스 배열도 모델과 같은 12개로 정리되어 있다.

현재 앱:

```ts
const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "bus", "truck", "traffic light",
  "stop sign", "bench", "dog", "bollard", "kickboard"
];
```

모델의 실제 12 클래스:

```text
0 person
1 bicycle
2 car
3 motorcycle
4 bus
5 truck
6 traffic light
7 stop sign
8 bench
9 dog
10 bollard
11 kickboard
```

따라서 class 11은 앱에서도 `kickboard`로 해석된다.

### 13.5 앱 탐지 임계값

현재 `VisionCamera.tsx`는 `YoloParser.parse()` 호출 시 confidence threshold를 `0.30`, NMS IoU threshold를 `0.50`으로 사용한다.

```ts
const boxes = YoloParser.parse(flat, shape, 0.3, 0.5);
```

현재 30% 기준은 낮은 신뢰도 박스가 신고/음성 안내로 이어지는 오탐을 줄이기 위한 조정이다.

---

## 14. 위험도 및 신고 로직과 모델의 연결

`VisionCamera.tsx`는 모델 예측 결과를 이용해 다음을 계산한다.

- `primaryBox`: 화면 중앙 하단에 가까운 주요 위험 객체
- `calculatedDistance`: bounding box 크기 기반의 단순 거리 추정
- `calculatedDirection`: x 위치 기반 `L`, `C`, `R`
- `primaryHazardType`: 신고할 위험 유형
- `risk_level`: 클래스별 위험도

현재 위험도 설정:

| class | risk level |
|---|---:|
| car, bus, truck, motorcycle, bicycle, kickboard | 3 |
| person, dog | 2 |
| traffic light, bollard, stop sign, bench | 1 |

따라서 클래스 id 매핑이 틀리면 위험도도 틀어진다. 현재 `kickboard`는 위험도 3으로 처리된다.

---

## 15. 재현성 상태

현재 repo만으로 완전 재현 가능한 부분과 불가능한 부분은 구분해야 한다.

### 15.1 현재 repo에 남아 있는 것

- `model/total.ipynb`
- `model/exp_comparison/*/results.csv`
- `model/exp_comparison/*/args.yaml`
- `model/exp_comparison/*/weights/*.pt`
- baseline TFLite/ONNX 변환 산출물
- `model/testphoto` 실제 테스트 이미지/라벨/결과
- 일부 dataset label 파일과 metadata

### 15.2 현재 repo에 부족한 것

현재 파일시스템 기준 `model/datasets/*/images`에는 학습 원본 이미지가 남아 있지 않다. 또한 `model/datasets/coco_total/` 통합 학습 데이터셋도 없다.

따라서 현재 checkout만으로는 `model.train(data="datasets/coco_total/data.yaml")`를 바로 재실행할 수 없다. 재현하려면 다음이 필요하다.

1. COCO 2017 재다운로드
2. Roboflow kickboard/bollard 데이터셋 재다운로드
3. 라벨 정제 셀 재실행
4. 통합 데이터셋 생성 셀 재실행
5. 학습 셀 재실행

### 15.3 보안상 주의

노트북에는 Roboflow API key가 평문으로 들어 있다. 이 키가 실제 유효한 키라면 폐기/재발급하고, 노트북에서는 환경 변수로 읽도록 바꾸는 것이 맞다.

---

## 16. 현재 모델 개발 과정의 강점

1. 문제 도메인에 맞는 클래스 재설계가 되어 있다.  
   COCO 전체 80개 클래스를 쓰지 않고 보행 위험과 관련 있는 10개 클래스에 bollard/kickboard를 추가했다.

2. 소수 클래스 보강을 시도했다.  
   bollard/kickboard 데이터셋에 일반 도로 객체를 자동 라벨링해 배경 객체와 함께 학습되도록 했다.

3. 순차 학습의 위험을 인식하고 통합 학습을 선택했다.  
   catastrophic forgetting과 오토라벨 노이즈 집중 문제를 피하려는 판단이 타당하다.

4. 실험 비교가 남아 있다.  
   `baseline`, `adamw_cos`, `heavy_aug`의 결과 CSV와 args가 남아 있어 모델 선택 근거를 추적할 수 있다.

5. 앱 탑재용 TFLite 산출물이 있다.  
   현재 앱은 baseline float32 파일을 로드하도록 정리되어 있다.

---

## 17. 현재 모델 개발 과정의 한계

1. 통합 학습 데이터셋이 repo에 없다.  
   `datasets/coco_total`이 없어 현재 checkout만으로 학습을 재현할 수 없다.

2. 원천 데이터셋 이미지가 repo에 없다.  
   label은 일부 남아 있으나 image가 없어 현 checkout만으로 데이터 감사가 제한된다.

3. source dataset yaml과 label id가 맞지 않는다.  
   kickboard/bollard 데이터셋 자체의 yaml은 중간 처리 상태와 맞지 않아 단독 학습에 위험하다.

4. 평가셋 라벨 누락 가능성이 문서상 인정되어 있다.  
   COCO 이미지에 bollard/kickboard 라벨이 없기 때문에 평가가 왜곡될 수 있다.

5. 현장 테스트는 시각 검증 중심이다.  
   `testphoto` 7장에 대한 정량 precision/recall/mAP 계산은 없다.

---

## 18. 권장 개선 작업

### 18.1 실기기 프레임 기준 비교 평가

현재 정확도 이슈를 더 명확히 보려면 iPhone 앱에서 실제 캡처한 프레임을 저장해 같은 이미지에 대해 다음을 비교해야 한다.

- `best.pt` PyTorch 추론 결과
- `best_float32.tflite` 앱 추론 결과
- 동일 confidence threshold에서의 class, score, bbox 좌표
- 앱 전처리 canvas 이미지와 원본 카메라 프레임 차이

이 비교를 해야 정확도 저하 원인이 모델 자체인지, TFLite 변환인지, 앱 전처리/후처리인지 분리할 수 있다.

### 18.2 `testphoto` 정량 평가 추가

`testphoto` 7장에 대해 다음을 계산하는 별도 셀을 추가하면 포트폴리오/보고서 설득력이 좋아진다.

- 이미지별 탐지 성공/실패
- class별 TP/FP/FN
- precision/recall
- IoU threshold별 매칭 결과
- bollard/kickboard 중심의 사례 분석

### 18.3 데이터셋 재현성 정리

현재 노트북은 다운로드, 전처리, 학습, 변환이 한 파일 안에 섞여 있다. 재현성을 위해 다음 파일 분리를 권장한다.

```text
model/
├── scripts/
│   ├── 01_download_datasets.py
│   ├── 02_clean_and_remap_labels.py
│   ├── 03_auto_label.py
│   ├── 04_build_coco_total.py
│   ├── 05_train_experiments.py
│   └── 06_export_tflite.py
└── configs/
    ├── classes.yaml
    ├── train_baseline.yaml
    ├── train_adamw_cos.yaml
    └── train_heavy_aug.yaml
```

---

## 19. 개발 회고: 데이터와 현실 사이의 간극

이번 모델 개발에서 가장 크게 느낀 점은 객체 탐지 모델의 성능이 단순히 학습 코드나 epoch 수만으로 결정되지 않는다는 점이다. 실제 객체 탐지를 위해서는 먼저 탐지할 대상을 정의하고, 그 대상에 맞는 학습 데이터를 모아야 한다. 그런데 이 과정이 예상보다 훨씬 어려웠다. 길거리에는 라벨 이름을 붙이기 애매한 대상이 많다. 쓰레기 더미, 나무 기둥, 전봇대 기둥, 공사 잔해, 시설물의 일부처럼 사람에게는 위험해 보이지만 하나의 class로 고정하기 어려운 장면들이 계속 등장한다. 결국 현실의 보행 위험은 깔끔한 객체 목록으로만 설명되지 않는다는 것을 체감했다.

초기 객체 탐지 대상은 보도블록 위의 시각장애인용 점자블록이었다. 그러나 실제 보행 환경을 살펴보면 모든 길에 점자블록이 설치되어 있지 않고, 설치되어 있더라도 상태와 형태가 일정하지 않았다. 처음에는 파손된 점자블록을 탐지해 신고하는 시스템을 구상했지만, 곧 역설적인 문제를 마주했다. 점자블록이 너무 심하게 부서져 있으면 그것을 신고해야 할 정도로 위험한 상태임에도, 모델 입장에서는 더 이상 점자블록으로 인식하기 어려워진다. 즉, 가장 신고가 필요한 순간에 오히려 탐지 자체가 어려워질 수 있었다.

이 경험은 고정된 class id를 맞히는 객체 탐지만으로는 실제 보행 위험을 충분히 설명하기 어렵다는 결론으로 이어졌다. WalkMate가 다루려는 문제는 "이 물체가 무엇인가"뿐 아니라 "이 장면이 보행자에게 왜 위험한가"를 함께 판단해야 하는 문제에 가깝다. 쓰레기 더미나 부서진 보도, 애매한 기둥, 임시 적치물처럼 이름 붙이기 어려운 위험 요소까지 다루려면, 사전에 정한 12개 class만으로는 한계가 있다. 이 지점에서 VLM처럼 장면을 더 넓게 이해하고 언어적으로 설명할 수 있는 모델의 필요성을 느꼈다.

학습 환경 측면에서도 GPU의 필요성이 컸다. 제한된 로컬 환경에서는 실험을 반복하는 속도가 느리고, 데이터셋 구성이나 augmentation을 바꿔가며 충분히 검증하기가 어렵다. 특히 실제 사용 상황을 생각하면 휴대폰은 하네스에 장착되어 움직이는 상태로 촬영될 가능성이 높다. 이 경우 입력 영상은 흔들리고, 피사체는 흐려지고, 프레임 일부가 잘릴 수 있다. 개발 후반에야 이런 조건을 더 적극적으로 반영했어야 한다는 생각이 들었다. motion blur, camera shake, low-light, crop 같은 augmentation을 학습 단계에서 더 체계적으로 넣었다면 실기기 탐지 성능을 더 현실적으로 끌어올릴 수 있었을 것이다.

결국 이번 AI 모델 개발은 객체 탐지 모델을 만드는 과정인 동시에, 현실의 문제를 데이터셋으로 번역하는 일이 얼마나 어려운지 확인한 과정이었다. 모델은 주어진 라벨 체계 안에서만 학습하지만, 실제 보행 환경은 그보다 훨씬 복잡하고 불규칙하다. 따라서 이후 개선 방향은 단순히 모델을 더 크게 만들거나 threshold를 조정하는 데서 끝나지 않는다. 실제 사용자 시점의 프레임을 더 많이 모으고, 흔들림과 조명 변화가 반영된 데이터를 만들고, 정형화하기 어려운 위험 요소를 설명할 수 있는 VLM 기반 접근까지 함께 검토하는 것이 필요하다.

---

## 20. 최종 평가

현재 WalkMate AI 모델 개발 과정은 제한된 시간과 로컬 M4 Mac Mini 환경 안에서 꽤 일관된 방향으로 진행됐다. 핵심 의사결정은 다음 흐름으로 정리할 수 있다.

1. COCO에서 보행 위험과 관련된 10개 클래스를 선별했다.
2. Roboflow에서 bollard/kickboard 데이터를 확보했다.
3. bollard와 kickboard를 각각 class 10, class 11로 통합했다.
4. 소스 데이터셋에 일반 도로 객체를 자동 라벨링해 배경/위험 객체의 공존 상황을 만들었다.
5. 순차 학습 대신 34,883장 통합 데이터셋 단일 파인튜닝을 선택했다.
6. 3개 실험을 비교했고 baseline이 최종 지표상 가장 좋았다.
7. baseline `best.pt`를 현장 이미지로 시각 검증했다.
8. 앱 탑재를 위해 TFLite float32 변환 산출물을 만들었다.

모델 선택 자체는 `baseline`으로 설명 가능하다. 앱 연동 측면에서도 최근 코드 수정으로 다음 항목은 정리됐다.

1. 앱은 현재 `best_float32.tflite`를 명시적으로 로드한다.
2. `YoloParser`는 YOLO11 TFLite `(1, 16, 8400)` 출력을 `4 bbox + 12 class score`로 해석한다.
3. 클래스 배열은 학습 class id와 같은 12개로 맞춰졌다.
4. confidence threshold는 30%로 올라가 낮은 신뢰도 오탐을 줄이는 방향으로 조정됐다.

남은 핵심 과제는 실제 iPhone 프레임 기준 정량 비교다. 동일한 이미지에 대해 PyTorch `best.pt`와 TFLite float32 결과를 비교하면 정확도 저하 원인을 모델 성능, 변환 품질, 앱 전처리/후처리 중 어디로 봐야 하는지 더 명확히 판단할 수 있다.
