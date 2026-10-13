import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { 
  UploadCloud, Send, FileText, User, Zap, Layout, 
  Folder, BarChart2, MoreVertical, Search, Paperclip, Check, Sparkles, FileSearch, Trash2, Download
} from 'lucide-react';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')).replace(/\/$/, '');

function App() {
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace', 'document'
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    // Fetch currently stored documents on mount
    fetch(`${API_BASE}/documents`)
      .then(res => res.json())
      .then(data => {
        if (data.filenames && data.filenames.length > 0) {
          setUploadedFiles(data.filenames);
        }
      })
      .catch(() => {});
  }, []);

  const handleClearSession = async () => {
    if (!window.confirm("Are you sure you want to clear all loaded documents from the library?")) return;
    try {
      await fetch(`${API_BASE}/clear`, { method: 'POST' });
      setUploadedFiles([]);
      setMessages([]);
      setActiveTab('workspace');
    } catch (err) {
      console.error('Failed to clear library:', err);
    }
  };

  const handleDeleteFile = async (e, filename) => {
    e.stopPropagation();
    try {
      const formData = new URLSearchParams();
      formData.append('filename', filename);
      const res = await fetch(`${API_BASE}/delete-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      const data = await res.json();
      setUploadedFiles(data.filenames || []);
      if (!data.filenames || data.filenames.length === 0) {
        setActiveTab('workspace');
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleExportReport = async () => {
    const qaMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
    if (!qaMessages.length) {
      alert("No questions and answers yet. Ask a question first to generate an analysis report.");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE}/export-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: qaMessages }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.detail || "Failed to generate report.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Retrieva_Analysis_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export report:', error);
      alert('Error exporting PDF report. Ensure backend is running.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch(`${API_BASE}/upload`, {
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

      const response = await fetch(`${API_BASE}/chat`, {
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '0.75rem' }}>
              <div className="sidebar-title">DOCUMENTS REPO</div>
              {uploadedFiles.length > 0 && (
                <button
                  title="Clear all documents"
                  onClick={handleClearSession}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none'; }}
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
            <div className="sidebar-item active">
              <Folder size={16} />
              Corpus Library ({uploadedFiles.length})
            </div>
            {uploadedFiles.map((file, idx) => (
              <div 
                key={idx} 
                className="sidebar-item" 
                style={{ 
                  paddingLeft: '2rem', 
                  paddingRight: '0.75rem',
                  fontSize: '0.8rem', 
                  opacity: 0.9, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                  <FileText size={14} style={{ flexShrink: 0 }} />
                  <span title={file} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.length > 18 ? file.substring(0, 18) + '...' : file}
                  </span>
                </div>
                <button
                  title={`Delete ${file}`}
                  onClick={(e) => handleDeleteFile(e, file)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '3px',
                    borderRadius: '4px',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                >
                  <Trash2 size={13} />
                </button>
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
            <div className="chat-panel">
              <div className="chat-header">
                <div className="chat-title">
                  <Zap size={18} color="#0052cc" />
                  <span>Ask Retrieva</span>
                  {uploadedFiles.length > 0 && (
                    <span 
                      style={{
                        marginLeft: '0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: '#0052cc',
                        background: '#eef2ff',
                        padding: '0.2rem 0.65rem',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        border: '1px solid #dbeafe'
                      }}
                    >
                      <FileText size={12} />
                      {uploadedFiles.length === 1 ? uploadedFiles[0] : `${uploadedFiles.length} documents active`}
                    </span>
                  )}
                </div>
                <button
                  className="btn-export-report"
                  onClick={handleExportReport}
                  disabled={isExporting}
                  title="Export full Q&A conversation as a PDF Report"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    color: '#0052cc',
                    background: '#f0f5ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    cursor: isExporting ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f0f5ff'; }}
                >
                  <Download size={14} />
                  {isExporting ? 'Generating PDF...' : 'Export PDF Report'}
                </button>
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
          )}

        </main>
      </div>
    </div>
  );
}

export default App;
