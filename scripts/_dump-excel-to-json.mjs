#!/usr/bin/env node
import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';

const filePath = process.argv[2];
const outPath = process.argv[3] || filePath.replace(/\.xlsx$/i, '.json');

const wb = XLSX.read(readFileSync(filePath), { type: 'buffer' });
const ws = wb.Sheets['PRESTATIONS'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log(`✅ ${rows.length} lignes → ${outPath}`);
