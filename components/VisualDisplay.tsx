
import React, { memo, useState, useMemo, useEffect } from 'react';
import { Hotspot, Vitals, LabMode, ImageAnalysisResult } from '../types';

interface VisualDisplayProps {
  url: string | null;
  radiologyUrl?: string | null;
  explodedUrl?: string | null;
  loading: boolean;
  hotspots?: Hotspot[];
  vitals?: Vitals;
  riskLevel?: string;
  onHotspotSelected?: (spot: Hotspot) => void;
  examMode?: boolean;
  analysisResult?: ImageAnalysisResult;
  activeModeOverride?: LabMode;
}

const VisualDisplay: React.FC<VisualDisplayProps> = ({ 
  url, 
  radiologyUrl, 
  explodedUrl, 
  loading, 
  hotspots = [], 
  vitals, 
  riskLevel, 
  onHotspotSelected,
  examMode = false,
  analysisResult,
  activeModeOverride
}) => {
  const [selectedHotspotIdx, setSelectedHotspotIdx] = useState<number | null>(null);
  const [activeLabMode, setActiveLabMode] = useState<LabMode>(LabMode.SURGERY);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (activeModeOverride) {
        setActiveLabMode(activeModeOverride);
    }
  }, [activeModeOverride]);

  const getActiveImage = () => {
    switch(activeLabMode) {
      case LabMode.XRAY_VISION: return radiologyUrl || url;
      case LabMode.EXPLODED: return explodedUrl || url;
      case LabMode.ANALYSIS: return url; // In analysis mode, url is the uploaded image
      default: return url;
    }
  };

  const torqueValue = useMemo(() => Math.floor(Math.random() * 20) + 15, [url]);
  const burSpeed = useMemo(() => Math.floor(Math.random() * 200000) + 150000, [url]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-slate-950 rounded-[3rem] flex items-center justify-center border-4 border-blue-900/30 relative overflow-hidden shadow-2xl">
        <div className="scanline"></div>
        <div className="flex flex-col items-center">
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-blue-400 font-black text-xs animate-pulse tracking-[0.2em]">جاري بناء البيئة السريرية...</p>
        </div>
      </div>
    );
  }

  if (!url) return (
    <div className="w-full aspect-video bg-slate-900/10 rounded-[3rem] border-2 border-dashed border-slate-800 flex items-center justify-center group hover:border-blue-500/30 transition-all">
        <div className="text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
             <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
          </div>
          <p className="text-slate-500 font-bold">في انتظار استيراد المحاكاة...</p>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full" dir="rtl">
      <div className={`w-full aspect-video relative rounded-[3rem] overflow-hidden border-4 bg-black shadow-2xl transition-all duration-500 border-slate-800`}>
        
          <div className="w-full h-full relative">
            {activeLabMode === LabMode.MICROSCOPE && (
              <div className="absolute inset-0 z-10 pointer-events-none border-[60px] border-black/80 rounded-[3rem] shadow-[inset_0_0_100px_rgba(0,0,0,1)]"></div>
            )}

            {showGrid && (
              <div className="absolute inset-0 z-10 pointer-events-none opacity-30 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            )}

            {/* Analysis Mode - Danger Zones Overlay */}
            {activeLabMode === LabMode.ANALYSIS && analysisResult && analysisResult.dangerZones.map((zone, idx) => (
                <div 
                    key={idx}
                    className="absolute z-20 border-2 border-red-500/50 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse rounded-lg"
                    style={{
                        top: `${zone.box.ymin}%`,
                        left: `${zone.box.xmin}%`,
                        width: `${zone.box.xmax - zone.box.xmin}%`,
                        height: `${zone.box.ymax - zone.box.ymin}%`
                    }}
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded whitespace-nowrap">
                        {zone.name} ({zone.riskLevel})
                    </div>
                </div>
            ))}

            <img 
              key={getActiveImage()} 
              src={getActiveImage() || ''} 
              className={`w-full h-full object-cover transition-all duration-700 animate-in fade-in zoom-in-95 ${activeLabMode === LabMode.XRAY_VISION ? 'brightness-[1.1] contrast-[1.4] grayscale' : ''} ${activeLabMode === LabMode.MICROSCOPE ? 'scale-150 saturate-[1.2] contrast-[1.1]' : ''}`} 
              alt="العرض السريري" 
            />

            {/* Hotspots - Only in simulation mode */}
            {activeLabMode !== LabMode.ANALYSIS && hotspots.map((spot, idx) => (
              <button 
                key={idx}
                onClick={() => {
                  setSelectedHotspotIdx(idx);
                  if (onHotspotSelected) onHotspotSelected(spot);
                }}
                className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shadow-lg ${selectedHotspotIdx === idx ? 'bg-blue-500 border-white scale-125 ring-8 ring-blue-500/20' : 'bg-black/60 border-blue-400 text-blue-400 hover:scale-110'}`}
                style={{ right: `${spot.x}%`, top: `${spot.y}%` }}
              >
                <span className="font-black text-xs">{examMode ? "?" : (idx + 1)}</span>
              </button>
            ))}
          </div>

        {/* HUD Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-10 z-20">
             <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase">عزم الدوران</span>
                  <span className="text-[10px] text-amber-400 font-mono">{torqueValue} Ncm</span>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase">سرعة القبضة</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{burSpeed.toLocaleString()} دورة</span>
                </div>
             </div>
             <div className="flex gap-4">
               <button 
                onClick={() => setShowGrid(!showGrid)}
                className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg border transition-all ${showGrid ? 'bg-blue-600 border-white text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}
               >
                  الشبكة
               </button>
               <button 
                onClick={() => setActiveLabMode(activeLabMode === LabMode.MICROSCOPE ? LabMode.SURGERY : LabMode.MICROSCOPE)}
                className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg border transition-all ${activeLabMode === LabMode.MICROSCOPE ? 'bg-amber-600 border-white text-white shadow-[0_0_15px_rgba(217,119,6,0.5)]' : 'bg-white/5 border-white/10 text-slate-400'}`}
               >
                  المجهر
               </button>
             </div>
          </div>

        {/* Mode Selector Sidebar */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-40 bg-black/20 backdrop-blur-md p-3 rounded-full border border-white/5 shadow-2xl">
             {[LabMode.SURGERY, LabMode.EXPLODED, LabMode.XRAY_VISION].map((mode) => (
               <button 
                 key={mode}
                 onClick={() => setActiveLabMode(mode)}
                 className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${activeLabMode === mode ? 'bg-blue-600 border-white shadow-[0_0_20px_rgba(37,99,235,0.5)] scale-110' : 'bg-slate-900/80 border-white/10 text-slate-500 hover:text-white hover:border-white/30 hover:scale-105'}`}
                 title={mode}
               >
                  {mode === LabMode.SURGERY && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2}/></svg>
                  )}
                  {mode === LabMode.EXPLODED && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth={2}/></svg>
                  )}
                  {mode === LabMode.XRAY_VISION && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={2}/></svg>
                  )}
               </button>
             ))}
             {analysisResult && (
                 <button 
                 onClick={() => setActiveLabMode(LabMode.ANALYSIS)}
                 className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${activeLabMode === LabMode.ANALYSIS ? 'bg-red-600 border-white shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-110' : 'bg-slate-900/80 border-white/10 text-slate-500 hover:text-white hover:border-white/30 hover:scale-105'}`}
                 title="تحليل الصورة"
               >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeWidth={2}/></svg>
               </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default memo(VisualDisplay);
