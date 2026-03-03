import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInnoRole } from '@/hooks/useInnoRole';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Plus, Eye, GitBranchPlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

const INNOVATION_PROCESS_ID = 'a1b2c3d4-0000-4000-a000-000000000001';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'todo': { label: 'Soumise', className: 'bg-blue-100 text-blue-800' },
  'in-progress': { label: 'En instruction', className: 'bg-yellow-100 text-yellow-800' },
  'pending_validation_1': { label: 'En validation', className: 'bg-purple-100 text-purple-800' },
  'validated': { label: 'Validée', className: 'bg-green-100 text-green-800' },
  'refused': { label: 'Refusée', className: 'bg-red-100 text-red-800' },
  'done': { label: 'Terminée', className: 'bg-green-100 text-green-800' },
  'cancelled': { label: 'Annulée', className: 'bg-muted text-muted-foreground' },
};

export default function Innovation() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isInnoAdmin } = useInnoRole();
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Fetch innovation requests (tasks of type 'request' linked to Innovation process)
  const { data: requests, isLoading } = useQuery({
    queryKey: ['inno-requests', profile?.id, isInnoAdmin],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, requester:profiles!tasks_requester_id_fkey(display_name), assignee:profiles!tasks_assignee_id_fkey(display_name)')
        .eq('type', 'request')
        .eq('source_process_template_id', INNOVATION_PROCESS_ID)
        .order('created_at', { ascending: false });

      // Non-admin users see only their own requests
      if (!isInnoAdmin && profile?.id) {
        query = query.eq('requester_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch custom field values for the selected request
  const { data: fieldValues } = useQuery({
    queryKey: ['inno-request-fields', selectedRequest?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_field_values')
        .select('*, field:template_custom_fields!request_field_values_field_id_fkey(name, label)')
        .eq('task_id', selectedRequest.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedRequest?.id,
  });

  const filtered = (requests || []).filter(r =>
    statutFilter === 'all' || r.status === statutFilter
  );

  const getFieldValue = (fieldName: string) => {
    const fv = fieldValues?.find((v: any) => v.field?.name === fieldName);
    return fv?.value || '-';
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="innovation" onViewChange={() => {}} />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <PageHeader title={isInnoAdmin ? 'Demandes Innovation' : 'Mes demandes Innovation'} />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/innovation/requests')}>
              <GitBranchPlus className="w-4 h-4 mr-2" />
              Cartographie
            </Button>
            <Button onClick={() => navigate('/requests')}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle demande
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-4">
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filtered.length} demande(s)</span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Chargement...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucune demande trouvée.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Priorité</TableHead>
                      {isInnoAdmin && <TableHead>Demandeur</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(r => {
                      const statusInfo = STATUS_LABELS[r.status] || { label: r.status, className: '' };
                      return (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedRequest(r)}>
                          <TableCell className="text-muted-foreground text-sm">{r.request_number || '-'}</TableCell>
                          <TableCell className="font-medium">{r.title}</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.priority}</Badge>
                          </TableCell>
                          {isInnoAdmin && <TableCell>{(r as any).requester?.display_name || '-'}</TableCell>}
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(r.created_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon"><Eye className="w-4 h-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedRequest && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-warning" />
                    {selectedRequest.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">N° Demande</p>
                      <p className="font-medium">{selectedRequest.request_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Statut</p>
                      <Badge className={STATUS_LABELS[selectedRequest.status]?.className || ''}>
                        {STATUS_LABELS[selectedRequest.status]?.label || selectedRequest.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Code projet</p>
                      <p className="font-medium">{getFieldValue('code_projet')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Entité</p>
                      <p className="font-medium">{getFieldValue('entite_concernee')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Usage</p>
                      <p className="font-medium">{getFieldValue('usage_inno')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sponsor</p>
                      <p className="font-medium">{getFieldValue('sponsor')}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nom du projet</p>
                    <p className="text-sm">{getFieldValue('nom_projet')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descriptif</p>
                    <p className="text-sm whitespace-pre-wrap">{getFieldValue('descriptif')}</p>
                  </div>
                  {selectedRequest.description && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedRequest.description}</p>
                    </div>
                  )}
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Demandeur</p>
                      <p>{(selectedRequest as any).requester?.display_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date de soumission</p>
                      <p>{format(new Date(selectedRequest.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
