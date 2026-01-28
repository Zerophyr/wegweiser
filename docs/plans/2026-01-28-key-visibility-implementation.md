# Key Visibility Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline eye toggles to API/provisioning key fields so users can reveal or hide keys (hidden by default on every load).

**Architecture:** Add a small shared toggle helper that manages input type and icon state. Wire it in options UI with inline SVG icons and minimal CSS, keeping state in-memory only.

**Tech Stack:** Vanilla JS, HTML/CSS, Jest (jsdom)

---

### Task 1: Add visibility toggle helper + tests

**Files:**
- Create: `src/shared/visibility-toggle.js`
- Test: `tests/visibility-toggle.test.ts`

**Step 1: Write the failing test**

```typescript
const { initVisibilityToggle } = require("../src/shared/visibility-toggle.js");

test("toggle switches input type and aria state", () => {
  document.body.innerHTML = `
    <div>
      <input id="apiKey" type="password" />
      <button id="toggle" aria-pressed="false">
        <span class="icon-on"></span>
        <span class="icon-off" hidden></span>
      </button>
    </div>
  `;

  const input = document.getElementById("apiKey");
  const button = document.getElementById("toggle");
  const iconOn = button.querySelector(".icon-on");
  const iconOff = button.querySelector(".icon-off");

  initVisibilityToggle({ input, button, iconOn, iconOff, label: "API key" });

  expect(input.type).toBe("password");
  expect(button.getAttribute("aria-pressed")).toBe("false");
  expect(iconOn.hasAttribute("hidden")).toBe(true);
  expect(iconOff.hasAttribute("hidden")).toBe(false);

  button.click();

  expect(input.type).toBe("text");
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(iconOn.hasAttribute("hidden")).toBe(false);
  expect(iconOff.hasAttribute("hidden")).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/visibility-toggle.test.ts`
Expected: FAIL (module not found)

**Step 3: Write minimal implementation**

```javascript
const initVisibilityToggle = ({ input, button, iconOn, iconOff, label }) => {
  if (!input || !button) return false;
  const showLabel = `Show ${label}`;
  const hideLabel = `Hide ${label}`;

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

module.exports = { initVisibilityToggle };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/visibility-toggle.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/visibility-toggle.js tests/visibility-toggle.test.ts
git commit -m "feat: add visibility toggle helper"
```

---

### Task 2: Wire toggles into Options UI

**Files:**
- Modify: `src/options/options.html`
- Modify: `src/options/options.js`

**Step 1: Write the failing test**

```typescript
const { initVisibilityToggle } = require("../src/shared/visibility-toggle.js");

test("initVisibilityToggle returns false when elements are missing", () => {
  expect(initVisibilityToggle({})).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/visibility-toggle.test.ts`
Expected: FAIL (initVisibilityToggle does not handle missing elements)

**Step 3: Write minimal implementation**

- Update `initVisibilityToggle` to return `false` when input/button missing (already in Task 1 code), `true` when initialized.
- In `options.html`:
  - Wrap `#apiKey` and `#nagaProvisioningKey` inputs in a `.key-input` container.
  - Add a `button` with inline SVG eye/eye-off icons for each field.
  - Set input `type="password"`.
  - Add `data-toggle-target` and `data-toggle-label` attributes to the button.
  - Include `../shared/visibility-toggle.js` before `options.js`.
- In `options.js`:
  - Add a `setupKeyVisibilityToggles()` that queries buttons by `[data-toggle-target]` and calls `initVisibilityToggle`.
  - Call it after initial DOM load (inside existing `DOMContentLoaded` handler or after the initial settings load).

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/visibility-toggle.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/options/options.html src/options/options.js src/shared/visibility-toggle.js tests/visibility-toggle.test.ts
git commit -m "feat: add key visibility toggles in options"
```

---

### Task 3: Style the inline eye toggle

**Files:**
- Modify: `src/options/options.html`

**Step 1: Write the failing test**

Skip (visual only). If a test is required, add a simple DOM test verifying that the toggle button exists for both keys when Naga is selected.

**Step 2: Implement styling**

- Add `.key-input` styles for relative positioning.
- Add `.key-toggle` styles for the button (size, alignment, hover, focus ring).
- Ensure input padding accounts for the icon.

**Step 3: Manual check**

- Open Options page and verify toggles render and align for both OpenRouter and Naga keys.

**Step 4: Commit**

```bash
git add src/options/options.html
git commit -m "style: add inline key visibility toggle"
```

---

### Task 4: Final verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 2: Manual smoke test**

- Toggle visibility for OpenRouter API key.
- Switch to Naga provider, toggle Naga API key and provisioning key.
- Reload Options page; keys are hidden again.

**Step 3: Commit final fixes (if any)**

```bash
git add -A
git commit -m "chore: finalize key visibility toggle"
```
