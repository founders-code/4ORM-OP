import { env } from './env.mjs';

/**
 * Perplexity Agent API (docs.perplexity.ai, "Migrate from Sonar"): POST https://api.perplexity.ai/v1/agent
 * with { effort: 'fast', instructions, input, tools: [{ type: 'web_search' }] }. The answer carries inline
 * [n] markers; the sources come back in an output item of type 'search_results' whose results[].id = n.
 * Sonar chat completions ended on 2026-09-27, so the Agent API is used.
 */
const URL_AGENT = 'https://api.perplexity.ai/v1/agent';

export function perplexityConfigured() {
  return !!env('PERPLEXITY_API_KEY');
}

export type ResearchSource = { n: number; title: string; url: string; date: string };
export type ResearchResult =
  | { ok: true; answer: string; sources: ResearchSource[] }
  | { ok: false; status: number; error: string };

const INSTRUCTIONS = [
  'You research for Chad Johnston, CEO of 4orm Finance, a Canadian fintech that helps payment service providers meet',
  'the Retail Payment Activities Act safeguarding rules. Answer in plain English, 120 to 220 words, short paragraphs or',
  'a short list. Base every factual statement on the numbered web search results and cite them inline as [1] or [1][2]',
  'right after the statement. Drop any claim the sources do not support. Prefer Canadian and primary sources (Bank of',
  'Canada, FINTRAC, Department of Finance, company filings). Do not add a references section.',
].join(' ');

type OutItem = {
  type?: string;
  results?: Array<{ id?: number; title?: string; url?: string; date?: string }>;
  content?: Array<{ type?: string; text?: string }>;
};

/** Pure parser for the Agent API response (also accepts the legacy Sonar shape). Exported for tests. */
export function readResearch(json: unknown): { answer: string; sources: ResearchSource[] } {
  const body = (json || {}) as { output?: OutItem[]; output_text?: string; choices?: Array<{ message?: { content?: string } }>; search_results?: OutItem['results']; citations?: string[] };
  let answer = '';
  const sources: ResearchSource[] = [];
  const add = (r: { id?: number; title?: string; url?: string; date?: string }, i: number) => {
    const url = String(r.url || '');
    if (!/^https?:\/\//i.test(url)) return;
    const n = Number.isFinite(Number(r.id)) ? Number(r.id) : i + 1;
    if (sources.some((s) => s.n === n)) return;
    sources.push({ n, title: String(r.title || url).slice(0, 200), url: url.slice(0, 1000), date: String(r.date || '').slice(0, 10) });
  };
  for (const item of body.output || []) {
    if (item.type === 'search_results') (item.results || []).forEach(add);
    if (item.type === 'message') {
      const text = (item.content || []).filter((c) => !c.type || c.type === 'output_text').map((c) => String(c.text || '')).join('');
      if (text) answer = text;
    }
  }
  if (!answer && typeof body.output_text === 'string') answer = body.output_text;
  if (!answer && body.choices?.[0]?.message?.content) answer = String(body.choices[0].message.content);
  if (!sources.length && Array.isArray(body.search_results)) body.search_results.forEach(add);
  if (!sources.length && Array.isArray(body.citations)) body.citations.forEach((url, i) => add({ id: i + 1, url, title: url }, i));
  sources.sort((a, b) => a.n - b.n);
  return { answer: answer.trim().slice(0, 6000), sources: sources.slice(0, 20) };
}

export async function research(question: string, context = ''): Promise<ResearchResult> {
  if (!perplexityConfigured()) return { ok: false, status: 503, error: 'Perplexity is not connected. Set PERPLEXITY_API_KEY in Vercel.' };
  const q = String(question || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!q) return { ok: false, status: 400, error: 'Nothing to research.' };
  const input = context ? `${q}\n\nContext from 4orm (do not cite this, it is not a source):\n${String(context).slice(0, 2000)}` : q;
  try {
    const res = await fetch(URL_AGENT, {
      method: 'POST',
      headers: { authorization: `Bearer ${env('PERPLEXITY_API_KEY')}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ effort: 'fast', instructions: INSTRUCTIONS, input, tools: [{ type: 'web_search' }] }),
      signal: AbortSignal.timeout(45000),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = res.status === 401 ? 'Perplexity refused the key (401). Check PERPLEXITY_API_KEY.' : res.status === 429 ? 'Perplexity rate limit. Try again in a minute.' : 'Perplexity did not answer.';
      return { ok: false, status: res.status === 401 || res.status === 429 ? res.status : 502, error };
    }
    const parsed = readResearch(await res.json());
    if (!parsed.answer) return { ok: false, status: 502, error: 'Perplexity sent back an empty answer.' };
    return { ok: true, ...parsed };
  } catch {
    return { ok: false, status: 504, error: 'Perplexity took too long. Try again.' };
  }
}
