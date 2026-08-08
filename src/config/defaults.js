export function createDefaultState() {
  return {
    guilds: {}
  };
}

export function createDefaultGuildSettings() {
  return {
    welcome: {
      enabled: false,
      channelId: "",
      errorChannelId: "",
      embedTitle: "환영합니다",
      embedDescription: "{user}님, {guild}에 오신 것을 환영합니다.",
      embedColor: "#101010",
      dmTitle: "환영합니다",
      dmMessage: "{user}님, {guild}에 오신 것을 환영합니다.\n현재 인원: {totalmember}명",
      dmColor: "#1f1f1f"
    },
    ticket: {
      enabled: false,
      categoryId: "",
      logChannelId: "",
      channelPrefix: "ticket-"
    },
    notice: {
      content: "공지사항이 아직 설정되지 않았습니다.",
      updatedAt: null
    },
    honeypot: {
      channelId: "",
      logChannelId: "",
      caughtCount: 0,
      statusMessageId: ""
    },
    security: {
      massMentionTimeoutMinutes: 10,
      spamTimeoutMinutes: 10,
      profanityTimeoutMinutes: 10,
      inviteTimeoutMinutes: 10,
      spamWindowSeconds: 12,
      spamRepeatThreshold: 3,
      profanityWords: []
    },
    assignment: {
      channelId: "",
      roleId: ""
    },
    voice: {
      categoryId: "",
      defaultName: "임시 채널",
      maxUsers: 0
    },
    logs: {
      welcomeChannelId: "",
      ticketChannelId: "",
      moderationChannelId: "",
      securityChannelId: "",
      serverChannelId: "",
      voteChannelId: "",
      systemChannelId: ""
    }
  };
}

export function createDefaultGuildState() {
  return {
    settings: createDefaultGuildSettings(),
    notes: [],
    punishments: [],
    joinOrder: [],
    tickets: {},
    polls: {},
    tempChannels: {}
  };
}
