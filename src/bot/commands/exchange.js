import { SlashCommandBuilder } from "discord.js";

const CURRENCIES = [
  ["KRW", "원"],
  ["JPY", "엔"],
  ["USD", "달러"],
  ["EUR", "유로"],
  ["CNY", "위안"],
  ["GBP", "파운드"]
];
const CURRENCY_CHOICES = CURRENCIES.map(([value, name]) => ({ name: `${name} (${value})`, value }));

function currencyLabel(code) {
  return CURRENCIES.find(([value]) => value === code)?.[1] || code;
}

function formatAmount(value, code) {
  return `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 4 })} ${currencyLabel(code)}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("환율")
    .setDescription("입력한 금액을 다른 통화로 계산합니다.")
    .addNumberOption((option) => option.setName("금액").setDescription("변환할 금액").setMinValue(0.0001).setRequired(true))
    .addStringOption((option) => option.setName("기준").setDescription("입력 금액의 통화").setRequired(true).addChoices(...CURRENCY_CHOICES))
    .addStringOption((option) => option.setName("대상").setDescription("변환할 통화").setRequired(true).addChoices(...CURRENCY_CHOICES)),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const amount = interaction.options.getNumber("금액", true);
      const base = interaction.options.getString("기준", true);
      const target = interaction.options.getString("대상", true);
      const { rates, updatedAt } = await context.services.exchange.getRates(base);
      const rate = target === base ? 1 : Number(rates[target] || 0);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("해당 통화의 환율을 찾을 수 없습니다.");
      const converted = amount * rate;
      return interaction.editReply({
        content: `**환율 계산 결과**\n${formatAmount(amount, base)} → **${formatAmount(converted, target)}**\n\n1 ${currencyLabel(base)} = ${formatAmount(rate, target)}${updatedAt ? `\n기준 시각: ${updatedAt}` : ""}`
      });
    } catch (error) {
      return interaction.editReply({ content: error.message || "환율 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
  }
};
