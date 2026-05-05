"use client"

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Twin from '../components/Twin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://co-4bc16b63129346c89c50faf3ca4b6796.ecs.us-east-1.on.aws/api';

type Section = 'build' | 'style' | 'cover';
type BuildStep = 'input' | 'config' | 'process';
type InputMode = 'yt-video' | 'yt-playlist' | 'file';

interface FileItem {
  id: string;
  file: File;
  name: string;
}

interface SummaryOption {
  id: string;
  label: string;
  description: string;
  cost: number;
  estimated_time: string;
  estimated_pages: number;
}

interface VideoSummary {
  title: string;
  duration: string;
  summary: string;
}

interface ProcessResponse {
  source_type: string;
  videos: VideoSummary[];
  total_duration: string;
  summary_options: SummaryOption[];
}

interface MarkdownFile {
  content: string;
  filename: string;
}

interface GenerateResponse {
  files: MarkdownFile[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// --- SUB-COMPONENTS ---

const StepWrapper = ({ step, title, children, currentStep, isLast = false }: { step: BuildStep; title: string; children: React.ReactNode; currentStep: BuildStep; isLast?: boolean; }) => {
  const isActive = currentStep === step;
  return (
    <div className={`relative ${!isLast ? 'pb-12 mb-12 border-b-2 border-neutral-200' : ''}`}>
      <div className={`transition-all duration-300 ${!isActive ? 'opacity-30 pointer-events-none grayscale' : 'opacity-100'}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-black text-white border-black' : 'border-neutral-300 text-neutral-400'}`}>
            {step === 'input' ? '01' : step === 'config' ? '02' : '03'}
          </div>
          <h3 className={`text-xs font-bold uppercase ${isActive ? 'text-black' : 'text-neutral-400'}`}>{title}</h3>
        </div>
        <div className="pl-9">{children}</div>
      </div>
    </div>
  );
};

const SectionHeader = ({ id, title, num, expandedSection, onToggle }: { id: Section; title: string; num: string; expandedSection: Section | null; onToggle: (id: Section) => void; }) => (
  <button onClick={() => onToggle(id)} className={`w-full flex items-center justify-between px-6 py-4 transition-all ${expandedSection === id ? 'bg-neutral-50 border-b-2 border-neutral-400' : 'hover:bg-neutral-50'}`}>
    <div className="flex items-center gap-3">
      <span className="text-xl font-bold tracking-tighter text-neutral-400">{num}</span>
      <h2 className={`text-xl font-bold tracking-tighter uppercase ${expandedSection === id ? 'text-black' : 'text-neutral-500'}`}>{title}</h2>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${expandedSection === id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
  </button>
);

// --- MAIN PAGE ---

export default function AppPage() {
  const [isTwinOpen, setIsTwinOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<Section | null>('build');
  const [currentStep, setCurrentStep] = useState<BuildStep>('input');
  const [inputMode, setInputMode] = useState<InputMode>('yt-video');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [ytLink, setYtLink] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ProcessResponse | null>(null);
  const [generatedMd, setGeneratedMd] = useState<GenerateResponse | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewFormat, setViewFormat] = useState<'md' | 'txt'>('md');
  const [error, setError] = useState<string | null>(null);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [separateChapters, setSeparateChapters] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('preview');

  const [selectedVideoSummary, setSelectedVideoSummary] = useState<VideoSummary | null>(null);

  // --- STYLING STATES ---
  const [stylePrompt, setStylePrompt] = useState('');
  const [isStyling, setIsStyling] = useState(false);
  const [stylePdfUrl, setStylePdfUrl] = useState<string | null>(null);
  const [styleCost, setStyleCost] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // --- COVER STATES ---
  const [coverPrompt, setCoverPrompt] = useState('');
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverCost, setCoverCost] = useState<number | null>(null);
  const [coverChatInput, setCoverChatInput] = useState('');
  const [coverChatHistory, setCoverChatHistory] = useState<ChatMessage[]>([]);
  const coverChatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatHistory]);

  useEffect(() => {
    if (coverChatScrollRef.current) coverChatScrollRef.current.scrollTop = coverChatScrollRef.current.scrollHeight;
  }, [coverChatHistory]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ id: Math.random().toString(36).substr(2, 9), file: f, name: f.name }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const newFiles = [...files];
    const dragged = newFiles[draggedIndex];
    newFiles.splice(draggedIndex, 1);
    newFiles.splice(index, 0, dragged);
    setFiles(newFiles);
    setDraggedIndex(null);
  };

  const removeFile = (id: string) => setFiles(files.filter(f => f.id !== id));

  const handleProcess = async () => {
    setIsLoading(true); setError(null); setResult(null); setCurrentStep('config');
    try {
      const res = await fetch(`${API_URL}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_type: inputMode, url: inputMode !== 'file' ? ytLink : null, file_names: inputMode === 'file' ? files.map(f => f.name) : null, custom_prompt: customPrompt || null }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error'); setCurrentStep('input');
    } finally { setIsLoading(false); }
  };

  const handleGenerate = async () => {
    if (!selectedOption) return;
    setIsGenerating(true); setError(null); setCurrentStep('process');
    try {
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_id: selectedOption, separate_chapters: separateChapters }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setGeneratedMd(data);
      setSelectedFileIndex(0);
      setPreviewMode('preview');
      setViewFormat('md');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error'); setCurrentStep('config');
    } finally { setIsGenerating(false); }
  };

  const downloadFile = (index: number) => {
    if (!generatedMd) return;
    const file = generatedMd.files[index];
    const ext = viewFormat === 'md' ? '.md' : '.txt';
    const filename = file.filename.replace('.md', ext);
    const blob = new Blob([file.content], { type: viewFormat === 'md' ? 'text/markdown' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const handleStartStyling = async () => {
    setIsStyling(true);
    try {
      const res = await fetch(`${API_URL}/style`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: stylePrompt }),
      });
      const data = await res.json();
      if (data.pdf_base64) {
        setStylePdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
      }
      setStyleCost(data.cost);
    } catch (err) { console.error(err); } finally { setIsStyling(false); }
  };

  const handleStyleChat = async () => {
    if (!chatInput.trim()) return;
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: chatInput }];
    setChatHistory(newHistory); setChatInput(''); setIsStyling(true);
    try {
      const res = await fetch(`${API_URL}/style/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: chatInput, history: newHistory.slice(-5) }),
      });
      const data = await res.json();
      if (data.pdf_base64) {
        setStylePdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
      }
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.ai_message }]);
    } catch (err) { console.error(err); } finally { setIsStyling(false); }
  };

  // --- COVER HANDLERS ---
  const handleStartCover = async () => {
    setIsGeneratingCover(true);
    try {
      const res = await fetch(`${API_URL}/cover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: coverPrompt }),
      });
      const data = await res.json();
      if (data.image_base64) {
        setCoverImageUrl(`data:image/png;base64,${data.image_base64}`);
      }
      setCoverCost(data.cost);
    } catch (err) { console.error(err); } finally { setIsGeneratingCover(false); }
  };

  const handleCoverChat = async () => {
    if (!coverChatInput.trim()) return;
    const newHistory: ChatMessage[] = [...coverChatHistory, { role: 'user', content: coverChatInput }];
    setCoverChatHistory(newHistory); setCoverChatInput(''); setIsGeneratingCover(true);
    try {
      const res = await fetch(`${API_URL}/cover/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: coverChatInput, history: newHistory.slice(-5) }),
      });
      const data = await res.json();
      if (data.image_base64) {
        setCoverImageUrl(`data:image/png;base64,${data.image_base64}`);
      }
      setCoverChatHistory(prev => [...prev, { role: 'assistant', content: data.ai_message || "Done!" }]);
    } catch (err) { console.error(err); } finally { setIsGeneratingCover(false); }
  };

  const downloadCover = () => {
    if (!coverImageUrl) return;
    const a = document.createElement('a');
    a.href = coverImageUrl; a.download = "book_cover.png"; a.click();
  };

  const toggleSection = (id: Section) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-neutral-900 font-sans selection:bg-black selection:text-white transition-all duration-500">

      {/* ── Main content column ── */}
      <main className={`flex-1 min-w-0 transition-all duration-500 pb-20`}>

      {selectedVideoSummary && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border-2 border-black rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50"><h3 className="text-xs font-bold uppercase tracking-tight text-neutral-500">Video Summary</h3><button onClick={() => setSelectedVideoSummary(null)} className="p-1 hover:bg-neutral-200 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="p-8 space-y-4"><div><h4 className="text-base font-bold text-black mb-1">{selectedVideoSummary.title}</h4><p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest">{selectedVideoSummary.duration}</p></div><p className="text-sm text-neutral-600 leading-relaxed italic">"{selectedVideoSummary.summary}"</p></div>
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end"><button onClick={() => setSelectedVideoSummary(null)} className="px-6 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">Close</button></div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b-2 border-neutral-400 px-10 py-4">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center"><Link href="/" className="text-base font-bold tracking-tighter uppercase">AI Summary Maker</Link><UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8 border border-neutral-200 shadow-sm" } }} /></div>
      </header>

      <div className="max-w-[1400px] mx-auto px-10 mt-8 space-y-4">

        {/* SECTION 1: Build */}
        <section className="bg-white border-2 border-neutral-400 rounded-xl shadow-sm overflow-hidden">
          <SectionHeader id="build" title="Build" num="01" expandedSection={expandedSection} onToggle={toggleSection} />
          <div className={`transition-all duration-500 ease-in-out ${expandedSection === 'build' ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
            <div className="p-8">
              <StepWrapper step="input" title="Source & Instructions" currentStep={currentStep}>
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  <div className="flex-1 w-full space-y-8">
                    <div className="space-y-4">
                      <div className="flex gap-4 border-b border-neutral-300 pb-2">{(['yt-video', 'yt-playlist', 'file'] as InputMode[]).map(mode => (<button key={mode} onClick={() => setInputMode(mode)} className={`text-[10px] font-bold uppercase transition-all relative ${inputMode === mode ? 'text-black' : 'text-neutral-300 hover:text-neutral-500'}`}>{mode.replace('-', ' ')}{inputMode === mode && <div className="absolute -bottom-[10px] left-0 right-0 h-0.5 bg-black" />}</button>))}</div>
                      {inputMode !== 'file' && <input type="text" placeholder={inputMode === 'yt-video' ? "Video URL..." : "Playlist URL..."} value={ytLink} onChange={e => setYtLink(e.target.value)} className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-4 py-3 text-sm focus:border-black outline-none transition-all shadow-inner" />}
                      {inputMode === 'file' && (
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-neutral-300 bg-neutral-50/50 rounded-xl p-8 text-center hover:bg-neutral-50 transition-all cursor-pointer relative" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) { const newFiles = Array.from(e.dataTransfer.files).map(f => ({ id: Math.random().toString(36).substr(2, 9), file: f, name: f.name })); setFiles(prev => [...prev, ...newFiles]); } }}><input type="file" multiple accept="audio/*,video/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" /><p className="text-xs font-bold text-neutral-600">Click or drag files here</p><p className="text-[9px] uppercase text-neutral-400 mt-1">Audio / Video</p></div>
                          {files.length > 0 && <div className="space-y-1">{files.map((file, index) => (<div key={file.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={handleDragOver} onDrop={() => handleDrop(index)} className={`group px-3 py-2 flex items-center justify-between border border-neutral-300 rounded-lg bg-white cursor-move transition-all ${draggedIndex === index ? 'opacity-30' : 'hover:border-neutral-500'}`}><div className="flex items-center gap-3"><div className="flex flex-col gap-0.5 opacity-20"><div className="w-3 h-0.5 bg-black" /><div className="w-3 h-0.5 bg-black" /></div><span className="text-xs font-bold text-neutral-700 truncate max-w-xs">{file.name}</span></div><button onClick={() => removeFile(file.id)} className="p-1 hover:bg-red-50 rounded text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button></div>))}</div>}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3"><label className="text-[10px] font-bold uppercase text-neutral-600">Prompt Instructions</label><textarea placeholder="AI instructions..." value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-4 py-3 text-xs min-h-[100px] focus:border-black outline-none transition-all shadow-inner resize-none" /></div>
                  </div>
                  <div className="w-full lg:w-56 flex-shrink-0 lg:sticky lg:top-24"><button onClick={handleProcess} disabled={isLoading} className="w-full py-6 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">{isLoading ? 'Processing...' : 'Process Content'}</button></div>
                </div>
              </StepWrapper>
              <StepWrapper step="config" title="Configuration" currentStep={currentStep}>
                {isLoading ? (<div className="flex items-center gap-3 py-8"><svg className="animate-spin h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-xs text-neutral-400 font-bold uppercase">Analyzing content...</p></div>
                ) : result ? (
                  <div className="flex flex-col lg:flex-row gap-12">
                    <div className="flex-1 space-y-4"><p className="text-[10px] font-bold uppercase text-neutral-500">Detected Media & Summaries</p>
                      {result.videos.length > 1 ? (
                        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm"><table className="w-full text-[11px]"><thead className="bg-neutral-50 border-b border-neutral-200"><tr><th className="px-4 py-3 text-left text-[9px] uppercase text-neutral-400">#</th><th className="px-4 py-3 text-left text-[9px] uppercase text-neutral-400">Title</th><th className="px-4 py-3 text-left text-[9px] uppercase text-neutral-400">Duration</th><th className="px-4 py-3 text-right text-[9px] uppercase text-neutral-400">Preview</th></tr></thead><tbody className="divide-y divide-neutral-100">{result.videos.map((v, i) => (<tr key={i} className="hover:bg-neutral-50 transition-colors"><td className="px-4 py-3 text-neutral-400 font-mono">{i + 1}</td><td className="px-4 py-3 font-bold truncate max-w-[180px]">{v.title}</td><td className="px-4 py-3 text-neutral-500 font-mono">{v.duration}</td><td className="px-4 py-3 text-right"><button onClick={() => setSelectedVideoSummary(v)} className="p-1.5 hover:bg-neutral-200 rounded transition-colors text-black inline-flex items-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button></td></tr>))}</tbody></table></div>
                      ) : (<div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200 flex justify-between items-center"><div><h4 className="text-sm font-bold text-black mb-1">{result.videos[0].title}</h4><p className="text-[11px] font-mono text-neutral-500">{result.videos[0].duration}</p></div><button onClick={() => setSelectedVideoSummary(result.videos[0])} className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg bg-white text-[10px] font-bold uppercase hover:border-black transition-all">Read Summary<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></button></div>)}
                    </div>
                    <div className="lg:w-[45%] space-y-6"><div className="space-y-4"><p className="text-[10px] font-bold uppercase text-neutral-500">Summary Style Selection</p><div className="grid gap-3">{result.summary_options.map(option => (<button key={option.id} onClick={() => setSelectedOption(option.id)} className={`p-4 text-left border-2 rounded-xl transition-all ${selectedOption === option.id ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300'}`}><div className="flex justify-between items-start mb-1"><h4 className="text-sm font-bold text-black">{option.label}</h4><span className="text-xs font-mono text-neutral-400">${option.cost.toFixed(2)}</span></div><p className="text-[11px] text-neutral-500 leading-tight mb-2">{option.description}</p><div className="flex gap-4 text-[9px] uppercase font-bold text-neutral-400"><span>~{option.estimated_time}</span><span>{option.estimated_pages} Pages</span></div></button>))}</div></div>{result.videos.length > 1 && (<div className="pt-4 border-t border-neutral-200"><label className="flex items-center gap-3 cursor-pointer group"><div className="relative flex items-center justify-center"><input type="checkbox" checked={separateChapters} onChange={e => setSeparateChapters(e.target.checked)} className="peer appearance-none w-5 h-5 border-2 border-neutral-300 rounded bg-white checked:bg-black checked:border-black transition-all" /><svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div><span className="text-[11px] font-bold uppercase text-neutral-600 group-hover:text-black transition-colors">Process each video as a separate chapter</span></label></div>)}<button className="w-full py-4 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 transition-all shadow-lg mt-4 active:scale-95" onClick={handleGenerate}>Confirm & Generate Book</button></div>
                  </div>
                ) : <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-8 text-center"><p className="text-[10px] font-bold text-neutral-400 uppercase italic">Awaiting analysis</p></div>}
              </StepWrapper>

              {/* STEP 03: FINAL OUTPUT */}
              <StepWrapper step="process" title="Final Output" currentStep={currentStep} isLast>
                {isGenerating ? (
                  <div className="flex items-center gap-3 py-8"><svg className="animate-spin h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-xs text-neutral-400 font-bold uppercase">Generating...</p></div>
                ) : generatedMd ? (
                  <div className="space-y-0 animate-in fade-in duration-500">

                    {/* Chrome-style Tabs Wrapper */}
                    <div className="flex items-end gap-0.5 px-2 bg-neutral-100 border-x-2 border-t-2 border-neutral-400 rounded-t-xl overflow-x-auto custom-scrollbar pt-2">
                      {generatedMd.files.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedFileIndex(i)}
                          className={`min-w-[140px] max-w-[200px] px-4 py-2 text-[10px] font-bold uppercase tracking-tighter truncate rounded-t-lg transition-all relative flex items-center gap-2 ${selectedFileIndex === i ? 'bg-white text-black border-x border-t border-neutral-300 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10' : 'bg-neutral-200/50 text-neutral-400 hover:bg-neutral-200'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {f.filename}
                          {selectedFileIndex === i && <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-white z-20" />}
                        </button>
                      ))}
                    </div>

                    {/* Viewer Container */}
                    <div className="bg-white border-2 border-neutral-400 rounded-b-xl overflow-hidden flex flex-col h-[750px] shadow-2xl">

                      {/* Control Bar */}
                      <div className="px-6 py-3 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
                        <div className="flex items-center gap-8">
                          <div className="flex gap-4">
                            <button onClick={() => setPreviewMode('preview')} className={`text-[9px] font-bold uppercase transition-all relative ${previewMode === 'preview' ? 'text-black' : 'text-neutral-400 hover:text-neutral-600'}`}>Preview{previewMode === 'preview' && <div className="absolute -bottom-[16px] left-0 right-0 h-0.5 bg-black" />}</button>
                            <button onClick={() => setPreviewMode('edit')} className={`text-[9px] font-bold uppercase transition-all relative ${previewMode === 'edit' ? 'text-black' : 'text-neutral-400 hover:text-neutral-600'}`}>Edit{previewMode === 'edit' && <div className="absolute -bottom-[16px] left-0 right-0 h-0.5 bg-black" />}</button>
                          </div>
                          <div className="h-4 w-px bg-neutral-300" />
                          <div className="flex bg-neutral-200 p-0.5 rounded-lg">
                            <button onClick={() => setViewFormat('md')} className={`px-3 py-1 text-[8px] font-bold uppercase rounded-md transition-all ${viewFormat === 'md' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Markdown</button>
                            <button onClick={() => setViewFormat('txt')} className={`px-3 py-1 text-[8px] font-bold uppercase rounded-md transition-all ${viewFormat === 'txt' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'}`}>Plain Text</button>
                          </div>
                        </div>
                        <button onClick={() => downloadFile(selectedFileIndex)} className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[9px] font-bold uppercase rounded-lg hover:bg-neutral-800 transition-all shadow-lg">Download File</button>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-auto bg-white custom-scrollbar">
                        {previewMode === 'edit' ? (
                          <textarea
                            value={generatedMd.files[selectedFileIndex].content}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGeneratedMd(prev => {
                                if (!prev) return prev;
                                const newFiles = [...prev.files];
                                newFiles[selectedFileIndex] = { ...newFiles[selectedFileIndex], content: val };
                                return { ...prev, files: newFiles };
                              });
                            }}
                            className="w-full h-full p-12 text-sm font-mono text-neutral-700 bg-transparent resize-none focus:outline-none leading-relaxed border-none outline-none ring-0"
                            placeholder="Type your markdown here..."
                          />
                        ) : (
                          <div className="px-8 py-16 max-w-5xl mx-auto">
                            {viewFormat === 'md' ? (
                              <div className="prose prose-neutral prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-neutral-700 prose-p:leading-8 prose-li:text-neutral-700 prose-strong:text-black prose-code:text-pink-600 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-pre:rounded-xl prose-pre:p-4 prose-blockquote:border-l-black prose-blockquote:text-neutral-600 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                  {generatedMd.files[selectedFileIndex].content}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <pre className="whitespace-pre-wrap font-mono text-sm text-neutral-600 leading-relaxed bg-neutral-50 p-10 rounded-2xl border border-neutral-200">
                                {generatedMd.files[selectedFileIndex].content}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-center">
                      <button onClick={() => { setCurrentStep('input'); setResult(null); setGeneratedMd(null); }} className="text-[10px] font-bold uppercase text-neutral-400 hover:text-black transition-colors underline underline-offset-8 decoration-2">Start a new project</button>
                    </div>
                  </div>
                ) : <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-8 text-center"><p className="text-[10px] font-bold text-neutral-400 uppercase italic">Awaiting confirmation</p></div>}
              </StepWrapper>
            </div>
          </div>
        </section>

        {/* SECTION 2: Styling */}
        <section className="bg-white border-2 border-neutral-400 rounded-xl shadow-sm overflow-hidden">
          <SectionHeader id="style" title="Styling" num="02" expandedSection={expandedSection} onToggle={toggleSection} />
          <div className={`transition-all duration-500 ease-in-out ${expandedSection === 'style' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="p-8 space-y-8">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2"><label className="text-[10px] font-bold uppercase text-neutral-500">Styling Instructions</label><input type="text" placeholder="e.g. Modern minimalist..." value={stylePrompt} onChange={e => setStylePrompt(e.target.value)} className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-4 py-3 text-sm focus:border-black outline-none transition-all shadow-inner" /></div>
                <div className="flex items-center gap-4"><div className="text-right"><p className="text-[10px] font-bold uppercase text-neutral-400">Estimate</p><p className="text-sm font-mono font-bold">$1.50</p></div><button onClick={handleStartStyling} disabled={isStyling || !stylePrompt} className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center gap-2">{isStyling ? 'Generating...' : 'Generate PDF'}</button></div>
              </div>
              {stylePdfUrl && (
                <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="lg:w-2/3 space-y-3"><p className="text-[10px] font-bold uppercase text-neutral-500">PDF Preview</p><div className="border-2 border-neutral-200 rounded-xl h-[700px] bg-neutral-100 overflow-hidden relative group">{isStyling && (<div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3"><svg className="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-[10px] font-bold uppercase tracking-widest">Updating styles...</p></div>)}<iframe src={stylePdfUrl} className="w-full h-full border-none" /></div></div>
                  <div className="lg:w-1/3 flex flex-col h-[700px]"><p className="text-[10px] font-bold uppercase text-neutral-500 mb-3">Refinement Chat</p><div className="flex-1 border-2 border-neutral-200 rounded-xl bg-white shadow-sm flex flex-col overflow-hidden"><div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/30 custom-scrollbar">{chatHistory.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-8"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg><p className="text-[10px] font-bold uppercase">Ask AI to tweak the design</p></div>)}{chatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] px-4 py-2 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-neutral-200 text-neutral-700 rounded-tl-none shadow-sm'}`}>{msg.content}</div></div>))}</div><div className="p-4 bg-white border-t border-neutral-100"><div className="relative"><input type="text" placeholder="Tweak style..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleStyleChat()} className="w-full bg-neutral-50 border border-neutral-300 rounded-full px-5 py-3 text-xs pr-12 focus:border-black outline-none transition-all" /><button onClick={handleStyleChat} disabled={isStyling || !chatInput.trim()} className="absolute right-2 top-2 p-1.5 bg-black text-white rounded-full hover:bg-neutral-800 disabled:opacity-30 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9-7-9-7V7l9 7-9 7v-4z" /></svg></button></div><p className="mt-2 text-[8px] uppercase text-neutral-400 text-center font-bold">Press Enter to send</p></div></div></div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 3: Cover */}
        <section className="bg-white border-2 border-neutral-400 rounded-xl shadow-sm overflow-hidden">
          <SectionHeader id="cover" title="Cover" num="03" expandedSection={expandedSection} onToggle={toggleSection} />
          <div className={`transition-all duration-500 ease-in-out ${expandedSection === 'cover' ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="p-8 space-y-8">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold uppercase text-neutral-500">Cover Prompt</label>
                    {result && <span className="text-[9px] font-bold text-neutral-400 uppercase">Working on: <span className="text-black italic">"{result.videos[0].title}"</span></span>}
                  </div>
                  <input type="text" placeholder="e.g. Vintage leather book with golden gears..." value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-4 py-3 text-sm focus:border-black outline-none transition-all shadow-inner" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><p className="text-[10px] font-bold uppercase text-neutral-400">Estimate</p><p className="text-sm font-mono font-bold">$2.00</p></div>
                  <button onClick={handleStartCover} disabled={isGeneratingCover || !coverPrompt} className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center gap-2">{isGeneratingCover ? 'Creating...' : 'Generate Cover'}</button>
                </div>
              </div>

              {coverImageUrl && (
                <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="lg:w-2/3 space-y-4">
                    <p className="text-[10px] font-bold uppercase text-neutral-500">Cover Preview</p>
                    <div className="border-2 border-neutral-200 rounded-2xl aspect-[3/4] max-h-[700px] bg-neutral-100 overflow-hidden relative shadow-inner flex items-center justify-center">
                      {isGeneratingCover && (<div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3"><svg className="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><p className="text-[10px] font-bold uppercase tracking-widest">Reimagining cover...</p></div>)}
                      <img src={coverImageUrl} className="w-full h-full object-cover" alt="Generated Cover" />
                    </div>
                    <div className="flex gap-4">
                      <button onClick={downloadCover} className="flex-1 py-3 bg-neutral-100 text-black text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-200 transition-all border border-neutral-200">Download Cover Only</button>
                      <button onClick={() => { }} className="flex-[2] py-3 bg-black text-white text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-800 transition-all shadow-xl">Download Final Book (.PDF)</button>
                    </div>
                  </div>

                  <div className="lg:w-1/3 flex flex-col h-[700px]">
                    <p className="text-[10px] font-bold uppercase text-neutral-500 mb-3">Refinement Chat</p>
                    <div className="flex-1 border-2 border-neutral-200 rounded-xl bg-white shadow-sm flex flex-col overflow-hidden">
                      <div ref={coverChatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/30 custom-scrollbar">
                        {coverChatHistory.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-8"><svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p className="text-[10px] font-bold uppercase">Change colors, text, or art style</p></div>)}
                        {coverChatHistory.map((msg, i) => (<div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] px-4 py-2 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-white border border-neutral-200 text-neutral-700 rounded-tl-none shadow-sm'}`}>{msg.content}</div></div>))}
                      </div>
                      <div className="p-4 bg-white border-t border-neutral-100">
                        <div className="relative">
                          <input type="text" placeholder="Tweak cover..." value={coverChatInput} onChange={e => setCoverChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCoverChat()} className="w-full bg-neutral-50 border border-neutral-300 rounded-full px-5 py-3 text-xs pr-12 focus:border-black outline-none transition-all" />
                          <button onClick={handleCoverChat} disabled={isGeneratingCover || !coverChatInput.trim()} className="absolute right-2 top-2 p-1.5 bg-black text-white rounded-full hover:bg-neutral-800 disabled:opacity-30 transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9-7-9-7V7l9 7-9 7v-4z" /></svg></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
      <footer className="max-w-[1400px] mx-auto px-10 py-12 flex justify-between items-center opacity-20"><p className="text-[10px] font-bold uppercase tracking-tight">AI System v1.0</p><p className="text-[10px] font-mono">2026.04.30</p></footer>

        {/* Floating Button — only shows when chat is closed */}
        {!isTwinOpen && (
          <button
            onClick={() => setIsTwinOpen(true)}
            className="fixed bottom-8 right-8 z-40 bg-black text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 hover:bg-neutral-800 hover:scale-105 transition-all group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-xs font-bold tracking-widest uppercase">Chat with AI</span>
          </button>
        )}
      </main>

      {/* ── Twin Sidebar — sits BESIDE main content, not on top of it ── */}
      <div
        className={`flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden border-l-2 border-black bg-white ${
          isTwinOpen ? 'w-[400px] opacity-100' : 'w-0 opacity-0 border-l-0'
        }`}
        style={{ minHeight: '100vh' }}
      >
        <div className="w-[400px] h-full">
          <Twin onClose={() => setIsTwinOpen(false)} />
        </div>
      </div>
    </div>
  );
}
