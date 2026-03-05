export {};

const {
  normalizeImageCacheLimitMb,
  updateProjectsContextButton,
  openProjectsContextModal,
  loadProviderSetting
} = require("../src/projects/projects-ui-controller-utils.js");

describe("projects-ui-controller-utils", () => {
  test("normalizeImageCacheLimitMb clamps and snaps to 64MB steps", () => {
    expect(normalizeImageCacheLimitMb(100)).toBe(128);
    expect(normalizeImageCacheLimitMb(511)).toBe(512);
    expect(normalizeImageCacheLimitMb(9999)).toBe(2048);
    expect(normalizeImageCacheLimitMb(Number.NaN)).toBe(512);
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
