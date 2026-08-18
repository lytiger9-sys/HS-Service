(() => {
  const toast = document.createElement("div");
  toast.className = "save-toast site-toast";
  toast.hidden = true;
  toast.setAttribute("aria-live", "polite");
    document.addEventListener("DOMContentLoaded", () => {
      if (!toast.isConnected) document.body.appendChild(toast);
    });

  function showSiteToast(message, type = "error") {
    if (!message) return;
    toast.textContent = String(message);
    toast.dataset.type = type;
    toast.hidden = false;
    toast.classList.add("is-visible");
    window.clearTimeout(showSiteToast.timer);
    showSiteToast.timer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }, type === "error" ? 6000 : 5000);
  }

  window.showSiteToast = showSiteToast;

  function shouldHandle(form) {
    const method = String(form.method || "get").toLowerCase();
    const action = String(form.action || "");
    if (method !== "post") return false;
    if (form.dataset.toastForm === "true") return true;
    if (!/^https?:\/\//i.test(action) && !action.startsWith("/")) return false;
    if (!action.includes("/guild/") && !action.includes("/license/")) return false;
    return !/\/license\/(login|logout)(?:[/?#]|$)/.test(action);
  }

  async function refreshPartial(url, targets = []) {
    const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html", "X-Requested-With": "fetch" } });
    if (!response.ok) throw new Error("최신 목록을 불러오지 못했습니다.");
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const names = Array.isArray(targets) && targets.length ? targets : ["partner"];
    names.forEach((name) => {
      const selector = name === "partner" ? '[data-panel="partner"]' : `[data-partial-target="${name}"]`;
      const incoming = parsed.querySelector(selector);
      const current = document.querySelector(selector);
      if (!incoming || !current) throw new Error("목록 화면을 갱신하지 못했습니다.");
      incoming.className = current.className;
      current.replaceWith(incoming);
    });
  }

  async function submitWithToast(event) {
    const form = event.target;
    if (!shouldHandle(form) || form.dataset.toastSubmitting === "true") return;
    event.preventDefault();
    form.dataset.toastSubmitting = "true";
    const submitter = event.submitter;
    const buttons = [...form.querySelectorAll("button, input[type=submit]")];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const data = new FormData(form);
      const checkboxInputs = new Set([
        ...Array.from(form.querySelectorAll('input[type="checkbox"][name]')),
        ...(form.id ? Array.from(document.querySelectorAll(`input[type="checkbox"][form="${form.id}"][name]`)) : [])
      ]);
      checkboxInputs.forEach((input) => {
        data.set(input.name, input.checked ? "on" : "off");
      });
      if (submitter?.name && !data.has(submitter.name)) data.append(submitter.name, submitter.value || "");
      const action = submitter?.hasAttribute?.("formaction") ? submitter.formAction : form.action;
      const method = submitter?.hasAttribute?.("formmethod") ? submitter.formMethod.toUpperCase() : (form.method || "POST").toUpperCase();
      const encoded = new URLSearchParams();
      for (const [key, value] of data.entries()) {
        encoded.append(key, String(value));
      }
      const response = await fetch(action, {
        method,
        credentials: "same-origin",
        headers: {
          "X-Requested-With": "fetch",
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: encoded
      });
      const contentType = response.headers.get("content-type") || "";
      let payload = null;
      let responseText = "";
      if (contentType.includes("application/json")) {
        payload = await response.json().catch(() => null);
      } else {
        responseText = await response.text().catch(() => "");
      }
      if (!response.ok || !payload?.ok) {
        const fallback = payload?.message
          || responseText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
          || (response.status === 401 ? "관리자 세션이 만료되었습니다. 다시 로그인해 주세요." : "저장 요청이 거부되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.");
        throw new Error(`${fallback} (${response.status})`);
      }
      if (form.dataset.toastForm === "true" && payload.featureBans) {
        Object.entries(payload.featureBans).forEach(([featureId, banned]) => {
          const input = form.querySelector(`input[type="checkbox"][name="feature_${featureId}"]`);
          if (input) input.checked = ![true, 1, "true", "1", "on", "yes", "enabled"].includes(banned);
        });
        const otherCommands = form.querySelector('input[type="checkbox"][name="otherCommandsEnabled"]');
        if (otherCommands && payload.otherCommandsEnabled !== undefined) otherCommands.checked = [true, 1, "true", "1", "on", "yes", "enabled"].includes(payload.otherCommandsEnabled);
      }
      if (payload.partialUrl) {
        try {
          await refreshPartial(payload.partialUrl, payload.partialTargets);
        } catch (refreshError) {
          showSiteToast(refreshError?.message || "목록 갱신에 실패했습니다.", "error");
          return;
        }
      }
      showSiteToast(payload.message || "저장되었습니다.", "success");
      if (payload.redirect) window.setTimeout(() => { window.location.assign(payload.redirect); }, 350);
    } catch (error) {
      showSiteToast(error?.message || "요청을 처리하지 못했습니다.", "error");
    } finally {
      form.dataset.toastSubmitting = "false";
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form && String(form.tagName).toLowerCase() === "form") submitWithToast(event);
  }, true);
})();
