function getImageExtension(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

function getImageIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("imageId") || "";
}

function setStatus(message) {
  const statusEl = document.getElementById("viewer-status");
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function showImage(dataUrl) {
  const img = document.getElementById("viewer-image");
  if (!img) return;
  img.src = dataUrl;
  img.style.display = "block";
}

async function initViewer() {
  const imageId = getImageIdFromQuery();
  const downloadBtn = document.getElementById("download-btn");

  if (!imageId) {
    setStatus("Image not found.");
    if (downloadBtn) downloadBtn.disabled = true;
    return;
  }

  if (typeof getImageCacheEntry !== "function") {
    setStatus("Image cache unavailable.");
    if (downloadBtn) downloadBtn.disabled = true;
    return;
  }

  const entry = await getImageCacheEntry(imageId);
  if (!entry || !entry.dataUrl) {
    setStatus("Image expired or unavailable.");
    if (downloadBtn) downloadBtn.disabled = true;
    return;
  }

  const dataUrl = entry.dataUrl || entry.data || "";
  const mimeType = entry.mimeType || "image/png";

  showImage(dataUrl);
  setStatus("");

  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `wegweiser-image-${imageId}.${getImageExtension(mimeType)}`;
      link.click();
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initViewer().catch((err) => {
    console.error("Image viewer error:", err);
    setStatus("Failed to load image.");
  });
});
