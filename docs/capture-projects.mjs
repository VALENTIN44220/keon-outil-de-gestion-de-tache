/**
 * Capture complémentaire : onglets fiches projets BE et IT
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
const MANIFEST = path.join(OUT, 'manifest.json');
const BASE = 'http://localhost:8080';

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));

const EXTRA = [
  // BE project hub (on utilise ABIL connu)
  { id: '28a_be_project_overview',  url: '/be/projects/ABIL/overview',     label: 'Fiche projet BE — Vue d\'ensemble', module: 'Bureau d\'Études', access: 'profil' },
  { id: '28b_be_project_timeline',  url: '/be/projects/ABIL/timeline',     label: 'Fiche projet BE — Gantt / Timeline', module: 'Bureau d\'Études', access: 'profil' },
  { id: '28c_be_project_budget',    url: '/be/projects/ABIL/budget',       label: 'Fiche projet BE — Budget', module: 'Bureau d\'Études', access: 'profil' },
  { id: '28d_be_project_temps',     url: '/be/projects/ABIL/temps',        label: 'Fiche projet BE — Temps saisi', module: 'Bureau d\'Études', access: 'profil' },
];

async function main() {
  const browser = await chromium.launch({
    headless: false, slowMo: 50, channel: 'chrome',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  for (const screen of EXTRA) {
    try {
      await page.goto(`${BASE}${screen.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => window.scrollTo(0, 0));
      const file = path.join(OUT, `${screen.id}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
      console.log(`  ✅ ${screen.label}`);
      manifest.push({ ...screen, file: `${screen.id}.jpg` });
    } catch (e) {
      console.log(`  ⚠️  ${screen.label}: ${e.message.slice(0, 80)}`);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Manifest mis à jour (${manifest.length} écrans)\n`);
  await browser.close();
}

main().catch(console.error);
