import { decodeLSB, decodeAudioLSB } from './codec';

/**
 * Performs a Chi-Square attack on an image to detect LSB steganography.
 * Returns the probability of steganographic content using the PoV (Pairs of Values) method.
 *
 * Theory: LSB embedding statistically equalises adjacent value pairs (2i, 2i+1).
 * A Chi-Square value near zero across all PoVs indicates steganography.
 */
export function chiSquareAttack(data: Uint8ClampedArray): number {
  const counts = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    counts[data[i]]++;       // R
    counts[data[i + 1]]++;   // G
    counts[data[i + 2]]++;   // B
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

  // Normalised score: 0 = natural, 1 = suspicious (PoVs are extremely uniform)
  const threshold = k * 1.5;
  let score = Math.max(0, 1 - chiSquare / (threshold || 1));

  if (chiSquare < k * 0.1) score = 1.0;

  return Math.min(score, 1);
}

/**
 * Extracts a specific bit plane for visual forensics.
 * bit=0 is the LSB (most revealing for steganography detection).
 */
export function getBitPlane(data: Uint8ClampedArray, bit: number = 0): Uint8ClampedArray {
  const newData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) {
      newData[i] = 255; // preserve alpha
      continue;
    }
    newData[i] = ((data[i] >> bit) & 1) ? 255 : 0;
  }
  return newData;
}

/**
 * Detects potential Image-in-Image 4-bit substitution anomalies.
 * Compares the complexity of low nibble vs high nibble across adjacent pixels.
 */
export function detectImageInImageAnomaly(data: Uint8ClampedArray): number {
  let lowComplexity = 0;
  let highComplexity = 0;

  for (let i = 0; i < data.length - 4; i += 4) {
    for (let j = 0; j < 3; j++) {
      const low4_1  = data[i + j] & 0x0F;
      const low4_2  = data[i + 4 + j] & 0x0F;
      const high4_1 = (data[i + j] >> 4) & 0x0F;
      const high4_2 = (data[i + 4 + j] >> 4) & 0x0F;

      if (low4_1 !== low4_2)  lowComplexity++;
      if (high4_1 !== high4_2) highComplexity++;
    }
  }

  // If low bits are unexpectedly complex (approaching high-bit complexity), it is suspicious
  const ratio = lowComplexity / (highComplexity || 1);
  return Math.min(Math.max(0, ratio - 0.5) * 2, 1);
}

/**
 * Detects text steganography (trailing spaces or zero-width characters).
 */
export function detectTextStego(text: string): {
  hasTrailingSpaces: boolean;
  hasZeroWidthChars: boolean;
  isSuspicious: boolean;
} {
  const hasTrailingSpaces = text.split('\n').some(line => line.endsWith(' '));
  const hasZeroWidthChars = /[\u200B-\u200D\uFEFF]/.test(text);

  return {
    hasTrailingSpaces,
    hasZeroWidthChars,
    isSuspicious: hasTrailingSpaces || hasZeroWidthChars,
  };
}

/**
 * Simplified BPCS (Bit Plane Complexity Segmentation).
 * Returns per-bit-plane complexity scores (0–1). High complexity in low planes is suspicious.
 */
export function calculateBPCS(data: Uint8ClampedArray): number[] {
  const complexities = new Array(8).fill(0);

  for (let bit = 0; bit < 8; bit++) {
    let transitions = 0;
    let total = 0;

    for (let i = 0; i < data.length - 4; i += 4) {
      const b1 = (data[i] >> bit) & 1;
      const b2 = (data[i + 4] >> bit) & 1;
      if (b1 !== b2) transitions++;
      total++;
    }

    complexities[bit] = transitions / (total || 1);
  }

  return complexities;
}

/**
 * Forensic scan entry point. Runs all applicable detectors against a file
 * and returns a combined probability and detection result.
 *
 * FIX: forensicScan now properly rejects on image load/read errors instead of
 * silently hanging, and propagates errors from canvas operations.
 */
export async function forensicScan(file: File): Promise<{
  detected: boolean;
  type?: string;
  message?: string;
  probability: number;
  bpcs?: number[];
}> {
  if (file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error('Failed to read image file'));

      reader.onload = (e) => {
        const img = new Image();

        img.onerror = () => reject(new Error('Failed to decode image'));

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context unavailable'));

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

            const result           = decodeLSB(imageData);
            const chiSquareProb    = chiSquareAttack(imageData);
            const imageInImageProb = detectImageInImageAnomaly(imageData);
            const bpcs             = calculateBPCS(imageData);

            const detected    = result.detected || chiSquareProb > 0.7 || imageInImageProb > 0.7;
            const probability = Math.max(chiSquareProb, result.detected ? 0.99 : 0, imageInImageProb);

            resolve({
              detected,
              type: result.type || (imageInImageProb > chiSquareProb ? 'Image-in-Image' : 'LSB Anomaly (Chi-Square)'),
              message: result.message,
              probability,
              bpcs,
            });
          } catch (err) {
            reject(err);
          }
        };

        img.src = e.target?.result as string;
      };

      reader.readAsDataURL(file);
    });
  }

  if (file.type === 'audio/wav') {
    const buffer = await file.arrayBuffer();
    const result = decodeAudioLSB(buffer);
    return {
      detected: result.detected,
      type: result.type,
      message: result.message,
      probability: result.detected ? 0.95 : 0.05,
    };
  }

  if (file.type === 'text/plain') {
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