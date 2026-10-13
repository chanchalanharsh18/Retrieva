from langchain_community.document_loaders import PDFPlumberLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
import os
import uuid

# Restrict thread pools to keep memory minimal on low-RAM free tiers (Render 512MB)
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# Step 1: Load raw PDF(s)

pdfs_directory = 'pdfs/'  # Folder to store PDFs

def load_pdf(file_path):
    try:
        loader = PDFPlumberLoader(file_path, text_kwargs={"x_tolerance": 1.5})
        documents = loader.load()
        return documents
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return []

# Step 2: Create Chunks
def create_chunks(documents, file_name):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=300,
        add_start_index=True
    )
    text_chunks = text_splitter.split_documents(documents)
    
    # Add metadata (file name) and unique ID to each chunk
    valid_chunks = []
    for chunk in text_chunks:
        if chunk.page_content and chunk.page_content.strip():
            chunk.metadata["source"] = file_name
            chunk.id = str(uuid.uuid4())
            valid_chunks.append(chunk)
    
    return valid_chunks

# Step 3: Setup Embeddings Model (Lazy Loaded to prevent memory spikes on boot)
_embedding_model_instance = None

def get_embedding_model():
    global _embedding_model_instance
    if _embedding_model_instance is None:
        try:
            import torch
            torch.set_num_threads(1)
        except Exception:
            pass
        _embedding_model_instance = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"}
        )
    return _embedding_model_instance

class _LazyEmbeddingModelProxy:
    def __getattr__(self, name):
        return getattr(get_embedding_model(), name)
    def __call__(self, *args, **kwargs):
        return get_embedding_model()(*args, **kwargs)

embedding_model = _LazyEmbeddingModelProxy()

# Step 4: Index Documents with Metadata
FAISS_DB_PATH = "vectorstore/db_faiss"

def index_pdf(file_path):
    return index_multiple_pdfs([file_path])

def index_multiple_pdfs(file_paths):
    all_chunks = []
    incoming_filenames = [fp.replace("\\", "/").split("/")[-1] for fp in file_paths]
    
    for file_path in file_paths:
        documents = load_pdf(file_path)
        file_name = file_path.replace("\\", "/").split("/")[-1]
        text_chunks = create_chunks(documents, file_name)
        all_chunks.extend(text_chunks)
    
    if all_chunks:
        # Load existing chunks if any, replacing chunks from the same file to prevent duplicates
        existing_docs = []
        if os.path.exists(os.path.join(FAISS_DB_PATH, "index.faiss")):
            try:
                faiss_db = FAISS.load_local(FAISS_DB_PATH, embedding_model, allow_dangerous_deserialization=True)
                for doc_id, doc in faiss_db.docstore._dict.items():
                    if doc.metadata.get("source") not in incoming_filenames:
                        existing_docs.append(doc)
            except Exception as e:
                print(f"Warning loading existing FAISS database: {e}")
                existing_docs = []
        
        combined_chunks = existing_docs + all_chunks
        # Ensure every document has a clean, unique ID so FAISS never encounters duplicate or None IDs
        chunk_ids = [str(uuid.uuid4()) for _ in combined_chunks]
        for doc, cid in zip(combined_chunks, chunk_ids):
            doc.id = cid

        faiss_db = FAISS.from_documents(combined_chunks, embedding_model, ids=chunk_ids)
        faiss_db.save_local(FAISS_DB_PATH)
        return faiss_db
    return None

# Step 5: Retrieve Docs with Smart Context & Filtering
def retrieve_docs(query, file_names=None):
    if not os.path.exists(os.path.join(FAISS_DB_PATH, "index.faiss")):
        return []
        
    faiss_db = FAISS.load_local(FAISS_DB_PATH, embedding_model, allow_dangerous_deserialization=True)
    
    # 1. Filter docstore to active session files
    total_docs = list(faiss_db.docstore._dict.values())
    if file_names:
        active_docs = [d for d in total_docs if d.metadata.get("source") in file_names]
    else:
        active_docs = total_docs

    # 2. Adaptive Retrieval:
    # If the active documents are small (e.g. <= 14 chunks, ~3-4 pages like a resume or short document),
    # return all active chunks in sequential document order.
    # This guarantees 100% recall for broad queries (projects, education, skills, summary)
    # without cutting off sections due to embedding distance variations.
    if len(active_docs) <= 14 and len(active_docs) > 0:
        sorted_docs = sorted(
            active_docs, 
            key=lambda d: (
                str(d.metadata.get("source", "")), 
                int(d.metadata.get("page", 0)), 
                int(d.metadata.get("start_index", 0))
            )
        )
        return sorted_docs

    # 3. For larger multi-page documents, perform similarity search with deduplication
    retrieved_docs = faiss_db.similarity_search(query, k=15)
    filtered_docs = []
    seen_content = set()
    
    for doc in retrieved_docs:
        if file_names and doc.metadata.get("source") not in file_names:
            continue
        # Deduplicate identical or overlapping chunks
        snippet = doc.page_content.strip()[:150]
        if snippet in seen_content:
            continue
        seen_content.add(snippet)
        filtered_docs.append(doc)
        if len(filtered_docs) >= 8:
            break

    return filtered_docs

