from roboflow import Roboflow
from ultralytics import YOLO
import cv2
from PIL import Image
import matplotlib.pyplot as plt

# rf = Roboflow(api_key="qs9y6zBonySytcyxj4xf")
# project = rf.workspace("test-w9qag").project("braile-block-copy-o9qjb")
# version = project.version(2)
# dataset = version.download("yolov8-obb")

model1 = YOLO("choihyunseok/yolo11n-obb.pt")

results = model1.train(
    task='obb',
    data="choihyunseok/-Braile-Block-Copy-2/data.yaml",
    epochs=1,
    imgsz=16,
    batch=16
    )

