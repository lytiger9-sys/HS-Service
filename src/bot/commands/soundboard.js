import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const soundboardSteal = {
  data: new SlashCommandBuilder()
    .setName("사운드스틸")
    .setDescription("다른 서버의 사운드보드를 현재 서버에 복사 등록합니다.")
    .addStringOption((option) => option.setName("원본서버id").setDescription("봇이 들어가 있는 원본 서버 ID").setRequired(true))
    .addStringOption((option) => option.setName("사운드id").setDescription("원본 사운드 ID").setRequired(true))
    .addStringOption((option) => option.setName("이름").setDescription("현재 서버에서 사용할 이름").setRequired(false)),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) return interaction.reply({ content: "사운드보드 관리 권한이 필요합니다.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const sound = await context.services.soundboards.steal({ targetGuild: interaction.guild, sourceGuildId: interaction.options.getString("원본서버id", true), soundId: interaction.options.getString("사운드id", true), name: interaction.options.getString("이름"), userId: interaction.user.id });
      return interaction.editReply(`사운드 **${sound.name}**를 현재 서버에 등록했습니다.`);
    } catch (error) {
      return interaction.editReply(error.message || "사운드를 등록하지 못했습니다.");
    }
  }
};

export function buildSoundboardListPayload(sounds, page, userId) {
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(sounds.length / pageSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const items = sounds.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const content = items.length ? items.map((sound) => `**${sound.name}** — ${sound.id}`).join("\n") : "등록된 사운드보드가 없습니다.";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`page:soundboard:${userId}:${currentPage - 1}:${pageCount}`).setLabel("‹").setStyle(ButtonStyle.Secondary).setDisabled(currentPage <= 1),
    new ButtonBuilder().setCustomId(`page:soundboard:${userId}:${currentPage + 1}:${pageCount}`).setLabel("›").setStyle(ButtonStyle.Secondary).setDisabled(currentPage >= pageCount)
  );
  return { content: `${content.slice(0, 1800)}\n\n페이지 ${currentPage}/${pageCount}`, components: [row], ephemeral: true };
}

export const soundboardList = {
  data: new SlashCommandBuilder().setName("사운드목록").setDescription("현재 서버의 사운드보드 목록을 보여줍니다.").addIntegerOption((option) => option.setName("페이지").setDescription("확인할 페이지").setMinValue(1).setRequired(false)),
  async execute(interaction, context) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const sounds = await context.services.soundboards.list(interaction.guild);
      return interaction.editReply(buildSoundboardListPayload(sounds, interaction.options.getInteger("페이지") || 1, interaction.user.id));
    } catch {
      return interaction.editReply("사운드보드 목록을 가져오지 못했습니다.");
    }
  }
};

export const soundboardDelete = {
  data: new SlashCommandBuilder().setName("사운드삭제").setDescription("현재 서버의 사운드보드를 삭제합니다.").addStringOption((option) => option.setName("사운드id").setDescription("삭제할 사운드 ID").setRequired(true)).addBooleanOption((option) => option.setName("확인").setDescription("사운드 삭제를 확인합니다.").setRequired(true)),
  async execute(interaction, context) {
    if (!interaction.options.getBoolean("확인", true)) return interaction.reply({ content: "삭제를 진행하려면 확인을 true로 설정해야 합니다.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const sound = await context.services.soundboards.remove(interaction.guild, interaction.options.getString("사운드id", true), interaction.member);
      return interaction.editReply(`사운드 **${sound.name}**를 삭제했습니다.`);
    } catch (error) {
      return interaction.editReply(error.message || "사운드를 삭제하지 못했습니다.");
    }
  }
};
