# seed_users.py
import bcrypt
from database import engine, SessionLocal
import models

def hash_password(password: str) -> str:
    # Generate salt and hash the password using native bcrypt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def seed():
    print("🔄 Ensuring 'users' table schema is up to date...")
    # Drop old table if present (to migrate from username -> email cleanly) and recreate
    models.User.__table__.drop(bind=engine, checkfirst=True)
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        users_data = [
            models.User(
                email="rahul@aarviencon.com",
                password=hash_password("Aarvien@Rahul123"),
                full_name="Rahul k"
            ),
            models.User(
                email="support@aarviencon.com",
                password=hash_password("Aarvien@Support123"),
                full_name="Yogesh"
            ),
            models.User(
                email="it.mumbai@aarviencon.com",
                password=hash_password("Aarvien@Mumbai123"),
                full_name="Anmol"
            ),
            models.User(
                email="yug.kakawat@aarviencon.com",
                password=hash_password("Aarvien@Yug123"),
                full_name="Yug Kakawat"
            ),
        ]

        db.add_all(users_data)
        db.commit()
        print("🎉 Successfully seeded 4 users into Neon DB with bcrypt hashed passwords!")

    except Exception as e:
        db.rollback()
        print(f"❌ Failed to seed users: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()