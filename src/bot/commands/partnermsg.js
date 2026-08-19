import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("partnermsg")
    .setDescription("현재 파트너 채널의 마지막 메시지를 매일 홍보 메시지로 지정합니다."),
  async execute(interaction, context) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    const partner = await context.services.partners.getByChannel(interaction.guildId, interaction.channelId);
    if (!partner) {
      return interaction.reply({ content: "파트너 전용 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }
    const saved = await context.services.partners.saveLatestMessage(interaction.guildId, interaction.channelId);
    return interaction.reply({
      content: saved
        ? "현재 채널의 마지막 메시지를 매일 홍보 메시지로 저장했습니다."
        : "저장할 메시지를 찾을 수 없습니다.",
      ephemeral: true
    });
  }
};

