// models-dropdown-events-utils.js - event wiring helpers

function buildInputHandlers(manager, input) {
  const handlers = {
    onInputClick: null,
    onInputPointerDown: null,
    onInputFocus: null,
    onInputInput: null,
    onInputKeyDown: null,
    onDocClick: null,
    onDocMouseDown: null,
    onDocMouseUp: null,
    onInputBlur: null
  };

  handlers.onInputClick = (e) => {
    e.stopPropagation();
    if (!manager.state.visible) {
      manager.state.isOpening = true;
      manager.state.justOpened = true;
      manager.show("", { captureSelectionValue: true });
      input.select();
      setTimeout(() => {
        manager.state.isOpening = false;
        manager.state.justOpened = false;
      }, 200);
    } else {
      input.select();
    }
  };

  handlers.onInputPointerDown = () => {
    if (manager.state.visible) return;
    manager.state.isOpening = true;
    manager.state.justOpened = true;
    manager.show("", { captureSelectionValue: true });
    input.select();
    setTimeout(() => {
      manager.state.isOpening = false;
      manager.state.justOpened = false;
    }, 200);
  };

  handlers.onInputFocus = () => {
    if (manager.state.justClosed) {
      manager.state.justClosed = false;
      return;
    }
    if (!manager.state.visible && !manager.state.isOpening) {
      manager.state.isOpening = true;
      manager.state.justOpened = true;
      manager.show("", { captureSelectionValue: true });
      input.select();
      setTimeout(() => {
        manager.state.isOpening = false;
        manager.state.justOpened = false;
      }, 200);
    }
  };

  handlers.onInputInput = (e) => {
    if (manager.state.ignoreNextInput) {
      manager.state.ignoreNextInput = false;
      return;
    }
    if (!manager.state.visible) {
      manager.show(e.target.value, { captureSelectionValue: false });
      return;
    }
    manager.show(e.target.value, { captureSelectionValue: false });
  };

  handlers.onInputKeyDown = manager.handleKeyDown.bind(manager);

  handlers.onDocClick = (e) => {
    if (manager.state.justOpened) return;
    setTimeout(() => {
      const inputWrapper = input.closest("#model-input-wrapper") || input.parentElement;
      if (manager.state.visible &&
        !inputWrapper.contains(e.target) &&
        !manager.dropdownElement.contains(e.target)) {
        manager.hide();
      }
    }, 0);
  };

  handlers.onDocMouseDown = (e) => {
    if (!manager.state.visible) return;
    if (manager.state.isOpening || manager.state.justOpened) return;
    const insideDropdown = manager.dropdownElement && manager.dropdownElement.contains(e.target);
    manager.state.pointerDownInDropdown = Boolean(insideDropdown);
    if (input.contains(e.target)) return;
    if (insideDropdown) return;
    manager.hide();
  };

  handlers.onDocMouseUp = () => {
    manager.state.pointerDownInDropdown = false;
  };

  handlers.onInputBlur = () => {
    window.requestAnimationFrame(() => {
      if (!manager.state.visible) return;
      if (manager.state.justOpened || manager.state.isOpening) return;
      if (manager.state.pointerDownInDropdown) return;
      if (manager.dropdownElement.contains(document.activeElement)) return;
      manager.hide();
    });
  };

  return handlers;
}

function attachInputListeners(manager, input, handlers) {
  input.addEventListener("click", handlers.onInputClick);
  input.addEventListener("pointerdown", handlers.onInputPointerDown);
  input.addEventListener("focus", handlers.onInputFocus);
  input.addEventListener("input", handlers.onInputInput);
  input.addEventListener("keydown", handlers.onInputKeyDown);
  input.addEventListener("blur", handlers.onInputBlur);
  document.addEventListener("click", handlers.onDocClick);
  document.addEventListener("mousedown", handlers.onDocMouseDown);
  document.addEventListener("mouseup", handlers.onDocMouseUp);
}

function detachInputListeners(input, handlers) {
  if (!handlers || !input) return;
  input.removeEventListener("click", handlers.onInputClick);
  input.removeEventListener("pointerdown", handlers.onInputPointerDown);
  input.removeEventListener("focus", handlers.onInputFocus);
  input.removeEventListener("input", handlers.onInputInput);
  input.removeEventListener("keydown", handlers.onInputKeyDown);
  input.removeEventListener("blur", handlers.onInputBlur);
  document.removeEventListener("click", handlers.onDocClick);
  document.removeEventListener("mousedown", handlers.onDocMouseDown);
  document.removeEventListener("mouseup", handlers.onDocMouseUp);
}

function handleDropdownClick(manager, e) {
  const target = e.target;
  const item = target?.closest ? target.closest(".model-dropdown-item") : null;
  const starIcon = target?.closest ? target.closest(".model-star-icon") : null;
  const closeBtn = target?.closest ? target.closest("#model-dropdown-close") : null;

  manager.debugLog("click", {
    targetTag: target?.tagName || null,
    itemFound: Boolean(item),
    modelId: item?.dataset?.modelId || null,
    star: Boolean(starIcon),
    close: Boolean(closeBtn)
  });

  if (closeBtn) {
    manager.hide();
    return;
  }
  if (!item) return;

  const modelId = item.dataset.modelId;
  if (!modelId) return;

  if (starIcon) {
    manager.toggleFavorite(modelId);
    return;
  }

  manager.selectModel(modelId);
}

function handleDropdownHover(_manager, e) {
  const item = e.target.closest(".model-dropdown-item");
  if (!item) return;
  const star = item.querySelector(".model-star-icon");
  if (star && star.textContent === "☆") {
    star.style.opacity = "1";
  }
}

function handleDropdownLeave(_manager, e) {
  const item = e.target.closest(".model-dropdown-item");
  if (!item) return;
  const star = item.querySelector(".model-star-icon");
  if (star && star.textContent === "☆") {
    star.style.opacity = "0";
  }
}

const modelsDropdownEventsUtils = {
  buildInputHandlers,
  attachInputListeners,
  detachInputListeners,
  handleDropdownClick,
  handleDropdownHover,
  handleDropdownLeave
};

if (typeof window !== "undefined") {
  window.modelsDropdownEventsUtils = modelsDropdownEventsUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.modelsDropdownEventsUtils = modelsDropdownEventsUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = modelsDropdownEventsUtils;
}
