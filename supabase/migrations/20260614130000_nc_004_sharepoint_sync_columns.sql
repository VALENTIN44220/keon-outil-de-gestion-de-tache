-- NC 004 — Colonnes d'appariement pour la sync SharePoint (liste QUALITE_NC-AC).
-- Additif : prépare le rapprochement (écriture app->SharePoint activée plus tard,
-- nécessite le scope Graph Sites.ReadWrite.All + une règle de conflit).
-- Appliquée en prod via MCP (migration nc_004_sharepoint_sync_columns).

ALTER TABLE public.nc_declarations ADD COLUMN IF NOT EXISTS sharepoint_item_id text;
ALTER TABLE public.nc_declarations ADD COLUMN IF NOT EXISTS sharepoint_etag text;
ALTER TABLE public.nc_declarations ADD COLUMN IF NOT EXISTS sharepoint_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nc_sharepoint_item
  ON public.nc_declarations(sharepoint_item_id)
  WHERE sharepoint_item_id IS NOT NULL;
