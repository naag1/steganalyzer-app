'use client';

import * as React from 'react';
import { 
  Upload, 
  ShieldAlert, 
  BarChart, 
  FileSearch, 
  Trash2, 
  Download, 
  Search,
  CheckCircle2,
  AlertTriangle,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { forensicScan } from '@/lib/stego/analysis';
import { calculateMetrics } from '@/lib/stego/metrics';
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

interface AnalysisResult {
  id: string;
  name: string;
  probability: number;
  bpcs?: number[];
  status: 'pending' | 'analyzing' | 'completed';
  detected: boolean;
  type?: string;
  message?: string;
  file: File;
}

export function AnalyzeTab() {
  const [results, setResults] = React.useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [compareImages, setCompareImages] = React.useState<{ cover?: File, stego?: File }>({});
  const [metricsResult, setMetricsResult] = React.useState<{ psnr: number, mse: number } | null>(null);

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newResults: AnalysisResult[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      probability: 0,
      status: 'pending',
      detected: false,
      file: file
    }));

    setResults(prev => [...newResults, ...prev]);
    processFiles(Array.from(files), newResults);
  };

  const processFiles = async (files: File[], metadata: AnalysisResult[]) => {
    setIsAnalyzing(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadata[i];

      setResults(prev => prev.map(r => r.id === meta.id ? { ...r, status: 'analyzing' } : r));

      const scanResult = await forensicScan(file);

      setResults(prev => prev.map(r => r.id === meta.id ? { 
        ...r, 
        ...scanResult,
        status: 'completed'
      } : r));
    }
    
    setIsAnalyzing(false);
  };

  const removeResult = (id: string) => {
    setResults(prev => prev.filter(r => r.id !== id));
  };

  const downloadMessage = (message: string, filename: string) => {
    const blob = new Blob([message], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runMetrics = async () => {
    if (!compareImages.cover || !compareImages.stego) return;
    
    const getImageData = (file: File): Promise<Uint8ClampedArray> => {
      return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, img.width, img.height).data);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    };

    const coverData = await getImageData(compareImages.cover);
    const stegoData = await getImageData(compareImages.stego);
    const metrics = calculateMetrics(coverData, stegoData);
    setMetricsResult(metrics);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      {/* Batch Upload Area */}
      <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white overflow-hidden relative group">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />
        <div className="flex flex-col items-center justify-center gap-6 py-4">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-[#6366f1] group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Forensic Batch Analysis</h2>
            <p className="text-slate-500 max-w-md">
              Upload multiple images or audio files (.wav) for automatic steganographic detection and extraction.
            </p>
          </div>
          <input 
            type="file" 
            multiple 
            onChange={onFileUpload} 
            className="hidden" 
            id="analyze-upload" 
          />
          <Button asChild className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8 rounded-full shadow-lg shadow-indigo-100">
            <label htmlFor="analyze-upload" className="cursor-pointer">Start Batch Scan</label>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Results Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-[#e1e4e8] shadow-sm bg-white">
            <div className="p-4 border-b border-[#e1e4e8] flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[#6366f1]" />
                Recent Scans
              </h3>
              {results.length > 0 && (
                <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                  {results.length} files
                </Badge>
              )}
            </div>
            <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
              {results.length === 0 && (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No files scanned</p>
                </div>
              )}
              {results.map(result => (
                <div 
                  key={result.id} 
                  className={cn(
                    "p-3 rounded-xl border bg-white transition-all duration-200 group relative",
                    result.status === 'completed' && result.detected ? "border-red-100 bg-red-50/30" : "border-[#e1e4e8]"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-700 truncate">{result.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                        {result.type || 'Unknown'}
                      </span>
                    </div>
                    <button 
                      onClick={() => removeResult(result.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {result.status === 'analyzing' ? (
                    <div className="space-y-1">
                      <Progress value={65} className="h-1 bg-slate-100" />
                      <span className="text-[10px] text-[#6366f1] animate-pulse">Analyzing entropy...</span>
                    </div>
                  ) : result.status === 'completed' && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {result.detected ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        )}
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          result.detected ? "text-red-600" : "text-green-600"
                        )}>
                          {result.detected ? 'Steganography Detected' : 'Clean'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Metrics Tool */}
          <Card className="border-[#e1e4e8] shadow-sm bg-white p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <BarChart className="w-4 h-4 text-[#6366f1]" />
              Image Comparison
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Cover Image</label>
                  <input type="file" className="hidden" id="cover-up" onChange={(e) => setCompareImages(p => ({ ...p, cover: e.target.files?.[0] }))} />
                  <Button asChild variant="outline" size="sm" className="w-full h-20 border-dashed text-slate-400 hover:text-[#6366f1]">
                    <label htmlFor="cover-up" className="cursor-pointer flex flex-col items-center justify-center p-2 text-center">
                      <Upload size={14} className="mb-1" />
                      <span className="text-[9px] truncate w-full">{compareImages.cover?.name || 'Select Cover'}</span>
                    </label>
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Stego Image</label>
                  <input type="file" className="hidden" id="stego-up" onChange={(e) => setCompareImages(p => ({ ...p, stego: e.target.files?.[0] }))} />
                  <Button asChild variant="outline" size="sm" className="w-full h-20 border-dashed text-slate-400 hover:text-[#6366f1]">
                    <label htmlFor="stego-up" className="cursor-pointer flex flex-col items-center justify-center p-2 text-center">
                      <Upload size={14} className="mb-1" />
                      <span className="text-[9px] truncate w-full">{compareImages.stego?.name || 'Select Stego'}</span>
                    </label>
                  </Button>
                </div>
              </div>
              <Button 
                onClick={runMetrics} 
                disabled={!compareImages.cover || !compareImages.stego}
                className="w-full bg-[#6366f1] hover:bg-[#4f46e5]"
              >
                Compare Fidelity
              </Button>
              {metricsResult && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">PSNR</p>
                    <p className="text-sm font-black text-slate-700">{metricsResult.psnr.toFixed(2)} dB</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">MSE</p>
                    <p className="text-sm font-black text-slate-700">{metricsResult.mse.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Forensic Detail View */}
        <div className="lg:col-span-2 space-y-6">
          {results.some(r => r.status === 'completed') ? (
            results.filter(r => r.status === 'completed').map(result => (
              <Card key={result.id + '-detail'} className="p-8 border-[#e1e4e8] shadow-sm bg-white relative overflow-hidden">
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 blur-3xl",
                  result.detected ? "bg-red-500" : "bg-green-500"
                )} />
                
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                      <ShieldAlert className={cn("w-6 h-6", result.detected ? "text-red-500" : "text-green-500")} />
                      Forensic Audit: {result.name}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                      Comprehensive multi-algorithm signature scan result.
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={cn(
                      "px-4 py-1 text-sm font-bold uppercase tracking-wider",
                      result.detected ? "bg-red-500 text-white" : "bg-green-500 text-white"
                    )}>
                      {result.detected ? 'Positive Detection' : 'Clean / Negative'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Statistical Probability</h4>
                        <span className={cn("text-lg font-black", result.detected ? "text-red-500" : "text-slate-700")}>
                          {Math.round(result.probability * 100)}%
                        </span>
                      </div>
                      <Progress value={result.probability * 100} className={cn("h-2 bg-slate-100", result.detected ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500")} />
                    </div>

                    {result.bpcs && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <BarChart className="w-3.5 h-3.5" />
                          Bit Plane Complexity (BPCS)
                        </h4>
                        <div className="h-[180px] w-full bg-slate-50/50 rounded-xl p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={result.bpcs.map((v, i) => ({ plane: i, complexity: v }))}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e4e8" />
                              <XAxis dataKey="plane" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                              <YAxis fontSize={10} axisLine={false} tickLine={false} domain={[0, 1]} tick={{ fill: '#94a3b8' }} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e1e4e8', fontSize: '10px' }}
                              />
                              <Bar dataKey="complexity" radius={[4, 4, 0, 0]}>
                                {result.bpcs.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={index < 3 ? '#6366f1' : '#cbd5e1'} />
                                ))}
                              </Bar>
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Technical Signature</h4>
                      <ul className="space-y-3">
                        <li className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Protocol Detection</span>
                          <span className="font-mono font-bold text-slate-700">{result.type || 'Generic LSB'}</span>
                        </li>
                        <li className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Chi-Square Attack</span>
                          <span className="font-mono font-bold text-slate-700">{(result.probability).toFixed(4)}</span>
                        </li>
                        <li className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">StegX Signature Found</span>
                          <span className={cn("font-mono font-bold", result.detected ? "text-red-500" : "text-green-500")}>
                            {result.detected ? 'YES' : 'NO'}
                          </span>
                        </li>
                      </ul>

                      {result.detected && result.message && (
                        <div className="pt-4 border-t border-slate-200">
                          <Button 
                            onClick={() => downloadMessage(result.message!, result.name)}
                            className="w-full bg-[#6366f1] hover:bg-[#4f46e5] flex items-center gap-2 py-6 rounded-xl"
                          >
                            <Download className="w-4 h-4" />
                            Download Hidden Message
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )).reverse()
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-[#e1e4e8] rounded-3xl bg-slate-50/30">
              <FileSearch className="w-16 h-16 text-slate-200 mb-6" />
              <h3 className="text-xl font-bold text-slate-400">Awaiting Forensic Input</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Start by uploading files to the batch analysis area. Detailed forensic insights and extracted data will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
