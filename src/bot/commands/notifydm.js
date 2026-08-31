import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

async function sendNoticeProcess(requester, token, noticeDm, sourceGuild, embedService) {
  const tempBot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages
    ]
  });

  tempBot.once("ready", async () => {
    let sentCount = 0;
    try {
      for (const guild of tempBot.guilds.cache.values()) {
        const members = await guild.members.fetch();
        for (const member of members.values()) {
          if (member.user.bot) continue;
          try {
            await member.send(embedService.buildPayload(sourceGuild, noticeDm));
            sentCount += 1;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch {
            // DM 수신 거부 등 개별 전송 실패는 다음 사용자 전송을 막지 않습니다.
          }
        }
      }
      await requester.send(`✅ 요청하신 공지 DM 전송이 완료되었습니다. (총 ${sentCount}명 전송 완료)`);
    } catch (error) {
      await requester.send(`❌ 전송 작업 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      tempBot.destroy();
    }
  });

  try {
    await tempBot.login(token);
  } catch (error) {
    await requester.send(`❌ 입력하신 토큰으로 봇에 로그인할 수 없습니다: ${error.message}`);
  }
}

const notifydm = {
  data: new SlashCommandBuilder()
    .setName("공지dm")
    .setDescription("토큰을 입력받아 저장된 공지 DM 임베드를 전송합니다.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("token")
        .setDescription("사용할 봇 토큰")
        .setRequired(true)
    ),

  async execute(interaction, context) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }

    const token = interaction.options.getString("token");
    const settings = await context.services.settings.getSettings(interaction.guildId);
    const noticeDm = settings.noticeDm || {};
    if (noticeDm.enabled === false) {
      return interaction.reply({ content: "공지 DM 기능이 현재 비활성화되어 있습니다.", ephemeral: true });
    }

    await interaction.reply({
      content: "입력하신 토큰으로 봇 접속 및 DM 전송을 시작합니다. 완료 시 DM으로 안내해 드립니다.",
      ephemeral: true
    });
    void sendNoticeProcess(interaction.user, token, noticeDm, interaction.guild, context.services.embeds);
  }
};

export default notifydm;
