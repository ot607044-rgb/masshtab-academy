"""Read-only authenticated smoke check; never emits tokens or user data."""
import asyncio
import json
from datetime import timedelta
from urllib.request import Request, urlopen
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine
from app.models.user import User
from app.models.employee import Employee
from app.core.security import create_access_token


async def main():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User).where(User.is_active.is_(True), User.company_id.is_not(None), User.role.in_(["company_admin", "hr"])).order_by(User.created_at))).scalars().all()
        if not users:
            raise RuntimeError("No active company HR/admin account for smoke check")
        checked = set()
        for user in users:
            if user.company_id in checked:
                continue
            checked.add(user.company_id)
            token = create_access_token({"sub": str(user.id)}, timedelta(minutes=2))
            paths = ["/auth/me", "/workspace/dashboard", "/recruitment/vacancies", "/recruitment/candidates", "/recruitment/interviews", "/positions/", "/departments/", "/employees/"]
            employee = (await db.execute(select(Employee.id).where(Employee.company_id == user.company_id).limit(1))).scalar_one_or_none()
            if employee:
                paths.append(f"/workspace/employees/{employee}")
            for path in paths:
                request = Request("http://127.0.0.1:8000/api/v1" + path, headers={"Authorization": "Bearer " + token})
                with urlopen(request, timeout=30) as response:
                    assert response.status == 200
                    json.load(response)
                print("PASS", path.split(str(employee))[0] if employee else path)
        print("Company scopes verified:", len(checked))
    await engine.dispose()


asyncio.run(main())
