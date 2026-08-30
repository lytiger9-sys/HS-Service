import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("닉네임초기화").setDescription("봇과 관리자 외 모든 멤버의 닉네임을 기본 사용자명으로 복귀합니다.").addBooleanOption((option) => option.setName("확인").setDescription("전체 닉네임 초기화를 확인합니다.").setRequired(true)),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    if (!interaction.options.getBoolean("확인", true)) return interaction.reply({ content: "닉네임 초기화를 진행하려면 확인을 true로 설정해야 합니다.", ephemeral: true });
    const settings = await context.services.settings.getSettings(interaction.guildId);
    if (settings.nickname?.enabled === false) {
      return interaction.reply({ content: "현재 닉네임 기능이 꺼져 있습니다.", ephemeral: true });
    }
    const changed = await context.services.nicknames.restoreNicknames(interaction.guild);
    await interaction.reply({ content: `닉네임을 기본 상태로 복귀했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
