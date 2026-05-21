 import { useMemo, useState, useCallback } from 'react';
 import { format, parseISO } from 'date-fns';
 import { fr } from 'date-fns/locale';
 import { Task } from '@/types/task';
 import { Card, CardContent, CardHeader } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Checkbox } from '@/components/ui/checkbox';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
   DropdownMenuSeparator,
 } from '@/components/ui/dropdown-menu';
 import { cn } from '@/lib/utils';
 import {
   Search,
   GripVertical,
   Calendar,
   Clock,
   ChevronRight,
   ChevronLeft,
   ChevronDown,
   Filter,
   SortAsc,
   AlertTriangle,
   User,
   CheckSquare,
   FolderOpen,
 } from 'lucide-react';
 import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
 import { parseTaskTitle } from '@/lib/parseTaskTitle';
 
 export interface ParentDemandSummary {
   id: string;
   title: string;
   task_number?: string | null;
   priority?: string | null;
 }

 interface BacklogSidebarProps {
   tasks: Task[];
   plannedTaskIds: string[];
   onTaskDragStart: (e: React.DragEvent, task: Task) => void;
   getTaskDuration?: (taskId: string) => number | null;
   getTaskProgress?: (taskId: string) => { completed: number; total: number } | null;
   isCollapsed: boolean;
   onToggleCollapse: () => void;
   selectedTasks: Set<string>;
   onTaskSelect: (taskId: string, selected: boolean) => void;
   onSelectAll: () => void;
   onClearSelection: () => void;
   onBulkAssign?: (taskIds: string[], userId: string) => void;
   /** Si fourni, les tâches sont regroupées par demande parente avec un header repliable. */
   parentDemandsMap?: Map<string, ParentDemandSummary>;
 }
 
 type SortOption = 'priority' | 'due_date' | 'charge' | 'title';
 type FilterOption = 'all' | 'unassigned' | 'no_date' | 'overdue' | 'be_only';
 
 const priorityOrder: Record<string, number> = {
   urgent: 0,
   high: 1,
   medium: 2,
   low: 3,
 };
 
 export function BacklogSidebar({
  tasks = [],
  plannedTaskIds = [],
   onTaskDragStart,
   getTaskDuration,
   getTaskProgress,
   isCollapsed,
   onToggleCollapse,
  selectedTasks = new Set<string>(),
   onTaskSelect,
   onSelectAll,
   onClearSelection,
   parentDemandsMap,
 }: BacklogSidebarProps) {
   const [searchQuery, setSearchQuery] = useState('');
   const [sortBy, setSortBy] = useState<SortOption>('priority');
   const [filterBy, setFilterBy] = useState<FilterOption>('all');
   const [detailTask, setDetailTask] = useState<Task | null>(null);
   const [collapsedDemands, setCollapsedDemands] = useState<Set<string>>(new Set());

   const toggleDemandCollapse = useCallback((demandId: string) => {
     setCollapsedDemands(prev => {
       const next = new Set(prev);
       if (next.has(demandId)) next.delete(demandId);
       else next.add(demandId);
       return next;
     });
   }, []);
 
   const availableTasks = useMemo(() => {
    return (tasks || []).filter(t =>
       t.status !== 'done' &&
       t.status !== 'validated' &&
      !(plannedTaskIds || []).includes(t.id) &&
      // Exclure les taches verrouillees par dependance (parent non termine)
      !((t as any).is_dependency_locked === true)
     );
   }, [tasks, plannedTaskIds]);
 
   const filteredTasks = useMemo(() => {
     let filtered = availableTasks;
 
     // Apply search
     if (searchQuery) {
       const query = searchQuery.toLowerCase();
       filtered = filtered.filter(t => 
         t.title.toLowerCase().includes(query)
       );
     }
 
     // Apply filter
     switch (filterBy) {
       case 'unassigned':
         filtered = filtered.filter(t => !t.assignee_id);
         break;
       case 'no_date':
         filtered = filtered.filter(t => !t.due_date);
         break;
       case 'overdue':
         const today = new Date().toISOString().split('T')[0];
         filtered = filtered.filter(t => t.due_date && t.due_date < today);
         break;
       case 'be_only':
         // Tâches BE = liées à un projet BE ou portant un be_status (les tâches
         // créées via le flux BE ont be_project_id et/ou be_status renseignés)
         filtered = filtered.filter((t: any) => !!t.be_project_id || !!t.be_status);
         break;
     }
 
     // Apply sort
     filtered.sort((a, b) => {
       switch (sortBy) {
         case 'priority':
           return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
         case 'due_date':
           if (!a.due_date) return 1;
           if (!b.due_date) return -1;
           return a.due_date.localeCompare(b.due_date);
         case 'charge':
           const dA = getTaskDuration?.(a.id) ?? 0;
           const dB = getTaskDuration?.(b.id) ?? 0;
           return dB - dA;
         case 'title':
           return a.title.localeCompare(b.title);
         default:
           return 0;
       }
     });
 
     return filtered;
   }, [availableTasks, searchQuery, sortBy, filterBy, getTaskDuration]);
 
   const getPriorityColor = (priority: string) => {
     switch (priority) {
       case 'urgent': return 'bg-gradient-to-r from-red-500 to-rose-400';
       case 'high': return 'bg-gradient-to-r from-orange-500 to-amber-400';
       case 'medium': return 'bg-gradient-to-r from-blue-500 to-indigo-400';
       case 'low': return 'bg-gradient-to-r from-emerald-500 to-teal-400';
       default: return 'bg-gradient-to-r from-slate-500 to-slate-400';
     }
   };
 
   const isOverdue = useCallback((dueDate: string | null) => {
     if (!dueDate) return false;
     return dueDate < new Date().toISOString().split('T')[0];
   }, []);
 
   if (isCollapsed) {
     return (
       <div className="w-12 shrink-0 bg-card border-r flex flex-col items-center py-4">
         <Button
           variant="ghost"
           size="icon"
           onClick={onToggleCollapse}
           className="mb-4"
         >
           <ChevronRight className="h-4 w-4" />
         </Button>
         <div className="flex-1 flex flex-col items-center gap-1">
           <div className="writing-vertical text-xs font-medium text-muted-foreground rotate-180">
             Tâches à planifier
           </div>
           <Badge className="mt-2" variant="secondary">
             {availableTasks.length}
           </Badge>
         </div>
       </div>
     );
   }
 
   return (
     <Card className="w-96 shrink-0 shadow-lg border-0 bg-gradient-to-b from-card to-muted/20 flex flex-col h-full">
       <CardHeader className="pb-3 shrink-0">
         <div className="flex items-center justify-between mb-3">
           <div className="flex items-center gap-2">
             <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/60" />
             <h3 className="font-semibold text-sm">Tâches à planifier</h3>
             <Badge className="bg-primary/10 text-primary border-primary/20">
               {filteredTasks.length}
             </Badge>
           </div>
           <Button
             variant="ghost"
             size="icon"
             className="h-7 w-7"
             onClick={onToggleCollapse}
           >
             <ChevronLeft className="h-4 w-4" />
           </Button>
         </div>
         
         {/* Search */}
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Rechercher..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="pl-9 h-9 text-sm bg-background/50"
           />
         </div>
 
         {/* Filter & Sort */}
         <div className="flex items-center gap-2 mt-2">
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button variant="outline" size="sm" className="h-8 gap-1 text-xs flex-1">
                 <Filter className="h-3 w-3" />
                 {filterBy === 'all' ? 'Tous' :
                  filterBy === 'unassigned' ? 'Non affectées' :
                  filterBy === 'no_date' ? 'Sans date' :
                  filterBy === 'be_only' ? 'BE seulement' : 'En retard'}
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent>
               <DropdownMenuItem onClick={() => setFilterBy('all')}>Tous</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setFilterBy('unassigned')}>
                 <User className="h-3 w-3 mr-2" />
                 Non affectées
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => setFilterBy('no_date')}>
                 <Calendar className="h-3 w-3 mr-2" />
                 Sans date
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => setFilterBy('overdue')}>
                 <AlertTriangle className="h-3 w-3 mr-2" />
                 En retard
               </DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => setFilterBy('be_only')}>
                 <span className="mr-2 text-[10px] font-bold text-indigo-600">BE</span>
                 BE seulement
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
 
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button variant="outline" size="sm" className="h-8 gap-1 text-xs flex-1">
                 <SortAsc className="h-3 w-3" />
                 Trier
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent>
               <DropdownMenuItem onClick={() => setSortBy('priority')}>Priorité</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setSortBy('due_date')}>Date limite</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setSortBy('charge')}>Charge</DropdownMenuItem>
               <DropdownMenuItem onClick={() => setSortBy('title')}>Titre</DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
         </div>
 
         {/* Selection actions */}
         {selectedTasks.size > 0 && (
           <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 rounded-lg">
             <CheckSquare className="h-4 w-4 text-primary" />
             <span className="text-xs font-medium">{selectedTasks.size} sélectionnée(s)</span>
             <Button
               variant="ghost"
               size="sm"
               className="h-6 text-xs ml-auto"
               onClick={onClearSelection}
             >
               Annuler
             </Button>
           </div>
         )}
       </CardHeader>
       
       <CardContent className="pt-0 flex-1 overflow-hidden">
         <ScrollArea className="h-full pr-3">
           <div className="space-y-2 pb-4">
             {(() => {
               // Helper de rendu d'une carte de tâche, partagé entre vue plate et vue groupée
               const renderTaskCard = (task: Task) => {
                 const duration = getTaskDuration?.(task.id);
                 const progress = getTaskProgress?.(task.id);
                 const progressPercent = progress && progress.total > 0
                   ? Math.round((progress.completed / progress.total) * 100)
                   : 0;
                 const overdue = isOverdue(task.due_date);
                 const isSelected = selectedTasks.has(task.id);
                 return (
                 <div
                   key={task.id}
                   draggable
                   onDragStart={(e) => onTaskDragStart(e, task)}
                   className={cn(
                     "group p-3 rounded-xl border-2 cursor-grab active:cursor-grabbing",
                     "bg-card hover:bg-accent/50 hover:shadow-md",
                     "transition-all duration-200 hover:scale-[1.01]",
                     isSelected && "ring-2 ring-primary",
                     task.priority === 'urgent' && "border-red-200 hover:border-red-300",
                     task.priority === 'high' && "border-orange-200 hover:border-orange-300",
                     task.priority === 'medium' && "border-blue-200 hover:border-blue-300",
                     task.priority === 'low' && "border-emerald-200 hover:border-emerald-300",
                     !['urgent', 'high', 'medium', 'low'].includes(task.priority) && "border-border"
                   )}
                 >
                   <div className="flex items-start gap-2">
                     <Checkbox
                       checked={isSelected}
                       onCheckedChange={(checked) => onTaskSelect(task.id, !!checked)}
                       className="mt-0.5"
                       onClick={(e) => e.stopPropagation()}
                     />
                     <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0 group-hover:text-muted-foreground" />
                     <div className="flex-1 min-w-0">
                       <div className="flex items-start gap-2">
                         <div className={cn(
                           "w-2 h-2 rounded-full shrink-0 mt-1",
                           getPriorityColor(task.priority)
                         )} />
                         <div className="flex-1 min-w-0">
                           {/* Refs courtes (task_number + request_number) — cohérent avec /be/dispatch */}
                           <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                             {(task as any).task_number && (
                               <Badge
                                 variant="outline"
                                 className="h-4 px-1 text-[9px] font-mono font-medium shrink-0"
                                 title={`Identifiant tâche : ${(task as any).task_number}`}
                               >
                                 {(task as any).task_number}
                               </Badge>
                             )}
                             {(task as any).request_number && (task as any).request_number !== (task as any).task_number && (
                               <Badge
                                 variant="outline"
                                 className="h-4 px-1 text-[9px] font-mono shrink-0 text-muted-foreground"
                                 title={`Demande parente : ${(task as any).request_number}`}
                               >
                                 {(task as any).request_number}
                               </Badge>
                             )}
                             {((task as any).be_project_id || (task as any).be_status) && (
                               <Badge
                                 variant="outline"
                                 className="h-4 px-1 text-[9px] font-bold border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700 shrink-0"
                                 title="Tâche Bureau d'Études"
                               >
                                 BE
                               </Badge>
                             )}
                             {(task as any).be_status && (task as any).be_status !== 'cloturee' && (
                               <Badge
                                 variant="outline"
                                 className="h-4 px-1 text-[9px] shrink-0 capitalize"
                                 title={`Statut BE : ${(task as any).be_status}`}
                               >
                                 {String((task as any).be_status).replace(/_/g, ' ')}
                               </Badge>
                             )}
                             {(() => {
                               const parsed = parseTaskTitle(task.title, (task as any).task_number);
                               return parsed.prestation ? (
                                 <Badge
                                   variant="outline"
                                   className="h-4 px-1 text-[9px] font-semibold shrink-0 border-violet-300 text-violet-700 bg-violet-50"
                                   title={`Prestation : ${parsed.prestation}`}
                                 >
                                   {parsed.prestation}
                                 </Badge>
                               ) : null;
                             })()}
                           </div>
                           {(() => {
                             const parsed = parseTaskTitle(task.title, (task as any).task_number);
                             return (
                               <span
                                 className="text-sm font-medium cursor-pointer hover:underline line-clamp-2 break-words leading-tight"
                                 onClick={(e) => { e.stopPropagation(); setDetailTask(task); }}
                                 title={task.title}
                               >{parsed.name || task.title}</span>
                             );
                           })()}
                         </div>
                       </div>
                       
                       {overdue && task.due_date && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          En retard depuis le {format(parseISO(task.due_date), 'dd/MM', { locale: fr })}
                        </div>
                      )}
                       
                       {progress && progress.total > 0 && (
                         <div className="mt-2 flex items-center gap-2">
                           <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                             <div 
                               className={cn(
                                 "h-full rounded-full transition-all",
                                 progressPercent === 100 ? "bg-emerald-500" : "bg-primary"
                               )}
                               style={{ width: `${progressPercent}%` }}
                             />
                           </div>
                           <span className="text-[10px] font-medium tabular-nums">{progressPercent}%</span>
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
                 );
               };

               // Si parentDemandsMap est fourni → vue groupée par demande parente
               if (parentDemandsMap && parentDemandsMap.size > 0) {
                 // Regroupe les tâches filtrées par parent_request_id
                 const grouped = new Map<string | null, Task[]>();
                 for (const t of filteredTasks) {
                   const parentId = (t as any).parent_request_id ?? null;
                   if (!grouped.has(parentId)) grouped.set(parentId, []);
                   grouped.get(parentId)!.push(t);
                 }

                 // Ordre des groupes : demandes parentes connues d'abord, "Sans demande" à la fin
                 const groupEntries = Array.from(grouped.entries()).sort((a, b) => {
                   if (a[0] === null) return 1;
                   if (b[0] === null) return -1;
                   const da = parentDemandsMap.get(a[0]);
                   const db = parentDemandsMap.get(b[0]);
                   const na = da?.task_number ?? '';
                   const nb = db?.task_number ?? '';
                   return na.localeCompare(nb);
                 });

                 return (
                   <>
                     {groupEntries.map(([parentId, groupTasks]) => {
                       const demand = parentId ? parentDemandsMap.get(parentId) : null;
                       const isCollapsed = parentId ? collapsedDemands.has(parentId) : false;
                       const demandTitle = demand ? parseTaskTitle(demand.title, demand.task_number).name || demand.title : 'Tâches sans demande parente';
                       const demandCode = demand?.task_number ?? '—';

                       return (
                         <div key={parentId ?? '__orphan__'} className="mb-1">
                           {/* Header de demande — cliquable pour replier */}
                           <button
                             onClick={() => parentId && toggleDemandCollapse(parentId)}
                             className={cn(
                               'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left',
                               'bg-gradient-to-r from-violet-50 to-blue-50 hover:from-violet-100 hover:to-blue-100',
                               'border border-violet-200/60 transition-colors',
                               !parentId && 'from-slate-50 to-slate-50 border-slate-200',
                             )}
                             type="button"
                           >
                             {parentId && (
                               isCollapsed
                                 ? <ChevronRight className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                                 : <ChevronDown className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                             )}
                             <FolderOpen className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                             {demand && (
                               <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono shrink-0 bg-white">
                                 {demandCode}
                               </Badge>
                             )}
                             <span className="text-xs font-semibold truncate flex-1" title={demand?.title ?? ''}>
                               {demandTitle}
                             </span>
                             <Badge variant="secondary" className="h-4 px-1.5 text-[9px] shrink-0">
                               {groupTasks.length}
                             </Badge>
                           </button>

                           {/* Tâches du groupe (masquables) */}
                           {!isCollapsed && (
                             <div className="space-y-2 mt-1.5 pl-3 border-l-2 border-violet-200/50">
                               {groupTasks.map(t => renderTaskCard(t))}
                             </div>
                           )}
                         </div>
                       );
                     })}

                     {filteredTasks.length === 0 && (
                       <div className="text-center py-12">
                         <div className="text-muted-foreground text-sm">
                           {searchQuery ? 'Aucun résultat' : 'Toutes les tâches sont planifiées'}
                         </div>
                       </div>
                     )}
                   </>
                 );
               }

               // Vue plate (par défaut)
               return (
                 <>
                   {filteredTasks.map(t => renderTaskCard(t))}
                   {filteredTasks.length === 0 && (
                     <div className="text-center py-12">
                       <div className="text-muted-foreground text-sm">
                         {searchQuery ? 'Aucun résultat' : 'Toutes les tâches sont planifiées'}
                       </div>
                     </div>
                   )}
                 </>
               );
             })()}
           </div>
         </ScrollArea>
       </CardContent>

       {/* Task detail dialog */}
       <TaskDetailDialog
         task={detailTask}
         open={!!detailTask}
         onClose={() => setDetailTask(null)}
         onStatusChange={() => {}}
       />
     </Card>
   );
 }