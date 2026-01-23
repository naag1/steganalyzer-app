import { decodeLSB, decodeAudioLSB } from './codec';

/**
 * Performs a Chi-Square attack on an image to detect LSB steganography.
 * Returns the probability of steganographic content using the PoV (Pairs of Values) method.
 */
export function chiSquareAttack(data: Uint8ClampedArray): number {
  const counts = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    counts[data[i]]++;     // R
    counts[data[i + 1]]++; // G
    counts[data[i + 2]]++; // B
  }

  let chiSquare = 0;
  let k = 0; // degrees of freedom

  for (let i = 0; i < 128; i++) {
    const y_2i = counts[2 * i];
    const y_2i_plus_1 = counts[2 * i + 1];
    const expected = (y_2i + y_2i_plus_1) / 2;

    if (expected > 0) {
      chiSquare += Math.pow(y_2i - expected, 2) / expected;
      k++;
    }
  }

  // Simplified p-value approximation for Chi-Square distribution
  // In forensics, we often use the Chi-Square value directly normalized or a lookup
  // A high Chi-Square relative to degrees of freedom indicates anomaly (not stego)
  // Wait, actually for LSB stego, Chi-Square NEAR ZERO indicates steganography 
  // because LSB embedding makes adjacent counts equal (PoVs).
  // A probability of 1 means stego is likely (low chi-square).
  
  // Normalized score: 0 (Natural) to 1 (Suspicious)
  // In stego detection, we want 1 when the PoVs are very close.
  const threshold = k * 1.5; // Heuristic
  let score = Math.max(0, 1 - (chiSquare / (threshold || 1)));
  
  // High sensitivity for forensic tool: if PoVs are extremely uniform, flag 100%
  if (chiSquare < k * 0.1) score = 1.0;
  
  return Math.min(score, 1);
}

/**
 * Extracts a specific bit plane for visual forensics.
 */
export function getBitPlane(data: Uint8ClampedArray, bit: number = 0): Uint8ClampedArray {
  const newData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) {
      newData[i] = 255; // Alpha
      continue;
    }
    const val = (data[i] >> bit) & 1;
    newData[i] = val ? 255 : 0; // Visualize bit as white/black
  }
  return newData;
}

/**
 * Detects potential Image-in-Image 4-bit substitution anomalies.
 */
export function detectImageInImageAnomaly(data: Uint8ClampedArray): number {
  // Check complexity of bottom 4 bits vs top 4 bits
  let lowComplexity = 0;
  let highComplexity = 0;
  
  for (let i = 0; i < data.length - 4; i += 4) {
    for (let j = 0; j < 3; j++) {
      const low4_1 = data[i + j] & 0x0F;
      const low4_2 = data[i + 4 + j] & 0x0F;
      const high4_1 = (data[i + j] >> 4) & 0x0F;
      const high4_2 = (data[i + 4 + j] >> 4) & 0x0F;
      
      if (low4_1 !== low4_2) lowComplexity++;
      if (high4_1 !== high4_2) highComplexity++;
    }
  }
  
  // If low bits are unexpectedly complex (approaching high bit complexity), it's suspicious
  const ratio = lowComplexity / (highComplexity || 1);
  return Math.min(Math.max(0, ratio - 0.5) * 2, 1);
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
            const chiSquareProb = chiSquareAttack(imageData);
            const imageInImageProb = detectImageInImageAnomaly(imageData);
            const bpcs = calculateBPCS(imageData);
            
            // Final detection logic: Chi-Square is primary for headerless detection
            const detected = result.detected || chiSquareProb > 0.7 || imageInImageProb > 0.7;
            const probability = Math.max(chiSquareProb, result.detected ? 0.99 : 0, imageInImageProb);
            
            resolve({
              detected,
              type: result.type || (imageInImageProb > chiSquareProb ? 'Image-in-Image' : 'LSB Anomaly (Chi-Square)'),
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
