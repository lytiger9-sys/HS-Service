import { SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("nickinit").setDescription("봇과 관리자 외 모든 멤버의 닉네임을 기본 사용자명으로 복귀합니다."),
  async execute(interaction, context) {
    const settings = await context.services.settings.getSettings(interaction.guildId);
    if (settings.nickname?.enabled === false) {
      return interaction.reply({ content: "현재 닉네임 기능이 꺼져 있습니다.", ephemeral: true });
    }
    const changed = await context.services.nicknames.restoreNicknames(interaction.guild);
    await interaction.reply({ content: `닉네임을 기본 상태로 복귀했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
