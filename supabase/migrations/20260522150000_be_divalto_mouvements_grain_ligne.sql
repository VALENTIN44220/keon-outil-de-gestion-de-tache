-- ════════════════════════════════════════════════════════════════════════
-- CORRECTIF be_divalto_mouvements : clé d'unicité au grain LIGNE ANALYTIQUE
--
-- PROBLÈME
--   La contrainte UNIQUE (numero_piece, source) écrase toutes les lignes
--   d'une même pièce Divalto sauf une lors de l'upsert Fabric. Une facture /
--   commande portant plusieurs lignes analytiques (plusieurs affaires, ex. une
--   part études E et une part montage M) ne conserve qu'UNE ligne → les lignes
--   secondaires (dont les affaires M) disparaissent.
--
-- CORRECTIF
--   On élargit la clé d'unicité aux axes analytiques (+ compte_général) pour
--   conserver une ligne par (pièce, affaire, compte).
--
-- ⚠ COORDINATION OBLIGATOIRE AVEC LE PIPELINE FABRIC ⚠
--   Le notebook/pipeline qui appelle l'edge function `bulk-upsert` doit changer
--   son paramètre :
--       conflict_key = "numero_piece,source"
--   →   conflict_key = "numero_piece,source,axe_0001,axe_0002,compte_general"
--   sinon le prochain upsert échouera (cible ON CONFLICT introuvable).
--
--   Après déploiement coordonné, lancer une RESYNC COMPLÈTE (full reload) pour
--   récupérer toutes les lignes précédemment écrasées.
--
--   NOTE : si une même pièce peut avoir 2 lignes sur le même (axe_0001,
--   axe_0002, compte_general), il faudra ajouter au pipeline un numéro de
--   ligne (ex. colonne `no_ligne`) et l'inclure dans la clé. Les colonnes
--   actuelles ne permettent pas de distinguer ce cas.
-- ════════════════════════════════════════════════════════════════════════

-- COALESCE pour rendre les colonnes nullables déterministes dans la clé
-- (compte_general est fréquemment NULL côté gescom).
ALTER TABLE public.be_divalto_mouvements
  ALTER COLUMN axe_0001       SET DEFAULT '',
  ALTER COLUMN axe_0002       SET DEFAULT '',
  ALTER COLUMN compte_general SET DEFAULT '';

UPDATE public.be_divalto_mouvements
SET axe_0001       = COALESCE(axe_0001, ''),
    axe_0002       = COALESCE(axe_0002, ''),
    compte_general = COALESCE(compte_general, '')
WHERE axe_0001 IS NULL OR axe_0002 IS NULL OR compte_general IS NULL;

ALTER TABLE public.be_divalto_mouvements
  DROP CONSTRAINT IF EXISTS be_divalto_mouvements_piece_source_unique;

ALTER TABLE public.be_divalto_mouvements
  ADD CONSTRAINT be_divalto_mouvements_ligne_unique
  UNIQUE (numero_piece, source, axe_0001, axe_0002, compte_general);
