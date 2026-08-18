import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("환율").setDescription("현재 주요 통화 환율을 보여줍니다."),
  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const { base, rates, updatedAt } = await context.services.exchange.getRates("USD");
      const values = [["KRW", "대한민국 원"], ["JPY", "일본 엔"], ["EUR", "유로"], ["CNY", "중국 위안"], ["GBP", "영국 파운드"]].map(([code, label]) => `${code} (${label}): ${Number(rates[code] || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setTitle("현재 환율").setDescription(`기준 통화: ${base}\n\n${values.join("\n")}`).setColor(0x3a7da8).setFooter({ text: updatedAt ? `기준 시각: ${updatedAt}` : "공개 환율 API 기준" }).setTimestamp()] });
    } catch {
      return interaction.editReply({ content: "현재 환율 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
  }
};
