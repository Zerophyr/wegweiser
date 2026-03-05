// models-dropdown-render-utils.js - rendering/sorting helpers for model dropdown

function getModelLabel(manager, model) {
  return model.displayName || model.name || model.id;
}

function getModelVendorId(manager, model) {
  if (model && typeof model.vendorLabel === "string" && model.vendorLabel.trim()) {
    return model.vendorLabel.trim();
  }

  const ownedBy = model && typeof model.ownedBy === "string" ? model.ownedBy.trim() : "";
  if (ownedBy) {
    return ownedBy;
  }

  const label = getModelLabel(manager, model);
  return inferVendorFromModelName(manager, label || model.id || "");
}

function inferVendorFromModelName(_manager, name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("openai") || value.includes("gpt")) return "OpenAI";
  if (value.includes("anthropic") || value.includes("claude")) return "Anthropic";
  if (value.includes("google") || value.includes("gemini")) return "Google";
  if (value.includes("meta") || value.includes("llama")) return "Meta";
  if (value.includes("mistral")) return "Mistral";
  if (value.includes("x-ai") || value.includes("grok")) return "xAI";
  if (value.includes("qwen")) return "Qwen";
  if (value.includes("alibaba")) return "Alibaba";
  if (value.includes("deepseek")) return "DeepSeek";
  if (value.includes("nvidia")) return "NVIDIA";
  if (value.includes("cohere")) return "Cohere";
  return "Other";
}

function getVendorLabelForModel(manager, model) {
  const vendor = getModelVendorId(manager, model);
  if (!vendor || typeof vendor !== "string") return "Other";
  const normalized = vendor.trim();
  if (!normalized) return "Other";

  const knownLabels = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    meta: "Meta",
    mistral: "Mistral",
    "x-ai": "xAI",
    xai: "xAI",
    qwen: "Qwen",
    alibaba: "Alibaba",
    deepseek: "DeepSeek",
    nvidia: "NVIDIA",
    cohere: "Cohere"
  };

  const key = normalized.toLowerCase();
  if (knownLabels[key]) return knownLabels[key];
  if (normalized === normalized.toUpperCase()) return normalized;

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getModelBaseNameForSort(manager, model) {
  const label = getModelLabel(manager, model);
  const bySlash = label.includes("/") ? label.slice(label.lastIndexOf("/") + 1) : label;
  const byColon = bySlash.includes(":") ? bySlash.slice(bySlash.lastIndexOf(":") + 1) : bySlash;
  return byColon.toLowerCase();
}

function getModelProviderId(_manager, model) {
  const id = typeof model.id === "string" ? model.id : "";
  if (id.includes(":")) {
    return id.split(":", 1)[0];
  }
  if (id.includes("/")) {
    return "openrouter";
  }
  return "openrouter";
}

function getProviderBadge(manager, model) {
  const provider = getModelProviderId(manager, model);
  if (provider === "openrouter") {
    return { label: "OR", background: "var(--color-success, #10b981)", color: "#fff" };
  }
  return { label: provider.slice(0, 2).toUpperCase(), background: "var(--color-primary, #3b82f6)", color: "#fff" };
}

function render(manager) {
  const dropdown = manager.dropdownElement;
  const searchLower = manager.state.filterTerm.toLowerCase();
  const getLabel = (model) => getModelLabel(manager, model).toLowerCase();

  const filteredModels = manager.state.filterTerm
    ? manager.state.allModels.filter((m) => getLabel(m).includes(searchLower) || m.id.toLowerCase().includes(searchLower))
    : manager.state.allModels;

  const favModels = filteredModels.filter((m) => manager.state.favoriteModels.has(m.id));
  const recentList = Array.isArray(manager.state.recentlyUsedModels)
    ? manager.state.recentlyUsedModels
    : [];
  const recentModels = recentList
    .map((id) => manager.state.allModels.find((m) => m.id === id))
    .filter((m) => m && !manager.state.favoriteModels.has(m.id) && filteredModels.includes(m));
  const nonFavModels = filteredModels.filter((m) =>
    !manager.state.favoriteModels.has(m.id) &&
    !recentList.includes(m.id)
  );

  const sortByLabel = (a, b) => getLabel(a).localeCompare(getLabel(b));
  const sortByBaseAndProvider = (a, b) => {
    const baseA = getModelBaseNameForSort(manager, a);
    const baseB = getModelBaseNameForSort(manager, b);
    if (baseA !== baseB) {
      return baseA.localeCompare(baseB);
    }
    const providerA = getModelProviderId(manager, a);
    const providerB = getModelProviderId(manager, b);
    const rank = (provider) => (provider === "openrouter" ? 0 : 1);
    const rankDiff = rank(providerA) - rank(providerB);
    if (rankDiff !== 0) return rankDiff;
    return getLabel(a).localeCompare(getLabel(b));
  };
  favModels.sort(sortByLabel);

  dropdown.replaceChildren();

  const closeHeader = document.createElement("div");
  const padding = manager.config.containerType === "sidebar" ? "12px" : "16px";
  const fontSize = manager.config.containerType === "sidebar" ? "13px" : "14px";
  const closeSize = manager.config.containerType === "sidebar" ? "24px" : "28px";

  closeHeader.style.cssText = `padding: ${padding}; background: var(--color-bg); border-bottom: 1px solid var(--color-primary); position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center;`;
  const title = document.createElement("span");
  title.textContent = "Select Model";
  title.style.cssText = `font-size: ${fontSize}; font-weight: 600; color: var(--color-text);`;
  const closeButton = document.createElement("button");
  closeButton.id = "model-dropdown-close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.style.cssText = `background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: ${parseInt(closeSize) + 6}px; padding: 0; width: ${closeSize}; height: ${closeSize}; display: flex; align-items: center; justify-content: center;`;
  closeHeader.appendChild(title);
  closeHeader.appendChild(closeButton);
  dropdown.appendChild(closeHeader);

  closeButton.addEventListener("click", (e) => {
    e.stopPropagation();
    manager.hide();
    if (manager.config.inputElement) {
      manager.config.inputElement.blur();
    }
  });

  if (favModels.length > 0) {
    renderSection(manager, dropdown, "★ Favorites", favModels, "var(--color-topic-3)", true);
  }

  if (recentModels.length > 0 && !manager.state.filterTerm) {
    if (favModels.length > 0) {
      renderSeparator(dropdown);
    }
    renderSection(manager, dropdown, "🕒 Recently Used", recentModels, "var(--color-topic-5)", false);
  }

  if (nonFavModels.length > 0) {
    if (favModels.length > 0 || recentModels.length > 0) {
      renderSeparator(dropdown);
    }

    const allHeader = document.createElement("div");
    const headerPadding = manager.config.containerType === "sidebar" ? "8px 12px" : "12px 16px";
    const headerFontSize = manager.config.containerType === "sidebar" ? "11px" : "12px";

    allHeader.textContent = manager.state.filterTerm
      ? `All Models (${filteredModels.length}/${manager.state.allModels.length})`
      : "All Models";
    allHeader.style.cssText = `padding: ${headerPadding}; font-size: ${headerFontSize}; color: var(--color-text-muted); font-weight: 600; background: var(--color-bg); position: sticky; top: 0;`;
    dropdown.appendChild(allHeader);

    const grouped = {};
    nonFavModels.forEach((model) => {
      const label = getVendorLabelForModel(manager, model);
      if (!grouped[label]) {
        grouped[label] = [];
      }
      grouped[label].push(model);
    });

    const providerLabels = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    providerLabels.forEach((label) => {
      const models = grouped[label].sort(sortByBaseAndProvider);
      renderProviderGroup(manager, dropdown, label, models);
    });
  }

  if (filteredModels.length === 0) {
    const noResults = document.createElement("div");
    noResults.textContent = `No models match "${manager.state.filterTerm}"`;
    noResults.style.cssText = `padding: ${manager.config.containerType === "sidebar" ? "12px" : "24px"}; font-size: ${manager.config.containerType === "sidebar" ? "12px" : "14px"}; color: var(--color-text-muted); text-align: center;`;
    dropdown.appendChild(noResults);
  }
}

function renderSection(manager, dropdown, title, models, color, isFavorite) {
  const header = document.createElement("div");
  const padding = manager.config.containerType === "sidebar" ? "8px 12px" : "12px 16px";
  const fontSize = manager.config.containerType === "sidebar" ? "11px" : "12px";

  header.textContent = title;
  header.style.cssText = `padding: ${padding}; font-size: ${fontSize}; color: ${color}; font-weight: 600; background: var(--color-bg); position: sticky; top: 0;`;
  dropdown.appendChild(header);

  models.forEach((model) => {
    const item = createModelItem(manager, model, color, isFavorite ? "★" : "☆");
    dropdown.appendChild(item);
  });
}

function renderProviderGroup(manager, dropdown, provider, models) {
  const providerHeader = document.createElement("div");
  providerHeader.className = "model-dropdown-provider";
  const padding = manager.config.containerType === "sidebar" ? "8px 12px 4px 12px" : "10px 16px 6px 16px";
  const fontSize = manager.config.containerType === "sidebar" ? "11px" : "12px";

  providerHeader.textContent = provider;
  providerHeader.style.cssText = `padding: ${padding}; font-size: ${fontSize}; color: var(--color-text-muted); font-weight: 600; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); margin-top: 4px;`;
  dropdown.appendChild(providerHeader);

  models.forEach((model) => {
    const item = createModelItem(manager, model, "var(--color-text)", "☆", true);
    dropdown.appendChild(item);
  });
}

function createModelItem(manager, model, color, starType, isIndented = false) {
  const item = document.createElement("div");
  item.dataset.modelId = model.id;
  item.className = "model-dropdown-item";

  const padding = manager.config.containerType === "sidebar" ? "10px 12px" : "12px 16px";
  const leftPadding = isIndented
    ? (manager.config.containerType === "sidebar" ? "24px" : "32px")
    : padding.split(" ")[1];
  const fontSize = manager.config.containerType === "sidebar" ? "13px" : "14px";

  item.style.cssText = `padding: ${padding.split(" ")[0]} ${padding.split(" ")[1]} ${padding.split(" ")[0]} ${leftPadding}; cursor: pointer; font-size: ${fontSize}; color: ${color}; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;`;

  const modelName = document.createElement("span");
  modelName.textContent = getModelLabel(manager, model);
  modelName.style.cssText = "flex: 1;";

  const badgeInfo = getProviderBadge(manager, model);
  const badge = document.createElement("span");
  badge.className = "model-provider-badge";
  badge.textContent = badgeInfo.label;
  badge.style.cssText = `display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; padding: 2px 6px; border-radius: 999px; background: ${badgeInfo.background}; color: ${badgeInfo.color}; text-transform: uppercase;`;

  const starIcon = document.createElement("span");
  starIcon.textContent = starType;
  starIcon.className = "model-star-icon";
  starIcon.style.cssText = `color: ${starType === "★" ? "var(--color-topic-3)" : "var(--color-text-muted)"}; font-size: 16px; padding: 0 8px; cursor: pointer; ${starType === "☆" ? "opacity: 0; transition: opacity 0.2s;" : ""}`;
  starIcon.title = starType === "★" ? "Remove from favorites" : "Add to favorites";

  const rightControls = document.createElement("span");
  rightControls.style.cssText = "display: inline-flex; align-items: center; gap: 6px;";
  rightControls.appendChild(badge);
  rightControls.appendChild(starIcon);

  item.appendChild(modelName);
  item.appendChild(rightControls);

  return item;
}

function renderSeparator(dropdown) {
  const sep = document.createElement("div");
  sep.style.cssText = "height: 2px; background: var(--color-primary); margin: 0;";
  dropdown.appendChild(sep);
}

const modelsDropdownRenderUtils = {
  getModelLabel,
  getModelVendorId,
  inferVendorFromModelName,
  getVendorLabelForModel,
  getModelBaseNameForSort,
  getModelProviderId,
  getProviderBadge,
  render,
  renderSection,
  renderProviderGroup,
  createModelItem,
  renderSeparator
};

if (typeof window !== "undefined") {
  window.modelsDropdownRenderUtils = modelsDropdownRenderUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.modelsDropdownRenderUtils = modelsDropdownRenderUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = modelsDropdownRenderUtils;
}
