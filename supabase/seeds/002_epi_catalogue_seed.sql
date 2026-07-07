-- ═══════════════════════════════════════════════════════════════════
-- Seed : Catalogue EPI (articles, tailles, éligibilité profil)
-- Source : Catalogue EPI V4 Excel + Références Sycomore
-- ═══════════════════════════════════════════════════════════════════

-- ─── Articles EPI ──────────────────────────────────────────────────
-- categorie: classique | atex | accessoire | casque
-- type_flocage: aucun | broderie_coeur | marquage_coeur
-- prix_flocage: classique=1.86 (marquage) ou 3.29 (broderie), atex=5.65 (broderie)

INSERT INTO public.epi_articles (id, designation, categorie, norme, caracteristiques, type_flocage, prix_flocage, frequence_renouvellement, order_index)
VALUES
  -- CASQUES
  ('a0000001-0000-4000-8000-000000000001', 'Casquette coquée', 'classique', 'EN 812', 'Coquée, Orange', 'aucun', 0, '3 ans', 1),
  ('a0000001-0000-4000-8000-000000000002', 'Casquette coquée ATEX', 'atex', 'EN 812', 'Coquée, Orange', 'aucun', 0, '3 ans', 2),
  ('a0000001-0000-4000-8000-000000000003', 'Casque chantier', 'casque', 'EN 812', 'Porte carte, jugulaire simple, Modulable', 'aucun', 0, '3 ans', 3),
  ('a0000001-0000-4000-8000-000000000004', 'Coquille anti-bruit casque', 'casque', NULL, 'Coquille anti-bruit pour casque chantier', 'aucun', 0, NULL, 4),
  ('a0000001-0000-4000-8000-000000000005', 'Jugulaire 4 points', 'casque', NULL, 'Jugulaire 4 points pour casque chantier', 'aucun', 0, NULL, 5),
  ('a0000001-0000-4000-8000-000000000006', 'Visière électrique casque', 'casque', NULL, 'Visière électrique + jugulaire + adaptation coquille anti-bruit', 'aucun', 0, NULL, 6),
  -- VÊTEMENTS CLASSIQUES
  ('a0000001-0000-4000-8000-000000000010', 'Parka haute visibilité', 'classique', 'EN ISO 20471', 'Type soft shell, Capuche + poche, Orange', 'broderie_coeur', 3.29, '3-4 ans', 10),
  ('a0000001-0000-4000-8000-000000000011', 'Veste de pluie', 'classique', NULL, 'Capuche, Poche, Orange', 'broderie_coeur', 3.29, '5 ans', 11),
  ('a0000001-0000-4000-8000-000000000012', 'Gilet haute visibilité', 'classique', 'EN ISO 20471', 'Scratch, Sans poche, Orange', 'broderie_coeur', 3.29, '5 ans', 12),
  ('a0000001-0000-4000-8000-000000000013', 'T-shirt manches courtes', 'classique', NULL, 'Coton, Orange', 'broderie_coeur', 3.29, '1 an', 13),
  ('a0000001-0000-4000-8000-000000000014', 'T-shirt manches longues', 'classique', NULL, 'Coton, Orange', 'broderie_coeur', 3.29, '1 an', 14),
  ('a0000001-0000-4000-8000-000000000015', 'Sweat', 'classique', NULL, 'Coton, Orange', 'broderie_coeur', 3.29, '1 an', 15),
  ('a0000001-0000-4000-8000-000000000016', 'Pantalon EPI', 'classique', NULL, 'Couleur foncée, Poche genouillères, Poches sur les cuisses', 'aucun', 0, '1 an', 16),
  -- VÊTEMENTS ATEX
  ('a0000001-0000-4000-8000-000000000020', 'Parka haute visibilité ATEX', 'atex', 'EN ISO 20471', 'Type soft shell, Capuche + poche, Orange', 'broderie_coeur', 5.65, '2 ans', 20),
  ('a0000001-0000-4000-8000-000000000021', 'Veste de pluie ATEX', 'atex', NULL, 'Capuche, Poche, Orange', 'broderie_coeur', 5.65, '2 ans', 21),
  ('a0000001-0000-4000-8000-000000000022', 'Gilet haute visibilité ATEX', 'atex', 'EN ISO 20471', 'Avec poche, Orange', 'broderie_coeur', 5.65, '3-4 ans', 22),
  ('a0000001-0000-4000-8000-000000000023', 'T-shirt manches longues ATEX', 'atex', NULL, 'Coton, Orange', 'broderie_coeur', 5.65, '1 an', 23),
  ('a0000001-0000-4000-8000-000000000024', 'Sweat ATEX', 'atex', 'EN ISO 20471', 'Coton, Orange', 'broderie_coeur', 5.65, '1 an', 24),
  ('a0000001-0000-4000-8000-000000000025', 'Pantalon ATEX', 'atex', NULL, 'Couleur foncée, Poche genouillères, Poches sur les cuisses', 'aucun', 0, '1 an', 25),
  -- ACCESSOIRES
  ('a0000001-0000-4000-8000-000000000030', 'Lunettes de protection', 'accessoire', 'EN 166', 'Lunettes de sécurité', 'aucun', 0, NULL, 30),
  ('a0000001-0000-4000-8000-000000000031', 'Casque anti-bruit', 'accessoire', 'EN 352-1', NULL, 'aucun', 0, NULL, 31),
  ('a0000001-0000-4000-8000-000000000032', 'Masque à cartouche', 'accessoire', NULL, NULL, 'aucun', 0, NULL, 32),
  ('a0000001-0000-4000-8000-000000000033', 'Gants anti-coupure', 'accessoire', 'ISO 13997', NULL, 'aucun', 0, NULL, 33),
  ('a0000001-0000-4000-8000-000000000034', 'Gants électrique', 'accessoire', 'EN 60903', NULL, 'aucun', 0, NULL, 34),
  ('a0000001-0000-4000-8000-000000000035', 'Bouchons d''oreilles', 'accessoire', 'EN 352-2', NULL, 'aucun', 0, NULL, 35),
  ('a0000001-0000-4000-8000-000000000036', 'Cartouche masque (charbon actif)', 'accessoire', NULL, NULL, 'aucun', 0, NULL, 36),
  ('a0000001-0000-4000-8000-000000000037', 'Harnais', 'accessoire', 'EN 361', NULL, 'aucun', 0, NULL, 37),
  ('a0000001-0000-4000-8000-000000000038', 'Tapis isolant', 'accessoire', 'NF EN 61111', NULL, 'aucun', 0, NULL, 38),
  ('a0000001-0000-4000-8000-000000000039', 'Masque à souder', 'accessoire', NULL, NULL, 'aucun', 0, NULL, 39),
  ('a0000001-0000-4000-8000-000000000040', 'Chaussures de protection', 'accessoire', NULL, 'Montantes, sécurité', 'aucun', 0, NULL, 40),
  ('a0000001-0000-4000-8000-000000000041', 'Bottes de sécurité (Waders)', 'accessoire', NULL, NULL, 'aucun', 0, NULL, 41)
ON CONFLICT DO NOTHING;

-- ─── Tailles et références Sycomore ────────────────────────────────
-- Casquette coquée classique (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'unique', 'ASM00035', 17.10)
ON CONFLICT DO NOTHING;

-- Casque chantier (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000003', 'unique', 'ASM00832', 18.73)
ON CONFLICT DO NOTHING;

-- Coquille anti-bruit (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000004', 'unique', 'ASM00053', 19.09)
ON CONFLICT DO NOTHING;

-- Jugulaire 4 points (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000005', 'unique', 'ASM00052', 8.80)
ON CONFLICT DO NOTHING;

-- Visière électrique (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000006', 'unique', 'ASM00719', 0)
ON CONFLICT DO NOTHING;

-- Parka HV classique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000010', 'S-36', 'ASM00135', 31.99),
  ('a0000001-0000-4000-8000-000000000010', 'M-38', 'ASM00026', 31.99),
  ('a0000001-0000-4000-8000-000000000010', 'L-40', 'ASM00027', 31.99),
  ('a0000001-0000-4000-8000-000000000010', 'XL-42', 'ASM00025', 31.99),
  ('a0000001-0000-4000-8000-000000000010', 'XXL-44', 'ASM00137', 31.99),
  ('a0000001-0000-4000-8000-000000000010', 'XXXL-46', 'ASM00138', 31.99)
ON CONFLICT DO NOTHING;

-- Veste de pluie classique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000011', 'S-36', 'ASM00102', 47.06),
  ('a0000001-0000-4000-8000-000000000011', 'M-38', 'ASM00100', 47.06),
  ('a0000001-0000-4000-8000-000000000011', 'L-40', 'ASM00101', 47.06),
  ('a0000001-0000-4000-8000-000000000011', 'XL-42', 'ASM00099', 47.06),
  ('a0000001-0000-4000-8000-000000000011', 'XXL-44', 'ASM00098', 47.06),
  ('a0000001-0000-4000-8000-000000000011', 'XXXL-46', 'ASM00141', 47.06)
ON CONFLICT DO NOTHING;

-- Gilet HV classique (TL et TXL seulement dans les refs)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000012', 'S-36', 'ASM00834', 2.55),
  ('a0000001-0000-4000-8000-000000000012', 'M-38', 'ASM00834', 2.55),
  ('a0000001-0000-4000-8000-000000000012', 'L-40', 'ASM00834', 2.55),
  ('a0000001-0000-4000-8000-000000000012', 'XL-42', 'ASM00069', 2.55),
  ('a0000001-0000-4000-8000-000000000012', 'XXL-44', 'ASM00069', 2.55),
  ('a0000001-0000-4000-8000-000000000012', 'XXXL-46', 'ASM00069', 2.55)
ON CONFLICT DO NOTHING;

-- T-shirt MC classique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000013', 'S-36', 'ASM00105', 16.00),
  ('a0000001-0000-4000-8000-000000000013', 'M-38', 'ASM00723', 16.00),
  ('a0000001-0000-4000-8000-000000000013', 'L-40', 'ASM00016', 16.00),
  ('a0000001-0000-4000-8000-000000000013', 'XL-42', 'ASM00017', 16.00),
  ('a0000001-0000-4000-8000-000000000013', 'XXL-44', 'ASM00018', 16.00),
  ('a0000001-0000-4000-8000-000000000013', 'XXXL-46', 'ASM00144', 16.00)
ON CONFLICT DO NOTHING;

-- T-shirt ML classique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000014', 'S-36', 'ASM00104', 22.04),
  ('a0000001-0000-4000-8000-000000000014', 'M-38', 'ASM00091', 22.04),
  ('a0000001-0000-4000-8000-000000000014', 'L-40', 'ASM00090', 22.04),
  ('a0000001-0000-4000-8000-000000000014', 'XL-42', 'ASM00092', 22.04),
  ('a0000001-0000-4000-8000-000000000014', 'XXL-44', 'ASM00143', 22.04)
ON CONFLICT DO NOTHING;

-- Sweat classique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000015', 'S-36', 'ASM00106', 42.60),
  ('a0000001-0000-4000-8000-000000000015', 'M-38', 'ASM00107', 42.60),
  ('a0000001-0000-4000-8000-000000000015', 'L-40', 'ASM00108', 42.60),
  ('a0000001-0000-4000-8000-000000000015', 'XL-42', 'ASM00109', 42.60),
  ('a0000001-0000-4000-8000-000000000015', 'XXL-44', 'ASM00110', 42.60)
ON CONFLICT DO NOTHING;

-- Pantalon classique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000016', 'M-38', 'ASM00467', 34.33),
  ('a0000001-0000-4000-8000-000000000016', 'L-40', 'ASM00013', 34.33),
  ('a0000001-0000-4000-8000-000000000016', 'XL-42', 'ASM00014', 34.33),
  ('a0000001-0000-4000-8000-000000000016', 'XXL-44', 'ASM00015', 34.33),
  ('a0000001-0000-4000-8000-000000000016', 'XXXL-46', 'ASM00722', 34.33),
  ('a0000001-0000-4000-8000-000000000016', 'XXXXL-48-50', 'ASM00466', 34.33)
ON CONFLICT DO NOTHING;

-- Parka HV ATEX
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000020', 'S-36', 'ASM00139', 119.19),
  ('a0000001-0000-4000-8000-000000000020', 'M-38', 'ASM00730', 119.19),
  ('a0000001-0000-4000-8000-000000000020', 'L-40', 'ASM00731', 119.19),
  ('a0000001-0000-4000-8000-000000000020', 'XL-42', 'ASM00732', 119.19),
  ('a0000001-0000-4000-8000-000000000020', 'XXL-44', 'ASM00136', 119.19),
  ('a0000001-0000-4000-8000-000000000020', 'XXXL-46', 'ASM00140', 119.19)
ON CONFLICT DO NOTHING;

-- Veste de pluie ATEX
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000021', 'S-36', 'ASM00097', 162.07),
  ('a0000001-0000-4000-8000-000000000021', 'M-38', 'ASM00094', 162.07),
  ('a0000001-0000-4000-8000-000000000021', 'L-40', 'ASM00093', 162.07),
  ('a0000001-0000-4000-8000-000000000021', 'XL-42', 'ASM00095', 162.07),
  ('a0000001-0000-4000-8000-000000000021', 'XXL-44', 'ASM00096', 162.07),
  ('a0000001-0000-4000-8000-000000000021', 'XXXL-46', 'ASM00142', 162.07)
ON CONFLICT DO NOTHING;

-- Gilet HV ATEX
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000022', 'L-40', 'ASM00116', 44.40),
  ('a0000001-0000-4000-8000-000000000022', 'XL-42', 'ASM00117', 44.40)
ON CONFLICT DO NOTHING;

-- T-shirt ML ATEX
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000023', 'S-36', 'ASM00103', 56.74),
  ('a0000001-0000-4000-8000-000000000023', 'M-38', 'ASM00087', 56.74),
  ('a0000001-0000-4000-8000-000000000023', 'L-40', 'ASM00086', 56.74),
  ('a0000001-0000-4000-8000-000000000023', 'XL-42', 'ASM00088', 56.74),
  ('a0000001-0000-4000-8000-000000000023', 'XXL-44', 'ASM00089', 56.74),
  ('a0000001-0000-4000-8000-000000000023', 'XXXL-46', 'ASM00145', 56.74)
ON CONFLICT DO NOTHING;

-- Sweat ATEX
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000024', 'S-36', 'ASM00111', 83.87),
  ('a0000001-0000-4000-8000-000000000024', 'M-38', 'ASM00112', 83.87),
  ('a0000001-0000-4000-8000-000000000024', 'L-40', 'ASM00113', 83.87),
  ('a0000001-0000-4000-8000-000000000024', 'XL-42', 'ASM00114', 83.87),
  ('a0000001-0000-4000-8000-000000000024', 'XXL-44', 'ASM00115', 83.87),
  ('a0000001-0000-4000-8000-000000000024', 'XXXL-46', 'ASM00146', 83.87)
ON CONFLICT DO NOTHING;

-- Pantalon ATEX
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000025', 'S-36', 'ASM00726', 35.07),
  ('a0000001-0000-4000-8000-000000000025', 'M-38', 'ASM00727', 35.07),
  ('a0000001-0000-4000-8000-000000000025', 'L-40', 'ASM00728', 35.07),
  ('a0000001-0000-4000-8000-000000000025', 'XL-42', 'ASM00729', 35.07),
  ('a0000001-0000-4000-8000-000000000025', 'XXL-44', 'ASM00147', 35.07),
  ('a0000001-0000-4000-8000-000000000025', 'XXXL-46', 'ASM00148', 35.07),
  ('a0000001-0000-4000-8000-000000000025', 'XXXXL-48-50', 'ASM00149', 35.07)
ON CONFLICT DO NOTHING;

-- Lunettes de protection (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000030', 'unique', 'ASM00130', 1.48)
ON CONFLICT DO NOTHING;

-- Casque anti-bruit (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000031', 'unique', 'ASM00833', 0)
ON CONFLICT DO NOTHING;

-- Gants anti-coupure
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000033', 'T8', 'ASM00462', 0),
  ('a0000001-0000-4000-8000-000000000033', 'T9', 'ASM00463', 0),
  ('a0000001-0000-4000-8000-000000000033', 'T10', 'ASM00012', 0),
  ('a0000001-0000-4000-8000-000000000033', 'T11', 'ASM00718', 0)
ON CONFLICT DO NOTHING;

-- Gants électrique
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000034', 'T9', 'ASM00703', 0),
  ('a0000001-0000-4000-8000-000000000034', 'T10', 'ASM00068', 0)
ON CONFLICT DO NOTHING;

-- Bouchons d'oreilles (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000035', 'unique', 'ASM00035', 0)
ON CONFLICT DO NOTHING;

-- Harnais (taille unique)
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000037', 'unique', 'ASM00037', 0)
ON CONFLICT DO NOTHING;

-- Chaussures de protection
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000040', 'T37', 'ASM00118', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T38', 'ASM00119', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T39', 'ASM00120', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T40', 'ASM00121', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T41', 'ASM00122', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T42', 'ASM00123', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T43', 'ASM00124', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T44', 'ASM00125', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T45', 'ASM00126', 0),
  ('a0000001-0000-4000-8000-000000000040', 'T46', 'ASM00127', 0)
ON CONFLICT DO NOTHING;

-- Waders / Bottes
INSERT INTO public.epi_article_tailles (article_id, taille, ref_sycomore, prix_achat) VALUES
  ('a0000001-0000-4000-8000-000000000041', 'T40', 'ASM00836', 0),
  ('a0000001-0000-4000-8000-000000000041', 'T41', 'ASM00036', 0),
  ('a0000001-0000-4000-8000-000000000041', 'T42', 'ASM00037', 0),
  ('a0000001-0000-4000-8000-000000000041', 'T43', 'ASM00038', 0),
  ('a0000001-0000-4000-8000-000000000041', 'T44', 'ASM00039', 0),
  ('a0000001-0000-4000-8000-000000000041', 'T45', 'ASM00042', 0),
  ('a0000001-0000-4000-8000-000000000041', 'T46', 'ASM00043', 0)
ON CONFLICT DO NOTHING;

-- ─── Matrice éligibilité profil ↔ article ──────────────────────────
-- Profils: visite, intervenant, operation_non_atex, encadrement_atex, operationnel_atex
-- (non_concerne n'a aucun article éligible)

-- VISITE : casquette coquée classique uniquement
INSERT INTO public.epi_profil_articles (profil, article_id, dotation_multiplicateur, max_quantite) VALUES
  ('visite', 'a0000001-0000-4000-8000-000000000001', 1, 1)  -- Casquette coquée
ON CONFLICT DO NOTHING;

-- INTERVENANT : vêtements classiques + casquette coquée
INSERT INTO public.epi_profil_articles (profil, article_id, dotation_multiplicateur, max_quantite) VALUES
  ('intervenant', 'a0000001-0000-4000-8000-000000000001', 1, 1),  -- Casquette coquée
  ('intervenant', 'a0000001-0000-4000-8000-000000000010', 1, 1),  -- Parka HV
  ('intervenant', 'a0000001-0000-4000-8000-000000000011', 1, 1),  -- Veste de pluie
  ('intervenant', 'a0000001-0000-4000-8000-000000000012', 1, 1),  -- Gilet HV
  ('intervenant', 'a0000001-0000-4000-8000-000000000013', 5, 2),  -- T-shirt MC (dotation=5)
  ('intervenant', 'a0000001-0000-4000-8000-000000000014', 5, 2),  -- T-shirt ML (dotation=5)
  ('intervenant', 'a0000001-0000-4000-8000-000000000015', 2, 2),  -- Sweat
  ('intervenant', 'a0000001-0000-4000-8000-000000000016', 2, 2)   -- Pantalon
ON CONFLICT DO NOTHING;

-- OPÉRATION NON ATEX : comme intervenant + casque + accessoires terrain
INSERT INTO public.epi_profil_articles (profil, article_id, dotation_multiplicateur, max_quantite) VALUES
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000001', 1, 1),  -- Casquette coquée
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000003', 1, 1),  -- Casque chantier
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000004', 1, 1),  -- Coquille anti-bruit
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000005', 1, 1),  -- Jugulaire
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000010', 1, 1),  -- Parka HV
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000011', 1, 1),  -- Veste de pluie
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000012', 1, 1),  -- Gilet HV
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000013', 5, 2),  -- T-shirt MC
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000014', 5, 2),  -- T-shirt ML
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000015', 2, 2),  -- Sweat
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000016', 2, 2),  -- Pantalon
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000030', 1, 5),  -- Lunettes
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000033', 1, 1),  -- Gants anti-coupure
  ('operation_non_atex', 'a0000001-0000-4000-8000-000000000035', 1, 5)   -- Bouchons
ON CONFLICT DO NOTHING;

-- ENCADREMENT ATEX : casquette ATEX + vêtements ATEX + casque + accessoires
INSERT INTO public.epi_profil_articles (profil, article_id, dotation_multiplicateur, max_quantite) VALUES
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000002', 1, 1),  -- Casquette ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000003', 1, 1),  -- Casque chantier
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000004', 1, 1),  -- Coquille
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000005', 1, 1),  -- Jugulaire
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000020', 1, 1),  -- Parka ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000021', 1, 1),  -- Veste pluie ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000022', 1, 1),  -- Gilet ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000023', 5, 2),  -- T-shirt ML ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000024', 2, 2),  -- Sweat ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000025', 3, 2),  -- Pantalon ATEX
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000030', 1, 5),  -- Lunettes
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000033', 1, 1),  -- Gants anti-coupure
  ('encadrement_atex', 'a0000001-0000-4000-8000-000000000035', 1, 5)   -- Bouchons
ON CONFLICT DO NOTHING;

-- OPÉRATIONNEL ATEX : encadrement ATEX + accessoires spécialisés (gants élec, harnais, etc.)
INSERT INTO public.epi_profil_articles (profil, article_id, dotation_multiplicateur, max_quantite) VALUES
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000002', 1, 1),  -- Casquette ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000003', 1, 1),  -- Casque chantier
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000004', 1, 1),  -- Coquille
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000005', 1, 1),  -- Jugulaire
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000006', 1, 1),  -- Visière élec
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000020', 1, 1),  -- Parka ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000021', 1, 1),  -- Veste pluie ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000022', 1, 1),  -- Gilet ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000023', 5, 2),  -- T-shirt ML ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000024', 2, 2),  -- Sweat ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000025', 3, 2),  -- Pantalon ATEX
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000030', 1, 5),  -- Lunettes
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000031', 1, 1),  -- Casque anti-bruit
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000032', 1, 1),  -- Masque cartouche
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000033', 1, 1),  -- Gants anti-coupure
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000034', 1, 1),  -- Gants électrique
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000035', 1, 5),  -- Bouchons
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000036', 1, 2),  -- Cartouche masque
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000037', 1, 1),  -- Harnais
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000038', 1, 1),  -- Tapis isolant
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000039', 1, 1),  -- Masque à souder
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000040', 1, 1),  -- Chaussures
  ('operationnel_atex', 'a0000001-0000-4000-8000-000000000041', 1, 1)   -- Bottes/Waders
ON CONFLICT DO NOTHING;

-- ─── Liaison EPI ↔ articles Divalto ───────────────────────────────
-- Peuple article_divalto_id en joignant sur ref_sycomore = articles.ref.
-- La table articles peut contenir des doublons par ref ; on prend le 1er
-- (DISTINCT ON) pour éviter les ambiguïtés.
UPDATE public.epi_article_tailles eat
SET article_divalto_id = sub.art_id
FROM (
  SELECT DISTINCT ON (ref) ref, id AS art_id
  FROM public.articles
  WHERE ref LIKE 'ASM%' OR ref LIKE 'AM%'
  ORDER BY ref, created_at DESC
) sub
WHERE eat.ref_sycomore = sub.ref
  AND eat.article_divalto_id IS NULL;
