import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Holiday } from '@/types/workload';
import { toast } from 'sonner';

export function useHolidays(year?: number) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = year || new Date().getFullYear();

  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', `${currentYear}-01-01`)
        .lte('date', `${currentYear}-12-31`)
        .order('date', { ascending: true });
      
      if (error) throw error;
      setHolidays((data || []) as Holiday[]);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast.error('Erreur lors du chargement des jours fériés');
    } finally {
      setIsLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const addHoliday = async (holiday: { date: string; name: string; company_id?: string; is_national?: boolean }) => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .insert({
          date: holiday.date,
          name: holiday.name,
          company_id: holiday.company_id || null,
          is_national: holiday.is_national ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Jour férié ajouté');
      await fetchHolidays();
      return data;
    } catch (error) {
      console.error('Error adding holiday:', error);
      toast.error('Erreur lors de l\'ajout du jour férié');
      throw error;
    }
  };

  const updateHoliday = async (id: string, updates: Partial<Holiday>) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Jour férié mis à jour');
      await fetchHolidays();
    } catch (error) {
      console.error('Error updating holiday:', error);
      toast.error('Erreur lors de la mise à jour du jour férié');
      throw error;
    }
  };

  const deleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Jour férié supprimé');
      await fetchHolidays();
    } catch (error) {
      console.error('Error deleting holiday:', error);
      toast.error('Erreur lors de la suppression du jour férié');
      throw error;
    }
  };

  // Helper to generate French national holidays for a year
  const generateFrenchHolidays = async (targetYear: number) => {
    const frenchHolidays = [
      { date: `${targetYear}-01-01`, name: 'Jour de l\'An' },
      { date: `${targetYear}-05-01`, name: 'Fête du Travail' },
      { date: `${targetYear}-05-08`, name: 'Victoire 1945' },
      { date: `${targetYear}-07-14`, name: 'Fête Nationale' },
      { date: `${targetYear}-08-15`, name: 'Assomption' },
      { date: `${targetYear}-11-01`, name: 'Toussaint' },
      { date: `${targetYear}-11-11`, name: 'Armistice' },
      { date: `${targetYear}-12-25`, name: 'Noël' },
    ];

    // Calculate Easter-based holidays
    const easter = calculateEaster(targetYear);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    const pentecostMonday = new Date(easter);
    pentecostMonday.setDate(easter.getDate() + 50);

    frenchHolidays.push(
      { date: formatDate(easterMonday), name: 'Lundi de Pâques' },
      { date: formatDate(ascension), name: 'Ascension' },
      { date: formatDate(pentecostMonday), name: 'Lundi de Pentecôte' }
    );

    try {
      for (const holiday of frenchHolidays) {
        await supabase
          .from('holidays')
          .upsert({ ...holiday, is_national: true }, { onConflict: 'date,company_id' });
      }
      toast.success(`Jours fériés ${targetYear} générés`);
      await fetchHolidays();
    } catch (error) {
      console.error('Error generating holidays:', error);
      toast.error('Erreur lors de la génération des jours fériés');
    }
  };

  return {
    holidays,
    isLoading,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    generateFrenchHolidays,
    refetch: fetchHolidays,
  };
}

// Helper functions
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
