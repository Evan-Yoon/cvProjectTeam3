import boto3
from botocore.exceptions import ClientError
from app.core.config import (
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
    S3_BUCKET_NAME, S3_PUBLIC_BASE_URL
)

# s3_uploader.py는 이미지 bytes를 AWS S3에 업로드하고, 프론트/관리자에서 볼 수 있는 URL을 만들어 반환합니다.

def _client():
    """boto3 S3 클라이언트를 현재 환경변수 설정으로 생성합니다."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )

def upload_image_to_s3(file_bytes: bytes, key: str, content_type: str) -> str:
    """이미지 파일 bytes를 S3에 저장하고 접근 가능한 이미지 URL을 반환합니다."""
    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME is missing")

    s3 = _client()
    try:
        # ACL을 지정하지 않습니다. ACL 비활성화 버킷에서도 동작하게 하고, 공개 여부는 버킷 정책/CloudFront가 담당합니다.
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type or "image/jpeg",
        )
    except ClientError as e:
        raise RuntimeError(f"S3 upload failed: {e}") from e

    # 별도 공개 베이스 URL이 있으면 그것을 우선 사용하고, 없으면 표준 S3 URL을 조합합니다.
    base = S3_PUBLIC_BASE_URL.rstrip("/") if S3_PUBLIC_BASE_URL else f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com"
    return f"{base}/{key}"
