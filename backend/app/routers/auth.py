from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..db import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import AuthOut, Credentials, UserOut
from ..security import COOKIE_NAME, TOKEN_DAYS, create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue(user: User, response: Response, settings: Settings) -> AuthOut:
    token = create_token(user.id)
    response.set_cookie(COOKIE_NAME, token, max_age=TOKEN_DAYS * 86400, httponly=True,
                        samesite="lax", secure=settings.cookie_secure, path="/")
    return AuthOut(user=UserOut(id=user.id, email=user.email), token=token)


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(body: Credentials, response: Response, db: Session = Depends(get_db),
             settings: Settings = Depends(get_settings)):
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    return _issue(user, response, settings)


@router.post("/login", response_model=AuthOut)
def login(body: Credentials, response: Response, db: Session = Depends(get_db),
          settings: Settings = Depends(get_settings)):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password.")
    return _issue(user, response, settings)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email)
