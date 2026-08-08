import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("tempvoice")
    .setDescription("임시 음성 채널을 생성합니다.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("채널 이름")
        .setRequired(false)
    ),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString("name") ?? "";
    try {
      const channel = await context.services.tempChannels.createTemporaryVoiceChannel({
        guild: interaction.guild,
        member: interaction.member,
        name
      });

      return interaction.editReply({
        content: `임시 음성 채널을 만들었습니다: ${channel}`,
      });
    } catch (error) {
      return interaction.editReply({
        content: error.message || "임시 채널을 만들지 못했습니다.",
      });
    }
  }
};
