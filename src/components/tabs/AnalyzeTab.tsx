'use client';

import * as React from 'react';
import { Upload, ShieldAlert, BarChart, FileSearch, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { chiSquareAttack, calculateBPCS } from '@/lib/stego/analysis';
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

interface AnalysisResult {
  id: string;
  name: string;
  probability: number;
  bpcs: number[];
  status: 'pending' | 'analyzing' | 'completed';
}

export function AnalyzeTab() {
  const [results, setResults] = React.useState<AnalysisResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newResults: AnalysisResult[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      probability: 0,
      bpcs: [],
      status: 'pending'
    }));

    setResults(prev => [...prev, ...newResults]);
    processFiles(Array.from(files), newResults);
  };

  const processFiles = async (files: File[], metadata: AnalysisResult[]) => {
    setIsAnalyzing(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metadata[i];

      updateResultStatus(meta.id, 'analyzing');

      const img = new Image();
      const reader = new FileReader();

      const analysisPromise = new Promise<void>((resolve) => {
        reader.onload = (e) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

            const prob = chiSquareAttack(imageData);
            const bpcs = calculateBPCS(imageData);

            updateResult(meta.id, {
              probability: prob,
              bpcs: bpcs,
              status: 'completed'
            });
            resolve();
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      await analysisPromise;
    }
    
    setIsAnalyzing(false);
  };

  const updateResultStatus = (id: string, status: AnalysisResult['status']) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const updateResult = (id: string, data: Partial<AnalysisResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  };

  const removeResult = (id: string) => {
    setResults(prev => prev.filter(r => r.id !== id));
  };

  const getRiskColor = (prob: number) => {
    if (prob > 0.7) return 'text-destructive';
    if (prob > 0.3) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div className="p-6 rounded-xl border-2 border-dashed border-border hover:border-sidebar-primary/50 transition-colors flex flex-col items-center justify-center gap-4 bg-card/50">
            <div className="w-12 h-12 rounded-full bg-sidebar-primary/10 flex items-center justify-center text-sidebar-primary">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-center">
              <p className="font-medium">Upload Forensic Batch</p>
              <p className="text-xs text-muted-foreground mt-1">Images or .txt files supported</p>
            </div>
            <input 
              type="file" 
              multiple 
              onChange={onFileUpload} 
              className="hidden" 
              id="analyze-upload" 
            />
            <Button asChild variant="outline" size="sm">
              <label htmlFor="analyze-upload" className="cursor-pointer">Browse Files</label>
            </Button>
          </div>

          <div className="bg-card border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-sidebar-primary" />
              Scan History
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No files scanned yet.</p>
              )}
              {results.map(result => (
                <div key={result.id} className="p-3 rounded-lg border bg-background group relative transition-all hover:ring-1 hover:ring-sidebar-primary/30">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium truncate max-w-[150px]">{result.name}</span>
                    <button 
                      onClick={() => removeResult(result.id)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {result.status === 'analyzing' ? (
                    <Progress value={45} className="h-1" />
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold", getRiskColor(result.probability))}>
                        {Math.round(result.probability * 100)}% Probability
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {result.probability > 0.5 ? 'Suspicious' : 'Clean'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {results.length > 0 ? (
            results.map(result => result.status === 'completed' ? (
              <div key={result.id + '-detail'} className="bg-card border rounded-xl p-6 space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <ShieldAlert className={cn("w-5 h-5", getRiskColor(result.probability))} />
                      Analysis: {result.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">Forensic identification complete</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-2xl font-black", getRiskColor(result.probability))}>
                      {Math.round(result.probability * 100)}%
                    </span>
                    <p className="text-[10px] uppercase tracking-widest font-bold">Risk Score</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <BarChart className="w-4 h-4" />
                      BPCS Bit Plane Complexity
                    </h4>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart data={result.bpcs.map((v, i) => ({ plane: i, complexity: v }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="plane" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} domain={[0, 1]} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontSize: '10px' }}
                          />
                          <Bar dataKey="complexity" radius={[4, 4, 0, 0]}>
                            {result.bpcs.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--sidebar-primary)' : 'hsl(var(--muted-foreground))'} />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold">Forensic Findings</h4>
                    <ul className="space-y-2">
                      <li className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <span>Chi-Square Probability</span>
                        <span className="font-mono">{(result.probability).toFixed(4)}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <span>High Complexity Planes</span>
                        <span className="font-mono">{result.bpcs.filter(v => v > 0.4).length}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <span>LSB Anomaly Detected</span>
                        <span className="font-mono">{result.probability > 0.4 ? 'YES' : 'NO'}</span>
                      </li>
                      <li className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                        <span>Visual Artifacts</span>
                        <span className="font-mono">NONE</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : null).reverse()
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed rounded-xl bg-card/30">
              <FileSearch className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Ready for Investigation</h3>
              <p className="text-sm text-muted-foreground/60 max-w-md mx-auto mt-2">
                Upload images or text files to begin the forensic steganalysis process. Orchid Pro will perform multi-layered statistical attacks.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
