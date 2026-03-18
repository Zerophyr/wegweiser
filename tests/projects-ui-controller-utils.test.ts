export {};

const {
  normalizeImageCacheLimitMb,
  getProjectModelLabel,
  updateChatModelIndicator,
  updateProjectsContextButton,
  openProjectsContextModal,
  loadProviderSetting
} = require("../src/projects/projects-ui-controller-utils.js");

function installSafeHtmlStub() {
  const safeHtml = {
    setSanitizedHtml: (element: HTMLElement, html: string) => { element.innerHTML = html; },
    appendSanitizedHtml: (element: HTMLElement, html: string) => { element.insertAdjacentHTML("beforeend", html); }
  };
  (global as any).safeHtml = safeHtml;
  (window as any).safeHtml = safeHtml;
}

describe("projects-ui-controller-utils", () => {
  test("normalizeImageCacheLimitMb clamps and snaps to 64MB steps", () => {
    expect(normalizeImageCacheLimitMb(100)).toBe(128);
    expect(normalizeImageCacheLimitMb(511)).toBe(512);
    expect(normalizeImageCacheLimitMb(9999)).toBe(2048);
    expect(normalizeImageCacheLimitMb(Number.NaN)).toBe(512);
  });


  test("getProjectModelLabel prefers display name and falls back to builder or model suffix", () => {
    expect(getProjectModelLabel({ model: "openai/gpt-4o-mini", modelDisplayName: "GPT-4o mini" }, {})).toBe("GPT-4o mini");
    expect(getProjectModelLabel(
      { model: "openai/gpt-4o-mini", modelProvider: "openrouter" },
      { buildModelDisplayName: (provider: string, model: string) => `${provider}:${model}` }
    )).toBe("openrouter:openai/gpt-4o-mini");
    expect(getProjectModelLabel({ model: "openai/gpt-4o-mini" }, {})).toBe("gpt-4o-mini");
    expect(getProjectModelLabel(null, {})).toBe("Default");
  });

  test("updateChatModelIndicator clears and formats indicator text", () => {
    const indicator = document.createElement("div");
    updateChatModelIndicator(null, {
      elements: { chatModelIndicator: indicator },
      formatThreadModelLabel: jest.fn()
    });
    expect(indicator.textContent).toBe("");

    updateChatModelIndicator({ model: "openai/gpt-4o-mini", modelDisplayName: "GPT-4o mini" }, {
      elements: { chatModelIndicator: indicator },
      formatThreadModelLabel: ({ modelDisplayName }: { modelDisplayName: string }) => `Model => ${modelDisplayName}`
    });
    expect(indicator.textContent).toBe("Model => GPT-4o mini");
  });

  test("updateProjectsContextButton toggles inactive and badge states", () => {
    const button = document.createElement("button");
    const badge = document.createElement("span");
    const deps = {
      elements: { ProjectsContextBtn: button, ProjectsContextBadge: badge },
      getProjectsContextButtonState: () => ({
        isActive: true,
        label: "4",
        title: "Has context"
      }),
      maxContextMessages: 20
    };

    updateProjectsContextButton(null, null, deps);
    expect(button.classList.contains("inactive")).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(badge.style.display).toBe("none");

    updateProjectsContextButton({ id: "thread" }, { id: "project" }, deps);
    expect(button.classList.contains("inactive")).toBe(false);
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(badge.style.display).toBe("inline-flex");
    expect(badge.textContent).toBe("4");
    expect(button.title).toBe("Has context");
  });

  test("openProjectsContextModal renders and closes overlay", () => {
    installSafeHtmlStub();
    const thread = { id: "t1" };
    const project = { id: "p1" };

    openProjectsContextModal(thread, project, {
      buildProjectsContextModalHtml: () => `
        <button class="projects-context-close">Close</button>
        <button class="projects-context-archive-toggle"><span>Archive</span><span>+</span></button>
        <div class="projects-context-archive-content"></div>
      `,
      maxContextMessages: 10,
      truncateText: (value: string) => value,
      escapeHtml: (value: string) => value
    });

    const overlay = document.querySelector(".projects-context-overlay") as HTMLElement;
    expect(overlay).not.toBeNull();

    const toggle = overlay.querySelector(".projects-context-archive-toggle") as HTMLElement;
    toggle.click();
    expect(overlay.querySelector(".projects-context-archive-content")?.classList.contains("open")).toBe(true);

    (overlay.querySelector(".projects-context-close") as HTMLElement).click();
    expect(document.querySelector(".projects-context-overlay")).toBeNull();
  });

  test("loadProviderSetting reads storage and normalizes provider", async () => {
    const setCurrentProvider = jest.fn();

    await loadProviderSetting({
      getLocalStorage: jest.fn().mockResolvedValue({ or_provider: "openrouter", or_model_provider: "OPENROUTER" }),
      setCurrentProvider,
      normalizeProviderSafe: (value: string) => String(value || "").toLowerCase()
    });

    expect(setCurrentProvider).toHaveBeenCalledWith("openrouter");
  });
});
