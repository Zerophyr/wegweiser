export {};
let projectsLoaded = false;

const win = window as unknown as {
  __TEST__?: boolean;
  formatBytes?: (bytes: number) => string;
  buildStorageLabel?: (label: string, bytesUsed: number, maxBytes?: number | null) => string;
};

function loadProjects() {
  if (projectsLoaded) return;
  win.__TEST__ = true;
  require("../src/projects/projects.js");
  projectsLoaded = true;
}

describe("projects storage helpers", () => {
  beforeEach(() => {
    loadProjects();
  });

  test("formatBytes formats MB with one decimal", () => {
    expect(win.formatBytes?.(1048576)).toBe("1.0MB");
  });

  test("buildStorageLabel includes max when provided", () => {
    expect(win.buildStorageLabel?.("Local Storage", 5 * 1024 * 1024, 10 * 1024 * 1024))
      .toBe("Local Storage: 5.0MB of 10.0MB");
  });

  test("buildStorageLabel omits max when missing", () => {
    expect(win.buildStorageLabel?.("Image Storage", 3 * 1024 * 1024, null))
      .toBe("Image Storage: 3.0MB");
  });
});

