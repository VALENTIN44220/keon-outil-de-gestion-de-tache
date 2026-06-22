import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ChampType, PilierCode } from '@/config/questionnaireConfig';

export interface FieldDefinition {
  id: string;
  champ_id: string;
  pilier_code: PilierCode;
  section: string;
  sous_section: string | null;
  label: string;
  type: ChampType;
  options: string[] | null;
  note: string | null;
  has_evaluation_risque: boolean;
  required: boolean;
  order_index: number;
  is_builtin: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  spreadsheet_template?: any;
}

export interface SectionGroup {
  section: string;
  sousSections: string[];
  fields: FieldDefinition[];
}

/** Charge toutes les définitions de champs actives pour un pilier donné */
export function useQuestionnaireFieldDefs(pilierCode?: PilierCode | string) {
  return useQuery<FieldDefinition[]>({
    queryKey: ['questionnaire-field-defs', pilierCode ?? 'all'],
    staleTime: 5 * 60 * 1000, // 5 min — les defs changent peu souvent
    queryFn: async () => {
      let query = (supabase as any)
        .from('questionnaire_field_definitions')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (pilierCode) {
        query = query.eq('pilier_code', pilierCode);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Mappe type_champ → type pour compatibilité avec les composants existants
      return (data as any[]).map(row => ({
        ...row,
        type: row.type_champ as ChampType,
      })) as FieldDefinition[];
    },
  });
}

/** Charge toutes les définitions (tous piliers), utile pour useQuestionnaireProjectData */
export function useAllQuestionnaireFieldDefs() {
  return useQuestionnaireFieldDefs(undefined);
}

/**
 * Variante administration : inclut les champs désactivés (is_active=false)
 * afin de pouvoir les ré-activer / supprimer depuis l'onglet Admin.
 */
export function useAdminQuestionnaireFieldDefs(pilierCode?: PilierCode | string) {
  return useQuery<FieldDefinition[]>({
    queryKey: ['questionnaire-field-defs-admin', pilierCode ?? 'all'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let query = (supabase as any)
        .from('questionnaire_field_definitions')
        .select('*')
        .order('order_index', { ascending: true });

      if (pilierCode) query = query.eq('pilier_code', pilierCode);

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map(row => ({ ...row, type: row.type_champ as ChampType })) as FieldDefinition[];
    },
  });
}

/** Regroupe les champs par section/sous-section pour un pilier */
export function groupFieldsBySection(fields: FieldDefinition[]): SectionGroup[] {
  const sections = [...new Set(fields.map(f => f.section))];
  return sections.map(section => {
    const sectionFields = fields.filter(f => f.section === section);
    const sousSections = [
      ...new Set(sectionFields.map(f => f.sous_section).filter(Boolean)),
    ] as string[];
    return { section, sousSections, fields: sectionFields };
  });
}

export interface NewCustomFieldInput {
  pilier_code: PilierCode;
  section: string;
  sous_section?: string;
  label: string;
  type: ChampType;
  options?: string[];
  note?: string;
}

/** Mutation pour ajouter un champ personnalisé */
export function useAddCustomField() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: NewCustomFieldInput) => {
      // Génère un champ_id stable à partir du pilier + label
      const slug = input.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);
      const champ_id = `${input.pilier_code}_CUSTOM_${slug}_${Date.now()}`;

      // Calcule l'order_index = max actuel pour ce pilier+section + 10
      const { data: existing } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .select('order_index')
        .eq('pilier_code', input.pilier_code)
        .eq('section', input.section)
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.order_index ?? 0;

      const { data, error } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .insert({
          champ_id,
          pilier_code: input.pilier_code,
          section: input.section,
          sous_section: input.sous_section || null,
          label: input.label,
          type_champ: input.type,
          options: input.options && input.options.length > 0 ? input.options : null,
          note: input.note || null,
          is_builtin: false,
          is_active: true,
          order_index: maxOrder + 10,
          created_by: profile?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Champ personnalisé ajouté');
      // Invalide le cache pour tous les piliers concernés
      queryClient.invalidateQueries({ queryKey: ['questionnaire-field-defs'] });
    },
    onError: (err: any) => {
      console.error('Erreur ajout champ custom:', err);
      toast.error("Erreur lors de l'ajout du champ");
    },
  });
}

// ─── Mutations d'administration (gestion globale de la structure) ──────────────

function invalidateFieldDefs(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['questionnaire-field-defs'] });
  queryClient.invalidateQueries({ queryKey: ['questionnaire-field-defs-admin'] });
}

export interface UpdateFieldDefInput {
  id: string;
  label?: string;
  type?: ChampType;
  options?: string[] | null;
  note?: string | null;
  required?: boolean;
  has_evaluation_risque?: boolean;
  section?: string;
  sous_section?: string | null;
}

/** Modifie un champ existant (intitulé, type, note, options, section…). */
export function useUpdateFieldDef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateFieldDefInput) => {
      const { id, type, ...rest } = input;
      const patch: Record<string, any> = { ...rest };
      if (type !== undefined) patch.type_champ = type;
      // options vide => null (pour ne garder des options que sur les listes)
      if (patch.options && patch.options.length === 0) patch.options = null;

      const { data, error } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Champ mis à jour');
      invalidateFieldDefs(queryClient);
    },
    onError: (err: any) => {
      console.error('Erreur maj champ:', err);
      toast.error('Erreur lors de la mise à jour du champ');
    },
  });
}

/** Réordonne en lot les champs (réécrit order_index). */
export function useReorderFields() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; order_index: number }>) => {
      // Mise à jour séquentielle (volumes faibles : quelques champs par section).
      for (const it of items) {
        const { error } = await (supabase as any)
          .from('questionnaire_field_definitions')
          .update({ order_index: it.order_index })
          .eq('id', it.id);
        if (error) throw error;
      }
      return true;
    },
    onSuccess: () => invalidateFieldDefs(queryClient),
    onError: (err: any) => {
      console.error('Erreur réordonnancement champs:', err);
      toast.error('Erreur lors du réordonnancement');
    },
  });
}

/** Active / désactive un champ (soft-delete via is_active). */
export function useSetFieldActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: (_d, v) => {
      toast.success(v.is_active ? 'Champ réactivé' : 'Champ désactivé');
      invalidateFieldDefs(queryClient);
    },
    onError: (err: any) => {
      console.error('Erreur activation champ:', err);
      toast.error("Erreur lors du changement d'état du champ");
    },
  });
}

/** Suppression dure d'un champ (à n'utiliser que sans valeurs associées). */
export function useDeleteFieldDef() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success('Champ supprimé');
      invalidateFieldDefs(queryClient);
    },
    onError: (err: any) => {
      console.error('Erreur suppression champ:', err);
      toast.error('Erreur lors de la suppression (des données y sont peut-être rattachées)');
    },
  });
}

export interface AdminCreateFieldInput extends NewCustomFieldInput {
  is_builtin?: boolean;
}

/**
 * Création d'un champ côté administration. Identique à useAddCustomField mais
 * permet de marquer le champ comme « système » (is_builtin) et de le placer
 * dans une section/sous-section précise. Déployé sur toutes les SPV.
 */
export function useAdminCreateField() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (input: AdminCreateFieldInput) => {
      const slug = input.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);
      const champ_id = `${input.pilier_code}_CUSTOM_${slug}_${Date.now()}`;

      const { data: existing } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .select('order_index')
        .eq('pilier_code', input.pilier_code)
        .eq('section', input.section)
        .order('order_index', { ascending: false })
        .limit(1);
      const maxOrder = existing?.[0]?.order_index ?? 0;

      const { data, error } = await (supabase as any)
        .from('questionnaire_field_definitions')
        .insert({
          champ_id,
          pilier_code: input.pilier_code,
          section: input.section,
          sous_section: input.sous_section || null,
          label: input.label,
          type_champ: input.type,
          options: input.options && input.options.length > 0 ? input.options : null,
          note: input.note || null,
          is_builtin: input.is_builtin ?? false,
          is_active: true,
          order_index: maxOrder + 10,
          created_by: profile?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Champ créé');
      invalidateFieldDefs(queryClient);
    },
    onError: (err: any) => {
      console.error('Erreur création champ admin:', err);
      toast.error('Erreur lors de la création du champ');
    },
  });
}
