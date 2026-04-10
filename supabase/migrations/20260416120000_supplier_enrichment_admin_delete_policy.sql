-- Suppression d'une fiche fournisseur : réservée aux utilisateurs ayant le rôle app 'admin' (user_roles).
-- Aligné avec l'UI (bouton visible uniquement pour les admins).

CREATE POLICY "Admins can delete supplier enrichment"
ON public.supplier_purchase_enrichment
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
);
