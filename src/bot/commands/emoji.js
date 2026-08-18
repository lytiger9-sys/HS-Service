import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { buildBaseEmbed, palette } from "../../shared/embeds.js";

export const emojiSteal = {
  data: new SlashCommandBuilder()
    .setName("이모지스틸")
    .setDescription("입력한 커스텀 이모지를 현재 서버에 복사 등록합니다.")
    .addStringOption((option) => option.setName("이모지").setDescription("복사할 커스텀 이모지를 그대로 입력").setRequired(true))
    .addStringOption((option) => option.setName("이름").setDescription("새 이모지 이름").setRequired(false)),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) return interaction.reply({ content: "이모지 관리 권한이 필요합니다.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const created = await context.services.emojis.importEmoji(interaction.guild, interaction.options.getString("이모지", true), interaction.options.getString("이름"), interaction.user.id);
      return interaction.editReply(`이모지 ${created}를 등록했습니다. 이름: **${created.name}**`);
    } catch (error) {
      return interaction.editReply(error.message || "이모지를 등록하지 못했습니다.");
    }
  }
};

export const EMOJI_LIST_PAGE_SIZE = 10;

export function buildEmojiListPayload(emojis, page = 0, userId) {
  const totalPages = Math.max(1, Math.ceil(emojis.length / EMOJI_LIST_PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number(page) || 0, 0), totalPages - 1);
  const pageItems = emojis.slice(currentPage * EMOJI_LIST_PAGE_SIZE, (currentPage + 1) * EMOJI_LIST_PAGE_SIZE);
  const lines = pageItems.map((emoji) => `${emoji} ${emoji.name}`);
  const components = [];
  if (totalPages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`page:emoji:${userId}:${currentPage - 1}`).setLabel("이전").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
      new ButtonBuilder().setCustomId(`page:emoji-jump:${userId}:${totalPages}`).setLabel(`${currentPage + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`page:emoji:${userId}:${currentPage + 1}`).setLabel("다음").setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
    ));
  }
  return {
    embeds: [buildBaseEmbed({
      title: "서버 이모지 목록",
      description: lines.length ? lines.join("\n") : "등록된 커스텀 이모지가 없습니다.",
      color: palette.ink,
      footer: `페이지 ${currentPage + 1}/${totalPages} · 표시 ${emojis.length}개`,
      timestamp: Date.now()
    })],
    components,
    ephemeral: true
  };
}

export const emojiList = {
  data: new SlashCommandBuilder().setName("이모지목록").setDescription("현재 서버의 커스텀 이모지 목록을 보여줍니다.").addIntegerOption((option) => option.setName("페이지").setDescription("확인할 페이지").setMinValue(1).setRequired(false)),
  async execute(interaction, context) {
    try {
      const emojis = await context.services.emojis.list(interaction.guild);
      const page = Math.max(0, (interaction.options.getInteger("페이지") || 1) - 1);
      return interaction.reply(buildEmojiListPayload(emojis, page >= 0 ? page : 0, interaction.user.id));
    } catch {
      return interaction.reply({ content: "이모지 목록을 가져오지 못했습니다.", ephemeral: true });
    }
  }
};

export const emojiDelete = {
  data: new SlashCommandBuilder().setName("이모지삭제").setDescription("현재 서버의 커스텀 이모지를 삭제합니다.").addStringOption((option) => option.setName("이모지").setDescription("삭제할 커스텀 이모지를 그대로 입력").setRequired(true)).addBooleanOption((option) => option.setName("확인").setDescription("이모지 삭제를 확인합니다.").setRequired(true)),
  async execute(interaction, context) {
    if (!interaction.options.getBoolean("확인", true)) return interaction.reply({ content: "삭제를 진행하려면 확인을 true로 설정해야 합니다.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const emoji = await context.services.emojis.removeByValue(interaction.guild, interaction.options.getString("이모지", true), interaction.member);
      return interaction.editReply(`이모지 **${emoji.name}**를 삭제했습니다.`);
    } catch (error) {
      return interaction.editReply(error.message || "이모지를 삭제하지 못했습니다.");
    }
  }
};

export default emojiList;
