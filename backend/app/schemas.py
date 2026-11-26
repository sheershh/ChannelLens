from pydantic import BaseModel, EmailStr, Field, field_validator


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def lower(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password is too long (bcrypt limit is 72 bytes).")
        return v


class UserOut(BaseModel):
    id: int
    email: str


class AuthOut(BaseModel):
    user: UserOut
    token: str


class WatchlistAdd(BaseModel):
    channel_id: str = Field(pattern=r"^UC[\w-]{22}$")
