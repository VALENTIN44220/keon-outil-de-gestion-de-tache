import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, Search, Filter, Tag, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { Department } from '@/types/admin';

interface ServiceGroupLabel {
  id: string;
  name: string;
  color: string;
  order_index: number;
  is_active: boolean;
}

interface ServiceGroup {
  id: string;
  name: string;
  description: string | null;
  department_ids: string[];
  labels: ServiceGroupLabel[];
}

interface ServiceGroupsTabProps {
  departments: Department[];
}

const LABEL_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c',
];

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

  // Label management state
  const [labels, setLabels] = useState<ServiceGroupLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('');

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    const [sgRes, linkRes, labelRes] = await Promise.all([
      (supabase as any).from('service_groups').select('*').order('name'),
      (supabase as any).from('service_group_departments').select('service_group_id, department_id'),
      (supabase as any).from('service_group_labels').select('*').order('order_index'),
    ]);

    const result: ServiceGroup[] = (sgRes.data || []).map((sg: any) => ({
      ...sg,
      department_ids: (linkRes.data || []).filter((l: any) => l.service_group_id === sg.id).map((l: any) => l.department_id),
      labels: (labelRes.data || []).filter((l: any) => l.service_group_id === sg.id),
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
    setLabels([]);
    setDialogOpen(true);
  };

  const openEdit = (g: ServiceGroup) => {
    setEditingGroup(g);
    setName(g.name);
    setDescription(g.description || '');
    setSelectedDeptIds(new Set(g.department_ids));
    setDeptSearch('');
    setShowUnassignedOnly(false);
    setLabels([...g.labels]);
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

      // Sync labels
      if (editingGroup) {
        // Delete labels removed by user
        const existingLabelIds = editingGroup.labels.map(l => l.id);
        const keptLabelIds = labels.filter(l => l.id && existingLabelIds.includes(l.id)).map(l => l.id);
        const toDelete = existingLabelIds.filter(id => !keptLabelIds.includes(id));
        if (toDelete.length > 0) {
          await (supabase as any).from('service_group_labels').delete().in('id', toDelete);
        }

        // Update existing labels
        for (const label of labels.filter(l => l.id && existingLabelIds.includes(l.id))) {
          await (supabase as any).from('service_group_labels')
            .update({ name: label.name, color: label.color, order_index: label.order_index, is_active: label.is_active })
            .eq('id', label.id);
        }

        // Insert new labels (those without a real id or not in existing)
        const newLabels = labels.filter(l => !l.id || !existingLabelIds.includes(l.id));
        if (newLabels.length > 0) {
          await (supabase as any).from('service_group_labels').insert(
            newLabels.map((l, i) => ({
              service_group_id: groupId,
              name: l.name,
              color: l.color,
              order_index: l.order_index || (existingLabelIds.length + i),
              is_active: l.is_active,
            }))
          );
        }
      } else {
        // New group: insert all labels
        if (labels.length > 0) {
          await (supabase as any).from('service_group_labels').insert(
            labels.map((l, i) => ({
              service_group_id: groupId,
              name: l.name,
              color: l.color,
              order_index: i,
              is_active: true,
            }))
          );
        }
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

  const addLabel = () => {
    if (!newLabelName.trim()) return;
    if (labels.some(l => l.name.toLowerCase() === newLabelName.trim().toLowerCase())) {
      toast.error('Cette étiquette existe déjà');
      return;
    }
    setLabels(prev => [...prev, {
      id: '', // will be generated on save
      name: newLabelName.trim(),
      color: newLabelColor,
      order_index: prev.length,
      is_active: true,
    }]);
    setNewLabelName('');
    setNewLabelColor(LABEL_COLORS[(labels.length + 1) % LABEL_COLORS.length]);
  };

  const removeLabel = (index: number) => {
    setLabels(prev => prev.filter((_, i) => i !== index));
  };

  const startEditLabel = (index: number) => {
    const label = labels[index];
    setEditingLabelId(label.id || `idx-${index}`);
    setEditLabelName(label.name);
    setEditLabelColor(label.color);
  };

  const saveEditLabel = (index: number) => {
    if (!editLabelName.trim()) return;
    setLabels(prev => prev.map((l, i) => i === index ? { ...l, name: editLabelName.trim(), color: editLabelColor } : l));
    setEditingLabelId(null);
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
            <CardContent className="pt-0 pb-3 space-y-2">
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
              {/* Labels */}
              {g.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t">
                  {g.labels.filter(l => l.is_active).map(label => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      className="text-[10px] gap-1"
                      style={{ borderColor: label.color, color: label.color }}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {label.name}
                    </Badge>
                  ))}
                </div>
              )}
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
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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

            {/* Labels section */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Étiquettes
              </Label>
              <p className="text-xs text-muted-foreground">
                Définissez les étiquettes propres à ce groupe. Elles seront utilisables dans les filtres et synchronisées avec Planner.
              </p>
              
              {/* Existing labels */}
              <div className="space-y-1">
                {labels.map((label, idx) => {
                  const isEditing = editingLabelId === (label.id || `idx-${idx}`);
                  return (
                    <div key={label.id || idx} className="flex items-center gap-2 py-1 px-2 rounded border bg-muted/30">
                      {isEditing ? (
                        <>
                          <Input
                            value={editLabelName}
                            onChange={e => setEditLabelName(e.target.value)}
                            className="h-7 text-sm flex-1"
                            onKeyDown={e => e.key === 'Enter' && saveEditLabel(idx)}
                          />
                          <div className="flex gap-0.5">
                            {LABEL_COLORS.slice(0, 6).map(c => (
                              <button
                                key={c}
                                className={`w-4 h-4 rounded-full border-2 ${editLabelColor === c ? 'border-foreground' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setEditLabelColor(c)}
                              />
                            ))}
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => saveEditLabel(idx)}>OK</Button>
                          <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setEditingLabelId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                          <span className="text-sm flex-1">{label.name}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => startEditLabel(idx)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => removeLabel(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add new label */}
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {LABEL_COLORS.slice(0, 6).map(c => (
                    <button
                      key={c}
                      className={`w-4 h-4 rounded-full border-2 ${newLabelColor === c ? 'border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewLabelColor(c)}
                    />
                  ))}
                </div>
                <Input
                  value={newLabelName}
                  onChange={e => setNewLabelName(e.target.value)}
                  placeholder="Nouvelle étiquette..."
                  className="h-8 text-sm flex-1"
                  onKeyDown={e => e.key === 'Enter' && addLabel()}
                />
                <Button variant="outline" size="sm" className="h-8" onClick={addLabel} disabled={!newLabelName.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
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
