import { SlashCommandBuilder } from "discord.js";
import { isAdministrator } from "../../shared/guards.js";

async function deleteMessages(channel, maxCount) {
  let deleted = 0;
  let before = null;
  const cutoff = 14 * 24 * 60 * 60 * 1000;

  while (deleted < maxCount) {
    const batchSize = Math.min(100, maxCount - deleted);
    const messages = await channel.messages.fetch({
      limit: batchSize,
      before: before ?? undefined
    }).catch(() => null);

    if (!messages || !messages.size) {
      break;
    }

    const deletable = messages.filter((message) => Date.now() - message.createdTimestamp < cutoff);
    if (!deletable.size) {
      break;
    }

    const removed = await channel.bulkDelete(deletable, true).catch(() => null);
    deleted += removed?.size ?? 0;
    before = messages.last().id;

    if (messages.size < batchSize) {
      break;
    }
  }

  return deleted;
}

export default {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("메시지를 대량 삭제합니다.")
    .addBooleanOption((option) => option.setName("확인").setDescription("메시지를 삭제한다는 것을 확인합니다.").setRequired(true))
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("삭제할 개수. 비우면 가능한 만큼 삭제")
        .setMinValue(1)
        .setMaxValue(1000)
    ),

  async execute(interaction) {
    if (!isAdministrator(interaction.member)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }

    if (!interaction.options.getBoolean("확인", true)) return interaction.reply({ content: "삭제를 진행하려면 확인을 true로 설정해야 합니다.", ephemeral: true });

    const channel = interaction.channel;
    if (!channel?.isTextBased?.()) {
      return interaction.reply({ content: "텍스트 채널에서만 사용할 수 있습니다.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const count = interaction.options.getInteger("count") ?? 1000;
    const deleted = await deleteMessages(channel, count);

    return interaction.editReply({
      content: `${deleted}개의 메시지를 삭제했습니다.`,
    });
  }
};
