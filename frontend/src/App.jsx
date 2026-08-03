import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import FolderUploader from './components/FolderUploader';
import ProcessingProgress from './components/ProcessingProgress';
import DataPreviewTable from './components/DataPreviewTable';

const API_URL = 'http://127.0.0.1:8000';
const CURRENT_USER = 'IT Admin'; // You can change this or hook it up to a login later

export default function App() {
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

  // Run once on load to populate sidebar
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchChats();
  }, [fetchChats]);

  // Handlers
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
        // If the active chat was deleted, clear view and go back to upload screen
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
        <header className="h-14 border-b border-slate-800 flex items-center px-6 shrink-0 bg-slate-950/50 backdrop-blur-sm">
          <h1 className="font-semibold text-slate-200 tracking-wide">Belarc Data Extraction Tool</h1>
        </header>

        {/* Dynamic Content View */}
        <div className="flex-1 p-6 flex flex-col min-w-0 min-h-0">
          {currentView === 'upload' && (
            <div className="flex-1 flex items-center justify-center">
              <FolderUploader 
                onUploadSuccess={handleUploadSuccess} 
                currentUser={CURRENT_USER} 
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