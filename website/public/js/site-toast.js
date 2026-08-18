(() => {
  const toast = document.createElement("div");
  toast.className = "save-toast site-toast";
  toast.hidden = true;
  toast.setAttribute("aria-live", "polite");
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(toast));

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
    }, type === "error" ? 4200 : 2600);
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

  function csrfToken(form) {
    return form.querySelector('input[name="_csrf"]')?.value || document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("csrf-token="))?.slice(11) || "";
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
      if (submitter?.name && !data.has(submitter.name)) data.append(submitter.name, submitter.value || "");
      const token = csrfToken(form);
      if (token && !data.has("_csrf")) data.set("_csrf", decodeURIComponent(token));
      const response = await fetch(form.action, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Requested-With": "fetch", Accept: "application/json", ...(token ? { "X-CSRF-Token": decodeURIComponent(token) } : {}) },
        body: data
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
      if (!response.ok || !payload?.ok) {
        const fallback = payload?.message || (response.status === 403 ? "보안 토큰이 만료되었습니다. 페이지를 새로고침한 뒤 다시 시도하세요." : response.status >= 500 ? "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요." : "요청을 처리하지 못했습니다.");
        throw new Error(fallback);
      }
      if (form.dataset.toastForm === "true" && payload.featureBans) {
        Object.entries(payload.featureBans).forEach(([featureId, banned]) => {
          const input = form.querySelector(`input[name="feature_${featureId}"]`);
          if (input) input.checked = !Boolean(banned);
        });
        const otherCommands = form.querySelector('input[name="otherCommandsEnabled"]');
        if (otherCommands && typeof payload.otherCommandsEnabled === "boolean") otherCommands.checked = payload.otherCommandsEnabled;
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

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('form[data-toast-form="true"]').forEach((form) => {
      form.addEventListener("submit", submitWithToast);
    });
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form instanceof HTMLFormElement) submitWithToast(event);
  });
})();
