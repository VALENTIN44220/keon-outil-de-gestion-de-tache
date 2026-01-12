import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Workflow, Link2, Unlink } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useProcessTemplates } from '@/hooks/useProcessTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function CategoriesProcessTab() {
  const { categories, isLoading: categoriesLoading, refetch: refetchCategories } = useCategories();
  const { processes, isLoading: processesLoading } = useProcessTemplates();
  const [updating, setUpdating] = useState<string | null>(null);

  const handleLinkProcess = async (subcategoryId: string, processTemplateId: string | null) => {
    setUpdating(subcategoryId);
    try {
      const { error } = await supabase
        .from('subcategories')
        .update({ default_process_template_id: processTemplateId })
        .eq('id', subcategoryId);

      if (error) throw error;
      
      toast.success(processTemplateId ? 'Processus lié avec succès' : 'Liaison supprimée');
      refetchCategories();
    } catch (error) {
      console.error('Error linking process:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(null);
    }
  };

  const getProcessName = (processId: string | null) => {
    if (!processId) return null;
    return processes.find(p => p.id === processId)?.name || 'Processus inconnu';
  };

  if (categoriesLoading || processesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Liaison Catégories / Processus
        </CardTitle>
        <CardDescription>
          Associez des modèles de processus aux types de demandes (sous-catégories).
          Lorsqu'une demande avec ce type est créée, les tâches du processus seront automatiquement générées.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune catégorie définie. Créez d'abord des catégories et sous-catégories.
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category.id} className="space-y-2">
                <h3 className="font-semibold text-lg">{category.name}</h3>
                {category.subcategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-4">
                    Aucune sous-catégorie
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sous-catégorie</TableHead>
                        <TableHead>Processus lié</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {category.subcategories.map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-medium">
                            {sub.name}
                            {sub.description && (
                              <p className="text-xs text-muted-foreground">{sub.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.default_process_template_id ? (
                              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                <Link2 className="h-3 w-3" />
                                {getProcessName(sub.default_process_template_id)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Non lié</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <Select
                                value={sub.default_process_template_id || 'none'}
                                onValueChange={(value) => 
                                  handleLinkProcess(sub.id, value === 'none' ? null : value)
                                }
                                disabled={updating === sub.id}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Sélectionner un processus" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    <div className="flex items-center gap-2">
                                      <Unlink className="h-4 w-4" />
                                      Aucun
                                    </div>
                                  </SelectItem>
                                  {processes.map(process => (
                                    <SelectItem key={process.id} value={process.id}>
                                      <div className="flex items-center gap-2">
                                        <Workflow className="h-4 w-4" />
                                        {process.name}
                                        <span className="text-muted-foreground text-xs">
                                          ({process.task_templates.length} tâches)
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {updating === sub.id && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
