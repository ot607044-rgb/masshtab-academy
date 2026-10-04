from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.access import AcceptInvitation, InvitationInfo
from app.models.base import utc_now
from app.models.company import Company
from app.models.user import User
from app.core.accounts import MIN_PASSWORD_LENGTH, active_invitation
from app.core.security import verify_password, create_access_token, get_password_hash
from app.api.deps import get_current_user
from app.schemas.user import UserResponse

router = APIRouter()
INVALID_INVITATION = "Ссылка приглашения недействительна или устарела. Попросите администратора отправить новую."


def token_response(user: User) -> TokenResponse:
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


async def ensure_can_sign_in(db: AsyncSession, user: User) -> None:
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Доступ к системе отключён. Обратитесь к администратору.")
    if user.company_id and not await db.scalar(select(Company.is_active).where(Company.id == user.company_id)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Компания отключена. Обратитесь к администратору.")


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(func.lower(User.email) == data.email.strip().lower()))

    if not user or user.activated_at is None or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    await ensure_can_sign_in(db, user)
    user.last_login_at = utc_now()
    await db.commit()
    return token_response(user)


@router.get("/invitations/{token}", response_model=InvitationInfo)
async def invitation_info(token: str, db: AsyncSession = Depends(get_db)):
    invitation = await active_invitation(db, token)
    user = await db.get(User, invitation.user_id) if invitation else None
    if not user or not user.is_active:
        raise HTTPException(404, INVALID_INVITATION)
    company_name = await db.scalar(select(Company.name).where(Company.id == user.company_id))
    return InvitationInfo(email=user.email, full_name=user.full_name, company_name=company_name, expires_at=invitation.expires_at)


@router.post("/invitations/{token}/accept", response_model=TokenResponse)
async def accept_invitation(token: str, data: AcceptInvitation, db: AsyncSession = Depends(get_db)):
    if len(data.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(422, f"Пароль должен быть не короче {MIN_PASSWORD_LENGTH} символов")
    invitation = await active_invitation(db, token)
    user = await db.get(User, invitation.user_id) if invitation else None
    if not user or not user.is_active:
        raise HTTPException(404, INVALID_INVITATION)
    await ensure_can_sign_in(db, user)
    now = utc_now()
    user.hashed_password = get_password_hash(data.password)
    user.activated_at = user.activated_at or now
    user.last_login_at = now
    invitation.used_at = now
    await db.commit()
    return token_response(user)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
