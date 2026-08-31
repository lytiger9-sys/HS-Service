import { kstDateKey, kstDateParts } from "../shared/time.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder
} from "discord.js";

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SHOP = {
  enabled: true,
  messageChannelId: "",
  messageId: "",
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
};

function todayKey() { return kstDateKey(); }
function normalizeShop(shop = {}) {
  return {
    ...DEFAULT_SHOP,
    ...shop,
    products: Array.isArray(shop.products) ? shop.products.map(normalizeProduct) : [],
    wallets: shop.wallets && typeof shop.wallets === "object" ? shop.wallets : {},
    purchases: Array.isArray(shop.purchases) ? shop.purchases : []
  };
}
function walletOf(shop, userId) {
  shop.wallets[userId] ??= { balance: 0, messageCount: 0, messageDate: todayKey(), attendanceDate: "", attendanceStreak: 0 };
  const wallet = shop.wallets[userId];
  if (wallet.messageDate !== todayKey()) { wallet.messageDate = todayKey(); wallet.messageCount = 0; }
  return wallet;
}
function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function stockLines(product = {}) {
  if (Array.isArray(product.stock)) return product.stock.map((line) => String(line).trim()).filter(Boolean);
  return String(product.delivery || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function normalizeProduct(product = {}) {
  const stock = stockLines(product);
  return {
    id: product.id || id(),
    name: String(product.name || "상품").slice(0, 100),
    description: String(product.description || "").slice(0, 1000),
    price: Math.max(0, Math.floor(Number(product.price) || 0)),
    stock,
    delivery: stock.join("\n"),
    enabled: product.enabled !== false
  };
}

export function createShopService(context) {
  async function state(guildId) {
    await context.services.guildState.ensure(guildId);
    return context.services.guildState.snapshot(guildId);
  }
  async function patch(guildId, updater) {
    return context.services.guildState.patch(guildId, (guild) => updater(guild));
  }
  async function getShop(guildId) {
    const guild = await state(guildId);
    return normalizeShop({ ...(guild.shop || {}), ...(guild.settings?.shop || {}), products: guild.shop?.products || [], wallets: guild.shop?.wallets || {}, purchases: guild.shop?.purchases || [] });
  }
  async function requireEnabled(guildId) {
    const settings = await context.services.settings.getSettings(guildId);
    const guild = await state(guildId);
    const shopSettings = settings.shop || guild.shop || {};
    if (shopSettings.enabled === false) throw new Error("현재 상점 기능이 꺼져 있습니다.");
    return shopSettings;
  }
  async function updateSettings(guildId, patchData) {
    return context.services.settings.updateSettings(guildId, { shop: patchData });
  }
  async function awardAttendance(guildId, userId) {
    await requireEnabled(guildId);
    let result;
    await patch(guildId, (guild) => {
      guild.shop = normalizeShop(guild.shop);
      const wallet = walletOf(guild.shop, userId);
      if (wallet.attendanceDate === todayKey()) { result = { awarded: false, balance: wallet.balance }; return; }
      wallet.attendanceDate = todayKey(); wallet.attendanceStreak = (wallet.attendanceStreak || 0) + 1;
      wallet.balance += Number(guild.settings.shop?.dailyReward ?? guild.shop.dailyReward ?? 100);
      result = { awarded: true, amount: Number(guild.settings.shop?.dailyReward ?? guild.shop.dailyReward ?? 100), balance: wallet.balance };
    });
    return result;
  }
  async function notifyAward(message, result) {
    const amount = Number(result?.attendanceAmount || 0) + Number(result?.amount || 0) + Number(result?.birthdayAmount || 0);
    if (!amount) return;
    const reasons = [];
    if (result?.attendanceAmount) reasons.push("오늘 첫 메시지 보상");
    if (result?.amount) reasons.push("활동 메시지 보상");
    if (result?.birthdayAmount) reasons.push("생일 축하 보상");
    await message.author.send(`캐시 지급 안내 (${message.guild?.name || "알 수 없는 서버"})\n+${amount.toLocaleString()} 캐시 (${reasons.join(" + ")})\n현재 잔액: ${Number(result.balance || 0).toLocaleString()} 캐시`).catch(() => null);
  }

  function isValidBirthday(month, day) {
    const value = new Date(Date.UTC(2000, month - 1, day));
    return value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
  }

  async function setBirthday(guildId, userId, month, day) {
    await requireEnabled(guildId);
    const normalizedMonth = Math.floor(Number(month));
    const normalizedDay = Math.floor(Number(day));
    if (!isValidBirthday(normalizedMonth, normalizedDay)) throw new Error("올바른 생일 날짜를 입력해 주세요.");
    await patch(guildId, (guild) => {
      guild.shop = normalizeShop(guild.shop);
      guild.shop.birthdays[String(userId)] = { month: normalizedMonth, day: normalizedDay };
    });
    return { month: normalizedMonth, day: normalizedDay };
  }

  function birthdayPayload(guild, user, amount, month, day) {
    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 생일 축하합니다, ${user.displayName || user.username}님`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${month}월 ${day}일 생일을 맞은 것을 축하합니다.\n\n상점에서 사용할 수 있는 **${amount.toLocaleString()} 캐시**를 선물로 지급했습니다.`))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guild.name} 상점 생일 보상`));
    return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
  }

  async function processBirthday(message) {
    if (!message.guild || message.author.bot) return null;
    const settings = await context.services.settings.getSettings(message.guild.id);
    if (settings.shop?.enabled === false) return null;
    const { month, day } = kstDateParts();
    let birthdayResult = null;
    await patch(message.guild.id, (guild) => {
      guild.shop = normalizeShop(guild.shop);
      const birthday = guild.shop.birthdays[String(message.author.id)];
      const channelId = settings.shop?.birthdayChannelId || guild.shop.birthdayChannelId;
      const amount = Number(settings.shop?.birthdayReward ?? guild.shop.birthdayReward ?? 0);
      const claimKey = `${message.author.id}:${todayKey()}`;
      if (!birthday || birthday.month !== month || birthday.day !== day || guild.shop.birthdayClaims[claimKey] || !channelId || amount <= 0) return;
      const wallet = walletOf(guild.shop, message.author.id);
      wallet.balance += amount;
      guild.shop.birthdayClaims[claimKey] = todayKey();
      const claimKeys = Object.keys(guild.shop.birthdayClaims);
      if (claimKeys.length > 2000) delete guild.shop.birthdayClaims[claimKeys[0]];
      birthdayResult = { amount, balance: wallet.balance, channelId, month, day };
    });
    if (!birthdayResult) return null;
    const channel = message.guild.channels.cache.get(birthdayResult.channelId) || await message.guild.channels.fetch(birthdayResult.channelId).catch(() => null);
    if (channel?.isTextBased?.()) await channel.send(birthdayPayload(message.guild, message.author, birthdayResult.amount, month, day)).catch(() => null);
    return { birthdayAmount: birthdayResult.amount, balance: birthdayResult.balance };
  }

  async function recordMessage(message) {
    if (!message.guild || message.author.bot) return null;
    const settings = await context.services.settings.getSettings(message.guild.id);
    if (settings.shop?.enabled === false) return null;
    let result = null;
    await patch(message.guild.id, (guild) => {
      guild.shop = normalizeShop(guild.shop);
      const wallet = walletOf(guild.shop, message.author.id);
      const today = todayKey();
      if (wallet.attendanceDate !== today) {
        const attendanceAmount = Number(settings.shop?.dailyReward ?? guild.shop.dailyReward ?? 100);
        wallet.attendanceDate = today;
        wallet.attendanceStreak = (wallet.attendanceStreak || 0) + 1;
        wallet.balance += attendanceAmount;
        result = { attendanceAmount, balance: wallet.balance };
      }
      wallet.messageCount += 1;
      const threshold = Math.max(1, Number(settings.shop?.messageThreshold ?? guild.shop.messageThreshold));
      if (wallet.messageCount % threshold === 0) {
        const amount = Number(settings.shop?.messageReward ?? guild.shop.messageReward);
        wallet.balance += amount;
        result = { ...(result || {}), amount, balance: wallet.balance };
      }
    });
    const birthdayResult = await processBirthday(message);
    result = result || birthdayResult;
    if (birthdayResult && result !== birthdayResult) result = { ...result, ...birthdayResult, balance: birthdayResult.balance };
    await notifyAward(message, result);
    return result;
  }
  async function getBalance(guildId, userId) { await requireEnabled(guildId); const shop = await getShop(guildId); return walletOf(shop, userId).balance; }
  async function grant(guildId, userId, amount, reason = "관리자 지급") {
    await requireEnabled(guildId);
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value) throw new Error("지급할 캐시를 입력해야 합니다.");
    let balance;
    await patch(guildId, (guild) => { guild.shop = normalizeShop(guild.shop); const wallet = walletOf(guild.shop, userId); wallet.balance += value; balance = wallet.balance; });
    return { amount: value, balance, reason };
  }
  async function gamble(guildId, userId, amount) {
    await requireEnabled(guildId);
    const shop = await getShop(guildId);
    if (shop.gamblingEnabled === false) throw new Error("도박 기능이 비활성화되어 있습니다.");
    const bet = Math.floor(Number(amount) || 0);
    if (bet < 1 || bet > Number(shop.gamblingMaxBet)) throw new Error(`도박 금액은 1 이상 ${shop.gamblingMaxBet} 이하이어야 합니다.`);
    let result;
    await patch(guildId, (guild) => {
      guild.shop = normalizeShop(guild.shop); const wallet = walletOf(guild.shop, userId);
      const configured = { ...guild.shop, ...(guild.settings?.shop || {}) };
      if (wallet.balance < bet) throw new Error("보유 캐시가 부족합니다.");
      const won = Math.random() * 100 < Number(configured.gamblingWinRate);
      wallet.balance += won ? bet : -bet;
            result = { won, bet, balance: wallet.balance, winRate: configured.gamblingWinRate };
    });
    return result;
  }
  async function saveProducts(guildId, products) {
    const normalized = products.slice(0, 100).map((product) => normalizeProduct(product));
    await patch(guildId, (guild) => { guild.shop = normalizeShop(guild.shop); guild.shop.products = normalized; });
    return normalized;
  }
  function shopPayload(guild, shop) {
    const container = new ContainerBuilder();
    const body = String(shop.embedBody || DEFAULT_SHOP.embedBody).replace(/\r/g, "");
    const lines = body.split("\n");
    const textLines = [];
    const flushText = () => {
      if (!textLines.length) return;
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(textLines.join("\n")));
      textLines.length = 0;
    };
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${guild.name} 상점`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    for (const line of lines) {
      const trimmed = line.trim();
      const imageMatch = trimmed.match(/^\[image\]\s*(?:\((https?:\/\/[^)]+)\)|(https?:\/\/\S+))$/i);
      if (imageMatch) {
        flushText();
        const imageUrl = imageMatch[1] || imageMatch[2];
        container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(imageUrl)));
      } else {
        textLines.push(line);
      }
    }
    flushText();
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("shop:products").setLabel("상품 보기").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("shop:info").setLabel("내정보").setStyle(ButtonStyle.Secondary)
    );
    container.addActionRowComponents(row);
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("-# HS-Service"));
    return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
  }
  async function publish(guild, channelId) {
    await requireEnabled(guild.id);
    const shop = await getShop(guild.id); const channel = guild.channels.cache.get(channelId || shop.messageChannelId);
    if (!channel?.isTextBased?.()) throw new Error("상점 게시 채널을 찾을 수 없습니다.");
    const message = shop.messageId ? await channel.messages.fetch(shop.messageId).catch(() => null) : null;
    const payload = shopPayload(guild, shop);
    const sent = message ? await message.edit(payload) : await channel.send(payload);
    await patch(guild.id, (state) => { state.shop = normalizeShop(state.shop); state.shop.messageChannelId = channel.id; state.shop.messageId = sent.id; });
    return sent;
  }
  async function productMenu(guildId) {
    await requireEnabled(guildId);
    const shop = await getShop(guildId); const products = shop.products.filter((p) => p.enabled).slice(0, 25);
    if (!products.length) return { content: "현재 판매 중인 상품이 없습니다.", ephemeral: true };
    return { content: "구매할 상품을 선택하세요.", components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("shop:purchase").setPlaceholder("상품 선택").addOptions(products.map((p) => ({ label: p.name.slice(0, 100), description: `${p.price.toLocaleString()} 캐시 · 남은 재고 ${stockLines(p).length}개`.slice(0, 100), value: p.id }))))], ephemeral: true };
  }
  async function purchase(guild, user, productId) {
    await requireEnabled(guild.id);
    let product; let balance; let delivery;
    await patch(guild.id, async (state) => {
      state.shop = normalizeShop(state.shop); product = state.shop.products.find((p) => p.id === productId && p.enabled);
      if (!product) throw new Error("상품을 찾을 수 없습니다.");
      product.stock = stockLines(product);
      if (!product.stock.length) throw new Error("해당 상품의 재고가 없습니다.");
      const wallet = walletOf(state.shop, user.id); if (wallet.balance < product.price) throw new Error("캐시가 부족합니다.");
      delivery = product.stock.shift();
      product.delivery = product.stock.join("\n");
      wallet.balance -= product.price; balance = wallet.balance;
      state.shop.purchases.unshift({ id: id(), userId: user.id, productId, productName: product.name, price: product.price, delivery, createdAt: new Date().toISOString() });
      state.shop.purchases = state.shop.purchases.slice(0, 500);
    });
    try { await user.send(`구매가 완료되었습니다. (${guild.name})\n상품: ${product.name}\n\n${delivery || "상품 지급 내용이 없습니다."}`); }
    catch {
      await patch(guild.id, (state) => {
        state.shop = normalizeShop(state.shop);
        const current = state.shop.products.find((entry) => entry.id === productId);
        if (current) {
          current.stock = [delivery, ...stockLines(current)];
          current.delivery = current.stock.join("\n");
        }
      });
      await grant(guild.id, user.id, product.price, "DM 전송 실패 환불");
      throw new Error("DM을 보낼 수 없어 구매 금액과 재고를 환불했습니다.");
    }
    return { product, balance };
  }
  return { getShop, updateSettings, awardAttendance, recordMessage, setBirthday, processBirthday, getBalance, grant, gamble, saveProducts, publish, productMenu, purchase };
}
