import { useState } from 'react';
import JSZip from 'jszip';
import { UploadCloud } from 'lucide-react';

export default function FolderUploader({ onUploadSuccess, currentUser }) {
  const [isZipping, setIsZipping] = useState(false);
  const [statusText, setStatusText] = useState('');

  const handleFolderSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsZipping(true);
    setStatusText('Scanning folder for HTML and ZIP files...');

    const zip = new JSZip();
    let count = 0;

    // Loop through all files in the selected folder and its subfolders
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      
      // Grab both HTML files AND any nested ZIP files
      if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || lowerName.endsWith('.zip')) {
        zip.file(file.webkitRelativePath || file.name, file);
        count++;
      }
    }

    if (count === 0) {
      alert('No HTML or ZIP files found in the selected folder.');
      setIsZipping(false);
      return;
    }

    setStatusText(`Packaging ${count} files for backend...`);
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    setStatusText('Uploading to backend...');
    const formData = new FormData();
    formData.append('file', zipBlob, `Belarc_Batch_${Date.now()}.zip`);
    formData.append('uploaded_by', currentUser || 'IT Team');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/chats/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      onUploadSuccess(data.chat_id);
    } catch (err) {
      alert('Failed to upload files: ' + err.message);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-12 bg-slate-900/50 transition w-full max-w-2xl mx-auto">
      <UploadCloud className="w-12 h-12 text-blue-400 mb-4 animate-bounce" />
      <h3 className="text-lg font-semibold text-white mb-1">Select Master Folder</h3>
      <p className="text-xs text-slate-400 mb-6 text-center max-w-sm">
        Select a folder. We will automatically find and process all HTML files, even if they are inside thousands of nested ZIP folders.
      </p>

      <input
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFolderSelect}
        className="hidden"
        id="folder-upload-input"
        disabled={isZipping}
      />

      <label
        htmlFor="folder-upload-input"
        className={`px-8 py-3 rounded-full font-medium text-sm transition shadow-lg ${
          isZipping
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
        }`}
      >
        {isZipping ? statusText : '📁 Select Master Folder'}
      </label>
    </div>
  );
}