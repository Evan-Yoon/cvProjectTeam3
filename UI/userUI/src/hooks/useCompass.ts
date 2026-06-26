import { useState, useEffect, useRef } from 'react';

/**
 * 나침반 센서 가공 및 융합을 위한 매개변수 명세
 */
interface UseCompassParams {
  /** 사용자가 실제 걷고 있을 때 GPS 궤적 정보로부터 계산한 절대 이동각 Ref */
  targetGpsHeading: React.MutableRefObject<number | null>;
  /** GPS 궤적이 갱신된 최근 타임스탬프 (밀리초) Ref */
  gpsActiveTime: React.MutableRefObject<number>;
  /** 기기 센서 편차를 상쇄 보정하기 위한 나침반 옵셋값 (도 단위) */
  compassOffset?: number;
}

/**
 * 모바일 기기 나침반 센서(방위각)를 구독 및 가공하는 훅입니다.
 * 서 있거나 멈췄을 땐 저역 통과 필터(LPF)로 노이즈를 흔들림 없이 정돈하고, 
 * 이동 중에는 GPS 진행 궤적 각도를 반영하는 센서 퓨전(Sensor Fusion) 보정을 지원합니다.
 */
export const useCompass = ({
  targetGpsHeading,
  gpsActiveTime,
  compassOffset = 0,
}: UseCompassParams) => {
  const [visualHeading, setVisualHeading] = useState<number | null>(null);
  const [isOriented, setIsOriented] = useState(false);
  const compassHeading = useRef<number | null>(null);
  const isOrientedRef = useRef(false);

  useEffect(() => {
    let lastSmoothedHeading: number | null = null;

    const setupCompass = async () => {
      try {
        // iOS 13 이상을 위한 권한 요청 (안드로이드는 자동 통과됨)
        if (
          typeof DeviceMotionEvent !== 'undefined' &&
          (DeviceMotionEvent as any).requestPermission
        ) {
          const response = await (DeviceMotionEvent as any).requestPermission();
          if (response !== 'granted') return;
        }

        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
      } catch (e) {
        console.error("Compass Error", e);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      let rawHeading = 0;
      let validData = false;

      // 1. iOS 전용: 기울기를 3차원으로 보정해주는 webkitCompassHeading
      if (typeof (event as any).webkitCompassHeading !== 'undefined') {
        rawHeading = (event as any).webkitCompassHeading;
        validData = true;
      }
      // 2. Android (Chromium): 절대 방위각 (지구 북극 기준 Z 회전)
      else if (event.absolute && event.alpha !== null) {
        rawHeading = 360 - event.alpha;
        validData = true;
      }

      if (!validData) return;

      // 나침반 기본 보정값 적용
      let currentHeading = (rawHeading + compassOffset) % 360;
      if (currentHeading < 0) currentHeading += 360;

      // 3. 센서 퓨전 (Sensor Fusion) - GPS 기반 가속도 보정
      const now = Date.now();
      if (targetGpsHeading.current !== null && (now - gpsActiveTime.current) < 4000) {
        let diffGps = targetGpsHeading.current - currentHeading;
        diffGps = ((diffGps + 540) % 360) - 180;
        currentHeading = currentHeading + diffGps * 0.9;
        currentHeading = (currentHeading + 360) % 360;
      }

      // 4. 저역 통과 필터(LPF) 적용 및 360도 경계선 최단거리 보간
      if (lastSmoothedHeading === null) {
        lastSmoothedHeading = currentHeading;
      } else {
        let diff = currentHeading - lastSmoothedHeading;
        diff = ((diff + 540) % 360) - 180;

        const dynamicAlpha = (now - gpsActiveTime.current) < 4000 ? 0.35 : 0.15;
        lastSmoothedHeading = lastSmoothedHeading + dynamicAlpha * diff;
        lastSmoothedHeading = (lastSmoothedHeading + 360) % 360;
      }

      compassHeading.current = lastSmoothedHeading;
      setVisualHeading(lastSmoothedHeading);

      if (!isOrientedRef.current && lastSmoothedHeading !== null) {
        isOrientedRef.current = true;
        setIsOriented(true);
      }
    };

    setupCompass();

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [targetGpsHeading, gpsActiveTime, compassOffset]);

  return {
    visualHeading,
    compassHeading,
    isOriented,
  };
};
