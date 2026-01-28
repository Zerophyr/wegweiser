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
      justOpened: false
    };

    this.dropdownElement = null;
    this.init();
  }

  init() {
    this.createDropdownElement();
    this.attachEventListeners();
    this.loadRecentlyUsedModels();
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
        background: #18181b;
        border: 1px solid #3b82f6;
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
        background: #18181b;
        border: 1px solid #3b82f6;
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

    // Click to toggle
    input.addEventListener('click', (e) => {
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
    });

    // Focus opens and selects all text
    input.addEventListener('focus', (e) => {
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
    });

    // Type to filter - now the input value is preserved and visible
    input.addEventListener('input', (e) => {
      // Open dropdown if not visible when user starts typing
      if (!this.state.visible) {
        this.state.visible = true;
        this.dropdownElement.style.display = 'block';
      }
      // Show filtered results based on what user typed
      this.show(e.target.value);
    });

    // Keyboard navigation
    input.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.state.justOpened) return;
      setTimeout(() => {
        const inputWrapper = input.closest('#model-input-wrapper') || input.parentElement;
        if (this.state.visible &&
            !inputWrapper.contains(e.target) &&
            !this.dropdownElement.contains(e.target)) {
          this.hide();
        }
      }, 0);
    });
  }

  handleKeyDown(e) {
    if (!this.state.visible) return;

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

  highlightSelected() {
    const items = this.dropdownElement.querySelectorAll('.model-dropdown-item');
    items.forEach((item, index) => {
      if (index === this.state.selectedIndex) {
        item.style.background = '#27272a';
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.style.background = '';
      }
    });
  }

  handleDropdownClick(e) {
    const item = e.target.closest('.model-dropdown-item');
    const starIcon = e.target.closest('.model-star-icon');
    const closeBtn = e.target.closest('#model-dropdown-close');

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
    item.style.background = '#27272a';
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
      const success = await this.config.onModelSelect(modelId);
      if (success !== false) {
        // Add to recently used
        this.addToRecentlyUsed(modelId);
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
    } else {
      // Save to storage
      await chrome.storage.local.set({
        [this.config.recentModelsKey]: this.state.recentlyUsedModels
      });
    }
  }

  async loadRecentlyUsedModels() {
    const data = await chrome.storage.local.get([this.config.recentModelsKey]);
    this.state.recentlyUsedModels = data[this.config.recentModelsKey] || [];
  }

  setModels(models) {
    this.state.allModels = models;
  }

  setFavorites(favorites) {
    this.state.favoriteModels = new Set(favorites);
  }

  setRecentlyUsed(recentList) {
    this.state.recentlyUsedModels = Array.isArray(recentList) ? [...recentList] : [];
  }

  show(filterTerm = '') {
    this.state.filterTerm = filterTerm;
    this.state.selectedIndex = -1;
    this.render();
    this.dropdownElement.style.display = 'block';
    this.state.visible = true;
  }

  hide() {
    if (this.dropdownElement) {
      this.dropdownElement.style.display = 'none';
    }
    this.state.visible = false;
    this.state.selectedIndex = -1;
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
    const recentModels = this.state.recentlyUsedModels
      .map(id => this.state.allModels.find(m => m.id === id))
      .filter(m => m && !this.state.favoriteModels.has(m.id) && filteredModels.includes(m));
    const nonFavModels = filteredModels.filter(m =>
      !this.state.favoriteModels.has(m.id) &&
      !this.state.recentlyUsedModels.includes(m.id)
    );

    // Sort
    const sortByLabel = (a, b) => getLabel(a).localeCompare(getLabel(b));
    favModels.sort(sortByLabel);

    // Build HTML
    dropdown.innerHTML = '';

    // Close button header
    const closeHeader = document.createElement('div');
    const padding = this.config.containerType === 'sidebar' ? '12px' : '16px';
    const fontSize = this.config.containerType === 'sidebar' ? '13px' : '14px';
    const closeSize = this.config.containerType === 'sidebar' ? '24px' : '28px';

    closeHeader.style.cssText = `padding: ${padding}; background: #0f0f0f; border-bottom: 1px solid #3b82f6; position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center;`;
    closeHeader.innerHTML = `
      <span style="font-size: ${fontSize}; font-weight: 600; color: #e4e4e7;">Select Model</span>
      <button id="model-dropdown-close" style="background: none; border: none; color: #71717a; cursor: pointer; font-size: ${parseInt(closeSize) + 6}px; padding: 0; width: ${closeSize}; height: ${closeSize}; display: flex; align-items: center; justify-content: center;">×</button>
    `;
    dropdown.appendChild(closeHeader);

    // Favorites section
    if (favModels.length > 0) {
      this.renderSection(dropdown, '★ Favorites', favModels, '#fbbf24', true);
    }

    // Recently used section
    if (recentModels.length > 0 && !this.state.filterTerm) {
      if (favModels.length > 0) {
        this.renderSeparator(dropdown);
      }
      this.renderSection(dropdown, '🕒 Recently Used', recentModels, '#a78bfa', false);
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
      allHeader.style.cssText = `padding: ${headerPadding}; font-size: ${headerFontSize}; color: #71717a; font-weight: 600; background: #0f0f0f; position: sticky; top: 0;`;
      dropdown.appendChild(allHeader);

      const sortedModels = [...nonFavModels].sort(sortByLabel);
      sortedModels.forEach((model) => {
        const item = this.createModelItem(model, '#e4e4e7', '☆', true);
        dropdown.appendChild(item);
      });
    }

    // No results
    if (filteredModels.length === 0) {
      const noResults = document.createElement('div');
      noResults.textContent = `No models match "${this.state.filterTerm}"`;
      noResults.style.cssText = `padding: ${this.config.containerType === 'sidebar' ? '12px' : '24px'}; font-size: ${this.config.containerType === 'sidebar' ? '12px' : '14px'}; color: #71717a; text-align: center;`;
      dropdown.appendChild(noResults);
    }
  }

  renderSection(dropdown, title, models, color, isFavorite) {
    const header = document.createElement('div');
    const padding = this.config.containerType === 'sidebar' ? '8px 12px' : '12px 16px';
    const fontSize = this.config.containerType === 'sidebar' ? '11px' : '12px';

    header.textContent = title;
    header.style.cssText = `padding: ${padding}; font-size: ${fontSize}; color: ${color}; font-weight: 600; background: #0f0f0f; position: sticky; top: 0;`;
    dropdown.appendChild(header);

    models.forEach(model => {
      const item = this.createModelItem(model, color, isFavorite ? '★' : '☆');
      dropdown.appendChild(item);
    });
  }

  renderProviderGroup(dropdown, provider, models) {
    const providerHeader = document.createElement('div');
    const padding = this.config.containerType === 'sidebar' ? '8px 12px 4px 12px' : '10px 16px 6px 16px';
    const fontSize = this.config.containerType === 'sidebar' ? '11px' : '12px';

    providerHeader.textContent = provider;
    providerHeader.style.cssText = `padding: ${padding}; font-size: ${fontSize}; color: #a1a1aa; font-weight: 600; background: #18181b; border-bottom: 1px solid #27272a; margin-top: 4px;`;
    dropdown.appendChild(providerHeader);

    models.forEach(model => {
      const item = this.createModelItem(model, '#e4e4e7', '☆', true);
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

    item.style.cssText = `padding: ${padding.split(' ')[0]} ${padding.split(' ')[1]} ${padding.split(' ')[0]} ${leftPadding}; cursor: pointer; font-size: ${fontSize}; color: ${color}; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center;`;

    const modelName = document.createElement('span');
    modelName.textContent = this.getModelLabel(model);
    modelName.style.cssText = 'flex: 1;';

    const starIcon = document.createElement('span');
    starIcon.textContent = starType;
    starIcon.className = 'model-star-icon';
    starIcon.style.cssText = `color: ${starType === '★' ? '#fbbf24' : '#52525b'}; font-size: 16px; padding: 0 8px; cursor: pointer; ${starType === '☆' ? 'opacity: 0; transition: opacity 0.2s;' : ''}`;
    starIcon.title = starType === '★' ? 'Remove from favorites' : 'Add to favorites';

    item.appendChild(modelName);
    item.appendChild(starIcon);

    return item;
  }

  renderSeparator(dropdown) {
    const sep = document.createElement('div');
    sep.style.cssText = 'height: 2px; background: #3b82f6; margin: 0;';
    dropdown.appendChild(sep);
  }

  destroy() {
    if (this.dropdownElement) {
      this.dropdownElement.remove();
      this.dropdownElement = null;
    }
  }
}

if (typeof module !== "undefined") {
  module.exports = { ModelDropdownManager };
}
