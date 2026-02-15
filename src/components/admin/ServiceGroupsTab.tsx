import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { Department } from '@/types/admin';

interface ServiceGroup {
  id: string;
  name: string;
  description: string | null;
  department_ids: string[];
}

interface ServiceGroupsTabProps {
  departments: Department[];
}

export function ServiceGroupsTab({ departments }: ServiceGroupsTabProps) {
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceGroup | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [deptSearch, setDeptSearch] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    const { data: sgData } = await (supabase as any).from('service_groups').select('*').order('name');
    const { data: linkData } = await (supabase as any).from('service_group_departments').select('service_group_id, department_id');

    const result: ServiceGroup[] = (sgData || []).map((sg: any) => ({
      ...sg,
      department_ids: (linkData || []).filter((l: any) => l.service_group_id === sg.id).map((l: any) => l.department_id),
    }));
    setGroups(result);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreate = () => {
    setEditingGroup(null);
    setName('');
    setDescription('');
    setSelectedDeptIds(new Set());
    setDeptSearch('');
    setShowUnassignedOnly(false);
    setDialogOpen(true);
  };

  const openEdit = (g: ServiceGroup) => {
    setEditingGroup(g);
    setName(g.name);
    setDescription(g.description || '');
    setSelectedDeptIds(new Set(g.department_ids));
    setDeptSearch('');
    setShowUnassignedOnly(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      let groupId: string;

      if (editingGroup) {
        const { error } = await (supabase as any)
          .from('service_groups')
          .update({ name: name.trim(), description: description.trim() || null })
          .eq('id', editingGroup.id);
        if (error) throw error;
        groupId = editingGroup.id;

        // Delete existing links
        await (supabase as any).from('service_group_departments').delete().eq('service_group_id', groupId);
      } else {
        const { data, error } = await (supabase as any)
          .from('service_groups')
          .insert({ name: name.trim(), description: description.trim() || null })
          .select('id')
          .single();
        if (error) throw error;
        groupId = data.id;
      }

      // Insert department links
      if (selectedDeptIds.size > 0) {
        const links = Array.from(selectedDeptIds).map(did => ({
          service_group_id: groupId,
          department_id: did,
        }));
        const { error } = await (supabase as any).from('service_group_departments').insert(links);
        if (error) throw error;
      }

      toast.success(editingGroup ? 'Groupe mis à jour' : 'Groupe créé');
      setDialogOpen(false);
      fetchGroups();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce groupe de services ?')) return;
    const { error } = await (supabase as any).from('service_groups').delete().eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Groupe supprimé');
      fetchGroups();
    }
  };

  const toggleDept = (id: string) => {
    setSelectedDeptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Groupes de services</h2>
          <p className="text-sm text-muted-foreground">Regroupez des services multisociété sous un même label pour le suivi des processus.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nouveau groupe
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Aucun groupe de services. Cliquez sur « Nouveau groupe » pour en créer un.
            </CardContent>
          </Card>
        ) : groups.map(g => (
          <Card key={g.id}>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{g.name}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(g.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              {g.description && <p className="text-xs text-muted-foreground mb-2">{g.description}</p>}
              <div className="flex flex-wrap gap-1">
                {g.department_ids.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Aucun service rattaché</span>
                ) : g.department_ids.map(did => {
                  const dept = departments.find(d => d.id === did);
                  return (
                    <Badge key={did} variant="secondary" className="text-xs">
                      {dept?.name || did}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unassigned departments */}
      {(() => {
        const assignedIds = new Set(groups.flatMap(g => g.department_ids));
        const unassigned = departments.filter(d => !assignedIds.has(d.id));
        if (unassigned.length === 0) return null;
        return (
          <Card className="border-dashed border-warning/50">
            <CardHeader className="py-3 flex flex-row items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <CardTitle className="text-sm font-medium text-warning">
                {unassigned.length} service{unassigned.length > 1 ? 's' : ''} non affecté{unassigned.length > 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="flex flex-wrap gap-1">
                {unassigned.map(d => (
                  <Badge key={d.id} variant="outline" className="text-xs">
                    {d.name}
                    {d.company?.name && <span className="ml-1 opacity-60">({d.company.name})</span>}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Modifier le groupe' : 'Nouveau groupe de services'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Achats" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description optionnelle" />
            </div>
            <div className="space-y-2">
              <Label>Services inclus</Label>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={deptSearch}
                    onChange={e => setDeptSearch(e.target.value)}
                    placeholder="Rechercher un service..."
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                  <Switch
                    checked={showUnassignedOnly}
                    onCheckedChange={setShowUnassignedOnly}
                    className="scale-75"
                  />
                  Non affectés
                </label>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {(() => {
                  const assignedIds = new Set(groups.flatMap(g => g.department_ids));
                  // When editing, don't count current group's departments as "assigned"
                  if (editingGroup) {
                    editingGroup.department_ids.forEach(id => assignedIds.delete(id));
                  }
                  const filtered = departments.filter(d => {
                    if (deptSearch && !d.name.toLowerCase().includes(deptSearch.toLowerCase()) && !d.company?.name?.toLowerCase().includes(deptSearch.toLowerCase())) return false;
                    if (showUnassignedOnly && assignedIds.has(d.id) && !selectedDeptIds.has(d.id)) return false;
                    return true;
                  });
                  if (filtered.length === 0) return <span className="text-xs text-muted-foreground italic p-2">Aucun service trouvé</span>;
                  return filtered.map(d => (
                    <label key={d.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={selectedDeptIds.has(d.id)}
                        onCheckedChange={() => toggleDept(d.id)}
                      />
                      <span className="text-sm">{d.name}</span>
                      {assignedIds.has(d.id) && !selectedDeptIds.has(d.id) && (
                        <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Affecté</Badge>
                      )}
                      {d.company?.name && (
                        <Badge variant="outline" className="text-[10px] ml-auto">{d.company.name}</Badge>
                      )}
                    </label>
                  ));
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingGroup ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
