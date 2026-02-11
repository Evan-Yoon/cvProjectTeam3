import cv2
import glob
import os
from ultralytics import YOLO
import json

# 1. 모델 로드
model = YOLO("choihyunseok/runs/obb/train/weights/best.pt")

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
    original_filename = os.path.basename(file_path)
    save_filename = f"result_{original_filename}"
    
    cv2.imwrite(save_filename, annotated_frame)
    print(f"저장 완료: {save_filename}")

    # 7. JSON 결과 저장
    # tojson() 메서드는 JSON 문자열을 반환합니다.
    json_result_str = results[0].to_json()
    # JSON 문자열을 파싱하여 리스트로 변환 (보기 좋게 저장하기 위함)
    json_result_list = json.loads(json_result_str)
    
    json_filename = f"result_{os.path.splitext(original_filename)[0]}.json"
    
    with open(json_filename, "w", encoding="utf-8") as f:
        json.dump(json_result_list, f, indent=4, ensure_ascii=False)
    print(f"JSON 저장 완료: {json_filename}")
