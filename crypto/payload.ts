const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncryptedPayload {
  iv: string;
  payload: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const key = base64ToBytes(base64Key);
  return await crypto.subtle.importKey("raw", toArrayBuffer(key), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJsonPayload(
  data: unknown,
  base64Key: string,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(base64Key);
  const encoded = textEncoder.encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptJsonPayload(
  envelope: EncryptedPayload,
  base64Key: string,
): Promise<unknown> {
  const iv = base64ToBytes(envelope.iv);
  const payload = base64ToBytes(envelope.payload);
  const key = await importAesKey(base64Key);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(payload),
  );
  return JSON.parse(textDecoder.decode(decrypted));
}
