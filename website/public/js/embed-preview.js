function text(value, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function setupWelcomePreview() {
  const titleInput = document.querySelector('[data-welcome-preview="title"]');
  const descriptionInput = document.querySelector('[data-welcome-preview="description"]');
  const colorInput = document.querySelector('[data-welcome-preview="color"]');
  const dmTitleInput = document.querySelector('[data-welcome-preview="dmTitle"]');
  const dmMessageInput = document.querySelector('[data-welcome-preview="dmMessage"]');
  const dmColorInput = document.querySelector('[data-welcome-preview="dmColor"]');

  const title = document.querySelector("[data-preview-title]");
  const description = document.querySelector("[data-preview-description]");
  const bar = document.querySelector("#welcome-preview .preview-bar");
  const dmTitle = document.querySelector("[data-preview-dm-title]");
  const dmMessage = document.querySelector("[data-preview-dm-message]");
  const dmBar = document.querySelector(".preview-bar-dm");

  if (!title || !description || !bar || !dmTitle || !dmMessage || !dmBar) {
    return;
  }

  const render = () => {
    title.textContent = text(titleInput?.value, "환영합니다");
    description.textContent = text(descriptionInput?.value, "신규 멤버를 환영하는 메시지가 들어갑니다.");
    bar.style.background = text(colorInput?.value, "#101010");
    dmTitle.textContent = text(dmTitleInput?.value, "환영합니다");
    dmMessage.textContent = text(dmMessageInput?.value, "DM 메시지가 여기에 표시됩니다.");
    dmBar.style.background = text(dmColorInput?.value, "#1f1f1f");
  };

  [titleInput, descriptionInput, colorInput, dmTitleInput, dmMessageInput, dmColorInput].forEach((input) => {
    input?.addEventListener("input", render);
  });

  render();
}

function setupPollPreview() {
  const questionInput = document.querySelector('[data-poll-preview="question"]');
  const descriptionInput = document.querySelector('[data-poll-preview="description"]');
  const optionsInput = document.querySelector('[data-poll-preview="options"]');
  const freeTextInput = document.querySelector('[data-poll-preview="freeText"]');

  const question = document.querySelector("[data-preview-question]");
  const description = document.querySelector("[data-preview-poll-description]");
  const optionsBox = document.querySelector("[data-preview-options]");

  if (!question || !description || !optionsBox) {
    return;
  }

  const render = () => {
    question.textContent = text(questionInput?.value, "투표 질문");
    description.textContent = text(descriptionInput?.value, "설명이 표시됩니다.");

    const options = text(optionsInput?.value, "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    optionsBox.innerHTML = "";

    if (!options.length) {
      const empty = document.createElement("span");
      empty.textContent = "항목을 입력하면 버튼이 표시됩니다.";
      optionsBox.appendChild(empty);
      return;
    }

    options.forEach((option) => {
      const pill = document.createElement("span");
      pill.className = "poll-pill";
      pill.textContent = option;
      optionsBox.appendChild(pill);
    });
    if (freeTextInput?.checked) {
      const pill = document.createElement("span");
      pill.className = "poll-pill is-free-text";
      pill.textContent = "자유 입력";
      optionsBox.appendChild(pill);
    }
  };

  [questionInput, descriptionInput, optionsInput, freeTextInput].forEach((input) => {
    input?.addEventListener("input", render);
    input?.addEventListener("change", render);
  });

  render();
}

function setupStaffPreview() {
  const titleInput = document.querySelector('[data-staff-preview="title"]');
  const descriptionInput = document.querySelector('[data-staff-preview="description"]');
  const buttonInput = document.querySelector('[data-staff-preview="button"]');

  const title = document.querySelector("[data-preview-staff-title]");
  const description = document.querySelector("[data-preview-staff-description]");
  const button = document.querySelector("[data-preview-staff-button]");

  if (!title || !description || !button) {
    return;
  }

  const render = () => {
    title.textContent = text(titleInput?.value, "관리자 출퇴근 상태");
    description.textContent = text(descriptionInput?.value, "버튼을 눌러 출퇴근 상태를 변경합니다.");
    button.textContent = text(buttonInput?.value, "출퇴근");
  };

  [titleInput, descriptionInput, buttonInput].forEach((input) => {
    input?.addEventListener("input", render);
    input?.addEventListener("change", render);
  });

  render();
}

setupWelcomePreview();
setupPollPreview();
setupStaffPreview();
