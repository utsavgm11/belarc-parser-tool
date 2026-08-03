import io
import zipfile
import pandas as pd
from typing import List

from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# Import rarfile safely for .rar support
try:
    import rarfile
    RAR_SUPPORT = True
except ImportError:
    RAR_SUPPORT = False
    print("⚠️ 'rarfile' module not found. Install using 'pip install rarfile' for .rar support.")

# Import our local files
from database import engine, get_db
import models
from parser import parse_html_content

# Create tables in Neon DB if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Belarc Parser API")

# Setup CORS so the React frontend can communicate with it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update to specific domains in production (e.g., your Vercel URL)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- RECURSIVE ARCHIVE EXTRACTOR WITH DIAGNOSTIC LOGGING ---
def extract_html_from_zip(zip_bytes: bytes, base_path: str = "") -> list:
    """
    Recursively extracts HTML files from a zip file (and rar files if supported). 
    Handles both Windows (\\) and Linux (/) path separators.
    Prints diagnostic logs for any skipped or corrupted files.
    """
    extracted_files = []
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            for file_info in z.infolist():
                # Normalize Windows path separators to forward slashes
                file_name = file_info.filename.replace('\\', '/')
                lower_name = file_name.lower()
                
                # Check for HTML extensions
                if lower_name.endswith(('.html', '.htm', '.mhtml', '.mht')):
                    try:
                        with z.open(file_info.filename) as f:
                            extracted_files.append((f"{base_path}{file_name}", f.read()))
                    except Exception as fe:
                        print(f"⚠️ Could not read HTML file '{file_name}': {fe}")
                
                # If it's a nested ZIP file, attempt to extract it recursively
                elif lower_name.endswith('.zip'):
                    try:
                        with z.open(file_info.filename) as f:
                            nested_zip_bytes = f.read()
                            nested_results = extract_html_from_zip(
                                nested_zip_bytes, 
                                base_path=f"{base_path}{file_name}/"
                            )
                            extracted_files.extend(nested_results)
                    except Exception as ze:
                        print(f"❌ FAILED to open nested ZIP '{file_name}'. Reason: {ze}")
                
                # If it's a nested RAR file, attempt to extract it
                elif lower_name.endswith('.rar') and RAR_SUPPORT:
                    try:
                        with z.open(file_info.filename) as f:
                            nested_rar_bytes = f.read()
                            with rarfile.RarFile(io.BytesIO(nested_rar_bytes)) as rf:
                                for r_info in rf.infolist():
                                    r_name = r_info.filename.replace('\\', '/')
                                    if r_name.lower().endswith(('.html', '.htm', '.mhtml', '.mht')):
                                        with rf.open(r_info.filename) as r_file:
                                            extracted_files.append((f"{base_path}{file_name}/{r_name}", r_file.read()))
                    except Exception as re_err:
                        print(f"❌ FAILED to open nested RAR '{file_name}'. Reason: {re_err}")

    except zipfile.BadZipFile:
        print(f"❌ Bad or corrupted ZIP file encountered at path: '{base_path}'")
    except Exception as e:
        print(f"❌ General extraction error at path '{base_path}': {e}")
        
    return extracted_files


# --- BACKGROUND WORKER ---
def process_zip_in_background(chat_id: str, zip_bytes: bytes):
    """Processes the zip file asynchronously to prevent API timeouts."""
    db = next(get_db())
    try:
        print("\n================ STARTING FILE EXTRACTION ================")
        html_files_data = extract_html_from_zip(zip_bytes)
        print(f"✅ Total HTML files extracted across all nested zips/folders: {len(html_files_data)}")
        print("=========================================================\n")
        
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if not chat:
            return

        chat.total_files = len(html_files_data)
        db.commit()

        records_batch = []
        parsed_count = 0

        for idx, (file_path, content) in enumerate(html_files_data):
            # UPDATE: We now keep the full folder/filename path for better context
            try:
                extracted_data = parse_html_content(content)
                records_batch.append(
                    models.ParsedRecord(
                        chat_id=chat_id,
                        file_name=file_path,
                        extracted_data=extracted_data
                    )
                )
                parsed_count += 1
            except Exception as parse_error:
                print(f"⚠️ HTML Parsing failed for file '{file_path}': {parse_error}")
                continue  # Skip unparseable files safely
            
            # Bulk insert every 100 records to keep memory low and fast
            if len(records_batch) >= 100:
                db.bulk_save_objects(records_batch)
                chat.processed_files = parsed_count
                db.commit()
                records_batch = []

        # Save any remaining records
        if records_batch:
            db.bulk_save_objects(records_batch)
            chat.processed_files = parsed_count
            
        chat.status = "completed"
        db.commit()
        print(f"🎉 Successfully completed processing {parsed_count} records for Chat ID: {chat_id}\n")

    except Exception as e:
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if chat:
            chat.status = "failed"
            db.commit()
        print(f"❌ Error in background task: {e}")
    finally:
        db.close()


# --- API ENDPOINTS ---

@app.post("/api/chats/upload")
async def upload_folder_zip(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...), 
    uploaded_by: str = Form("IT Team"),
    db: Session = Depends(get_db)
):
    """Receives the zip file from frontend and starts background processing."""
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files are allowed")

    chat_title = file.filename.replace('.zip', '')
    chat = models.Chat(title=chat_title, uploaded_by=uploaded_by)
    db.add(chat)
    db.commit()
    db.refresh(chat)

    zip_bytes = await file.read()
    background_tasks.add_task(process_zip_in_background, chat.id, zip_bytes)

    return {"chat_id": chat.id, "message": "Upload accepted and processing started"}


@app.get("/api/chats")
def list_chats(db: Session = Depends(get_db)):
    """Retrieves all chat sessions for the sidebar history."""
    chats = db.query(models.Chat).order_by(models.Chat.created_at.desc()).all()
    return chats


@app.get("/api/chats/{chat_id}/status")
def get_chat_status(chat_id: str, db: Session = Depends(get_db)):
    """Returns the current processing status of a chat."""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    preview = []
    if chat.processed_files > 0:
        records = db.query(models.ParsedRecord).filter(models.ParsedRecord.chat_id == chat_id).limit(10).all()
        preview = [r.extracted_data for r in records]

    return {
        "id": chat.id,
        "title": chat.title,
        "status": chat.status,
        "total_files": chat.total_files,
        "processed_files": chat.processed_files,
        "preview": preview
    }


@app.get("/api/chats/{chat_id}/data")
def get_all_chat_data(chat_id: str, db: Session = Depends(get_db)):
    """Returns all parsed records for a specific chat to view in the UI."""
    records = db.query(models.ParsedRecord).filter(models.ParsedRecord.chat_id == chat_id).all()
    if not records:
        raise HTTPException(status_code=404, detail="No data found")
    
    return [r.extracted_data for r in records]


@app.patch("/api/chats/{chat_id}")
def rename_chat(chat_id: str, title: str = Form(...), db: Session = Depends(get_db)):
    """Renames an existing chat/audit session."""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat.title = title
    db.commit()
    db.refresh(chat)
    return {"message": "Chat renamed successfully", "title": chat.title}


@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: str, db: Session = Depends(get_db)):
    """Deletes a chat session and all its parsed records."""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.query(models.ParsedRecord).filter(models.ParsedRecord.chat_id == chat_id).delete()
    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted successfully"}


@app.get("/api/chats/{chat_id}/export")
def export_chat_data(chat_id: str, format: str = "excel", db: Session = Depends(get_db)):
    """Exports parsed records as CSV or Excel, sorted correctly."""
    records = db.query(models.ParsedRecord).filter(models.ParsedRecord.chat_id == chat_id).all()
    if not records:
        raise HTTPException(status_code=404, detail="No data found for this chat")

    flattened_data = []
    for r in records:
        row = {"File Name": r.file_name}
        row.update(r.extracted_data or {})
        flattened_data.append(row)

    df = pd.DataFrame(flattened_data)

    # UPDATE: Sort DataFrame numerically by the trailing digits of Computer Name
    if "Computer Name" in df.columns:
        # Extract the trailing number for sorting, fill with -1 if missing, sort, then drop the temp column
        df['temp_sort_num'] = df['Computer Name'].str.extract(r'(\d+)$').fillna(-1).astype(int)
        df = df.sort_values(by=['temp_sort_num', 'Computer Name'], ascending=[True, True]).drop(columns=['temp_sort_num'])

    if format.lower() == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=belarc_export_{chat_id}.csv"}
        )
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Parsed Data")
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=belarc_export_{chat_id}.xlsx"}
        )