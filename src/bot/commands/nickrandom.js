import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("nickrandom").setDescription("봇과 관리자 외 멤버의 닉네임을 랜덤으로 변경합니다.").addBooleanOption((option) => option.setName("확인").setDescription("전체 닉네임 변경을 확인합니다.").setRequired(true)),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    if (!interaction.options.getBoolean("확인", true)) return interaction.reply({ content: "닉네임 변경을 진행하려면 확인을 true로 설정해야 합니다.", ephemeral: true });
    const settings = await context.services.settings.getSettings(interaction.guildId);
    if (settings.nickname?.enabled === false) {
      return interaction.reply({ content: "현재 닉네임 기능이 꺼져 있습니다.", ephemeral: true });
    }
    const changed = await context.services.nicknames.randomizeNicknames(interaction.guild);
    await interaction.reply({ content: `랜덤 닉네임 변경을 완료했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
