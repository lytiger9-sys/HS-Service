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
      content: `내용을 저장했습니다: ${note.title}`,
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith("poll-free:")) {
    const pollId = interaction.customId.split(":")[1];
    const value = interaction.fields.getTextInputValue("poll-free-text");
    await context.services.polls.handleFreeTextVote(interaction, pollId, value);
    return interaction.reply({ content: "자유 입력 답변이 반영되었습니다.", ephemeral: true });
  }

  return interaction.reply({ content: "처리할 수 없는 모달입니다.", ephemeral: true });
}
