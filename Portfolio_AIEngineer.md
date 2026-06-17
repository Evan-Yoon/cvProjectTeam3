# Portfolio AI Engineer

## 1. 프로젝트 개요

WalkMate의 AI 파트는 보행 중 카메라 프레임에서 위험 객체를 감지하고, 감지 결과를 사용자 경고와 관리자 신고 데이터로 연결하는 컴퓨터 비전 파이프라인입니다. 현재 레포에서는 TFLite 모델 asset, Capacitor Java plugin, TypeScript YOLO 후처리 코드가 확인됩니다. 근거: `UI/userUI/components/VisionCamera.tsx`, `UI/userUI/NpuTfliteBridge.ts`, `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`, `UI/userUI/src/utils/YoloParser.ts`

확정 가능한 기술 스택은 Python, TensorFlow Lite, Capacitor Native Plugin, TypeScript 후처리입니다. 근거: `UI/userUI/android/app/build.gradle`, `UI/userUI/package.json`

## 2. 문제 정의

서비스 관점의 문제는 보행 중 카메라에서 위험 객체를 감지하고, 사용자가 바로 들을 수 있는 음성 경고와 관리자가 확인할 수 있는 신고 데이터로 연결하는 것입니다. 근거: `UI/userUI/components/VisionCamera.tsx`, `UI/userUI/src/api/report.ts`, `UI/adminUI/App.tsx`

AI 모듈은 다음 작업을 담당했습니다.

- 카메라 frame을 모델 입력 크기인 640x640으로 전처리했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`
- TFLite 모델을 native plugin에서 로드하고 추론했습니다. 근거: `UI/userUI/NpuTfliteBridge.ts`, `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`
- 모델 output을 bounding box, class, score로 파싱했습니다. 근거: `UI/userUI/src/utils/YoloParser.ts`
- 위험도와 거리/방향을 계산해 TTS 경고와 신고 업로드에 사용했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`

## 3. 데이터 구성 및 클래스 체계

사용자 앱에서 실시간 추론 결과 파싱 및 라벨 매핑에 사용하는 class 목록은 다음과 같습니다.
`YoloParser`는 `person`, `bicycle`, `car`, `motorcycle`, `bus`, `truck`, `traffic light`, `stop sign`, `bench`, `dog`, `bollard`, `banner`, `kickboard` 클래스를 처리하도록 구성되어 있습니다. 근거: `UI/userUI/src/utils/YoloParser.ts`

## 4. 전처리

사용자 앱은 webcam screenshot을 가져온 뒤 640x640 canvas를 만들고, 원본 비율을 유지해 검은 배경 위에 이미지를 그렸습니다. 이후 JPEG base64로 변환해 native plugin에 넘겼습니다. 근거: `UI/userUI/components/VisionCamera.tsx`

Android plugin은 base64 이미지를 decode하고 모델 input tensor shape에 따라 resize했습니다. input tensor가 NCHW인지 NHWC인지 동적으로 판별해 float32 또는 uint8 input buffer를 만들었습니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

## 5. 모델/AI 파이프라인

### 서비스 추론

서비스 앱은 `best_float32.tflite`를 사용합니다. 모델 파일은 web public asset과 Android asset에 모두 존재합니다. 근거: `UI/userUI/public/wasm/best_float32.tflite`, `UI/userUI/android/app/src/main/assets/best_float32.tflite`

추론 흐름은 `VisionCamera.tsx -> NpuTfliteBridge.ts -> NpuTflitePlugin.java -> YoloParser.ts -> sendHazardReport()`입니다. 근거: `UI/userUI/components/VisionCamera.tsx`, `UI/userUI/NpuTfliteBridge.ts`, `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`, `UI/userUI/src/utils/YoloParser.ts`, `UI/userUI/src/api/report.ts`

## 6. 에러 분석 및 안전 장치

코드상 확인 가능한 위험 요소 및 안전장치는 다음과 같습니다.

- 서비스 앱은 TFLite output shape를 여러 형태로 normalize하려고 구현했지만, 실제 모델 output spec 문서는 확인되지 않았습니다. 근거: `UI/userUI/components/VisionCamera.tsx`, `UI/userUI/src/utils/YoloParser.ts`
- `model/new2.py`의 이미지 경로가 현재 파일 위치와 맞지 않는 오류가 존재하였으나, `model/road.jpg`를 참조하도록 정상 조치 완료했습니다. 근거: `model/new2.py`, `model/road.jpg`

## 7. 서비스 적용

서비스 적용은 사용자 앱에 통합되어 있습니다.

1. `VisionCamera`가 `MODEL_PATH = "wasm/best_float32.tflite"`로 모델을 로드했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`
2. `NpuTfliteBridge`가 Capacitor plugin `NpuTflite`를 등록했습니다. 근거: `UI/userUI/NpuTfliteBridge.ts`
3. Android `MainActivity`가 `NpuTflitePlugin`을 등록했습니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/MainActivity.java`
4. `NpuTflitePlugin`이 TFLite Interpreter로 모델을 로드하고 추론했습니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`
5. `YoloParser`가 output을 box/class/score로 변환했습니다. 근거: `UI/userUI/src/utils/YoloParser.ts`
6. `VisionCamera`가 primary hazard를 선택하고 거리/방향/risk level을 계산했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`
7. `sendHazardReport`가 이미지와 위치 metadata를 백엔드로 전송했습니다. 근거: `UI/userUI/src/api/report.ts`

## 8. 최적화

서비스 앱은 추론 중복 실행을 막기 위해 `isRunningRef`로 3초 loop의 async 중첩 실행을 방지했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`

Android plugin은 input/output tensor shape를 동적으로 읽고, CPU 4 threads로 Interpreter를 실행했습니다. GPU delegate 관련 코드는 주석 처리되어 있습니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

TFLite model asset은 web public 경로와 Android asset 경로에 배치했습니다. 근거: `UI/userUI/public/wasm/best_float32.tflite`, `UI/userUI/android/app/src/main/assets/best_float32.tflite`

## 9. 트러블슈팅

### 모델 output shape 대응

`YoloParser`는 `[1, N, 6]`, `[N, 6]`, raw YOLO `[1, F, B]`, `[1, B, F]`, shape 없는 flat output을 처리하도록 작성했습니다. 이는 모델 output layout 차이를 흡수하기 위한 후처리 구현입니다. 근거: `UI/userUI/src/utils/YoloParser.ts`

### Native plugin 안정화

Android plugin은 GPU delegate와 NNAPI 사용을 비활성화하고 CPU 4 threads로 실행하도록 구성했습니다. 코드 주석에는 native crash와 device 안정성 이슈 대응 내용이 남아 있습니다. 근거: `UI/userUI/android/app/src/main/java/com/team3/walkmate/NpuTflitePlugin.java`

### 위험 객체 선택 기준

서비스 앱은 여러 box 중 화면 중앙 영역과 겹치고 하단에 가까운 객체를 primary hazard로 선택했습니다. 이후 box 크기 비율로 거리 값을 계산하고, box 중심 x좌표로 좌/정면/우 방향을 결정했습니다. 근거: `UI/userUI/components/VisionCamera.tsx`

## 10. 한계와 개선점

- 서비스 신고 payload에 포함된 `distance`, `direction`, `x`, `y`, `w`, `h`가 백엔드 저장 로직에 반영되지 않는 정합성 불일치가 존재합니다. 근거: `UI/userUI/src/api/report.ts`, `backend/app/api/v1/endpoints/reports.py`
- 모델 추론 결과의 오탐/미탐 사례 분석 자료나 실제 현장 테스트 데이터가 부족합니다.
