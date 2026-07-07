import { useEffect, useId } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulation } from '@/contexts/SimulationContext';
import type { CGISession, CGIParticipant } from '@/types/cgi';
import type { Task } from '@/types/task';

const db = () => supabase as any;

const SESSION_KEY = ['cgi-sessions'];
const ALL_ACTIONS_KEY = ['cgi-all-actions'];
const ACTIONS_KEY = (sessionId: string) => ['cgi-actions', sessionId];

function useActiveProfile() {
  const { profile: authProfile, user } = useAuth();
  const { getActiveProfile } = useSimulation();
  const profile = getActiveProfile() ?? authProfile;
  return { profile, user };
}

// ─── Sessions ────────────────────────────────────────────────────

export function useCGISessions() {
  const qc = useQueryClient();
  const instanceId = useId();

  const query = useQuery<CGISession[]>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const { data, error } = await db()
        .from('cgi_sessions')
        .select('*')
        .order('date_seance', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CGISession[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`cgi-sessions:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cgi_sessions' }, () => {
        qc.invalidateQueries({ queryKey: SESSION_KEY });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc, instanceId]);

  return query;
}

export interface CreateSessionInput {
  trimestre: string;
  date_seance: string;
  ordre_du_jour?: string | null;
  participants?: CGIParticipant[];
}

export function useCreateCGISession() {
  const qc = useQueryClient();
  const { profile } = useActiveProfile();
  return useMutation({
    mutationFn: async (input: CreateSessionInput) => {
      const { data, error } = await db()
        .from('cgi_sessions')
        .insert({
          trimestre: input.trimestre,
          date_seance: input.date_seance,
          ordre_du_jour: input.ordre_du_jour ?? null,
          participants: input.participants ?? [],
          created_by: profile?.id ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as CGISession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

export function useUpdateCGISession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CGISession> & { id: string }) => {
      const { error } = await db().from('cgi_sessions').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

export function useDeleteCGISession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('cgi_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

// ─── All Actions (transversal, no session filter) ───────────────

export function useAllCGIActions() {
  const qc = useQueryClient();
  const instanceId = useId();

  const query = useQuery<Task[]>({
    queryKey: ALL_ACTIONS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('module_code', 'cgi' as any)
        .eq('type', 'task')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`cgi-all-actions:${instanceId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.cgi' },
        () => { qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY }); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc, instanceId]);

  return query;
}

// ─── Actions (tasks with module_code='cgi') ─────────────────────

export function useCGIActions(sessionId: string | null) {
  const qc = useQueryClient();
  const instanceId = useId();

  const query = useQuery<Task[]>({
    queryKey: ACTIONS_KEY(sessionId ?? ''),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('module_code', 'cgi' as any)
        .eq('type', 'task')
        .filter('module_data->>session_id', 'eq', sessionId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase
      .channel(`cgi-actions:${instanceId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: 'module_code=eq.cgi' },
        () => { qc.invalidateQueries({ queryKey: ACTIONS_KEY(sessionId) }); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc, instanceId, sessionId]);

  return query;
}

export interface CreateCGIActionInput {
  sessionId: string;
  title: string;
  responsable_fonction: string;
  assignee_id?: string | null;
  due_date?: string | null;
  it_project_id?: string | null;
}

export function useCreateCGIAction() {
  const qc = useQueryClient();
  const { profile, user } = useActiveProfile();
  return useMutation({
    mutationFn: async (input: CreateCGIActionInput) => {
      const moduleData: Record<string, unknown> = {
        session_id: input.sessionId,
        responsable_fonction: input.responsable_fonction,
      };
      if (input.it_project_id) {
        moduleData.it_project_id = input.it_project_id;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          type: 'task',
          status: 'todo',
          title: input.title,
          priority: 'medium',
          assignee_id: input.assignee_id ?? null,
          requester_id: profile?.id ?? null,
          user_id: user?.id ?? '',
          due_date: input.due_date ?? null,
          module_code: 'cgi' as any,
          module_data: moduleData as any,
        } as any)
        .select('*')
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ACTIONS_KEY(input.sessionId) });
      qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY });
      return data as Task;
    },
  });
}

export function useUpdateCGIAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sessionId, ...patch }: { id: string; sessionId?: string } & Record<string, any>) => {
      const { error } = await supabase
        .from('tasks')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;
      if (sessionId) qc.invalidateQueries({ queryKey: ACTIONS_KEY(sessionId) });
      qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY });
    },
  });
}

export function useDeleteCGIAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sessionId }: { id: string; sessionId?: string }) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      if (sessionId) qc.invalidateQueries({ queryKey: ACTIONS_KEY(sessionId) });
      qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY });
    },
  });
}
