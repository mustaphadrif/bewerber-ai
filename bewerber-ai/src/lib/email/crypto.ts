/**
 * Server-side AES-GCM encryption for Gmail OAuth tokens.
 * Key is derived from EMAIL_TOKEN_ENCRYPTION_KEY (SHA-256). Tokens are
 * encrypted before they are written to Supabase and decrypted only inside
 * server code. This module must never be imported from client code.
 */
import { createHash } from "crypto";

const ENV_KEY_NAME = "EMAIL_TOKEN_ENCRYPTION_KEY";

const encoder = new TextEncoder();

function keyMaterial(): string {
  const value = process.env[ENV_KEY_NAME];
  if (!value) {
    throw new Error(
      `${ENV_KEY_NAME} ist nicht gesetzt. Gmail-Token können ohne ihn nicht verschlüsselt gespeichert werden.`
    );
  }
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(): Promise<CryptoKey> {
  const digest = createHash("sha256").update(keyMaterial()).digest();
  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(digest),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypts an arbitrary JSON-serializable value. Returns `iv.ciphertext`. */
export async function encryptJson(value: unknown): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Copy into a plain ArrayBuffer-backed view so it satisfies BufferSource.
  const jsonBytes = encoder.encode(JSON.stringify(value));
  const data = new Uint8Array(jsonBytes.byteLength);
  data.set(jsonBytes);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data.buffer as ArrayBuffer
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

/** Decrypts a value previously produced by encryptJson. */
export async function decryptJson<T>(token: string): Promise<T> {
  const key = await deriveKey();
  const [ivPart, dataPart] = token.split(".");
  if (!ivPart || !dataPart) throw new Error("Ungültiges Token-Format.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart).buffer as ArrayBuffer },
    key,
    fromBase64Url(dataPart).buffer as ArrayBuffer
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** True when encryption can be performed (env key present). */
export function hasTokenEncryptionKey(): boolean {
  return Boolean(process.env[ENV_KEY_NAME]);
}
