
import React, { memo } from 'react';
import { ChatMessage } from '../types';
import SourceLink from './SourceLink';

interface MessageBubbleProps {
  msg: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg }) => {
  const isAssistant = msg.role === 'assistant';

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end animate-in slide-in-from-bottom-3 duration-500'}`}>
      <div className={`group relative max-w-[95%] p-8 rounded-[2.5rem] shadow-2xl transition-all duration-300 ${
        msg.role === 'user' 
          ? 'bg-blue-600 text-white font-black rounded-tl-none border-4 border-blue-500 shadow-blue-900/20' 
          : 'bg-slate-900 text-slate-200 border border-white/10 rounded-tr-none'
      }`}>
        {isAssistant && (
          <div className="absolute -top-4 -right-4 w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center border-4 border-[#020617] shadow-xl">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
          </div>
        )}
        
        <div className="text-[15px] whitespace-pre-wrap leading-[1.8] tracking-tight">
          {msg.content.split('\n').map((line, i) => {
             if (line.startsWith('**')) {
                return <h4 key={i} className={`font-black text-xl mb-6 mt-2 ${isAssistant ? 'text-blue-400' : 'text-white'}`}>{line.replace(/\*\*/g, '')}</h4>
             }
             if (/^\d+\./.test(line)) {
                return (
                  <div key={i} className={`flex gap-4 mb-3 p-4 rounded-2xl ${isAssistant ? 'bg-white/5 border border-white/5' : 'bg-white/10 border border-white/10'}`}>
                    <span className="font-black text-blue-500 opacity-60">{line.split('.')[0]}.</span>
                    <span className="flex-1 font-bold text-sm">{line.split('.').slice(1).join('.').trim()}</span>
                  </div>
                )
             }
             return <p key={i} className="mb-4 opacity-90">{line}</p>
          })}
        </div>

        {/* Mandatory rendering of Google Search grounding citations */}
        {isAssistant && msg.sources && msg.sources.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Surgical References & Web Sources:</p>
            <div className="grid grid-cols-1 gap-3">
              {msg.sources.map((source, idx) => (
                <SourceLink key={idx} source={source} />
              ))}
            </div>
          </div>
        )}
        
        <div className={`text-[9px] mt-6 font-black uppercase tracking-[0.3em] opacity-40 ${isAssistant ? 'text-slate-500' : 'text-blue-200'}`}>
          {isAssistant ? 'Surgical Processor Output' : 'User Directive'}
        </div>
      </div>
    </div>
  );
};

export default memo(MessageBubble);
