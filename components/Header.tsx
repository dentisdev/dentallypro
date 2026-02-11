import React, { memo } from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-[#020617]/80 border-b border-white/5 sticky top-0 z-50 px-6 backdrop-blur-xl supports-[backdrop-filter]:bg-[#020617]/60">
      <div className="max-w-[1800px] mx-auto h-20 flex items-center justify-between flex-row-reverse">
        
        {/* Logo Section */}
        <div className="flex items-center gap-4 flex-row-reverse cursor-pointer hover:opacity-90 transition-opacity">
          <div className="bg-gradient-to-tr from-blue-600 to-blue-500 p-2.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] ring-1 ring-white/10">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.722 2.166a2 2 0 01-2.615 1.25l-2.166-.722a2 2 0 00-2.515 1.5l-.477 2.387a2 2 0 01-1.428 1.428" />
            </svg>
          </div>
          <div className="text-right hidden md:block">
            <h1 className="text-xl font-black text-white tracking-tight">Dental <span className="text-blue-500 font-mono">Brain</span></h1>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em]">AI Surgical Platform</p>
          </div>
        </div>

        {/* Website Navigation (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1.5 rounded-full border border-white/5">
            <button className="px-6 py-2 rounded-full text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-all">الرئيسية</button>
            <button className="px-6 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all">عن المنصة</button>
            <button className="px-6 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all">الأسعار</button>
            <button className="px-6 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all">اتصل بنا</button>
        </nav>

        {/* Status Only */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Web System Online</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default memo(Header);