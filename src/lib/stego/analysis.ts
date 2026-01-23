/**
 * Performs a Chi-Square attack on an image to detect LSB steganography.
 * Returns the probability of steganographic content.
 */
export function chiSquareAttack(data: Uint8ClampedArray): number {
  const counts = new Array(256).fill(0);
  // Analyze only the LSB of the Red channel for simplicity in this forensic view
  // or all RGB channels. Let's do all RGB.
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

  // Simplified p-value calculation or probability score
  // In a real Chi-Square, we'd use a cumulative distribution function.
  // Here we return a normalized score where higher means more likely stego.
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
 * Returns complexity scores for each bit plane (0-7).
 */
export function calculateBPCS(data: Uint8ClampedArray): number[] {
  const complexities = new Array(8).fill(0);
  
  for (let bit = 0; bit < 8; bit++) {
    let transitions = 0;
    let totalPossibleTransitions = 0;
    
    // Check transitions between adjacent pixels (simplified)
    for (let i = 0; i < data.length - 4; i += 4) {
      const b1 = (data[i] >> bit) & 1;
      const b2 = (data[i + 4] >> bit) & 1;
      if (b1 !== b2) transitions++;
      totalPossibleTransitions++;
    }
    
    complexities[bit] = transitions / totalPossibleTransitions;
  }
  
  return complexities;
}
