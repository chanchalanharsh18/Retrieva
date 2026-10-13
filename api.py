from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import asyncio

from vector_database import index_multiple_pdfs
from rag_pipeline import answer_query, retrieve_docs, llm_model, generate_report

app = FastAPI(title="Retrieva API")

# Enable CORS so the React frontend can communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "service": "Retrieva API", "online": True}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Initialize filenames from pdfs folder if present (ignores .gitkeep/dotfiles)
active_session_files = []
if os.path.exists("pdfs"):
    active_session_files = [f for f in os.listdir("pdfs") if os.path.isfile(os.path.join("pdfs", f)) and not f.startswith(".")]

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    global active_session_files
    new_files = []
    
    try:
        for file in files:
            if not os.path.exists("pdfs"):
                os.makedirs("pdfs")
            file_path = os.path.join("pdfs", file.filename)
            
            with open(file_path, "wb") as f:
                f.write(await file.read())
            
            if file.filename not in active_session_files:
                active_session_files.append(file.filename)
            new_files.append(file_path)
                
        # Index all newly uploaded PDFs in background worker thread to prevent event loop blocking
        if new_files:
            await asyncio.to_thread(index_multiple_pdfs, new_files)
        
        return {"message": f"Successfully indexed {len(new_files)} document(s)", "filenames": active_session_files}
    except Exception as e:
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to process and index documents: {str(e)}")

@app.post("/chat")
async def chat_endpoint(query: str = Form(...), history: str = Form("")):
    try:
        global active_session_files
        
        if active_session_files:
            retrieved_docs = await asyncio.to_thread(retrieve_docs, query, active_session_files)
        else:
            retrieved_docs = []
            
        response = await asyncio.to_thread(answer_query, retrieved_docs, llm_model, query, history)
        
        sources_list = []
        if retrieved_docs:
            seen = set()
            for doc in retrieved_docs:
                src = doc.metadata.get("source", "Unknown")
                page = doc.metadata.get("page", 0) + 1
                identifier = f"{src}_page_{page}"
                if identifier not in seen:
                    seen.add(identifier)
                    sources_list.append({"file": src, "page": page})
        
        return {"response": response, "sources": sources_list}
    except Exception as e:
        return {"response": f"**Server Error:** {str(e)}", "sources": []}

@app.get("/documents")
async def get_documents():
    global active_session_files
    if os.path.exists("pdfs"):
        active_session_files = [f for f in os.listdir("pdfs") if os.path.isfile(os.path.join("pdfs", f)) and not f.startswith(".")]
    else:
        active_session_files = []
    return {"filenames": active_session_files}

@app.post("/clear")
async def clear_session():
    global active_session_files
    active_session_files = []
    
    # clear the faiss db
    import shutil
    if os.path.exists("vectorstore/db_faiss"):
        shutil.rmtree("vectorstore/db_faiss")
        
    if os.path.exists("pdfs"):
        for f in os.listdir("pdfs"):
            if not f.startswith("."):
                try:
                    os.remove(os.path.join("pdfs", f))
                except Exception:
                    pass
        
    return {"message": "Session cleared", "filenames": []}

@app.post("/delete-document")
async def delete_document(filename: str = Form(...)):
    global active_session_files
    file_path = os.path.join("pdfs", filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
    active_session_files = [f for f in active_session_files if f != filename]
    
    # Re-index remaining files if any, or clear FAISS
    import shutil
    from vector_database import FAISS_DB_PATH
    remaining_paths = [os.path.join("pdfs", f) for f in active_session_files]
    if os.path.exists(FAISS_DB_PATH):
        try:
            shutil.rmtree(FAISS_DB_PATH)
        except Exception:
            pass
    if remaining_paths:
        await asyncio.to_thread(index_multiple_pdfs, remaining_paths)
        
    return {"message": f"Deleted {filename}", "filenames": active_session_files}

class ChatMessage(BaseModel):
    role: str
    content: str

class ExportReportRequest(BaseModel):
    messages: List[ChatMessage]

@app.post("/export-report")
async def export_report(request: ExportReportRequest):
    global active_session_files
    user_queries = []
    ai_responses = []
    
    current_q = None
    for msg in request.messages:
        if msg.role == "user":
            current_q = msg.content
        elif msg.role == "assistant" and current_q:
            user_queries.append(current_q)
            ai_responses.append(msg.content)
            current_q = None
            
    if not user_queries:
        raise HTTPException(status_code=400, detail="No Q&A pairs available to generate report. Ask questions first.")
        
    pdf_path = generate_report(user_queries, ai_responses, active_files=active_session_files)
    
    return FileResponse(
        path=pdf_path,
        filename="Retrieva_Analysis_Report.pdf",
        media_type="application/pdf"
    )

# Mount static frontend build if present (enables all-in-one single server deployment)
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")




