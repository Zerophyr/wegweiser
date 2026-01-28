const initVisibilityToggle = ({ input, button, iconOn, iconOff, label }) => {
  if (!input || !button) {
    return false;
  }

  const safeLabel = typeof label === "string" && label.trim().length
    ? label.trim()
    : "key";
  const showLabel = `Show ${safeLabel}`;
  const hideLabel = `Hide ${safeLabel}`;

  const setState = (visible) => {
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", visible ? "true" : "false");
    button.setAttribute("aria-label", visible ? hideLabel : showLabel);
    if (iconOn && iconOff) {
      iconOn.toggleAttribute("hidden", !visible);
      iconOff.toggleAttribute("hidden", visible);
    }
  };

  setState(false);
  button.addEventListener("click", () => setState(input.type !== "text"));
  return true;
};

if (typeof module !== "undefined") {
  module.exports = { initVisibilityToggle };
}

const root = typeof globalThis !== "undefined" ? globalThis : null;
if (root) {
  root.initVisibilityToggle = initVisibilityToggle;
}
