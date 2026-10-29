from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.schemas import UserCreate, UserOut, Token
from app.services.user_service import UserService
from app.core.security import create_access_token, get_current_active_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await UserService.authenticate(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuario inactivo")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=UserOut, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    if await UserService.get_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="Email ya registrado")
    if await UserService.get_by_username(db, data.username):
        raise HTTPException(status_code=400, detail="Username ya en uso")
    user = await UserService.create(db, data)
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def get_me(current_user=Depends(get_current_active_user)):
    return UserOut.model_validate(current_user)
