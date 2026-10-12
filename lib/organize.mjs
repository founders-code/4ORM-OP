/** Turn a raw dump into a title plus one line per sentence. */
export function organizeText(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const parts = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  const title = (parts[0] || text).trim().slice(0, 180);
  const rest = parts.length > 1 ? parts.slice(1) : parts;
  const body = rest.map((part) => `- ${part}`).join('\n').slice(0, 4000);
  return { title, body };
}
