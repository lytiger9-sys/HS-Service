import test from "node:test";
import assert from "node:assert/strict";
import exchange, { CURRENCIES, convertAmount } from "../src/bot/commands/exchange.js";

test("환율 명령어에 USDT와 주요 코인이 등록되어 있다", () => {
  const values = new Set(CURRENCIES.map(([value]) => value));
  for (const symbol of ["USDT", "BTC", "ETH", "BNB", "SOL", "XRP", "DOGE"]) assert.equal(values.has(symbol), true);
  const options = exchange.data.toJSON().options;
  assert.equal(options.find((option) => option.name === "기준").choices.length, CURRENCIES.length);
});

test("USDT는 USD와 동일한 1달러 기준으로 계산된다", () => {
  const rates = { USD: 1, USDT: 1, KRW: 1400, BTC: 70000 };
  assert.equal(convertAmount(3000, "USD", "USDT", rates), 3000);
  assert.equal(convertAmount(3000, "USDT", "USD", rates), 3000);
  assert.equal(convertAmount(1, "BTC", "USDT", rates), 70000);
});
