# 🔍 Retrieva — Intelligent Document Analysis & RAG Platform

> **Retrieve. Understand. Answer.**  
> A high-performance Retrieval-Augmented Generation (RAG) platform designed for multi-document intelligence, deep contextual synthesis, and verified source citations.

---

## 🌟 Overview

**Retrieva** is a modern document intelligence workspace that bridges the gap between unstructured documents and actionable insights. Built with a decoupled **FastAPI** backend and a sleek **React + Vite** frontend, Retrieva ingests multi-format documents (PDFs, text files, structured reports, resumes), creates high-dimensional vector embeddings, and enables conversational question answering grounded strictly in your document corpus.

Every generated answer is anchored to verified source documents, eliminating hallucinations and providing transparent file and page-level citations.

---

## ✨ Key Features

- **⚡ Multi-Document Corpus Ingestion:** Drag, drop, and index multiple documents simultaneously. Retrieva organizes files into a persistent corpus library.
- **🎯 Hallucination-Resistant Q&A:** Queries are processed through a strictly grounded RAG pipeline that prioritizes document context before synthesizing answers.
- **📌 Transparent Source Citations:** Inspect the exact origin of every answer with real-time badges indicating source filename and page numbers.
- **🧠 Multi-Turn Conversational Context:** Seamlessly follow up on previous questions with sliding-window conversation history tracking.
- **⚡ Ultra-Fast Inference via Groq:** Powered by state-of-the-art open models (such as `openai/gpt-oss-120b`) served through Groq for near-instant response generation.
- **💾 Local Vector Storage:** Employs FAISS (Facebook AI Similarity Search) with HuggingFace MiniLM embeddings for private, fast, and local vector retrieval.
- **📊 Exportable Analysis Reports:** Generate downloadable PDF reports summarizing conversation history and key insights via ReportLab.
- **🖥️ Modern React Interface:** Feature-rich SaaS workspace with corpus management, markdown rendering, and split-screen document Q&A.

---

## 🏗️ System Architecture

```
[ Documents (PDF / TXT) ]
           │
           ▼
[ PDFPlumber Loader & Chunker ] ── (RecursiveTextSplitter: 1000 chars, 200 overlap)
           │
           ▼
[ HuggingFace Embeddings ] ─────── (all-MiniLM-L6-v2)
           │
           ▼
[ FAISS Vector Database ] ──────── (Local Vector Store with File Metadata)
           │
           ├── Semantic Retrieval (k=8 Top Chunks)
           ▼
[ Grounded Prompt Template ] ──── (Document Context + Chat History + User Query)
           │
           ▼
[ Groq LLM Inference ] ────────── (GPT OSS 120B / Llama Models)
           │
           ▼
[ Grounded Response & Sources ] ── (Synthesized Answer + File & Page Citations)
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Markdown & Code Rendering:** [Marked](https://marked.js.org/) / `react-markdown`
- **Styling:** Custom Vanilla CSS Design System with corporate SaaS theme & responsive layouts

### Backend & AI Pipeline
- **API Framework:** [FastAPI](https://fastapi.tiangolo.com/) with CORS support and async file streaming
- **Server:** [Uvicorn](https://www.uvicorn.org/)
- **RAG Orchestration:** [LangChain](https://www.langchain.com/) (LangChain Core, LangChain Community)
- **LLM Provider:** [Groq](https://groq.com/) (`openai/gpt-oss-120b`)
- **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` via [HuggingFace](https://huggingface.co/)
- **Vector Database:** [FAISS (Facebook AI Similarity Search)](https://github.com/facebookresearch/faiss)
- **Document Parsing:** [pdfplumber](https://github.com/jsvine/pdfplumber)
- **PDF Report Generation:** [ReportLab](https://www.reportlab.com/)

---

## 📁 Project Structure

```plaintext
Retrieva/
├── api.py                    # FastAPI application (endpoints: /upload, /chat, /clear)
├── rag_pipeline.py           # LangChain RAG pipeline, prompt templates, and PDF reporting
├── vector_database.py        # PDF extraction, chunking, embeddings, and FAISS indexing
├── requirements.txt          # Python dependencies
├── .env                      # Environment configuration (Groq API Key)
├── pdfs/                     # Storage directory for ingested PDF documents
├── vectorstore/              # Persistent FAISS vector database indices
│   └── db_faiss/
└── frontend/                 # React + Vite web application
    ├── index.html            # Main HTML entry point
    ├── package.json          # Node dependencies and scripts
    ├── vite.config.js        # Vite configuration
    └── src/
        ├── App.jsx           # Main Retrieva dashboard and Q&A workspace
        ├── App.css           # Workspace and chat styling
        ├── index.css         # Global tokens, typography, and markdown styles
        └── main.jsx          # React DOM entry point
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Groq API Key:** Get a free key at [console.groq.com](https://console.groq.com/keys)

---

### Step 1: Clone and Configure Environment

1. Clone this repository and navigate into the project directory:
   ```bash
   cd Retrieva
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows:
   python -m venv venv
   venv\Scripts\activate

   # macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   pip install fastapi uvicorn python-multipart
   ```

4. Create a `.env` file in the `Retrieva/` root directory and add your Groq API key:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ```

---

### Step 2: Run the FastAPI Backend

Launch the backend API server with Uvicorn:

```bash
uvicorn api:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. You can test endpoints and view auto-generated documentation at `http://localhost:8000/docs`.

---

### Step 3: Run the React Frontend

In a new terminal window:

1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Request Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/upload` | Upload and vectorize one or more documents | `multipart/form-data` with `files` |
| `POST` | `/chat` | Submit a query with optional history and retrieve synthesis | Form data: `query` (str), `history` (str) |
| `POST` | `/clear` | Clear the current active session and vectorstore cache | None |

### Sample Response (`/chat`):
```json
{
  "response": "According to the uploaded technical specifications, the platform supports...",
  "sources": [
    {
      "file": "architecture_overview.pdf",
      "page": 3
    },
    {
      "file": "system_requirements.pdf",
      "page": 1
    }
  ]
}
```

---

## 🔒 Grounding & Accuracy

Retrieva is specifically tuned to:
- Enforce strict adherence to supplied document chunks.
- Extract structured project entries, technical skills, and detailed clauses without hallucinating absent information.
- Provide source attribution for transparent verification across large documents.

---

## 📄 License

This project is open-source and distributed under the [MIT License](LICENSE).
