import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AssignmentRule } from '@/types/task';

export function useAssignmentRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    const { data, error } = await supabase
      .from('assignment_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching assignment rules:', error);
    } else {
      setRules(data as AssignmentRule[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const addRule = async (rule: Omit<AssignmentRule, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('assignment_rules')
      .insert(rule)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer la règle',
        variant: 'destructive',
      });
      throw error;
    }

    setRules(prev => [...prev, data as AssignmentRule]);
    toast({
      title: 'Règle créée',
      description: 'La règle d\'affectation a été créée',
    });
    return data as AssignmentRule;
  };

  const updateRule = async (id: string, updates: Partial<Omit<AssignmentRule, 'id' | 'created_at' | 'updated_at'>>) => {
    const { data, error } = await supabase
      .from('assignment_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de modifier la règle',
        variant: 'destructive',
      });
      throw error;
    }

    setRules(prev => prev.map(r => r.id === id ? data as AssignmentRule : r));
    toast({
      title: 'Règle modifiée',
      description: 'La règle d\'affectation a été mise à jour',
    });
    return data as AssignmentRule;
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from('assignment_rules')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer la règle',
        variant: 'destructive',
      });
      throw error;
    }

    setRules(prev => prev.filter(r => r.id !== id));
    toast({
      title: 'Règle supprimée',
      description: 'La règle d\'affectation a été supprimée',
    });
  };

  // Find matching rule for a category/subcategory
  const findMatchingRule = (categoryId: string | null, subcategoryId: string | null): AssignmentRule | null => {
    // Sort by priority (higher first) and specificity (subcategory match > category match)
    const activeRules = rules.filter(r => r.is_active);
    
    // First try to find exact subcategory match
    if (subcategoryId) {
      const subcatMatch = activeRules.find(r => r.subcategory_id === subcategoryId);
      if (subcatMatch) return subcatMatch;
    }
    
    // Then try category match
    if (categoryId) {
      const catMatch = activeRules.find(r => r.category_id === categoryId && !r.subcategory_id);
      if (catMatch) return catMatch;
    }
    
    return null;
  };

  return {
    rules,
    isLoading,
    addRule,
    updateRule,
    deleteRule,
    findMatchingRule,
    refetch: fetchRules,
  };
}
