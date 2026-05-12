// Smoke test dos 3 templates social — gera PNGs em scripts/preview/.
// Uso: node scripts/preview-social.mjs [PORT]
//
// Pré-req: dev server rodando (npm run dev). Default PORT=3005 (Next costuma
// pular pra essa porta no nosso setup).

import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "preview");
mkdirSync(OUT_DIR, { recursive: true });

const PORT = process.argv[2] || process.env.PORT || "3005";
const ORIGIN = `http://localhost:${PORT}`;

const SAMPLE = {
  kicker: "DESTAQUE",
  headline: "Porto de Imbituba bate recorde de exportações no 1º trimestre",
  title: "Porto de Imbituba bate recorde de exportações no 1º trimestre",
  subline: "Movimentação cresceu 18% e consolidou Imbituba como hub do sul catarinense.",
  cta: "Ler matéria",
  editoria: "cidade",
  credit: "Foto: SCPar Porto",
  photo: "",
};

const SHOTS = [
  { format: "card-1080", w: 1080, h: 1080 },
  { format: "story-1080x1920", w: 1080, h: 1920 },
  { format: "banner-1200x630", w: 1200, h: 630 },
];

function buildUrl(format) {
  const qs = new URLSearchParams(SAMPLE).toString();
  return `${ORIGIN}/social-template/${format}?${qs}`;
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const { format, w, h } of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const url = buildUrl(format);
    console.log(`→ ${format}: ${url}`);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => document.fonts?.ready);
    const out = resolve(OUT_DIR, `${format}.png`);
    await page.screenshot({ path: out, type: "png", clip: { x: 0, y: 0, width: w, height: h } });
    console.log(`  ✓ ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\nPreviews em ${OUT_DIR}`);
