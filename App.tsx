import React, { useState, useRef, useEffect, useCallback } from 'react';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { 
  generateSimulationContent, 
  generatePracticalContent, 
  generateResearchContent, 
  generateQuizContent,
  generateRealisticDentalImage, 
  analyzeDentalImage,
  checkApiConnection
} from './services/geminiService';
import { ChatMessage, Hotspot, ClinicalData, PracticalStep, LabMode, GroundingChunk, ImageAnalysisResult, QuizData } from './types';
import VisualDisplay from './components/VisualDisplay';
import Header from './components/Header';
import MessageBubble from './components/MessageBubble';
import SourceLink from './components/SourceLink';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'simulation' | 'practical' | 'gallery' | 'quiz'>('simulation');
  const [examMode, setExamMode] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [checkedPracticalSteps, setCheckedPracticalSteps] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  
  // INDEPENDENT STATE FOR EACH TAB
  const [simulationData, setSimulationData] = useState<{
    data: ClinicalData | null;
    url: string | null;
    radiologyUrl: string | null;
    explodedUrl: string | null;
  }>({ data: null, url: null, radiologyUrl: null, explodedUrl: null });

  const [practicalData, setPracticalData] = useState<ClinicalData | null>(null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [activeQuizType, setActiveQuizType] = useState<'essay' | 'sa' | 'mcq'>('essay');
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  
  // Quiz Settings
  const [quizLanguage, setQuizLanguage] = useState<'ar' | 'en'>('ar');
  const [quizCount, setQuizCount] = useState<number>(5);
  const [quizDifficulty, setQuizDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Intellectual'>('Medium');

  // Gallery State
  interface GalleryItem {
    id: number;
    prompt: string;
    imageUrl?: string;
    status: 'loading' | 'completed' | 'failed';
    source?: GroundingChunk;
  }
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [pdfExportingId, setPdfExportingId] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Check API Key on Mount
  useEffect(() => {
    const isConnected = checkApiConnection();
    if (!isConnected) {
        setApiKeyMissing(true);
        setErrorStatus("تنبيه: مفتاح API غير متصل. يرجى مراجعة إعدادات الموقع.");
    }
  }, []);

  // Handle Drag & Drop Events
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (activeTab === 'simulation') {
        setIsDragging(true);
    }
  }, [activeTab]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeTab !== 'simulation') return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setUploadedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
    }
  }, [activeTab]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setActiveTab('simulation');
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to add element to PDF page
  const addElementToPdf = async (elementId: string, pdf: jsPDF, addPageBreak: boolean = false) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    if (addPageBreak) pdf.addPage();

    const canvas = await html2canvas(element, {
        backgroundColor: '#020617', // Match app background
        scale: 2, // High quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (el: Element) => el.hasAttribute('data-html2canvas-ignore')
    });

    const imgData = canvas.toDataURL('image/png');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calculate scaling to fit page with margins
    const margin = 10;
    const availableWidth = pageWidth - (margin * 2);
    const availableHeight = pageHeight - (margin * 2);

    const widthRatio = availableWidth / canvas.width;
    const heightRatio = availableHeight / canvas.height;
    const ratio = Math.min(widthRatio, heightRatio);

    const finalWidth = canvas.width * ratio;
    const finalHeight = canvas.height * ratio;
    
    // Center image
    const x = (pageWidth - finalWidth) / 2;
    const y = (pageHeight - finalHeight) / 2;

    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
  };

  // Global Report Export
  const handleFullReport = async () => {
    setIsGeneratingReport(true);

    try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Render wait
        const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape

        if (activeTab === 'simulation') {
            if (simulationData.url) {
                await addElementToPdf('simulation-container', pdf);
            } else {
                alert("لا يوجد محتوى محاكاة للتصدير.");
                setIsGeneratingReport(false);
                return;
            }
        } 
        else if (activeTab === 'practical') {
            const steps = practicalData?.practicalProtocol || [];
            if (steps.length === 0) {
                alert("لا توجد خطوات للتصدير.");
                setIsGeneratingReport(false);
                return;
            }
            
            for (let i = 0; i < steps.length; i++) {
                // Add page for every step except the first one (already created by new jsPDF)
                await addElementToPdf(`practical-step-${i}`, pdf, i > 0);
            }
        } 
        else if (activeTab === 'gallery') {
            if (galleryItems.length === 0) {
                 alert("لا توجد صور في المعرض للتصدير.");
                 setIsGeneratingReport(false);
                 return;
            }
            for (let i = 0; i < galleryItems.length; i++) {
                await addElementToPdf(`gallery-item-${i}`, pdf, i > 0);
            }
        }
        else if (activeTab === 'quiz') {
            let questions: any[] = [];
            if (activeQuizType === 'essay') questions = quizData?.essayQuestions || [];
            else if (activeQuizType === 'sa') questions = quizData?.shortAnswerQuestions || [];
            else if (activeQuizType === 'mcq') questions = quizData?.mcqQuestions || [];

            if (!questions || questions.length === 0) {
                alert("لا توجد أسئلة للتصدير.");
                setIsGeneratingReport(false);
                return;
            }
            for (let i = 0; i < questions.length; i++) {
                await addElementToPdf(`quiz-card-${i}`, pdf, i > 0);
            }
        }

        pdf.save(`DentAssist-Report-${activeTab}-${Date.now()}.pdf`);

    } catch (err) {
        console.error("Full Report Generation Failed", err);
        alert("حدث خطأ أثناء إنشاء التقرير.");
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleExportElement = async (elementId: string, filenamePrefix: string) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      setExportingId(elementId);
      
      const originalBorder = element.style.borderColor;
      const originalBoxShadow = element.style.boxShadow;

      try {
          await new Promise(resolve => setTimeout(resolve, 100));

          const canvas = await html2canvas(element, {
              backgroundColor: '#020617', 
              scale: 2, 
              logging: false,
              useCORS: true, 
              allowTaint: true,
              ignoreElements: (el: Element) => el.hasAttribute('data-html2canvas-ignore')
          });

          canvas.toBlob(async (blob: Blob | null) => {
              if (blob) {
                  try {
                      await navigator.clipboard.write([
                          new ClipboardItem({ 'image/png': blob })
                      ]);
                      console.log("Copied to clipboard");
                  } catch (clipboardErr) {
                       const link = document.createElement('a');
                       link.download = `DentAssist-${filenamePrefix}-${Date.now()}.png`;
                       link.href = canvas.toDataURL('image/png');
                       link.click();
                  }
              }
          }, 'image/png');
      } catch (err) {
          console.error("Export failed:", err);
          alert("حدث خطأ أثناء تصدير الصورة.");
      } finally {
          element.style.borderColor = originalBorder;
          element.style.boxShadow = originalBoxShadow;
          setExportingId(null);
      }
  };

  const toggleAnswer = (id: string) => {
    setRevealedAnswers(prev => ({
        ...prev,
        [id]: !prev[id]
    }));
  };

  const handleConvert = async () => {
    if (apiKeyMissing) {
        setErrorStatus("توقف: لا يمكن إجراء الطلب لأن مفتاح API مفقود.");
        return;
    }
    if ((!input.trim() && !uploadedImage) || loading) return;
    
    const userMessage = input;
    setErrorStatus(null);
    setLoading(true);

    const newMessage: ChatMessage = { 
        role: 'user', 
        content: userMessage || (uploadedImage ? 'تحليل صورة سريرية' : 'طلب جديد'),
        visual: uploadedImage || undefined
    };
    setMessages(prev => [...prev, newMessage]);
    
    try {
        // --- 1. SIMULATION TAB LOGIC ---
        if (activeTab === 'simulation') {
             if (uploadedImage) {
                // Image Analysis
                const analysis = await analyzeDentalImage(uploadedImage);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `**تقرير الجراح الاستشاري:**\n\n${analysis.detailedClinicalAnalysis}\n\n**الامتثال للمعايير:** ${analysis.adaCompliance.compliant ? '✅ مطابق' : '⚠️ غير مطابق'}`,
                }]);
                setSimulationData({
                    data: { analysisResult: analysis },
                    url: uploadedImage,
                    radiologyUrl: null,
                    explodedUrl: null
                });
                setUploadedImage(null);
             } else {
                // Text to Simulation
                const result = await generateSimulationContent(userMessage);
                const data = result.data as ClinicalData;
                
                // Show text content immediately without waiting for images
                setSimulationData({
                    data: data,
                    url: null,
                    radiologyUrl: null,
                    explodedUrl: null
                });
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `تم إنشاء المحاكاة السريرية لـ: "${userMessage}"`,
                }]);

                // Generate images SEQUENTIALLY with INCREASED delay to avoid 429
                const imageRequests = [
                    { prompt: data.imagePrompt || userMessage, type: 'CLINICAL', key: 'url' },
                    { prompt: data.radiologyPrompt || userMessage, type: 'RADIOLOGY', key: 'radiologyUrl' },
                    { prompt: data.explodedPrompt || userMessage, type: 'EXPLODED', key: 'explodedUrl' }
                ];

                for (const req of imageRequests) {
                    try {
                        const img = await generateRealisticDentalImage(req.prompt, req.type as any);
                        
                        // If one image fails, we continue to try the others instead of breaking
                        if (img) {
                            setSimulationData(prev => ({ ...prev, [req.key]: img }));
                        } else {
                             console.warn(`Could not generate image for ${req.type}`);
                        }
                        
                        // INCREASED DELAY: 6 seconds between requests to be safe
                        await new Promise(r => setTimeout(r, 6000));
                    } catch (imgError) {
                        console.warn(`Failed to generate ${req.type} image:`, imgError);
                    }
                }
             }
        }

        // --- 2. PRACTICAL TAB LOGIC (Legendary Mentor) ---
        else if (activeTab === 'practical') {
             if (uploadedImage) { setErrorStatus("يرجى استخدام خانة 'عرض الحالة' لتحليل الصور."); setLoading(false); return; }
             
             setCheckedPracticalSteps([]); // Reset checks
             
             // 1. Get the protocol text
             const result = await generatePracticalContent(userMessage);
             
             // Initialize steps with 'pending' status
             const initialSteps = (result.data.practicalProtocol as PracticalStep[]).map(s => ({
                ...s,
                imageStatus: s.visualPrompt ? 'pending' : 'completed' // 'pending' only if there's a prompt
             }));
             
             const dataWithStatus = { ...result.data, practicalProtocol: initialSteps };
             setPracticalData(dataWithStatus as ClinicalData);
             
             setMessages(prev => [...prev, {
                role: 'assistant',
                content: `تم استدعاء "المعلم الأسطوري" لشرح: "${userMessage}"`,
            }]);

            // Release main loading state immediately so user sees text
            setLoading(false);

             // 2. Generate images for steps SEQUENTIALLY in background
             (async () => {
                 const steps = [...initialSteps];
                 for (let i = 0; i < steps.length; i++) {
                    if (steps[i].visualPrompt) {
                        setPracticalData(current => {
                            if (!current?.practicalProtocol) return current;
                            const newSteps = [...current.practicalProtocol];
                            if (newSteps[i].imageStatus === 'pending') {
                                newSteps[i] = { ...newSteps[i], imageStatus: 'loading' };
                            }
                            return { ...current, practicalProtocol: newSteps };
                        });

                        try {
                            const img = await generateRealisticDentalImage(steps[i].visualPrompt!, 'CLINICAL');
                            
                            setPracticalData(current => {
                                if (!current?.practicalProtocol) return current;
                                const newSteps = [...current.practicalProtocol];
                                newSteps[i] = { 
                                    ...newSteps[i], 
                                    imageUrl: img || undefined, 
                                    imageStatus: img ? 'completed' : 'failed'
                                };
                                return { ...current, practicalProtocol: newSteps };
                            });
                            
                            // INCREASED DELAY: 6 seconds between image gens
                            if (img) await new Promise(r => setTimeout(r, 6000));
                        } catch (e) {
                            console.warn(`Failed to generate image for step ${i}`, e);
                            setPracticalData(current => {
                                if (!current?.practicalProtocol) return current;
                                const newSteps = [...current.practicalProtocol];
                                newSteps[i] = { ...newSteps[i], imageStatus: 'failed' };
                                return { ...current, practicalProtocol: newSteps };
                            });
                        }
                    }
                 }
             })();
             setInput('');
             return; 
        }

        // --- 3. GALLERY TAB LOGIC (VISUAL SEARCH) ---
        else if (activeTab === 'gallery') {
            setGalleryItems([]); // Clear previous
            
            // 1. Get Prompts and Sources
            const result = await generateResearchContent(userMessage || (simulationData.data ? "Dental procedures" : "Dentistry"));
            
            // Setup initial skeleton
            const initialItems: GalleryItem[] = result.prompts.map((prompt: string, i: number) => ({
                id: i,
                prompt,
                status: 'loading',
                source: result.sources[i] || undefined // Map source if available
            }));
            setGalleryItems(initialItems);

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `جاري البحث البصري وتوليد الصور لـ: "${userMessage}"...`,
            }]);
            
            setLoading(false); // Release input lock

            // 2. Async Image Generation
            (async () => {
                const items = [...initialItems];
                for (let i = 0; i < items.length; i++) {
                    try {
                        const img = await generateRealisticDentalImage(items[i].prompt, 'CLINICAL');
                        
                        setGalleryItems(current => {
                            const updated = [...current];
                            if (updated[i]) {
                                updated[i] = { 
                                    ...updated[i], 
                                    imageUrl: img || undefined, 
                                    status: img ? 'completed' : 'failed' 
                                };
                            }
                            return updated;
                        });
                        
                        // INCREASED DELAY: 6 seconds between requests
                        if (img) await new Promise(r => setTimeout(r, 6000));
                    } catch (e) {
                         setGalleryItems(current => {
                            const updated = [...current];
                            if (updated[i]) updated[i] = { ...updated[i], status: 'failed' };
                            return updated;
                        });
                    }
                }
            })();
            setInput('');
            return;
        }

        // --- 4. QUIZ TAB LOGIC ---
        else if (activeTab === 'quiz') {
            setQuizData(null);
            setRevealedAnswers({});

            const result = await generateQuizContent(userMessage, quizLanguage, quizCount, quizDifficulty);
            const rawData = result.data as QuizData;

            // Ensure arrays exist
            setQuizData({
                essayQuestions: rawData.essayQuestions || [],
                shortAnswerQuestions: rawData.shortAnswerQuestions || [],
                mcqQuestions: rawData.mcqQuestions || []
            });

            const diffLabel = quizDifficulty === 'Intellectual' ? 'الفكري (Critical Thinking)' : 
                              quizDifficulty === 'Hard' ? 'الصعب' : 
                              quizDifficulty === 'Medium' ? 'المتوسط' : 'السهل';

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `تم إنشاء بنك أسئلة (${quizCount} لكل نوع) للموضوع: "${userMessage}" باللغة ${quizLanguage === 'ar' ? 'العربية' : 'الإنجليزية'} - المستوى: ${diffLabel}.`,
            }]);
            
            setInput('');
            setLoading(false);
        }

    } catch (error: any) {
      console.error("Operation Failed:", error);
      const msg = error?.message || error?.toString() || "Unknown Error";
      
      if (msg.toLowerCase().includes("quota") || msg.includes("429")) {
         setErrorStatus("يرجى المحاولة بعد قليل.");
      } else if (msg.includes("API_KEY")) {
         setApiKeyMissing(true);
         setErrorStatus("خطأ: مفتاح API مفقود. تأكد من إعداد ملف .env بشكل صحيح.");
      } else {
         // Show the actual error message for debugging
         setErrorStatus(`حدث خطأ: ${msg.substring(0, 100)}...`);
      }
    } finally {
        if (activeTab !== 'practical' && activeTab !== 'gallery') {
           setLoading(false);
        }
        setInput(''); 
    }
  };

  return (
    <div 
        className="min-h-screen bg-[#020617] text-slate-200 flex flex-col relative overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]" 
        dir="rtl"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
    >
      <Header />

      {/* API Key Missing Banner */}
      {apiKeyMissing && (
          <div className="bg-red-600 text-white text-center py-2 text-sm font-bold sticky top-20 z-50">
              ⚠️ تنبيه هام: مفتاح API غير مربوط بالموقع. يرجى إضافة VITE_API_KEY في إعدادات الاستضافة (Vercel/Netlify).
          </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDragging && (
          <div className="fixed inset-0 z-[100] bg-blue-600/20 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-blue-500 m-4 rounded-[3rem] animate-in fade-in duration-200 pointer-events-none">
              <div className="bg-slate-900/90 p-10 rounded-3xl border border-white/20 text-center shadow-2xl">
                  <div className="w-20 h-20 mx-auto bg-blue-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2.5}/></svg>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">أفلت الصورة هنا</h3>
                  <p className="text-blue-200 font-bold">لتحليل الحالة السريرية فوراً</p>
              </div>
          </div>
      )}

      <main className="flex-1 max-w-[1900px] mx-auto w-full p-6 lg:p-12 grid grid-cols-1 xl:grid-cols-12 gap-12">
        
        {/* MAIN DISPLAY SECTION */}
        <section className="xl:col-span-8 flex flex-col gap-10">
          <div 
            id="export-container"
            className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[4.5rem] p-12 shadow-2xl relative overflow-hidden min-h-[800px] transition-all duration-300"
          >
            {/* Background Decoration */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>

            <div className="flex flex-col md:flex-row justify-between items-center mb-10 relative z-10 gap-6 no-export">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeWidth={2}/></svg>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-black text-white tracking-tighter italic font-mono uppercase">المنصة <span className="text-blue-500">التعليمية</span></h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2">نظام الوحدات المستقلة</p>
                  </div>
               </div>

               {/* TABS & REPORT BUTTON */}
               <div className="flex items-center gap-3 bg-slate-950/80 p-2 rounded-[2.2rem] border border-white/10 shadow-2xl">
                  <div className="flex overflow-x-auto max-w-full">
                    <button 
                        onClick={() => setActiveTab('simulation')}
                        className={`px-6 py-4 rounded-[1.8rem] font-black text-[11px] transition-all duration-300 whitespace-nowrap ${activeTab === 'simulation' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        عرض الحالة
                    </button>
                    <button 
                        onClick={() => setActiveTab('practical')}
                        className={`px-6 py-4 rounded-[1.8rem] font-black text-[11px] transition-all duration-300 whitespace-nowrap ${activeTab === 'practical' ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        المعلم الأسطوري
                    </button>
                    <button 
                        onClick={() => setActiveTab('gallery')}
                        className={`px-6 py-4 rounded-[1.8rem] font-black text-[11px] transition-all duration-300 whitespace-nowrap ${activeTab === 'gallery' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        المعرض
                    </button>
                    <button 
                        onClick={() => setActiveTab('quiz')}
                        className={`px-6 py-4 rounded-[1.8rem] font-black text-[11px] transition-all duration-300 whitespace-nowrap ${activeTab === 'quiz' ? 'bg-amber-600 text-white shadow-[0_0_20px_rgba(217,119,6,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    >
                        الأسئلة
                    </button>
                  </div>

                  {/* GLOBAL PDF REPORT BUTTON */}
                  <div className="w-px h-8 bg-white/10 mx-1"></div>
                  <button 
                    onClick={handleFullReport}
                    disabled={isGeneratingReport}
                    className="group bg-red-900/20 hover:bg-red-600 hover:text-white text-red-400 p-4 rounded-[1.8rem] transition-all shadow-xl active:scale-95 flex items-center justify-center relative border border-red-500/20"
                    title="تصدير تقرير PDF شامل"
                  >
                     {isGeneratingReport ? (
                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                     ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth={2}/></svg>
                     )}
                     <span className="absolute -bottom-10 right-1/2 translate-x-1/2 bg-black text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">تقرير شامل</span>
                  </button>
               </div>
            </div>
            
            <div className="relative z-10">
              {/* --- SIMULATION VIEW --- */}
              {activeTab === 'simulation' && (
                <div className="animate-in fade-in duration-500" id="simulation-container">
                    <div className="relative group/sim">
                        {/* Simulation Export Buttons (Individual) */}
                        {simulationData.url && !loading && (
                            <div className="absolute top-4 right-4 z-50 flex gap-2 opacity-0 group-hover/sim:opacity-100 transform translate-y-2 group-hover/sim:translate-y-0 duration-300 transition-all">
                                {/* Image Button */}
                                <button 
                                    onClick={() => handleExportElement('simulation-container', 'simulation')}
                                    data-html2canvas-ignore
                                    className="bg-slate-900/80 text-blue-400 p-3 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-blue-600 hover:text-white shadow-lg transition-colors"
                                    title="حفظ الصورة"
                                >
                                    {exportingId === 'simulation-container' ? (
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                                    )}
                                </button>
                            </div>
                        )}
                        <VisualDisplay 
                          url={simulationData.url} 
                          radiologyUrl={simulationData.radiologyUrl}
                          explodedUrl={simulationData.explodedUrl}
                          loading={loading} 
                          hotspots={simulationData.data?.hotspots}
                          vitals={simulationData.data?.vitals}
                          riskLevel={simulationData.data?.riskLevel}
                          examMode={examMode}
                          analysisResult={simulationData.data?.analysisResult}
                          activeModeOverride={simulationData.data?.analysisResult ? LabMode.ANALYSIS : undefined}
                        />
                    </div>
                    {!simulationData.url && !loading && (
                        <div 
                            className="text-center mt-8 p-12 border-2 border-dashed border-blue-500/20 rounded-[3rem] bg-blue-500/5 group hover:bg-blue-500/10 hover:border-blue-500/40 transition-all cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-20 h-20 mx-auto bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2}/></svg>
                            </div>
                            <h3 className="text-xl font-bold text-blue-400 mb-2">أنشئ محاكاة جديدة</h3>
                            <p className="text-slate-500 font-medium">اكتب الموضوع في الأسفل، أو <span className="text-blue-400 underline decoration-dashed">اسحب صورة الأشعة هنا</span> للتحليل</p>
                        </div>
                    )}
                </div>
              )}

              {/* --- PRACTICAL VIEW (Legendary Mentor) --- */}
              {activeTab === 'practical' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500 text-right">
                  {!practicalData?.practicalProtocol ? (
                       <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-emerald-500/20 rounded-[3rem] bg-emerald-500/5">
                           <span className="text-4xl mb-4">👨‍⚕️</span>
                           <p className="text-emerald-500 font-bold">اكتب الإجراء الطبي لبدء الشرح مع "المعلم الأسطوري"</p>
                       </div>
                   ) : (
                    <>
                  <div className="bg-gradient-to-l from-emerald-950/40 to-transparent border border-emerald-500/20 p-10 rounded-[3.5rem] mb-10 overflow-hidden relative">
                        {/* Avatar / Persona Decoration */}
                        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
                        <div className="flex items-center gap-6 relative z-10">
                            <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg border-4 border-emerald-800 shrink-0">
                                <span className="text-4xl">🌟</span>
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-emerald-400 italic">المعلم الأسطوري (The Mentor)</h3>
                                <p className="text-emerald-200/80 font-bold text-lg mt-1">"الشرح الكامل والتفصيلي لكل خطوة."</p>
                            </div>
                        </div>
                  </div>

                  <div className="grid grid-cols-1 gap-10">
                    {practicalData.practicalProtocol.map((step, i) => (
                      <div 
                        key={step.id || i} 
                        id={`practical-step-${i}`}
                        className="group relative p-8 md:p-10 rounded-[3.5rem] bg-slate-950 border border-white/5 hover:border-emerald-500/30 transition-all shadow-2xl"
                      >
                        {/* Export Buttons */}
                        <div className="absolute top-8 right-8 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Image Copy */}
                            <button 
                                onClick={() => handleExportElement(`practical-step-${i}`, `step-${i+1}`)}
                                data-html2canvas-ignore
                                className="text-slate-500 hover:text-emerald-400 p-2 rounded-xl hover:bg-emerald-500/10 transition-colors"
                                title="نسخ هذه البطاقة كصورة"
                            >
                                {exportingId === `practical-step-${i}` ? (
                                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                                )}
                            </button>
                        </div>

                         <div className="absolute top-8 left-8 text-[120px] font-black text-white/5 pointer-events-none leading-none z-0">
                            {i + 1}
                         </div>

                         <div className="relative z-10">
                            <h4 className="text-3xl font-black text-white mb-8 border-b border-white/5 pb-6 flex items-center gap-4">
                                <span className="text-emerald-500">#{i + 1}</span>
                                {step.title}
                            </h4>

                            <div className="space-y-8">
                                {/* 1. Original Text */}
                                <div className="bg-black/60 rounded-3xl p-6 border-r-4 border-slate-700 backdrop-blur-sm" dir="ltr">
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-2">Original Text</span>
                                    <p className="text-slate-300 font-mono text-sm leading-relaxed">{step.originalText}</p>
                                </div>

                                {/* 2. Medical Translation */}
                                <div className="bg-emerald-950/20 rounded-3xl p-6 border-r-4 border-emerald-600">
                                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest block mb-2">الترجمة الطبية</span>
                                    <p className="text-emerald-100 font-bold text-lg">{step.medicalTranslation}</p>
                                </div>

                                {/* 3. Deep Explanation (Professor Comment) */}
                                <div className="bg-blue-950/20 rounded-3xl p-8 border border-blue-500/10 relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                                     <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest block mb-3 relative z-10">الشرح العميق</span>
                                     <p className="text-slate-200 text-lg leading-loose relative z-10 font-medium">
                                         {step.professorComment}
                                     </p>
                                </div>

                                {/* 4. Mnemonic (Funny) */}
                                <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-3xl p-6 border border-amber-500/20 flex gap-6 items-start">
                                    <div className="text-4xl bg-amber-500/20 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0">
                                        🤡
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest block mb-2">اسلوب الحفظ الفكاهي</span>
                                        <p className="text-amber-100 font-bold text-lg italic">
                                            "{step.memoryAid}"
                                        </p>
                                    </div>
                                </div>

                                {/* 5. Visual Prompt (Image) */}
                                <div className="relative rounded-[2.5rem] overflow-hidden aspect-video bg-black/50 border border-white/10 shadow-inner group-hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-shadow">
                                    {step.imageStatus === 'completed' && step.imageUrl ? (
                                        <img src={step.imageUrl} alt={step.title} className="w-full h-full object-cover animate-in fade-in duration-700 hover:scale-105 transition-transform duration-700" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                                            {step.imageStatus === 'loading' || step.imageStatus === 'pending' ? (
                                                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                            ) : step.imageStatus === 'failed' ? (
                                                <span className="text-5xl opacity-40 grayscale">⚠️</span>
                                            ) : (
                                                <span className="text-4xl opacity-20">🖼️</span>
                                            )}
                                            
                                            <span className={`text-xs font-bold uppercase tracking-widest ${step.imageStatus === 'failed' ? 'text-rose-400' : 'text-slate-600'}`}>
                                                {step.imageStatus === 'loading' ? "جاري التوليد..." : 
                                                 step.imageStatus === 'pending' ? "في قائمة الانتظار..." :
                                                 step.imageStatus === 'failed' ? "تعذر إنشاء الصورة (Quota/Error)" : "لا توجد صورة"}
                                            </span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] text-white font-black uppercase tracking-widest border border-white/10">
                                        Browser Visual Aid
                                    </div>
                                </div>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                  </>
                  )}
                </div>
              )}

              {/* --- GALLERY VIEW --- */}
              {activeTab === 'gallery' && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-indigo-950/30 border border-indigo-500/20 p-10 rounded-[3.5rem] mb-10 text-right relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full"></div>
                         <h3 className="text-3xl font-black text-indigo-400 italic mb-2 relative z-10">المعرض البصري</h3>
                         <p className="text-indigo-200/60 font-bold relative z-10">بحث بصري متقدم مع صور سريرية ومصادر موثوقة (3 نتائج)</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {galleryItems && galleryItems.length > 0 ? (
                            galleryItems.map((item, idx) => (
                                <div key={idx} id={`gallery-item-${idx}`} className="group relative bg-slate-950 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl hover:border-indigo-500/50 transition-all duration-300 flex flex-col">
                                    
                                    {/* Gallery Export Buttons */}
                                    <div className="absolute top-4 left-4 z-50 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleExportElement(`gallery-item-${idx}`, `gallery-${idx}`)}
                                            data-html2canvas-ignore
                                            className="bg-black/50 text-white p-2 rounded-xl backdrop-blur-md hover:bg-indigo-600 transition-all"
                                            title="نسخ الصورة"
                                        >
                                            {exportingId === `gallery-item-${idx}` ? (
                                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                                            )}
                                        </button>
                                    </div>

                                    {/* Image Section */}
                                    <div className="aspect-[4/3] bg-black/50 relative overflow-hidden">
                                        {item.status === 'completed' && item.imageUrl ? (
                                            <img 
                                                src={item.imageUrl} 
                                                alt={`Result ${idx + 1}`} 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                                                 {item.status === 'loading' ? (
                                                     <>
                                                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">جاري التحليل...</span>
                                                     </>
                                                 ) : item.status === 'failed' ? (
                                                     <div className="text-center p-4">
                                                        <span className="text-4xl block mb-2">⚠️</span>
                                                        <span className="text-[10px] text-rose-400 font-bold">فشل العرض</span>
                                                     </div>
                                                 ) : (
                                                     <span className="text-4xl opacity-20">🖼️</span>
                                                 )}
                                            </div>
                                        )}
                                        
                                        {/* Overlay Gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                                        
                                        {/* Number Badge */}
                                        <div className="absolute top-4 right-4 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white font-black">
                                            {idx + 1}
                                        </div>
                                    </div>

                                    {/* Info Section */}
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <p className="text-xs text-slate-400 line-clamp-2 mb-4 font-medium leading-relaxed">
                                            {item.prompt}
                                        </p>
                                        
                                        {item.source ? (
                                            <a 
                                                href={item.source.web?.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-bold text-sm shadow-lg shadow-indigo-900/20"
                                            >
                                                <span>تصفح المصدر</span>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={2}/></svg>
                                            </a>
                                        ) : (
                                            <div className="w-full bg-white/5 text-slate-500 py-3 rounded-xl text-center text-xs font-bold cursor-not-allowed">
                                                مصدر الصورة غير متاح
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-32 bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-indigo-500/20 flex flex-col items-center justify-center text-center">
                                <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                                    <span className="text-5xl">🔍</span>
                                </div>
                                <h4 className="text-xl font-black text-indigo-400 mb-2">في انتظار البحث...</h4>
                                <p className="text-slate-500 font-bold max-w-md mx-auto">أدخل المصطلح الطبي أو الحالة التي ترغب في استكشافها بصرياً في شريط البحث أدناه.</p>
                            </div>
                        )}
                    </div>
                </div>
              )}

               {/* --- QUIZ VIEW (NEW) --- */}
              {activeTab === 'quiz' && (
                <div className="animate-in fade-in slide-in-from-bottom-5 duration-500 text-right">
                    <div className="bg-amber-950/30 border border-amber-500/20 p-8 rounded-[3.5rem] mb-10 text-right flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div>
                                <h3 className="text-3xl font-black text-amber-400 italic mb-2">بنك الأسئلة</h3>
                                <p className="text-amber-200/60 font-bold">اختبر معلوماتك مع أسئلة مقالية وأسئلة قصيرة (SA) وأسئلة خيارات (MCQ).</p>
                            </div>
                            
                            {/* Quiz Type Switcher */}
                            <div className="bg-black/40 p-1.5 rounded-full flex gap-1 border border-white/10 flex-wrap justify-center">
                                <button 
                                    onClick={() => setActiveQuizType('essay')}
                                    className={`px-6 py-2 rounded-full text-xs font-black transition-all ${activeQuizType === 'essay' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    أسئلة مقالية
                                </button>
                                <button 
                                    onClick={() => setActiveQuizType('sa')}
                                    className={`px-6 py-2 rounded-full text-xs font-black transition-all ${activeQuizType === 'sa' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    أسئلة قصيرة (SA)
                                </button>
                                <button 
                                    onClick={() => setActiveQuizType('mcq')}
                                    className={`px-6 py-2 rounded-full text-xs font-black transition-all ${activeQuizType === 'mcq' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    خيارات (MCQ)
                                </button>
                            </div>
                        </div>

                        {/* Quiz Generation Settings (Language, Count, Difficulty) */}
                        <div className="bg-black/20 p-4 rounded-3xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-4">
                                {/* Language */}
                                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-white/10">
                                    <span className="text-[10px] text-slate-500 font-black uppercase px-2">اللغة:</span>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => setQuizLanguage('ar')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizLanguage === 'ar' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            العربية
                                        </button>
                                        <button 
                                            onClick={() => setQuizLanguage('en')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${quizLanguage === 'en' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            English
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Difficulty */}
                                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-white/10">
                                    <span className="text-[10px] text-slate-500 font-black uppercase px-2">المستوى:</span>
                                    <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[200px] md:max-w-none">
                                        <button onClick={() => setQuizDifficulty('Easy')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${quizDifficulty === 'Easy' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>سهل</button>
                                        <button onClick={() => setQuizDifficulty('Medium')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${quizDifficulty === 'Medium' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>متوسط</button>
                                        <button onClick={() => setQuizDifficulty('Hard')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${quizDifficulty === 'Hard' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}>صعب</button>
                                        <button onClick={() => setQuizDifficulty('Intellectual')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${quizDifficulty === 'Intellectual' ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'text-slate-400 hover:text-white'}`}>فكري</button>
                                    </div>
                                </div>

                                {/* Count */}
                                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-white/10">
                                    <span className="text-[10px] text-slate-500 font-black uppercase px-2">العدد:</span>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="10" 
                                        value={quizCount}
                                        onChange={(e) => setQuizCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                                        className="w-12 bg-black border border-white/10 rounded-lg py-1 px-2 text-center text-white text-sm font-bold focus:border-amber-500 outline-none"
                                    />
                                </div>
                            </div>
                            
                            <div className="text-[10px] text-amber-500/60 font-bold italic w-full md:w-auto text-center md:text-right">
                                * سيتم توليد {quizCount} أسئلة لكل فئة (المجموع {quizCount * 3})
                            </div>
                        </div>
                    </div>

                    {!quizData ? (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-amber-500/20 rounded-[3rem] bg-amber-500/5">
                            <span className="text-4xl mb-4">🎓</span>
                            <p className="text-amber-500 font-bold">اضبط الإعدادات واكتب الموضوع لتوليد الاختبار</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {(activeQuizType === 'mcq' ? quizData.mcqQuestions : (activeQuizType === 'essay' ? quizData.essayQuestions : quizData.shortAnswerQuestions)).map((q, idx) => (
                                <div key={idx} id={`quiz-card-${idx}`} className="group relative bg-slate-950 border border-white/5 hover:border-amber-500/30 p-8 rounded-[2.5rem] shadow-xl transition-all">
                                    {/* Export Button */}
                                    <button 
                                        onClick={() => handleExportElement(`quiz-card-${idx}`, `quiz-${activeQuizType}-${idx}`)}
                                        data-html2canvas-ignore
                                        className="absolute top-6 left-6 text-slate-600 hover:text-amber-400 transition-colors"
                                        title="حفظ السؤال كصورة"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeWidth={2}/><path d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                                    </button>

                                    <div className="flex items-center gap-4 mb-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            q.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            q.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            q.difficulty === 'Hard' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                            'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                        }`}>
                                            {q.difficulty}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-black">Question #{idx + 1}</span>
                                    </div>

                                    <h4 className="text-xl font-bold text-slate-200 mb-6 leading-relaxed" dir={quizLanguage === 'ar' ? 'rtl' : 'ltr'}>{q.question}</h4>

                                    {/* MCQ Options Rendering */}
                                    {activeQuizType === 'mcq' && 'options' in q && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" dir={quizLanguage === 'ar' ? 'rtl' : 'ltr'}>
                                            {q.options.map((option: string, optIdx: number) => {
                                                const isRevealed = revealedAnswers[`${activeQuizType}-${idx}`];
                                                const isCorrect = option === (q as any).correctAnswer;
                                                
                                                return (
                                                    <div 
                                                        key={optIdx} 
                                                        className={`p-4 rounded-2xl border transition-all duration-300 font-bold text-sm
                                                            ${isRevealed 
                                                                ? (isCorrect 
                                                                    ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-300' 
                                                                    : 'bg-slate-900 border-white/5 text-slate-500 opacity-50')
                                                                : 'bg-white/5 border-white/10 text-slate-300'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black
                                                                ${isRevealed && isCorrect ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-white/20 text-white/50'}
                                                            `}>
                                                                {['A', 'B', 'C', 'D'][optIdx]}
                                                            </div>
                                                            {option}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Reveal Answer Section */}
                                    <div className={`rounded-2xl overflow-hidden border transition-all duration-500 ${revealedAnswers[`${activeQuizType}-${idx}`] ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-900 border-white/5'}`}>
                                        <button 
                                            onClick={() => toggleAnswer(`${activeQuizType}-${idx}`)}
                                            data-html2canvas-ignore
                                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                        >
                                            <span className={`text-xs font-black uppercase tracking-widest ${revealedAnswers[`${activeQuizType}-${idx}`] ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {revealedAnswers[`${activeQuizType}-${idx}`] ? 'إخفاء الإجابة' : 'إظهار الإجابة'}
                                            </span>
                                            <svg className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${revealedAnswers[`${activeQuizType}-${idx}`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={2}/></svg>
                                        </button>
                                        
                                        {revealedAnswers[`${activeQuizType}-${idx}`] && (
                                            <div className="p-6 pt-0 animate-in fade-in slide-in-from-top-2" dir={quizLanguage === 'ar' ? 'rtl' : 'ltr'}>
                                                {/* For MCQ, show explanation. For others, show answer */}
                                                {activeQuizType === 'mcq' ? (
                                                     <div className="flex items-start gap-4">
                                                        <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] text-emerald-500 font-black uppercase block mb-1">الشرح والتوضيح:</span>
                                                            <p className="text-emerald-100 text-sm leading-loose font-medium">
                                                                {(q as any).explanation}
                                                            </p>
                                                        </div>
                                                     </div>
                                                ) : (
                                                    <p className="text-emerald-100 text-sm leading-loose font-medium border-t border-emerald-500/10 pt-4">
                                                        {q.answer}
                                                    </p>
                                                )}

                                                {q.keyPoints && q.keyPoints.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-dashed border-emerald-500/20">
                                                        <span className="text-[10px] text-emerald-500 font-black uppercase block mb-2">النقاط الرئيسية:</span>
                                                        <div className="flex flex-wrap gap-2">
                                                            {q.keyPoints.map((point, k) => (
                                                                <span key={k} className="bg-emerald-500/10 text-emerald-300 px-2 py-1 rounded text-xs font-bold">{point}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              )}

            </div>
          </div>
        </section>

        {/* SIDEBAR */}
        <section className="xl:col-span-4 flex flex-col gap-8">
           <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-[4rem] flex flex-col h-[calc(100vh-160px)] shadow-2xl overflow-hidden sticky top-32">
              <div className="p-10 border-b border-white/5 bg-slate-950/50 text-right">
                <div className="flex items-center gap-4 justify-start mb-2">
                   <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                   <h3 className="text-2xl font-black text-white tracking-tight">المساعد السريري</h3>
                </div>
                <p className="text-[9px] text-blue-500 font-black uppercase tracking-[0.3em] mt-1">
                    {activeTab === 'simulation' && 'وحدة المحاكاة'}
                    {activeTab === 'practical' && 'وحدة البروتوكول'}
                    {activeTab === 'gallery' && 'وحدة البحث البصري'}
                    {activeTab === 'quiz' && 'وحدة الاختبارات'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar text-right">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-40 text-center px-8 gap-8">
                    <div className="w-32 h-32 bg-white/5 rounded-[3rem] flex items-center justify-center border-2 border-dashed border-white/10 group-hover:border-blue-500/50 transition-all">
                      <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeWidth={2}/></svg>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white mb-3">اختر الوحدة وابدأ</h4>
                      <p className="text-xs font-bold leading-relaxed text-slate-500 italic px-6">تعمل كل وحدة بشكل منفصل. اختر التبويب أعلاه ثم اكتب الموضوع.</p>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
              </div>

              <div className="p-10 bg-slate-950/80 border-t border-white/10 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
                {uploadedImage && activeTab === 'simulation' && (
                    <div className="mb-4 relative rounded-2xl overflow-hidden border border-blue-500/30">
                        <img src={uploadedImage} alt="Preview" className="w-full h-32 object-cover opacity-70" />
                        <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-red-600/80 text-white p-1 rounded-full hover:bg-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
                        </button>
                    </div>
                )}
                <div className="relative">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleConvert()}
                    placeholder={uploadedImage ? "تم إرفاق صورة..." : `اكتب الموضوع لـ ${activeTab === 'simulation' ? 'المحاكاة' : activeTab === 'practical' ? 'البروتوكول' : activeTab === 'quiz' ? 'الاختبار' : 'البحث'}...`}
                    className="w-full bg-slate-900 border-2 border-white/5 rounded-[2.5rem] pl-20 pr-16 py-7 text-sm font-bold focus:border-blue-600 outline-none transition-all shadow-2xl text-right placeholder:text-slate-700"
                  />
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`absolute right-4 top-4 bottom-4 transition-colors px-2 ${activeTab === 'simulation' ? 'text-slate-400 hover:text-blue-400' : 'text-slate-700 cursor-not-allowed'}`}
                    disabled={activeTab !== 'simulation'}
                    title="تحليل الصور متاح فقط في وحدة المحاكاة"
                  >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" strokeWidth={2}/></svg>
                  </button>
                  <button 
                    onClick={handleConvert}
                    disabled={loading || (!input.trim() && !uploadedImage)}
                    className="absolute left-4 top-4 bottom-4 bg-blue-600 text-white px-8 rounded-[1.8rem] hover:bg-blue-700 disabled:opacity-20 transition-all shadow-xl active:scale-95 flex items-center justify-center min-w-[80px]"
                  >
                    {loading ? (
                       <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={3}/></svg>
                    )}
                  </button>
                </div>
                {errorStatus && (
                  <div className="bg-rose-600/10 border border-rose-500/20 p-4 rounded-2xl mt-4 animate-bounce">
                    <p className="text-rose-400 text-[10px] font-black text-center">{errorStatus}</p>
                  </div>
                )}
              </div>
           </div>
        </section>
      </main>
    </div>
  );
};

export default App;