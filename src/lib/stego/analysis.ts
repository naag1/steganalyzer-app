import { decodeLSB, decodeAudioLSB } from './codec';

/**
 * Performs a Chi-Square attack on an image to detect LSB steganography.
 * Returns the probability of steganographic content.
 */
export function chiSquareAttack(data: Uint8ClampedArray): number {
  const counts = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    counts[data[i]]++;     // R
    counts[data[i + 1]]++; // G
    counts[data[i + 2]]++; // B
  }

  let chiSquare = 0;
  let degreesOfFreedom = 0;

  for (let i = 0; i < 128; i++) {
    const observed1 = counts[2 * i];
    const observed2 = counts[2 * i + 1];
    const expected = (observed1 + observed2) / 2;

    if (expected > 0) {
      chiSquare += Math.pow(observed1 - expected, 2) / expected;
      chiSquare += Math.pow(observed2 - expected, 2) / expected;
      degreesOfFreedom++;
    }
  }

  // Normalized score
  const probability = Math.min(chiSquare / (degreesOfFreedom || 1), 1);
  return probability;
}

/**
 * Detects text steganography (trailing spaces or zero-width chars).
 */
export function detectTextStego(text: string) {
  const trailingSpaces = text.split('\n').some(line => line.endsWith(' '));
  const zeroWidthChars = /[\u200B-\u200D\uFEFF]/.test(text);
  
  return {
    hasTrailingSpaces: trailingSpaces,
    hasZeroWidthChars: zeroWidthChars,
    isSuspicious: trailingSpaces || zeroWidthChars
  };
}

/**
 * BPCS (Bit Plane Complexity Segmentation) simplified.
 */
export function calculateBPCS(data: Uint8ClampedArray): number[] {
  const complexities = new Array(8).fill(0);
  for (let bit = 0; bit < 8; bit++) {
    let transitions = 0;
    let totalPossibleTransitions = 0;
    for (let i = 0; i < data.length - 4; i += 4) {
      const b1 = (data[i] >> bit) & 1;
      const b2 = (data[i + 4] >> bit) & 1;
      if (b1 !== b2) transitions++;
      totalPossibleTransitions++;
    }
    complexities[bit] = transitions / (totalPossibleTransitions || 1);
  }
  return complexities;
}

/**
 * Forensic Scan for StegX signature
 */
export async function forensicScan(file: File): Promise<{ 
  detected: boolean; 
  type?: string; 
  message?: string;
  probability: number;
  bpcs?: number[];
}> {
  if (file.type.startsWith('image/')) {
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
          const imageData = ctx.getImageData(0, 0, img.width, img.height).data;
          
          const result = decodeLSB(imageData);
          const probability = chiSquareAttack(imageData);
          const bpcs = calculateBPCS(imageData);
          
          resolve({
            detected: result.detected,
            type: result.type,
            message: result.message,
            probability,
            bpcs
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  } else if (file.type === 'audio/wav') {
    const buffer = await file.arrayBuffer();
    const result = decodeAudioLSB(buffer);
    return {
      detected: result.detected,
      type: result.type,
      message: result.message,
      probability: result.detected ? 0.95 : 0.05,
    };
  } else if (file.type === 'text/plain') {
    const text = await file.text();
    const result = detectTextStego(text);
    return {
      detected: result.isSuspicious,
      type: 'Text Forensic Anomaly',
      probability: result.isSuspicious ? 0.8 : 0.1,
    };
  }
  
  return { detected: false, probability: 0 };
}
