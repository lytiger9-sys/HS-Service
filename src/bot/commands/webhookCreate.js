import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const MAX_AVATAR_BYTES = 512 * 1024;

async function downloadAvatar(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname) throw new Error("invalid-url");
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("download-failed");
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error("invalid-image");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_AVATAR_BYTES) throw new Error("image-too-large");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) throw new Error("image-too-large");
    return buffer;
  } catch {
    throw new Error("프로필 사진에는 512KB 이하의 https 이미지 링크를 입력해 주세요.");
  }
}

function validateName(value) {
  const name = String(value || "HS System").trim().slice(0, 80);
  if (!name) throw new Error("웹훅 이름을 입력해 주세요.");
  if (/clyde|discord/i.test(name)) throw new Error("웹훅 이름에는 clyde 또는 discord를 사용할 수 없습니다.");
  return name;
}

export const webhookCreate = {
  data: new SlashCommandBuilder()
    .setName("웹훅생성")
    .setDescription("현재 채널에 새 웹훅을 생성합니다.")
    .addStringOption((option) => option
      .setName("이름")
      .setDescription("웹훅 이름")
      .setMaxLength(80)
      .setRequired(false))
    .addStringOption((option) => option
      .setName("프로필")
      .setDescription("웹훅 프로필 사진 링크")
      .setRequired(false)),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageWebhooks)) {
      return interaction.reply({ content: "웹훅 관리 권한이 필요합니다.", ephemeral: true });
    }
    if (!interaction.channel?.isTextBased?.() || interaction.channel.isThread?.()) {
      return interaction.reply({ content: "일반 텍스트 채널 또는 공지 채널에서만 웹훅을 만들 수 있습니다.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const avatar = await downloadAvatar(interaction.options.getString("프로필"));
      const webhook = await interaction.channel.createWebhook({
        name: validateName(interaction.options.getString("이름")),
        avatar,
        reason: `웹훅 생성: ${interaction.user.id}`
      });
      return interaction.editReply(`웹훅 **${webhook.name}**을(를) 생성했습니다.\n\`${webhook.url}\`\n이 주소는 권한 정보이므로 외부에 공유하지 마세요.`);
    } catch (error) {
      return interaction.editReply(`웹훅 생성에 실패했습니다: ${error.message || "권한 또는 채널 상태를 확인해 주세요."}`);
    }
  }
};

export default webhookCreate;
