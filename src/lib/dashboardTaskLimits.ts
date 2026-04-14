/** Max rows fetched from Supabase for process / dashboard task views (PostgREST default is 1000). */
export const DASHBOARD_TASKS_FETCH_LIMIT = 10_000;

/** Task / demand tables: first paint size, then infinite scroll adds this many rows per load. */
export const DASHBOARD_TABLE_INITIAL_ROWS = 100;
export const DASHBOARD_TABLE_SCROLL_CHUNK = 200;
