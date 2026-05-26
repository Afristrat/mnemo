// Capture une page de l'app en cours d'exécution (localhost:3000).
// Usage : node scripts/shoot-page.mjs <path> <outfile.png> [width]
import { chromium } from "@playwright/test";

const path = process.argv[2] ?? "/";
const out = process.argv[3] ?? "page.png";
const width = Number(process.argv[4] ?? 1280);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width, height: 1100 }, deviceScaleFactor: 1.5 });

let ready = false;
for (let i = 0; i < 40; i += 1) {
  try {
    const res = await p.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 3000 });
    if (res && res.ok()) {
      ready = true;
      break;
    }
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!ready) {
  console.log("SERVER_NOT_READY");
  await b.close();
  process.exit(1);
}
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log("OK");
