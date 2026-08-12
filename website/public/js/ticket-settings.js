function text(value, fallback = "") {
  return value == null || value === "" ? fallback : String(value);
}

function buildTicketPreview() {
  const form = document.querySelector("[data-ticket-form]");
  const preview = document.querySelector("#ticket-preview");

  if (!form || !preview) {
    return;
  }

  const title = preview.querySelector("[data-preview-ticket-title]");
  const description = preview.querySelector("[data-preview-ticket-description]");
  const button = preview.querySelector("[data-preview-ticket-button]");
  const footer = preview.querySelector("[data-preview-ticket-footer]");
  const count = preview.querySelector("[data-preview-ticket-count]");
  const board = preview.querySelector("[data-preview-ticket-board]");
  const categoriesBox = preview.querySelector("[data-preview-ticket-categories]");
  const bar = preview.querySelector(".preview-bar-ticket");

  const titleInput = form.querySelector('[data-ticket-preview="title"]');
  const descriptionInput = form.querySelector('[data-ticket-preview="description"]');
  const buttonInput = form.querySelector('[data-ticket-preview="button"]');
  const footerInput = form.querySelector('[data-ticket-preview="footer"]');
  const accentInput = form.querySelector('[data-ticket-preview="accent"]');
  const boardChannelInput = form.querySelector('[data-ticket-preview="boardChannel"]');

  const render = () => {
    if (title) {
      title.textContent = text(titleInput?.value, "티켓 안내");
    }

    if (description) {
      description.textContent = text(
        descriptionInput?.value,
        "버튼을 눌러 드롭다운에서 카테고리를 고른 뒤, 모달로 정보를 제출하세요."
      );
    }

    if (button) {
      button.textContent = text(buttonInput?.value, "티켓 열기");
    }

    if (footer) {
      footer.textContent = text(footerInput?.value, "봇 전용 티켓");
    }

    if (bar) {
      bar.style.background = text(accentInput?.value, "#4f6685");
    }

    const cards = [...form.querySelectorAll("[data-ticket-category]")];
    const realCards = cards.filter((card) => {
      const label = card.querySelector('[data-ticket-category-label]')?.value?.trim();
      const serverCategory = card.querySelector("select")?.value?.trim();
      const hiddenId = card.querySelector('[data-ticket-category-id]')?.value?.trim();
      const questionLabels = [...card.querySelectorAll('[data-ticket-question-label]')].some((field) => field.value.trim());
      return Boolean(label || serverCategory || hiddenId || questionLabels);
    });
    if (count) {
      count.textContent = `${realCards.length}개 카테고리`;
    }

    if (board) {
      board.textContent = boardChannelInput?.value ? "게시 채널 지정됨" : "게시 채널 미지정";
    }

    if (categoriesBox) {
      categoriesBox.innerHTML = "";
      const visibleCards = realCards.slice(0, 3);

      if (!visibleCards.length) {
        const empty = document.createElement("span");
        empty.className = "ticket-preview-empty";
        empty.textContent = "카테고리를 추가하면 여기에 표시됩니다.";
        categoriesBox.appendChild(empty);
        return;
      }

      visibleCards.forEach((card) => {
        const categoryLabel = card.querySelector('[data-ticket-category-label]')?.value || "새 카테고리";
        const questionCount = card.querySelectorAll("[data-ticket-question]").length;

        const row = document.createElement("div");
        row.className = "ticket-preview-category";
        row.innerHTML = `<strong></strong><span></span>`;
        row.querySelector("strong").textContent = categoryLabel;
        row.querySelector("span").textContent = `${questionCount}개 질문`;
        categoriesBox.appendChild(row);
      });
    }
  };

  const refreshCategoryIndexes = () => {
    const categories = [...form.querySelectorAll("[data-ticket-category]")];

    categories.forEach((card, categoryIndex) => {
      const titleLabel = card.querySelector("[data-ticket-category-title]");
      const labelInput = card.querySelector('[data-ticket-category-label]');
      const hiddenId = card.querySelector('[data-ticket-category-id]');

      if (titleLabel) {
        titleLabel.textContent = labelInput?.value?.trim() || "새 카테고리";
      }

      if (hiddenId?.name) {
        hiddenId.name = `ticketCategories[${categoryIndex}][id]`;
      }

      card.querySelectorAll("input, select, textarea").forEach((field) => {
        if (!field.name) {
          return;
        }

        field.name = field.name
          .replace(/ticketCategories\[(?:\d+|__INDEX__)\]/, `ticketCategories[${categoryIndex}]`)
          .replace(/questions\[(?:\d+|__QINDEX__)\]/g, (match) => match);
      });

      const questions = [...card.querySelectorAll("[data-ticket-question]")];
      questions.forEach((row, questionIndex) => {
        row.querySelectorAll("input, select, textarea").forEach((field) => {
          if (!field.name) {
            return;
          }

          field.name = field.name.replace(/questions\[\d+\]/, `questions[${questionIndex}]`);
        });
      });
    });

    render();
  };

  const createCategoryCard = () => {
    const template = document.querySelector("#ticket-category-template");
    const fragment = template?.content?.cloneNode(true);
    const card = fragment?.querySelector("[data-ticket-category]");

    if (!card) {
      return null;
    }

    return card;
  };

  const createQuestionRow = (card) => {
    const existing = card.querySelector("[data-ticket-question]");
    if (!existing) {
      return null;
    }

    const clone = existing.cloneNode(true);
    clone.querySelectorAll("input, textarea, select").forEach((field) => {
      if (field.type === "checkbox") {
        field.checked = false;
      } else {
        field.value = "";
      }
    });

    return clone;
  };

  form.addEventListener("input", () => {
    refreshCategoryIndexes();
  });

  form.addEventListener("change", () => {
    refreshCategoryIndexes();
  });

  form.addEventListener("click", (event) => {
    const addCategoryButton = event.target.closest("[data-ticket-add-category]");
    if (addCategoryButton) {
      const card = createCategoryCard();
      if (card) {
        const list = form.querySelector("[data-ticket-category-list]");
        list.appendChild(card);
        refreshCategoryIndexes();
      }
      return;
    }

    const removeCategoryButton = event.target.closest("[data-ticket-remove-category]");
    if (removeCategoryButton) {
      const card = removeCategoryButton.closest("[data-ticket-category]");
      const list = form.querySelector("[data-ticket-category-list]");
      if (card && list.children.length > 1) {
        card.remove();
      } else if (card) {
        card.querySelectorAll("input[type='text']").forEach((field) => {
          field.value = "";
        });
        card.querySelectorAll("input[type='hidden']").forEach((field) => {
          field.value = "";
        });
        card.querySelectorAll("input[type='checkbox']").forEach((field) => {
          field.checked = false;
        });
      }
      refreshCategoryIndexes();
      return;
    }

    const addQuestionButton = event.target.closest("[data-ticket-add-question]");
    if (addQuestionButton) {
      const card = addQuestionButton.closest("[data-ticket-category]");
      const list = card?.querySelector("[data-ticket-question-list]");
      const row = createQuestionRow(card);
      if (list && row) {
        list.appendChild(row);
        refreshCategoryIndexes();
      }
      return;
    }

    const removeQuestionButton = event.target.closest("[data-ticket-remove-question]");
    if (removeQuestionButton) {
      const row = removeQuestionButton.closest("[data-ticket-question]");
      const list = removeQuestionButton.closest("[data-ticket-question-list]");
      if (row && list.children.length > 1) {
        row.remove();
      } else if (row) {
        row.querySelectorAll("input[type='text']").forEach((field) => {
          field.value = "";
        });
        row.querySelectorAll("input[type='hidden']").forEach((field) => {
          field.value = "";
        });
        row.querySelectorAll("input[type='checkbox']").forEach((field) => {
          field.checked = false;
        });
      }
      refreshCategoryIndexes();
    }
  });

  refreshCategoryIndexes();
}

buildTicketPreview();
