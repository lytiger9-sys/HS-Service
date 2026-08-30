import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("서버정보")
    .setDescription("서버 인원, 봇 수, 채널 수를 보여줍니다."),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const payload = await context.services.serverInfo.buildInfoEmbed(interaction.guild);
    return interaction.editReply(payload);
  }
};
