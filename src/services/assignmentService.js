import { PermissionFlagsBits } from "discord.js";
import { buildBaseEmbed, palette } from "../shared/embeds.js";

export function createAssignmentService(context, guildState) {
  async function handleMessage(message) {
    if (!message.guild || message.author.bot) {
      return false;
    }

    const settings = (await context.services.settings.getSettings(message.guild.id)).assignment;
    if (settings.enabled === false) {
      return false;
    }
    if (!settings.channelId || !settings.roleId || message.channelId !== settings.channelId) {
      return false;
    }

    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) {
      return false;
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return false;
    }

    const role = message.guild.roles.cache.get(settings.roleId);
    if (!role) {
      await context.services.logs.sendLogByKey(message.guild.id, "systemChannelId", {
        embeds: [
          buildBaseEmbed({
            title: "역할 지급 실패",
            description: "설정된 역할을 찾지 못했습니다.",
            color: palette.danger,
            timestamp: Date.now()
          })
        ]
      });
      return false;
    }

    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role.id, "channel assignment").catch(async () => {
        await context.services.logs.sendLogByKey(message.guild.id, "systemChannelId", {
          embeds: [
            buildBaseEmbed({
              title: "역할 지급 실패",
              description: `${member.user.tag} 에게 역할을 지급하지 못했습니다.`,
              color: palette.danger,
              timestamp: Date.now()
            })
          ]
        });
      });
    }

    return true;
  }

  return {
    handleMessage
  };
}
