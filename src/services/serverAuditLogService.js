import { buildBaseEmbed, palette } from "../shared/embeds.js";

export function createServerAuditLogService(context) {
  async function send(guildId, eventKey, title, description, fields = []) {
    return context.services.logs.sendLogByKey(guildId, eventKey, {
      embeds: [buildBaseEmbed({ title, description, fields, color: palette.info, timestamp: Date.now() })]
    });
  }

  async function handleGuildUpdate(oldGuild, newGuild) {
    const brandingChanges = [];
    if (oldGuild.icon !== newGuild.icon) brandingChanges.push("아이콘이 변경되었습니다.");
    if (oldGuild.banner !== newGuild.banner) brandingChanges.push("배너가 변경되었습니다.");
    if (oldGuild.name !== newGuild.name) await send(newGuild.id, "serverNameChange", "서버 이름 변경", `이름: ${oldGuild.name} → ${newGuild.name}`);
    if (brandingChanges.length) await send(newGuild.id, "guildBrandingChange", "서버 브랜딩 변경", brandingChanges.join("\n"));
    return Boolean(brandingChanges.length || oldGuild.name !== newGuild.name);
  }

  async function handleChannelCreate(channel) {
    if (!channel.guild) return false;
    const eventKey = channel.type === 4 ? "categoryChange" : "channelChange";
    return send(channel.guild.id, eventKey, channel.type === 4 ? "카테고리 추가" : "채널 추가", `${channel.name}이(가) 추가되었습니다.`);
  }

  async function handleChannelDelete(channel) {
    if (!channel.guildId) return false;
    const eventKey = channel.type === 4 ? "categoryChange" : "channelChange";
    return send(channel.guildId, eventKey, channel.type === 4 ? "카테고리 삭제" : "채널 삭제", `${channel.name || channel.id}이(가) 삭제되었습니다.`);
  }

  async function handleChannelUpdate(oldChannel, newChannel) {
    if (!newChannel.guild) return false;
    const changed = oldChannel.name !== newChannel.name || oldChannel.parentId !== newChannel.parentId || oldChannel.topic !== newChannel.topic;
    if (!changed) return false;
    const eventKey = newChannel.type === 4 ? "categoryChange" : "channelChange";
    return send(newChannel.guild.id, eventKey, newChannel.type === 4 ? "카테고리 수정" : "채널 수정", `${oldChannel.name} → ${newChannel.name}`);
  }

  return { handleGuildUpdate, handleChannelCreate, handleChannelDelete, handleChannelUpdate };
}
