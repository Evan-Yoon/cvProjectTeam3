from ultralytics import YOLO
model = YOLO("best.pt")
model.export(format="tflite", imgsz = 1280, int8=True, data='-Braile-Block-Copy-2/data.yaml') # 이미지 양자화
