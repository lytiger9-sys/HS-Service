import { ContainerBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { palette } from "../shared/embeds.js";

export function createServerAuditLogService(context) {
  function componentsLog(title, description, fields = []) {
    const container = new ContainerBuilder()
      .setAccentColor(palette.info)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
    if (fields.length) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(fields.map((field) => `**${field.name}**\n${field.value}`).join("\n\n")));
    }
    return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
  }

  async function send(guildId, eventKey, title, description, fields = []) {
    return context.services.logs.sendLogByKey(guildId, eventKey, componentsLog(title, description, fields));
  }

  async function handleGuildUpdate(oldGuild, newGuild) {
    const changes = [];
    if (oldGuild.name !== newGuild.name) changes.push(`이름: ${oldGuild.name} → ${newGuild.name}`);
    if (oldGuild.icon !== newGuild.icon) changes.push("아이콘이 변경되었습니다.");
    if (oldGuild.banner !== newGuild.banner) changes.push("배너가 변경되었습니다.");
    if (!changes.length) return false;
    await send(newGuild.id, "serverIdentityChange", "서버 정보 변경", changes.join("\n"));
    return true;
  }

  async function handleMemberUpdate(oldMember, newMember) {
    if (!newMember?.guild || !oldMember?.roles?.cache || !newMember?.roles?.cache) return false;
    const added = [...newMember.roles.cache.values()].filter((role) => !oldMember.roles.cache.has(role.id) && role.id !== newMember.guild.id);
    const removed = [...oldMember.roles.cache.values()].filter((role) => !newMember.roles.cache.has(role.id) && role.id !== newMember.guild.id);
    if (!added.length && !removed.length) return false;
    const lines = [];
    if (added.length) lines.push(`지급: ${added.map((role) => `<@&${role.id}>`).join(", ")}`);
    if (removed.length) lines.push(`회수: ${removed.map((role) => `<@&${role.id}>`).join(", ")}`);
    await send(newMember.guild.id, "roleChange", "역할 변경", `${newMember} (${newMember.user.tag})\n${lines.join("\n")}`, [
      { name: "사용자", value: `${newMember.user.tag} (${newMember.id})`, inline: false }
    ]);
    return true;
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

    const nameChanged = oldChannel.name !== newChannel.name;
    const parentChanged = oldChannel.parentId !== newChannel.parentId;
    const topicChanged = oldChannel.topic !== newChannel.topic;
    if (!nameChanged && !parentChanged && !topicChanged) return false;

    if (parentChanged && newChannel.type !== 4) {
      const beforeParent = oldChannel.parentId ? `<#${oldChannel.parentId}>` : "없음";
      const afterParent = newChannel.parentId ? `<#${newChannel.parentId}>` : "없음";
      return send(
        newChannel.guild.id,
        "categoryChange",
        "채널 카테고리 변경",
        `<#${newChannel.id}>의 카테고리가 변경되었습니다.`,
        [{ name: "변경 전", value: beforeParent, inline: true }, { name: "변경 후", value: afterParent, inline: true }]
      );
    }

    if (nameChanged) {
      const eventKey = newChannel.type === 4 ? "categoryChange" : "channelChange";
      return send(newChannel.guild.id, eventKey, newChannel.type === 4 ? "카테고리 수정" : "채널 수정", `${oldChannel.name} → ${newChannel.name}`);
    }

    if (topicChanged) {
      return send(newChannel.guild.id, "channelChange", "채널 주제 변경", `<#${newChannel.id}>의 채널 주제가 변경되었습니다.`);
    }

    return false;
  }

  return { handleGuildUpdate, handleMemberUpdate, handleChannelCreate, handleChannelDelete, handleChannelUpdate };
}
