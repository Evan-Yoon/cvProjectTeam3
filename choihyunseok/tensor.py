from ultralytics import YOLO
model = YOLO("choihyunseok/runs/obb/train/weights/best.pt")
model.export(format="tflite", imgsz = 720, int8=True, data='-Braile-Block-Copy-2/data.yaml') # 이미지 양자화
