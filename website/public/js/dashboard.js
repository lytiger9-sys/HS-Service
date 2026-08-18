const sidebarTabs = Array.from(document.querySelectorAll(".sidebar-tab"));
const panelRoots = Array.from(document.querySelectorAll("[data-panel]"));
const searchInput = document.querySelector("[data-tab-search]");
const searchResults = document.querySelector("[data-tab-search-results]");
const toast = document.querySelector("[data-save-toast]");
const forms = Array.from(document.querySelectorAll("form.settings-form, form[data-reset-form]"));
const availableTabs = new Set(sidebarTabs.map((button) => button.dataset.tab).filter(Boolean));
const defaultTab = availableTabs.has("overview") ? "overview" : sidebarTabs[0]?.dataset.tab || "";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const featureLabels = {
  welcome: "환영 기능 사용",
  ticket: "티켓 기능 사용",
  administrators: "관리자 기능 사용",
  staff: "관리자 기능 사용",
  assignment: "할당 기능 사용",
  voice: "음성 기능 사용",
  notice: "공지 기능 사용",
  polls: "투표 기능 사용",
  logs: "로그 기능 사용"
};

function normalizeTab(tabName) {
  return tabName && availableTabs.has(tabName) ? tabName : defaultTab;
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: prefersReducedMotion ? "auto" : "smooth"
  });
}

function activateTab(tabName, { scroll = false } = {}) {
  const nextTab = normalizeTab(tabName);

  sidebarTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === nextTab);
  });

  panelRoots.forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.panel !== nextTab);
  });

  if (scroll) {
    scrollToTop();
  }

  return nextTab;
}

function collectTabMatches(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return sidebarTabs
    .map((button) => {
      const label = button.querySelector(".nav-label")?.textContent || "";
      const description = button.querySelector(".nav-description")?.textContent || "";
      const haystack = `${label} ${description}`.toLowerCase();
      return haystack.includes(normalized) ? button : null;
    })
    .filter(Boolean);
}

function renderSearchResults(query) {
  if (!searchResults || !searchInput) {
    return;
  }

  const matches = collectTabMatches(query);
  const normalized = query.trim();

  sidebarTabs.forEach((button) => {
    const label = button.querySelector(".nav-label")?.textContent || "";
    const description = button.querySelector(".nav-description")?.textContent || "";
    const haystack = `${label} ${description}`.toLowerCase();
    const visible = !normalized || haystack.includes(normalized.toLowerCase());
    button.hidden = !visible;
  });

  searchResults.innerHTML = "";
  if (!normalized || !matches.length) {
    searchResults.hidden = true;
    return;
  }

  searchResults.hidden = false;
  matches.slice(0, 6).forEach((button) => {
    const result = document.createElement("button");
    result.type = "button";
    result.className = "sidebar-search-result";
    result.innerHTML = `<strong>${button.querySelector(".nav-label")?.textContent || ""}</strong><span>${button.querySelector(".nav-description")?.textContent || ""}</span>`;
    result.addEventListener("click", () => {
      const tab = normalizeTab(button.dataset.tab);
      activateTab(tab, { scroll: true });
      searchInput.value = "";
      renderSearchResults("");
      searchInput.focus();
    });
    searchResults.appendChild(result);
  });
}

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.hidden = true;
  }, 2200);
}

function getSectionFromAction(form) {
  const match = String(form.action || "").match(/\/settings\/([^/?#]+)/);
  return match?.[1] || "";
}

function injectFeatureToggles() {
  const settings = window.dashboardSettings || {};
  const allowFeatureToggle = window.dashboardPlan?.allowFeatureToggle === true;

  document.querySelectorAll(".section-toggle").forEach((toggle) => {
    toggle.hidden = !allowFeatureToggle;
    toggle.setAttribute("aria-hidden", String(!allowFeatureToggle));
  });

  if (!allowFeatureToggle) {
    return;
  }

  forms.forEach((form) => {
    if (!form.classList.contains("settings-form")) {
      return;
    }

    const section = getSectionFromAction(form);
    const inputName = `${section}Enabled`;
    if (!featureLabels[section] || form.elements.namedItem(inputName)) {
      return;
    }

    const field = document.createElement("label");
    field.className = "field toggle feature-toggle";
    field.innerHTML = `
      <input type="checkbox" name="${inputName}" ${settings?.[section]?.enabled === false ? "" : "checked"} />
      <span>${featureLabels[section]}</span>
    `;

    const formGrid = form.querySelector(".form-grid");
    if (formGrid) {
      formGrid.prepend(field);
    } else {
      form.prepend(field);
    }
  });
}

function readCookie(name) {
  const entry = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

async function submitForm(form, submitter = null) {
  const action = submitter?.formAction || form.action;
  const method = (submitter?.formMethod || form.method || "post").toUpperCase();
  const csrfToken = readCookie("csrf-token");
  const response = await fetch(action, {
    method,
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "fetch",
      Accept: "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
    },
    body: (() => {
      const data = new FormData(form);
      form.querySelectorAll('input[type="checkbox"][name$="Enabled"]').forEach((input) => {
        data.set(input.name, input.checked ? "on" : "off");
      });
      return data;
    })()
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;
  if (!response.ok || !payload?.ok) {
    const serverMessage = payload?.message || (!contentType.includes("application/json") ? (await response.text().catch(() => "")) : "");
    throw new Error(serverMessage || "저장에 실패했습니다.");
  }

  return payload;
}

function setupForms() {
  forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = event.submitter || form.querySelector("button[type='submit']");
      const initialLabel = submitButton?.textContent || "";

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "저장 중...";
        }

        if (form.dataset.confirmReset === "true" && !window.confirm(form.dataset.confirmMessage || "서버 데이터를 초기화할까요?")) {
          return;
        }

        const payload = await submitForm(form, event.submitter);
        showToast(payload.message || "저장되었습니다.");
        if (payload.section) {
          activateTab(payload.section, { scroll: false });
        }
      } catch (error) {
        showToast(error.message || "저장에 실패했습니다.");
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = initialLabel;
        }
      }
    });
  });
}

function setupEmbedPanel() {
  const form = document.querySelector("[data-embed-form]");
  if (!form) return;
  const channelSelect = form.querySelector("[data-embed-channel]");
  const channelSearch = form.querySelector('[data-channel-search="embed-channel-select"]');
  const destinationSelect = form.querySelector("[data-embed-destination]");
  const channelField = form.querySelector("[data-embed-channel-field]");
  const webhookField = form.querySelector("[data-embed-webhook-field]");
  const webhookInput = form.querySelector('[name="embedWebhookUrl"]');
  const sendButton = form.querySelector("[data-embed-send]");
  const modeSelect = form.querySelector("[data-embed-mode]");
  const titleInput = form.querySelector('[data-embed-preview="title"]');
  const descriptionInput = form.querySelector('[data-embed-preview="description"]');
  const previewTitle = document.querySelector("[data-embed-preview-title]");
  const previewDescription = document.querySelector("[data-embed-preview-description]");
  const previewDescriptionText = document.querySelector("[data-embed-preview-description-text]");
  const previewComponents = document.querySelector("[data-embed-preview-components]");
  const previewFooter = document.querySelector("[data-embed-preview-footer]");
  const previewComponentsCard = document.querySelector("[data-embed-preview-components-card]");
  const previewLegacyCard = document.querySelector("[data-embed-preview-legacy-card]");
  const previewCard = document.querySelector("[data-embed-preview-card]");
  const formatHelp = form.querySelector("[data-embed-format-help]");
  const componentInput = form.querySelector('[name="embedComponentsBody"]');
  const roleSelect = form.querySelector("[data-component-role]");
  const insertComponentSyntax = (syntax) => {
    if (!componentInput) return;
    const current = componentInput.value.trimEnd();
    componentInput.value = `${current ? `${current}\n` : ""}${syntax}`;
    componentInput.focus();
    componentInput.setSelectionRange(componentInput.value.length, componentInput.value.length);
    componentInput.dispatchEvent(new Event("input", { bubbles: true }));
  };
  form.querySelectorAll("[data-component-insert]").forEach((button) => {
    button.addEventListener("click", () => insertComponentSyntax(button.dataset.componentInsert || ""));
  });
  roleSelect?.addEventListener("change", () => {
    if (roleSelect.value) insertComponentSyntax(`@${roleSelect.value}`);
    roleSelect.value = "";
  });

  channelSearch?.addEventListener("input", () => {
    const query = channelSearch.value.trim().toLowerCase();
    Array.from(channelSelect?.options || []).forEach((option, index) => {
      if (index === 0) return;
      option.hidden = Boolean(query) && !option.textContent.toLowerCase().includes(query);
    });
  });
  const updatePreview = () => {
    const description = descriptionInput?.value || "";
    if (previewTitle) previewTitle.textContent = titleInput?.value || "서버 공지";
    if (previewDescription) previewDescription.textContent = description;
    if (previewDescriptionText) previewDescriptionText.textContent = description;
    if (previewFooter) previewFooter.textContent = form.querySelector('[name="embedFooter"]')?.value || "";
    if (previewCard && titleInput) previewCard.style.setProperty("--embed-preview-color", form.querySelector('[name="embedColor"]')?.value || "#1a1d23");
    if (previewComponents) {
      previewComponents.replaceChildren();
      const addPreviewText = (value, className = "discord-component-text") => {
        if (!value) return;
        const text = document.createElement("div");
        text.className = className;
        text.textContent = value;
        previewComponents.append(text);
      };
      addPreviewText(titleInput?.value ? `# ${titleInput.value}` : "", "discord-component-heading");
      addPreviewText(description, "discord-component-text");
      String(form.querySelector('[name="embedComponentsBody"]')?.value || "").split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        const imageMatch = trimmed.match(/^\[image\]\s+(https?:\/\/\S+)$/i);
        const thumbnailMatch = trimmed.match(/^\[thumbnail\]\s+(https?:\/\/\S+)$/i);
        if (trimmed === "--" || trimmed === "---" || trimmed === "___") {
          const divider = document.createElement("div");
          divider.className = "discord-component-divider";
          previewComponents.append(divider);
        } else if (imageMatch) {
          const image = document.createElement("img");
          image.className = "discord-component-image";
          image.src = imageMatch[1];
          image.alt = "Components V2 이미지 미리보기";
          previewComponents.append(image);
        } else if (thumbnailMatch) {
          const thumbnail = document.createElement("img");
          thumbnail.className = "discord-component-thumbnail";
          thumbnail.src = thumbnailMatch[1];
          thumbnail.alt = "Components V2 썸네일 미리보기";
          previewComponents.append(thumbnail);
        } else {
          const text = document.createElement("div");
          text.className = "discord-component-text";
          text.textContent = line || "\u00a0";
          previewComponents.append(text);
        }
      });
    }
  };
  titleInput?.addEventListener("input", updatePreview);
  descriptionInput?.addEventListener("input", updatePreview);
  form.querySelector('[name="embedFooter"]')?.addEventListener("input", updatePreview);
  form.querySelector('[name="embedColor"]')?.addEventListener("input", updatePreview);
  modeSelect?.addEventListener("change", () => {
    const isComponents = modeSelect.value === "components";
    form.querySelectorAll("[data-embed-format]").forEach((field) => {
      const visible = field.dataset.embedFormat === modeSelect.value;
      field.hidden = !visible;
      field.style.display = visible ? "" : "none";
      field.setAttribute("aria-hidden", String(!visible));
    });
    if (formatHelp) formatHelp.textContent = isComponents
      ? "기능 버튼을 누르거나 일반 문장을 입력하세요. --는 실선, @역할이름은 역할 멘션, [image]는 사진, [thumbnail]은 썸네지를 추가합니다."
      : "제목·설명·색상·푸터·작성자·이미지·필드로 기본 Discord 임베드를 작성합니다.";
    if (previewComponentsCard) previewComponentsCard.hidden = !isComponents;
    if (previewLegacyCard) previewLegacyCard.hidden = isComponents;
    if (previewDescriptionText) previewDescriptionText.hidden = isComponents;
    updatePreview();
  });
  modeSelect?.dispatchEvent(new Event("change"));
  form.querySelector('[name="embedComponentsBody"]')?.addEventListener("input", updatePreview);
  updatePreview();

  const updateDestinationFields = () => {
    const useWebhook = destinationSelect?.value === "webhook";
    if (channelField) channelField.hidden = useWebhook;
    if (webhookField) webhookField.hidden = !useWebhook;
    if (channelSelect) channelSelect.required = !useWebhook;
    if (webhookInput) webhookInput.required = useWebhook;
  };
  destinationSelect?.addEventListener("change", updateDestinationFields);
  updateDestinationFields();

  sendButton?.addEventListener("click", async () => {
    const useWebhook = destinationSelect?.value === "webhook";
    if (useWebhook && !webhookInput?.value.trim()) {
      showToast("웹훅 링크를 입력하세요.");
      return;
    }
    if (!useWebhook && !channelSelect?.value) {
      showToast("전송할 채널을 선택하세요.");
      return;
    }
    sendButton.disabled = true;
    try {
      const data = new URLSearchParams();
      new FormData(form).forEach((value, key) => data.append(key, value));
      form.querySelectorAll('input[type="checkbox"]').forEach((input) => data.set(input.name, input.checked ? "on" : "off"));
      const response = await fetch(sendButton.dataset.sendUrl, {
        method: "POST",
        headers: { "X-Requested-With": "fetch", Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: data
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "임베드 전송에 실패했습니다.");
      showToast("임베드 전송이 완료되었습니다.");
    } catch (error) {
      showToast(error.message || "임베드 전송에 실패했습니다.");
    } finally {
      sendButton.disabled = false;
    }
  });
}

function setupChannelComboboxes() {
  const selectors = 'select';
  const selects = [...document.querySelectorAll(selectors)].filter((select) => !select.dataset.comboReady);
  const closeAll = (except) => {
    document.querySelectorAll(".channel-combobox.is-open").forEach((combo) => {
      if (combo !== except) combo.classList.remove("is-open");
    });
  };
  selects.forEach((select) => {
    select.dataset.comboReady = "true";
    const combo = document.createElement("div");
    combo.className = "channel-combobox";
    combo.dataset.channelCombobox = "true";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "channel-combobox-input";
    input.autocomplete = "off";
    input.setAttribute("aria-label", select.previousElementSibling?.textContent?.trim() || "채널 선택");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("role", "combobox");
    const list = document.createElement("div");
    list.className = "channel-combobox-list";
    list.setAttribute("role", "listbox");
    combo.append(input, list);
    select.parentNode.insertBefore(combo, select);
    select.style.display = "none";
    const getOptions = () => [...select.options].filter((option) => option.value);
    const updateLabel = () => {
      const selected = select.options[select.selectedIndex];
      input.value = selected?.value ? selected.textContent.trim() : "";
      input.placeholder = selected?.value ? "채널 변경" : "채널 이름 검색 또는 선택";
    };
    const render = (query = "") => {
      const normalized = query.trim().toLowerCase();
      list.replaceChildren();
      const empty = document.createElement("button");
      empty.type = "button";
      empty.className = "channel-combobox-option is-empty";
      empty.textContent = "선택 안 함";
      empty.addEventListener("click", () => {
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        updateLabel();
        combo.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
      });
      list.append(empty);
      const matches = getOptions().filter((option) => option.textContent.toLowerCase().includes(normalized));
      matches.forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "channel-combobox-option";
        item.textContent = option.textContent.trim();
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", String(option.value === select.value));
        item.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          updateLabel();
          combo.classList.remove("is-open");
          input.setAttribute("aria-expanded", "false");
        });
        list.append(item);
      });
      if (!matches.length) {
        const noMatch = document.createElement("span");
        noMatch.className = "channel-combobox-empty";
        noMatch.textContent = "검색 결과가 없습니다.";
        list.append(noMatch);
      }
    };
    input.addEventListener("focus", () => {
      closeAll(combo);
      combo.classList.add("is-open");
      input.setAttribute("aria-expanded", "true");
      render(input.value === select.options[select.selectedIndex]?.textContent?.trim() ? "" : input.value);
    });
    input.addEventListener("input", () => {
      closeAll(combo);
      combo.classList.add("is-open");
      input.setAttribute("aria-expanded", "true");
      render(input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        updateLabel();
        combo.classList.remove("is-open");
        input.setAttribute("aria-expanded", "false");
      }
    });
    updateLabel();
    render();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".channel-combobox")) return;
    closeAll(null);
    document.querySelectorAll(".channel-combobox-input").forEach((input) => input.setAttribute("aria-expanded", "false"));
  }, { passive: true });
}
function setupShopPanel() {
  const list = document.querySelector("[data-shop-product-list]");
  const add = document.querySelector("[data-shop-add-product]");
  if (!list || !add) return;
  const bindRemove = (row) => row.querySelector("[data-shop-remove-product]")?.addEventListener("click", () => row.remove());
  list.querySelectorAll("[data-shop-product]").forEach(bindRemove);
  add.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "shop-product-row";
    row.dataset.shopProduct = "";
    row.innerHTML = `<input type="hidden" name="productId" value="" /><label class="field"><span>상품명</span><input name="productName" required /></label><label class="field"><span>가격</span><input type="number" min="0" name="productPrice" value="0" required /></label><label class="field full"><span>상품 설명</span><input name="productDescription" /></label><label class="field full"><span>재고 내용(한 줄당 1개)</span><textarea name="productDelivery" rows="5" required placeholder="재고 1\n재고 2\n재고 3"></textarea><small class="muted">줄바꿈마다 재고 1개로 저장되며 구매 시 하나씩 DM으로 전달됩니다.</small></label><label class="field toggle"><input type="checkbox" name="productEnabled" value="" checked /><span>판매 중</span></label><button class="ghost danger" type="button" data-shop-remove-product>삭제</button>`;
    list.append(row); bindRemove(row);
  });
}

function setupTabs() {
  const activeFromDom = normalizeTab(document.querySelector(".sidebar-tab.is-active")?.dataset.tab || defaultTab);
  activateTab(activeFromDom);

  sidebarTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = normalizeTab(button.dataset.tab);
      activateTab(nextTab, { scroll: true });
    });
  });
}

function setupSearch() {
  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", (event) => {
    renderSearchResults(event.target.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    const matches = collectTabMatches(searchInput.value);
    if (!matches.length) {
      return;
    }

    event.preventDefault();
    const nextTab = normalizeTab(matches[0].dataset.tab);
    activateTab(nextTab, { scroll: true });
    searchInput.value = "";
    renderSearchResults("");
  });
}

setupChannelComboboxes();
setupShopPanel();
setupTabs();
setupSearch();
setupEmbedPanel();
injectFeatureToggles();
setupForms();
