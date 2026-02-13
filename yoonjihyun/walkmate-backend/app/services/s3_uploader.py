import boto3
from botocore.exceptions import ClientError
from app.core.config import (
    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
    S3_BUCKET_NAME, S3_PUBLIC_BASE_URL
)

def _client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )

def upload_image_to_s3(file_bytes: bytes, key: str, content_type: str) -> str:
    if not S3_BUCKET_NAME:
        raise RuntimeError("S3_BUCKET_NAME is missing")

    s3 = _client()
    try:
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type or "image/jpeg",
            ACL="public-read",  # 버킷 정책이 public을 허용해야 Admin에서 바로 조회 가능
        )
    except ClientError as e:
        raise RuntimeError(f"S3 upload failed: {e}") from e

    base = S3_PUBLIC_BASE_URL.rstrip("/") if S3_PUBLIC_BASE_URL else f"https://{S3_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com"
    return f"{base}/{key}"