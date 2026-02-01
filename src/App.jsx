import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert, 
  Send, 
  Trash2, 
  FileText,
  Loader2, 
  CheckCircle2, 
  Copy, 
  Target, 
  Factory, 
  User, 
  Briefcase, 
  Building2, 
  Compass, 
  Zap, 
  LayoutGrid, 
  Globe, 
  FileUp, 
  X, 
  FileCheck 
} from 'lucide-react';

// This logic allows the key to work in both the Gemini preview and on Vercel
const getApiKey = () => {
  try {
    // Check for Vite environment variable first (Vercel)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {
    // Fallback if import.meta is not supported
  }
  return ""; // Default for Gemini Preview environment
};

const apiKey = getApiKey();

const App = () => {
  const [activeTab, setActiveTab] = useState('individual');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [swotData, setSwotData] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);

  const [individualData, setIndividualData] = useState({
    role: '', seniority: '', industry: '', market: '', careerGoal: '', content: ''
  });

  const [businessData, setBusinessData] = useState({
    company: '', productService: '', industry: '', marketRegion: '', customerSegment: '', valueProposition: '', website: '', content: ''
  });

  useEffect(() => {
    const scripts = [
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
      "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"
    ];
    scripts.forEach(src => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.head.appendChild(script);
      }
    });
    const checkInterval = setInterval(() => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        clearInterval(checkInterval);
      }
    }, 1000);
    return () => clearInterval(checkInterval);
  }, []);

  const handleInputChange = (tab, field, value) => {
    if (tab === 'individual') {
      setIndividualData(prev => ({ ...prev, [field]: value }));
    } else {
      setBusinessData(prev => ({ ...prev, [field]: value }));
    }
  };

  const extractTextFromPDF = async (arrayBuffer) => {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF library not loaded yet.");
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  };

  const extractTextFromWord = async (arrayBuffer) => {
    const mammoth = window.mammoth;
    if (!mammoth) throw new Error("Word library not loaded yet.");
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setParsing(true);
    setError(null);
    setFileName(file.name);
    try {
      const extension = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();
      const onTextExtracted = (text) => {
        handleInputChange(activeTab, 'content', text);
        setParsing(false);
      };
      if (extension === 'pdf') {
        reader.onload = async (event) => {
          try {
            const text = await extractTextFromPDF(event.target.result);
            onTextExtracted(text);
          } catch (err) {
            setError(err.message || "Error parsing PDF.");
            setParsing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (extension === 'docx') {
        reader.onload = async (event) => {
          try {
            const text = await extractTextFromWord(event.target.result);
            onTextExtracted(text);
          } catch (err) {
            setError(err.message || "Error parsing Word.");
            setParsing(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (event) => onTextExtracted(event.target.result);
        reader.readAsText(file);
      }
    } catch (err) {
      setError("Failed to process file.");
      setParsing(false);
    }
  };

  const classifySWOT = async () => {
    const data = activeTab === 'individual' ? individualData : businessData;
    const contentToAnalyze = data.content.trim();
    if (!contentToAnalyze) {
      setError("Please provide text or upload a document to analyze.");
      return;
    }
    setLoading(true);
    setError(null);

    const systemPrompt = `
      You are an expert strategic analyst. Perform a deep SWOT analysis.
      CRITICAL: Provide exactly 6 to 7 points per category. 
      At least 2 points per category must be a "Very Deep Strategic Analysis" (detailed paragraph).
      ${activeTab === 'individual' 
        ? `Context: ${data.role} (${data.seniority}) in ${data.industry}. Goal: ${data.careerGoal}` 
        : `Context: ${data.company} in ${data.industry}. Value Prop: ${data.valueProposition}`}
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: contentToAnalyze }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                strengths: { type: "ARRAY", items: { type: "STRING" } },
                weaknesses: { type: "ARRAY", items: { type: "STRING" } },
                opportunities: { type: "ARRAY", items: { type: "STRING" } },
                threats: { type: "ARRAY", items: { type: "STRING" } },
                summary: { type: "STRING" }
              }
            }
          }
        })
      });
      if (!response.ok) throw new Error('API failed');
      const result = await response.json();
      setSwotData(JSON.parse(result.candidates[0].content.parts[0].text));
    } catch (err) {
      setError("Analysis failed. Ensure your API Key is set in Vercel.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!swotData) return;
    const text = `Ai SWOT Analysis\nSummary: ${swotData.summary}\n\nSTRENGTHS:\n${swotData.strengths.join('\n')}\n\nWEAKNESSES:\n${swotData.weaknesses.join('\n')}\n\nOPPORTUNITIES:\n${swotData.opportunities.join('\n')}\n\nTHREATS:\n${swotData.threats.join('\n')}`;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  };

  const clearAll = () => {
    if (activeTab === 'individual') setIndividualData({ role: '', seniority: '', industry: '', market: '', careerGoal: '', content: '' });
    else setBusinessData({ company: '', productService: '', industry: '', marketRegion: '', customerSegment: '', valueProposition: '', website: '', content: '' });
    setSwotData(null); setError(null); setFileName(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-black text-slate-800 flex items-center justify-center gap-3 tracking-tighter text-center leading-tight">
            <LayoutGrid className="w-10 h-10 text-indigo-600" />
            Ai SWOT Analysis
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">Strategic depth for career and corporate intelligence.</p>
          <div className="mt-2 inline-flex items-center px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Powered by Kepler Ai</span>
          </div>
        </header>

        <div className="flex justify-center mb-8">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex">
            <button onClick={() => { setActiveTab('individual'); setSwotData(null); setFileName(null); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'individual' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}><User className="w-4 h-4" /> Career Mode</button>
            <button onClick={() => { setActiveTab('business'); setSwotData(null); setFileName(null); }} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'business' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 className="w-4 h-4" /> Business Mode</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-5">
              {activeTab === 'individual' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Role" icon={<Briefcase size={14} />} value={individualData.role} onChange={(v) => handleInputChange('individual', 'role', v)} />
                    <InputField label="Seniority" icon={<Zap size={14} />} value={individualData.seniority} onChange={(v) => handleInputChange('individual', 'seniority', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Industry" icon={<Factory size={14} />} value={individualData.industry} onChange={(v) => handleInputChange('individual', 'industry', v)} />
                    <InputField label="Market" icon={<Target size={14} />} value={individualData.market} onChange={(v) => handleInputChange('individual', 'market', v)} />
                  </div>
                  <InputField label="Career Goal" icon={<Compass size={14} />} value={individualData.careerGoal} onChange={(v) => handleInputChange('individual', 'careerGoal', v)} />
                  <FileUpload fileName={fileName} parsing={parsing} onUpload={handleFileUpload} onRemove={() => { setFileName(null); handleInputChange('individual', 'content', ''); }} ref={fileInputRef} label="Upload CV" />
                  <TextAreaField label="Strategic Input" value={individualData.content} onChange={(v) => handleInputChange('individual', 'content', v)} placeholder="Deep analysis input..." />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Company" icon={<Building2 size={14} />} value={businessData.company} onChange={(v) => handleInputChange('business', 'company', v)} />
                    <InputField label="Website" icon={<Globe size={14} />} value={businessData.website} onChange={(v) => handleInputChange('business', 'website', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Product" icon={<Zap size={14} />} value={businessData.productService} onChange={(v) => handleInputChange('business', 'productService', v)} />
                    <InputField label="Industry" icon={<Factory size={14} />} value={businessData.industry} onChange={(v) => handleInputChange('business', 'industry', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Market" icon={<Target size={14} />} value={businessData.marketRegion} onChange={(v) => handleInputChange('business', 'marketRegion', v)} />
                    <InputField label="Customers" icon={<User size={14} />} value={businessData.customerSegment} onChange={(v) => handleInputChange('business', 'customerSegment', v)} />
                  </div>
                  <InputField label="Value Proposition" icon={<ShieldCheck size={14} />} value={businessData.valueProposition} onChange={(v) => handleInputChange('business', 'valueProposition', v)} />
                  <FileUpload fileName={fileName} parsing={parsing} onUpload={handleFileUpload} onRemove={() => { setFileName(null); handleInputChange('business', 'content', ''); }} ref={fileInputRef} label="Upload Portfolio" />
                  <TextAreaField label="Strategic Data" value={businessData.content} onChange={(v) => handleInputChange('business', 'content', v)} placeholder="Paste data for deep segmentation..." />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={classifySWOT} disabled={loading || parsing} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-sm shadow-xl shadow-indigo-100">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Run your Ai SWOT Analysis</>}
                </button>
                <button onClick={clearAll} className="px-5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-slate-100"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm flex items-start gap-3 animate-in fade-in zoom-in duration-300"><AlertTriangle className="w-5 h-5 flex-shrink-0" /> {error}</div>}
          </div>

          <div className="lg:col-span-7">
            {!swotData && !loading ? (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center bg-slate-50/50 transition-all">
                <div className="bg-white p-6 rounded-full shadow-sm mb-6">{activeTab === 'individual' ? <Briefcase className="w-16 h-16 text-slate-200" /> : <Building2 className="w-16 h-16 text-slate-200" />}</div>
                <h3 className="text-xl font-bold text-slate-600 mb-2 tracking-tight">Advanced SWOT Ready</h3>
                <p className="text-sm max-w-sm font-medium leading-relaxed">Fill in the context and provide data to receive a high-depth 6-7 point analysis.</p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center space-y-6 h-full min-h-[600px]">
                <div className="relative"><div className="w-24 h-24 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div><Target className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" /></div>
                <div className="text-center"><p className="text-xl font-black text-slate-800 tracking-tight">Performing Strategic Evaluation...</p><p className="text-slate-400 font-medium italic">Generating 6-7 points per category</p></div>
              </div>
            ) : swotData && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700 pb-20">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                  <button onClick={copyToClipboard} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"><Copy className="w-5 h-5" /></button>
                  <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-emerald-500" /> Strategic Intelligence</h2>
                  <p className="text-slate-600 leading-relaxed font-semibold italic">{swotData.summary}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SWOTCard title="Strengths" items={swotData.strengths} icon={<ShieldCheck className="w-6 h-6" />} color="emerald" />
                  <SWOTCard title="Weaknesses" items={swotData.weaknesses} icon={<AlertTriangle className="w-6 h-6" />} color="amber" />
                  <SWOTCard title="Opportunities" items={swotData.opportunities} icon={<TrendingUp className="w-6 h-6" />} color="blue" />
                  <SWOTCard title="Threats" items={swotData.threats} icon={<ShieldAlert className="w-6 h-6" />} color="red" />
                </div>
              </div>
            )}
          </div>
        </div>
        <footer className="mt-12 text-center pb-8"><p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Powered by Kepler Ai</p></footer>
      </div>
    </div>
  );
};

const InputField = ({ label, icon, value, onChange }) => (
  <div>
    <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1"><span className="text-indigo-500">{icon}</span> {label}</label>
    <input type="text" placeholder={`Enter ${label}`} className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold bg-slate-50/50 focus:bg-white" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const TextAreaField = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 px-1">{label}</label>
    <textarea className="w-full h-40 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none text-sm leading-relaxed font-medium bg-slate-50/50 focus:bg-white" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const FileUpload = React.forwardRef(({ fileName, parsing, onUpload, onRemove, label }, ref) => (
  <div className="relative mt-2">
    <input type="file" ref={ref} onChange={onUpload} className="hidden" accept=".pdf,.docx,.txt" />
    {!fileName ? (
      <button onClick={() => ref.current.click()} className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group">
        <FileUp className="w-6 h-6 text-slate-300 group-hover:text-indigo-600" />
        <span className="text-xs font-bold text-slate-500">{label} (PDF/Word)</span>
      </button>
    ) : (
      <div className="w-full border-2 border-indigo-100 bg-indigo-50/50 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-indigo-200 rounded-lg">{parsing ? <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /> : <FileCheck className="w-4 h-4 text-indigo-600" />}</div>
          <span className="text-xs font-bold text-indigo-900 truncate">{fileName}</span>
        </div>
        <button onClick={onRemove} className="p-1.5 text-indigo-400 hover:text-red-500"><X size={16} /></button>
      </div>
    )}
  </div>
));

const SWOTCard = ({ title, items = [], icon, color }) => {
  const styles = { emerald: "bg-emerald-50 text-emerald-700 icon-emerald-500 bar-emerald-500", amber: "bg-amber-50 text-amber-700 icon-amber-500 bar-amber-500", blue: "bg-blue-50 text-blue-700 icon-blue-500 bar-blue-500", red: "bg-red-50 text-red-700 icon-red-500 bar-red-500" };
  const current = styles[color];
  const barClass = current.split(' ').pop();
  const bgClass = current.split(' ')[0];
  const textClass = current.split(' ')[1];
  const iconClass = current.split(' ')[2];

  return (
    <div className="rounded-[2.5rem] border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden transition-all hover:border-slate-300 hover:shadow-md h-full">
      <div className={`h-1.5 w-full ${barClass}`}></div>
      <div className="p-7">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${bgClass} ${iconClass}`}>{icon}</div>
            <h3 className="font-black text-lg text-slate-800 tracking-tight">{title}</h3>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${bgClass} ${textClass}`}>{items.length} Points</span>
        </div>
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 group">
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${barClass} opacity-40 group-hover:opacity-100`}></div>
              <p className="text-sm text-slate-700 leading-relaxed font-bold group-hover:text-slate-900">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
