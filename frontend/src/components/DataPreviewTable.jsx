import { useState } from 'react';
import { Download, List, Loader2, Search } from 'lucide-react';

export default function DataPreviewTable({ records: initialRecords, chatId, chatTitle }) {
  const [allRecords, setAllRecords] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use the full records if loaded, otherwise fallback to the initial preview 10
  const displayRecords = allRecords || initialRecords;

  // 1. Filter records dynamically based on the search query across ALL columns
  const filteredRecords = displayRecords.filter(row => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Check if any value in the row object matches the search query
    return Object.values(row).some(value => 
      value && String(value).toLowerCase().includes(query)
    );
  });

  // 2. Sort the filtered records primarily by the NUMBER at the end of the Computer Name
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const nameA = a['Computer Name'] || '';
    const nameB = b['Computer Name'] || '';

    // Extract trailing numbers from the computer names (e.g., '005' from 'AELRZLAP005')
    const numMatchA = nameA.match(/(\d+)$/);
    const numMatchB = nameB.match(/(\d+)$/);

    if (numMatchA && numMatchB) {
      const numA = parseInt(numMatchA[1], 10);
      const numB = parseInt(numMatchB[1], 10);
      
      // If the numbers are different, sort by the number in ascending order
      if (numA !== numB) {
        return numA - numB;
      }
    }

    // Fallback: If there are no numbers at the end, or the numbers are identical, sort alphabetically
    return nameA.localeCompare(nameB);
  });

  const handleExport = (format) => {
    window.open(`http://127.0.0.1:8000/api/chats/${chatId}/export?format=${format}`, '_blank');
  };

  const handleLoadAll = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/chats/${chatId}/data`);
      if (res.ok) {
        const data = await res.json();
        setAllRecords(data);
      } else {
        alert("Failed to load full dataset.");
      }
    } catch (err) {
      console.error("Error fetching all records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!initialRecords || initialRecords.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-full max-h-full w-full shadow-sm">
      
      {/* Header & Actions */}
      <div className="p-4 border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-950 w-full shrink-0">
        
        {/* Title Section */}
        <div className="min-w-0 flex-1 w-full lg:w-auto">
          <h2 
            className="text-sm font-semibold text-white truncate" 
            title={chatTitle || 'Extracted Hardware Data'}
          >
            {chatTitle || 'Extracted Hardware Data'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {sortedRecords.length} {allRecords ? 'records' : 'preview records'} shown
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:max-w-xs shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search all columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
        
        {/* Buttons Section */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          
          {/* VIEW ALL BUTTON - Hides once full data is loaded */}
          {!allRecords && (
            <button
              onClick={handleLoadAll}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-lg shadow transition"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <List className="w-3.5 h-3.5" />}
              {isLoading ? 'Loading...' : 'Load All Data'}
            </button>
          )}

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          
          <button
            onClick={() => handleExport('excel')}
            className="flex items-center justify-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg shadow transition"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Scrollable Data Table Container */}
      <div className="overflow-auto flex-1 w-full relative custom-scrollbar">
        <table className="w-full text-left text-xs text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800 shadow-sm z-10">
            <tr>
              <th className="py-3 px-4 font-medium">Computer Name</th>
              <th className="py-3 px-4 font-medium">System Model</th>
              <th className="py-3 px-4 font-medium">Serial Number</th>
              <th className="py-3 px-4 font-medium">LAN MAC</th>
              <th className="py-3 px-4 font-medium">Wi-Fi MAC</th>
              <th className="py-3 px-4 font-medium">Logon User</th>
              <th className="py-3 px-4 font-medium">OS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sortedRecords.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-500">
                  No records match your search criteria.
                </td>
              </tr>
            ) : (
              sortedRecords.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-medium text-white">{row['Computer Name'] || '-'}</td>
                  <td className="py-2.5 px-4">{row['System Model'] || '-'}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">{row['System Serial Number'] || '-'}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">{row['Physical Address (LAN)'] || '-'}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-400">{row['Physical Address (Wi-Fi)'] || '-'}</td>
                  <td className="py-2.5 px-4 font-medium text-blue-400">{row['Windows Logon'] || '-'}</td>
                  
                  {/* Truncated OS column to prevent infinite stretching */}
                  <td className="py-2.5 px-4 max-w-75 truncate" title={row['Operating System']}>
                    {row['Operating System'] || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}