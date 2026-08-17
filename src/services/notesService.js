import { randomUUID } from "node:crypto";

export function createNotesService(context, guildState) {
  async function addNote(guildId, note) {
    const payload = {
      id: randomUUID(),
      title: String(note.title ?? "무제"),
      content: String(note.content ?? ""),
      authorId: note.authorId ?? "",
      authorTag: note.authorTag ?? "",
      ticketChannelId: note.ticketChannelId ?? "",
      createdAt: new Date().toISOString()
    };

    await guildState.patch(guildId, (guild) => {
      guild.notes.unshift(payload);
      return payload;
    });

    return payload;
  }

  async function listNotes(guildId, ticketChannelId = null) {
    await guildState.ensure(guildId);
    const notes = guildState.snapshot(guildId).notes.slice();
    if (!ticketChannelId) return notes;
    return notes.filter((note) => note.ticketChannelId === ticketChannelId);
  }

  async function deleteNotesByTicket(guildId, ticketChannelId) {
    if (!ticketChannelId) return 0;
    return guildState.patch(guildId, (guild) => {
      const before = guild.notes.length;
      guild.notes = guild.notes.filter((note) => note.ticketChannelId !== ticketChannelId);
      return before - guild.notes.length;
    });
  }

  async function clearNotes(guildId) {
    return guildState.patch(guildId, (guild) => {
      guild.notes = [];
      return guild.notes;
    });
  }

  return {
    addNote,
    listNotes,
    deleteNotesByTicket,
    clearNotes
  };
}
