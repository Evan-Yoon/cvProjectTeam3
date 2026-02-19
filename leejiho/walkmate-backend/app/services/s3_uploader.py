import boto3
import uuid
from fastapi import UploadFile
from app.core.config import settings

import logging
logger = logging.getLogger("API_LOGGER")

class S3Uploader:
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        self.bucket_name = settings.AWS_BUCKET_NAME

    async def upload_image(self, file: UploadFile) -> str:
        try:
            file_extension = file.filename.split(".")[-1]
            unique_filename = f"{uuid.uuid4()}.{file_extension}"

            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                unique_filename,
                ExtraArgs={"ContentType": file.content_type}
            )

            image_url = f"https://{self.bucket_name}.s3.{settings.AWS_REGION}.amazonaws.com/{unique_filename}"
            return image_url

        except Exception as e:
            logger.error(f"❌ S3 Upload Error: {e}", exc_info=True)
            raise e

s3_uploader = S3Uploader()