/**
 * Encodes a message into image data using LSB steganography.
 */
export function encodeLSB(data: Uint8ClampedArray, message: string): Uint8ClampedArray {
  const binaryMessage = Array.from(new TextEncoder().encode(message + '\0')) // Null-terminated
    .map(byte => byte.toString(2).padStart(8, '0'))
    .join('');

  if (binaryMessage.length > (data.length / 4) * 3) {
    throw new Error('Message too large for this image');
  }

  const newData = new Uint8ClampedArray(data);
  let bitIndex = 0;

  for (let i = 0; i < newData.length && bitIndex < binaryMessage.length; i += 4) {
    for (let j = 0; j < 3 && bitIndex < binaryMessage.length; j++) {
      // Modify R, G, B channels
      newData[i + j] = (newData[i + j] & 0xFE) | parseInt(binaryMessage[bitIndex]);
      bitIndex++;
    }
  }

  return newData;
}

/**
 * Decodes a message from image data using LSB steganography.
 */
export function decodeLSB(data: Uint8ClampedArray): string {
  let binaryMessage = '';
  
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      binaryMessage += (data[i + j] & 1).toString();
    }
  }

  const bytes = [];
  for (let i = 0; i < binaryMessage.length; i += 8) {
    const byte = parseInt(binaryMessage.slice(i, i + 8), 2);
    if (byte === 0) break; // Null terminator
    bytes.push(byte);
  }

  return new TextDecoder().decode(new Uint8Array(bytes));
}
