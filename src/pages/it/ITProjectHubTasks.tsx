import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ITProjectHubHeader } from '@/components/it/ITProjectHubHeader';
import { useITProject, useITProjectTasks, useITProjectStats } from '@/hooks/useITProjectHub';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, ListTodo, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Task, TaskStatus } from '@/types/task';
import { ITLinkExistingTasksDialog } from '@/components/it/ITLinkExistingTasksDialog';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  'to_assign': { label: 'À assigner', className: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
  'todo': { label: 'À faire', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  'in-progress': { label: 'En cours', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  'done': { label: 'Terminé', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  'validated': { label: 'Validé', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  'cancelled': { label: 'Annulé', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  'review': { label: 'Revue', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  'pending_validation_1': { label: 'Validation N1', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'pending_validation_2': { label: 'Validation N2', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'refused': { label: 'Refusé', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

type StatusFilter = 'all' | 'open' | 'done' | 'cancelled';

export default function ITProjectHubTasks() {
  const { code } = useParams<{ code: string }>();
  const { data: project, isLoading } = useITProject(code);
  const { data: tasks = [] } = useITProjectTasks(project?.id);
  const stats = useITProjectStats(tasks, project);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title?.toLowerCase().includes(q);
        const matchNumber = t.task_number?.toLowerCase().includes(q) || t.request_number?.toLowerCase().includes(q);
        if (!matchTitle && !matchNumber) return false;
      }
      if (statusFilter === 'open') return !['done', 'validated', 'cancelled'].includes(t.status);
      if (statusFilter === 'done') return ['done', 'validated'].includes(t.status);
      if (statusFilter === 'cancelled') return t.status === 'cancelled';
      return true;
    });
  }, [tasks, searchQuery, statusFilter]);

  if (isLoading || !project) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        <ITProjectHubHeader project={project} stats={stats} />
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Filters */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par titre ou numéro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                  {([
                    { value: 'all', label: 'Toutes' },
                    { value: 'open', label: 'Ouvertes' },
                    { value: 'done', label: 'Terminées' },
                    { value: 'cancelled', label: 'Annulées' },
                  ] as { value: StatusFilter; label: string }[]).map(opt => (
                    <Button
                      key={opt.value}
                      variant={statusFilter === opt.value ? 'default' : 'ghost'}
                      size="sm"
                      className={cn('h-7 px-3 text-xs', statusFilter === opt.value && 'shadow-sm')}
                      onClick={() => setStatusFilter(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasks Table */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListTodo className="h-5 w-5 text-muted-foreground" />
                  Tâches & Demandes
                  <Badge variant="secondary" className="ml-2">{filteredTasks.length}</Badge>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
                  <Link2 className="h-4 w-4 mr-1.5" />
                  Associer des tâches existantes
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted inline-block mb-4">
                    <ListTodo className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="font-medium">Aucune tâche trouvée</p>
                  <p className="text-sm mt-1">
                    {tasks.length === 0
                      ? `Aucune tâche associée au projet ${project.code_projet_digital}`
                      : 'Modifiez vos filtres pour voir plus de résultats'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">N°</TableHead>
                        <TableHead className="font-semibold">Titre</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Statut</TableHead>
                        <TableHead className="font-semibold">Assigné à</TableHead>
                        <TableHead className="font-semibold">Échéance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => {
                        const number = task.type === 'request' ? task.request_number : task.task_number;
                        const statusConf = STATUS_LABELS[task.status] || { label: task.status, className: 'bg-muted text-muted-foreground' };
                        const assignee = (task as any).assignee;
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !['done', 'validated', 'cancelled'].includes(task.status);

                        return (
                          <TableRow key={task.id} className="group">
                            <TableCell>
                              <span className="font-mono text-xs text-muted-foreground">{number || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-sm">{task.title}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {task.type === 'request' ? 'Demande' : 'Tâche'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn(statusConf.className, 'border text-xs')}>{statusConf.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {assignee ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={assignee.avatar_url} />
                                    <AvatarFallback className="text-[10px]">
                                      {assignee.display_name?.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{assignee.display_name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Non assigné</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {task.due_date ? (
                                <span className={cn('text-sm', isOverdue && 'text-red-500 font-medium')}>
                                  {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: fr })}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
        </div>
        <ITLinkExistingTasksDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          projectId={project.id}
        />
      </div>
    </Layout>
  );
}
