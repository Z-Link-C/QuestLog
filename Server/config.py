import os
from flask import Flask
from flask_bcrypt import Bcrypt
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate
from flask_restful import Api
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

app = Flask(__name__)
app.secret_key = b'Y\xf1Xz\x00\xad|eQ\x80t \xca\x1a\x10K'

DATABASE_URL = "postgresql://neondb_owner:npg_zSUME9sy3cba@ep-purple-butterfly-adsc9tuk-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Run: DATABASE_URL=postgresql://user:pass@localhost/questlog python app.py"
    )

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.json.compact = False

metadata = MetaData(naming_convention={
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
})
db = SQLAlchemy(metadata=metadata)

migrate = Migrate(app, db)
db.init_app(app)

bcrypt = Bcrypt(app)
ma = Marshmallow(app)

api = Api(app)