import { useEffect, useState } from 'react';

export default function ProcessingProgress({ chatId, onComplete }) {
  const [progress, setProgress] = useState({ status: 'processing', processed_files: 0, total_files: 0 });

  useEffect(() => {
    // Poll the backend every 2 seconds to get the latest progress
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/chats/${chatId}/status`);
        if (!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        setProgress(data);

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          if (data.status === 'completed') {
             // Delay slightly so the user sees 100% before it switches views
             setTimeout(() => onComplete(data.preview), 1000);
          }
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
      }
    }, 2000); 

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [chatId, onComplete]);

  // Calculate percentage safely
  const percentage = progress.total_files > 0 
    ? Math.round((progress.processed_files / progress.total_files) * 100) 
    : 0;

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 text-slate-200 shadow-xl">
      <div className="flex justify-between items-center mb-3">
        <span className="text-base font-semibold text-white">
          {progress.status === 'failed' ? 'Processing Failed ❌' : 'Parsing HTML Reports ⚙️'}
        </span>
        <span className="text-sm text-blue-400 font-mono font-bold">{percentage}%</span>
      </div>
      
      <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden mb-4 shadow-inner">
        <div 
          className={`h-full transition-all duration-300 ease-out ${progress.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <p className="text-sm text-slate-400 text-right font-mono">
        {progress.processed_files} / {progress.total_files} files written to Database
      </p>
    </div>
  );
}