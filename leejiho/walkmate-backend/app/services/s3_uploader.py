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

    def upload_image(self, file: UploadFile) -> str:
        try:
            # 고유한 파일명 생성 (uuid 사용)
            file_extension = file.filename.split(".")[-1]
            unique_filename = f"{uuid.uuid4()}.{file_extension}"

            # S3 업로드
            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                unique_filename,
                ExtraArgs={"ContentType": file.content_type}
            )

            # 업로드된 이미지 URL 반환
            image_url = f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{unique_filename}"
            return image_url

        except Exception as e:
            print(f"❌ S3 Upload Error: {e}")
            raise e

# 인스턴스 생성
s3_uploader = S3Uploader()