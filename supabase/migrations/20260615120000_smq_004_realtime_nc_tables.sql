-- SMQ 004 — Active le realtime sur les tables NC.
-- Le trigger fn_sync_nc_action_from_task met à jour nc_actions quand la tâche
-- liée change de statut, mais la page NC (useNCDetail) ne se rafraîchissait pas
-- en live car nc_actions/nc_declarations n'étaient pas dans la publication
-- realtime. REPLICA IDENTITY FULL permet aux filtres par nc_id de fonctionner
-- sur les UPDATE. Appliquée en prod via MCP (migration smq_004_realtime_nc_tables).

ALTER TABLE public.nc_actions REPLICA IDENTITY FULL;
ALTER TABLE public.nc_declarations REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='nc_actions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nc_actions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='nc_declarations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nc_declarations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='nc_attachments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nc_attachments;
  END IF;
END $$;
