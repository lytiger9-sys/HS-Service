import { canUseFeature, featureDeniedMessage, getGuildPlanAccess } from "../../shared/planAccess.js";

function commandFeature(commandName) {
  if (["저장", "저장내용"].includes(commandName)) return "ticket";
  if (commandName === "tempvoice") return "voice";
  if (commandName === "staff") return "administrators";
  if (["honeypotban", "honeypotkick"].includes(commandName)) return "honeypot";
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
  if (feature) {
    const featureAccess = await canUseFeature(context, interaction.guildId, feature);
    if (!featureAccess.featureAllowed) {
      return interaction.reply({ content: featureDeniedMessage(feature), ephemeral: true });
    }
  }

  const command = context.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: "알 수 없는 명령어입니다.", ephemeral: true });
  }

  await command.execute(interaction, context);
}
