-- Harmonisation des libellés taxonomiques (fournisseurs enrichissement + demandes en attente).
-- INTRANTS : normalisation en majuscules sur famille source et famille courante.

UPDATE public.supplier_purchase_enrichment
SET famille_source_initiale = 'INTRANTS'
WHERE famille_source_initiale IS NOT NULL
  AND lower(btrim(famille_source_initiale)) = 'intrants';

UPDATE public.supplier_purchase_enrichment
SET famille = 'INTRANTS'
WHERE famille IS NOT NULL
  AND lower(btrim(famille)) = 'intrants';

UPDATE public.supplier_waiting_approval
SET famille_source_initiale = 'INTRANTS'
WHERE famille_source_initiale IS NOT NULL
  AND lower(btrim(famille_source_initiale)) = 'intrants';

UPDATE public.supplier_waiting_approval
SET famille = 'INTRANTS'
WHERE famille IS NOT NULL
  AND lower(btrim(famille)) = 'intrants';

-- Libellés renommés (toutes colonnes texte de segmentation où la valeur peut figurer).

UPDATE public.supplier_purchase_enrichment
SET
  categorie = CASE WHEN lower(btrim(categorie)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE sous_segment END
WHERE lower(btrim(categorie)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(famille_source_initiale)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(famille)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(segment)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(sous_segment)) = lower(btrim('SEPARATEUR DE PHASE'));

UPDATE public.supplier_waiting_approval
SET
  categorie = CASE WHEN lower(btrim(categorie)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = lower(btrim('SEPARATEUR DE PHASE')) THEN 'SEPARATEURS DE PHASE' ELSE sous_segment END
WHERE lower(btrim(categorie)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(famille_source_initiale)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(famille)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(segment)) = lower(btrim('SEPARATEUR DE PHASE'))
   OR lower(btrim(sous_segment)) = lower(btrim('SEPARATEUR DE PHASE'));

UPDATE public.supplier_purchase_enrichment
SET
  categorie = CASE WHEN lower(btrim(categorie)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE sous_segment END
WHERE lower(btrim(categorie)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(famille_source_initiale)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(famille)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(segment)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(sous_segment)) = lower(btrim('BUSES / PULVERISATION'));

UPDATE public.supplier_waiting_approval
SET
  categorie = CASE WHEN lower(btrim(categorie)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = lower(btrim('BUSES / PULVERISATION')) THEN 'BUSES / PULVERISATIONS' ELSE sous_segment END
WHERE lower(btrim(categorie)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(famille_source_initiale)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(famille)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(segment)) = lower(btrim('BUSES / PULVERISATION'))
   OR lower(btrim(sous_segment)) = lower(btrim('BUSES / PULVERISATION'));

UPDATE public.supplier_purchase_enrichment
SET
  categorie = CASE WHEN lower(btrim(categorie)) = 'assurance' THEN 'ASSURANCE' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = 'assurance' THEN 'ASSURANCE' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = 'assurance' THEN 'ASSURANCE' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = 'assurance' THEN 'ASSURANCE' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = 'assurance' THEN 'ASSURANCE' ELSE sous_segment END
WHERE lower(btrim(categorie)) = 'assurance'
   OR lower(btrim(famille_source_initiale)) = 'assurance'
   OR lower(btrim(famille)) = 'assurance'
   OR lower(btrim(segment)) = 'assurance'
   OR lower(btrim(sous_segment)) = 'assurance';

UPDATE public.supplier_waiting_approval
SET
  categorie = CASE WHEN lower(btrim(categorie)) = 'assurance' THEN 'ASSURANCE' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = 'assurance' THEN 'ASSURANCE' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = 'assurance' THEN 'ASSURANCE' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = 'assurance' THEN 'ASSURANCE' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = 'assurance' THEN 'ASSURANCE' ELSE sous_segment END
WHERE lower(btrim(categorie)) = 'assurance'
   OR lower(btrim(famille_source_initiale)) = 'assurance'
   OR lower(btrim(famille)) = 'assurance'
   OR lower(btrim(segment)) = 'assurance'
   OR lower(btrim(sous_segment)) = 'assurance';

UPDATE public.supplier_purchase_enrichment
SET
  categorie = CASE WHEN lower(btrim(categorie)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE sous_segment END
WHERE lower(btrim(categorie)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(famille_source_initiale)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(famille)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(segment)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(sous_segment)) = lower(btrim('Assainissement / Nettoyage industriel'));

UPDATE public.supplier_waiting_approval
SET
  categorie = CASE WHEN lower(btrim(categorie)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE categorie END,
  famille_source_initiale = CASE WHEN lower(btrim(famille_source_initiale)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE famille_source_initiale END,
  famille = CASE WHEN lower(btrim(famille)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE famille END,
  segment = CASE WHEN lower(btrim(segment)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE segment END,
  sous_segment = CASE WHEN lower(btrim(sous_segment)) = lower(btrim('Assainissement / Nettoyage industriel')) THEN 'ASSAINISSEMENT / NETTOYAGE INDUSTRIEL' ELSE sous_segment END
WHERE lower(btrim(categorie)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(famille_source_initiale)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(famille)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(segment)) = lower(btrim('Assainissement / Nettoyage industriel'))
   OR lower(btrim(sous_segment)) = lower(btrim('Assainissement / Nettoyage industriel'));
