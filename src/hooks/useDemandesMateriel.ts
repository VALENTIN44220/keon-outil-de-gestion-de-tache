import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface DemandeMaterielLine {
  id: string;
  request_id: string;
  request_number: string | null;
  demandeur_id: string | null;
  demandeur_nom: string | null;
  article_id: string | null;
  ref: string;
  des: string;
  quantite: number;
  etat_commande: string;
  created_at: string;
  updated_at: string;
}

const ETATS_COMMANDE = [
  'En attente validation',
  'Demande de devis',
  'Bon de commande envoyé',
  'AR reçu',
  'Commande livrée',
  'Commande distribuée',
] as const;

export function useDemandesMateriel() {
  const { user, profile } = useAuth();
  const [lines, setLines] = useState<DemandeMaterielLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLines = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('demande_materiel')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLines((data || []) as DemandeMaterielLine[]);
    } catch (error) {
      console.error('Error fetching demande materiel:', error);
      toast.error('Erreur lors du chargement des demandes matériel');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const createLines = async (
    requestId: string,
    requestNumber: string | null,
    items: { article_id: string; ref: string; des: string; quantite: number }[]
  ) => {
    if (!profile) return false;

    try {
      const rows = items.map((item) => ({
        request_id: requestId,
        request_number: requestNumber,
        demandeur_id: profile.id,
        demandeur_nom: profile.display_name,
        article_id: item.article_id,
        ref: item.ref,
        des: item.des,
        quantite: item.quantite,
        etat_commande: 'En attente validation',
      }));

      const { error } = await supabase.from('demande_materiel').insert(rows);
      if (error) throw error;

      await fetchLines();
      return true;
    } catch (error) {
      console.error('Error creating material request lines:', error);
      toast.error(`Erreur: ${(error as Error).message}`);
      return false;
    }
  };

  const updateEtat = async (ids: string[], newEtat: string) => {
    try {
      const { error } = await supabase
        .from('demande_materiel')
        .update({ etat_commande: newEtat })
        .in('id', ids);

      if (error) throw error;

      setLines((prev) =>
        prev.map((l) => (ids.includes(l.id) ? { ...l, etat_commande: newEtat } : l))
      );
      toast.success(`${ids.length} ligne(s) mise(s) à jour`);
      return true;
    } catch (error) {
      console.error('Error updating etat:', error);
      toast.error(`Erreur: ${(error as Error).message}`);
      return false;
    }
  };

  const activateLines = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('demande_materiel')
        .update({ etat_commande: 'Demande de devis' })
        .eq('request_id', requestId)
        .eq('etat_commande', 'En attente validation');

      if (error) throw error;
      await fetchLines();
      return true;
    } catch (error) {
      console.error('Error activating lines:', error);
      return false;
    }
  };

  return {
    lines,
    isLoading,
    ETATS_COMMANDE,
    fetchLines,
    createLines,
    updateEtat,
    activateLines,
  };
}
