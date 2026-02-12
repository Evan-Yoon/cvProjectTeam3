import boto3
import uuid
from fastapi import UploadFile
from app.core.config import settings

class S3Uploader:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.AWS_BUCKET_NAME

    # [수정 포인트] 여기에 'async'를 붙여야 파이프라인에서 await를 쓸 수 있습니다.
    async def upload_image(self, file: UploadFile) -> str:
        try:
            file_extension = file.filename.split(".")[-1]
            unique_filename = f"{uuid.uuid4()}.{file_extension}"

            # 주의: boto3는 기본적으로 동기 함수지만, async def 안에서도 동작은 합니다.
            # (추후 트래픽이 많아지면 run_in_threadpool 등을 고려할 수 있지만 지금은 OK)
            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                unique_filename,
                ExtraArgs={"ContentType": file.content_type}
            )

            image_url = f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{unique_filename}"
            return image_url

        except Exception as e:
            print(f"❌ S3 Upload Error: {e}")
            raise e

s3_uploader = S3Uploader()