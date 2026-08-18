const CRYPTO_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LINK: "chainlink"
};

export function createExchangeService() {
  async function getRates() {
    const [fiatResponse, cryptoResponse] = await Promise.all([
      fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) }),
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(CRYPTO_IDS).join(",")}&vs_currencies=usd`, { signal: AbortSignal.timeout(8000) })
    ]);
    if (!fiatResponse.ok) throw new Error("법정통화 환율 정보를 가져오지 못했습니다.");
    const fiatData = await fiatResponse.json();
    if (fiatData.result !== "success" || !fiatData.rates) throw new Error("법정통화 환율 응답이 올바르지 않습니다.");

    const rates = { USD: 1, USDT: 1, ...fiatData.rates };
    if (cryptoResponse.ok) {
      const cryptoData = await cryptoResponse.json();
      for (const [symbol, id] of Object.entries(CRYPTO_IDS)) {
        const usdPrice = Number(cryptoData?.[id]?.usd);
        if (Number.isFinite(usdPrice) && usdPrice > 0) rates[symbol] = usdPrice;
      }
    }

    return {
      rates,
      updatedAt: fiatData.time_last_update_utc || new Date().toISOString(),
      cryptoUpdatedAt: new Date().toISOString()
    };
  }
  return { getRates };
}
