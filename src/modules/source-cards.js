// source-cards.js - Hover cards for source chips

let activeCard = null;
let hideTimeout = null;

function buildDomainBadgeDataUrl(value) {
  const raw = String(value || '').trim().replace(/^www\./i, '');
  const initialCandidate = (raw.charAt(0) || '?').toUpperCase();
  const initial = /[A-Z0-9]/.test(initialCandidate) ? initialCandidate : '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#27272a"/><text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#f4f4f5">${initial}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}


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

  const header = document.createElement('div');
  header.className = 'source-card-header';

  const favicon = document.createElement('img');
  favicon.className = 'source-card-favicon';
  const label = source?.domain || source?.title || source?.url || 'Source';
  favicon.src = buildDomainBadgeDataUrl(label);
  favicon.alt = String(label);

  const domain = document.createElement('div');
  domain.className = 'source-card-domain';
  domain.textContent = String(label);

  header.appendChild(favicon);
  header.appendChild(domain);

  const title = document.createElement('div');
  title.className = 'source-card-title';
  title.textContent = String(source?.title || source?.url || 'Untitled source');

  const url = document.createElement('div');
  url.className = 'source-card-url';
  url.textContent = String(source?.url || '');

  card.appendChild(header);
  card.appendChild(title);
  card.appendChild(url);
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


if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildCard,
    getSourceForChip,
    positionCard,
    clamp
  };
}
