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

async function submitForm(form) {
  const response = await fetch(form.action, {
    method: (form.method || "post").toUpperCase(),
    headers: {
      "X-Requested-With": "fetch",
      Accept: "application/json"
    },
    body: (() => {
      const data = new FormData(form);
      form.querySelectorAll('input[type="checkbox"][name$="Enabled"]').forEach((input) => {
        data.set(input.name, input.checked ? "on" : "off");
      });
      return data;
    })()
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "저장에 실패했습니다.");
  }

  return payload;
}

function setupForms() {
  forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector("button[type='submit']");
      const initialLabel = submitButton?.textContent || "";

      try {
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "저장 중...";
        }

        if (form.dataset.confirmReset === "true" && !window.confirm(form.dataset.confirmMessage || "서버 데이터를 초기화할까요?")) {
          return;
        }

        const payload = await submitForm(form);
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
  const sendButton = form.querySelector("[data-embed-send]");
  const modeSelect = form.querySelector("[data-embed-mode]");
  const titleInput = form.querySelector('[data-embed-preview="title"]');
  const descriptionInput = form.querySelector('[data-embed-preview="description"]');
  const previewTitle = document.querySelector("[data-embed-preview-title]");
  const previewDescription = document.querySelector("[data-embed-preview-description]");
  const previewDescriptionText = document.querySelector("[data-embed-preview-description-text]");
  const previewComponents = document.querySelector("[data-embed-preview-components]");
  const previewComponentsCard = document.querySelector("[data-embed-preview-components-card]");
  const previewLegacyCard = document.querySelector("[data-embed-preview-legacy-card]");
  const previewCard = document.querySelector("[data-embed-preview-card]");
  const formatHelp = form.querySelector("[data-embed-format-help]");

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
    if (previewCard && titleInput) previewCard.style.setProperty("--embed-preview-color", form.querySelector('[name="embedColor"]')?.value || "#1a1d23");
    if (previewComponents) {
      previewComponents.replaceChildren();
      String(form.querySelector('[name="embedComponentsBody"]')?.value || "").split(/\r?\n/).forEach((line) => {
        if (line.trim() === "---" || line.trim() === "___") {
          const divider = document.createElement("div");
          divider.className = "discord-component-divider";
          previewComponents.append(divider);
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
  form.querySelector('[name="embedColor"]')?.addEventListener("input", updatePreview);
  modeSelect?.addEventListener("change", () => {
    const isComponents = modeSelect.value === "components";
    form.querySelectorAll("[data-embed-format]").forEach((field) => {
      field.hidden = field.dataset.embedFormat !== modeSelect.value;
    });
    if (formatHelp) formatHelp.textContent = isComponents
      ? "일반 문장, 빈 줄, --- 또는 ___ 기호로 Components V2의 표시 순서를 작성합니다."
      : "제목·설명·색상·푸터·작성자·이미지·필드로 기본 Discord 임베드를 작성합니다.";
    if (previewComponentsCard) previewComponentsCard.hidden = !isComponents;
    if (previewLegacyCard) previewLegacyCard.hidden = isComponents;
    if (previewDescriptionText) previewDescriptionText.hidden = isComponents;
    updatePreview();
  });
  modeSelect?.dispatchEvent(new Event("change"));
  form.querySelector('[name="embedComponentsBody"]')?.addEventListener("input", updatePreview);

  sendButton?.addEventListener("click", async () => {
    if (!channelSelect?.value) {
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

setupTabs();
setupSearch();
setupEmbedPanel();
injectFeatureToggles();
setupForms();
