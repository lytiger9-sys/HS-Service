import { randomUUID } from "node:crypto";

export function createNotesService(context, guildState) {
  async function addNote(guildId, note) {
    const payload = {
      id: randomUUID(),
      title: String(note.title ?? "무제"),
      content: String(note.content ?? ""),
      authorId: note.authorId ?? "",
      authorTag: note.authorTag ?? "",
      createdAt: new Date().toISOString()
    };

    await guildState.patch(guildId, (guild) => {
      guild.notes.unshift(payload);
      return payload;
    });

    return payload;
  }

  async function listNotes(guildId) {
    await guildState.ensure(guildId);
    return guildState.snapshot(guildId).notes.slice();
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
    clearNotes
  };
}
