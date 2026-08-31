import {
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder
} from "discord.js";

const PENDING_REVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_HISTORY = 100;

const DEFAULTS = {
  enabled: true,
  logChannelId: "",
  reviewChannelId: "",
  logTemplate: "# 구매 로그\n--\n유저\n{user}\n제품명\n{product}",
  reviewTemplate: "# 구매 후기\n--\n유저\n{user}\n제품명\n{product}\n후기\n{review}"
};

function normalizeSettings(settings = {}) {
  const reviewTemplate = String(settings?.reviewTemplate || DEFAULTS.reviewTemplate).slice(0, 4000);
  return {
    ...DEFAULTS,
    ...(settings || {}),
    enabled: settings?.enabled !== false,
    logChannelId: String(settings?.logChannelId || ""),
    reviewChannelId: String(settings?.reviewChannelId || ""),
    logTemplate: String(settings?.logTemplate || DEFAULTS.logTemplate).slice(0, 4000),
    reviewTemplate: reviewTemplate.includes("{review}")
      ? reviewTemplate
      : `${reviewTemplate}\n\n후기\n{review}`.slice(0, 4000)
  };
}

function renderTemplate(template, values) {
  return String(template || "").replace(/\{(user|product|review)\}/g, (_, key) => values[key] || "-");
}

function buildComponentsPayload(content, { userId = "", accentColor = 0x3a7da8 } = {}) {
  const container = new ContainerBuilder().setAccentColor(accentColor);
  const text = String(content || "").trim();
  const lines = text ? text.split(/\r?\n/) : ["내용이 없습니다."];
  let buffer = [];
  const flush = () => {
    const value = buffer.join("\n").trim();
    buffer = [];
    if (!value) return;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(value.slice(0, 4000)));
  };

  for (const line of lines) {
    if (["--", "---", "___"].includes(line.trim())) {
      flush();
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    } else {
      buffer.push(line);
    }
  }
  flush();
  if (!container.toJSON().components?.length) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("내용이 없습니다."));
  }

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: userId ? { parse: [], users: [String(userId)] } : { parse: [] }
  };
}

function parseReview(content) {
  const match = String(content || "").trim().match(/^후기\s*:?\s*\r?\n+([\s\S]+)$/u);
  return match ? match[1].trim().slice(0, 3500) : "";
}

async function resolveTextChannel(guild, channelId) {
  if (!channelId) return null;
  const channel = guild.channels.cache.get(String(channelId)) || await guild.channels.fetch(String(channelId)).catch(() => null);
  return channel?.isTextBased?.() ? channel : null;
}

function reviewPrompt(productName) {
  return buildComponentsPayload(
    `# 구매 후기 작성 안내\n--\n제품명\n${productName}\n\n아래 양식으로 답장해 주세요.\n\`후기:\` 뒤에 줄바꿈하고 후기 내용을 작성하면 됩니다. 콜론은 생략해도 됩니다.\n\n예시\n후기:\n상품을 잘 받았어요!`,
    { accentColor: 0x8b6d42 }
  );
}

export function createPurchaseFeedbackService(context, guildState) {
  async function getSettings(guildId) {
    const settings = await context.services.settings.getSettings(guildId);
    return normalizeSettings(settings.purchaseFeedback);
  }

  async function saveSettings(guildId, patch) {
    const settings = normalizeSettings(patch);
    await context.services.settings.updateSettings(guildId, { purchaseFeedback: settings });
    return settings;
  }

  async function sendPurchaseLog(guild, user, productName) {
    const settings = await getSettings(guild.id);
    if (!settings.enabled) throw new Error("구매로그/후기 기능이 꺼져 있습니다.");
    const logChannel = await resolveTextChannel(guild, settings.logChannelId);
    if (!logChannel) throw new Error("구매로그 채널을 먼저 설정해 주세요.");

    const userMention = `<@${user.id}>`;
    const normalizedProduct = String(productName || "").trim().slice(0, 256);
    if (!normalizedProduct) throw new Error("제품명을 입력해 주세요.");

    const logMessage = await logChannel.send(buildComponentsPayload(
      renderTemplate(settings.logTemplate, { user: userMention, product: normalizedProduct, review: "" }),
      { userId: user.id, accentColor: 0x3a7da8 }
    ));

    let dmSent = false;
    let dmError = "";
    try {
      await user.send(reviewPrompt(normalizedProduct));
      await guildState.patch(guild.id, (state) => {
        state.purchaseFeedback ||= { pending: {}, history: [] };
        state.purchaseFeedback.pending ||= {};
        state.purchaseFeedback.pending[String(user.id)] = {
          userId: String(user.id),
          productName: normalizedProduct,
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + PENDING_REVIEW_TTL_MS).toISOString(),
          logMessageId: String(logMessage.id || "")
        };
      });
      dmSent = true;
    } catch (error) {
      dmError = "DM을 보낼 수 없어 후기를 요청하지 못했습니다.";
      console.warn(`[purchase-feedback] DM failed for ${user.id}:`, error.message);
    }

    return { logMessage, dmSent, dmError };
  }

  async function handleDirectMessage(message) {
    if (message.guild || message.author?.bot) return false;
    const review = parseReview(message.content);
    const candidates = [];

    for (const guild of context.client.guilds.cache.values()) {
      const state = guildState.snapshot(guild.id);
      const pending = state.purchaseFeedback?.pending?.[String(message.author.id)];
      if (!pending) continue;
      if (new Date(pending.expiresAt || 0).getTime() <= Date.now()) {
        await guildState.patch(guild.id, (nextState) => {
          delete nextState.purchaseFeedback?.pending?.[String(message.author.id)];
        });
        continue;
      }
      candidates.push({ guild, pending });
    }

    if (!candidates.length) return false;
    if (!review) {
      await message.reply("후기는 `후기:`라고 적은 뒤 줄바꿈하고 내용을 작성해 주세요. 콜론은 생략해도 됩니다.").catch(() => null);
      return true;
    }

    candidates.sort((a, b) => new Date(b.pending.requestedAt || 0) - new Date(a.pending.requestedAt || 0));
    const { guild, pending } = candidates[0];
    const settings = await getSettings(guild.id);
    const reviewChannel = await resolveTextChannel(guild, settings.reviewChannelId);
    if (!settings.enabled || !reviewChannel) {
      await message.reply("후기 게시 채널이 설정되지 않아 현재 후기를 접수할 수 없습니다.").catch(() => null);
      return true;
    }

    const userMention = `<@${message.author.id}>`;
    const reviewMessage = await reviewChannel.send(buildComponentsPayload(
      renderTemplate(settings.reviewTemplate, { user: userMention, product: pending.productName, review }),
      { userId: message.author.id, accentColor: 0x8b6d42 }
    ));

    await guildState.patch(guild.id, (state) => {
      state.purchaseFeedback ||= { pending: {}, history: [] };
      state.purchaseFeedback.pending ||= {};
      state.purchaseFeedback.history ||= [];
      delete state.purchaseFeedback.pending[String(message.author.id)];
      state.purchaseFeedback.history.unshift({
        userId: String(message.author.id),
        productName: pending.productName,
        content: review,
        createdAt: new Date().toISOString(),
        messageId: String(reviewMessage.id || "")
      });
      state.purchaseFeedback.history = state.purchaseFeedback.history.slice(0, MAX_HISTORY);
    });
    await message.reply("후기가 등록되었습니다. 감사합니다.").catch(() => null);
    return true;
  }

  return { getSettings, saveSettings, sendPurchaseLog, handleDirectMessage, parseReview, buildComponentsPayload };
}
