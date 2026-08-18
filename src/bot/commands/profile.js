import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

export default {
  data: new SlashCommandBuilder().setName("프로필").setDescription("서버 구성원의 프로필과 아바타·배너를 조회합니다.").addUserOption((option) => option.setName("유저").setDescription("조회할 유저").setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser("유저", true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const fullUser = await user.fetch(true).catch(() => user);
    const embed = new EmbedBuilder().setTitle(`${member?.displayName || user.username} 프로필`).setColor(0x1a1d23).setThumbnail(fullUser.displayAvatarURL({ size: 512 })).addFields({ name: "사용자명", value: user.tag, inline: true }, { name: "봇 계정", value: user.bot ? "예" : "아니오", inline: true }, { name: "서버 가입일", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "알 수 없음", inline: false });
    if (fullUser.banner) embed.setImage(fullUser.bannerURL({ size: 1024 }));
    return interaction.reply({ embeds: [embed], ephemeral: false });
  }
};
