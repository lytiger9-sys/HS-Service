import { buildWelcomeEmbeds } from "../../shared/embeds.js";
import { buildBaseEmbed, palette } from "../../shared/embeds.js";
import { isAllowedGuild } from "../../shared/guards.js";
import { canUseFeature } from "../../shared/planAccess.js";

export default async function handleGuildMemberAdd(member, context) {
  if (!(await isAllowedGuild(context, member.guild.id))) {
    return;
  }
  await context.services.overviewChannels.syncGuild(member.guild).catch((error) => {
    console.error(`[overview] member addition sync failed for ${member.guild.id}:`, error);
  });
  if (member.user.bot) {
    return;
  }
  const access = await canUseFeature(context, member.guild.id, "welcome");
  if (!access.featureAllowed) return;

  await context.services.guildState.patch(member.guild.id, (guild) => {
    guild.joinOrder.unshift({
      userId: member.id,
      userTag: member.user.tag,
      joinedAt: new Date().toISOString()
    });
    guild.joinOrder = guild.joinOrder.slice(0, 500);
  });

  const settings = await context.services.settings.getSettings(member.guild.id);
  if (!settings.welcome.enabled) {
    return;
  }

  const { channelEmbed, dmEmbed } = buildWelcomeEmbeds(settings, member, member.guild);

  if (settings.welcome.channelId) {
    const channel = await member.guild.channels.fetch(settings.welcome.channelId).catch(() => null);
    if (channel?.isTextBased?.()) {
      await channel.send({ embeds: [channelEmbed] }).catch(() => null);
    }
  }

  try {
    await member.send({ embeds: [dmEmbed] });
  } catch (error) {
    await context.services.logs.sendWelcomeError(member.guild.id, {
      embeds: [
        buildBaseEmbed({
          title: "환영 DM 실패",
          description: `${member.user.tag} 에게 DM을 보내지 못했습니다.`,
          color: palette.danger,
          timestamp: Date.now()
        })
      ]
    });
  }
}
