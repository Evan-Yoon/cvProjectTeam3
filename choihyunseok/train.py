from ultralytics import YOLO

# 1. 사전 학습된 모델 로드 (전이 학습 시작점)
model = YOLO("yolo11n-seg.pt")

# 2. 학습 시작 (Train)
# data: 위에서 작성한 yaml 파일 경로
# epochs: 학습 반복 횟수
# imgsz: 이미지 크기
results = model.train(
    data="custom_data.yaml", 
    epochs=100, 
    imgsz=640,
    batch=16
)