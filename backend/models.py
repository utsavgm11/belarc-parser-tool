import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, func
from database import Base

class Chat(Base):
    """
    Represents an audit upload session ('Chat' in the UI).
    Stores overall status and progress for background folder processing.
    """
    __tablename__ = "chats"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    status = Column(String, default="processing")  # 'processing', 'completed', 'failed'
    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    uploaded_by = Column(String, default="IT Team")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ParsedRecord(Base):
    """
    Represents an individual computer record extracted from a Belarc HTML report.
    `extracted_data` stores all 11 extracted fields as a JSON object.
    """
    __tablename__ = "parsed_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id = Column(String, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String, nullable=False)
    extracted_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())