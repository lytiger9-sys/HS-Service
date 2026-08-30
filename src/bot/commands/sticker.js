import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const stickerAdd = {
  data: new SlashCommandBuilder()
    .setName("스티커추가")
    .setDescription("이미지 링크를 현재 서버의 스티커로 저장합니다.")
    .addStringOption((option) => option
      .setName("스티커")
      .setDescription("저장할 PNG 또는 Lottie JSON 이미지 링크")
      .setRequired(true)),
  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return interaction.reply({ content: "스티커 관리 권한이 필요합니다.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const created = await context.services.stickers.createFromUrl(interaction.guild, interaction.options.getString("스티커", true), interaction.user.id);
      return interaction.editReply(`스티커 **${created.name}**을(를) 등록했습니다.`);
    } catch (error) {
      return interaction.editReply(error.message || "스티커를 등록하지 못했습니다.");
    }
  }
};

export default stickerAdd;
