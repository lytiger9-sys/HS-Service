(() => {
  const input = document.querySelector("#guide-search");
  const clearButton = document.querySelector("#guide-search-clear");
  const status = document.querySelector("#guide-search-status");
  const items = [...document.querySelectorAll("[data-guide-search-item]")];
  const commandItems = items.filter((item) => item.hasAttribute("data-guide-command"));
  const featureItems = items.filter((item) => item.classList.contains("guide-feature-card"));
  if (!input || !status || !items.length) return;

  const update = () => {
    const query = input.value.trim().toLowerCase();
    let visibleCommands = 0;
    let visibleFeatures = 0;
    items.forEach((item) => {
      const matches = !query || item.dataset.search.includes(query);
      item.hidden = !matches;
      if (!matches) return;
      if (item.hasAttribute("data-guide-command")) visibleCommands += 1;
      if (item.classList.contains("guide-feature-card")) visibleFeatures += 1;
    });
    status.textContent = query
      ? `${visibleCommands}개 명령어 · ${visibleFeatures}개 대시보드 기능이 검색되었습니다.`
      : `${commandItems.length}개 명령어 · ${featureItems.length}개 대시보드 기능이 표시되고 있습니다.`;
    clearButton?.classList.toggle("is-visible", Boolean(query));
  };

  input.addEventListener("input", update);
  clearButton?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    update();
  });
})();
