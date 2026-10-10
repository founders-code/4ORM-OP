import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export function sealKey(material) {
  if (!material) return null;
  return createHash('sha256').update(`4orm-seal:${material}`).digest();
}

/** AES-256-GCM. The packed string is iv, tag, ciphertext. Wrong key or a flipped byte returns null. */
export function seal(plain, material) {
  const key = sealKey(material);
  if (!key || typeof plain !== 'string') return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function openSeal(packed, material) {
  const key = sealKey(material);
  if (!key || typeof packed !== 'string') return null;
  const parts = packed.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const data = Buffer.from(parts[2], 'base64url');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
