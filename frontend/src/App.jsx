import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { 
  UploadCloud, Send, FileText, User, Zap, Layout, 
  Folder, BarChart2, MoreVertical, Search, Paperclip, Check, Sparkles, FileSearch
} from 'lucide-react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace', 'document'
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setUploadedFiles(data.filenames || []);
      setActiveTab('document'); // Switch to document view
      setMessages([{ 
        role: 'system', 
        content: `Successfully vectorized and indexed ${files.length} document(s). Ready for Q&A.` 
      }]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Is the backend running?');
    } finally {
      setIsUploading(false);
      event.target.value = null;
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userQuery = inputValue.trim();
    setInputValue('');
    
    const newMessages = [...messages, { role: 'user', content: userQuery }];
    setMessages(newMessages);
    setIsTyping(true);

    const history = newMessages
      .filter(m => m.role !== 'system')
      .slice(-5)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    try {
      const formData = new URLSearchParams();
      formData.append('query', userQuery);
      formData.append('history', history);

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data?.response || "Empty response from server.", sources: data?.sources || [] }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection Error: FastAPI backend not reachable.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="nav-left">
          <div className="brand">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSearch size={28} color="#0052cc" strokeWidth={2.5} />
            </div>
            <div className="brand-text">
              <h1>Retrieva</h1>
              <p>Retrieve. Understand. Answer.</p>
            </div>
          </div>
          <nav className="nav-links">
            <div className={`nav-link ${activeTab === 'workspace' ? 'active' : ''}`} onClick={() => setActiveTab('workspace')}>Workspace</div>
            <div className={`nav-link ${activeTab === 'document' ? 'active' : ''}`} onClick={() => setActiveTab('document')}>Document & Q&A</div>
          </nav>
        </div>
        <div className="nav-right">
          <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={16} />
            Upload Document
          </button>
          <input 
            type="file" 
            multiple 
            accept=".pdf,.txt" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
          />
          <div className="user-avatar">
            <User size={16} />
          </div>
        </div>
      </header>

      <div className="main-body">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title">DOCUMENTS REPO</div>
            <div className="sidebar-item active">
              <Folder size={16} />
              Corpus Library
            </div>
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="sidebar-item" style={{ paddingLeft: '2.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                <FileText size={14} />
                {file.length > 20 ? file.substring(0, 20) + '...' : file}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <span>Index Status</span>
            <div className="status-indicator">
              <span style={{ color: '#10b981', fontWeight: 600 }}>Online</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="content-area">
          
          {activeTab === 'workspace' && (
            <div className="workspace-empty">
              <div style={{ color: '#0052cc', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1px', marginBottom: '1rem' }}>
                WORKSPACE ENGINE • DOCUMENT PIPELINE
              </div>
              <h2 style={{ fontSize: '2rem', color: '#111827', marginBottom: '0.5rem' }}>Your Document</h2>
              <p style={{ color: '#6b7280', marginBottom: '2rem' }}>Upload a PDF or text file to start asking questions and retrieving answers.</p>
              
              <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={48} />
                <h3>Upload a document</h3>
                <p>Drag and drop your file here or browse</p>
                <div style={{ marginTop: '1.5rem', background: '#f1f5f9', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  Supported formats: PDF / TXT (Max 25MB)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'document' && (
            <>
              {/* Document Panel */}
              <div className="document-panel">
                <div className="panel-header">
                  <div className="file-info">
                    <div className="file-icon-box">
                      <FileText size={18} />
                    </div>
                    <div className="file-details">
                      <h3>{uploadedFiles.length > 0 ? (uploadedFiles.length === 1 ? uploadedFiles[0] : `${uploadedFiles.length} documents loaded`) : 'No document loaded'}</h3>
                      {uploadedFiles.length > 0 && (
                        <div className="file-meta">
                          <span>PDF</span> • <span style={{ color: '#0052cc' }}>Vectorized</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="panel-actions">
                    {/* Placeholder for future features */}
                  </div>
                </div>
                <div className="document-content">
                  {uploadedFiles.length > 0 ? (
                    <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '4rem' }}>
                      <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p>Document content is indexed in the vector database.</p>
                      <p style={{ fontSize: '0.8rem' }}>RAG Pipeline is active. You can now ask questions about this document.</p>
                    </div>
                  ) : (
                    <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '4rem' }}>
                      <p>No document selected for preview.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Panel */}
              <div className="chat-panel">
                <div className="chat-header">
                  <div className="chat-title">
                    <Zap size={18} color="#0052cc" />
                    Ask Retrieva
                  </div>
                  <div className="chunk-badge">
                    k=4 chunks
                  </div>
                </div>

                <div className="chat-messages">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`message-wrapper ${msg.role}`}>
                      {msg.role === 'user' ? (
                        <div className="message-bubble">{msg.content}</div>
                      ) : msg.role === 'system' ? (
                        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', margin: '1rem 0' }}>{msg.content}</div>
                      ) : (
                        <div className="message-bubble">
                          <div className="ai-header">
                            <Zap size={16} color="#0052cc" />
                            Synthesis
                          </div>
                          <div 
                            className="markdown-body" 
                            dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || "") }} 
                          />
                          {msg.sources && msg.sources.length > 0 && (
                            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Paperclip size={12} />
                                SOURCES ({msg.sources.length})
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {msg.sources.map((src, i) => (
                                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <FileText size={12} color="var(--accent-primary)" />
                                    {src.file} - Page {src.page}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="message-wrapper ai">
                      <div className="message-bubble">
                        <div className="ai-header">
                          <Zap size={16} color="#0052cc" />
                          Synthesis
                        </div>
                        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Analyzing document embeddings...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-container">
                  <form className="input-wrapper" onSubmit={handleSendMessage}>
                    <Paperclip size={18} color="#9ca3af" style={{ marginRight: '0.5rem' }} />
                    <input 
                      type="text" 
                      placeholder="Ask a question about this document..." 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={isUploading || isTyping}
                    />
                    <button type="submit" className="send-action" disabled={!inputValue.trim() || isUploading || isTyping}>
                      Send <Send size={14} />
                    </button>
                  </form>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                    <Check size={12} color="#10b981" />
                    Answers are strictly grounded in {uploadedFiles.length > 0 ? (uploadedFiles.length === 1 ? uploadedFiles[0] : 'your documents') : 'your document'}
                  </div>
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
