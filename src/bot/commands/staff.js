import { SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

export default {
  data: new SlashCommandBuilder()
    .setName("staff")
    .setDescription("관리자 출퇴근 상태 게시판을 게시합니다."),

  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const settings = await context.services.settings.getSettings(interaction.guildId);
      if (settings.staff?.enabled === false) {
        return interaction.editReply({ content: "현재 스태프 기능이 꺼져 있습니다." });
      }

      const message = await context.services.staff.publishBoard(interaction.guildId, interaction.channelId);
      return interaction.editReply({
        content: `스태프 상태 게시판을 올렸습니다: ${message.url}`
      });
    } catch (error) {
      return interaction.editReply({
        content: error.message || "스태프 상태 게시판을 게시하지 못했습니다."
      });
    }
  }
};
