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
import { forensicScan, getBitPlane } from '@/lib/stego/analysis';
import { calculateMetrics } from '@/lib/stego/metrics';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  metrics?: { psnr: number, mse: number };
  bitPlane?: string;
}

export function AnalyzeTab() {
  const [results, setResults] = React.useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [referenceFile, setReferenceFile] = React.useState<File | null>(null);
  const [selectedBitPlane, setSelectedBitPlane] = React.useState<string | null>(null);

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
    
    // Get reference data if available
    let referenceData: Uint8ClampedArray | null = null;
    if (referenceFile) {
      referenceData = await getImageData(referenceFile);
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadata[i];

      setResults(prev => prev.map(r => r.id === meta.id ? { ...r, status: 'analyzing' } : r));

      const scanResult = await forensicScan(file);
      let metrics;

      if (referenceData && file.type.startsWith('image/')) {
        const stegoData = await getImageData(file);
        try {
          metrics = calculateMetrics(referenceData, stegoData);
        } catch (e) {
          console.warn('Reference dimensions mismatch for', file.name);
        }
      }

      setResults(prev => prev.map(r => r.id === meta.id ? { 
        ...r, 
        ...scanResult,
        metrics,
        status: 'completed'
      } : r));
    }
    
    setIsAnalyzing(false);
  };

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

  const showBitPlane = async (result: AnalysisResult) => {
    const data = await getImageData(result.file);
    const plane = getBitPlane(data, 0); // LSB
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(new ImageData(plane, img.width, img.height), 0, 0);
      setSelectedBitPlane(canvas.toDataURL());
    };
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target?.result as string; };
    reader.readAsDataURL(result.file);
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

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Half: Batch Analysis & Recent Scans */}
          <div className="space-y-6">
            <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />
              <div className="flex flex-col items-center justify-center gap-6 py-4">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-[#6366f1] group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900">Batch Analysis</h2>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Upload multiple files for automatic detection and extraction.
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block text-center">
                    Optional: Reference Image (for PSNR/MSE)
                  </label>
                  <input 
                    type="file" 
                    onChange={(e) => setReferenceFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-[#6366f1] hover:file:bg-indigo-100 w-full"
                  />
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
            <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
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
                      <span className="text-[10px] text-[#6366f1] animate-pulse">Analyzing...</span>
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
        </div>

        {/* Right Half: Analysis Output */}
        <div className="space-y-6">
          {results.some(r => r.status === 'completed') ? (
            results.filter(r => r.status === 'completed').map(result => (
              <Card key={result.id + '-detail'} className="p-8 border-[#e1e4e8] shadow-sm bg-white relative overflow-hidden">
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-10 blur-3xl",
                  result.detected ? "bg-red-500" : "bg-green-500"
                )} />
                
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                      <ShieldAlert className={cn("w-5 h-5", result.detected ? "text-red-500" : "text-green-500")} />
                      {result.name}
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">
                      Forensic signature scan result.
                    </p>
                  </div>
                  <div>
                    <Badge className={cn(
                      "px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                      result.detected ? "bg-red-500 text-white" : "bg-green-500 text-white"
                    )}>
                      {result.detected ? 'Positive' : 'Negative'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statistical Probability</h4>
                      <span className={cn("text-base font-black", result.detected ? "text-red-500" : "text-slate-700")}>
                        {Math.round(result.probability * 100)}%
                      </span>
                    </div>
                    <Progress value={result.probability * 100} className={cn("h-2 bg-slate-100", result.detected ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500")} />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Technical Signature</h4>
                    <ul className="space-y-2">
                      <li className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Protocol</span>
                        <span className="font-mono font-bold text-slate-700">{result.type || 'Generic LSB'}</span>
                      </li>
                        <li className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Chi-Square</span>
                          <span className="font-mono font-bold text-slate-700">{(result.probability).toFixed(4)}</span>
                        </li>
                        {result.metrics && (
                          <>
                            <li className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">PSNR</span>
                              <span className="font-mono font-bold text-[#6366f1]">{result.metrics.psnr.toFixed(2)} dB</span>
                            </li>
                            <li className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500">MSE</span>
                              <span className="font-mono font-bold text-[#6366f1]">{result.metrics.mse.toFixed(4)}</span>
                            </li>
                          </>
                        )}
                      </ul>

                      <div className="flex gap-2 pt-2">
                        {result.file.type.startsWith('image/') && (
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => showBitPlane(result)}
                            className="flex-1 text-[10px] h-8 border-[#e1e4e8] hover:border-[#6366f1] hover:text-[#6366f1]"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Bit-Plane View
                          </Button>
                        )}
                        {result.detected && result.message && (
                          <Button 
                            onClick={() => downloadMessage(result.message!, result.name)}
                            className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] h-8 text-[10px]"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download Payload
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )).reverse()
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-[#e1e4e8] rounded-3xl bg-slate-50/30">
                <FileSearch className="w-12 h-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-400">Analysis Results</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">
                  Scan output will appear here after processing.
                </p>
              </div>
            )}
          </div>
        </div>

        <Dialog open={!!selectedBitPlane} onOpenChange={() => setSelectedBitPlane(null)}>
          <DialogContent className="max-w-4xl bg-white border-[#e1e4e8]">
            <DialogHeader>
              <DialogTitle className="text-slate-900">LSB Bit-Plane Visualization</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
              {selectedBitPlane && (
                <div className="relative group bg-slate-950 rounded-xl overflow-hidden border border-slate-800 p-2 shadow-2xl">
                  <img src={selectedBitPlane} className="max-h-[70vh] object-contain image-pixelated" alt="Bit Plane" />
                </div>
              )}
              <p className="text-xs text-slate-500 text-center max-w-md">
                This visualization displays the Least Significant Bit (LSB) of each pixel. High entropy or recognizable patterns in this plane often indicate steganographic embedding.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

