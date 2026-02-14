// image-cards.js - shared image card rendering

function buildImageCard(options = {}) {
  const { state, imageUrl, expiresAt, mode, onView, onDownload, onRetry } = options;
  const wrapper = document.createElement("div");
  wrapper.className = `image-card image-card-${state || "ready"}`;
  wrapper.setAttribute("data-state", state || "ready");

  const title = document.createElement("div");
  title.className = "image-card-title";
  title.textContent = "Image";

  const body = document.createElement("div");
  body.className = "image-card-body";

  if (state === "generating") {
    const spinner = document.createElement("div");
    spinner.className = "image-card-spinner";
    spinner.setAttribute("aria-label", "Generating image");
    body.appendChild(spinner);

    const status = document.createElement("div");
    status.className = "image-card-status";
    status.textContent = "Generating image...";
    body.appendChild(status);

    const hint = document.createElement("div");
    hint.className = "image-card-hint";
    hint.textContent = "Expires in ~3 hours";
    body.appendChild(hint);
  } else if (state === "expired") {
    const status = document.createElement("div");
    status.className = "image-card-status";
    status.textContent = "Image expired";
    body.appendChild(status);
  } else if (state === "error") {
    const status = document.createElement("div");
    status.className = "image-card-status";
    status.textContent = "Image failed to generate";
    body.appendChild(status);
  } else {
    const img = document.createElement("img");
    img.className = "image-card-thumb";
    img.alt = "Generated image";
    if (imageUrl) {
      img.src = imageUrl;
    }
    body.appendChild(img);

    const hint = document.createElement("div");
    hint.className = "image-card-hint";
    hint.textContent = "Expires in ~3 hours";
    body.appendChild(hint);

    const disclaimer = document.createElement("div");
    disclaimer.className = "image-card-disclaimer";
    const disclaimerIcon = document.createElement("span");
    disclaimerIcon.className = "image-card-disclaimer-icon";
    disclaimerIcon.textContent = "!";
    const disclaimerText = document.createElement("span");
    disclaimerText.textContent = "AUTO-DELETE IN 3 HOURS — Download now to keep it.";
    disclaimer.appendChild(disclaimerIcon);
    disclaimer.appendChild(disclaimerText);
    body.appendChild(disclaimer);
  }

  const actions = document.createElement("div");
  actions.className = "image-card-actions";

  if (state === "ready") {
    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "image-view-btn";
    viewBtn.textContent = mode === "sidepanel" ? "Open" : "View";
    viewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof onView === "function") {
        onView();
      }
    });

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "image-download-btn";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof onDownload === "function") {
        onDownload();
      }
    });

    actions.appendChild(viewBtn);
    actions.appendChild(downloadBtn);
  }

  if (state === "error") {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "image-retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof onRetry === "function") {
        onRetry();
      }
    });
    actions.appendChild(retryBtn);
  }

  wrapper.appendChild(title);
  wrapper.appendChild(body);
  if (actions.childNodes.length > 0) {
    wrapper.appendChild(actions);
  }

  return wrapper;
}

if (typeof window !== "undefined") {
  window.buildImageCard = buildImageCard;
}

if (typeof module !== "undefined") {
  module.exports = {
    buildImageCard
  };
}
