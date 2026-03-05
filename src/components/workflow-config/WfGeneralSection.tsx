import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, Rocket, FileEdit } from 'lucide-react';
import { useState } from 'react';
import type { WfWorkflow, WfWorkflowUpdate } from '@/types/workflow';

interface Props {
  workflow: WfWorkflow;
  canManage: boolean;
  onUpdate: (updates: WfWorkflowUpdate) => Promise<void>;
  onPublish: () => Promise<void>;
}

export function WfGeneralSection({ workflow, canManage, onUpdate, onPublish }: Props) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({ name, description: description || null });
    setIsSaving(false);
  };

  const handlePublish = async () => {
    setIsSaving(true);
    await onPublish();
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Paramètres généraux</CardTitle>
            <CardDescription>Configuration de base du workflow</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {workflow.is_draft ? (
              <Badge variant="secondary" className="gap-1">
                <FileEdit className="h-3 w-3" />
                Brouillon
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                <Rocket className="h-3 w-3" />
                Publié (v{workflow.version})
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nom du workflow</Label>
          <Input value={name} onChange={e => setName(e.target.value)} disabled={!canManage} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} disabled={!canManage} />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <Label>Mode sous-processus par défaut</Label>
            <p className="text-xs text-muted-foreground">Les sous-processus appelés sont bloquants</p>
          </div>
          <Badge variant="outline">{workflow.default_subprocess_mode === 'blocking' ? 'Bloquant' : 'Non-bloquant'}</Badge>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
            {workflow.is_draft && (
              <Button onClick={handlePublish} disabled={isSaving} variant="default" size="sm" className="gap-1">
                <Rocket className="h-4 w-4" />
                Publier
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
