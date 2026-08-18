export function createExchangeService() {
  async function getRates(base = "USD") {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("환율 정보를 가져오지 못했습니다.");
    const data = await response.json();
    if (data.result !== "success" || !data.rates) throw new Error("환율 정보 응답이 올바르지 않습니다.");
    return { base: data.base_code || base, rates: data.rates, updatedAt: data.time_last_update_utc || null };
  }
  return { getRates };
}
