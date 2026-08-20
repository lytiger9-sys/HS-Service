import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { randomUUID } from "node:crypto";

function channelFor(guild, channelId) {
  const cached = guild.channels.cache.get(channelId);
  return cached?.isTextBased?.() ? cached : null;
}

function durationHours(value) {
  return Math.max(1, Math.min(720, Number(value) || 24));
}

function eventEmbed(event, ended = false) {
  const participants = Object.keys(event.participants || {}).length;
  const lines = [
    `참가자: ${participants}명`,
    `추첨 인원: ${event.winnerCount}명`,
    ended ? "상태: 이벤트 종료" : `마감: <t:${Math.floor(new Date(event.expiresAt).getTime() / 1000)}:R>`
  ];
  return new EmbedBuilder()
    .setColor(ended ? 0x8f7a55 : 0x2d6a8f)
    .setTitle(event.name)
    .setDescription([event.description || "", `상품: ${event.prize}`, ...lines, "", "────────────"].filter(Boolean).join("\n"))
    .setFooter({ text: "Powered by HS-Service" });
}

function eventComponents(event, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event:join:${event.id}`)
      .setLabel(`참가하기 (${Object.keys(event.participants || {}).length})`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  )];
}

export function createEventService(context, guildState) {
  async function get(guildId, id) {
    await guildState.ensure(guildId);
    return guildState.snapshot(guildId).events?.[id] || null;
  }

  async function list(guildId) {
    await guildState.ensure(guildId);
    return Object.values(guildState.snapshot(guildId).events || {}).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function create(guildId, payload) {
    const settings = await context.services.settings.getSettings(guildId);
    if (settings.events?.enabled === false) throw new Error("현재 이벤트 기능이 꺼져 있습니다.");
    if (!settings.events?.channelId) throw new Error("이벤트 게시 채널을 먼저 설정하세요.");
    const name = String(payload.name || settings.events.name || "서버 이벤트").trim();
    const prize = String(payload.prize || settings.events.prize || "").trim();
    if (!name || !prize) throw new Error("이벤트 이름과 상품을 입력하세요.");
    const hours = durationHours(payload.durationHours ?? settings.events.durationHours);
    const event = {
      id: randomUUID(), guildId, channelId: settings.events.channelId, messageId: "",
      name: name.slice(0, 256), description: String(payload.description || settings.events.description || "").trim().slice(0, 4000), prize: prize.slice(0, 1000), winnerCount: Math.max(1, Math.min(100, Number(payload.winnerCount ?? settings.events.winnerCount) || 1)),
      durationHours: hours, expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
      participants: {}, winners: [], ended: false, dmResults: {}, createdAt: new Date().toISOString(), createdBy: payload.createdBy || ""
    };
    await guildState.patch(guildId, (state) => { state.events ??= {}; state.events[event.id] = event; return event; });
    return event;
  }

  async function publish(guildId) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new Error("서버를 찾을 수 없습니다.");
    const event = await create(guildId, {});
    const channel = channelFor(guild, event.channelId) || await guild.channels.fetch(event.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) throw new Error("이벤트 게시 채널을 찾을 수 없습니다.");
    const message = await channel.send({ embeds: [eventEmbed(event)], components: eventComponents(event) });
    await guildState.patch(guildId, (state) => { state.events[event.id].messageId = message.id; return state.events[event.id]; });
    return event;
  }

  async function participate(interaction, eventId) {
    const event = await get(interaction.guildId, eventId);
    if (!event || event.ended || new Date(event.expiresAt) <= new Date()) throw new Error("이미 종료된 이벤트입니다.");
    if (event.participants?.[interaction.user.id]) return { already: true };
    await guildState.patch(interaction.guildId, (state) => {
      state.events[eventId].participants ??= {};
      state.events[eventId].participants[interaction.user.id] = { tag: interaction.user.tag, joinedAt: new Date().toISOString() };
      return state.events[eventId];
    });
    const updated = await get(interaction.guildId, eventId);
    if (interaction.message?.editable) await interaction.message.edit({ embeds: [eventEmbed(updated)], components: eventComponents(updated) }).catch(() => null);
    return { already: false };
  }

  async function finish(guildId, eventId) {
    const event = await get(guildId, eventId);
    if (!event || event.ended || new Date(event.expiresAt) > new Date()) return false;
    const ids = Object.keys(event.participants || {});
    const shuffled = ids.sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, Math.min(event.winnerCount, shuffled.length));
    await guildState.patch(guildId, (state) => { state.events[eventId].ended = true; state.events[eventId].winners = winners; return state.events[eventId]; });
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    const channel = guild && (channelFor(guild, event.channelId) || await guild.channels.fetch(event.channelId).catch(() => null));
    const winnerText = winners.length ? winners.map((id) => `<@${id}>`).join(", ") : "참가자가 없어 당첨자가 없습니다.";
    const resultEmbed = eventEmbed({ ...event, winners }, true).setDescription(`## 이벤트 결과\n상품: ${event.prize}\n당첨자: ${winnerText}`);
    if (channel?.isTextBased?.()) await channel.send({ embeds: [resultEmbed] }).catch(() => null);
    for (const userId of winners) {
      const user = await context.client.users.fetch(userId).catch(() => null);
      if (!user) continue;
      const ok = await user.send(`축하합니다. ${event.name}에 당첨되었습니다.\n상품: ${event.prize}`).then(() => true).catch(() => false);
      await guildState.patch(guildId, (state) => { state.events[eventId].dmResults ??= {}; state.events[eventId].dmResults[userId] = ok ? "sent" : "failed"; return state.events[eventId]; });
    }
    return true;
  }

  async function processExpirations() {
    for (const guild of context.client?.guilds.cache.values() || []) {
      for (const event of await list(guild.id)) await finish(guild.id, event.id).catch(() => null);
    }
  }

  return { get, list, create, publish, participate, finish, processExpirations, eventEmbed, eventComponents };
}
