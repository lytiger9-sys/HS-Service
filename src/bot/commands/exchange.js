import { SlashCommandBuilder } from "discord.js";
import { formatKstDateTime } from "../../shared/time.js";

export const CURRENCIES = [
  ["KRW", "원"],
  ["JPY", "엔"],
  ["USD", "달러"],
  ["EUR", "유로"],
  ["CNY", "위안"],
  ["GBP", "파운드"],
  ["USDT", "테더"],
  ["BTC", "비트코인"],
  ["ETH", "이더리움"],
  ["BNB", "바이낸스 코인"],
  ["SOL", "솔라나"],
  ["XRP", "리플"],
  ["ADA", "에이다"],
  ["DOGE", "도지코인"],
  ["TRX", "트론"],
  ["AVAX", "아발란체"],
  ["DOT", "폴카닷"],
  ["LINK", "체인링크"]
];

const CURRENCY_CHOICES = CURRENCIES.map(([value, name]) => ({ name: `${name} (${value})`, value }));

function currencyLabel(code) {
  return CURRENCIES.find(([value]) => value === code)?.[1] || code;
}

export function formatAmount(value, code) {
  return `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 8 })} ${currencyLabel(code)}`;
}

export function convertAmount(amount, base, target, usdRates) {
  const baseUsd = Number(usdRates[base]);
  const targetUsd = Number(usdRates[target]);
  if (!Number.isFinite(baseUsd) || baseUsd <= 0 || !Number.isFinite(targetUsd) || targetUsd <= 0) {
    throw new Error("해당 통화의 환율을 찾을 수 없습니다.");
  }
  return Number(amount) * baseUsd / targetUsd;
}

export default {
  data: new SlashCommandBuilder()
    .setName("환율")
    .setDescription("법정통화와 USDT·주요 코인 간 환율을 계산합니다.")
    .addNumberOption((option) => option.setName("금액").setDescription("변환할 금액").setMinValue(0.00000001).setRequired(true))
    .addStringOption((option) => option.setName("기준").setDescription("입력 금액의 통화 또는 코인").setRequired(true).addChoices(...CURRENCY_CHOICES))
    .addStringOption((option) => option.setName("대상").setDescription("변환할 통화 또는 코인").setRequired(true).addChoices(...CURRENCY_CHOICES)),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const amount = interaction.options.getNumber("금액", true);
      const base = interaction.options.getString("기준", true);
      const target = interaction.options.getString("대상", true);
      const { rates, updatedAt } = await context.services.exchange.getRates();
      const converted = convertAmount(amount, base, target, rates);
      const rate = convertAmount(1, base, target, rates);
      return interaction.editReply({
        content: `**환율 계산 결과**\n${formatAmount(amount, base)} → **${formatAmount(converted, target)}**\n\n1 ${currencyLabel(base)} = ${formatAmount(rate, target)}${updatedAt ? `\n기준 시각(KST): ${formatKstDateTime(updatedAt)}` : ""}`
      });
    } catch (error) {
      return interaction.editReply({ content: error.message || "환율 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
  }
};
