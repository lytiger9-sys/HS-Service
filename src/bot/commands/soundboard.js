import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

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
