import { useState, useEffect, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { LatLng } from '@/types';
import { speak } from '@/src/utils/audio';

export const useGeolocation = () => {
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const myLocationRef = useRef<LatLng | null>(null);

  useEffect(() => {
    let watchId: string | null = null;

    const startWatching = async () => {
      try {
        const checkPermission = await Geolocation.checkPermissions();
        if (checkPermission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            await speak("위치 권한이 필요합니다. 설정에서 권한을 허용해주세요.");
            return;
          }
        }

        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 10000,
          },
          (pos, err) => {
            if (err) {
              console.warn("GPS Watch Retry:", err);
              return;
            }
            if (pos) {
              const newLoc = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
              };
              setMyLocation(newLoc);
              myLocationRef.current = newLoc;
              console.log("📍 내 위치 업데이트:", pos.coords.latitude, pos.coords.longitude);
            }
          }
        );
      } catch (error) {
        console.error("GPS 초기화 에러:", error);
        speak("위치 정보를 가져올 수 없습니다. GPS를 켜주세요.");
      }
    };

    startWatching();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, []);

  return {
    myLocation,
    myLocationRef,
  };
};
