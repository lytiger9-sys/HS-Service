import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

function voicePermissions(channel, member) {
  const permissions = channel.permissionsFor(member);
  return permissions?.has(PermissionFlagsBits.Connect) && permissions.has(PermissionFlagsBits.Speak);
}

export const tts = {
  data: new SlashCommandBuilder()
    .setName("tts")
    .setDescription("현재 음성 채널에서 문장을 읽습니다.")
    .addStringOption((option) => option.setName("문장").setDescription("읽을 문장").setRequired(true)),
  async execute(interaction, context) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) return interaction.reply({ content: "먼저 음성 채널에 들어가 주세요.", ephemeral: true });
    if (!voicePermissions(channel, interaction.guild.members.me)) return interaction.reply({ content: "봇에게 해당 음성 채널의 입장 및 발언 권한이 필요합니다.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      await context.services.tts.speak(channel, interaction.options.getString("문장", true));
      return interaction.editReply("TTS 재생 대기열에 추가했습니다.");
    } catch (error) {
      return interaction.editReply(error.message || "TTS를 재생하지 못했습니다.");
    }
  }
};

export const ttsStop = {
  data: new SlashCommandBuilder().setName("tts중지").setDescription("현재 서버의 TTS 재생과 대기열을 중지합니다."),
  async execute(interaction, context) {
    await context.services.tts.stop(interaction.guildId);
    return interaction.reply({ content: "TTS 재생을 중지했습니다.", ephemeral: true });
  }
};

export const ttsLeave = {
  data: new SlashCommandBuilder().setName("tts퇴장").setDescription("봇을 음성 채널에서 퇴장시킵니다."),
  async execute(interaction, context) {
    await context.services.tts.leave(interaction.guildId);
    return interaction.reply({ content: "음성 채널에서 퇴장했습니다.", ephemeral: true });
  }
};
