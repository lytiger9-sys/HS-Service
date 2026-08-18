import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

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
