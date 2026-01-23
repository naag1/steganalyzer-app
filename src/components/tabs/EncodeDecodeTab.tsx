'use client';

import * as React from 'react';
import { Upload, Binary, Download, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { encodeLSB, decodeLSB } from '@/lib/stego/codec';

export function EncodeDecodeTab() {
  const [mode, setMode] = React.useState<'encode' | 'decode'>('encode');
  const [image, setImage] = React.useState<string | null>(null);
  const [imageData, setImageData] = React.useState<Uint8ClampedArray | null>(null);
  const [dimensions, setDimensions] = React.useState({ w: 0, h: 0 });
  const [message, setMessage] = React.useState('');
  const [resultImage, setResultImage] = React.useState<string | null>(null);
  const [decodedMessage, setDecodedMessage] = React.useState<string | null>(null);

  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setImageData(ctx.getImageData(0, 0, img.width, img.height).data);
        setDimensions({ w: img.width, h: img.height });
        setImage(event.target?.result as string);
        setResultImage(null);
        setDecodedMessage(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleEncode = () => {
    if (!imageData || !message) return;
    try {
      const encodedData = encodeLSB(imageData, message);
      const canvas = document.createElement('canvas');
      canvas.width = dimensions.w;
      canvas.height = dimensions.h;
      const ctx = canvas.getContext('2d')!;
      const imgDataObj = new ImageData(encodedData, dimensions.w, dimensions.h);
      ctx.putImageData(imgDataObj, 0, 0);
      setResultImage(canvas.toDataURL());
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDecode = () => {
    if (!imageData) return;
    try {
      const msg = decodeLSB(imageData);
      setDecodedMessage(msg || 'No hidden message found.');
    } catch (err: any) {
      alert('Error decoding: ' + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-center">
        <div className="bg-muted p-1 rounded-lg flex gap-1">
          <Button 
            variant={mode === 'encode' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setMode('encode')}
            className="rounded-md"
          >
            Encoding Engine
          </Button>
          <Button 
            variant={mode === 'decode' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setMode('decode')}
            className="rounded-md"
          >
            Decoding Engine
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Upload className="w-4 h-4 text-sidebar-primary" />
              Source Image
            </h3>
            <div 
              className="aspect-video bg-muted/30 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden relative group"
            >
              {image ? (
                <img src={image} className="w-full h-full object-contain" alt="Preview" />
              ) : (
                <div className="text-center p-4">
                  <Binary className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Drop cover image here</p>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={onImageUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer" 
              />
            </div>
            {image && (
              <p className="text-[10px] text-muted-foreground text-center">
                Resolution: {dimensions.w}x{dimensions.h} | Capacity: {Math.floor((dimensions.w * dimensions.h * 3) / 8)} bytes
              </p>
            )}
          </div>

          {mode === 'encode' ? (
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <h3 className="font-bold">Secret Payload</h3>
              <Textarea 
                placeholder="Enter secret message to embed..." 
                className="min-h-[120px] resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button 
                className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90" 
                onClick={handleEncode}
                disabled={!image || !message}
              >
                Execute LSB Encoding
              </Button>
            </div>
          ) : (
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <h3 className="font-bold">Extraction Engine</h3>
              <p className="text-sm text-muted-foreground">
                Orchid Pro will attempt to recover null-terminated LSB strings from the RGB channels.
              </p>
              <Button 
                className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90" 
                onClick={handleDecode}
                disabled={!image}
              >
                Run Decryption
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {mode === 'encode' ? (
            <div className="bg-card border rounded-xl p-6 space-y-4 h-full flex flex-col">
              <h3 className="font-bold flex items-center gap-2 text-sidebar-primary">
                <Download className="w-4 h-4" />
                Stego-Output
              </h3>
              <div className="flex-1 bg-muted/30 rounded-lg border flex items-center justify-center overflow-hidden">
                {resultImage ? (
                  <img src={resultImage} className="w-full h-full object-contain" alt="Result" />
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center p-8">
                    Encoded image will appear here after execution.
                  </p>
                )}
              </div>
              {resultImage && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={resultImage} download="stego_orchid.png">
                    Download Stego Image
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-card border rounded-xl p-6 space-y-4 h-full flex flex-col">
              <h3 className="font-bold flex items-center gap-2 text-sidebar-primary">
                <Eye className="w-4 h-4" />
                Extracted Data
              </h3>
              <div className="flex-1 bg-muted/30 rounded-lg border p-4 font-mono text-sm break-all overflow-y-auto">
                {decodedMessage ? (
                  decodedMessage
                ) : (
                  <p className="text-muted-foreground italic">No data extracted yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
