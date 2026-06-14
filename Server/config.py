import os
import re
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_restful import Api
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)

raw_db_url = os.getenv('DATABASE_URL')
if not raw_db_url:
    raise ValueError("DATABASE_URL environment variable is missing in .env")

# Force standard synchronous postgresql driver
sync_db_url = re.sub(r'^postgresql\+psycopg:', 'postgresql:', raw_db_url)
if not sync_db_url.startswith('postgresql:'):
    sync_db_url = sync_db_url.replace('postgres:', 'postgresql:', 1)

app.secret_key = os.getenv('SECRET_KEY', b'Y\xf1Xz\x00\xad|eQ\x80t \xca\x1a\x10K')
app.config['SQLALCHEMY_DATABASE_URI'] = sync_db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.json.compact = False

metadata = MetaData(naming_convention={
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
})

db = SQLAlchemy(metadata=metadata)
db.init_app(app)

migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
ma = Marshmallow(app)
api = Api(app)

cors_origins = [origin.strip() for origin in os.getenv('CORS_ORIGINS', 'http://localhost:5173,https://quest-log-ochre.vercel.app').split(',') if origin.strip()]
CORS(app, supports_credentials=True, origins=cors_origins)

if __name__ == "__main__":
    app.run(port=5555, debug=True)