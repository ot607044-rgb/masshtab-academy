import httpx
import pytest
from fastapi import FastAPI
from app.core.employee_photos import PublicUploads


@pytest.mark.asyncio
async def test_private_photos_are_not_public_static_uploads(tmp_path):
    private = tmp_path / ".employee-photos" / "company" / "employee"
    private.mkdir(parents=True)
    (private / "photo.jpg").write_bytes(b"private")
    (tmp_path / "lesson.pdf").write_bytes(b"lesson")
    app = FastAPI()
    app.mount("/uploads", PublicUploads(directory=str(tmp_path)))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/uploads/lesson.pdf")).content == b"lesson"
        for path in [".employee-photos", "%2eemployee-photos"]:
            assert (await client.get(f"/uploads/{path}/company/employee/photo.jpg")).status_code == 404
