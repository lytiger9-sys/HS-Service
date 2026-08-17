import { PermissionFlagsBits } from "discord.js";

export async function getAllowedGuild(context, guildId = context.config.allowedGuildId) {
  if (typeof context.client?.isReady === "function" && !context.client.isReady()) {
    return {
      guild: null,
      status: 503,
      reason: "bot_not_ready"
    };
  }

  const guild = await context.client.guilds.fetch(String(guildId)).catch(() => null);
  if (!guild) {
    return {
      guild: null,
      status: 404,
      reason: "guild_missing"
    };
  }

  return {
    guild,
    status: 200,
    reason: "ok"
  };
}

export async function resolveDashboardAccess(context, userId, guildId = context.config.allowedGuildId) {
  const guildResult = await getAllowedGuild(context, guildId);
  if (!guildResult.guild) {
    return {
      ...guildResult,
      member: null,
      allowed: false
    };
  }

  if (!userId) {
    return {
      ...guildResult,
      member: null,
      allowed: false,
      status: 401,
      reason: "unauthenticated"
    };
  }

  const member = await guildResult.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return {
      ...guildResult,
      member: null,
      allowed: false,
      status: 403,
      reason: "not_member"
    };
  }

  const allowed = member.permissions.has(PermissionFlagsBits.Administrator);

  return {
    ...guildResult,
    member,
    allowed,
    status: allowed ? 200 : 403,
    reason: allowed ? "admin" : "not_admin"
  };
}

export function getAccessMessage(access) {
  switch (access.reason) {
    case "bot_not_ready":
      return "봇이 아직 대시보드를 준비하지 못했습니다. 잠시 후 다시 시도하세요.";
    case "guild_missing":
      return "지정된 서버를 찾을 수 없습니다.";
    case "unauthenticated":
      return "로그인이 필요합니다.";
    case "not_member":
      return "지정된 서버에 참여한 계정만 사용할 수 있습니다.";
    case "not_admin":
      return "관리자 권한이 있어야 대시보드에 접근할 수 있습니다.";
    default:
      return "대시보드에 접근할 수 없습니다.";
  }
}

export async function resolveGuildAdministrator(context, guildId, userId) {
  const guild = await context.client.guilds.fetch(String(guildId)).catch(() => null);
  if (!guild || !userId) return { guild, member: null, allowed: false, status: guild ? 401 : 404, reason: guild ? "unauthenticated" : "guild_missing" };
  const member = await guild.members.fetch(String(userId)).catch(() => null);
  if (!member) return { guild, member: null, allowed: false, status: 403, reason: "not_member" };
  const allowed = member.permissions.has(PermissionFlagsBits.Administrator);
  return { guild, member, allowed, status: allowed ? 200 : 403, reason: allowed ? "admin" : "not_admin" };
}
