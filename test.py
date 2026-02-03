import cv2
from ultralytics import YOLO

# 1. 모델 로드 (YOLO11 Nano Segmentation)
# 처음 실행 시 자동으로 weights 파일을 다운로드합니다.
model = YOLO("yolo11n-seg.pt")


# aaa test
# bbb test

if not cap.isOpened():
    print("웹캠을 열 수 없습니다.")
    exit()

print("종료하려면 화면을 클릭하고 'q'를 누르세요.")

while True:
    # 프레임 읽기
    success, frame = cap.read()
    if not success:
        break

    # 3. 추론 (Inference)
    # conf: 탐지 신뢰도 임계값, imgsz: 입력 이미지 크기
    results = model.predict(frame, conf=0.5, verbose=False)

    # 4. 결과 시각화
    # plot() 메서드는 바운딩 박스와 마스크가 그려진 이미지를 반환합니다.
    annotated_frame = results[0].plot()

    # 화면 출력
    cv2.imshow("YOLO11 Nano Segmentation", annotated_frame)

    # 'q' 키를 누르면 루프 종료
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# 자원 해제
cap.release()
cv2.destroyAllWindows()