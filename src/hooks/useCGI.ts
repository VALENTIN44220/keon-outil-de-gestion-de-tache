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
const CHANGES_KEY = (sessionId: string) => ['cgi-changes', sessionId];

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

// ─── Actions by session ─────────────────────────────────────────

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

// ─── Changes history per session ────────────────────────────────

export interface CGIActionChange {
  id: string;
  session_id: string | null;
  task_id: string | null;
  change_type: 'created' | 'status_changed' | 'updated' | 'deleted';
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_by: string | null;
  created_at: string;
}

export function useCGIChanges(sessionId: string | null) {
  return useQuery<CGIActionChange[]>({
    queryKey: CHANGES_KEY(sessionId ?? ''),
    enabled: !!sessionId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('cgi_action_changes')
        .select('*')
        .eq('session_id', sessionId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CGIActionChange[];
    },
    staleTime: 15_000,
  });
}

async function logChange(
  sessionId: string | null,
  taskId: string,
  changeType: CGIActionChange['change_type'],
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null,
  changedBy: string | null,
) {
  if (!sessionId) return;
  await db().from('cgi_action_changes').insert({
    session_id: sessionId,
    task_id: taskId,
    change_type: changeType,
    old_values: oldValues,
    new_values: newValues,
    changed_by: changedBy,
  });
}

// ─── Create action ──────────────────────────────────────────────

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
    mutationFn: async (input: CreateCGIActionInput & { contextSessionId?: string }) => {
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

      const logSession = input.contextSessionId ?? input.sessionId;
      await logChange(logSession, (data as any).id, 'created', null, {
        title: input.title,
        responsable_fonction: input.responsable_fonction,
        assignee_id: input.assignee_id ?? null,
        due_date: input.due_date ?? null,
      }, profile?.id ?? null);

      qc.invalidateQueries({ queryKey: ACTIONS_KEY(input.sessionId) });
      qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY });
      qc.invalidateQueries({ queryKey: CHANGES_KEY(logSession) });
      return data as Task;
    },
  });
}

// ─── Update action (with change tracking) ───────────────────────

export function useUpdateCGIAction() {
  const qc = useQueryClient();
  const { profile } = useActiveProfile();
  return useMutation({
    mutationFn: async ({ id, sessionId, contextSessionId, ...patch }: {
      id: string;
      sessionId?: string;
      contextSessionId?: string;
    } & Record<string, any>) => {
      let oldValues: Record<string, any> | null = null;
      if (contextSessionId) {
        const { data: existing } = await supabase.from('tasks').select('title, status, due_date, assignee_id, description').eq('id', id).maybeSingle();
        if (existing) oldValues = existing as any;
      }

      const { error } = await supabase
        .from('tasks')
        .update(patch as any)
        .eq('id', id);
      if (error) throw error;

      if (contextSessionId && oldValues) {
        const changeType = patch.status && patch.status !== oldValues.status ? 'status_changed' : 'updated';
        const newValues: Record<string, any> = {};
        for (const key of Object.keys(patch)) {
          if (key !== 'sessionId' && key !== 'contextSessionId' && oldValues[key] !== patch[key]) {
            newValues[key] = patch[key];
          }
        }
        if (Object.keys(newValues).length > 0) {
          const changedOld: Record<string, any> = {};
          for (const key of Object.keys(newValues)) {
            changedOld[key] = oldValues[key] ?? null;
          }
          await logChange(contextSessionId, id, changeType, changedOld, newValues, profile?.id ?? null);
          qc.invalidateQueries({ queryKey: CHANGES_KEY(contextSessionId) });
        }
      }

      if (sessionId) qc.invalidateQueries({ queryKey: ACTIONS_KEY(sessionId) });
      qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY });
    },
  });
}

// ─── Delete action ──────────────────────────────────────────────

export function useDeleteCGIAction() {
  const qc = useQueryClient();
  const { profile } = useActiveProfile();
  return useMutation({
    mutationFn: async ({ id, sessionId, contextSessionId }: { id: string; sessionId?: string; contextSessionId?: string }) => {
      let oldValues: Record<string, any> | null = null;
      if (contextSessionId) {
        const { data: existing } = await supabase.from('tasks').select('title, status').eq('id', id).maybeSingle();
        if (existing) oldValues = existing as any;
      }

      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;

      if (contextSessionId) {
        await logChange(contextSessionId, id, 'deleted', oldValues, null, profile?.id ?? null);
        qc.invalidateQueries({ queryKey: CHANGES_KEY(contextSessionId) });
      }

      if (sessionId) qc.invalidateQueries({ queryKey: ACTIONS_KEY(sessionId) });
      qc.invalidateQueries({ queryKey: ALL_ACTIONS_KEY });
    },
  });
}
