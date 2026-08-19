import { ChannelType, SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

async function deleteMessages(channel, maxCount) {
  let deleted = 0;
  let before = null;
  const cutoff = 14 * 24 * 60 * 60 * 1000;
  while (deleted < maxCount) {
    const batchSize = Math.min(100, maxCount - deleted);
    const messages = await channel.messages.fetch({ limit: batchSize, before: before ?? undefined }).catch(() => null);
    if (!messages || !messages.size) break;
    const deletable = messages.filter((message) => Date.now() - message.createdTimestamp < cutoff);
    if (!deletable.size) break;
    const removed = await channel.bulkDelete(deletable, true).catch(() => null);
    deleted += removed?.size ?? 0;
    before = messages.last().id;
    if (messages.size < batchSize) break;
  }
  return deleted;
}

function snapshotTextChannel(channel) {
  return {
    name: channel.name,
    type: channel.type,
    parent: channel.parentId || undefined,
    position: channel.rawPosition,
    topic: channel.topic || undefined,
    nsfw: Boolean(channel.nsfw),
    rateLimitPerUser: channel.rateLimitPerUser || 0,
    defaultAutoArchiveDuration: channel.defaultAutoArchiveDuration || undefined,
    defaultThreadRateLimitPerUser: channel.defaultThreadRateLimitPerUser || 0,
    permissionOverwrites: [...channel.permissionOverwrites.cache.values()].map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type,
      allow: overwrite.allow.bitfield.toString(),
      deny: overwrite.deny.bitfield.toString()
    }))
  };
}

async function recreateTextChannel(channel) {
  const snapshot = snapshotTextChannel(channel);
  const guild = channel.guild;
  await channel.delete("clear hard: 기존 채널 초기화");
  const replacement = await guild.channels.create({
    name: snapshot.name,
    type: snapshot.type === ChannelType.GuildAnnouncement ? ChannelType.GuildAnnouncement : ChannelType.GuildText,
    parent: snapshot.parent,
    topic: snapshot.topic,
    nsfw: snapshot.nsfw,
    rateLimitPerUser: snapshot.rateLimitPerUser,
    defaultAutoArchiveDuration: snapshot.defaultAutoArchiveDuration,
    defaultThreadRateLimitPerUser: snapshot.defaultThreadRateLimitPerUser,
    permissionOverwrites: snapshot.permissionOverwrites
  });
  await replacement.setPosition(snapshot.position).catch(() => null);
  return replacement;
}

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("메시지를 삭제하거나 채널을 초기화합니다.")
    .addStringOption((option) => option
      .setName("mode")
      .setDescription("실행 방식을 선택합니다.")
      .setRequired(true)
      .addChoices(
        { name: "general · 메시지 개수 삭제", value: "general" },
        { name: "hard · 채널 재생성", value: "hard" }
      ))
    .addBooleanOption((option) => option
      .setName("확인")
      .setDescription("메시지 삭제 또는 채널 재생성을 확인합니다.")
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName("count")
      .setDescription("general 모드에서 삭제할 개수. 비우면 가능한 만큼 삭제")
      .setMinValue(1)
      .setMaxValue(1000)),
  async execute(interaction) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    if (!interaction.options.getBoolean("확인", true)) {
      return interaction.reply({ content: "삭제 또는 채널 재생성을 진행하려면 확인을 true로 설정해야 합니다.", ephemeral: true });
    }
    const channel = interaction.channel;
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.reply({ content: "일반 텍스트 채널 또는 공지 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }
    const mode = interaction.options.getString("mode", true);
    await interaction.deferReply({ ephemeral: true });
    if (mode === "hard") {
      try {
        const replacement = await recreateTextChannel(channel);
        return interaction.editReply({ content: `채널을 초기화했습니다. 새 채널: <#${replacement.id}>` });
      } catch (error) {
        console.error(`[clear] hard reset failed for ${channel.guildId}/${channel.id}:`, error);
        return interaction.editReply({ content: "채널 재생성에 실패했습니다. 봇의 채널 관리 권한과 카테고리 권한을 확인해 주세요." });
      }
    }
    const count = interaction.options.getInteger("count") ?? 1000;
    const deleted = await deleteMessages(channel, count);
    return interaction.editReply({ content: `${deleted}개의 메시지를 삭제했습니다.` });
  }
};
