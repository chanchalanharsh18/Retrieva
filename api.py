from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

from vector_database import index_multiple_pdfs
from rag_pipeline import answer_query, retrieve_docs, llm_model

app = FastAPI()

# Enable CORS so the React frontend can communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store filenames in memory for the active session
active_session_files = []

@app.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    global active_session_files
    new_files = []
    
    for file in files:
        file_path = os.path.join("pdfs", file.filename)
        if not os.path.exists("pdfs"):
            os.makedirs("pdfs")
        
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        if file.filename not in active_session_files:
            active_session_files.append(file.filename)
            new_files.append(file_path)
            
    # Index all newly uploaded PDFs
    if new_files:
        index_multiple_pdfs(new_files)
    
    return {"message": f"Successfully indexed {len(new_files)} document(s)", "filenames": active_session_files}

@app.post("/chat")
async def chat_endpoint(query: str = Form(...), history: str = Form("")):
    try:
        global active_session_files
        
        if active_session_files:
            retrieved_docs = retrieve_docs(query, active_session_files)
        else:
            retrieved_docs = []
            
        response = answer_query(documents=retrieved_docs, model=llm_model, query=query, history=history)
        
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

@app.post("/clear")
async def clear_session():
    global active_session_files
    active_session_files = []
    
    # clear the faiss db
    import shutil
    if os.path.exists("vectorstore/db_faiss"):
        shutil.rmtree("vectorstore/db_faiss")
        
    return {"message": "Session cleared"}
