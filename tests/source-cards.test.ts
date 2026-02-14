export {};

/**
 * @jest-environment jsdom
 */

const { buildCard } = require("../src/modules/source-cards.js");

describe("source cards", () => {
  test("buildCard renders dynamic fields as text", () => {
    const source = {
      url: 'https://example.com/?q=<script>alert(1)</script>',
      domain: '<b>example.com</b>',
      title: '<img src=x onerror=alert(1)>'
    };

    const card = buildCard(source);
    const domainEl = card.querySelector(".source-card-domain");
    const titleEl = card.querySelector(".source-card-title");
    const urlEl = card.querySelector(".source-card-url");

    expect(domainEl?.textContent).toBe('<b>example.com</b>');
    expect(titleEl?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(urlEl?.textContent).toContain("https://example.com/");
    expect(card.querySelector("script")).toBeNull();
    expect(card.querySelector("img.source-card-favicon")?.getAttribute("src")).toContain("domain=");
  });
});
