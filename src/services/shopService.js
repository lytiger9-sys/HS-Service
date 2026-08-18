import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
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
  products: [],
  wallets: {},
  purchases: []
};

function todayKey() { return new Date().toISOString().slice(0, 10); }
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
  async function updateSettings(guildId, patchData) {
    return context.services.settings.updateSettings(guildId, { shop: patchData });
  }
  async function awardAttendance(guildId, userId) {
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
  async function recordMessage(message) {
    if (!message.guild || message.author.bot) return null;
    const settings = await context.services.settings.getSettings(message.guild.id);
    if (settings.shop?.enabled === false) return null;
    let result = null;
    await patch(message.guild.id, (guild) => {
      guild.shop = normalizeShop(guild.shop);
      const wallet = walletOf(guild.shop, message.author.id);
      wallet.messageCount += 1;
      const threshold = Math.max(1, Number(settings.shop?.messageThreshold ?? guild.shop.messageThreshold));
      if (wallet.messageCount % threshold === 0) {
        const amount = Number(settings.shop?.messageReward ?? guild.shop.messageReward);
        wallet.balance += amount;
        result = { amount, balance: wallet.balance };
      }
    });
    return result;
  }
  async function getBalance(guildId, userId) { const shop = await getShop(guildId); return walletOf(shop, userId).balance; }
  async function grant(guildId, userId, amount, reason = "관리자 지급") {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (!value) throw new Error("지급할 캐시를 입력해야 합니다.");
    let balance;
    await patch(guildId, (guild) => { guild.shop = normalizeShop(guild.shop); const wallet = walletOf(guild.shop, userId); wallet.balance += value; balance = wallet.balance; });
    return { amount: value, balance, reason };
  }
  async function gamble(guildId, userId, amount) {
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
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${guild.name} 상점\n상품을 확인하거나 내 캐시 잔액을 확인하세요.`));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("shop:products").setLabel("상품 보기").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("shop:info").setLabel("내정보").setStyle(ButtonStyle.Secondary)
    );
    return { flags: MessageFlags.IsComponentsV2, components: [container, row], allowedMentions: { parse: [] } };
  }
  async function publish(guild, channelId) {
    const shop = await getShop(guild.id); const channel = guild.channels.cache.get(channelId || shop.messageChannelId);
    if (!channel?.isTextBased?.()) throw new Error("상점 게시 채널을 찾을 수 없습니다.");
    const message = shop.messageId ? await channel.messages.fetch(shop.messageId).catch(() => null) : null;
    const payload = shopPayload(guild, shop);
    const sent = message ? await message.edit(payload) : await channel.send(payload);
    await patch(guild.id, (state) => { state.shop = normalizeShop(state.shop); state.shop.messageChannelId = channel.id; state.shop.messageId = sent.id; });
    return sent;
  }
  async function productMenu(guildId) {
    const shop = await getShop(guildId); const products = shop.products.filter((p) => p.enabled).slice(0, 25);
    if (!products.length) return { content: "현재 판매 중인 상품이 없습니다.", ephemeral: true };
    return { content: "구매할 상품을 선택하세요.", components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("shop:purchase").setPlaceholder("상품 선택").addOptions(products.map((p) => ({ label: p.name.slice(0, 100), description: `${p.price.toLocaleString()} 캐시 · 남은 재고 ${stockLines(p).length}개`.slice(0, 100), value: p.id }))))], ephemeral: true };
  }
  async function purchase(guild, user, productId) {
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
    try { await user.send(`구매가 완료되었습니다.\n상품: ${product.name}\n\n${delivery || "상품 지급 내용이 없습니다."}`); }
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
  return { getShop, updateSettings, awardAttendance, recordMessage, getBalance, grant, gamble, saveProducts, publish, productMenu, purchase };
}
