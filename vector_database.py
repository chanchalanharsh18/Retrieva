from langchain_community.document_loaders import PDFPlumberLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
import os

# Step 1: Load raw PDF(s)

pdfs_directory = 'pdfs/'  # Folder to store PDFs

def load_pdf(file_path):
    loader = PDFPlumberLoader(file_path)
    documents = loader.load()
    return documents

# Step 2: Create Chunks
def create_chunks(documents, file_name):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        add_start_index=True
    )
    text_chunks = text_splitter.split_documents(documents)
    
    # Add metadata (file name) to each chunk
    for chunk in text_chunks:
        chunk.metadata["source"] = file_name
    
    return text_chunks

# Step 3: Setup Embeddings Model
def get_embedding_model():
    embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    return embedding_model

embedding_model = get_embedding_model()

# Step 4: Index Documents with Metadata
FAISS_DB_PATH = "vectorstore/db_faiss"

def index_pdf(file_path):
    documents = load_pdf(file_path)
    file_name = file_path.replace("\\", "/").split("/")[-1]  # Extract filename safely
    text_chunks = create_chunks(documents, file_name)
    faiss_db = FAISS.from_documents(text_chunks, embedding_model)
    faiss_db.save_local(FAISS_DB_PATH)
    return faiss_db

def index_multiple_pdfs(file_paths):
    all_chunks = []
    for file_path in file_paths:
        documents = load_pdf(file_path)
        file_name = file_path.replace("\\", "/").split("/")[-1]
        text_chunks = create_chunks(documents, file_name)
        all_chunks.extend(text_chunks)
    
    if all_chunks:
        if os.path.exists(os.path.join(FAISS_DB_PATH, "index.faiss")):
            faiss_db = FAISS.load_local(FAISS_DB_PATH, embedding_model, allow_dangerous_deserialization=True)
            faiss_db.add_documents(all_chunks)
        else:
            faiss_db = FAISS.from_documents(all_chunks, embedding_model)
            
        faiss_db.save_local(FAISS_DB_PATH)
        return faiss_db
    return None

# Step 5: Retrieve Docs with Filtering
def retrieve_docs(query, file_names=None):
    faiss_db = FAISS.load_local(FAISS_DB_PATH, embedding_model, allow_dangerous_deserialization=True)
    # Increased k to 8 to pull in more of the document, especially for short docs like resumes
    retrieved_docs = faiss_db.similarity_search(query, k=8)
    
    if file_names:
        # Check if the document's source is in the list of uploaded filenames
        filtered_docs = [doc for doc in retrieved_docs if doc.metadata.get("source") in file_names]
    else:
        filtered_docs = retrieved_docs

    return filtered_docs
