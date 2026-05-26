import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1120, height: 1500 }, deviceScaleFactor: 2 });
await p.goto("file:///C:/Users/amans/OneDrive/Projets/Infra/homepage-draft.html", { waitUntil: "networkidle" });
await p.screenshot({ path: "homepage-draft.png", fullPage: true });
await b.close();
console.log("OK");
