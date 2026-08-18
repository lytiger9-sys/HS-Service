const RANDOM_PREFIXES = ["푸른", "은빛", "새벽", "고요한", "작은", "빛나는"];
const RANDOM_NAMES = ["여우", "구름", "별", "파도", "나무", "토끼", "달", "바람"];

export function getBotManagedRoles(guild) {
  const botMember = guild?.members?.me || guild?.members?.cache?.find((member) => member.user?.bot);
  const botRole = botMember?.roles?.highest;
  if (!botRole) return [];
  return [...guild.roles.cache.values()]
    .filter((role) => !role.managed && role.id !== guild.id && role.position < botRole.position)
    .sort((left, right) => right.position - left.position);
}

function roleRule(settings, role) {
  return settings?.nickname?.rules?.[role.id] || null;
}

export function getNicknameRule(member, settings) {
  const roles = [...member.roles.cache.values()]
    .filter((role) => role.id !== member.guild.id)
    .sort((left, right) => right.position - left.position);
  return roles.map((role) => roleRule(settings, role)).find(Boolean) || null;
}

export async function applyNickname(member, settings, reason = "nickname role rule") {
  if (!member || member.user?.bot || member.permissions?.has?.("Administrator")) return false;
  if (!member.manageable) return false;
  const rule = getNicknameRule(member, settings);
  if (!rule) return false;
  const base = member.user.username.slice(0, 24);
  const nickname = `${rule.prefix || ""}${base}${rule.suffix || ""}`.slice(0, 32);
  if (member.nickname === nickname) return false;
  await member.setNickname(nickname, reason);
  return true;
}

export async function applyAllNicknames(guild, settings) {
  await guild.members.fetch().catch(() => null);
  let changed = 0;
  for (const member of guild.members.cache.values()) {
    if (await applyNickname(member, settings).catch(() => false)) changed += 1;
  }
  return changed;
}

export async function randomizeNicknames(guild) {
  await guild.members.fetch().catch(() => null);
  let changed = 0;
  for (const member of guild.members.cache.values()) {
    if (member.user?.bot || member.permissions?.has?.("Administrator") || !member.manageable) continue;
    const prefix = RANDOM_PREFIXES[Math.floor(Math.random() * RANDOM_PREFIXES.length)];
    const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const suffix = Math.floor(1000 + Math.random() * 9000);
    if (await member.setNickname(`${prefix} ${name} ${suffix}`.slice(0, 32), "nickname randomize").then(() => true).catch(() => false)) changed += 1;
  }
  return changed;
}
