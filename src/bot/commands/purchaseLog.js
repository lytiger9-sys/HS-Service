import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

export default {
  data: new SlashCommandBuilder()
    .setName("구매로그")
    .setDescription("구매로그를 전송하고 대상 유저에게 후기 작성을 안내합니다.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) => option
      .setName("유저")
      .setDescription("구매로그와 후기 요청을 보낼 유저")
      .setRequired(true))
    .addStringOption((option) => option
      .setName("제품명")
      .setDescription("구매한 제품 이름")
      .setMaxLength(256)
      .setRequired(true)),

  async execute(interaction, context) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "서버 관리자만 구매로그를 전송할 수 있습니다.", ephemeral: true });
    }

    const user = interaction.options.getUser("유저", true);
    const productName = interaction.options.getString("제품명", true).trim();
    if (user.bot) {
      return interaction.reply({ content: "봇 계정에는 구매로그와 후기 요청을 보낼 수 없습니다.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.purchaseFeedback.sendPurchaseLog(interaction.guild, user, productName);
    const dmStatus = result.dmSent
      ? "구매로그를 전송했고 대상 유저에게 DM으로 후기 작성을 안내했습니다."
      : `구매로그는 전송했지만 ${result.dmError || "DM을 보내지 못했습니다."}`;
    return interaction.editReply(dmStatus);
  }
};
