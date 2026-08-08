import { SlashCommandBuilder } from "discord.js";
import { buildNoticeEmbed } from "../../shared/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("notice")
    .setDescription("웹사이트에 저장된 서버 공지를 표시합니다."),

  async execute(interaction, context) {
    const settings = await context.services.settings.getSettings(interaction.guildId);
    const embed = buildNoticeEmbed(interaction.guild, settings.notice);
    return interaction.reply({ embeds: [embed] });
  }
};
