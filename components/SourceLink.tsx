
import React, { memo } from 'react';
import { GroundingChunk } from '../types';

interface SourceLinkProps {
  source: GroundingChunk;
}

const SourceLink: React.FC<SourceLinkProps> = ({ source }) => {
  if (!source.web) return null;

  return (
    <a 
      href={source.web.uri} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all text-slate-300 font-bold text-xs group"
    >
      <div className="bg-blue-600 text-white p-2 rounded-lg group-hover:scale-110 transition-transform shadow-lg shadow-blue-900/20">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
      </div>
      <span className="truncate flex-1">{source.web.title || "رابط مصدر تعليمي"}</span>
    </a>
  );
};

export default memo(SourceLink);
