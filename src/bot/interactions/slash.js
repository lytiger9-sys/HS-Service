import { canUseFeature, featureDeniedMessage, getGuildPlanAccess } from "../../shared/planAccess.js";

export function commandFeature(commandName) {
  const name = String(commandName || "");
  if (["save", "savednote", "savednotes", "저장", "저장내용"].includes(name)) return "ticket";
  if (["clear", "punishments", "honeypotban", "honeypotkick", "exithoneypot"].includes(name)) return "security";
  if (["tempvoice", "이모지스틸", "이모지목록", "이모지삭제", "사운드스틸", "사운드목록", "사운드삭제"].includes(name)) return "voice";
  if (["serverinfo", "joinorder", "staff", "프로필", "복제", "카테고리삭제"].includes(name)) return "administrators";
  if (["nickapply", "nickrandom", "nickinit"].includes(name)) return "nickname";
  if (["도박", "캐시", "캐시지급", "생일"].includes(name)) return "shop";
  if (["booston", "boostoff"].includes(name)) return "logs";
  if (name === "partnermsg") return "partner";
  if (["securout", "securin"].includes(name)) return "security";
  if (name === "환율") return "events";
  return null;
}

export async function handleSlashCommand(interaction, context) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "서버 안에서만 사용할 수 있습니다.", ephemeral: true });
  }

  const access = await getGuildPlanAccess(context, interaction.guildId);
  if (!access.allowed) {
    return interaction.reply({ content: "활성 라이선스가 있는 서버에서만 사용할 수 있습니다.", ephemeral: true });
  }

  const feature = commandFeature(interaction.commandName);
  const control = await context.services.adminControl?.get().catch(() => null);
  if (!feature && control?.otherCommandsEnabled === false) {
    return interaction.reply({ content: "현재 관련 탭 외 명령어가 관리자 점검 모드로 중지되어 있습니다.", ephemeral: true });
  }
  if (feature) {
    const featureAccess = await canUseFeature(context, interaction.guildId, feature);
    if (!featureAccess.featureAllowed) {
      const message = featureAccess.reason === "feature-ban" ? "이 기능은 현재 관리자 점검 모드로 일시 중지되어 있습니다." : featureDeniedMessage(feature);
      return interaction.reply({ content: message, ephemeral: true });
    }
  }

  const command = context.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: "알 수 없는 명령어입니다.", ephemeral: true });
  }

  await command.execute(interaction, context);
}
