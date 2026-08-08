import { SlashCommandBuilder } from "discord.js";
import { buildBaseEmbed, palette } from "../../shared/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("joinorder")
    .setDescription("서버 입장 순서를 내림차순으로 보여줍니다.")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("표시할 인원 수")
        .setMinValue(1)
        .setMaxValue(20)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const limit = interaction.options.getInteger("limit") ?? 20;
    const rows = await context.services.serverInfo.getJoinOrder(interaction.guild, limit);

    if (!rows.length) {
      return interaction.editReply({ content: "입장 순서를 가져올 수 없습니다." });
    }

    const lines = rows.map((entry) => {
      const joinedAt = entry.joinedTimestamp ? `<t:${Math.floor(entry.joinedTimestamp / 1000)}:R>` : "알 수 없음";
      return `${entry.rank}. ${entry.user.tag} - ${joinedAt}`;
    });

    const embed = buildBaseEmbed({
      title: "서버 입장 순서",
      description: lines.join("\n"),
      color: palette.ink,
      footer: `표시 ${rows.length}명`,
      timestamp: Date.now()
    });

    return interaction.editReply({ embeds: [embed] });
  }
};
