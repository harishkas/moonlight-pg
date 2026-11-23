from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from pwdlib import PasswordHash
from .config import APP_SECRET

hasher = PasswordHash.recommended()
serializer = URLSafeTimedSerializer(APP_SECRET, salt="moonlight-pg-session")

def hash_password(password: str) -> str:
    return hasher.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return hasher.verify(password, hashed)

def make_session(user_id: int) -> str:
    return serializer.dumps({"user_id": user_id})

def read_session(token: str):
    try:
        return int(serializer.loads(token, max_age=43200)["user_id"])
    except (BadSignature, SignatureExpired, KeyError, ValueError, TypeError):
        return None
