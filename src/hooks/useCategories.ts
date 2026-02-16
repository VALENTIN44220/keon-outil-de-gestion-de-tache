import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Category, Subcategory, CategoryWithSubcategories } from '@/types/category';
import { toast } from 'sonner';

export function useCategories() {
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCategories = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      // Fetch categories
      const categoriesQuery = supabase
        .from('categories')
        .select('*')
        .order('name');
      if (signal) categoriesQuery.abortSignal(signal);
      const { data: categoriesData, error: categoriesError } = await categoriesQuery;

      if (categoriesError) throw categoriesError;

      // Fetch subcategories
      const subcategoriesQuery = supabase
        .from('subcategories')
        .select('*')
        .order('name');
      if (signal) subcategoriesQuery.abortSignal(signal);
      const { data: subcategoriesData, error: subcategoriesError } = await subcategoriesQuery;

      if (subcategoriesError) throw subcategoriesError;

      // Combine categories with their subcategories
      const categoriesWithSubs: CategoryWithSubcategories[] = (categoriesData || []).map(cat => ({
        ...cat,
        subcategories: (subcategoriesData || []).filter(sub => sub.category_id === cat.id),
      }));

      setCategories(categoriesWithSubs);
    } catch (error: any) {
      // Ignore abort errors (component unmount)
      if (error?.name === 'AbortError' || error?.message?.includes('AbortError')) return;
      console.error('Error fetching categories:', error);
      toast.error('Erreur lors du chargement des catégories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal);
    return () => controller.abort();
  }, [fetchCategories]);

  const addCategory = async (name: string, description?: string): Promise<Category | undefined> => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name, description: description || null })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, { ...data, subcategories: [] }]);
      toast.success('Catégorie créée avec succès');
      return data;
    } catch (error: any) {
      console.error('Error adding category:', error);
      if (error.code === '23505') {
        toast.error('Cette catégorie existe déjà');
      } else {
        toast.error('Erreur lors de la création de la catégorie');
      }
    }
  };

  const addSubcategory = async (
    categoryId: string, 
    name: string, 
    description?: string
  ): Promise<Subcategory | undefined> => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .insert({ 
          category_id: categoryId, 
          name, 
          description: description || null 
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => 
        prev.map(cat => {
          if (cat.id === categoryId) {
            return {
              ...cat,
              subcategories: [...cat.subcategories, data],
            };
          }
          return cat;
        })
      );
      toast.success('Sous-catégorie créée avec succès');
      return data;
    } catch (error: any) {
      console.error('Error adding subcategory:', error);
      if (error.code === '23505') {
        toast.error('Cette sous-catégorie existe déjà pour cette catégorie');
      } else {
        toast.error('Erreur lors de la création de la sous-catégorie');
      }
    }
  };

  const updateCategory = async (id: string, name: string, description?: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name, description: description || null })
        .eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name, description: description || null } : c));
      toast.success('Catégorie modifiée');
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Catégorie supprimée');
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error.message?.includes('foreign') ? 'Impossible de supprimer : catégorie utilisée' : 'Erreur lors de la suppression');
    }
  };

  const updateSubcategory = async (id: string, categoryId: string, name: string, description?: string) => {
    try {
      const { error } = await supabase
        .from('subcategories')
        .update({ name, description: description || null })
        .eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.map(cat => {
        if (cat.id === categoryId) {
          return { ...cat, subcategories: cat.subcategories.map(s => s.id === id ? { ...s, name, description: description || null } : s) };
        }
        return cat;
      }));
      toast.success('Sous-catégorie modifiée');
    } catch (error: any) {
      console.error('Error updating subcategory:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const deleteSubcategory = async (id: string, categoryId: string) => {
    try {
      const { error } = await supabase.from('subcategories').delete().eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.map(cat => {
        if (cat.id === categoryId) {
          return { ...cat, subcategories: cat.subcategories.filter(s => s.id !== id) };
        }
        return cat;
      }));
      toast.success('Sous-catégorie supprimée');
    } catch (error: any) {
      console.error('Error deleting subcategory:', error);
      toast.error(error.message?.includes('foreign') ? 'Impossible de supprimer : sous-catégorie utilisée' : 'Erreur lors de la suppression');
    }
  };

  const getSubcategoriesByCategoryId = (categoryId: string): Subcategory[] => {
    const category = categories.find(c => c.id === categoryId);
    return category?.subcategories || [];
  };

  return {
    categories,
    isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    getSubcategoriesByCategoryId,
    refetch: fetchCategories,
  };
}
