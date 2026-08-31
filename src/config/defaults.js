import { createDefaultTicketSettings } from "../shared/ticket.js";

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
      embedTitle: "",
      embedDescription: "# {totalmember}번째 멤버가 입장했어요\n--\n유저\n{user} {username}\n\n서버에 입장한 시간\n{joinedat} ({joinedrelative})\n\n계정 생성일\n{accountcreatedat} ({accountcreatedrelative})\n\n초대자\n{inviter} {invitername}",
      embedColor: "#101010",
      dmTitle: "환영합니다",
      dmMessage: "{user}님, {guild} 서버에 오신 것을 환영합니다.\n현재 인원: {totalmember}명",
      dmColor: "#1f1f1f"
    },
    ticket: createDefaultTicketSettings(),
    polls: {
      enabled: true,
      resultVisibility: "public",
      expirationDays: 7,
      voteLogChannelId: ""
    },
    embed: {
      enabled: true,
      mode: "components",
      channelId: "",
      destinationType: "channel",
      webhookUrl: "",
      title: "서버 공지",
      description: "공지사항이 아직 설정되지 않았습니다.",
      color: "#1a1d23",
      footer: "",
      authorName: "",
      authorUrl: "",
      thumbnailUrl: "",
      imageUrl: "",
      fields: [],
      componentsBody: "",
      mentionEveryone: false,
      mentionHere: false,
      mentionRoleIds: [],
      scheduleEnabled: false,
      scheduleIntervalMinutes: 60,
      lastSentAt: null,
      updatedAt: null
    },
    notice: {
      enabled: true,
      content: "공지사항이 아직 설정되지 않았습니다.",
      updatedAt: null
    },
    honeypot: {
      enabled: true,
      channelId: "",
      logChannelId: "",
      action: "kick",
      caughtCount: 0,
      statusMessageId: ""
    },
    security: {
      enabled: true,
      massMentionEnabled: true,
      spamEnabled: true,
      profanityEnabled: true,
      inviteEnabled: true,
      massMentionTimeoutMinutes: 10,
      spamTimeoutMinutes: 10,
      profanityTimeoutMinutes: 10,
      inviteTimeoutMinutes: 10,
      spamRepeatThreshold: 3,
      profanityWords: [],
      securityLogChannelId: "",
      exemptChannelIds: []
    },
    assignment: {
      enabled: true,
      channelId: "",
      roleId: ""
    },
    nickname: {
      enabled: true,
      rules: {}
    },
    voice: {
      enabled: true,
      categoryId: "",
      defaultName: "임시 채널",
      maxUsers: 0
    },
    staff: {
      enabled: true,
      channelId: "",
      messageId: "",
      embedTitle: "관리자 출퇴근 상태",
      embedDescription: "버튼을 눌러 출퇴근 상태를 변경합니다.",
      buttonLabel: "출퇴근",
      statuses: {}
    },
    boost: {
      enabled: false,
      channelId: ""
    },
    logs: {
      enabled: true,
      serverChannelId: "",
      serverNameChangeEnabled: true,
      messageChangeEnabled: true,
      categoryChangeEnabled: true,
      channelChangeEnabled: true,
      guildBrandingChangeEnabled: true,
      serverIdentityChangeEnabled: true,
      roleChangeEnabled: true,
      moderationActionEnabled: true
    },
    purchaseFeedback: {
      enabled: true,
      logChannelId: "",
      reviewChannelId: "",
      logTemplate: "# 구매 로그\n--\n유저\n{user}\n제품명\n{product}",
      reviewTemplate: "# 구매 후기\n--\n유저\n{user}\n제품명\n{product}\n후기\n{review}"
    },
    events: {
      enabled: true,
      channelId: "",
      name: "서버 이벤트",
      description: "이벤트에 참여하려면 아래 버튼을 눌러주세요.",
      prizeName: "이벤트 상품",
      prizeContent: "",

      winnerCount: 1,
      durationHours: 24
    },
    partner: {
      enabled: false,
      conditionsChannelId: "",
      conditionsMessageId: "",
      approvalChannelId: "",
      partnerCategoryId: "",
      namePrefix: "파트너-",
      nameSuffix: "",
      embedTitle: "파트너 모집",
      embedDescription: "파트너 조건을 입력한 후 아래 버튼으로 신청해 주세요.",
      embedColor: "#3a7da8",
      buttonLabel: "파트너 신청",
      banner: {
        enabled: false,
        channelId: "",
        messageId: "",
        categoryId: "",
        namePrefix: "배너-",
        nameSuffix: "",
        embedTitle: "상단 배너",
        embedDescription: "상단 배너 안내",
        embedColor: "#b89968",
        buttonLabel: "상단배너 신청"
      }
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
    ticketSequence: 0,
    polls: {},
    events: {},
    tempChannels: {},
    partners: [],
    bannerSlots: [],
    purchaseFeedback: {
      pending: {},
      history: []
    },
    account: { bank: "", number: "", holder: "" },
    expressions: { emojis: [], sounds: [] },
    shop: {
      enabled: true,
      messageChannelId: "",
      messageId: "",
      birthdayChannelId: "",
      birthdayReward: 100,
      birthdays: {},
      birthdayClaims: {},
      dailyReward: 100,
      messageReward: 10,
      messageThreshold: 20,
      gamblingEnabled: true,
      gamblingWinRate: 45,
      gamblingMaxBet: 100000,
      embedBody: "상품을 확인하거나 내 캐시 잔액을 확인하세요.",
      products: [],
      wallets: {},
      purchases: []
    }
  };
}
