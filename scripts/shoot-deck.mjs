import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
await page.goto("file:///C:/Users/amans/OneDrive/Projets/Infra/design-proposals.html", { waitUntil: "networkidle" });
await page.screenshot({ path: "design-proposals.png", fullPage: true });
await browser.close();
console.log("OK");
