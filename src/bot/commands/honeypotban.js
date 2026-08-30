import { ChannelType, SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

export default {
  data: new SlashCommandBuilder()
    .setName("허니팟차단")
    .setDescription("허니팟 채널을 설정하고 메시지 작성자를 차단합니다.")
    .addChannelOption((option) => option
      .setName("채널")
      .setDescription("허니팟으로 사용할 텍스트 채널")
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true)),
  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    const channel = interaction.options.getChannel("채널", true);
    await interaction.deferReply({ ephemeral: true });
    try {
      await context.services.honeypot.configureChannel(interaction.guildId, channel.id, "ban");
      return interaction.editReply({ content: `허니팟 차단 채널을 <#${channel.id}>(으)로 설정하고 안내 임베드를 전송했습니다.` });
    } catch (error) {
      return interaction.editReply({ content: error.message || "허니팟 채널을 설정하지 못했습니다." });
    }
  }
};
