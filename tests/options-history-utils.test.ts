export {};
const {
  buildHistoryCsv,
  buildHistoryJson
} = require("../src/options/options-history-utils.js");

describe("options history utils", () => {
  const history = [
    { createdAt: 1000, prompt: "Hello", answer: "World" },
    { createdAt: 2000, prompt: "Line\nBreak", answer: "A,B" }
  ];

  test("builds JSON export", () => {
    const json = buildHistoryJson(history);
    expect(typeof json).toBe("string");
    expect(json).toContain("\"prompt\": \"Hello\"");
  });

  test("builds CSV export with escaped fields", () => {
    const csv = buildHistoryCsv(history);
    expect(csv).toContain("timestamp,prompt,answer");
    expect(csv).toContain("\"Line\nBreak\"");
    expect(csv).toContain("\"A,B\"");
  });
});
