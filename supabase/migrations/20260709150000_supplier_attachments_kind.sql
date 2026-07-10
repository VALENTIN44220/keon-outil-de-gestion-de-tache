-- Typage des pièces jointes de la fiche fournisseur (RIB, Kbis/SIRET, Contrat, Autre).
-- Permet de classer et d'afficher le type de chaque PJ sur la fiche, et de
-- préserver le type d'origine (rib / justificatif_siret) lors de la promotion
-- d'une demande vers le référentiel.
ALTER TABLE public.supplier_attachments
  ADD COLUMN IF NOT EXISTS attachment_kind text;
