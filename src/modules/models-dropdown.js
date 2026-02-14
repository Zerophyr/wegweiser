// Shared model dropdown component with optimizations
// Features: Event delegation, keyboard navigation, recently used models, virtual rendering

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
      skipFocusOnDock: false
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

    // Click to toggle
    handlers.onInputClick = (e) => {
      e.stopPropagation();
      // Don't prevent default to allow normal input behavior
      if (!this.state.visible) {
        this.state.isOpening = true;
        this.state.justOpened = true;
        // Show all models (empty filter) when opening dropdown
        this.show('');
        // Select all text so user can start typing to filter
        input.select();
        // Keep justOpened flag longer to prevent immediate closing
        setTimeout(() => {
          this.state.isOpening = false;
          this.state.justOpened = false;
        }, 200);
      } else {
        // If already open, just select the text
        input.select();
      }
    };
    input.addEventListener('click', handlers.onInputClick);

    // Pointerdown opens dropdown (some environments suppress click)
    handlers.onInputPointerDown = (e) => {
      if (this.state.visible) return;
      this.state.isOpening = true;
      this.state.justOpened = true;
      this.show('');
      input.select();
      setTimeout(() => {
        this.state.isOpening = false;
        this.state.justOpened = false;
      }, 200);
    };
    input.addEventListener('pointerdown', handlers.onInputPointerDown);

    // Focus opens and selects all text
    handlers.onInputFocus = () => {
      if (this.state.justClosed) {
        this.state.justClosed = false;
        return;
      }
      if (!this.state.visible && !this.state.isOpening) {
        this.state.isOpening = true;
        this.state.justOpened = true;
        // Show all models (empty filter) when opening dropdown
        this.show('');
        // Select all text so user can start typing to filter
        input.select();
        // Keep justOpened flag longer to prevent immediate closing
        setTimeout(() => {
          this.state.isOpening = false;
          this.state.justOpened = false;
        }, 200);
      }
    };
    input.addEventListener('focus', handlers.onInputFocus);

    // Type to filter - now the input value is preserved and visible
    handlers.onInputInput = (e) => {
      if (this.state.ignoreNextInput) {
        this.state.ignoreNextInput = false;
        return;
      }
      // Open dropdown if not visible when user starts typing
      if (!this.state.visible) {
        this.state.visible = true;
        this.dropdownElement.style.display = 'block';
      }
      // Show filtered results based on what user typed
      this.show(e.target.value);
    };
    input.addEventListener('input', handlers.onInputInput);

    // Keyboard navigation
    handlers.onInputKeyDown = this.handleKeyDown.bind(this);
    input.addEventListener('keydown', handlers.onInputKeyDown);

    // Click outside to close
    handlers.onDocClick = (e) => {
      if (this.state.justOpened) return;
      setTimeout(() => {
        const inputWrapper = input.closest('#model-input-wrapper') || input.parentElement;
        if (this.state.visible &&
            !inputWrapper.contains(e.target) &&
            !this.dropdownElement.contains(e.target)) {
          this.hide();
        }
      }, 0);
    };
    document.addEventListener('click', handlers.onDocClick);

    // Support closing when clicking outside input while dropdown is open
    handlers.onDocMouseDown = (e) => {
      if (!this.state.visible) return;
      if (this.state.isOpening || this.state.justOpened) return;
      const insideDropdown = this.dropdownElement && this.dropdownElement.contains(e.target);
      this.state.pointerDownInDropdown = Boolean(insideDropdown);
      if (input.contains(e.target)) return;
      if (insideDropdown) return;
      this.hide();
    };
    document.addEventListener('mousedown', handlers.onDocMouseDown);

    handlers.onDocMouseUp = () => {
      this.state.pointerDownInDropdown = false;
    };
    document.addEventListener('mouseup', handlers.onDocMouseUp);

    handlers.onInputBlur = () => {
      window.requestAnimationFrame(() => {
        if (!this.state.visible) return;
        if (this.state.justOpened || this.state.isOpening) return;
        if (this.state.pointerDownInDropdown) return;
        if (this.dropdownElement.contains(document.activeElement)) return;
        this.hide();
      });
    };
    input.addEventListener('blur', handlers.onInputBlur);

    this.handlers = handlers;
  }

  detachInputListeners() {
    if (!this.handlers || !this.config.inputElement) return;
    const input = this.config.inputElement;
    input.removeEventListener('click', this.handlers.onInputClick);
    input.removeEventListener('pointerdown', this.handlers.onInputPointerDown);
    input.removeEventListener('focus', this.handlers.onInputFocus);
    input.removeEventListener('input', this.handlers.onInputInput);
    input.removeEventListener('keydown', this.handlers.onInputKeyDown);
    input.removeEventListener('blur', this.handlers.onInputBlur);
    document.removeEventListener('click', this.handlers.onDocClick);
    document.removeEventListener('mousedown', this.handlers.onDocMouseDown);
    document.removeEventListener('mouseup', this.handlers.onDocMouseUp);
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

  getModelLabel(model) {
    if (!model) return '';
    return model.displayName || model.name || model.id || '';
  }

  getModelVendorId(model) {
    if (!model) return '';
    let source = '';
    if (typeof model.rawId === 'string' && model.rawId.trim().length) {
      source = model.rawId;
    } else if (typeof model.id === 'string') {
      const splitIndex = model.id.indexOf(':');
      source = splitIndex !== -1 ? model.id.slice(splitIndex + 1) : model.id;
    }
    if (source.includes('/')) {
      const match = source.match(/^([^/]+)/);
      return match ? match[1].toLowerCase() : '';
    }

    const inferred = this.inferVendorFromModelName(source.toLowerCase());
    return inferred || '';
  }

  inferVendorFromModelName(name) {
    if (!name) return '';
    const startsWith = (prefix) => name.startsWith(prefix);

    if (startsWith('gpt-') || startsWith('gptimage') || startsWith('gpt-image') || startsWith('o1') || startsWith('o3') || startsWith('o4') || startsWith('dall-e')) {
      return 'openai';
    }
    if (startsWith('claude')) return 'anthropic';
    if (startsWith('gemini')) return 'google';
    if (startsWith('llama')) return 'meta';
    if (startsWith('mistral') || startsWith('mixtral')) return 'mistral';
    if (startsWith('qwen')) return 'qwen';
    if (startsWith('deepseek')) return 'deepseek';
    if (startsWith('grok')) return 'xai';
    if (startsWith('command')) return 'cohere';
    if (startsWith('jamba')) return 'ai21';
    if (startsWith('phi')) return 'microsoft';
    return '';
  }

  getVendorLabelForModel(model) {
    if (model?.vendorLabel && typeof model.vendorLabel === 'string') {
      const label = model.vendorLabel.trim();
      if (label.length) return label;
    }
    const vendorId = this.getModelVendorId(model);
    if (!vendorId) return 'Other';
    if (vendorId === 'openai') return 'OpenAI';
    if (vendorId === 'xai') return 'xAI';
    if (vendorId === 'qwen') return 'Qwen';
    return vendorId.charAt(0).toUpperCase() + vendorId.slice(1);
  }

  getModelBaseNameForSort(model) {
    if (!model) return '';
    let source = '';
    if (typeof model.rawId === 'string' && model.rawId.trim().length) {
      source = model.rawId;
    } else if (typeof model.id === 'string') {
      const splitIndex = model.id.indexOf(':');
      source = splitIndex !== -1 ? model.id.slice(splitIndex + 1) : model.id;
    }
    const lastSlash = source.lastIndexOf('/');
    const lastColon = source.lastIndexOf(':');
    const cutIndex = Math.max(lastSlash, lastColon);
    const base = cutIndex >= 0 ? source.slice(cutIndex + 1) : source;
    return base.toLowerCase();
  }

  getModelProviderId(model) {
    if (model?.provider) return model.provider;
    if (typeof model?.id === 'string') {
      const splitIndex = model.id.indexOf(':');
      if (splitIndex !== -1) {
        return model.id.slice(0, splitIndex);
      }
    }
    return '';
  }

  getProviderBadge(model) {
    const provider = this.getModelProviderId(model);
    if (provider === 'openrouter') {
      return { label: 'OR', background: '#1d4ed8', color: 'var(--color-text)' };
    }
    return { label: '?', background: 'var(--color-border-hover)', color: 'var(--color-text)' };
  }

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

  handleDropdownClick(e) {
    const target = e.target;
    const item = target?.closest ? target.closest('.model-dropdown-item') : null;
    const starIcon = target?.closest ? target.closest('.model-star-icon') : null;
    const closeBtn = target?.closest ? target.closest('#model-dropdown-close') : null;

    this.debugLog('click', {
      targetTag: target?.tagName || null,
      itemFound: Boolean(item),
      modelId: item?.dataset?.modelId || null,
      star: Boolean(starIcon),
      close: Boolean(closeBtn)
    });

    if (closeBtn) {
      e.stopPropagation();
      this.hide();
    } else if (starIcon && item) {
      e.stopPropagation();
      this.toggleFavorite(item.dataset.modelId);
    } else if (item) {
      this.selectModel(item.dataset.modelId);
    }
  }

  handleDropdownHover(e) {
    const item = e.target.closest('.model-dropdown-item');
    if (!item) return;

    const starIcon = item.querySelector('.model-star-icon');
    if (starIcon && starIcon.textContent === '☆') {
      starIcon.style.opacity = '1';
    }

    // Clear all backgrounds
    this.dropdownElement.querySelectorAll('.model-dropdown-item').forEach(i => {
      i.style.background = '';
    });
    item.style.background = 'var(--color-border)';
  }

  handleDropdownLeave(e) {
    const item = e.target.closest('.model-dropdown-item');
    if (!item) return;

    item.style.background = '';
    const starIcon = item.querySelector('.model-star-icon');
    if (starIcon && starIcon.textContent === '☆') {
      starIcon.style.opacity = '0';
    }
  }

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
      // Save to storage
      await chrome.storage.local.set({
        [this.config.recentModelsKey]: this.state.recentlyUsedModels
      });
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
        } else if (chrome?.storage?.local?.set) {
          await chrome.storage.local.set(payload);
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

  show(filterTerm = '') {
    this.state.justClosed = false;
    this.state.filterTerm = filterTerm;
    this.state.selectedIndex = -1;
    this.render();
    this.dropdownElement.style.display = 'block';
    this.state.visible = true;
    this.floatInput();
    this.focusInput();
  }

  hide() {
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

  render() {
    const dropdown = this.dropdownElement;
    const searchLower = this.state.filterTerm.toLowerCase();
    const getLabel = (model) => this.getModelLabel(model).toLowerCase();

    // Filter models
    const filteredModels = this.state.filterTerm
      ? this.state.allModels.filter(m => getLabel(m).includes(searchLower) || m.id.toLowerCase().includes(searchLower))
      : this.state.allModels;

    // Separate into categories
    const favModels = filteredModels.filter(m => this.state.favoriteModels.has(m.id));
    const recentList = Array.isArray(this.state.recentlyUsedModels)
      ? this.state.recentlyUsedModels
      : [];
    const recentModels = recentList
      .map(id => this.state.allModels.find(m => m.id === id))
      .filter(m => m && !this.state.favoriteModels.has(m.id) && filteredModels.includes(m));
    const nonFavModels = filteredModels.filter(m =>
      !this.state.favoriteModels.has(m.id) &&
      !recentList.includes(m.id)
    );

    // Sort
    const sortByLabel = (a, b) => getLabel(a).localeCompare(getLabel(b));
    const sortByBaseAndProvider = (a, b) => {
      const baseA = this.getModelBaseNameForSort(a);
      const baseB = this.getModelBaseNameForSort(b);
      if (baseA !== baseB) {
        return baseA.localeCompare(baseB);
      }
      const providerA = this.getModelProviderId(a);
      const providerB = this.getModelProviderId(b);
      const rank = (provider) => (provider === 'openrouter' ? 0 : 1);
      const rankDiff = rank(providerA) - rank(providerB);
      if (rankDiff !== 0) return rankDiff;
      return getLabel(a).localeCompare(getLabel(b));
    };
    favModels.sort(sortByLabel);

    // Build HTML
    dropdown.replaceChildren();

    // Close button header
    const closeHeader = document.createElement('div');
    const padding = this.config.containerType === 'sidebar' ? '12px' : '16px';
    const fontSize = this.config.containerType === 'sidebar' ? '13px' : '14px';
    const closeSize = this.config.containerType === 'sidebar' ? '24px' : '28px';

    closeHeader.style.cssText = `padding: ${padding}; background: var(--color-bg); border-bottom: 1px solid var(--color-primary); position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center;`;
    const title = document.createElement('span');
    title.textContent = 'Select Model';
    title.style.cssText = `font-size: ${fontSize}; font-weight: 600; color: var(--color-text);`;
    const closeButton = document.createElement('button');
    closeButton.id = 'model-dropdown-close';
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.style.cssText = `background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: ${parseInt(closeSize) + 6}px; padding: 0; width: ${closeSize}; height: ${closeSize}; display: flex; align-items: center; justify-content: center;`;
    closeHeader.appendChild(title);
    closeHeader.appendChild(closeButton);
    dropdown.appendChild(closeHeader);

    if (closeButton) {
      closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide();
        if (this.config.inputElement) {
          this.config.inputElement.blur();
        }
      });
    }

    // Favorites section
    if (favModels.length > 0) {
      this.renderSection(dropdown, '★ Favorites', favModels, 'var(--color-topic-3)', true);
    }

    // Recently used section
    if (recentModels.length > 0 && !this.state.filterTerm) {
      if (favModels.length > 0) {
        this.renderSeparator(dropdown);
      }
      this.renderSection(dropdown, '🕒 Recently Used', recentModels, 'var(--color-topic-5)', false);
    }

    // All models section
    if (nonFavModels.length > 0) {
      if (favModels.length > 0 || recentModels.length > 0) {
        this.renderSeparator(dropdown);
      }

      const allHeader = document.createElement('div');
      const headerPadding = this.config.containerType === 'sidebar' ? '8px 12px' : '12px 16px';
      const headerFontSize = this.config.containerType === 'sidebar' ? '11px' : '12px';

      allHeader.textContent = this.state.filterTerm ?
        `All Models (${filteredModels.length}/${this.state.allModels.length})` :
        'All Models';
      allHeader.style.cssText = `padding: ${headerPadding}; font-size: ${headerFontSize}; color: var(--color-text-muted); font-weight: 600; background: var(--color-bg); position: sticky; top: 0;`;
      dropdown.appendChild(allHeader);

      const grouped = {};
      nonFavModels.forEach((model) => {
        const label = this.getVendorLabelForModel(model);
        if (!grouped[label]) {
          grouped[label] = [];
        }
        grouped[label].push(model);
      });

      const providerLabels = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
      providerLabels.forEach((label) => {
        const models = grouped[label].sort(sortByBaseAndProvider);
        this.renderProviderGroup(dropdown, label, models);
      });
    }

    // No results
    if (filteredModels.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = `No models match "${this.state.filterTerm}"`;
      noResults.style.cssText = `padding: ${this.config.containerType === 'sidebar' ? '12px' : '24px'}; font-size: ${this.config.containerType === 'sidebar' ? '12px' : '14px'}; color: var(--color-text-muted); text-align: center;`;
      dropdown.appendChild(noResults);
    }
  }

  renderSection(dropdown, title, models, color, isFavorite) {
    const header = document.createElement('div');
    const padding = this.config.containerType === 'sidebar' ? '8px 12px' : '12px 16px';
    const fontSize = this.config.containerType === 'sidebar' ? '11px' : '12px';

    header.textContent = title;
    header.style.cssText = `padding: ${padding}; font-size: ${fontSize}; color: ${color}; font-weight: 600; background: var(--color-bg); position: sticky; top: 0;`;
    dropdown.appendChild(header);

    models.forEach(model => {
      const item = this.createModelItem(model, color, isFavorite ? '★' : '☆');
      dropdown.appendChild(item);
    });
  }

  renderProviderGroup(dropdown, provider, models) {
    const providerHeader = document.createElement('div');
    providerHeader.className = 'model-dropdown-provider';
    const padding = this.config.containerType === 'sidebar' ? '8px 12px 4px 12px' : '10px 16px 6px 16px';
    const fontSize = this.config.containerType === 'sidebar' ? '11px' : '12px';

    providerHeader.textContent = provider;
    providerHeader.style.cssText = `padding: ${padding}; font-size: ${fontSize}; color: var(--color-text-muted); font-weight: 600; background: var(--color-bg-secondary); border-bottom: 1px solid var(--color-border); margin-top: 4px;`;
    dropdown.appendChild(providerHeader);

    models.forEach(model => {
      const item = this.createModelItem(model, 'var(--color-text)', '☆', true);
      dropdown.appendChild(item);
    });
  }

  createModelItem(model, color, starType, isIndented = false) {
    const item = document.createElement('div');
    item.dataset.modelId = model.id;
    item.className = 'model-dropdown-item';

    const padding = this.config.containerType === 'sidebar' ? '10px 12px' : '12px 16px';
    const leftPadding = isIndented ?
      (this.config.containerType === 'sidebar' ? '24px' : '32px') :
      padding.split(' ')[1];
    const fontSize = this.config.containerType === 'sidebar' ? '13px' : '14px';

    item.style.cssText = `padding: ${padding.split(' ')[0]} ${padding.split(' ')[1]} ${padding.split(' ')[0]} ${leftPadding}; cursor: pointer; font-size: ${fontSize}; color: ${color}; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;`;

    const modelName = document.createElement('span');
    modelName.textContent = this.getModelLabel(model);
    modelName.style.cssText = 'flex: 1;';

    const badgeInfo = this.getProviderBadge(model);
    const badge = document.createElement('span');
    badge.className = 'model-provider-badge';
    badge.textContent = badgeInfo.label;
    badge.style.cssText = `display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; letter-spacing: 0.3px; padding: 2px 6px; border-radius: 999px; background: ${badgeInfo.background}; color: ${badgeInfo.color}; text-transform: uppercase;`;

    const starIcon = document.createElement('span');
    starIcon.textContent = starType;
    starIcon.className = 'model-star-icon';
    starIcon.style.cssText = `color: ${starType === '★' ? 'var(--color-topic-3)' : 'var(--color-text-muted)'}; font-size: 16px; padding: 0 8px; cursor: pointer; ${starType === '☆' ? 'opacity: 0; transition: opacity 0.2s;' : ''}`;
    starIcon.title = starType === '★' ? 'Remove from favorites' : 'Add to favorites';

    const rightControls = document.createElement('span');
    rightControls.style.cssText = 'display: inline-flex; align-items: center; gap: 6px;';
    rightControls.appendChild(badge);
    rightControls.appendChild(starIcon);

    item.appendChild(modelName);
    item.appendChild(rightControls);

    return item;
  }

  renderSeparator(dropdown) {
    const sep = document.createElement('div');
    sep.style.cssText = 'height: 2px; background: var(--color-primary); margin: 0;';
    dropdown.appendChild(sep);
  }

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
