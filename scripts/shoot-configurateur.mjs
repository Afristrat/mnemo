import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000/configurateur";
const b = await chromium.launch();

async function waitReady(page, url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 3000 });
      if (res && res.ok()) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

// Desktop — le budget-mètre doit être à DROITE (sticky), pas en bas.
const desktop = await b.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1.5 });
const ok = await waitReady(desktop, BASE);
if (!ok) {
  console.log("SERVER_NOT_READY");
  await b.close();
  process.exit(1);
}
await desktop.waitForSelector("text=Profil & contraintes");
await desktop.screenshot({ path: "configurateur-desktop.png", fullPage: false });

// Mobile — empilement vertical (budget-mètre sous le contenu).
const mobile = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto(BASE, { waitUntil: "networkidle" });
await mobile.waitForSelector("text=Profil & contraintes");
await mobile.screenshot({ path: "configurateur-mobile.png", fullPage: true });

await b.close();
console.log("OK");
