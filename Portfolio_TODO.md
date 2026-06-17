# Portfolio TODO

## 사용자가 확인해야 할 내용

- [ ] 실제 개발 기간
- [ ] 팀원 수와 본인 역할
- [ ] 본인이 직접 구현한 기능
- [ ] 실행 화면 캡처
- [ ] 시연 GIF 또는 데모 영상
- [ ] 배포 링크
- [ ] 실제 운영 환경
- [ ] 성능 지표 원본
- [ ] 트러블슈팅 경험
- [ ] 지원 직무에 맞게 강조할 내용
- [ ] 현재 README와 실제 폴더 구조 불일치 정리

## 코드 근거가 부족한 내용

| 항목 | 필요한 근거 | 현재 상태 |
|---|---|---|
| 개발 기간 | 일정표, 커밋 이력 정리, 회고 문서 | 없음 |
| 본인 역할 | 팀 문서 또는 본인 구현 범위 정리 | 없음 |
| 화면 캡처 | 사용자 앱/관리자 앱 실행 화면 | 없음 |
| 배포 여부 | 배포 URL, hosting 설정, CI/CD 설정 | 확인 필요 |
| DB schema | create table SQL, migration, PostGIS extension 설정 | `migrate.py`에는 `deleted_at` 추가만 확인 |
| 인증/인가 | 로그인 API, JWT dependency, 관리자 권한 검증 | `SECRET_KEY` 설정 흔적만 있음 |
| 관리자 데이터 경로 | Supabase 직접 조회와 FastAPI API 중 운영 기준 선택 | 두 방식이 함께 존재 |
| 관리자 삭제 API | 프론트 delete helper와 백엔드 DELETE endpoint 정합성 | 현재 helper는 `PATCH hidden`, 백엔드는 `DELETE` 제공 |
| 최신 빌드 검증 | 현재 환경에서 user/admin/backend 실행 로그 | 과거 userUI build log만 확인 |

## 포트폴리오 본문에 확정적으로 쓰지 말아야 할 내용

- [ ] 성능 수치
- [ ] 배포 완료 여부
- [ ] 운영 사용자 수
- [ ] 실제 장애 해결 성과
- [ ] 모델 정확도 개선 폭
- [ ] 본인 단독 구현 범위
- [ ] 인증/인가 구현 완료
- [ ] DB schema 완성도
- [ ] PostGIS 운영 적용 완료
- [ ] S3 운영 bucket 정책

## 추가 확인 후 넣으면 좋은 자료

- [ ] 사용자 앱 Idle/Listening/Confirmation/Guiding 화면 캡처
- [ ] 관리자 Dashboard/Heatmap/Database 화면 캡처
- [ ] 신고 생성부터 관리자 화면 반영까지의 시연 GIF
- [ ] TFLite 추론 결과 overlay 화면
- [ ] 백엔드 Swagger 화면
- [ ] DB schema 또는 ERD
- [ ] 모델 학습 결과표
- [ ] 모델 변환 절차 문서
- [ ] 실제 문제 해결 회고
