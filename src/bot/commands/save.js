import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

function buildSaveModal() {
  const modal = new ModalBuilder()
    .setCustomId("save-note")
    .setTitle("내용 저장");

  const titleInput = new TextInputBuilder()
    .setCustomId("save-note-title")
    .setLabel("제목")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const contentInput = new TextInputBuilder()
    .setCustomId("save-note-content")
    .setLabel("내용")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1800)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(contentInput)
  );

  return modal;
}

export default {
  data: new SlashCommandBuilder()
    .setName("저장")
    .setDescription("제목과 내용을 모달로 저장합니다."),

  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }

    const isTicketChannel = await context.services.tickets.isBotTicketChannel(interaction.guildId, interaction.channelId).catch(() => false);
    if (!isTicketChannel) {
      return interaction.reply({ content: "봇이 만든 티켓 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }

    await interaction.showModal(buildSaveModal());
  }
};
