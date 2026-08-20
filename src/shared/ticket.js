import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { clampText, slugifyDiscordName } from "./naming.js";
import { palette, parseColor } from "./embeds.js";

const DEFAULT_TICKET_BOARD = {
  channelId: "",
  messageId: "",
  title: "티켓 안내",
  description: "버튼을 눌러 티켓을 열 수 있습니다.",
  buttonLabel: "티켓 열기",
  accentColor: "#4f6685",
  footerText: "봇 전용 티켓"
};

export function createDefaultTicketSettings() {
  return {
    enabled: true,
    board: { ...DEFAULT_TICKET_BOARD },
    categories: []
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function readBoolean(value) {
  if (Array.isArray(value)) return value.some((entry) => readBoolean(entry));
  return value === true || value === "true" || value === "1" || value === "on";
}

function firstValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value[0] : "";
  }

  return value;
}

function normalizeText(value, fallback = "") {
  const resolved = firstValue(value);
  if (resolved == null || resolved === "") {
    return fallback;
  }

  return String(resolved).trim();
}

function toEntries(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (isPlainObject(value)) {
    return Object.values(value);
  }

  return [];
}

function normalizeTicketQuestion(question = {}, index = 0) {
  return {
    id: normalizeText(question.id || question.questionId, `question-${index + 1}`) || `question-${index + 1}`,
    label: clampText(normalizeText(question.label ?? question.title, ""), 120),
    required: readBoolean(firstValue(question.required)),
    style: normalizeText(question.style, "paragraph") === "short" ? "short" : "paragraph"
  };
}

function normalizeTicketCategory(category = {}, index = 0) {
  const questions = toEntries(category.questions)
    .map((question, questionIndex) => normalizeTicketQuestion(question, questionIndex))
    .filter((question) => question.label)
    .slice(0, 5);

  return {
    id: normalizeText(category.id || category.categoryId, `category-${index + 1}`) || `category-${index + 1}`,
    label: clampText(normalizeText(category.label ?? category.name, ""), 80),
    serverCategoryId: normalizeText(category.serverCategoryId || category.channelCategoryId, ""),
    questions
  };
}

export function normalizeTicketSettings(settings = {}) {
  const source = isPlainObject(settings) ? settings : {};
  const boardSource = isPlainObject(source.board) ? source.board : {};
  const categoriesSource = toEntries(source.categories);

  return {
    ...source,
    enabled: source.enabled === undefined ? true : readBoolean(source.enabled),
    board: {
      ...DEFAULT_TICKET_BOARD,
      ...boardSource,
      channelId: normalizeText(boardSource.channelId ?? source.channelId, ""),
      messageId: normalizeText(boardSource.messageId ?? source.messageId, ""),
      title: clampText(normalizeText(boardSource.title ?? source.title, DEFAULT_TICKET_BOARD.title), 120),
      description: clampText(normalizeText(boardSource.description ?? source.description, DEFAULT_TICKET_BOARD.description), 2000),
      buttonLabel: clampText(normalizeText(boardSource.buttonLabel ?? source.buttonLabel, DEFAULT_TICKET_BOARD.buttonLabel), 80),
      accentColor: normalizeText(boardSource.accentColor ?? source.accentColor, DEFAULT_TICKET_BOARD.accentColor) || DEFAULT_TICKET_BOARD.accentColor,
      footerText: clampText(normalizeText(boardSource.footerText ?? source.footerText, DEFAULT_TICKET_BOARD.footerText), 120)
    },
    categories: categoriesSource
      .map((category, index) => normalizeTicketCategory(category, index))
      .filter((category) => category.label || category.serverCategoryId || category.questions.length)
  };
}

export function parseTicketSettingsBody(body = {}) {
  const serializedCategories = body.ticketCategoriesJson;
  const categorySource = body.ticketCategories;
  const categories = (() => {
    if (typeof serializedCategories === "string" && serializedCategories.trim()) {
      try {
        const parsed = JSON.parse(serializedCategories);
        return toEntries(parsed);
      } catch {
        // Fall back to the nested form fields for older clients.
      }
    }

    if (typeof categorySource === "string" && categorySource.trim()) {
      try {
        const parsed = JSON.parse(categorySource);
        return toEntries(parsed);
      } catch {
        return [];
      }
    }

    return toEntries(categorySource);
  })();

  return normalizeTicketSettings({
    enabled: readBoolean(body.ticketEnabled) || body.ticketEnabled === undefined,
    board: {
      channelId: body.ticketBoardChannelId || "",
      messageId: body.ticketBoardMessageId || "",
      title: body.ticketBoardTitle || "",
      description: body.ticketBoardDescription || "",
      buttonLabel: body.ticketBoardButtonLabel || "",
      accentColor: body.ticketBoardAccentColor || "",
      footerText: body.ticketBoardFooterText || ""
    },
    categories
  });
}

function textDisplay(content) {
  return {
    type: 10,
    content: clampText(content, 4000)
  };
}

function separator() {
  return {
    type: 14,
    divider: true
  };
}

function section(content, accessory = null) {
  const payload = {
    type: 9,
    components: [textDisplay(content)]
  };

  if (accessory) {
    payload.accessory = accessory;
  }

  return payload;
}

function container(components, accentColor) {
  return {
    type: 17,
    accentColor: parseColor(accentColor, palette.info),
    components
  };
}

export function buildTicketBoardPayload(guildName, settings = {}) {
  const ticketSettings = normalizeTicketSettings(settings);
  const openButton = new ButtonBuilder()
    .setCustomId("ticket:open")
    .setLabel(ticketSettings.board.buttonLabel || DEFAULT_TICKET_BOARD.buttonLabel)
    .setStyle(ButtonStyle.Primary)
    .toJSON();

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(
        [
          textDisplay(`## ${ticketSettings.board.title || DEFAULT_TICKET_BOARD.title}\n${ticketSettings.board.description || DEFAULT_TICKET_BOARD.description}`),
          separator(),
          section("티켓을 열려면 아래 버튼을 누르세요.", openButton)
        ],
        ticketSettings.board.accentColor
      )
    ]
  };
}

export function buildTicketCategoryMenuPayload(settings = {}) {
  const ticketSettings = normalizeTicketSettings(settings);
  const categories = ticketSettings.categories.slice(0, 25);

  if (!categories.length) {
    return {
      content: "설정된 티켓 카테고리가 없습니다. 먼저 추가하세요.",
      ephemeral: true
    };
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket:select-category")
    .setPlaceholder("티켓 카테고리를 선택하세요")
    .addOptions(
      categories.map((category) => ({
        label: clampText(category.label, 100),
        value: category.id,
        description: clampText(`${category.questions.length}개 질문`, 100)
      }))
    );

  return {
    content: "티켓 카테고리를 선택하세요.",
    ephemeral: true,
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

export function buildTicketQuestionModal(category) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket:modal:${category.id}`)
    .setTitle(clampText(`${category.label} 정보 입력`, 45));

  const questions = category.questions.slice(0, 5);
  if (!questions.length) {
    const input = new TextInputBuilder()
      .setCustomId("ticket-question-default")
      .setLabel("추가 정보")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(4000)
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  }

  for (const question of questions) {
    const input = new TextInputBuilder()
      .setCustomId(`ticket-question-${question.id}`)
      .setLabel(clampText(question.label, 45))
      .setStyle(question.style === "short" ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setMaxLength(4000)
      .setRequired(Boolean(question.required));

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

export function buildTicketChannelPayload({ guildName, requester, category, answers, channelId, createdAt = Date.now() }) {
  const answerLines = answers.length
    ? answers.map((entry) => `**${entry.label}**\n${entry.value || "없음"}`).join("\n\n")
    : "제출된 정보가 없습니다.";

  const closeButton = new ButtonBuilder()
    .setCustomId(`ticket:close:${channelId}`)
    .setLabel("티켓 닫기")
    .setStyle(ButtonStyle.Danger)
    .toJSON();

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      container(
        [
          textDisplay(`## ${category.label} 티켓\n${requester.mention} 님의 요청으로 생성된 봇 전용 티켓입니다.`),
          separator(),
          section(
            [
              `**요청자** ${requester.mention}`,
              `**분류** ${category.label}`,
              `**생성 시각** <t:${Math.floor(createdAt / 1000)}:F>`
            ].join("\n"),
            closeButton
          ),
          separator(),
          textDisplay(`**제출 정보**\n${answerLines}`),
          separator(),
          textDisplay(`> ${guildName} · 봇이 생성한 티켓`)
        ],
        palette.graphite
      )
    ]
  };
}

export function buildTicketClosePromptPayload({ channelName, requestedByTag }) {
  const confirm = new ButtonBuilder()
    .setCustomId(`ticket:close-confirm:${channelName}`)
    .setLabel("삭제 확정")
    .setStyle(ButtonStyle.Danger);

  const cancel = new ButtonBuilder()
    .setCustomId(`ticket:close-cancel:${channelName}`)
    .setLabel("취소")
    .setStyle(ButtonStyle.Secondary);

  return {
    content: `${requestedByTag || "관리자"} 님, 이 티켓을 정말 닫을까요?`,
    components: [new ActionRowBuilder().addComponents(confirm, cancel)]
  };
}

export function buildTicketClosedNoticePayload() {
  return {
    content: "티켓이 확정되어 10초 후 삭제됩니다."
  };
}

export function buildTicketCancelNoticePayload() {
  return {
    content: "티켓 삭제를 취소했습니다.",
    ephemeral: true
  };
}

export function getTicketChannelName(category, member) {
  const categorySlug = slugifyDiscordName(category.label || category.id, "ticket");
  const userSlug = slugifyDiscordName(member.user.username, member.id);
  return clampText(`ticket-${categorySlug}-${userSlug}`, 100);
}

export function buildTicketAnswersFromInteraction(interaction, category) {
  return category.questions.slice(0, 5).map((question) => ({
    id: question.id,
    label: question.label,
    required: question.required,
    value: interaction.fields.getTextInputValue(`ticket-question-${question.id}`) || ""
  }));
}
