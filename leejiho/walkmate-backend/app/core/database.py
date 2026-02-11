import os
from dotenv import load_dotenv
from supabase import create_client, Client

# .env 파일 활성화
load_dotenv()

# os.getenv로 환경변수 가져오기 
url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")


print("\n" + "="*30)
print(f"DEBUG: SUPABASE_URL -> {url}")
print(f"DEBUG: SUPABASE_KEY -> {key[:10]}..." if key else "DEBUG: SUPABASE_KEY -> None")
print("="*30 + "\n")


if not url or not key:
    raise ValueError("Supabase URL or Key is missing in .env file")

db_client: Client = create_client(url, key)