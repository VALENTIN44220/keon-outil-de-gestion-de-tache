
CREATE TABLE public.fou_resultat (
    id              BIGSERIAL PRIMARY KEY,
    tiers           TEXT NOT NULL,
    ref             TEXT NOT NULL,
    dos             TEXT NOT NULL,
    annee_cmd       TEXT,
    mois_cmd        TEXT,
    ca_commande     NUMERIC(15, 2),
    annee_fac       TEXT,
    mois_fac        TEXT,
    ca_facture      NUMERIC(15, 2),
    ecart_cmd_fac   NUMERIC(15, 2),
    synced_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fou_resultat
    ADD CONSTRAINT fou_resultat_uq UNIQUE (tiers, ref, dos, annee_cmd, mois_cmd, annee_fac, mois_fac);

CREATE INDEX idx_fou_resultat_tiers ON public.fou_resultat (tiers);
CREATE INDEX idx_fou_resultat_dos   ON public.fou_resultat (dos);
CREATE INDEX idx_fou_resultat_annee ON public.fou_resultat (annee_fac, mois_fac);

ALTER TABLE public.fou_resultat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_fou_resultat" ON public.fou_resultat
    FOR SELECT TO authenticated USING (true);
