const BASE = "https://api.trello.com/1";
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type QueryParams = Record<string, string | undefined>;

export class TrelloHttp {
  constructor(private readonly key: string, private readonly token: string) {}

  private auth(params: QueryParams): string {
    const merged: Record<string, string> = { key: this.key, token: this.token };
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) merged[k] = v;
    }
    return new URLSearchParams(merged).toString();
  }

  async request<T>(method: string, path: string, params: QueryParams = {}): Promise<T> {
    const url = `${BASE}${path}?${this.auth(params)}`;
    let lastBody = "";
    let lastStatus = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, { method });
      if (res.ok) {
        const text = await res.text();
        return text ? (JSON.parse(text) as T) : (undefined as T);
      }
      lastStatus = res.status;
      lastBody = await res.text();
      if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.random() * 250;
      await sleep(backoff);
    }
    throw new Error(`Trello ${method} ${path} failed: ${lastStatus} ${lastBody}`);
  }
}
