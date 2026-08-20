(() => {
  const root = document.documentElement;
  const storageKey = "hs-theme";

  function getTheme() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    const next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    localStorage.setItem(storageKey, next);
    const toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      const isDark = next === "dark";
      toggle.setAttribute("aria-pressed", String(isDark));
      toggle.setAttribute("aria-label", isDark ? "라이트모드로 전환" : "다크모드로 전환");
      toggle.innerHTML = `<span aria-hidden="true">${isDark ? "◐" : "☼"}</span><span>${isDark ? "DARK" : "LIGHT"}</span>`;
    }
  }

  function mountToggle() {
    if (document.querySelector("[data-theme-toggle]")) return;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "site-theme-toggle";
    toggle.dataset.themeToggle = "true";
    toggle.addEventListener("click", () => applyTheme(getTheme() === "dark" ? "light" : "dark"));
    document.body.append(toggle);
    applyTheme(getTheme());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountToggle, { once: true });
  } else {
    mountToggle();
  }
})();
