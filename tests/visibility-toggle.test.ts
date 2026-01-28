const {
  initVisibilityToggle,
  bindVisibilityToggles
} = require("../src/shared/visibility-toggle.js");

test("toggle switches input type and aria state", () => {
  document.body.innerHTML = `
    <div>
      <input id="apiKey" type="password" />
      <button id="toggle" aria-pressed="false">
        <span class="icon-on" hidden></span>
        <span class="icon-off"></span>
      </button>
    </div>
  `;

  const input = document.getElementById("apiKey");
  const button = document.getElementById("toggle");
  const iconOn = button?.querySelector(".icon-on");
  const iconOff = button?.querySelector(".icon-off");

  if (!input || !button || !iconOn || !iconOff) {
    throw new Error("Missing test elements");
  }

  const inputEl = input as HTMLInputElement;

  initVisibilityToggle({ input: inputEl, button, iconOn, iconOff, label: "API key" });

  expect(inputEl.type).toBe("password");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(iconOn.hasAttribute("hidden")).toBe(true);
  expect(iconOff.hasAttribute("hidden")).toBe(false);

  button.click();

  expect(inputEl.type).toBe("text");
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(iconOn.hasAttribute("hidden")).toBe(false);
  expect(iconOff.hasAttribute("hidden")).toBe(true);
});

test("toggle returns false when required elements are missing", () => {
  expect(initVisibilityToggle({})).toBe(false);
});

test("bindVisibilityToggles initializes toggles via data attributes", () => {
  document.body.innerHTML = `
    <div>
      <input id="apiKey" type="text" />
      <button data-toggle-target="apiKey" data-toggle-label="API key">
        <span class="icon-on" hidden></span>
        <span class="icon-off"></span>
      </button>
    </div>
  `;

  const count = bindVisibilityToggles(document);
  const input = document.getElementById("apiKey") as HTMLInputElement;

  expect(count).toBe(1);
  expect(input.type).toBe("password");
});
