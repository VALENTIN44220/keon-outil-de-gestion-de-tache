import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Variable, Plus, Trash2, Edit2, ArrowUp, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessVariablesTabProps {
  processId: string;
  canManage: boolean;
}

interface WorkflowVariable {
  id: string;
  name: string;
  type: 'text' | 'boolean' | 'integer' | 'decimal' | 'datetime' | 'autonumber';
  default_value: string | null;
  is_exposed_to_subprocesses: boolean;
}

const VARIABLE_TYPES = [
  { value: 'text', label: 'Texte' },
  { value: 'boolean', label: 'Booléen' },
  { value: 'integer', label: 'Nombre entier' },
  { value: 'decimal', label: 'Nombre décimal' },
  { value: 'datetime', label: 'Date/Heure' },
  { value: 'autonumber', label: 'Numéro auto' },
];

export function ProcessVariablesTab({ processId, canManage }: ProcessVariablesTabProps) {
  const [variables, setVariables] = useState<WorkflowVariable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<WorkflowVariable | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [varName, setVarName] = useState('');
  const [varType, setVarType] = useState<WorkflowVariable['type']>('text');
  const [varDefault, setVarDefault] = useState('');
  const [varExposed, setVarExposed] = useState(true);

  useEffect(() => {
    fetchVariables();
  }, [processId]);

  const fetchVariables = async () => {
    setIsLoading(true);
    try {
      // Note: workflow_variables is linked to workflow_templates, not directly to process_templates
      // For now, we'll fetch variables from the default workflow for this process
      const { data: workflow } = await supabase
        .from('workflow_templates')
        .select('id')
        .eq('process_template_id', processId)
        .eq('is_default', true)
        .single();

      if (workflow) {
        const { data } = await supabase
          .from('workflow_variables')
          .select('*')
          .eq('workflow_id', workflow.id)
          .order('created_at');

        if (data) {
          setVariables(data.map(v => ({
            id: v.id,
            name: v.name,
            type: v.variable_type as WorkflowVariable['type'],
            default_value: typeof v.default_value === 'string' ? v.default_value : String(v.default_value || ''),
            is_exposed_to_subprocesses: true, // Default to true since column doesn't exist
          })));
        }
      } else {
        setVariables([]);
      }
    } catch (error) {
      console.error('Error fetching variables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDialog = (variable?: WorkflowVariable) => {
    if (variable) {
      setEditingVariable(variable);
      setVarName(variable.name);
      setVarType(variable.type);
      setVarDefault(variable.default_value || '');
      setVarExposed(variable.is_exposed_to_subprocesses);
    } else {
      setEditingVariable(null);
      setVarName('');
      setVarType('text');
      setVarDefault('');
      setVarExposed(true);
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!varName.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setIsSaving(true);
    try {
      // Get workflow ID first
      const { data: workflow } = await supabase
        .from('workflow_templates')
        .select('id')
        .eq('process_template_id', processId)
        .eq('is_default', true)
        .single();

      if (!workflow) {
        toast.error('Aucun workflow trouvé. Générez d\'abord un workflow.');
        setIsSaving(false);
        return;
      }

      const payload = {
        name: varName.trim(),
        variable_type: varType,
        default_value: varDefault.trim() || null,
        workflow_id: workflow.id,
      };

      if (editingVariable) {
        await supabase
          .from('workflow_variables')
          .update(payload)
          .eq('id', editingVariable.id);
        toast.success('Variable mise à jour');
      } else {
        await supabase
          .from('workflow_variables')
          .insert(payload);
        toast.success('Variable créée');
      }

      setIsDialogOpen(false);
      fetchVariables();
    } catch (error) {
      console.error('Error saving variable:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('workflow_variables').delete().eq('id', id);
      toast.success('Variable supprimée');
      fetchVariables();
    } catch (error) {
      console.error('Error deleting variable:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; className: string }> = {
      text: { label: 'Texte', className: 'bg-blue-100 text-blue-700' },
      boolean: { label: 'Booléen', className: 'bg-purple-100 text-purple-700' },
      integer: { label: 'Entier', className: 'bg-green-100 text-green-700' },
      decimal: { label: 'Décimal', className: 'bg-emerald-100 text-emerald-700' },
      datetime: { label: 'Date', className: 'bg-orange-100 text-orange-700' },
      autonumber: { label: 'Auto', className: 'bg-cyan-100 text-cyan-700' },
    };
    const config = typeConfig[type] || typeConfig.text;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Variable className="h-4 w-4" />
              Variables du processus
            </CardTitle>
            <CardDescription>
              Variables utilisables dans les workflows et notifications
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : variables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Variable className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Aucune variable définie</p>
              {canManage && (
                <Button variant="outline" className="mt-4" onClick={() => openDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une variable
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Défaut</TableHead>
                  <TableHead>Exposée</TableHead>
                  {canManage && <TableHead className="w-[80px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((variable) => (
                  <TableRow key={variable.id}>
                    <TableCell className="font-mono text-sm">
                      {'{{' + variable.name + '}}'}
                    </TableCell>
                    <TableCell>{getTypeBadge(variable.type)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {variable.default_value || '—'}
                    </TableCell>
                    <TableCell>
                      {variable.is_exposed_to_subprocesses ? (
                        <Badge variant="outline" className="gap-1">
                          <ArrowUp className="h-3 w-3" />
                          Oui
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Non</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openDialog(variable)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(variable.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVariable ? 'Modifier la variable' : 'Nouvelle variable'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom de la variable *</Label>
              <Input
                value={varName}
                onChange={(e) => setVarName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="ex: montant_total"
              />
              <p className="text-xs text-muted-foreground">
                Utilisable comme {'{{' + (varName || 'nom') + '}}'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={varType} onValueChange={(v) => setVarType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valeur par défaut</Label>
              <Input
                value={varDefault}
                onChange={(e) => setVarDefault(e.target.value)}
                placeholder="Optionnel"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label>Exposer aux sous-processus</Label>
                <p className="text-xs text-muted-foreground">
                  Les sous-processus pourront lire cette variable
                </p>
              </div>
              <Switch checked={varExposed} onCheckedChange={setVarExposed} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              {editingVariable ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
