import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

export default {
  data: new SlashCommandBuilder().setName("복제").setDescription("카테고리와 하위 채널을 복제합니다.").addStringOption((option) => option.setName("카테고리id").setDescription("복제할 카테고리 ID").setRequired(true)).addBooleanOption((option) => option.setName("확인").setDescription("카테고리와 하위 채널을 복제한다는 것을 확인합니다.").setRequired(true)),
  async execute(interaction, context) {
    if (!isAdministrator(interaction.member) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) return interaction.reply({ content: "채널 관리 권한이 필요합니다.", ephemeral: true });
    const confirmed = interaction.options.getBoolean("확인", false);
    if (!confirmed) return interaction.reply({ content: "복제를 진행하려면 `확인: true` 옵션을 선택하세요. 명령어가 오래된 상태라면 봇을 재시작해 명령어를 갱신한 뒤 다시 시도하세요.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await context.services.cloner.cloneCategory(interaction.guild, interaction.options.getString("카테고리id", true));
      return interaction.editReply(`카테고리 **${result.category.name}**와 하위 채널 ${result.count}개를 복제했습니다.`);
    } catch (error) {
      return interaction.editReply(error.message || "카테고리를 복제하지 못했습니다.");
    }
  }
};
