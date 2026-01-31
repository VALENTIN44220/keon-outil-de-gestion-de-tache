import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ProcessWithTasks } from '@/types/template';
import { toast } from 'sonner';

interface ProcessSettingsTabProps {
  process: ProcessWithTasks;
  onUpdate: () => void;
  canManage: boolean;
}

export function ProcessSettingsTab({ process, onUpdate, canManage }: ProcessSettingsTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: process.name,
    description: process.description || '',
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('process_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq('id', process.id);

      if (error) throw error;

      toast.success('Paramètres enregistrés');
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating process:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Informations générales</CardTitle>
          {canManage && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              Modifier
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom du processus</Label>
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <p className="text-sm font-medium">{process.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            {isEditing ? (
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {process.description || 'Aucune description'}
              </p>
            )}
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Annuler
              </Button>
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations de création</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Créé le</span>
            <span>{new Date(process.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Dernière modification</span>
            <span>{new Date(process.updated_at).toLocaleDateString('fr-FR')}</span>
          </div>
          {process.company && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Entreprise</span>
                <span>{process.company}</span>
              </div>
            </>
          )}
          {process.department && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Département</span>
                <span>{process.department}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
