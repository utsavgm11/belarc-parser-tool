import { useState } from 'react';
import { Plus, Search, FileText, Edit2, Trash2, Check, X, LogOut } from 'lucide-react';

export default function Sidebar({ 
  chats, 
  activeChatId, 
  onSelectChat, 
  onNewUpload,
  onRenameChat,
  onDeleteChat,
  onLogout
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Filter chats based on search term
  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (chat.uploaded_by && chat.uploaded_by.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const startEditing = (e, chat) => {
    e.stopPropagation(); // Prevent triggering onSelectChat
    setEditingChatId(chat.id);
    setEditTitleText(chat.title);
  };

  const saveRename = (e, chatId) => {
    e.stopPropagation();
    if (editTitleText.trim() && editTitleText !== chats.find(c => c.id === chatId)?.title) {
      onRenameChat(chatId, editTitleText.trim());
    }
    setEditingChatId(null);
  };

  const cancelRename = (e) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const handleDelete = (e, chatId, title) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      onDeleteChat(chatId);
    }
  };

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col h-screen border-r border-slate-800 shrink-0 select-none">
      {/* New Upload Button */}
      <div className="p-4">
        <button
          onClick={onNewUpload}
          className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-full transition shadow-sm border border-slate-700"
        >
          <Plus className="w-5 h-5 text-blue-400" />
          <span className="text-sm">New Upload</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 min-h-0">
        <div className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-1">
          Past Audits
        </div>
        
        {filteredChats.length === 0 ? (
          <div className="px-3 text-xs text-slate-500 italic">No audits found.</div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChatId === chat.id;
            const isEditing = editingChatId === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => !isEditing && onSelectChat(chat.id)}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer transition ${
                  isActive
                    ? 'bg-slate-800 text-white font-medium'
                    : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                
                <div className="flex-1 min-w-0 pr-12">
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editTitleText}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(e, chat.id);
                        if (e.key === 'Escape') cancelRename(e);
                      }}
                      className="w-full bg-slate-700 border border-blue-500 rounded px-2 py-0.5 text-sm text-white outline-none"
                    />
                  ) : (
                    <>
                      <p className="truncate text-sm" title={chat.title}>{chat.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {chat.total_files} files • {chat.uploaded_by || 'IT Team'}
                      </p>
                    </>
                  )}
                </div>

                {/* Hover Action Buttons */}
                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 p-0.5 rounded-md backdrop-blur-sm">
                  {isEditing ? (
                    <>
                      <button
                        onClick={(e) => saveRename(e, chat.id)}
                        className="p-1.5 hover:bg-slate-700 text-green-400 rounded transition"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelRename}
                        className="p-1.5 hover:bg-slate-700 text-slate-400 rounded transition"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => startEditing(e, chat)}
                        className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded transition"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, chat.id, chat.title)}
                        className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Logout Button */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition text-sm font-medium"
        >
          <LogOut className="w-4 h-4 shrink-0 text-red-400" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}