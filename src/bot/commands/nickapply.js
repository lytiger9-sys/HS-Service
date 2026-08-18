import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("nickapply").setDescription("역할별 닉네임 규칙을 모든 멤버에게 적용합니다."),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    const settings = await context.services.settings.getSettings(interaction.guildId);
    if (settings.nickname?.enabled === false) {
      return interaction.reply({ content: "현재 닉네임 기능이 꺼져 있습니다.", ephemeral: true });
    }
    const changed = await context.services.nicknames.applyAllNicknames(interaction.guild, settings);
    await interaction.reply({ content: `닉네임 규칙 적용을 완료했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
