(() => {
  const input = document.querySelector("#guide-search");
  const clearButton = document.querySelector("#guide-search-clear");
  const status = document.querySelector("#guide-search-status");
  const items = [...document.querySelectorAll("[data-guide-search-item]")];
  const commandItems = items.filter((item) => item.hasAttribute("data-guide-command"));
  const planItems = items.filter((item) => item.classList.contains("guide-plan-card"));
  if (!input || !status || !items.length) return;

  const update = () => {
    const query = input.value.trim().toLowerCase();
    let visibleCommands = 0;
    let visiblePlans = 0;
    items.forEach((item) => {
      const matches = !query || item.dataset.search.includes(query);
      item.hidden = !matches;
      if (!matches) return;
      if (item.hasAttribute("data-guide-command")) visibleCommands += 1;
      if (item.classList.contains("guide-plan-card")) visiblePlans += 1;
    });
    status.textContent = query
      ? `${visibleCommands}개 명령어 · ${visiblePlans}개 플랜이 검색되었습니다.`
      : `${commandItems.length}개 명령어 · ${planItems.length}개 플랜이 표시되고 있습니다.`;
    clearButton?.classList.toggle("is-visible", Boolean(query));
  };

  input.addEventListener("input", update);
  clearButton?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    update();
  });
})();
