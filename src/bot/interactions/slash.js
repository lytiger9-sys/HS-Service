import { isAllowedGuild } from "../../shared/guards.js";

export async function handleSlashCommand(interaction, context) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "서버 안에서만 사용할 수 있습니다.", ephemeral: true });
  }

  if (!isAllowedGuild(context, interaction.guildId)) {
    return interaction.reply({ content: "허용된 서버에서만 작동합니다.", ephemeral: true });
  }

  const command = context.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: "알 수 없는 명령어입니다.", ephemeral: true });
  }

  await command.execute(interaction, context);
}
