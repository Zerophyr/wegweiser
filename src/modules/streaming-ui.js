function setStreamingUi({ container, input, stopButton, isStreaming }) {
  if (!container || !input || !stopButton) return;
  const streaming = Boolean(isStreaming);
  container.classList.toggle('is-streaming', streaming);
  input.disabled = streaming;
  stopButton.style.display = streaming ? 'inline-flex' : 'none';
  stopButton.setAttribute('aria-hidden', streaming ? 'false' : 'true');
}

if (typeof module !== "undefined") {
  module.exports = { setStreamingUi };
}
