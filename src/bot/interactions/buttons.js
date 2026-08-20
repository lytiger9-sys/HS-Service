import { isAdministrator } from "../../shared/guards.js";
import { buildJoinOrderPayload } from "../commands/joinorder.js";
import { buildEmojiListPayload } from "../commands/emoji.js";
import { buildSoundboardListPayload } from "../commands/soundboard.js";
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

function buildFreeTextModal(pollId) {
  const modal = new ModalBuilder()
    .setCustomId(`poll-free:${pollId}`)
    .setTitle("투표 자유 입력");

  const input = new TextInputBuilder()
    .setCustomId("poll-free-text")
    .setLabel("내용")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildBannerRegistrationModal() {
  const modal = new ModalBuilder().setCustomId("banner:registration").setTitle("상단배너 등록");
  const fields = [
    ["banner-license-key", "배너 라이선스 키", TextInputStyle.Short],
    ["banner-server-name", "서버명", TextInputStyle.Short],
    ["banner-server-link", "서버 링크", TextInputStyle.Short],
    ["banner-promo-webhook", "우리 서버 홍보 웹훅", TextInputStyle.Paragraph]
  ];
  modal.addComponents(...fields.map(([id, label, style]) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true).setMaxLength(500)
  )));
  return modal;
}

function buildPartnerApplicationModal() {
  const modal = new ModalBuilder().setCustomId("partner:application").setTitle("파트너 신청");
  const fields = [
    ["partner-affiliate-name", "파트너 제휴명", TextInputStyle.Short],
    ["partner-member-count", "파트너 현 인원", TextInputStyle.Short],
    ["partner-recovery-key", "복구키 사용 여부", TextInputStyle.Short],
    ["partner-server-link", "서버 링크", TextInputStyle.Short],
    ["partner-promo-webhook", "이 서버 홍보용 채널 웹훅", TextInputStyle.Paragraph]
  ];
  modal.addComponents(...fields.map(([id, label, style]) => new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true).setMaxLength(500)
  )));
  return modal;
}

export async function handleButtonInteraction(interaction, context) {
  const [scope, action, id, extra, total] = interaction.customId.split(":");

  if (scope === "page" && action === "joinorder-jump") {
    if (String(id) !== String(interaction.user.id)) {
      return interaction.reply({ content: "이 페이지 버튼은 명령어를 실행한 사용자만 사용할 수 있습니다.", ephemeral: true });
    }
    const modal = new ModalBuilder().setCustomId(`page:joinorder-modal:${id}:${extra}`).setTitle("페이지 이동");
    const input = new TextInputBuilder().setCustomId("joinorder-page-number").setLabel(`페이지 번호 (1-${extra})`).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(3);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (scope === "page" && action === "joinorder") {
    if (String(id) !== String(interaction.user.id)) {
      return interaction.reply({ content: "이 페이지 버튼은 명령어를 실행한 사용자만 사용할 수 있습니다.", ephemeral: true });
    }
    const rows = await context.services.serverInfo.getJoinOrder(interaction.guild);
    return interaction.update(buildJoinOrderPayload(rows, Number(extra), interaction.user.id));
  }

  if (scope === "page" && action === "sound") {
    if (String(id) !== String(interaction.user.id)) return interaction.reply({ content: "이 페이지는 목록을 실행한 사용자만 사용할 수 있습니다.", ephemeral: true });
    const page = Number(extra) || 1;
    const pageCount = Number(total) || 1;
    const sounds = await context.services.soundboards.list(interaction.guild);
    return interaction.update(buildSoundboardListPayload(sounds, Math.min(Math.max(page, 1), pageCount), interaction.user.id));
  }

  if (scope === "page" && action === "emoji-jump") {
    if (String(id) !== String(interaction.user.id)) return interaction.reply({ content: "이 페이지 버튼은 목록을 실행한 사용자만 사용할 수 있습니다.", ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`page:emoji-modal:${id}:${extra}`).setTitle("페이지 이동");
    const input = new TextInputBuilder().setCustomId("emoji-page-number").setLabel(`페이지 번호 (1-${extra})`).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(1).setMaxLength(3);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (scope === "page" && action === "emoji") {
    if (String(id) !== String(interaction.user.id)) return interaction.reply({ content: "이 페이지 버튼은 목록을 실행한 사용자만 사용할 수 있습니다.", ephemeral: true });
    const emojis = await context.services.emojis.list(interaction.guild);
    return interaction.update(buildEmojiListPayload(emojis, Number(extra) || 0, interaction.user.id));
  }

  if (interaction.customId === "shop:products") {
    return interaction.reply(await context.services.shop.productMenu(interaction.guildId));
  }

  if (interaction.customId === "shop:info") {
    const balance = await context.services.shop.getBalance(interaction.guildId, interaction.user.id);
    return interaction.reply({ content: `현재 보유 캐시: ${balance.toLocaleString()} 캐시`, ephemeral: true });
  }

  if (scope === "event" && action === "join") {
    const result = await context.services.events.participate(interaction, id);
    return interaction.reply({ content: result.already ? "이미 이벤트에 참여했습니다." : "이벤트 참여가 완료되었습니다.", ephemeral: true });
  }

  if (interaction.customId === "partner:apply") {
    return interaction.showModal(buildPartnerApplicationModal());
  }

  if (interaction.customId === "banner:register") {
    return interaction.showModal(buildBannerRegistrationModal());
  }

  if (scope === "partner" && action === "approve") {
    if (!isAdministrator(interaction.member)) return interaction.reply({ content: "관리자만 파트너를 승인할 수 있습니다.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const approved = await context.services.partners.approve(interaction.guildId, id, interaction.user);
    return interaction.editReply({ content: approved ? "파트너 신청을 승인하고 채널과 웹훅을 생성했습니다." : "이미 처리된 파트너 신청입니다." });
  }

  if (scope === "partner" && action === "reject") {
    if (!isAdministrator(interaction.member)) return interaction.reply({ content: "관리자만 파트너를 거절할 수 있습니다.", ephemeral: true });
    await context.services.partners.reject(interaction.guildId, id, interaction.user);
    return interaction.update({ content: "파트너 신청을 거절했습니다.", components: [] });
  }

  if (scope === "ticket" && action === "open") {
    const ticketSettings = await context.services.tickets.getSettings(interaction.guildId);
    if (!ticketSettings.categories?.length) {
      await interaction.deferReply({ ephemeral: true });
      const result = await context.services.tickets.openTicket({
        guild: interaction.guild,
        member: interaction.member,
        categoryId: "",
        answers: [],
        requestedBy: interaction.member
      });
      return interaction.editReply({ content: result.existing ? "이미 열려 있는 티켓이 있습니다." : "티켓을 열었습니다." });
    }
    const payload = await context.services.tickets.buildCategoryMenu(interaction.guildId);
    return interaction.reply(payload);
  }

  if (scope === "ticket" && action === "close") {
    if (!interaction.guild || !interaction.channel) {
      return interaction.reply({ content: "서버 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }

    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 티켓을 닫을 수 있습니다.", ephemeral: true });
    }

    const payload = await context.services.tickets.beginClosePrompt({
      guild: interaction.guild,
      channel: interaction.channel,
      requestedBy: interaction.member
    });

    return interaction.reply({ ...payload, ephemeral: true });
  }

  if (scope === "ticket" && action === "close-confirm") {
    if (!interaction.guild || !interaction.channel) {
      return interaction.reply({ content: "서버 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }

    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 티켓을 닫을 수 있습니다.", ephemeral: true });
    }

    await context.services.tickets.confirmClose({
      guild: interaction.guild,
      channel: interaction.channel,
      closedBy: interaction.member
    });

    return interaction.update({
      content: "티켓 삭제가 확정되었습니다. 10초 후 삭제됩니다.",
      components: []
    });
  }

  if (scope === "ticket" && action === "close-cancel") {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }

    const payload = await context.services.tickets.cancelClosePrompt();
    return interaction.update({
      content: payload.content,
      components: []
    });
  }

  if (scope === "poll" && action === "stop") {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 투표를 중지할 수 있습니다.", ephemeral: true });
    }
    await context.services.polls.stopPoll(interaction.guildId, id);
    return interaction.reply({ content: "투표를 즉시 중지했습니다.", ephemeral: true });
  }

  if (scope === "poll" && id === "vote") {
    const pollId = action;
    const optionIndex = Number(extra);
    await context.services.polls.handleChoiceVote(interaction, pollId, optionIndex);
    return interaction.reply({ content: "투표가 반영되었습니다.", ephemeral: true });
  }

  if (scope === "poll" && id === "free") {
    const pollId = action;
    return interaction.showModal(buildFreeTextModal(pollId));
  }

  if (scope === "staff" && action === "toggle") {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 출퇴근 상태를 변경할 수 있습니다.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.staff.toggleStatus(interaction.guildId, interaction.member);
    return interaction.editReply({
      content: `상태를 ${result.label}(으)로 변경했습니다.`
    });
  }

  return interaction.reply({ content: "처리할 수 없는 버튼입니다.", ephemeral: true });
}
