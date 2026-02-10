import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_vision/flutter_vision.dart'; // YOLO 추론 패키지
import 'package:path_provider/path_provider.dart'; // 파일 경로 패키지
import 'package:image/image.dart' as img; // 이미지 편집 패키지

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(home: YoloTestScreen());
  }
}

class YoloTestScreen extends StatefulWidget {
  const YoloTestScreen({super.key});

  @override
  State<YoloTestScreen> createState() => _YoloTestScreenState();
}

class _YoloTestScreenState extends State<YoloTestScreen> {
  // YOLO 비전 컨트롤러 생성
  late FlutterVision vision;
  // 모델 로드 여부 확인
  bool isLoaded = false;
  // 결과 이미지를 화면에 보여주기 위한 변수 (선택 사항)
  File? resultImageFile;

  @override
  void initState() {
    super.initState();
    vision = FlutterVision(); // 비전 객체 초기화
    loadYoloModel(); // 앱 시작 시 모델 로드
  }

  // 1. 모델 로드 함수
  Future<void> loadYoloModel() async {
    await vision.loadYoloModel(
      labels: 'assets/labels.txt', // 라벨 파일 경로
      modelPath: 'assets/yolo11n.tflite', // 모델 파일 경로
      modelVersion:
          "yolov8", // flutter_vision은 v8엔진 기반 (v11도 구조가 비슷하여 호환 가능성 높음)
      quantization: false, // 양자화 모델인 경우 true, fp16/32면 false
      numThreads: 2, // 사용할 CPU 스레드 수
      useGpu: true, // GPU 가속 사용 여부
    );
    setState(() {
      isLoaded = true; // 로드 완료 표시
    });
    print("모델 로드 완료!");
  }

  // 2. 추론 및 결과 저장 메인 함수 (버튼 클릭 시 실행)
  Future<void> runInferenceAndSave() async {
    if (!isLoaded) return; // 모델이 아직 로드 안 됐으면 중단

    try {
      // (1) assets 폴더의 a.jpg를 바이트 데이터로 읽어오기
      final ByteData byteData = await rootBundle.load('assets/a.jpg');
      final Uint8List imageBytes = byteData.buffer.asUint8List();

      // (2) image 패키지로 이미지 디코딩 (박스를 그리기 위해 필요)
      final img.Image? decodedImage = img.decodeImage(imageBytes);
      if (decodedImage == null) return;

      // (3) YOLO 추론 실행
      // yoloOnImage는 추론 결과를 List<Map> 형태로 반환함
      final result = await vision.yoloOnImage(
        bytesList: imageBytes,
        imageHeight: decodedImage.height,
        imageWidth: decodedImage.width,
        iouThreshold: 0.5, // 겹치는 박스 제거 임계값
        confThreshold: 0.4, // 신뢰도 임계값 (0.4 이상만 탐지)
        classThreshold: 0.5, // 클래스 정확도 임계값
      );

      print("추론 결과: $result"); // 콘솔에서 좌표 확인용

      // (4) 원본 이미지에 사각형(Bbox) 그리기
      for (var item in result) {
        // flutter_vision의 결과는 [x1, y1, x2, y2, confidence, class_index] 형태의 박스 정보를 줌
        // 패키지 버전에 따라 'box' 키 안에 [x1, y1, x2, y2, class]가 들어있음.
        final box = item['box'];
        final double left = box[0];
        final double top = box[1];
        final double right = box[2];
        final double bottom = box[3];

        // 사각형 그리기 (색상: 빨간색, 두께: 3)
        img.drawRect(
          decodedImage,
          x1: left.toInt(),
          y1: top.toInt(),
          x2: right.toInt(),
          y2: bottom.toInt(),
          color: img.ColorRgb8(255, 0, 0),
          thickness: 3,
        );

        // (선택) 라벨 텍스트도 넣고 싶다면 img.drawString 사용 가능
      }

      // (5) 결과 이미지를 JPG로 인코딩
      final Uint8List resultBytes = img.encodeJpg(decodedImage);

      // (6) 파일 시스템에 저장 (앱 내부 문서 폴더)
      final directory = await getApplicationDocumentsDirectory();
      final String savePath = '${directory.path}/a_result.jpg'; // 저장 경로 설정
      final File file = File(savePath);
      await file.writeAsBytes(resultBytes); // 파일 쓰기

      print("저장 완료: $savePath");

      // 화면 갱신해서 결과 보여주기
      setState(() {
        resultImageFile = file;
      });
    } catch (e) {
      print("에러 발생: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("YOLO11n TFLite Test")),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 결과 이미지가 있으면 보여주고, 없으면 기본 텍스트
            resultImageFile != null
                ? Image.file(resultImageFile!, height: 300)
                : const Text("버튼을 눌러 추론을 시작하세요"),

            const SizedBox(height: 20),

            // 추론 버튼
            ElevatedButton(
              onPressed: runInferenceAndSave,
              child: const Text("a.jpg 추론 후 저장"),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    super.dispose();
    vision.closeYoloModel(); // 앱 종료 시 모델 메모리 해제
  }
}
