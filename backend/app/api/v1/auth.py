from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.models.user import User
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user
from app.schemas.user import UserResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == data.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "company_id": str(user.company_id) if user.company_id else None,
    })
    return TokenResponse(
        access_token=token,
        role=user.role,
        company_id=str(user.company_id) if user.company_id else None,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
