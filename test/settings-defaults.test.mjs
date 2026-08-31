import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultGuildSettings, createDefaultGuildState } from "../src/config/defaults.js";
import { parseTicketSettingsBody } from "../src/shared/ticket.js";
import { sectionPayload } from "../website/routes/api.js";

const defaults = createDefaultGuildSettings();
const stateDefaults = createDefaultGuildState();

test("빈 환영·관리자·임베드 문구는 각 기본 문구로 복원된다", () => {
  const welcome = sectionPayload("welcome", {
    welcomeEmbedTitle: " ",
    welcomeEmbedDescription: "\n",
    welcomeEmbedColor: "",
    welcomeDmTitle: " ",
    welcomeDmMessage: "\t",
    welcomeDmColor: ""
  }).welcome;
  const staff = sectionPayload("staff", {
    staffEmbedTitle: " ",
    staffEmbedDescription: " ",
    staffButtonLabel: " "
  }).staff;
  const embed = sectionPayload("embed", {
    embedTitle: " ",
    embedDescription: " ",
    embedColor: ""
  }).embed;

  assert.equal(welcome.embedTitle, defaults.welcome.embedTitle);
  assert.equal(welcome.embedDescription, defaults.welcome.embedDescription);
  assert.equal(welcome.embedColor, defaults.welcome.embedColor);
  assert.equal(welcome.dmTitle, defaults.welcome.dmTitle);
  assert.equal(welcome.dmMessage, defaults.welcome.dmMessage);
  assert.equal(welcome.dmColor, defaults.welcome.dmColor);
  assert.equal(staff.embedTitle, defaults.staff.embedTitle);
  assert.equal(staff.embedDescription, defaults.staff.embedDescription);
  assert.equal(staff.buttonLabel, defaults.staff.buttonLabel);
  assert.equal(embed.title, defaults.embed.title);
  assert.equal(embed.description, defaults.embed.description);
  assert.equal(embed.color, defaults.embed.color);
});

test("빈 숫자·시간 입력은 설정별 기본값으로 복원된다", () => {
  const security = sectionPayload("security", {
    massMentionTimeoutMinutes: " ",
    spamTimeoutMinutes: "",
    profanityTimeoutMinutes: "\n",
    inviteTimeoutMinutes: "\t",
    spamRepeatThreshold: ""
  }).security;
  const voice = sectionPayload("voice", { voiceDefaultName: " ", voiceMaxUsers: "" }).voice;
  const polls = sectionPayload("polls", { pollExpirationDays: "" }).polls;
  const shop = sectionPayload("shop", {
    shopBirthdayReward: "",
    shopDailyReward: " ",
    shopMessageReward: "\t",
    shopMessageThreshold: "",
    shopGamblingWinRate: "",
    shopGamblingMaxBet: "",
    shopEmbedBody: ""
  }).shop;
  const events = sectionPayload("events", {
    eventsName: "",
    eventsPrizeName: " ",
    eventsWinnerCount: "",
    eventsDurationHours: ""
  }).events;

  assert.equal(security.massMentionTimeoutMinutes, defaults.security.massMentionTimeoutMinutes);
  assert.equal(security.spamTimeoutMinutes, defaults.security.spamTimeoutMinutes);
  assert.equal(security.profanityTimeoutMinutes, defaults.security.profanityTimeoutMinutes);
  assert.equal(security.inviteTimeoutMinutes, defaults.security.inviteTimeoutMinutes);
  assert.equal(security.spamRepeatThreshold, defaults.security.spamRepeatThreshold);
  assert.equal(voice.defaultName, defaults.voice.defaultName);
  assert.equal(voice.maxUsers, defaults.voice.maxUsers);
  assert.equal(polls.expirationDays, defaults.polls.expirationDays);
  assert.equal(shop.birthdayReward, stateDefaults.shop.birthdayReward);
  assert.equal(shop.dailyReward, stateDefaults.shop.dailyReward);
  assert.equal(shop.messageReward, stateDefaults.shop.messageReward);
  assert.equal(shop.messageThreshold, stateDefaults.shop.messageThreshold);
  assert.equal(shop.gamblingWinRate, stateDefaults.shop.gamblingWinRate);
  assert.equal(shop.gamblingMaxBet, stateDefaults.shop.gamblingMaxBet);
  assert.equal(shop.embedBody, stateDefaults.shop.embedBody);
  assert.equal(events.name, defaults.events.name);
  assert.equal(events.prizeName, defaults.events.prizeName);
  assert.equal(events.winnerCount, defaults.events.winnerCount);
  assert.equal(events.durationHours, defaults.events.durationHours);
});

test("빈 구매로그·파트너·티켓 문구는 각 기본값으로 복원된다", () => {
  const purchaseFeedback = sectionPayload("purchaseFeedback", {
    purchaseFeedbackLogTemplate: " ",
    purchaseFeedbackReviewTemplate: "\n"
  }).purchaseFeedback;
  const partner = sectionPayload("partner", {
    partnerNamePrefix: "",
    partnerEmbedTitle: " ",
    partnerEmbedDescription: "\t",
    partnerEmbedColor: "",
    partnerButtonLabel: "",
    bannerNamePrefix: " ",
    bannerEmbedTitle: "",
    bannerEmbedDescription: " ",
    bannerEmbedColor: "",
    bannerButtonLabel: "\n"
  }).partner;
  const ticket = parseTicketSettingsBody({
    ticketBoardTitle: " ",
    ticketBoardDescription: "\n",
    ticketBoardButtonLabel: "\t",
    ticketBoardAccentColor: "",
    ticketBoardFooterText: " "
  });

  assert.equal(purchaseFeedback.logTemplate, defaults.purchaseFeedback.logTemplate);
  assert.equal(purchaseFeedback.reviewTemplate, defaults.purchaseFeedback.reviewTemplate);
  assert.equal(partner.namePrefix, defaults.partner.namePrefix);
  assert.equal(partner.embedTitle, defaults.partner.embedTitle);
  assert.equal(partner.embedDescription, defaults.partner.embedDescription);
  assert.equal(partner.embedColor, defaults.partner.embedColor);
  assert.equal(partner.buttonLabel, defaults.partner.buttonLabel);
  assert.equal(partner.banner.namePrefix, defaults.partner.banner.namePrefix);
  assert.equal(partner.banner.embedTitle, defaults.partner.banner.embedTitle);
  assert.equal(partner.banner.embedDescription, defaults.partner.banner.embedDescription);
  assert.equal(partner.banner.embedColor, defaults.partner.banner.embedColor);
  assert.equal(partner.banner.buttonLabel, defaults.partner.banner.buttonLabel);
  assert.equal(ticket.board.title, defaults.ticket.board.title);
  assert.equal(ticket.board.description, defaults.ticket.board.description);
  assert.equal(ticket.board.buttonLabel, defaults.ticket.board.buttonLabel);
  assert.equal(ticket.board.accentColor, defaults.ticket.board.accentColor);
  assert.equal(ticket.board.footerText, defaults.ticket.board.footerText);
});
