export default async function handleChannelDelete(channel, context) {
  if (!channel?.guildId || !channel.id) {
    return;
  }
  await context.services.notes.deleteNotesByTicket(channel.guildId, channel.id).catch((error) => {
    console.error(`[ticket] saved note cleanup failed for ${channel.id}:`, error);
  });
}
