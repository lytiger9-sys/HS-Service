import test from "node:test";
import assert from "node:assert/strict";
import exchange, { CURRENCIES, convertAmount } from "../src/bot/commands/exchange.js";
import { normalizeUsdRates } from "../src/services/exchangeService.js";

test("환율 명령어에 USDT와 주요 코인이 등록되어 있다", () => {
  const values = new Set(CURRENCIES.map(([value]) => value));
  for (const symbol of ["USDT", "BTC", "ETH", "BNB", "SOL", "XRP", "DOGE"]) assert.equal(values.has(symbol), true);
  const options = exchange.data.toJSON().options;
  assert.equal(options.find((option) => option.name === "기준").choices.length, CURRENCIES.length);
});

test("USDT는 USD와 동일한 1달러 기준으로 계산된다", () => {
  const rates = { USD: 1, USDT: 1, KRW: 1 / 1400, BTC: 70000 };
  assert.equal(convertAmount(3000, "USD", "USDT", rates), 3000);
  assert.equal(convertAmount(3000, "USDT", "USD", rates), 3000);
  assert.equal(convertAmount(1, "BTC", "USDT", rates), 70000);
});

test("법정통화 API의 USD 기준 값을 변환식에 맞는 역수로 정규화한다", () => {
  const rates = normalizeUsdRates({ USD: 1, KRW: 1400, JPY: 150 });
  assert.equal(rates.USD, 1);
  assert.equal(rates.USDT, 1);
  assert.equal(rates.KRW, 1 / 1400);
  assert.equal(rates.JPY, 1 / 150);
  assert.equal(convertAmount(1400, "KRW", "USD", rates), 1);
  assert.equal(convertAmount(1, "USD", "KRW", rates), 1400);
  assert.equal(convertAmount(150, "JPY", "KRW", rates), 1400);
});
