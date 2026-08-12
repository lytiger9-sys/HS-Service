export async function handleModalInteraction(interaction, context) {
  if (interaction.customId === "save-note") {
    const title = interaction.fields.getTextInputValue("save-note-title");
    const content = interaction.fields.getTextInputValue("save-note-content");

    const note = await context.services.notes.addNote(interaction.guildId, {
      title,
      content,
      authorId: interaction.user.id,
      authorTag: interaction.user.tag
    });

    return interaction.reply({
      content: `내용을 저장했습니다. ${note.title}`,
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith("poll-free:")) {
    const pollId = interaction.customId.split(":")[1];
    const value = interaction.fields.getTextInputValue("poll-free-text");
    await context.services.polls.handleFreeTextVote(interaction, pollId, value);
    return interaction.reply({ content: "자유 입력이 반영되었습니다.", ephemeral: true });
  }

  if (interaction.customId.startsWith("ticket:modal:")) {
    const categoryId = interaction.customId.split(":")[2];
    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.tickets.openTicketFromModal(interaction, categoryId);
    if (result.existing) {
      return interaction.editReply({
        content: "이미 열려 있는 티켓이 있습니다.",
      });
    }

    return interaction.editReply({
      content: "티켓이 생성되었습니다.",
    });
  }

  return interaction.reply({ content: "처리할 수 없는 모달입니다.", ephemeral: true });
}
