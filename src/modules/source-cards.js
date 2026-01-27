// source-cards.js - Hover cards for source chips

let activeCard = null;
let hideTimeout = null;

function removeActiveCard() {
  if (activeCard) {
    activeCard.remove();
    activeCard = null;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function positionCard(card, target) {
  const rect = target.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const padding = 12;

  let top = rect.bottom + 8;
  let left = rect.left;

  if (top + cardRect.height + padding > window.innerHeight) {
    top = rect.top - cardRect.height - 8;
  }

  left = clamp(left, padding, window.innerWidth - cardRect.width - padding);
  top = clamp(top, padding, window.innerHeight - cardRect.height - padding);

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function getSourceForChip(chip) {
  const container = chip.closest('[data-sources]');
  if (!container) return null;
  try {
    const sources = JSON.parse(container.getAttribute('data-sources') || '[]');
    const sourceId = chip.getAttribute('data-source-id');
    return sources.find((source) => source.id === sourceId) || null;
  } catch (e) {
    return null;
  }
}

function buildCard(source) {
  const card = document.createElement('div');
  card.className = 'source-card';
  card.innerHTML = `
    <div class="source-card-header">
      <img class="source-card-favicon" src="https://www.google.com/s2/favicons?domain=${source.url}&sz=32" alt="${source.domain || source.title}">
      <div class="source-card-domain">${source.domain || source.title}</div>
    </div>
    <div class="source-card-title">${source.title}</div>
    <div class="source-card-url">${source.url}</div>
  `;
  return card;
}

function showSourceCard(chip) {
  const source = getSourceForChip(chip);
  if (!source) return;

  removeActiveCard();
  const card = buildCard(source);
  document.body.appendChild(card);
  activeCard = card;
  positionCard(card, chip);

  card.addEventListener('mouseenter', () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
  });

  card.addEventListener('mouseleave', () => {
    removeActiveCard();
  });
}

function scheduleHide() {
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    removeActiveCard();
  }, 200);
}

document.addEventListener('mouseover', (event) => {
  const chip = event.target.closest('.source-chip');
  if (!chip) return;
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  showSourceCard(chip);
});

document.addEventListener('mouseout', (event) => {
  const chip = event.target.closest('.source-chip');
  if (!chip) return;
  scheduleHide();
});
