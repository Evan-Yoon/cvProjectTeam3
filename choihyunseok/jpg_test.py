import cv2
import glob
import os
from ultralytics import YOLO

# 1. 모델 로드 (YOLO11 Nano Segmentation)
model = YOLO("yolo11n-seg.pt")

# 2. 대상 이미지 파일 찾기
# 현재 경로에서 'outside'로 시작하고 확장자가 '.jpg'인 모든 파일을 찾습니다.
image_files = glob.glob("outside*.jpg")

if not image_files:
    print("처리할 'outside*.jpg' 파일을 찾을 수 없습니다.")
    exit()

print(f"총 {len(image_files)}개의 파일을 발견했습니다. 분석을 시작합니다.")

for file_path in image_files:
    # 3. 이미지 읽기
    frame = cv2.imread(file_path)

    if frame is None:
        print(f"이미지 로드 실패: {file_path}")
        continue

    # 4. 추론 (Inference)
    results = model.predict(frame, conf=0.5, verbose=False)

    # 5. 결과 시각화
    annotated_frame = results[0].plot()

    # 6. 결과 저장
    # 파일 경로에서 순수 파일명만 추출 (예: 'folder/outside1.jpg' -> 'outside1.jpg')
    original_filename = os.path.basename(file_path)
    save_filename = f"result_{original_filename}"
    
    cv2.imwrite(save_filename, annotated_frame)
    print(f"저장 완료: {save_filename}")

print("모든 작업이 완료되었습니다.")