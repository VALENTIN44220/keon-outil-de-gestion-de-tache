import { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Check, X, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { PermissionProfile, UserProfile } from '@/types/admin';

interface ProcessTemplate {
  id: string;
  name: string;
  description: string | null;
}

interface BulkTrackingAccessPanelProps {
  trackingMode: 'profile' | 'company' | 'department';
  trackingFilterId: string;
  processTemplates: ProcessTemplate[];
  users: UserProfile[];
  permissionProfiles: PermissionProfile[];
}

interface BulkState {
  [processId: string]: { can_read: boolean; can_write: boolean };
}

export function BulkTrackingAccessPanel({
  trackingMode,
  trackingFilterId,
  processTemplates,
  users,
  permissionProfiles,
}: BulkTrackingAccessPanelProps) {
  const [bulkState, setBulkState] = useState<BulkState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [targetUsers, setTargetUsers] = useState<UserProfile[]>([]);

  // Resolve target users based on mode
  useEffect(() => {
    let filtered: UserProfile[] = [];
    if (trackingMode === 'profile') {
      filtered = users.filter(u => u.permission_profile_id === trackingFilterId);
    } else if (trackingMode === 'company') {
      filtered = users.filter(u => u.company_id === trackingFilterId);
    } else if (trackingMode === 'department') {
      filtered = users.filter(u => u.department_id === trackingFilterId);
    }
    setTargetUsers(filtered);
  }, [trackingMode, trackingFilterId, users]);

  // Initialize bulk state: all off
  useEffect(() => {
    const initial: BulkState = {};
    processTemplates.forEach(pt => {
      initial[pt.id] = { can_read: false, can_write: false };
    });
    setBulkState(initial);
  }, [processTemplates, trackingFilterId]);

  const toggleBulk = (processId: string, field: 'can_read' | 'can_write') => {
    setBulkState(prev => {
      const current = prev[processId] || { can_read: false, can_write: false };
      const newValue = !current[field];
      const updates = { ...current, [field]: newValue };
      if (field === 'can_read' && !newValue) updates.can_write = false;
      if (field === 'can_write' && newValue) updates.can_read = true;
      return { ...prev, [processId]: updates };
    });
  };

  const handleApply = async () => {
    if (targetUsers.length === 0) {
      toast.error('Aucun utilisateur trouvé pour ce filtre');
      return;
    }

    setIsSaving(true);
    try {
      const profileIds = targetUsers.map(u => u.id);

      // For each process with at least read access, upsert rows for all target users
      for (const pt of processTemplates) {
        const state = bulkState[pt.id];
        if (!state) continue;

        for (const profileId of profileIds) {
          if (state.can_read) {
            // Upsert
            const { error } = await (supabase as any)
              .from('process_tracking_access')
              .upsert(
                {
                  profile_id: profileId,
                  process_template_id: pt.id,
                  can_read: state.can_read,
                  can_write: state.can_write,
                },
                { onConflict: 'profile_id,process_template_id' }
              );
            if (error) throw error;
          } else {
            // Remove access row if exists
            await (supabase as any)
              .from('process_tracking_access')
              .delete()
              .eq('profile_id', profileId)
              .eq('process_template_id', pt.id);
          }
        }
      }

      toast.success(`Accès appliqué à ${profileIds.length} utilisateur(s)`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de l\'application en masse');
    } finally {
      setIsSaving(false);
    }
  };

  const modeLabel = trackingMode === 'profile' ? 'profil' : trackingMode === 'company' ? 'société' : 'service';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-xs">
          {targetUsers.length} utilisateur(s) concerné(s)
        </Badge>
        <Button onClick={handleApply} disabled={isSaving || targetUsers.length === 0} size="sm">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Appliquer à ce {modeLabel}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Processus</TableHead>
            <TableHead className="text-center w-24">
              <span className="flex items-center justify-center gap-1">
                <Eye className="h-3.5 w-3.5" /> Lecture
              </span>
            </TableHead>
            <TableHead className="text-center w-24">
              <span className="flex items-center justify-center gap-1">
                <Pencil className="h-3.5 w-3.5" /> Écriture
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processTemplates.map(pt => {
            const state = bulkState[pt.id] || { can_read: false, can_write: false };
            return (
              <TableRow key={pt.id}>
                <TableCell>
                  <p className="font-medium text-sm">{pt.name}</p>
                  {pt.description && (
                    <p className="text-xs text-muted-foreground">{pt.description}</p>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={() => toggleBulk(pt.id, 'can_read')}
                    className={`p-2 rounded-lg transition-all ${
                      state.can_read
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {state.can_read ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  <button
                    onClick={() => toggleBulk(pt.id, 'can_write')}
                    className={`p-2 rounded-lg transition-all ${
                      state.can_write
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {state.can_write ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
