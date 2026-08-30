import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const BATCH_SIZE = 3;

export const roleAllNow = {
  data: new SlashCommandBuilder()
    .setName("역할전체지금")
    .setDescription("선택한 역할을 서버의 모든 일반 유저에게 지급합니다.")
    .addRoleOption((option) => option
      .setName("역할")
      .setDescription("모든 유저에게 지급할 역할")
      .setRequired(true)),
  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: "역할 관리 권한이 필요합니다.", ephemeral: true });
    }

    const role = interaction.options.getRole("역할", true);
    if (role.id === interaction.guild.id || role.managed) {
      return interaction.reply({ content: "봇 연동 역할 또는 @everyone 역할은 전체 지급할 수 없습니다.", ephemeral: true });
    }
    if (!role.editable) {
      return interaction.reply({ content: "봇의 최고 역할을 지급할 역할보다 위로 올린 뒤 다시 시도해 주세요.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const members = await interaction.guild.members.fetch();
      const humanMembers = [...members.values()].filter((member) => !member.user.bot);
      const targets = humanMembers.filter((member) => !member.roles.cache.has(role.id));
      const alreadyAssigned = humanMembers.length - targets.length;
      let given = 0;
      let failed = 0;

      for (let index = 0; index < targets.length; index += BATCH_SIZE) {
        const batch = targets.slice(index, index + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map((member) => member.roles.add(role, `역할 전체 지급: ${interaction.user.id}`)));
        for (const result of results) {
          if (result.status === "fulfilled") given += 1;
          else failed += 1;
        }
      }

      const suffix = failed ? ` 지급 실패 ${failed}명` : "";
      return interaction.editReply(`역할 **${role.name}**을(를) ${given}명에게 지급했습니다. 이미 보유한 유저 ${alreadyAssigned}명.${suffix}`);
    } catch (error) {
      return interaction.editReply(`역할 전체 지급에 실패했습니다: ${error.message || "서버 멤버를 가져오지 못했습니다."}`);
    }
  }
};

export default roleAllNow;
