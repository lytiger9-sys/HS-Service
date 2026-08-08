import { SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";
import { buildBaseEmbed, palette } from "../../shared/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("punishments")
    .setDescription("유저의 제재 목록을 보여줍니다.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("조회할 유저")
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser("user") ?? interaction.user;
    if (targetUser.id !== interaction.user.id && !isAdministrator(interaction.member)) {
      return interaction.editReply({ content: "다른 유저의 제재 목록은 관리자만 볼 수 있습니다." });
    }

    const records = await context.services.punishments.listPunishments(interaction.guildId, targetUser.id);
    if (!records.length) {
      return interaction.editReply({ content: "제재 기록이 없습니다." });
    }

    const description = records.slice(0, 8).map((record, index) => {
      return [
        `${index + 1}. ${record.type}`,
        `사유: ${record.reason || "없음"}`,
        `기간: ${record.durationMinutes ? `${record.durationMinutes}분` : "즉시"}`,
        `일시: ${record.createdAt}`
      ].join("\n");
    }).join("\n\n");

    const embed = buildBaseEmbed({
      title: `${targetUser.tag} 제재 목록`,
      description,
      color: palette.danger,
      footer: `총 ${records.length}건`,
      timestamp: Date.now()
    });

    return interaction.editReply({ embeds: [embed] });
  }
};
