import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

function buildFreeTextModal(pollId) {
  const modal = new ModalBuilder()
    .setCustomId(`poll-free:${pollId}`)
    .setTitle("투표 자유 입력");

  const input = new TextInputBuilder()
    .setCustomId("poll-free-text")
    .setLabel("답변")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

export async function handleButtonInteraction(interaction, context) {
  const [scope, action, id, extra] = interaction.customId.split(":");

  if (scope === "ticket" && action === "close") {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 닫을 수 있습니다.", ephemeral: true });
    }

    const channelId = id;
    if (!interaction.guild || interaction.channelId !== channelId) {
      return interaction.reply({ content: "현재 채널에서만 닫을 수 있습니다.", ephemeral: true });
    }

    await context.services.tickets.closeTicket({
      guild: interaction.guild,
      channel: interaction.channel,
      closedBy: interaction.member,
      reason: `button close by ${interaction.user.tag}`
    });

    return interaction.reply({ content: "티켓을 닫았습니다.", ephemeral: true });
  }

  if (scope === "poll" && action === "vote") {
    const pollId = id;
    const optionIndex = Number(extra);
    await context.services.polls.handleChoiceVote(interaction, pollId, optionIndex);
    return interaction.reply({ content: "투표가 반영되었습니다.", ephemeral: true });
  }

  if (scope === "poll" && action === "free") {
    const pollId = id;
    return interaction.showModal(buildFreeTextModal(pollId));
  }

  return interaction.reply({ content: "처리할 수 없는 버튼입니다.", ephemeral: true });
}
