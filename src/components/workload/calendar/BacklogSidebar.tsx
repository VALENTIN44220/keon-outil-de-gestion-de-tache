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
   Filter,
   SortAsc,
   AlertTriangle,
   User,
   CheckSquare,
 } from 'lucide-react';
 
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
 }
 
 type SortOption = 'priority' | 'due_date' | 'charge' | 'title';
 type FilterOption = 'all' | 'unassigned' | 'no_date' | 'overdue';
 
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
 }: BacklogSidebarProps) {
   const [searchQuery, setSearchQuery] = useState('');
   const [sortBy, setSortBy] = useState<SortOption>('priority');
   const [filterBy, setFilterBy] = useState<FilterOption>('all');
 
   const availableTasks = useMemo(() => {
    return (tasks || []).filter(t => 
       t.status !== 'done' && 
       t.status !== 'validated' && 
      !(plannedTaskIds || []).includes(t.id)
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
     <Card className="w-80 shrink-0 shadow-lg border-0 bg-gradient-to-b from-card to-muted/20 flex flex-col h-full">
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
                  filterBy === 'no_date' ? 'Sans date' : 'En retard'}
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
             {filteredTasks.map(task => {
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
                       <div className="flex items-center gap-2">
                         <div className={cn(
                           "w-2 h-2 rounded-full shrink-0",
                           getPriorityColor(task.priority)
                         )} />
                         <span className="text-sm font-medium truncate">{task.title}</span>
                       </div>
                       
                       <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                         {duration && (
                           <span className="inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                             <Clock className="h-3 w-3" />
                             {duration / 2}j
                           </span>
                         )}
                         {task.due_date && (
                           <span className={cn(
                             "inline-flex items-center gap-1",
                             overdue && "text-red-600 font-medium"
                           )}>
                             {overdue && <AlertTriangle className="h-3 w-3" />}
                             <Calendar className="h-3 w-3" />
                             {format(parseISO(task.due_date), 'dd/MM', { locale: fr })}
                           </span>
                         )}
                       </div>
                       
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
             })}
             
             {filteredTasks.length === 0 && (
               <div className="text-center py-12">
                 <div className="text-muted-foreground text-sm">
                   {searchQuery ? 'Aucun résultat' : 'Toutes les tâches sont planifiées'}
                 </div>
               </div>
             )}
           </div>
         </ScrollArea>
       </CardContent>
     </Card>
   );
 }