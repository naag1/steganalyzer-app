'use client';

import * as React from 'react';
import { Upload, Binary, Download, Eye, Music, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  encodeLSB,
  decodeLSB,
  encodeAudioLSB,
  decodeAudioLSB,
  encodeImageInImage,
  decodeImageInImage,
} from '@/lib/stego';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function EncodeDecodeTab() {
  const [activeTab, setActiveTab]           = React.useState<'encode' | 'extract'>('encode');
  const [mode, setMode]                     = React.useState<'text' | 'image'>('text');
  const [file, setFile]                     = React.useState<File | null>(null);
  const [secretFile, setSecretFile]         = React.useState<File | null>(null);
  const [preview, setPreview]               = React.useState<string | null>(null);
  const [secretPreview, setSecretPreview]   = React.useState<string | null>(null);
  const [message, setMessage]               = React.useState('');
  const [resultUrl, setResultUrl]           = React.useState<string | null>(null);
  // FIX: track whether the encoded output is audio so download filename & preview
  // are chosen correctly — the original code always used .png / <img> regardless.
  const [resultIsAudio, setResultIsAudio]   = React.useState(false);
  const [extractedData, setExtractedData]   = React.useState<string | null>(null);
  const [extractedImage, setExtractedImage] = React.useState<string | null>(null);
  const [isProcessing, setIsProcessing]     = React.useState(false);
  const [error, setError]                   = React.useState<string | null>(null);

  // Revoke previous object URLs to avoid memory leaks
  const prevResultUrl = React.useRef<string | null>(null);
  React.useEffect(() => {
    return () => {
      if (prevResultUrl.current?.startsWith('blob:')) {
        URL.revokeObjectURL(prevResultUrl.current);
      }
    };
  }, []);

  const setResult = (url: string | null, isAudio: boolean) => {
    if (prevResultUrl.current?.startsWith('blob:')) {
      URL.revokeObjectURL(prevResultUrl.current);
    }
    prevResultUrl.current = url;
    setResultUrl(url);
    setResultIsAudio(isAudio);
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isSecret = false) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setError(null);

    if (isSecret) {
      setSecretFile(uploadedFile);
      if (uploadedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setSecretPreview(ev.target?.result as string);
        reader.readAsDataURL(uploadedFile);
      }
    } else {
      setFile(uploadedFile);
      setResult(null, false);
      setExtractedData(null);
      setExtractedImage(null);

      if (uploadedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => setPreview(ev.target?.result as string);
        reader.readAsDataURL(uploadedFile);
      } else {
        setPreview(null); // clear stale image preview when switching to audio
      }
    }

    // Reset input value so the same file can be re-selected after a change
    e.target.value = '';
  };

  const handleAction = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    try {
      if (activeTab === 'encode') {
        if (mode === 'text') {
          if (!message.trim()) throw new Error('Message cannot be empty');

          if (file.type.startsWith('image/')) {
            // Image LSB encode
            await new Promise<void>((resolve, reject) => {
              const img = new Image();
              img.onerror = () => reject(new Error('Failed to load image'));
              img.onload = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width  = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d')!;
                  ctx.drawImage(img, 0, 0);
                  const imageData = ctx.getImageData(0, 0, img.width, img.height);
                  const encoded   = encodeLSB(imageData.data, message);
                  ctx.putImageData(new ImageData(encoded, img.width, img.height), 0, 0);
                  setResult(canvas.toDataURL('image/png'), false);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              };
              img.src = preview!;
            });

          } else if (file.type === 'audio/wav') {
            // Audio LSB encode
            const buffer        = await file.arrayBuffer();
            const encodedBuffer = await encodeAudioLSB(buffer, message);
            const blob          = new Blob([encodedBuffer], { type: 'audio/wav' });
            setResult(URL.createObjectURL(blob), true);
          } else {
            throw new Error('Unsupported file type. Use an image or a WAV file.');
          }

        } else if (mode === 'image') {
          // Image-in-Image encode
          if (!secretFile) throw new Error('Secret image is required');
          if (!file.type.startsWith('image/'))  throw new Error('Cover file must be an image');
          if (!secretFile.type.startsWith('image/')) throw new Error('Secret file must be an image');

          await new Promise<void>((resolve, reject) => {
            const coverImg  = new Image();
            const secretImg = new Image();
            let loadCount   = 0;

            const onLoad = () => {
              if (++loadCount < 2) return;
              try {
                const canvas = document.createElement('canvas');
                canvas.width  = coverImg.width;
                canvas.height = coverImg.height;
                const ctx = canvas.getContext('2d')!;

                ctx.drawImage(coverImg, 0, 0);
                const coverData = ctx.getImageData(0, 0, coverImg.width, coverImg.height);

                // FIX: draw secret at its OWN dimensions, not cover dimensions.
                // The header stores secretImg.width/height, so the decoder allocates
                // a buffer of exactly secretImg.width * secretImg.height pixels.
                // If we had scaled the secret to cover size, the decoder would read
                // the wrong number of pixels and reconstruct a black/scrambled image.
                const canvas2 = document.createElement('canvas');
                canvas2.width  = secretImg.width;
                canvas2.height = secretImg.height;
                const ctx2 = canvas2.getContext('2d')!;
                ctx2.drawImage(secretImg, 0, 0, secretImg.width, secretImg.height);
                const secretData = ctx2.getImageData(0, 0, secretImg.width, secretImg.height);

                const encoded = encodeImageInImage(
                  coverData.data,
                  secretData.data,
                  secretImg.width,
                  secretImg.height,
                );
                ctx.putImageData(new ImageData(encoded, coverImg.width, coverImg.height), 0, 0);
                setResult(canvas.toDataURL('image/png'), false);
                resolve();
              } catch (err) {
                reject(err);
              }
            };

            coverImg.onerror  = () => reject(new Error('Failed to load cover image'));
            secretImg.onerror = () => reject(new Error('Failed to load secret image'));
            coverImg.onload   = onLoad;
            secretImg.onload  = onLoad;
            coverImg.src      = preview!;
            secretImg.src     = secretPreview!;
          });
        }

      } else {
        // ── Extraction ────────────────────────────────────────────────────────
        if (file.type.startsWith('image/')) {
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.onload  = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width  = img.width;
                canvas.height = img.height;
                const ctx     = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

                // Try LSB text first
                const textResult = decodeLSB(imageData);
                if (textResult.detected && textResult.message) {
                  setExtractedData(textResult.message);
                  return resolve();
                }

                // Fall back to Image-in-Image
                const imgResult = decodeImageInImage(imageData);
                if (imgResult) {
                  const outCanvas = document.createElement('canvas');
                  outCanvas.width  = imgResult.width;
                  outCanvas.height = imgResult.height;
                  outCanvas.getContext('2d')!.putImageData(
                    new ImageData(imgResult.data, imgResult.width, imgResult.height),
                    0, 0,
                  );
                  setExtractedImage(outCanvas.toDataURL('image/png'));
                  setExtractedData(`Image payload extracted — ${imgResult.width}×${imgResult.height}px`);
                } else {
                  setExtractedData('No StegX signature or valid image payload detected.');
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            };
            img.src = preview!;
          });

        } else if (file.type === 'audio/wav') {
          const buffer = await file.arrayBuffer();
          const result = decodeAudioLSB(buffer);
          setExtractedData(
            result.detected
              ? result.message || '(empty message)'
              : 'No StegX signature detected.',
          );
        } else {
          throw new Error('Unsupported file type for extraction.');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Derive correct download filename from actual output type
  const baseName       = file?.name.replace(/\.[^.]+$/, '') || 'file';
  const downloadName   = resultIsAudio ? `stego_${baseName}.wav` : `stego_${baseName}.png`;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* ── Tab + mode selectors ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as 'encode' | 'extract');
            setError(null);
          }}
          className="w-[400px]"
        >
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger
              value="encode"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm font-bold transition-all"
            >
              Encoding
            </TabsTrigger>
            <TabsTrigger
              value="extract"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-[#6366f1] data-[state=active]:shadow-sm font-bold transition-all"
            >
              Extraction
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'encode' && (
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <Button
              variant={mode === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('text')}
              className={cn('rounded-md px-4', mode === 'text' && 'bg-white text-[#6366f1] hover:bg-white')}
            >
              Text in File
            </Button>
            <Button
              variant={mode === 'image' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('image')}
              className={cn('rounded-md px-4', mode === 'image' && 'bg-white text-[#6366f1] hover:bg-white')}
            >
              Image in Image
            </Button>
          </div>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="max-w-6xl mx-auto px-1">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2">
            <span className="text-red-500">✕</span> {error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Input Card ───────────────────────────────────────────────────────── */}
        <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#6366f1]" />

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#6366f1]" />
              {mode === 'image' && activeTab === 'encode' ? 'Cover Image' : 'Source File'}
            </h3>

            {/* Main file drop zone */}
            <div className="group relative aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] hover:border-[#6366f1]/50 transition-all overflow-hidden flex flex-col items-center justify-center text-center p-6">
              {preview ? (
                <img
                  src={preview}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                  alt="Preview"
                />
              ) : file?.type === 'audio/wav' ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto">
                    <Music className="w-8 h-8 text-[#6366f1]" />
                  </div>
                  <p className="font-bold text-slate-700">{file.name}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-slate-300 group-hover:text-[#6366f1] transition-colors">
                    <Binary className="w-8 h-8" />
                  </div>
                  <p className="font-bold text-slate-900">Upload Base File</p>
                  <p className="text-xs text-slate-400">Images or WAV audio</p>
                </div>
              )}
              <input
                type="file"
                onChange={(e) => onFileUpload(e)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*,audio/wav"
              />
            </div>

            {/* Secret image drop zone (Image-in-Image mode only) */}
            {mode === 'image' && activeTab === 'encode' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#6366f1]" />
                  Secret Image
                </h3>
                <div className="group relative aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-[#e1e4e8] hover:border-[#6366f1]/50 transition-all overflow-hidden flex flex-col items-center justify-center text-center p-6">
                  {secretPreview ? (
                    <img
                      src={secretPreview}
                      className="absolute inset-0 w-full h-full object-contain p-2"
                      alt="Secret Preview"
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto text-slate-300 group-hover:text-[#6366f1] transition-colors">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">Upload Payload Image</p>
                    </div>
                  )}
                  <input
                    type="file"
                    onChange={(e) => onFileUpload(e, true)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action controls */}
          {activeTab === 'encode' ? (
            mode === 'text' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Secret Message</h3>
                  <Sparkles className="w-4 h-4 text-[#6366f1]" />
                </div>
                <Textarea
                  placeholder="Enter secret text…"
                  className="min-h-[120px] rounded-xl border-[#e1e4e8] focus-visible:ring-[#6366f1] resize-none p-4"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button
                  onClick={handleAction}
                  disabled={!file || !message.trim() || isProcessing}
                  className="w-full h-14 bg-[#6366f1] hover:bg-[#4f46e5] rounded-xl font-bold text-lg"
                >
                  {isProcessing ? 'Encoding…' : 'Execute Encoding'}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleAction}
                disabled={!file || !secretFile || isProcessing}
                className="w-full h-14 bg-[#6366f1] hover:bg-[#4f46e5] rounded-xl font-bold text-lg mt-4"
              >
                {isProcessing ? 'Blending…' : 'Blend Images'}
              </Button>
            )
          ) : (
            <div className="space-y-6 pt-4">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#6366f1]" />
                  Extraction Protocol
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  StegAnalyzer performs a signature-aware scan for StegX headers. If no header
                  is found it attempts a 4-bit LSB image reconstruction.
                </p>
              </div>
              <Button
                onClick={handleAction}
                disabled={!file || isProcessing}
                className="w-full h-14 bg-[#6366f1] hover:bg-[#4f46e5] rounded-xl font-bold text-lg shadow-lg shadow-indigo-100"
              >
                {isProcessing ? 'Extracting…' : 'Run Extraction'}
              </Button>
            </div>
          )}
        </Card>

        {/* ── Output Card ──────────────────────────────────────────────────────── */}
        <Card className="p-8 border-[#e1e4e8] shadow-sm bg-white space-y-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {activeTab === 'encode' ? (
              <><ImageIcon className="w-5 h-5 text-[#6366f1]" /> Stego-Output</>
            ) : (
              <><Eye className="w-5 h-5 text-[#6366f1]" /> Extracted Payload</>
            )}
          </h3>

          <div className="flex-1 bg-slate-50 rounded-2xl border border-[#e1e4e8] border-dashed flex flex-col items-center justify-center p-8 relative min-h-[400px]">
            {activeTab === 'encode' ? (
              resultUrl ? (
                <div className="w-full h-full flex flex-col items-center gap-6">
                  {/* FIX: show audio icon for WAV output, image preview for PNG */}
                  {resultIsAudio ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-10 rounded-full bg-white shadow-xl">
                        <Music className="w-16 h-16 text-[#6366f1]" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">{downloadName}</p>
                    </div>
                  ) : (
                    <img
                      src={resultUrl}
                      className="max-h-[300px] object-contain rounded-lg shadow-xl"
                      alt="Stego Result"
                    />
                  )}
                  {/* FIX: download filename derived from resultIsAudio, not hardcoded .png */}
                  <Button asChild className="bg-[#6366f1] hover:bg-[#4f46e5] px-8 py-6 rounded-xl font-bold">
                    <a href={resultUrl} download={downloadName}>
                      <Download className="w-5 h-5 mr-2" />
                      Download Stego File
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-2 opacity-30">
                  <Sparkles className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-bold text-slate-900">Awaiting Execution</p>
                </div>
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center">
                {extractedImage && (
                  <div className="mb-6 w-full flex flex-col items-center gap-4">
                    <img
                      src={extractedImage}
                      className="max-h-[250px] object-contain rounded-lg border shadow-sm"
                      alt="Extracted Image"
                    />
                    <Button asChild size="sm" variant="outline" className="border-[#6366f1] text-[#6366f1]">
                      <a href={extractedImage} download="extracted_image.png">
                        Download Image Payload
                      </a>
                    </Button>
                  </div>
                )}
                {extractedData ? (
                  <div className="w-full bg-white rounded-xl border border-[#e1e4e8] p-6 font-mono text-sm overflow-y-auto whitespace-pre-wrap text-slate-700 shadow-inner min-h-[150px]">
                    {extractedData}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-2 opacity-30">
                    <Eye className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold text-slate-900">No Data Recovered</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ShieldAlert({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}
