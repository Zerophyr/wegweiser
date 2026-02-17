// projects-image-utils.js - Image helpers for Projects UI

function downloadImage(dataUrl, imageId, mimeType, getImageExtensionFn) {
  if (!dataUrl) return;
  const getExt = typeof getImageExtensionFn === "function"
    ? getImageExtensionFn
    : () => "png";
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `wegweiser-image-${imageId}.${getExt(mimeType)}`;
  link.click();
}

function openImageLightbox(dataUrl, imageId, mimeType, deps = {}) {
  if (!dataUrl) return;
  const onDownload = deps.downloadImage || downloadImage;
  const overlay = document.createElement("div");
  overlay.className = "image-lightbox";

  const content = document.createElement("div");
  content.className = "image-lightbox-content";

  const toolbar = document.createElement("div");
  toolbar.className = "image-lightbox-toolbar";

  const downloadBtn = document.createElement("button");
  downloadBtn.type = "button";
  downloadBtn.className = "btn btn-secondary";
  downloadBtn.textContent = "Download";
  downloadBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onDownload(dataUrl, imageId, mimeType);
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn btn-secondary";
  closeBtn.textContent = "Close";

  toolbar.appendChild(downloadBtn);
  toolbar.appendChild(closeBtn);

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Generated image";

  content.appendChild(toolbar);
  content.appendChild(img);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", handleKey);
  };

  const handleKey = (e) => {
    if (e.key === "Escape") {
      close();
    }
  };

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", handleKey);
}

async function hydrateImageCards(root, deps = {}) {
  const buildCard = deps.buildImageCard || (typeof buildImageCard === "function" ? buildImageCard : null);
  const getCacheEntry = deps.getImageCacheEntry || (typeof getImageCacheEntry === "function" ? getImageCacheEntry : null);
  const openLightbox = deps.openImageLightbox || openImageLightbox;
  const onDownload = deps.downloadImage || downloadImage;

  if (!buildCard || !getCacheEntry) return;

  const scope = root || document;
  const messages = scope.querySelectorAll(".image-message");
  for (const message of messages) {
    const imageId = message.getAttribute("data-image-id");
    const contentEl = message.querySelector(".chat-content");
    if (!imageId || !contentEl) continue;

    const entry = await getCacheEntry(imageId);
    const dataUrl = entry?.dataUrl || entry?.data || "";
    const mimeType = entry?.mimeType || "image/png";

    let card;
    if (dataUrl) {
      card = buildCard({
        state: "ready",
        imageUrl: dataUrl,
        mode: "Projects",
        onView: () => openLightbox(dataUrl, imageId, mimeType, deps),
        onDownload: () => onDownload(dataUrl, imageId, mimeType)
      });
      const thumb = card.querySelector(".image-card-thumb");
      if (thumb) {
        thumb.addEventListener("click", () => openLightbox(dataUrl, imageId, mimeType, deps));
      }
    } else {
      card = buildCard({ state: "expired" });
    }

    contentEl.replaceChildren();
    contentEl.appendChild(card);
  }
}

const projectsImageUtils = {
  downloadImage,
  openImageLightbox,
  hydrateImageCards
};

if (typeof window !== "undefined") {
  window.projectsImageUtils = projectsImageUtils;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = projectsImageUtils;
}
