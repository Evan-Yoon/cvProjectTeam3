import { useState, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { AppScreen, LatLng, Destination, NavigationStep } from '@/types';
import { searchLocation } from '@/src/api/tmap';
import { requestNavigation } from '@/src/api/backend';
import { speak } from '@/src/utils/audio';

export const useNavigation = (myLocationRef: React.MutableRefObject<LatLng | null>) => {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(AppScreen.IDLE);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [routeData, setRouteData] = useState<NavigationStep[]>([]);
  const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[]>([]);

  const destinationRef = useRef<Destination | null>(null);

  const handleStart = useCallback(() => {
    setCurrentScreen(AppScreen.LISTENING);
  }, []);

  const handleSpeechDetected = useCallback(async (transcript: string) => {
    if (!transcript) return;

    let currentLoc = myLocationRef.current;

    // GPS가 아직 없으면 다시 시도
    if (!currentLoc) {
      await speak("현재 위치를 확인 중입니다. 잠시 후 다시 시도해주세요.");
      try {
        const coordinates = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 10000,
        });
        const newLoc = {
          lat: coordinates.coords.latitude,
          lng: coordinates.coords.longitude
        };
        myLocationRef.current = newLoc;
        currentLoc = newLoc;
      } catch (e) {
        console.error("GPS Retry Fail", e);
      }

      if (!currentLoc) {
        setCurrentScreen(AppScreen.IDLE);
        return;
      }
    }

    const keyword = transcript.replace(/으로 안내해줘|로 안내해줘| 안내해줘| 안내/g, "").trim();
    console.log(`🎤 인식된 검색어: ${keyword}`);

    try {
      await speak("장소를 검색 중입니다.");
      const location = await searchLocation(keyword, currentLoc.lat, currentLoc.lng);

      if (location) {
        const nextDest = {
          name: location.name,
          lat: location.lat,
          lng: location.lng
        };
        setDestination(nextDest);
        destinationRef.current = nextDest;
        setCurrentScreen(AppScreen.CONFIRMATION);
      } else {
        await speak("장소를 찾을 수 없습니다. 다시 말씀해주세요.");
        const errDest = { name: 'ERROR_NOT_FOUND', lat: 0, lng: 0 };
        setDestination(errDest);
        destinationRef.current = errDest;
        setCurrentScreen(AppScreen.RETRY);
      }
    } catch (error) {
      console.error("검색 중 에러:", error);
      await speak("검색 중 오류가 발생했습니다.");
      const errDest = { name: 'ERROR_SEARCH', lat: 0, lng: 0 };
      setDestination(errDest);
      destinationRef.current = errDest;
      setCurrentScreen(AppScreen.RETRY);
    }
  }, [myLocationRef]);

  const handleConfirmDestination = useCallback(async () => {
    const dest = destinationRef.current;
    const loc = myLocationRef.current;
    if (!dest || !loc) return;

    try {
      await speak(`${dest.name}으로 안내합니다.`);

      console.log("useNavigation.ts: Requesting navigation with:", {
        start_lat: loc.lat,
        start_lon: loc.lng,
        end_lat: dest.lat,
        end_lon: dest.lng
      });

      const { steps, path } = await requestNavigation({
        start_lat: loc.lat,
        start_lon: loc.lng,
        end_lat: dest.lat,
        end_lon: dest.lng
      });

      console.log("useNavigation.ts: path from backend:", path);
      console.log("useNavigation.ts: steps from backend:", steps);

      setRouteData(steps);
      setRoutePath(path);
      setCurrentScreen(AppScreen.GUIDING);
    } catch (error: any) {
      console.error("탐색 에러:", error);

      const currentBackendUrl = import.meta.env.VITE_BACKEND_URL || "설정된 주소 없음";
      const errDetail = {
        message: error.message || 'No message',
        code: error.code || 'No code',
        status: error.status || 'No status',
        data: error.data || 'No data',
      };

      alert(`[Debug]\nURL: ${currentBackendUrl}\nError: ${JSON.stringify(errDetail, null, 2)}`);
      await speak("경로를 안내할 수 없습니다. 잠시 후 다시 시도해주세요.");

      const errDest = { name: `ERROR_NETWORK: ${error.message || 'Unknown'}`, lat: 0, lng: 0 };
      setDestination(errDest);
      destinationRef.current = errDest;
      setCurrentScreen(AppScreen.RETRY);
    }
  }, [myLocationRef]);

  const handleDenyDestination = useCallback(() => {
    setCurrentScreen(AppScreen.RETRY);
  }, []);

  const handleCancel = useCallback(() => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
    destinationRef.current = null;
    setRouteData([]);
    setRoutePath([]);
  }, []);

  const handleEndNavigation = useCallback(() => {
    setCurrentScreen(AppScreen.IDLE);
    setDestination(null);
    destinationRef.current = null;
    setRouteData([]);
    setRoutePath([]);
  }, []);

  return {
    currentScreen,
    destination,
    routeData,
    routePath,
    handleStart,
    handleSpeechDetected,
    handleConfirmDestination,
    handleDenyDestination,
    handleCancel,
    handleEndNavigation,
  };
};
