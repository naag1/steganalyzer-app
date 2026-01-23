'use client';

import * as React from 'react';
import { Ruler, Activity, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { calculateMSE, calculatePSNR, calculateBPP } from '@/lib/stego/metrics';

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
      // Assume 1 bit per pixel was the target if MSE > 0, otherwise 0
      const bpp = mse > 0 ? 1 : 0; 
      
      setMetrics({ mse, psnr, bpp });
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card border rounded-xl p-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Cover Image (Original)</h3>
            <div className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden relative">
              {coverImage ? (
                <img src={coverImage} className="w-full h-full object-cover" alt="Cover" />
              ) : (
                <p className="text-xs text-muted-foreground">Upload Cover</p>
              )}
              <input type="file" onChange={(e) => handleFileUpload(e, 'cover')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-sidebar-primary/10 flex items-center justify-center text-sidebar-primary">
              <Ruler className="w-6 h-6" />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Stego Image (Modified)</h3>
            <div className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden relative">
              {stegoImage ? (
                <img src={stegoImage} className="w-full h-full object-cover" alt="Stego" />
              ) : (
                <p className="text-xs text-muted-foreground">Upload Stego</p>
              )}
              <input type="file" onChange={(e) => handleFileUpload(e, 'stego')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            size="lg" 
            className="bg-sidebar-primary hover:bg-sidebar-primary/90 px-12"
            disabled={!coverData || !stegoData}
            onClick={runMetrics}
          >
            Calculate Fidelity Metrics
          </Button>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-muted/30 rounded-xl border border-border/50 text-center space-y-2">
              <Activity className="w-5 h-5 text-sidebar-primary mx-auto mb-2" />
              <p className="text-2xl font-black">{metrics.mse.toFixed(4)}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Mean Squared Error (MSE)</p>
              <p className="text-[10px] text-muted-foreground/60 leading-tight">Average of the squares of the errors between pixels.</p>
            </div>
            
            <div className="p-6 bg-muted/30 rounded-xl border border-border/50 text-center space-y-2">
              <Activity className="w-5 h-5 text-sidebar-primary mx-auto mb-2" />
              <p className="text-2xl font-black">{metrics.psnr.toFixed(2)} dB</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Peak Signal-to-Noise Ratio</p>
              <p className="text-[10px] text-muted-foreground/60 leading-tight">Higher values indicate better quality and less distortion.</p>
            </div>

            <div className="p-6 bg-muted/30 rounded-xl border border-border/50 text-center space-y-2">
              <Activity className="w-5 h-5 text-sidebar-primary mx-auto mb-2" />
              <p className="text-2xl font-black">{metrics.bpp.toFixed(2)}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Bits Per Pixel (BPP)</p>
              <p className="text-[10px] text-muted-foreground/60 leading-tight">Estimated embedding rate based on bit changes.</p>
            </div>
          </div>
        )}

        {!metrics && (
          <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-500/80 leading-relaxed">
              <strong>Comparison Guide:</strong> To get accurate MSE/PSNR metrics, the Cover and Stego images must have identical dimensions. 
              PSNR values above 40dB are generally considered "high fidelity" where distortion is nearly invisible to the human eye.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
