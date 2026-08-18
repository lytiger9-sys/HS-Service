import { SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("nickapply").setDescription("역할별 닉네임 규칙을 모든 멤버에게 적용합니다."),
  async execute(interaction, context) {
    const settings = await context.services.settings.getSettings(interaction.guildId);
    const changed = await context.services.nicknames.applyAllNicknames(interaction.guild, settings);
    await interaction.reply({ content: `닉네임 규칙 적용을 완료했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
