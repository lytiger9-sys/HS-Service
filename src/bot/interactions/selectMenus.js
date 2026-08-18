import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";

export async function handleSelectMenuInteraction(interaction, context) {
  const [scope, action] = interaction.customId.split(":");

  if (scope === "emoji" && action === "source") {
    const sourceGuildId = interaction.values?.[0];
    const sourceGuild = sourceGuildId ? (context.client.guilds.cache.get(sourceGuildId) || await context.client.guilds.fetch(sourceGuildId).catch(() => null)) : null;
    if (!sourceGuild) return interaction.update({ content: "원본 서버를 찾을 수 없습니다.", components: [] });
    if (!(await sourceGuild.members.fetch(interaction.user.id).catch(() => null))) return interaction.update({ content: "해당 원본 서버의 구성원만 이모지를 선택할 수 있습니다.", components: [] });
    const emojis = await context.services.emojis.list(sourceGuild).catch(() => []);
    if (!emojis.length) return interaction.update({ content: "원본 서버에 커스텀 이모지가 없습니다.", components: [] });
    const options = emojis.slice(0, 25).map((emoji) => ({ label: emoji.name.slice(0, 100), description: `ID: ${emoji.id}`, value: emoji.id }));
    return interaction.update({ content: "복사할 이모지를 선택하세요.", components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`emoji:pick:${sourceGuild.id}`).setPlaceholder("이모지 선택").addOptions(options))] });
  }

  if (scope === "emoji" && action === "pick") {
    const sourceGuildId = interaction.customId.split(":")[2];
    const sourceEmojiId = interaction.values?.[0];
    if (!sourceGuildId || !sourceEmojiId) return interaction.update({ content: "이모지 선택이 올바르지 않습니다.", components: [] });
    await interaction.deferUpdate();
    try {
      const created = await context.services.emojis.importFromSource(interaction.guild, sourceGuildId, sourceEmojiId, interaction.user.id);
      return interaction.editReply({ content: `이모지 ${created}를 등록했습니다. 이름: **${created.name}**`, components: [] });
    } catch (error) {
      return interaction.editReply({ content: error.message || "이모지를 등록하지 못했습니다.", components: [] });
    }
  }

  if (scope === "shop" && action === "purchase") {
    const productId = interaction.values?.[0];
    if (!productId) return interaction.reply({ content: "상품을 선택해 주세요.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.shop.purchase(interaction.guild, interaction.user, productId);
    return interaction.editReply({ content: `${result.product.name} 구매가 완료되었습니다. 남은 캐시: ${result.balance.toLocaleString()} 캐시` });
  }

  if (scope !== "ticket" || action !== "select-category") {
    return false;
  }

  if (!interaction.guild) {
    return interaction.reply({ content: "서버에서만 사용할 수 있습니다.", ephemeral: true });
  }

  const categoryId = interaction.values?.[0];
  if (!categoryId) {
    return interaction.reply({ content: "카테고리를 선택해 주세요.", ephemeral: true });
  }

  const category = await context.services.tickets.getCategory(interaction.guildId, categoryId);
  if (!category) {
    return interaction.reply({ content: "선택한 티켓 카테고리를 찾을 수 없습니다.", ephemeral: true });
  }

  if (!category.questions.length) {
    await interaction.deferReply({ ephemeral: true });
    const result = await context.services.tickets.openTicket({
      guild: interaction.guild,
      member: interaction.member,
      categoryId: category.id,
      answers: [],
      requestedBy: interaction.member
    });

    return interaction.editReply({
      content: result.existing ? "이미 열려 있는 티켓이 있습니다." : `\`${category.label}\` 티켓을 열었습니다.`
    });
  }

  const modal = await context.services.tickets.buildModalForCategory(interaction.guildId, category.id);
  return interaction.showModal(modal);
}
