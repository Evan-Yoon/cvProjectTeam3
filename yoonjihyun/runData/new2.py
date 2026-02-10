from ultralytics import YOLO

# 모델 로드 (자동으로 yolo11n.pt 다운로드)
model = YOLO("yolo11n.pt")

# 이미지에서 객체 탐지
results = model("yoonjihyun/road.jpg")

# 결과 화면에 표시
for result in results:
    result.show()  # 이미지 표시
    # result.save(filename='result.jpg') # 결과 저장
