'use client';

import * as React from 'react';
import { Ruler, Activity, Info, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { calculateMSE, calculatePSNR } from '@/lib/stego/metrics';

export function MetricsTab() {
  const [coverImage, setCoverImage] = React.useState<string | null>(null);
  const [stegoImage, setStegoImage] = React.useState<string | null>(null);
  const [coverData, setCoverData] = React.useState<Uint8ClampedArray | null>(null);
  const [stegoData, setStegoData] = React.useState<Uint8ClampedArray | null>(null);
  const [metrics, setMetrics] = React.useState<{ mse: number; psnr: number; bpp: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'stego') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        
        if (type === 'cover') {
          setCoverImage(event.target?.result as string);
          setCoverData(data);
        } else {
          setStegoImage(event.target?.result as string);
          setStegoData(data);
        }
        setMetrics(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const runMetrics = () => {
    if (!coverData || !stegoData) return;
    try {
      const mse = calculateMSE(coverData, stegoData);
      const psnr = calculatePSNR(mse);
      const bpp = mse > 0 ? 1 : 0; 
      
      setMetrics({ mse, psnr, bpp });
    } catch (err) {
      const error = err as Error;
      alert(error.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />
        
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">Cover Image (Original)</h3>
            <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] flex items-center justify-center overflow-hidden relative group hover:border-[#6366f1]/50 transition-all">
              {coverImage ? (
                <img src={coverImage} className="w-full h-full object-cover" alt="Cover" />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-[#6366f1] transition-colors" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Upload Cover</p>
                </div>
              )}
              <input type="file" onChange={(e) => handleFileUpload(e, 'cover')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
              <Ruler className="w-6 h-6" />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400">Stego Image (Modified)</h3>
            <div className="aspect-square bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] flex items-center justify-center overflow-hidden relative group hover:border-[#6366f1]/50 transition-all">
              {stegoImage ? (
                <img src={stegoImage} className="w-full h-full object-cover" alt="Stego" />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-[#6366f1] transition-colors" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Upload Stego</p>
                </div>
              )}
              <input type="file" onChange={(e) => handleFileUpload(e, 'stego')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={runMetrics}
            disabled={!coverData || !stegoData}
            className="bg-[#6366f1] hover:bg-[#4f46e5] px-12 h-14 rounded-xl font-bold text-lg shadow-lg shadow-indigo-100"
          >
            Calculate Fidelity Metrics
          </Button>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
              <Activity className="w-5 h-5 text-[#6366f1] mx-auto mb-2" />
              <p className="text-2xl font-black text-slate-900">{metrics.mse.toFixed(4)}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Mean Squared Error</p>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
              <Activity className="w-5 h-5 text-[#6366f1] mx-auto mb-2" />
              <p className="text-2xl font-black text-slate-900">{metrics.psnr.toFixed(2)} dB</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Peak Signal-to-Noise Ratio</p>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2">
              <Activity className="w-5 h-5 text-[#6366f1] mx-auto mb-2" />
              <p className="text-2xl font-black text-slate-900">{metrics.bpp.toFixed(2)}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Bits Per Pixel (Est.)</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <Info className="w-5 h-5 text-[#6366f1] shrink-0 mt-0.5" />
          <div className="text-xs text-slate-500 leading-relaxed">
            <strong className="text-slate-900 block mb-1">Comparison Protocol:</strong>
            To calculate PSNR/MSE, images must have identical dimensions. 
            PSNR values above 40dB indicate high visual fidelity. Values below 30dB suggest significant statistical deviation likely detectable by forensic tools.
          </div>
        </div>
      </Card>
    </div>
  );
}
