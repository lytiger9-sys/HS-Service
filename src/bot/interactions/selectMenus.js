export async function handleSelectMenuInteraction(interaction, context) {
  const [scope, action] = interaction.customId.split(":");

  if (scope !== "ticket" || action !== "select-category") {
    return false;
  }

  if (!interaction.guild) {
    return interaction.reply({ content: "서버에서만 사용할 수 있습니다.", ephemeral: true });
  }

  const categoryId = interaction.values?.[0];
  if (!categoryId) {
    return interaction.reply({ content: "카테고리를 선택해 주세요.", ephemeral: true });
  }

  const category = await context.services.tickets.getCategory(interaction.guildId, categoryId);
  if (!category) {
    return interaction.reply({ content: "선택한 티켓 카테고리를 찾을 수 없습니다.", ephemeral: true });
  }

  if (!category.questions.length) {
    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.tickets.openTicket({
      guild: interaction.guild,
      member: interaction.member,
      categoryId: category.id,
      answers: [],
      requestedBy: interaction.member
    });

    return interaction.editReply({
      content: result.existing ? "이미 열려 있는 티켓이 있습니다." : `\`${category.label}\` 티켓을 열었습니다.`
    });
  }

  const modal = await context.services.tickets.buildModalForCategory(interaction.guildId, category.id);
  return interaction.showModal(modal);
}
