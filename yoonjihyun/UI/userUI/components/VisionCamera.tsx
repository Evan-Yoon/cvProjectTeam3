import React, { useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { Geolocation } from "@capacitor/geolocation";
import { sendHazardReport } from "../src/api/report";

const VisionCamera: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState<string>("카메라 초기화 중...");
  const isMounted = useRef(true);

  // ---------------------------
  // 5초마다 자동 촬영 및 업로드
  // ---------------------------
  useEffect(() => {
    isMounted.current = true;
    setStatus("자동 촬영 대기 중...");

    const autoCaptureInterval = setInterval(async () => {
      if (!isMounted.current) return;

      // 1. 카메라 준비 확인
      if (!webcamRef.current || !webcamRef.current.video) {
        console.log("사진 촬영 실패: 카메라가 준비되지 않았습니다.");
        return;
      }

      try {
        // 2. 사진 촬영 (Base64)
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          console.log("사진 촬영 실패: 스크린샷 캡처 불가");
          return;
        }

        console.log("사진 촬영 완료");
        setStatus("사진 촬영 완료");

        // Base64 헤더 제거
        const base64Data = imageSrc.split(",")[1];

        // 3. 현재 위치 가져오기
        // (실내/에뮬레이터 등 위치 확보가 어려운 경우를 대비해 타임아웃 설정)
        let pos;
        try {
          pos = await Geolocation.getCurrentPosition({ timeout: 5000 });
        } catch (locErr) {
          console.log("사진 전송 실패: 위치 정보를 가져올 수 없습니다.");
          return;
        }

        // 4. 서버로 전송
        try {
          await sendHazardReport({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            hazard_type: "Auto_Capture", // 자동 기록용 태그
            risk_level: 0,
            imageBase64: base64Data,
            description: "5초 주기 자동 기록 데이터",
          });

          console.log("사진 촬영 완료 -> 사진 데이터 베이스 전송완료");
          setStatus("전송 완료");

          // 잠시 후 상태 복귀
          setTimeout(() => {
            if (isMounted.current) setStatus("대기 중...");
          }, 2000);

        } catch (uploadErr) {
          console.log(`사진 전송 실패: ${uploadErr}`);
          setStatus("전송 실패");
        }

      } catch (error) {
        console.log(`사진 촬영/전송 중 에러 발생: ${error}`);
        setStatus("에러 발생");
      }
    }, 5000); // 5000ms = 5초

    return () => {
      isMounted.current = false;
      clearInterval(autoCaptureInterval);
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black flex justify-center items-center overflow-hidden">
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "environment" }}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* 상태 표시 오버레이 (선택 사항) */}
      <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full z-50">
        <p className="text-yellow-400 font-mono text-xs font-bold animate-pulse">
          {status}
        </p>
      </div>
    </div>
  );
};

export default VisionCamera;
