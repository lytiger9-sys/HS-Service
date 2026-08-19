import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

export function buildAccountSettingsModal() {
  const modal = new ModalBuilder()
    .setCustomId("account:settings")
    .setTitle("계좌 정보 설정");

  const bank = new TextInputBuilder()
    .setCustomId("account-bank")
    .setLabel("은행")
    .setPlaceholder("예: 국민은행")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(50)
    .setRequired(true);
  const number = new TextInputBuilder()
    .setCustomId("account-number")
    .setLabel("계좌번호")
    .setPlaceholder("예: 123-456-789012")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);
  const holder = new TextInputBuilder()
    .setCustomId("account-holder")
    .setLabel("예금주")
    .setPlaceholder("예: 홍길동")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(50)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(bank),
    new ActionRowBuilder().addComponents(number),
    new ActionRowBuilder().addComponents(holder)
  );
  return modal;
}

export const accountSettings = {
  data: new SlashCommandBuilder()
    .setName("계좌설정")
    .setDescription("서버에서 공개할 계좌 정보를 설정합니다."),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "관리자만 사용할 수 있습니다.", ephemeral: true });
    }
    return interaction.showModal(buildAccountSettingsModal());
  }
};

export const account = {
  data: new SlashCommandBuilder()
    .setName("계좌")
    .setDescription("서버에 설정된 계좌 정보를 공개합니다."),
  async execute(interaction, context) {
    const state = context.services.guildState.snapshot(interaction.guildId);
    const accountInfo = state?.account;
    if (!accountInfo?.bank || !accountInfo?.number || !accountInfo?.holder) {
      return interaction.reply({ content: "아직 계좌 정보가 설정되지 않았습니다." });
    }
    return interaction.reply({
      content: `은행: ${accountInfo.bank}\n계좌번호: ${accountInfo.number}\n예금주: ${accountInfo.holder}`
    });
  }
};
