import { SlashCommandBuilder } from "discord.js";
export default {
  data: new SlashCommandBuilder().setName("nickrandom").setDescription("봇과 관리자 외 멤버의 닉네임을 랜덤으로 변경합니다."),
  async execute(interaction, context) {
    const changed = await context.services.nicknames.randomizeNicknames(interaction.guild);
    await interaction.reply({ content: `랜덤 닉네임 변경을 완료했습니다. ${changed}명의 닉네임을 변경했습니다.`, ephemeral: true });
  }
};
