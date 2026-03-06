// Shared model dropdown component with optimizations
const modelsDropdownRenderModule = (typeof globalThis !== 'undefined' && globalThis.modelsDropdownRenderUtils)
  || (typeof module !== 'undefined' && module.exports ? require('./models-dropdown-render-utils.js') : null)
  || {};
const {
  getModelLabel: getModelLabelFromUtils = (_manager, model) => model?.displayName || model?.name || model?.id,
  getModelVendorId: getModelVendorIdFromUtils = () => 'Other',
  inferVendorFromModelName: inferVendorFromModelNameFromUtils = () => 'Other',
  getVendorLabelForModel: getVendorLabelForModelFromUtils = () => 'Other',
  getModelBaseNameForSort: getModelBaseNameForSortFromUtils = () => '',
  getModelProviderId: getModelProviderIdFromUtils = () => 'openrouter',
  getProviderBadge: getProviderBadgeFromUtils = () => ({ label: 'OR', background: 'var(--color-success, #10b981)', color: '#fff' }),
  render: renderFromUtils = () => {},
  renderSection: renderSectionFromUtils = () => {},
  renderProviderGroup: renderProviderGroupFromUtils = () => {},
  createModelItem: createModelItemFromUtils = () => document.createElement('div'),
  renderSeparator: renderSeparatorFromUtils = () => {}
} = modelsDropdownRenderModule;
const modelsDropdownEventsModule = (typeof globalThis !== 'undefined' && globalThis.modelsDropdownEventsUtils)
  || (typeof module !== 'undefined' && module.exports ? require('./models-dropdown-events-utils.js') : null)
  || {};
const {
  buildInputHandlers: buildInputHandlersFromUtils = () => ({}),
  attachInputListeners: attachInputListenersFromUtils = () => {},
  detachInputListeners: detachInputListenersFromUtils = () => {},
  handleDropdownClick: handleDropdownClickFromUtils = () => {},
  handleDropdownHover: handleDropdownHoverFromUtils = () => {},
  handleDropdownLeave: handleDropdownLeaveFromUtils = () => {}
} = modelsDropdownEventsModule;
class ModelDropdownManager {
  constructor(config) {
    this.config = {
      inputElement: config.inputElement,
      containerType: config.containerType || 'sidebar', // 'sidebar' or 'modal'
      onModelSelect: config.onModelSelect,
      favoritesKey: config.favoritesKey || 'or_favorites',
      recentModelsKey: config.recentModelsKey || 'or_recent_models',
      maxRecentModels: 5,
      clearInputOnType: config.clearInputOnType !== false,
      preferProvidedRecents: Boolean(config.preferProvidedRecents),
      ...config
    };
    this.state = {
      visible: false,
      allModels: [],
      favoriteModels: new Set(),
      recentlyUsedModels: [],
      filterTerm: '',
      selectedIndex: -1,
      isOpening: false,
      justOpened: false,
      justClosed: false,
      ignoreNextInput: false,
      clearOnTypeArmed: false,
      lastSelectedValue: '',
      pointerDownInDropdown: false,
      skipFocusOnDock: false,
      selectedDuringOpen: false
    };
    this.dropdownElement = null;
    this.handlers = null;
    this.init();
  }
  init() {
    this.createDropdownElement();
    this.attachEventListeners();
    if (!this.config.preferProvidedRecents) {
      this.loadRecentlyUsedModels();
    }
    this.inputParent = this.config.inputElement ? this.config.inputElement.parentElement : null;
    this.inputPlaceholder = null;
  }
  createDropdownElement() {
    if (this.dropdownElement) return this.dropdownElement;
    const dropdown = document.createElement('div');
    dropdown.className = 'model-dropdown';
    dropdown.id = `model-dropdown-${this.config.containerType}`;
    // Styling based on container type - directly set CSS properties
    if (this.config.containerType === 'sidebar') {
      dropdown.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 60vh;
        overflow-y: auto;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-primary);
        border-bottom: none;
        border-radius: 6px 6px 0 0;
        z-index: 1000;
        display: none;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
      `;
    } else {
      dropdown.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 600px;
        max-height: 70vh;
        overflow-y: auto;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-primary);
        border-radius: 8px;
        z-index: 1000;
        display: none;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
      `;
    }
    document.body.appendChild(dropdown);
    this.dropdownElement = dropdown;
    // Event delegation - single listener for all items
    dropdown.addEventListener('click', this.handleDropdownClick.bind(this));
    dropdown.addEventListener('mouseenter', this.handleDropdownHover.bind(this), true);
    dropdown.addEventListener('mouseleave', this.handleDropdownLeave.bind(this), true);
    return dropdown;
  }
  attachEventListeners() {
    const input = this.config.inputElement;
    if (!input) return;
    const handlers = buildInputHandlersFromUtils(this, input);
    attachInputListenersFromUtils(this, input, handlers);
    this.handlers = handlers;
  }
  detachInputListeners() {
    if (!this.handlers || !this.config.inputElement) return;
    detachInputListenersFromUtils(this.config.inputElement, this.handlers);
    this.handlers = null;
  }
  bindInput(inputElement) {
    if (!inputElement) return false;
    if (this.config.inputElement === inputElement) return true;
    this.detachInputListeners();
    this.config.inputElement = inputElement;
    this.inputParent = inputElement.parentElement || null;
    this.inputPlaceholder = null;
    this.attachEventListeners();
    return true;
  }
  isDebugEnabled() {
    if (this.config.debug) return true;
    const root = typeof globalThis !== 'undefined' ? globalThis : null;
    return Boolean(root && root.DEBUG_MODEL_DROPDOWN);
  }
  debugLog(...args) {
    if (!this.isDebugEnabled()) return;
    console.log('[ModelDropdown]', ...args);
  }
  floatInput() {
    const input = this.config.inputElement;
    if (!input || !this.dropdownElement || this.dropdownElement.contains(input)) return;
    if (!this.inputPlaceholder && input.parentElement) {
      this.inputPlaceholder = document.createComment('model-input-placeholder');
      input.parentElement.insertBefore(this.inputPlaceholder, input);
    }
    input.classList.add('model-input-floating');
    this.dropdownElement.insertBefore(input, this.dropdownElement.firstChild);
  }
  dockInput() {
    const input = this.config.inputElement;
    if (!input || !this.inputParent) return;
    if (!this.dropdownElement.contains(input)) return;
    input.classList.remove('model-input-floating');
    if (this.inputPlaceholder && this.inputPlaceholder.parentElement) {
      this.inputPlaceholder.parentElement.insertBefore(input, this.inputPlaceholder);
      this.inputPlaceholder.remove();
      this.inputPlaceholder = null;
    } else {
      this.inputParent.appendChild(input);
    }
    const shouldFocus = !this.state.skipFocusOnDock;
    this.state.skipFocusOnDock = false;
    if (shouldFocus) {
      this.focusInput();
    }
  }
  focusInput() {
    const input = this.config.inputElement;
    if (!input) return;
    const value = input.value || '';
    input.focus();
    input.setSelectionRange(value.length, value.length);
  }
  handleKeyDown(e) {
    if (!this.state.visible) return;
    const input = this.config.inputElement;
    if (input && this.state.clearOnTypeArmed && this.config.clearInputOnType) {
      const isPrintable = typeof e.key === 'string' && e.key.length === 1;
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
      if (isPrintable && !hasModifier && input.value === this.state.lastSelectedValue) {
        input.value = '';
        this.state.filterTerm = '';
        this.state.clearOnTypeArmed = false;
      }
    }
    const items = Array.from(this.dropdownElement.querySelectorAll('.model-dropdown-item'));
    switch (e.key) {
      case 'Escape':
        this.hide();
        this.config.inputElement.blur();
        e.preventDefault();
        break;
      case 'ArrowDown':
        // Only prevent default if we're navigating in the dropdown, not scrolling
        if (document.activeElement === this.config.inputElement) {
          this.state.selectedIndex = Math.min(this.state.selectedIndex + 1, items.length - 1);
          this.highlightSelected();
          e.preventDefault();
        }
        break;
      case 'ArrowUp':
        // Only prevent default if we're navigating in the dropdown, not scrolling
        if (document.activeElement === this.config.inputElement) {
          this.state.selectedIndex = Math.max(this.state.selectedIndex - 1, 0);
          this.highlightSelected();
          e.preventDefault();
        }
        break;
      case 'Enter':
        if (this.state.selectedIndex >= 0 && items[this.state.selectedIndex]) {
          const modelId = items[this.state.selectedIndex].dataset.modelId;
          this.selectModel(modelId);
        } else if (this.config.inputElement.value) {
          // Try to find exact or first match
          const searchValue = this.config.inputElement.value;
          const searchLower = searchValue.toLowerCase();
          const exactMatch = this.state.allModels.find(m =>
            this.getModelLabel(m).toLowerCase() === searchLower || m.id.toLowerCase() === searchLower
          );
          if (exactMatch) {
            this.selectModel(exactMatch.id);
          } else {
            const firstMatch = this.state.allModels.find(m =>
              this.getModelLabel(m).toLowerCase().includes(searchLower) || m.id.toLowerCase().includes(searchLower)
            );
            if (firstMatch) {
              this.selectModel(firstMatch.id);
            }
          }
        }
        e.preventDefault();
        break;
    }
  }
  getModelLabel(model) { return getModelLabelFromUtils(this, model); }
  getModelVendorId(model) { return getModelVendorIdFromUtils(this, model); }
  inferVendorFromModelName(name) { return inferVendorFromModelNameFromUtils(this, name); }
  getVendorLabelForModel(model) { return getVendorLabelForModelFromUtils(this, model); }
  getModelBaseNameForSort(model) { return getModelBaseNameForSortFromUtils(this, model); }
  getModelProviderId(model) { return getModelProviderIdFromUtils(this, model); }
  getProviderBadge(model) { return getProviderBadgeFromUtils(this, model); }
  highlightSelected() {
    const items = this.dropdownElement.querySelectorAll('.model-dropdown-item');
    items.forEach((item, index) => {
      if (index === this.state.selectedIndex) {
        item.style.background = 'var(--color-border)';
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.style.background = '';
      }
    });
  }
  handleDropdownClick(e) { return handleDropdownClickFromUtils(this, e); }
  handleDropdownHover(e) { return handleDropdownHoverFromUtils(this, e); }
  handleDropdownLeave(e) { return handleDropdownLeaveFromUtils(this, e); }
  async toggleFavorite(modelId) {
    if (this.state.favoriteModels.has(modelId)) {
      this.state.favoriteModels.delete(modelId);
    } else {
      this.state.favoriteModels.add(modelId);
    }
    const isFavorite = this.state.favoriteModels.has(modelId);
    if (typeof this.config.onToggleFavorite === 'function') {
      await this.config.onToggleFavorite(modelId, isFavorite);
    } else {
      // Save to storage
      await chrome.storage.sync.set({
        [this.config.favoritesKey]: Array.from(this.state.favoriteModels)
      });
    }
    // Refresh dropdown
    this.show(this.state.filterTerm);
  }
  async selectModel(modelId) {
    // Call user's callback with await to ensure completion
    if (this.config.onModelSelect) {
      this.debugLog('selectModel:start', { modelId });
      this.state.ignoreNextInput = true;
      let success = false;
      try {
        success = await this.config.onModelSelect(modelId);
      } finally {
        this.state.ignoreNextInput = false;
      }
      this.debugLog('selectModel:result', { modelId, success });
      if (success !== false) {
        this.state.selectedDuringOpen = true;
        // Add to recently used
        this.addToRecentlyUsed(modelId);
        if (this.config.inputElement) {
          this.state.lastSelectedValue = this.config.inputElement.value || '';
          this.state.clearOnTypeArmed = true;
          this.state.skipFocusOnDock = true;
          this.config.inputElement.blur();
        }
        this.hide();
      }
    }
  }
  async addToRecentlyUsed(modelId) {
    // Remove if already exists
    this.state.recentlyUsedModels = this.state.recentlyUsedModels.filter(id => id !== modelId);
    // Add to front
    this.state.recentlyUsedModels.unshift(modelId);
    // Keep only max items
    this.state.recentlyUsedModels = this.state.recentlyUsedModels.slice(0, this.config.maxRecentModels);
    if (typeof this.config.onAddRecent === 'function') {
      await this.config.onAddRecent(modelId, [...this.state.recentlyUsedModels]);
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.setEncrypted === 'function') {
      await globalThis.setEncrypted({
        [this.config.recentModelsKey]: this.state.recentlyUsedModels
      });
    } else {
      console.warn('[ModelDropdown] setEncrypted unavailable; skipping recent model persistence for encrypted key', this.config.recentModelsKey);
    }
  }
  async loadRecentlyUsedModels() {
    if (this.config.preferProvidedRecents && Array.isArray(this.state.recentlyUsedModels) && this.state.recentlyUsedModels.length > 0) {
      return;
    }
    let data = {};
    let usedEncrypted = false;
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.getEncrypted === 'function') {
        usedEncrypted = true;
        data = await globalThis.getEncrypted([this.config.recentModelsKey]);
      } else {
        data = await chrome.storage.local.get([this.config.recentModelsKey]);
      }
    } catch (e) {
      data = {};
    }
    const recentValue = data[this.config.recentModelsKey];
    if (!Array.isArray(recentValue) && recentValue !== undefined) {
      this.setRecentlyUsed([]);
      const payload = { [this.config.recentModelsKey]: [] };
      try {
        if (usedEncrypted && typeof globalThis !== 'undefined' && typeof globalThis.setEncrypted === 'function') {
          await globalThis.setEncrypted(payload);
        } else {
          console.warn('[ModelDropdown] setEncrypted unavailable; skipping recent model normalization write for encrypted key', this.config.recentModelsKey);
        }
      } catch (e) {
        // ignore persistence errors
      }
      return;
    }
    this.setRecentlyUsed(recentValue);
    if (this.state.visible) {
      this.render();
    }
  }
  setModels(models) {
    this.state.allModels = models;
  }
  setFavorites(favorites) {
    this.state.favoriteModels = new Set(favorites);
  }
  setRecentlyUsed(recentList) {
    if (!Array.isArray(recentList)) {
      this.state.recentlyUsedModels = [];
      return;
    }
    const max = Number.isFinite(this.config.maxRecentModels) ? this.config.maxRecentModels : 5;
    this.state.recentlyUsedModels = recentList.slice(0, Math.max(0, max));
  }
  show(filterTerm = '', options = {}) {
    const captureSelectionValue = options.captureSelectionValue !== false;
    this.state.justClosed = false;
    if (!this.state.visible) {
      this.state.selectedDuringOpen = false;
      if (captureSelectionValue && this.config.inputElement) {
        this.state.lastSelectedValue = this.config.inputElement.value || this.state.lastSelectedValue || '';
      }
      this.state.clearOnTypeArmed = Boolean(
        this.config.clearInputOnType &&
        this.config.inputElement &&
        this.state.lastSelectedValue &&
        this.config.inputElement.value === this.state.lastSelectedValue
      );
    }
    this.state.filterTerm = filterTerm;
    this.state.selectedIndex = -1;
    this.render();
    this.dropdownElement.style.display = 'block';
    this.state.visible = true;
    this.floatInput();
    this.focusInput();
  }
  hide() {
    if (this.config.inputElement && !this.state.selectedDuringOpen) {
      const restoreValue = this.state.lastSelectedValue || '';
      if (this.config.inputElement.value !== restoreValue) {
        this.state.ignoreNextInput = true;
        this.config.inputElement.value = restoreValue;
      }
    }
    if (this.dropdownElement) {
      this.dropdownElement.style.display = 'none';
    }
    this.state.visible = false;
    this.state.selectedIndex = -1;
    this.state.pointerDownInDropdown = false;
    this.state.justClosed = true;
    this.dockInput();
    setTimeout(() => {
      this.state.justClosed = false;
    }, 200);
  }
  render() { return renderFromUtils(this); }
  renderSection(dropdown, title, models, color, isFavorite) { return renderSectionFromUtils(this, dropdown, title, models, color, isFavorite); }
  renderProviderGroup(dropdown, provider, models) { return renderProviderGroupFromUtils(this, dropdown, provider, models); }
  createModelItem(model, color, starType, isIndented = false) { return createModelItemFromUtils(this, model, color, starType, isIndented); }
  renderSeparator(dropdown) { return renderSeparatorFromUtils(dropdown); }
  destroy() {
    this.detachInputListeners();
    if (this.dropdownElement) {
      this.dropdownElement.remove();
      this.dropdownElement = null;
    }
  }
}
if (typeof module !== "undefined") {
  module.exports = { ModelDropdownManager };
}

