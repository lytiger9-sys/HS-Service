import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { canUseFeature, featureDeniedMessage } from "../../shared/planAccess.js";

async function ensureSecurityAccess(interaction, context) {
  if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    return false;
  }

  const access = await canUseFeature(context, interaction.guildId, "security");
  if (!access.featureAllowed) {
    const message = access.reason === "work-stopped"
      ? "이 서버의 모든 작업이 라이센스 관리자에 의해 중지되었습니다."
      : access.reason === "feature-ban"
        ? "이 기능은 현재 관리자 점검 모드로 일시 중지되어 있습니다."
        : featureDeniedMessage("security");
    await interaction.reply({ content: message, ephemeral: true });
    return false;
  }

  return true;
}

async function setChannelSecurity(interaction, context, excluded) {
  if (!(await ensureSecurityAccess(interaction, context))) return;

  const channelId = interaction.channelId;
  const settings = await context.services.settings.getSettings(interaction.guildId);
  const excludedChannels = new Set(settings.security?.exemptChannelIds || []);
  if (excluded) excludedChannels.add(channelId);
  else excludedChannels.delete(channelId);

  await context.services.settings.updateSection(interaction.guildId, "security", {
    exemptChannelIds: [...excludedChannels]
  });

  await interaction.reply({
    content: excluded
      ? "이 채널을 보안 적용 제외 채널로 설정했습니다. 이 채널에서는 보안 자동 제재가 작동하지 않습니다."
      : "이 채널을 다시 보안 적용 채널로 설정했습니다.",
    ephemeral: true
  });
}

export const securout = {
  data: new SlashCommandBuilder()
    .setName("securout")
    .setDescription("현재 채널을 보안 적용에서 제외합니다."),
  async execute(interaction, context) {
    return setChannelSecurity(interaction, context, true);
  }
};

export const securin = {
  data: new SlashCommandBuilder()
    .setName("securin")
    .setDescription("현재 채널을 보안 적용 대상으로 복귀시킵니다."),
  async execute(interaction, context) {
    return setChannelSecurity(interaction, context, false);
  }
};

export default { securout, securin };

/* c8 ignore next */
// 명령어는 현재 채널을 기준으로만 적용되므로 별도 옵션 없이 사용합니다.
