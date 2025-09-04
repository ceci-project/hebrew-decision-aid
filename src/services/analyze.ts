export async function analyzeAssistant(apiBase: string, payload: unknown) {
  const res = await fetch(`${apiBase}/analyze-assistant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  let meta: any = {};
  try { meta = await res.json(); } catch {}
  return meta; // { ok:boolean, source, version, data?|error? }
}