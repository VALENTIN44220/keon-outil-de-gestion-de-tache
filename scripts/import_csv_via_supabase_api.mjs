#!/usr/bin/env node
/**
 * Bulk import CSVs in ./migrate_data into Supabase via HTTP (service role key).
 *
 * Why: avoids Postgres password / IPv6 / pooler issues; works anywhere with HTTPS.
 *
 * Requirements:
 * - SUPABASE_URL
 * - SUPABASE_SECRET_KEY (service role)  ⚠️ keep private
 *
 * Usage:
 *   npm install
 *   node scripts/import_csv_via_supabase_api.mjs
 *
 * Options (env):
 * - MIGRATE_DATA_DIR (default: ./migrate_data)
 * - BATCH_SIZE (default: 500)
 * - ONLY_REGEX / EXCLUDE_REGEX (applies to filename, e.g. '^tasks\\.csv$')
 * - UPSERT=1 (default: 0)  -> uses upsert when possible
 * - ON_CONFLICT_MAP (json) (optional) -> e.g. {"number_counters":"project_code,entity_type"}
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL is not set (or VITE_SUPABASE_URL).');
  process.exit(1);
}
if (!SUPABASE_SECRET_KEY) {
  console.error('ERROR: SUPABASE_SECRET_KEY is not set (service role key).');
  process.exit(1);
}

const dataDir = path.resolve(process.env.MIGRATE_DATA_DIR || path.join(repoRoot, 'migrate_data'));
const batchSize = Number(process.env.BATCH_SIZE || 500);
const onlyRe = process.env.ONLY_REGEX ? new RegExp(process.env.ONLY_REGEX) : null;
const excludeRe = process.env.EXCLUDE_REGEX ? new RegExp(process.env.EXCLUDE_REGEX) : null;
const doUpsert = process.env.UPSERT === '1';
const onConflictMap = (() => {
  try {
    return process.env.ON_CONFLICT_MAP ? JSON.parse(process.env.ON_CONFLICT_MAP) : {};
  } catch {
    console.error('ERROR: ON_CONFLICT_MAP is not valid JSON.');
    process.exit(1);
  }
})();

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function shouldProcessFile(basename) {
  if (onlyRe && !onlyRe.test(basename)) return false;
  if (excludeRe && excludeRe.test(basename)) return false;
  return true;
}

// Topological import order — tables that are FK-referenced must come before their dependents.
// Any CSV not listed here is appended alphabetically at the end.
const FK_ORDER = [
  'companies',
  'categories',
  'hierarchy_levels',
  'holidays',
  'permission_profiles',
  'be_task_labels',
  'datalake_table_catalog',
  'page_device_visibility',
  'standard_workflow_config',
  'wf_validation_configs',
  'wf_assignment_rules',
  'departments',
  'subcategories',
  'service_groups',
  'job_titles',
  'profiles',
  'user_roles',
  'collaborator_groups',
  'service_group_departments',
  'service_group_labels',
  'collaborator_group_members',
  'process_templates',
  'sub_process_templates',
  'task_templates',
  'form_sections',
  'template_custom_fields',
  'assignment_rules',
  'be_projects',
  'permission_profile_process_templates',
  'user_permission_overrides',
  'user_permission_profile_overrides',
  'user_process_template_overrides',
  'process_tracking_access',
  'process_dashboard_configs',
  'it_projects',
  'it_project_milestones',
  'it_project_fdr_validation',
  'it_project_phase_progress',
  'workflow_templates',
  'workflow_nodes',
  'workflow_edges',
  'wf_workflows',
  'wf_steps',
  'wf_task_configs',
  'wf_transitions',
  'wf_actions',
  'wf_notifications',
  'wf_step_pool_validators',
  'wf_step_sequence_validators',
  'wf_model_tasks',
  'workflow_runs',
  'workflow_branch_instances',
  'workflow_variables',
  'workflow_variable_instances',
  'workflow_validation_instances',
  'tasks',
  'request_sub_processes',
  'request_field_values',
  'request_trace_numbers',
  'be_project_comments',
  'be_request_details',
  'be_request_sub_processes',
  'task_checklists',
  'task_comments',
  'task_status_transitions',
  'task_attachments',
  'task_labels',
  'task_validation_levels',
  'task_template_checklists',
  'template_validation_levels',
  'demande_materiel',
  'planner_plan_mappings',
  'planner_bucket_mappings',
  'planner_task_links',
  'planner_sync_logs',
  'chat_conversations',
  'chat_members',
  'chat_messages',
  'chat_attachments',
  'chat_read_receipts',
  'notification_preferences',
  'user_leaves',
  'user_microsoft_connections',
  'outlook_calendar_events',
  'user_dashboard_filters',
  'process_table_output_mappings',
  'widget_layout_presets',
  'workload_slots',
  'pending_task_assignments',
  'recurrence_runs',
  'project_view_configs',
  'project_questionnaire',
  'supplier_purchase_permissions',
  'supplier_purchase_enrichment',
  'supplier_attachments',
  'inno_demandes',
  'fou_resultat',
  'wf_runtime_instances',
  'wf_runtime_logs',
  'workflow_events',
  'workflow_execution_logs',
  'workflow_autonumber_sequences',
  'workflow_datalake_sync_logs',
  'workflow_notifications',
  'workflow_template_versions',
];

function listCsvFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const all = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => path.join(dir, f));

  // Sort: FK_ORDER first (in order), then remaining files alphabetically
  const byTable = new Map(all.map((p) => [path.basename(p).replace(/\.csv$/i, ''), p]));
  const ordered = [];
  for (const t of FK_ORDER) {
    if (byTable.has(t)) {
      ordered.push(byTable.get(t));
      byTable.delete(t);
    }
  }
  // Append remaining files alphabetically
  const remaining = [...byTable.values()].sort();
  return [...ordered, ...remaining];
}

function normalizeValue(v) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s === '') return null;
  if (s.toLowerCase() === 'null') return null;
  // Parse JSON arrays / objects so Supabase receives the right type
  // (CSV exports store TEXT[] and JSONB columns as JSON strings)
  if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
    try { return JSON.parse(s); } catch { /* not JSON, fall through */ }
  }
  return v;
}

async function insertBatch(table, rows, columns) {
  const payload = rows.map((r) => {
    const obj = {};
    for (const c of columns) obj[c] = normalizeValue(r[c]);
    return obj;
  });

  // Decide insert vs upsert
  if (doUpsert) {
    const onConflict = onConflictMap[table] || (columns.includes('id') ? 'id' : null);
    if (onConflict) {
      const { error } = await supabase.from(table).upsert(payload, { onConflict, returning: 'minimal' });
      return error;
    }
  }

  const { error } = await supabase.from(table).insert(payload, { returning: 'minimal' });
  return error;
}

async function importCsvFile(csvPath) {
  const basename = path.basename(csvPath);
  const table = basename.replace(/\.csv$/i, '');

  if (!shouldProcessFile(basename)) {
    console.log(`SKIP  ${basename} (filtered)`);
    return { table, ok: true, skipped: true };
  }

  const stat = fs.statSync(csvPath);
  if (stat.size === 0) {
    console.log(`SKIP  ${basename} (empty)`);
    return { table, ok: true, skipped: true };
  }

  console.log(`START ${basename} -> ${table}`);
  let total = 0;
  let batch = [];
  let columns = null;
  let lastErr = null;

  const parser = parse({
    columns: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
  });

  const stream = fs.createReadStream(csvPath);
  stream.pipe(parser);

  for await (const record of parser) {
    if (!columns) columns = Object.keys(record);
    batch.push(record);
    if (batch.length >= batchSize) {
      const err = await insertBatch(table, batch, columns);
      if (err) {
        lastErr = err;
        console.error(`FAIL  ${basename}: ${err.message || err}`);
        break;
      }
      total += batch.length;
      batch = [];
      if (total % (batchSize * 10) === 0) console.log(`... ${basename}: ${total} rows`);
    }
  }

  if (!lastErr && batch.length > 0 && columns) {
    const err = await insertBatch(table, batch, columns);
    if (err) {
      lastErr = err;
      console.error(`FAIL  ${basename}: ${err.message || err}`);
    } else {
      total += batch.length;
    }
  }

  if (lastErr) return { table, ok: false, error: lastErr };
  console.log(`OK    ${basename}: ${total} rows`);
  return { table, ok: true, rows: total };
}

async function main() {
  const files = listCsvFiles(dataDir);
  if (files.length === 0) {
    console.error(`ERROR: No CSV files found in ${dataDir}`);
    process.exit(1);
  }

  console.log(`Data dir: ${dataDir}`);
  console.log(`Files: ${files.length}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Upsert: ${doUpsert ? 'on' : 'off'}`);
  console.log('');

  const results = [];
  for (const f of files) {
    // eslint-disable-next-line no-await-in-loop
    const r = await importCsvFile(f);
    results.push(r);
    if (!r.ok) break;
  }

  const ok = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.find((r) => !r.ok);

  console.log('');
  console.log(`Done. ok=${ok} skipped=${skipped} total=${results.length}`);
  if (failed) {
    console.error(`FAILED at table: ${failed.table}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

