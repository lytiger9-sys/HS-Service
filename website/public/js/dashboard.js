const sidebarTabs = Array.from(document.querySelectorAll(".sidebar-tab"));
const availableTabs = new Set(
  sidebarTabs
    .map((button) => button.dataset.tab)
    .filter(Boolean)
);
const defaultTab = availableTabs.has("overview") ? "overview" : sidebarTabs[0]?.dataset.tab || "";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("is-hidden", panel.dataset.panel !== nextTab);
  });

  if (scroll) {
    scrollToTop();
  }

  return nextTab;
}

function setupTabs() {
  const activeFromHash = normalizeTab(
    window.location.hash.replace("#", "") ||
      document.querySelector(".sidebar-tab.is-active")?.dataset.tab ||
      defaultTab
  );

  activateTab(activeFromHash);

  sidebarTabs.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = normalizeTab(button.dataset.tab);

      if (window.location.hash.replace("#", "") === nextTab) {
        activateTab(nextTab, { scroll: true });
        return;
      }

      window.location.hash = nextTab;
    });
  });

  window.addEventListener("hashchange", () => {
    const tab = normalizeTab(window.location.hash.replace("#", "") || defaultTab);
    activateTab(tab, { scroll: true });
  });
}

setupTabs();
