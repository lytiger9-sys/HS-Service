import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("음성채널생성")
    .setDescription("임시 음성 채널을 생성합니다.")
    .addStringOption((option) =>
      option
        .setName("이름")
        .setDescription("채널 이름")
        .setRequired(false)
    )
    .addIntegerOption((option) => option
      .setName("인원")
      .setDescription("채널 최대 인원수 (0이면 제한 없음)")
      .setMinValue(0)
      .setMaxValue(99)
      .setRequired(false)),

  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString("이름") ?? "";
    const userLimit = interaction.options.getInteger("인원");
    try {
      const channel = await context.services.tempChannels.createTemporaryVoiceChannel({
        guild: interaction.guild,
        member: interaction.member,
        name,
        userLimit
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
