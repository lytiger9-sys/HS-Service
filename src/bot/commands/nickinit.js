import { SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("nickinit").setDescription("봇과 관리자 외 멤버의 닉네임을 랜덤으로 초기화합니다."),
  async execute(interaction, context) {
    const settings = await context.services.settings.getSettings(interaction.guildId);
    if (settings.nickname?.enabled === false) {
      return interaction.reply({ content: "현재 닉네임 기능이 꺼져 있습니다.", ephemeral: true });
    }
    const changed = await context.services.nicknames.randomizeNicknames(interaction.guild);
    await interaction.reply({ content: `닉네임 초기화를 완료했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
