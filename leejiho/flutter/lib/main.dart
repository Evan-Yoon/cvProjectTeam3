import 'dart:typed_data';
import 'dart:io'; // File 사용을 위해
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_vision/flutter_vision.dart';
import 'package:image/image.dart' as img; // ★ 이미지 처리 패키지

void main() {
  runApp(const MaterialApp(home: YoloAssetScreen()));
}

class YoloAssetScreen extends StatefulWidget {
  const YoloAssetScreen({super.key});

  @override
  State<YoloAssetScreen> createState() => _YoloAssetScreenState();
}

class _YoloAssetScreenState extends State<YoloAssetScreen> {
  late FlutterVision vision;

  bool isLoaded = false;
  Uint8List? imageBytes; // 화면 표시용 (원본)
  List<Map<String, dynamic>> yoloResults = [];
  String statusMessage = "모델 로딩 중...";

  @override
  void initState() {
    super.initState();
    vision = FlutterVision();
    loadYoloModel();
  }

  // 1. 모델 로드
  Future<void> loadYoloModel() async {
    try {
      await vision.loadYoloModel(
        labels: 'assets/labels.txt',
        modelPath: 'assets/best_float32.tflite',
        modelVersion: "yolov8",
        quantization: false,
        numThreads: 2,
        useGpu: true,
      );
      setState(() {
        isLoaded = true;
        statusMessage = "준비 완료! 버튼을 누르세요.";
      });
    } catch (e) {
      setState(() {
        statusMessage = "❌ 모델 로드 에러:\n$e";
      });
    }
  }

  // 2. 추론 실행 (이미지 전처리 포함)
  Future<void> runInferenceOnAsset() async {
    try {
      setState(() {
        statusMessage = "분석 중...";
      });

      // (1) 파일 불러오기
      final ByteData byteData = await rootBundle.load('assets/a.jpg');
      final Uint8List bytes = byteData.buffer.asUint8List();

      // (2) 이미지 디코딩
      final img.Image? originalImage = img.decodeImage(bytes);

      if (originalImage == null) throw Exception("이미지 디코딩 실패");

      // (3) 640x640으로 리사이징
      final img.Image resizedImage = img.copyResize(
          originalImage,
          width: 640,
          height: 640
      );

      // -----------------------------------------------------------
      // ★ [수정된 부분] (4) JPEG로 다시 인코딩 (안드로이드가 알아먹게 포장!)
      // -----------------------------------------------------------
      // 이전 코드: raw RGB 데이터를 보냄 -> 안드로이드가 못 읽음
      // 수정 코드: JPEG 형식으로 변환해서 보냄 -> 안드로이드가 "아! 사진이구나" 하고 읽음
      final Uint8List jpgBytes = Uint8List.fromList(img.encodeJpg(resizedImage));

      // (5) 추론 실행
      final results = await vision.yoloOnImage(
        bytesList: jpgBytes, // ★ 여기에 jpgBytes를 넣으세요!
        imageHeight: 640,
        imageWidth: 640,
        iouThreshold: 0.5,
        confThreshold: 0.4,
        classThreshold: 0.5,
      );

      print("🔍 모델 탐지 결과: ${results.length}개");
      if (results.isNotEmpty) {
        print("첫 번째 박스: ${results.first}");
      }

      setState(() {
        imageBytes = bytes;
        yoloResults = results;
        statusMessage = "분석 완료: ${results.length}개 발견!";
      });

    } catch (e) {
      print("❌ 에러: $e");
      setState(() {
        statusMessage = "❌ 분석 에러:\n$e";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('점자블록 탐지 테스트')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 이미지 및 박스 영역
            if (imageBytes != null)
              Expanded(
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Image.memory(imageBytes!, fit: BoxFit.contain),

                    // 박스 그리기
                    LayoutBuilder(
                      builder: (context, constraints) {
                        // 원본 이미지 크기 구하기 (비율 계산용)
                        // 여기서는 간단히 화면 꽉 찼다고 가정하거나,
                        // 정확하게 하려면 decodeImageFromList를 써야 함.
                        // 테스트 목적이므로 640 기준으로 그립니다.
                        return CustomPaint(
                          painter: BoundingBoxPainter(
                            results: yoloResults,
                            // 원본 이미지가 아니라 '모델 입력 크기(640)' 기준으로 그려봅니다.
                            // (정확한 위치는 비율 계산이 필요하지만 일단 나오는지 확인!)
                            imageWidth: 640,
                            imageHeight: 640,
                          ),
                          size: Size(constraints.maxWidth, constraints.maxHeight),
                        );
                      },
                    ),
                  ],
                ),
              )
            else
              const Expanded(child: Center(child: Text("이미지가 없습니다."))),

            const SizedBox(height: 20),

            // 상태 메시지 및 버튼
            Padding(
              padding: const EdgeInsets.all(8.0),
              child: Text(statusMessage, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ),

            ElevatedButton.icon(
              onPressed: isLoaded ? runInferenceOnAsset : null,
              icon: const Icon(Icons.search),
              label: const Text("탐지 시작"),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    vision.closeYoloModel();
    super.dispose();
  }
}

// 박스 그리기 클래스
class BoundingBoxPainter extends CustomPainter {
  final List<Map<String, dynamic>> results;
  final double imageWidth;
  final double imageHeight;

  BoundingBoxPainter({
    required this.results,
    required this.imageWidth,
    required this.imageHeight,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final Paint boxPaint = Paint()
      ..color = Colors.green // 잘 보이게 초록색
      ..strokeWidth = 3.0
      ..style = PaintingStyle.stroke;

    final Paint textPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    // 화면 크기 vs 이미지 크기 비율
    // (BoxFit.contain을 가정하면, 실제 이미지가 그려진 영역을 구해야 정확하지만
    //  지금은 단순히 전체 화면 비율로 계산합니다)
    final double scaleX = size.width / imageWidth;
    final double scaleY = size.height / imageHeight;

    for (var result in results) {
      final box = result["box"];
      final String tag = result["tag"];

      final double left = (box[0] as num).toDouble() * scaleX;
      final double top = (box[1] as num).toDouble() * scaleY;
      final double right = (box[2] as num).toDouble() * scaleX;
      final double bottom = (box[3] as num).toDouble() * scaleY;

      // 박스 그리기
      canvas.drawRect(Rect.fromLTRB(left, top, right, bottom), boxPaint);

      // 글씨 쓰기 (태그)
      final TextSpan span = TextSpan(
        style: const TextStyle(color: Colors.black, fontSize: 14, backgroundColor: Colors.white),
        text: tag,
      );
      final TextPainter tp = TextPainter(
        text: span,
        textAlign: TextAlign.left,
        textDirection: TextDirection.ltr,
      );
      tp.layout();
      tp.paint(canvas, Offset(left, top - 20));
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}