function setStreamingUi({ container, input, stopButton, isStreaming }) {
  if (!container || !input || !stopButton) return;
  const streaming = Boolean(isStreaming);
  if (!streaming && typeof document !== "undefined" && document.activeElement === stopButton) {
    if (typeof input.focus === "function") {
      input.focus();
    } else if (typeof stopButton.blur === "function") {
      stopButton.blur();
    }
  }
  container.classList.toggle('is-streaming', streaming);
  input.disabled = streaming;
  stopButton.style.display = streaming ? 'inline-flex' : 'none';
  stopButton.setAttribute('aria-hidden', streaming ? 'false' : 'true');
}

if (typeof module !== "undefined") {
  module.exports = { setStreamingUi };
}
