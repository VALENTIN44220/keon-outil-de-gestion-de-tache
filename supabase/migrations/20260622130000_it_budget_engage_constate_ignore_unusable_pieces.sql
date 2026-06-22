-- =========================================================================
-- IT Budget — fiabilisation engagé / constaté
-- =========================================================================
-- Règle métier : le rattachement Divalto se faisant par n° de pièce, une pièce
-- sans n° ('0' ou vide) est inexploitable — le bucket fourre-tout '0' agrège
-- des milliers de mouvements de tiers différents. On exclut donc toute pièce
-- sans n° des montants engagé / constaté (cohérent avec le garde côté front,
-- useITBudgetRapprochement.isUnusablePiece, qui la retire aussi du rapprochement).
-- =========================================================================
CREATE OR REPLACE VIEW public.v_it_budget_engage_constate AS
 WITH piece_commandes AS (
         SELECT divalto_mouvements_all.numero_piece,
            sum(divalto_mouvements_all.montant_ht) AS montant_ht
           FROM divalto_mouvements_all
          WHERE divalto_mouvements_all.doc_type = 'commande'::text
            AND btrim(COALESCE(divalto_mouvements_all.numero_piece, '')) <> ALL (ARRAY['', '0'])
          GROUP BY divalto_mouvements_all.numero_piece
        ), piece_factures AS (
         SELECT divalto_mouvements_all.numero_piece,
            sum(divalto_mouvements_all.montant_ht) AS montant_ht
           FROM divalto_mouvements_all
          WHERE divalto_mouvements_all.doc_type = 'facture'::text
            AND btrim(COALESCE(divalto_mouvements_all.numero_piece, '')) <> ALL (ARRAY['', '0'])
          GROUP BY divalto_mouvements_all.numero_piece
        )
 SELECT l.id AS budget_line_id,
    l.it_project_id,
    l.annee,
    l.entite,
    l.categorie,
    l.fournisseur_prevu,
    COALESCE(sum(pc.montant_ht) FILTER (WHERE lc.id IS NOT NULL), 0::numeric) AS engage,
    COALESCE(sum(pf.montant_ht) FILTER (WHERE lf.id IS NOT NULL), 0::numeric) AS constate,
    count(DISTINCT lc.id) AS nb_commandes,
    count(DISTINCT lf.id) AS nb_factures
   FROM it_budget_lines l
     LEFT JOIN it_budget_line_commandes lc ON lc.budget_line_id = l.id
     LEFT JOIN piece_commandes pc ON pc.numero_piece = lc.fullcdno
     LEFT JOIN it_budget_line_factures lf ON lf.budget_line_id = l.id
     LEFT JOIN piece_factures pf ON pf.numero_piece = lf.fullcdno_fac
  GROUP BY l.id, l.it_project_id, l.annee, l.entite, l.categorie, l.fournisseur_prevu;
