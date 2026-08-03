import { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import FolderUploader from './components/FolderUploader';
import ProcessingProgress from './components/ProcessingProgress';
import DataPreviewTable from './components/DataPreviewTable';
import { LogOut, UserCircle } from 'lucide-react';

const API_URL = 'http://127.0.0.1:8000';

export default function App() {
  // 1. Initialize user state directly from localStorage (Fixes ESLint warning #1)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('belarc_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (err) {
        console.error("Failed to parse saved user session:", err);
        localStorage.removeItem('belarc_user');
      }
    }
    return null;
  });

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [currentView, setCurrentView] = useState('upload'); // 'upload', 'processing', 'results'
  const [activeChatData, setActiveChatData] = useState([]);

  // Fetch chat history for the sidebar
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/chats`);
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch chats:", err);
    }
  }, []);

  // 2. Fetch chats asynchronously on mount/user change (Fixes ESLint warning #2)
  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chats`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setChats(data);
        }
      } catch (err) {
        console.error("Failed to fetch chats:", err);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('belarc_user');
    setUser(null);
    setActiveChatId(null);
    setCurrentView('upload');
    setActiveChatData([]);
  };

  // Handlers for navigation and chat management
  const handleNewUploadClick = () => {
    setActiveChatId(null);
    setCurrentView('upload');
    setActiveChatData([]);
  };

  const handleUploadSuccess = (chatId) => {
    setActiveChatId(chatId);
    setCurrentView('processing');
    fetchChats(); // Refresh sidebar to show the new chat
  };

  const handleProcessingComplete = (previewRecords) => {
    setActiveChatData(previewRecords || []);
    setCurrentView('results');
    fetchChats(); // Refresh sidebar to update the file count
  };

  const handleSelectChat = async (chatId) => {
    setActiveChatId(chatId);
    try {
      const res = await fetch(`${API_URL}/api/chats/${chatId}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'processing') {
          setCurrentView('processing');
        } else {
          setActiveChatData(data.preview || []);
          setCurrentView('results');
        }
      }
    } catch (err) {
      console.error("Failed to load chat details:", err);
    }
  };

  // Handler for renaming a chat session
  const handleRenameChat = async (chatId, newTitle) => {
    try {
      const formData = new FormData();
      formData.append('title', newTitle);

      const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (res.ok) {
        fetchChats(); // Refresh sidebar to show updated title
      }
    } catch (err) {
      console.error("Failed to rename chat:", err);
    }
  };

  // Handler for deleting a chat session
  const handleDeleteChat = async (chatId) => {
    try {
      const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        if (activeChatId === chatId) {
          handleNewUploadClick();
        }
        fetchChats(); // Refresh sidebar list
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  // Get active chat title for the table header
  const activeChatTitle = chats.find(c => c.id === activeChatId)?.title || '';

  // 1. Render Login screen if user is not authenticated
  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  // 2. Render Main Application Layout once authenticated
  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar 
        chats={chats} 
        activeChatId={activeChatId} 
        onSelectChat={handleSelectChat} 
        onNewUpload={handleNewUploadClick} 
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#0B1120] relative min-w-0">
        {/* Top Navbar area */}
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 bg-slate-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-slate-200 tracking-wide">Belarc Data Extraction Tool</h1>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">
              Aarviencon Internal
            </span>
          </div>

          {/* User Status & Logout */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <UserCircle className="w-4 h-4 text-blue-400" />
              <span className="text-slate-300">
                <strong className="text-white font-medium">{user.full_name}</strong>{' '}
                <span className="text-slate-500">({user.email})</span>
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </header>

        {/* Dynamic Content View */}
        <div className="flex-1 p-6 flex flex-col min-w-0 min-h-0">
          {currentView === 'upload' && (
            <div className="flex-1 flex items-center justify-center">
              <FolderUploader 
                onUploadSuccess={handleUploadSuccess} 
                currentUser={user.full_name || user.email} 
              />
            </div>
          )}

          {currentView === 'processing' && (
            <div className="flex-1 flex items-center justify-center">
              <ProcessingProgress 
                chatId={activeChatId} 
                onComplete={handleProcessingComplete} 
              />
            </div>
          )}

          {currentView === 'results' && (
            <div className="flex-1 min-h-0 min-w-0">
              <DataPreviewTable 
                records={activeChatData} 
                chatId={activeChatId}
                chatTitle={activeChatTitle}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}