/** Server-only Supabase REST helpers. Never import this module from a client component. */

export function getSupabaseConfig(): { url: string; secretKey: string; isModernSecret: boolean } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const modernKey = process.env.SUPABASE_SECRET_KEY;
  const secretKey = modernKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return null;
  return { url, secretKey, isModernSecret: modernKey !== undefined };
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.secretKey,
      ...(config.isModernSecret ? {} : { Authorization: `Bearer ${config.secretKey}` }),
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  return response.json() as Promise<T>;
}
