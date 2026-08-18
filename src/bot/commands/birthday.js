import { SlashCommandBuilder } from "discord.js";

function birthdayData(name, description) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addIntegerOption((option) => option.setName("월").setDescription("생일 월").setMinValue(1).setMaxValue(12).setRequired(true))
    .addIntegerOption((option) => option.setName("일").setDescription("생일 일").setMinValue(1).setMaxValue(31).setRequired(true));
}

async function executeBirthday(interaction, context) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const result = await context.services.shop.setBirthday(
      interaction.guildId,
      interaction.user.id,
      interaction.options.getInteger("월", true),
      interaction.options.getInteger("일", true)
    );
    return interaction.editReply(`생일을 **${result.month}월 ${result.day}일**로 등록했습니다. 생일 당일 설정된 채널에 축하 메시지가 게시되고 캐시가 지급됩니다.`);
  } catch (error) {
    return interaction.editReply(error.message || "생일을 등록하지 못했습니다.");
  }
}

const birthday = {
  data: birthdayData("생일", "상점 생일 보상을 받을 생일을 등록합니다."),
  execute: executeBirthday
};

export const birthdaySetting = {
  data: birthdayData("생일설정", "상점 생일 보상을 받을 생일을 등록합니다."),
  execute: executeBirthday
};

export default birthday;
