import { isAdministrator } from "../../shared/guards.js";
import { SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("허니팟해제")
    .setDescription("현재 채널의 허니팟 지정을 해제합니다."),
  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    await context.services.honeypot.disableChannel(interaction.guildId, interaction.channelId);
    return interaction.reply({ content: "현재 채널의 허니팟 지정을 해제했습니다.", ephemeral: true });
  }
};
