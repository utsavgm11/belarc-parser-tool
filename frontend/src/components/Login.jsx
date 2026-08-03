import { useState } from 'react';
import { Lock, Mail, ShieldCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), password }),
      });

      if (res.ok) {
        const userData = await res.json();
        localStorage.setItem('belarc_user', JSON.stringify(userData));
        onLoginSuccess(userData);
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Cannot connect to backend server');
    }finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 max-w-md w-full shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600/10 text-blue-500 rounded-2xl mb-4 border border-blue-500/20 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Aarviencon Audit</h1>
          <p className="text-sm text-slate-400 mt-2">Sign in to securely access IT audits</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative group">
              <Mail className="w-5 h-5 absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@aarviencon.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative group">
              <Lock className="w-5 h-5 absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98]"
          >
            {loading ? 'Verifying credentials...' : 'Secure Sign In'}
          </button>
        </form>
        
        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-500">
          Authorized Aarviencon personnel only.
        </p>
      </div>
    </div>
  );
}