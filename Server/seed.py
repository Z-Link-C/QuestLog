import os

from config import app, db
from models import User

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
ADMIN_NAME = os.environ.get("ADMIN_NAME")
if not ADMIN_PASSWORD:
    raise RuntimeError(
        "ADMIN_PASSWORD is not set. Run: ADMIN_PASSWORD=yourpassword python seed.py"
    )
if not ADMIN_NAME:
    raise RuntimeError(
        "ADMIN_NAME is not set. Run: ADMIN_NAME=yourname python seed.py"
    )

with app.app_context():
    db.create_all()

    admin = User(name="Admin", email="@admins.questlog.com")
    admin.password = ADMIN_PASSWORD
    admin.name = ADMIN_NAME
    admin.email=f'{ADMIN_NAME}@admins.questlog.com'
    db.session.add(admin)
    db.session.commit()
    print(f"Admin seeded: {admin}")