import { SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

export default {
  data: new SlashCommandBuilder()
    .setName("도박")
    .setDescription("캐시를 걸고 도박합니다.")
    .addIntegerOption((option) => option.setName("금액").setDescription("걸 캐시 금액").setRequired(true).setMinValue(1)),
  async execute(interaction, context) {
    const access = await context.services.shop.getBalance(interaction.guildId, interaction.user.id);
    const amount = interaction.options.getInteger("금액", true);
    const result = await context.services.shop.gamble(interaction.guildId, interaction.user.id, amount);
    await interaction.reply({ content: result.won ? `축하합니다. ${amount.toLocaleString()} 캐시를 얻었습니다. 현재 잔액: ${result.balance.toLocaleString()} 캐시` : `아쉽습니다. ${amount.toLocaleString()} 캐시를 잃었습니다. 현재 잔액: ${result.balance.toLocaleString()} 캐시`, ephemeral: false });
  }
};


export const adminGrantCommand = {
  data: new SlashCommandBuilder().setName("캐시지급").setDescription("관리자가 유저에게 캐시를 지급합니다.").addUserOption((option) => option.setName("유저").setDescription("지급 대상").setRequired(true)).addIntegerOption((option) => option.setName("금액").setDescription("지급 캐시").setRequired(true).setMinValue(1)),
  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    const user = interaction.options.getUser("유저", true);
    const amount = interaction.options.getInteger("금액", true);
    const result = await context.services.shop.grant(interaction.guildId, user.id, amount, `관리자 ${interaction.user.id} 지급`);
    const guildName = interaction.guild?.name || "알 수 없는 서버";
    await user.send(`[${guildName}] 캐시 지급 안내\n+${result.amount.toLocaleString()} 캐시 (관리자 지급)\n현재 잔액: ${result.balance.toLocaleString()} 캐시`).catch(() => null);
    await interaction.reply({ content: `${user.tag}에게 ${result.amount.toLocaleString()} 캐시를 지급했습니다.`, ephemeral: true });
  }
};

export const balanceCommand = {
  data: new SlashCommandBuilder().setName("캐시").setDescription("내 캐시 잔액을 확인합니다."),
  async execute(interaction, context) {
    const balance = await context.services.shop.getBalance(interaction.guildId, interaction.user.id);
    await interaction.reply({ content: `현재 보유 캐시: ${balance.toLocaleString()} 캐시`, ephemeral: true });
  }
};
