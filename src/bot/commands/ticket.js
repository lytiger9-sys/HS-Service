import { SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("티켓을 생성하거나 닫습니다.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("open")
        .setDescription("티켓을 엽니다.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("티켓 대상 유저")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("close")
        .setDescription("현재 티켓을 닫습니다.")
    ),

  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }

    const action = interaction.options.getSubcommand();
    if (action === "open") {
      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser("user") ?? interaction.user;
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return interaction.editReply({ content: "대상 유저를 찾을 수 없습니다." });
      }

      try {
        const result = await context.services.tickets.openTicket({
          guild: interaction.guild,
          member,
          openedBy: interaction.member,
          reason: `opened by ${interaction.user.tag}`
        });

        return interaction.editReply({
          content: result.existing
            ? `이미 열려 있는 티켓이 있습니다: ${result.channel}`
            : `티켓을 생성했습니다: ${result.channel}`,
        });
      } catch (error) {
        return interaction.editReply({
          content: error.message || "티켓을 생성하지 못했습니다.",
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await context.services.tickets.closeTicket({
        guild: interaction.guild,
        channel: interaction.channel,
        closedBy: interaction.member,
        reason: `closed by ${interaction.user.tag}`
      });

      return interaction.editReply({
        content: "티켓을 닫았습니다.",
      });
    } catch (error) {
      return interaction.editReply({
        content: error.message || "티켓을 닫지 못했습니다.",
      });
    }
  }
};
