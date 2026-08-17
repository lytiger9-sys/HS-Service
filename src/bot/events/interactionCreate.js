import { isAllowedGuild } from "../../shared/guards.js";
import { handleSlashCommand } from "../interactions/slash.js";
import { handleButtonInteraction } from "../interactions/buttons.js";
import { handleSelectMenuInteraction } from "../interactions/selectMenus.js";
import { handleModalInteraction } from "../interactions/modals.js";

export default async function handleInteractionCreate(interaction, context) {
  try {
    const isPartnerInteraction = typeof interaction.customId === "string" && interaction.customId.startsWith("partner:");
    if (interaction.guildId && !isAllowedGuild(context, interaction.guildId) && !isPartnerInteraction) {
      return interaction.reply({ content: "허용된 서버에서만 작동합니다.", ephemeral: true }).catch(() => null);
    }

    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, context);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction, context);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction, context);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalInteraction(interaction, context);
    }
  } catch (error) {
    const message = error?.message || "알 수 없는 오류가 발생했습니다.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
    }
  }
}
