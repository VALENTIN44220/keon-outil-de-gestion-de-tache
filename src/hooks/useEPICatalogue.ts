import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  EPIArticle, EPIArticleTaille, EPIProfilArticle,
  EPICategorie, EPIProfil, EPICatalogueItem,
} from '@/types/epi';

export function useEPICatalogue(profilFilter?: EPIProfil, categorieFilter?: EPICategorie, includeInactive = false) {
  const { user } = useAuth();
  const [articles, setArticles] = useState<EPICatalogueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCatalogue = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let artQuery = supabase.from('epi_articles' as any).select('*').order('order_index');
      if (!includeInactive) artQuery = artQuery.eq('is_active', true);
      const { data: articlesData, error: artErr } = await artQuery;
      if (artErr) throw artErr;

      let tailQuery = supabase.from('epi_article_tailles' as any).select('*');
      if (!includeInactive) tailQuery = tailQuery.eq('is_active', true);
      const { data: taillesData, error: tailErr } = await tailQuery;
      if (tailErr) throw tailErr;

      const { data: profilData, error: profErr } = await supabase
        .from('epi_profil_articles' as any)
        .select('*');
      if (profErr) throw profErr;

      const allArticles = (articlesData || []) as unknown as EPIArticle[];
      const allTailles = (taillesData || []) as unknown as EPIArticleTaille[];
      const allProfils = (profilData || []) as unknown as EPIProfilArticle[];

      const taillesMap = new Map<string, EPIArticleTaille[]>();
      for (const t of allTailles) {
        const arr = taillesMap.get(t.article_id) || [];
        arr.push(t);
        taillesMap.set(t.article_id, arr);
      }

      const profilMap = new Map<string, EPIProfilArticle[]>();
      for (const p of allProfils) {
        const key = `${p.profil}::${p.article_id}`;
        const arr = profilMap.get(key) || [];
        arr.push(p);
        profilMap.set(key, arr);
      }

      let result: EPICatalogueItem[] = allArticles.map((art) => ({
        ...art,
        tailles: taillesMap.get(art.id) || [],
        eligibilite: profilFilter
          ? (profilMap.get(`${profilFilter}::${art.id}`)?.[0] ?? null)
          : null,
      }));

      if (categorieFilter) {
        result = result.filter((a) => a.categorie === categorieFilter);
      }

      if (profilFilter && profilFilter !== 'non_concerne') {
        result = result.filter((a) => a.eligibilite !== null);
      }

      setArticles(result);
    } catch (e) {
      console.error('useEPICatalogue:', e);
      toast.error('Erreur chargement catalogue EPI');
    } finally {
      setIsLoading(false);
    }
  }, [user, profilFilter, categorieFilter, includeInactive]);

  useEffect(() => {
    void fetchCatalogue();
  }, [fetchCatalogue]);

  return { articles, isLoading, refetch: fetchCatalogue };
}
