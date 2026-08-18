import { ActionRowBuilder, PermissionFlagsBits, SlashCommandBuilder, StringSelectMenuBuilder } from "discord.js";

async function sourceGuildOptions(client, userId) {
  const options = [];
  for (const guild of client.guilds.cache.values()) {
    if (options.length >= 25) break;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;
    const emojis = await guild.emojis.fetch().catch(() => null);
    if (!emojis?.size) continue;
    options.push({ label: guild.name.slice(0, 100), description: `${emojis.size}개 이모지 · 원본 서버 선택`, value: guild.id });
  }
  return options;
}

export const emojiSteal = {
  data: new SlashCommandBuilder().setName("이모지스틸").setDescription("원본 서버와 이모지를 선택해 현재 서버에 복사 등록합니다."),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) return interaction.reply({ content: "이모지 관리 권한이 필요합니다.", ephemeral: true });
    const options = await sourceGuildOptions(context.client, interaction.user.id);
    if (!options.length) return interaction.reply({ content: "선택할 수 있는 원본 서버나 이모지가 없습니다.", ephemeral: true });
    return interaction.reply({ content: "먼저 이모지를 가져올 원본 서버를 선택하세요.", components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("emoji:source").setPlaceholder("원본 서버 선택").addOptions(options))], ephemeral: true });
  }
};

export const emojiList = {
  data: new SlashCommandBuilder().setName("이모지목록").setDescription("현재 서버의 커스텀 이모지 목록을 보여줍니다."),
  async execute(interaction, context) {
    try {
      const emojis = await context.services.emojis.list(interaction.guild);
      const content = emojis.length ? emojis.map((emoji) => `${emoji} ${emoji.name}`).join("\n") : "등록된 커스텀 이모지가 없습니다.";
      return interaction.reply({ content: content.slice(0, 1900), ephemeral: true });
    } catch {
      return interaction.reply({ content: "이모지 목록을 가져오지 못했습니다.", ephemeral: true });
    }
  }
};

export const emojiDelete = {
  data: new SlashCommandBuilder().setName("이모지삭제").setDescription("현재 서버의 커스텀 이모지를 삭제합니다.").addStringOption((option) => option.setName("이모지id").setDescription("삭제할 이모지 ID").setRequired(true)),
  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const emoji = await context.services.emojis.remove(interaction.guild, interaction.options.getString("이모지id", true), interaction.member);
      return interaction.editReply(`이모지 **${emoji.name}**를 삭제했습니다.`);
    } catch (error) {
      return interaction.editReply(error.message || "이모지를 삭제하지 못했습니다.");
    }
  }
};

export default emojiList;
