(() => {
  const input = document.querySelector("#guide-search");
  const clearButton = document.querySelector("#guide-search-clear");
  const status = document.querySelector("#guide-search-status");
  const rows = [...document.querySelectorAll("[data-guide-command]")];
  if (!input || !status || !rows.length) return;

  const update = () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const matches = !query || row.dataset.search.includes(query);
      row.hidden = !matches;
      if (matches) visible += 1;
    });
    status.textContent = query
      ? `${visible}개의 명령어가 검색되었습니다.`
      : `${rows.length}개의 명령어가 표시되고 있습니다.`;
    clearButton?.classList.toggle("is-visible", Boolean(query));
  };

  input.addEventListener("input", update);
  clearButton?.addEventListener("click", () => {
    input.value = "";
    input.focus();
    update();
  });
})();
