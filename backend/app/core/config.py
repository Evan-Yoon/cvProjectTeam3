import os
from dotenv import load_dotenv

# config.py는 환경변수를 한 곳에서 읽어 나머지 백엔드 코드가 import해서 쓰게 하는 설정 파일입니다.
# .env 파일은 로컬 실행용 비밀값을 담고, Git에는 보통 .env.example만 올립니다.
load_dotenv()

# PostgreSQL/Supabase 연결 문자열입니다. database.py가 이 값으로 SQLAlchemy engine을 만듭니다.
DATABASE_URL = os.getenv("DATABASE_URL", "")

# S3 업로드에 필요한 AWS 인증/버킷 설정입니다. reports.py -> s3_uploader.py 흐름에서 사용됩니다.
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "")
# S3_PUBLIC_BASE_URL이 있으면 CloudFront/퍼블릭 버킷 URL처럼 외부에서 읽을 이미지 베이스 URL로 사용합니다.
S3_PUBLIC_BASE_URL = os.getenv("S3_PUBLIC_BASE_URL", "")

# navigation.py가 TMAP 보행자 경로 API를 호출할 때 쓰는 서버용 API 키입니다.
TMAP_API_KEY = os.getenv("TMAP_API_KEY", "")

# 쉼표로 구분된 문자열을 FastAPI CORSMiddleware가 기대하는 리스트로 변환합니다.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
