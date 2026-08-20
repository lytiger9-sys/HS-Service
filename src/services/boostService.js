import { buildBaseEmbed, convertLegacyPayload, palette } from "../shared/embeds.js";

export function createBoostService(context, guildState) {
  async function getSettings(guildId) {
    await guildState.ensure(guildId);
    const state = guildState.snapshot(guildId);
    return { enabled: state.settings?.boost?.enabled === true, channelId: state.settings?.boost?.channelId || "" };
  }

  async function setLogChannel(guildId, channelId, enabled) {
    await guildState.patch(guildId, (state) => {
      state.settings ??= {};
      state.settings.boost = { enabled, channelId: enabled ? channelId : "" };
    });
    return getSettings(guildId);
  }

  async function handleMemberUpdate(oldMember, newMember) {
    if (!newMember?.guild || oldMember?.premiumSince === newMember?.premiumSince) return false;
    const settings = await getSettings(newMember.guild.id);
    if (!settings.enabled || !settings.channelId) return false;
    const channel = newMember.guild.channels.cache.get(settings.channelId) || await newMember.guild.channels.fetch(settings.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return false;
    const started = !oldMember.premiumSince && Boolean(newMember.premiumSince);
    const ended = Boolean(oldMember.premiumSince) && !newMember.premiumSince;
    if (!started && !ended) return false;
    const user = newMember.user;
    const embed = buildBaseEmbed({
      title: started ? "서버 부스트 시작" : "서버 부스트 종료",
      description: started ? `${user}님이 서버를 부스트했습니다.` : `${user}님의 서버 부스트가 종료되었습니다.`,
      color: started ? palette.accent : palette.ink,
      thumbnail: user.displayAvatarURL({ size: 256 }),
      footer: `${newMember.guild.name} · 서버 부스트 로그`,
      timestamp: Date.now()
    });
    await channel.send(convertLegacyPayload({ embeds: [embed] }));
    return true;
  }

  return { getSettings, setLogChannel, handleMemberUpdate };
}
