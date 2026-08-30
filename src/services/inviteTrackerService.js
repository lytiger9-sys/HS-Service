function toSnapshot(invite) {
  return {
    code: invite.code,
    uses: Number(invite.uses || 0),
    inviterId: invite.inviter?.id || "",
    inviterName: invite.inviter?.globalName || invite.inviter?.username || ""
  };
}

export function createInviteTrackerService() {
  const snapshots = new Map();

  async function prime(guild) {
    const invites = await guild.invites.fetch();
    snapshots.set(guild.id, new Map([...invites.values()].map((invite) => [invite.code, toSnapshot(invite)])));
  }

  function remember(invite) {
    const guildId = invite.guild?.id || invite.guildId;
    if (!guildId || !invite.code) return;
    const snapshot = snapshots.get(guildId) || new Map();
    snapshot.set(invite.code, toSnapshot(invite));
    snapshots.set(guildId, snapshot);
  }

  function forget(invite) {
    const guildId = invite.guild?.id || invite.guildId;
    if (!guildId || !invite.code) return;
    snapshots.get(guildId)?.delete(invite.code);
  }

  async function resolveInviter(guild) {
    const previous = snapshots.get(guild.id);
    const invites = await guild.invites.fetch();
    const current = new Map([...invites.values()].map((invite) => [invite.code, toSnapshot(invite)]));
    snapshots.set(guild.id, current);
    if (!previous) return null;

    const used = [...current.values()].find((invite) => invite.uses > Number(previous.get(invite.code)?.uses || 0));
    if (!used?.inviterId) return null;
    return {
      id: used.inviterId,
      username: used.inviterName || "알 수 없음",
      mention: `<@${used.inviterId}>`
    };
  }

  return { prime, remember, forget, resolveInviter };
}
