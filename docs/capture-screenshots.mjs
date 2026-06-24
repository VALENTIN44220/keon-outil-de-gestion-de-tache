/**
 * Script de capture d'écrans pour la documentation Keon
 * Usage : node docs/capture-screenshots.mjs
 *
 * Étape 1 (première exécution) : ouvre Chrome → cliquez "Continuer avec Microsoft"
 *                                 → connectez-vous → la session est sauvegardée
 * Étape 2 (ensuite) : réutilise la session sauvegardée, capture tout sans interaction
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshots');
const STATE_FILE = path.join(__dirname, 'auth-state.json');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:8080';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// ── Liste des écrans à capturer ───────────────────────────────────────────────
const SCREENS = [
  // MON ESPACE
  { id: '01_dashboard',       url: '/',                         label: 'Tableau de bord',            module: 'Mon Espace',       access: 'standard' },
  { id: '02_requests',        url: '/requests',                 label: 'Demandes',                   module: 'Mon Espace',       access: 'standard' },
  { id: '03_mes_demandes',    url: '/mes-demandes',             label: 'Mes demandes',               module: 'Mon Espace',       access: 'standard' },
  { id: '04_workload',        url: '/workload',                 label: 'Plan de charge personnel',   module: 'Mon Espace',       access: 'standard' },
  { id: '05_calendar',        url: '/calendar',                 label: 'Calendrier',                 module: 'Mon Espace',       access: 'standard' },
  // ÉQUIPE
  { id: '06_team_workload',   url: '/workload',                 label: 'Plan de charge équipe',      module: 'Équipe',           access: 'profil' },
  // BUREAU D'ÉTUDES
  { id: '07_be_dispatch',     url: '/be/dispatch',              label: 'Dispatch & Suivi BE',        module: "Bureau d'Études",  access: 'standard' },
  { id: '08_be_projects',     url: '/projects',                 label: 'Projets BE',                 module: "Bureau d'Études",  access: 'profil' },
  { id: '09_be_planning',     url: '/be/plan-de-charge',        label: 'Plan de charge BE',          module: "Bureau d'Études",  access: 'profil' },
  { id: '10_be_budget',       url: '/be/budget',                label: 'Budget BE',                  module: "Bureau d'Études",  access: 'profil' },
  { id: '11_be_tjm',          url: '/be/admin/tjm',             label: 'Référentiel TJM',            module: "Bureau d'Études",  access: 'admin' },
  // SPV
  { id: '12_spv',             url: '/spv',                      label: 'Projets SPV',                module: 'SPV',              access: 'profil' },
  // IT / DIGITAL
  { id: '13_it_dispatch',     url: '/it/dispatch',              label: 'Demandes IT',                module: 'IT / Digital',     access: 'standard' },
  { id: '14_it_projects',     url: '/it/projects',              label: 'Projets IT',                 module: 'IT / Digital',     access: 'double' },
  { id: '15_it_roadmap',      url: '/it/feuille-de-route',      label: 'Feuille de route IT',        module: 'IT / Digital',     access: 'profil' },
  { id: '16_it_planning',     url: '/it/plan-de-charge',        label: 'Plan de charge IT',          module: 'IT / Digital',     access: 'profil' },
  { id: '17_it_budget',       url: '/it/budget',                label: 'Budget IT',                  module: 'IT / Digital',     access: 'profil' },
  { id: '18_it_carto',        url: '/it/cartographie',          label: 'Cartographie IT',            module: 'IT / Digital',     access: 'profil' },
  // MODULES ADDITIONNELS
  { id: '19_smq',             url: '/smq',                      label: 'Non-conformités (SMQ)',      module: 'Qualité',          access: 'standard' },
  { id: '20_innovation',      url: '/innovation/requests',      label: 'Innovation',                 module: 'Modules',          access: 'profil' },
  { id: '21_maintenance',     url: '/maintenance/dispatch',     label: 'Maintenance matériel',       module: 'Modules',          access: 'profil' },
  { id: '22_rh',              url: '/rh/dispatch',              label: 'Mouvements RH',              module: 'Modules',          access: 'profil' },
  { id: '23_client',          url: '/client/dispatch',          label: 'Création client',            module: 'Modules',          access: 'profil' },
  { id: '24_logistique',      url: '/logistique/dispatch',      label: 'Logistique transports',      module: 'Modules',          access: 'profil' },
  { id: '25_sst',             url: '/sst',                      label: 'Situations à risque (SST)',  module: 'Modules',          access: 'profil' },
  // CONFIGURATION
  { id: '26_templates',       url: '/templates',                label: 'Modèles de processus',       module: 'Configuration',    access: 'profil' },
  { id: '27_admin',           url: '/admin',                    label: 'Administration',             module: 'Administration',   access: 'admin' },
  // FICHES PROJETS BE
  { id: '28a_be_overview',    url: '/be/projects/ABIL/overview',  label: "Fiche projet BE — Vue d'ensemble",  module: "Bureau d'Études", access: 'profil' },
  { id: '28b_be_timeline',    url: '/be/projects/ABIL/timeline',  label: 'Fiche projet BE — Gantt',           module: "Bureau d'Études", access: 'profil' },
  { id: '28c_be_budget',      url: '/be/projects/ABIL/budget',    label: 'Fiche projet BE — Budget',          module: "Bureau d'Études", access: 'profil' },
  { id: '28d_be_temps',       url: '/be/projects/ABIL/temps',     label: 'Fiche projet BE — Temps',           module: "Bureau d'Études", access: 'profil' },
];

async function capture(page, id, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const file = path.join(OUT, `${id}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  console.log(`  ✅ ${label}`);
  return `${id}.jpg`;
}

async function main() {
  const hasState = fs.existsSync(STATE_FILE);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    channel: 'chrome',
    executablePath: CHROME,
  });

  let context;
  if (hasState) {
    console.log('\n🔑 Session sauvegardée trouvée → connexion automatique\n');
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      storageState: STATE_FILE,
    });
  } else {
    console.log('\n⚠️  Première exécution — connexion Microsoft requise\n');
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  }

  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── Gérer la page de connexion ───────────────────────────────────────────
  if (page.url().includes('/auth')) {
    if (!hasState) {
      console.log('📋 Page de connexion détectée.');
      console.log('   → Clic automatique sur "Continuer avec Microsoft"...\n');
      try {
        await page.click('button:has-text("Continuer avec Microsoft")', { timeout: 5000 });
      } catch {
        console.log('   → Bouton non trouvé, veuillez cliquer manuellement sur "Continuer avec Microsoft"');
      }
      console.log('   → En attente de la connexion Microsoft (2 minutes max)...');
      console.log('   → Connectez-vous dans la fenêtre Microsoft si elle s\'ouvre.\n');
    }

    // Attendre que l'URL sorte de /auth (OAuth redirect)
    try {
      await page.waitForURL(url => !url.includes('/auth'), { timeout: 120000 });
      await page.waitForTimeout(2000);
      console.log('✅ Connecté avec succès !\n');

      // Sauvegarder la session pour les prochaines exécutions
      await context.storageState({ path: STATE_FILE });
      console.log('💾 Session sauvegardée → docs/auth-state.json\n');
    } catch {
      console.error('❌ Timeout de connexion. Relancez le script et connectez-vous dans les 2 minutes.');
      await browser.close();
      process.exit(1);
    }
  }

  // ── Captures ─────────────────────────────────────────────────────────────
  console.log('📸 Début des captures...\n');
  const results = [];

  for (const screen of SCREENS) {
    try {
      await page.goto(`${BASE}${screen.url}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);

      // Si redirigé vers /auth, la session a expiré
      if (page.url().includes('/auth')) {
        console.log(`  ⚠️  Session expirée sur ${screen.label} — ignoré`);
        results.push({ ...screen, file: null });
        continue;
      }

      const file = await capture(page, screen.id, screen.label);
      results.push({ ...screen, file });
    } catch (e) {
      console.log(`  ⚠️  ${screen.label}: ${e.message.slice(0, 80)}`);
      results.push({ ...screen, file: null, error: e.message });
    }
  }

  // ── Manifest ──────────────────────────────────────────────────────────────
  const manifest = results.map(r => ({
    id: r.id,
    url: r.url,
    label: r.label,
    module: r.module,
    access: r.access,
    file: r.file ?? null,
  }));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const ok = results.filter(r => r.file).length;
  console.log(`\n✅ ${ok}/${results.length} captures réussies`);
  console.log('📄 Lancez maintenant : node docs/generate-html.mjs\n');

  await browser.close();
}

main().catch(console.error);
