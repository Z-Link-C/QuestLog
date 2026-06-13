import os

from config import app, db
from models import User

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    raise RuntimeError(
        "ADMIN_PASSWORD is not set. Run: ADMIN_PASSWORD=yourpassword python seed.py"
    )

with app.app_context():
    db.drop_all()
    db.create_all()

    admin = User(name="Admin", email="admin@questlog.com")
    admin.password = ADMIN_PASSWORD

    db.session.add(admin)
    db.session.commit()
    print(f"Admin seeded: {admin}")