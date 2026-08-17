import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

function buildTextReport(notes) {
  return notes
    .map((note, index) => {
      return [
        `${index + 1}. ${note.title}`,
        `작성자: ${note.authorTag || note.authorId || "알 수 없음"}`,
        `작성일: ${note.createdAt}`,
        `내용: ${note.content}`,
        ""
      ].join("\n");
    })
    .join("\n");
}

export default {
  data: new SlashCommandBuilder()
    .setName("savednotes")
    .setDescription("지금까지 저장한 내용을 보여줍니다."),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    if (!isAdministrator(interaction.member)) {
      return interaction.editReply({ content: "관리자만 사용할 수 있습니다." });
    }

    const isTicketChannel = await context.services.tickets.isBotTicketChannel(interaction.guildId, interaction.channelId).catch(() => false);
    if (!isTicketChannel) {
      return interaction.editReply({ content: "봇이 만든 티켓 채널에서만 사용할 수 있습니다." });
    }

    const notes = await context.services.notes.listNotes(interaction.guildId, interaction.channelId);
    if (!notes.length) {
      return interaction.editReply({ content: "저장된 내용이 없습니다." });
    }

    const report = buildTextReport(notes);
    if (report.length > 1800) {
      const attachment = new AttachmentBuilder(Buffer.from(report, "utf8"), {
        name: `saved-notes-${interaction.guildId}.txt`
      });

      return interaction.editReply({
        content: `저장된 내용 ${notes.length}건을 파일로 보냅니다.`,
        files: [attachment],
      });
    }

    return interaction.editReply({
      content: `\`\`\`\n${report}\n\`\`\``,
    });
  }
};
