import time
import uuid
from collections import defaultdict
from threading import Lock

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.documents import ensure_bucket, get_public_s3_client, get_s3_client
from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, UserRole
from app.schemas import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserBrief,
    UserCreate,
    UserResponse,
    UserUpdate,
)

AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
AVATAR_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

router = APIRouter(prefix="/auth", tags=["auth"])

_login_attempts: dict[str, list[float]] = defaultdict(list)
_login_lock = Lock()
_MAX_ATTEMPTS = 10
_WINDOW_SECONDS = 60


def _check_login_rate(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    with _login_lock:
        _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _WINDOW_SECONDS]
        if len(_login_attempts[ip]) >= _MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail="Too many login attempts, please wait.")
        _login_attempts[ip].append(now)


@router.post("/login", response_model=TokenResponse)
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    _check_login_rate(request)
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password) or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login/json", response_model=TokenResponse)
def login_json(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    _check_login_rate(request)
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password) or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first() if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    token_data = {"sub": str(user.id), "role": user.role.value}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/users", response_model=UserResponse)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=body.username,
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.MANAGEMENT)),
):
    return db.query(User).order_by(User.full_name).all()


@router.get("/users/directory", response_model=list[UserBrief])
def users_directory(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(User).filter(User.is_active.is_(True)).order_by(User.full_name).all()


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    user = db.query(User).get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = body.model_dump(exclude_unset=True)
    if "password" in updates:
        password = updates.pop("password")
        if password:
            user.hashed_password = hash_password(password)
    for field, value in updates.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def _can_manage_avatar(user: User, target_id: int) -> bool:
    return user.role == UserRole.ADMIN or user.id == target_id


@router.post("/users/{user_id}/avatar", response_model=UserResponse)
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _can_manage_avatar(user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    target = db.query(User).get(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in AVATAR_ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {ext}")
    content = await file.read()
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")

    ensure_bucket()
    client = get_s3_client()
    old_key = target.avatar_key
    key = f"avatars/{user_id}/{uuid.uuid4()}{ext}"
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=content,
        ContentType=file.content_type or "application/octet-stream",
    )
    target.avatar_key = key
    db.commit()
    db.refresh(target)
    if old_key:
        try:
            client.delete_object(Bucket=settings.s3_bucket, Key=old_key)
        except Exception:
            pass
    return target


@router.get("/users/{user_id}/avatar-url")
def get_avatar_url(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    target = db.query(User).get(user_id)
    if not target or not target.avatar_key:
        raise HTTPException(status_code=404, detail="No avatar")
    client = get_public_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": target.avatar_key},
        ExpiresIn=3600,
    )
    return {"url": url}


@router.delete("/users/{user_id}/avatar", response_model=UserResponse)
def delete_avatar(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not _can_manage_avatar(user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    target = db.query(User).get(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.avatar_key:
        client = get_s3_client()
        try:
            client.delete_object(Bucket=settings.s3_bucket, Key=target.avatar_key)
        except Exception:
            pass
        target.avatar_key = None
        db.commit()
        db.refresh(target)
    return target
