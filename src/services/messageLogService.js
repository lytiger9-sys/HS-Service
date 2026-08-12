import { buildBaseEmbed, palette } from "../shared/embeds.js";

function shorten(value, limit = 900) {
  const text = String(value ?? "");
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(limit - 3, 0))}...`;
}

function normalizeText(value, fallback = "내용 없음") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function resolveAuthorTag(message) {
  return message?.author?.tag || message?.author?.username || message?.author?.id || "알 수 없음";
}

function resolveChannelLabel(message, fallbackChannel = null) {
  const channel = message?.channel ?? fallbackChannel;
  if (channel?.name) {
    return `#${channel.name}`;
  }

  if (channel?.id) {
    return `<#${channel.id}>`;
  }

  return "알 수 없음";
}

function summarizeAttachments(message) {
  const attachments = [...(message?.attachments?.values?.() ?? [])]
    .map((attachment) => attachment.name || attachment.url)
    .filter(Boolean)
    .slice(0, 5);

  if (!attachments.length) {
    return "없음";
  }

  return shorten(attachments.join(", "));
}

function hasMeaningfulUpdate(before, after) {
  if (!before || !after) {
    return true;
  }

  const beforeContent = String(before.content ?? "");
  const afterContent = String(after.content ?? "");
  const beforeAttachments = before.attachments?.size ?? 0;
  const afterAttachments = after.attachments?.size ?? 0;
  const beforeEmbeds = before.embeds?.length ?? 0;
  const afterEmbeds = after.embeds?.length ?? 0;

  return (
    beforeContent !== afterContent ||
    beforeAttachments !== afterAttachments ||
    beforeEmbeds !== afterEmbeds
  );
}

async function resolveMessageSnapshot(message) {
  if (!message) {
    return null;
  }

  if (!message.partial) {
    return message;
  }

  const fetched = await message.fetch().catch(() => null);
  return fetched ?? message;
}

export function createMessageLogService(context) {
  async function sendServerLog(guildId, payload) {
    return context.services.logs.sendLogByKey(guildId, "serverChannelId", payload);
  }

  async function handleMessageUpdate(oldMessage, newMessage) {
    const before = await resolveMessageSnapshot(oldMessage);
    const after = await resolveMessageSnapshot(newMessage);
    const guildId = after?.guildId || before?.guildId;
    if (!guildId) {
      return false;
    }

    const author = after?.author || before?.author || null;
    if (author?.bot) {
      return false;
    }

    if (!hasMeaningfulUpdate(before, after)) {
      return false;
    }

    await sendServerLog(guildId, {
      embeds: [
        buildBaseEmbed({
          title: "메시지 수정",
          description: `${resolveAuthorTag(after || before)}의 메시지가 수정되었습니다.`,
          color: palette.info,
          fields: [
            { name: "채널", value: resolveChannelLabel(after || before), inline: true },
            { name: "작성자", value: resolveAuthorTag(after || before), inline: true },
            { name: "수정 전", value: shorten(normalizeText(before?.content)), inline: false },
            { name: "수정 후", value: shorten(normalizeText(after?.content)), inline: false },
            { name: "첨부파일", value: summarizeAttachments(after || before), inline: false }
          ],
          timestamp: Date.now()
        })
      ]
    });

    return true;
  }

  async function handleMessageDelete(message) {
    const snapshot = await resolveMessageSnapshot(message);
    const guildId = snapshot?.guildId || snapshot?.channel?.guildId || snapshot?.channel?.guild?.id;
    if (!guildId) {
      return false;
    }

    const author = snapshot?.author || null;
    if (author?.bot) {
      return false;
    }

    await sendServerLog(guildId, {
      embeds: [
        buildBaseEmbed({
          title: "메시지 삭제",
          description: `${resolveAuthorTag(snapshot)}의 메시지가 삭제되었습니다.`,
          color: palette.danger,
          fields: [
            { name: "채널", value: resolveChannelLabel(snapshot), inline: true },
            { name: "작성자", value: resolveAuthorTag(snapshot), inline: true },
            { name: "내용", value: shorten(normalizeText(snapshot?.content)), inline: false },
            { name: "첨부파일", value: summarizeAttachments(snapshot), inline: false }
          ],
          timestamp: Date.now()
        })
      ]
    });

    return true;
  }

  async function handleMessageDeleteBulk(messages, channel = null) {
    const entries = [...messages.values()].filter((message) => !message?.author?.bot);
    if (!entries.length) {
      return false;
    }

    const guildId = channel?.guild?.id || entries[0]?.guildId || entries[0]?.guild?.id || null;
    if (!guildId) {
      return false;
    }

    const lines = entries.slice(0, 10).map((message) => {
      const author = resolveAuthorTag(message);
      const content = shorten(normalizeText(message?.content));
      return `- ${author}: ${content}`;
    });

    await sendServerLog(guildId, {
      embeds: [
        buildBaseEmbed({
          title: "메시지 일괄 삭제",
          description: `${resolveChannelLabel(null, channel)}에서 ${entries.length}개의 메시지가 삭제되었습니다.`,
          color: palette.danger,
          fields: [
            { name: "채널", value: resolveChannelLabel(null, channel), inline: true },
            { name: "개수", value: String(entries.length), inline: true },
            { name: "삭제 목록", value: shorten(lines.join("\n"), 1000), inline: false }
          ],
          timestamp: Date.now()
        })
      ]
    });

    return true;
  }

  return {
    handleMessageUpdate,
    handleMessageDelete,
    handleMessageDeleteBulk
  };
}
