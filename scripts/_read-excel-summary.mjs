#!/usr/bin/env node
/**
 * Lit le fichier Excel rempli, calcule le diff avec la DB actuelle,
 * et dump tout en JSON sur stdout pour analyse côté Claude.
 */
import XLSX from 'xlsx';
import { readFileSync } from 'fs';

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node _read-excel-summary.mjs <file.xlsx>'); process.exit(1); }

const wb = XLSX.read(readFileSync(filePath), { type: 'buffer' });
const ws = wb.Sheets['PRESTATIONS'];
if (!ws) { console.error('Onglet PRESTATIONS introuvable'); process.exit(1); }

const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
console.log(JSON.stringify({
  rowCount: rows.length,
  sample: rows.slice(0, 3),
  allColumns: Object.keys(rows[0] || {}),
  // Counts par valeur pour les colonnes enum
  startModeCounts: rows.reduce((acc, r) => { const k = r['Démarrage'] || 'NULL'; acc[k] = (acc[k]||0)+1; return acc; }, {}),
  val1Counts: rows.reduce((acc, r) => { const k = r['Validation N1'] || 'NULL'; acc[k] = (acc[k]||0)+1; return acc; }, {}),
  milestoneCounts: rows.reduce((acc, r) => { const k = r['Jalon timeline (oui/non)'] || 'NULL'; acc[k] = (acc[k]||0)+1; return acc; }, {}),
  withDelay: rows.filter(r => (parseInt(r['Délai après précédente (j)']) || 0) > 0).length,
  withDeps: rows.filter(r => (r['Dépend de (étape n°)'] || '').toString().trim()).length,
}, null, 2));
