from roboflow import Roboflow
from ultralytics import YOLO
import cv2
from PIL import Image
import matplotlib.pyplot as plt

rf = Roboflow(api_key="qs9y6zBonySytcyxj4xf")
project = rf.workspace("test-w9qag").project("braile-block-copy-lml6r")
version = project.version(2)
dataset = version.download("yolov8-obb")
                
# 1. 사전 학습된 모델 로드 (전이 학습 시작점)
model1 = YOLO("yolo8n-obb.pt")

# 2. 학습 시작 (Train)
# data: 위에서 작성한 yaml 파일 경로
# epochs: 학습 반복 횟수
# imgsz: 이미지 크기

# 이전에 저장된 가중치 파일(last.pt)을 불러옵니다.
# 주의: 이전 학습이 중단되어 last.pt가 생성된 경우에만 작동합니다.
# model1 = YOLO("runs/detect/train/weights/last.pt")

results = model1.train(
    task='obb',
    data="-Braile-Block-Copy-1/data.yaml",
    epochs=200,
    imgsz=640,
    batch=128,
    device=0,

    # === 기하학적 증강 (Geometric Augmentation) ===
    degrees=20.0,      # 이미지 회전 (+/- 도)
    translate=0.1,   # 이미지 수평/수직 이동 (비율)
    scale=0.8,         # 이미지 크기(scale) 변화 (비율)
    shear=50.0,        # 전단 변환 (기울기)
    perspective=0.0001, # 원근 변환
    # flipud=0.0,      # 상하 반전 확률
    # fliplr=0.5,      # 좌우 반전 확률
    # mosaic=1.0,      # Mosaic (4개 이미지 합성) 확률
    # mixup=0.0,       # Mixup (이미지 겹치기) 확률

    # === 색상 및 기타 증강 (Color & Erasing) ===
    hsv_h=0.1,       # 색조(Hue) 변경 비율 (0.0 ~ 1.0)
    hsv_s=0.7,         # 채도(Saturation) 변경 비율 (0.0 ~ 1.0)
    hsv_v=0.4,         # 명도(Value) 변경 비율 (0.0 ~ 1.0)
    # erasing=0.4,       # 무작위 영역 삭제(Random Erasing) 확률 (가림 현상 강건성)
)

# 1. 학습된 최적 모델 로드
model_pred = YOLO("/content/runs/obb/train/weights/best.pt")

# 2. 이미지 추론 수행
results = model_pred.predict(source="outside01.jpg")

# 3. 추론 결과 시각화 및 파일 저장
# plot() 메서드는 박스가 그려진 이미지(Numpy 배열)를 반환합니다.
res_plotted = results[0].plot()
cv2.imwrite("outside_predict1.jpg", res_plotted)

print("추론이 완료되었습니다. 'outside_predict1.jpg' 파일을 확인해 보세요.")

# 이미지 열기
img = Image.open("outside_predict1.jpg")

# 이미지 출력
plt.figure(figsize=(12, 8))
plt.imshow(img)
plt.axis('off')
plt.show()