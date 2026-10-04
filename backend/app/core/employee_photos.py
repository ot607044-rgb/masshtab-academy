from io import BytesIO
from pathlib import Path
import re

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.staticfiles import StaticFiles
from app.config import settings

MAX_PHOTO_BYTES = 5 * 1024 * 1024
PRIVATE_DIRECTORY = ".employee-photos"


def photo_path(employee, filename):
    if not re.fullmatch(r"[0-9a-f]{32}\.jpg", filename):
        raise ValueError("Invalid stored photo filename")
    return Path(settings.UPLOADS_DIR) / PRIVATE_DIRECTORY / str(employee.company_id) / str(employee.id) / filename


def normalize_photo(contents):
    try:
        with Image.open(BytesIO(contents), formats=["JPEG", "PNG", "WEBP"]) as image:
            if image.width * image.height > 20_000_000 or max(image.size) > 10000:
                raise HTTPException(400, "Слишком большое разрешение фотографии")
            image.load()
            normalized = ImageOps.exif_transpose(image)
            normalized.thumbnail((512, 512))
            # Re-encoding strips uploaded metadata and non-image payloads.
            rgb = normalized.convert("RGB")
            output = BytesIO()
            rgb.save(output, format="JPEG", quality=85)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise HTTPException(400, "Файл не является допустимым фото JPG, PNG или WEBP") from error


class PublicUploads(StaticFiles):
    """Public lesson files must never expose the private photo directory."""

    def lookup_path(self, path):
        full_path, stat_result = super().lookup_path(path)
        if full_path:
            private_root = (Path(self.directory) / PRIVATE_DIRECTORY).resolve()
            if Path(full_path).resolve().is_relative_to(private_root):
                return "", None
        return full_path, stat_result
