import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { buildBaseEmbed, palette } from "../../shared/embeds.js";

export const JOIN_ORDER_PAGE_SIZE = 10;

export function buildJoinOrderPayload(rows, page = 0, ownerId = "") {
  const totalPages = Math.max(1, Math.ceil(rows.length / JOIN_ORDER_PAGE_SIZE));
  const currentPage = Math.min(Math.max(Number(page) || 0, 0), totalPages - 1);
  const pageRows = rows.slice(currentPage * JOIN_ORDER_PAGE_SIZE, (currentPage + 1) * JOIN_ORDER_PAGE_SIZE);
  const lines = pageRows.map((entry) => {
    const joinedAt = entry.joinedTimestamp ? `<t:${Math.floor(entry.joinedTimestamp / 1000)}:R>` : "알 수 없음";
    return `${entry.rank}. ${entry.user.tag} - ${joinedAt}`;
  });
  const components = [];
  if (totalPages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`page:joinorder:${ownerId}:${currentPage - 1}`).setLabel("이전").setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 0),
      new ButtonBuilder().setCustomId(`page:joinorder-jump:${ownerId}:${totalPages}`).setLabel(`${currentPage + 1}/${totalPages}`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`page:joinorder:${ownerId}:${currentPage + 1}`).setLabel("다음").setStyle(ButtonStyle.Primary).setDisabled(currentPage >= totalPages - 1)
    ));
  }
  return {
    embeds: [buildBaseEmbed({
      title: "서버 입장 순서",
      description: lines.join("\n"),
      color: palette.ink,
      footer: `페이지 ${currentPage + 1}/${totalPages} · 표시 ${rows.length}명`,
      timestamp: Date.now()
    })],
    components
  };
}

export default {
  data: new SlashCommandBuilder()
    .setName("입장순서")
    .setDescription("서버 입장 순서를 내림차순으로 보여줍니다."),

  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    const rows = await context.services.serverInfo.getJoinOrder(interaction.guild, 100);

    if (!rows.length) {
      return interaction.editReply({ content: "입장 순서를 가져올 수 없습니다." });
    }

    return interaction.editReply(buildJoinOrderPayload(rows, 0, interaction.user.id));
  }
};
