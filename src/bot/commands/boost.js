import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

function canManage(interaction) { return isAdministrator(interaction.member) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild); }

export const boostOn = {
  data: new SlashCommandBuilder().setName("booston").setDescription("현재 채널에 서버 부스트 로그를 켭니다."),
  async execute(interaction, context) {
    if (!canManage(interaction)) return interaction.reply({ content: "서버 관리 권한이 필요합니다.", ephemeral: true });
    if (interaction.channel?.type !== ChannelType.GuildText && interaction.channel?.type !== ChannelType.GuildAnnouncement) return interaction.reply({ content: "텍스트 채널에서만 사용할 수 있습니다.", ephemeral: true });
    await context.services.boost.setLogChannel(interaction.guildId, interaction.channelId, true);
    return interaction.reply({ content: `이 채널에 서버 부스트 로그를 설정했습니다.`, ephemeral: true });
  }
};

export const boostOff = {
  data: new SlashCommandBuilder().setName("boostoff").setDescription("서버 부스트 로그를 끕니다."),
  async execute(interaction, context) {
    if (!canManage(interaction)) return interaction.reply({ content: "서버 관리 권한이 필요합니다.", ephemeral: true });
    await context.services.boost.setLogChannel(interaction.guildId, "", false);
    return interaction.reply({ content: "서버 부스트 로그를 껐습니다.", ephemeral: true });
  }
};
