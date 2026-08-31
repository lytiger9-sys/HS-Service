import { buildJoinOrderPayload } from "../commands/joinorder.js";
import { buildEmojiListPayload } from "../commands/emoji.js";
import { PermissionFlagsBits } from "discord.js";

export async function handleModalInteraction(interaction, context) {

  if (interaction.customId.startsWith("page:emoji-modal:")) {
    const [, , ownerId, totalPages] = interaction.customId.split(":");
    if (String(ownerId) !== String(interaction.user.id)) {
      return interaction.reply({ content: "이 페이지는 명령어를 실행한 사용자만 변경할 수 있습니다.", ephemeral: true });
    }
    const requestedPage = Number(interaction.fields.getTextInputValue("emoji-page-number"));
    const maxPage = Number(totalPages);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > maxPage) {
      return interaction.reply({ content: `페이지 번호는 1부터 ${maxPage} 사이의 정수로 입력해 주세요.`, ephemeral: true });
    }
    const emojis = await context.services.emojis.list(interaction.guild);
    return interaction.update(buildEmojiListPayload(emojis, requestedPage - 1, interaction.user.id));
  }

  if (interaction.customId.startsWith("page:joinorder-modal:")) {
    const [, , ownerId, totalPages] = interaction.customId.split(":");
    if (String(ownerId) !== String(interaction.user.id)) {
      return interaction.reply({ content: "이 페이지는 명령어를 실행한 사용자만 변경할 수 있습니다.", ephemeral: true });
    }
    const requestedPage = Number(interaction.fields.getTextInputValue("joinorder-page-number"));
    const maxPage = Number(totalPages);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > maxPage) {
      return interaction.reply({ content: `페이지 번호는 1부터 ${maxPage} 사이의 정수로 입력해 주세요.`, ephemeral: true });
    }
    const rows = await context.services.serverInfo.getJoinOrder(interaction.guild);
    return interaction.update(buildJoinOrderPayload(rows, requestedPage - 1, interaction.user.id));
  }

  if (interaction.customId === "account:settings") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    const bank = interaction.fields.getTextInputValue("account-bank").trim();
    const number = interaction.fields.getTextInputValue("account-number").trim();
    const holder = interaction.fields.getTextInputValue("account-holder").trim();
    if (!bank || !number || !holder) {
      return interaction.reply({ content: "은행·계좌번호·예금주를 모두 입력해 주세요.", ephemeral: true });
    }
    await context.services.guildState.patch(interaction.guildId, (draft) => {
      draft.account = { bank, number, holder };
    });
    return interaction.reply({ content: "계좌 정보가 저장되었습니다.", ephemeral: true });
  }

  if (interaction.customId === "partner:application") {
    await context.services.partners.createApplication(interaction);
    return interaction.reply({ content: "파트너 신청이 접수되었습니다. 관리자 검토 후 안내드리겠습니다.", ephemeral: true });
  }

  if (interaction.customId === "banner:registration") {
    await interaction.deferReply({ ephemeral: true });
    const slot = await context.services.partners.createBanner(interaction.guildId, {
      licenseKey: interaction.fields.getTextInputValue("banner-license-key"),
      serverName: interaction.fields.getTextInputValue("banner-server-name"),
      serverLink: interaction.fields.getTextInputValue("banner-server-link"),
      promoWebhook: interaction.fields.getTextInputValue("banner-promo-webhook"),
      recipientUserId: interaction.user.id
    });
    return interaction.editReply({ content: `상단배너 채널이 생성되었습니다. <#${slot.channelId}>` });
  }

  if (interaction.customId === "save-note") {
    const isTicketChannel = await context.services.tickets.isBotTicketChannel(interaction.guildId, interaction.channelId).catch(() => false);
    if (!isTicketChannel) {
      return interaction.reply({ content: "봇이 만든 티켓 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }
    const title = interaction.fields.getTextInputValue("save-note-title");
    const content = interaction.fields.getTextInputValue("save-note-content");

    const note = await context.services.notes.addNote(interaction.guildId, {
      title,
      content,
      authorId: interaction.user.id,
      authorTag: interaction.user.tag,
      ticketChannelId: interaction.channelId
    });

    return interaction.reply({
      content: `내용을 저장했습니다. ${note.title}`,
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith("poll-free:")) {
    const pollId = interaction.customId.split(":")[1];
    const value = interaction.fields.getTextInputValue("poll-free-text");
    await context.services.polls.handleFreeTextVote(interaction, pollId, value);
    return interaction.reply({ content: "자유 입력이 반영되었습니다.", ephemeral: true });
  }

  if (interaction.customId.startsWith("ticket:modal:")) {
    const categoryId = interaction.customId.split(":")[2];
    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.tickets.openTicketFromModal(interaction, categoryId);
    if (result.existing) {
      return interaction.editReply({
        content: `이미 열려 있는 티켓입니다. <#${result.channel.id}>`,
      });
    }

    return interaction.editReply({
      content: `티켓이 생성되었습니다. <#${result.channel.id}>`,
    });
  }

  return interaction.reply({ content: "처리할 수 없는 모달입니다.", ephemeral: true });
}
