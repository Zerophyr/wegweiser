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

const bindVisibilityToggles = (root = null) => {
  const scope = root && typeof root.querySelectorAll === "function"
    ? root
    : (typeof document !== "undefined" ? document : null);
  if (!scope) return 0;

  const buttons = scope.querySelectorAll("[data-toggle-target]");
  let initialized = 0;
  buttons.forEach((button) => {
    const targetId = button.getAttribute("data-toggle-target");
    if (!targetId) return;

    const input = typeof scope.getElementById === "function"
      ? scope.getElementById(targetId)
      : document.getElementById(targetId);
    const iconOn = button.querySelector(".icon-on, .key-toggle-icon--on");
    const iconOff = button.querySelector(".icon-off, .key-toggle-icon--off");
    const label = button.getAttribute("data-toggle-label") || "key";

    if (initVisibilityToggle({ input, button, iconOn, iconOff, label })) {
      initialized += 1;
    }
  });

  return initialized;
};

if (typeof module !== "undefined") {
  module.exports = { initVisibilityToggle, bindVisibilityToggles };
}

const root = typeof globalThis !== "undefined" ? globalThis : null;
if (root) {
  root.initVisibilityToggle = initVisibilityToggle;
  root.bindVisibilityToggles = bindVisibilityToggles;
}
