import cv2
import glob
import os
from ultralytics import YOLO

# 1. 모델 로드 (YOLO11 Nano Segmentation)
model = YOLO("choihyunseok/yolo11n.pt")

# 2. 대상 이미지 파일 찾기
image_files = glob.glob("choihyunseok/outside*.jpg")

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