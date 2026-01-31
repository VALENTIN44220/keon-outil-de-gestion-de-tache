import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Image, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { TeamMemberWorkload } from '@/types/workload';
import { Task } from '@/types/task';

interface GanttExportPanelProps {
  workloadData: TeamMemberWorkload[];
  tasks: Task[];
  startDate: Date;
  endDate: Date;
}

type ExportFormat = 'csv' | 'json';

export function GanttExportPanel({
  workloadData,
  tasks,
  startDate,
  endDate,
}: GanttExportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [includeSlots, setIncludeSlots] = useState(true);
  const [includeCapacity, setIncludeCapacity] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const rows: string[][] = [];
    const dateRange = `${format(startDate, 'dd/MM/yyyy', { locale: fr })} - ${format(endDate, 'dd/MM/yyyy', { locale: fr })}`;
    
    // Header
    const headers = ['Collaborateur', 'Service', 'Poste'];
    if (includeCapacity) {
      headers.push('Capacité (%)', 'Créneaux utilisés', 'Créneaux disponibles');
    }
    if (includeSlots) {
      headers.push('Tâches planifiées', 'Jours congés', 'Jours fériés');
    }
    rows.push(headers);

    // Data rows
    workloadData.forEach(member => {
      const row: string[] = [
        member.memberName,
        member.department || '',
        member.jobTitle || '',
      ];

      if (includeCapacity) {
        const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
        const percentage = available > 0 ? Math.round((member.usedSlots / available) * 100) : 0;
        row.push(
          `${percentage}%`,
          member.usedSlots.toString(),
          available.toString()
        );
      }

      if (includeSlots) {
        // Count unique tasks
        const taskIds = new Set<string>();
        member.days.forEach(day => {
          if (day.morning.slot) taskIds.add(day.morning.slot.task_id);
          if (day.afternoon.slot) taskIds.add(day.afternoon.slot.task_id);
        });
        row.push(
          taskIds.size.toString(),
          (member.leaveSlots / 2).toString(),
          (member.holidaySlots / 2).toString()
        );
      }

      rows.push(row);
    });

    // Add tasks sheet if requested
    if (includeTasks) {
      rows.push([]);
      rows.push(['--- TÂCHES PLANIFIÉES ---']);
      rows.push(['Tâche', 'Assigné à', 'Statut', 'Priorité', 'Échéance', 'Créneaux']);

      // Collect tasks from workload data
      const plannedTasks = new Map<string, { task: Task; slots: number; assignee: string }>();
      workloadData.forEach(member => {
        member.days.forEach(day => {
          [day.morning.slot, day.afternoon.slot].forEach(slot => {
              if (slot?.task) {
                const existing = plannedTasks.get(slot.task_id);
                if (existing) {
                  existing.slots++;
                } else {
                  // Find full task from tasks array
                  const fullTask = tasks.find(t => t.id === slot.task_id);
                  if (fullTask) {
                    plannedTasks.set(slot.task_id, {
                      task: fullTask,
                      slots: 1,
                      assignee: member.memberName,
                    });
                  }
                }
              }
          });
        });
      });

      plannedTasks.forEach(({ task, slots, assignee }) => {
        rows.push([
          task.title,
          assignee,
          task.status,
          task.priority,
          task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy', { locale: fr }) : '',
          slots.toString(),
        ]);
      });
    }

    // Convert to CSV
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')
    ).join('\n');

    // Add BOM for Excel compatibility
    const bom = '\uFEFF';
    downloadFile(
      bom + csvContent, 
      `plan-charge-${format(new Date(), 'yyyy-MM-dd')}.csv`, 
      'text/csv;charset=utf-8'
    );
  };

  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      members: workloadData.map(member => {
        const available = member.totalSlots - member.leaveSlots - member.holidaySlots;
        const percentage = available > 0 ? Math.round((member.usedSlots / available) * 100) : 0;

        return {
          id: member.memberId,
          name: member.memberName,
          department: member.department,
          jobTitle: member.jobTitle,
          capacity: includeCapacity ? {
            percentage,
            usedSlots: member.usedSlots,
            availableSlots: available,
            leaveSlots: member.leaveSlots,
            holidaySlots: member.holidaySlots,
          } : undefined,
          slots: includeSlots ? member.days.flatMap(day => {
            const slots = [];
            if (day.morning.slot) {
              slots.push({
                date: day.date,
                halfDay: 'morning',
                taskId: day.morning.slot.task_id,
                taskTitle: day.morning.slot.task?.title,
              });
            }
            if (day.afternoon.slot) {
              slots.push({
                date: day.date,
                halfDay: 'afternoon',
                taskId: day.afternoon.slot.task_id,
                taskTitle: day.afternoon.slot.task?.title,
              });
            }
            return slots;
          }) : undefined,
        };
      }),
    };

    downloadFile(
      JSON.stringify(data, null, 2),
      `plan-charge-${format(new Date(), 'yyyy-MM-dd')}.json`,
      'application/json'
    );
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'csv') {
        exportToCSV();
      } else {
        exportToJSON();
      }
      toast.success('Export réussi');
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Exporter</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exporter le plan de charge
          </DialogTitle>
          <DialogDescription>
            Téléchargez les données du Gantt dans le format de votre choix
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Format d'export</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              className="grid grid-cols-2 gap-3"
            >
              <label className={`
                flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${exportFormat === 'csv' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              `}>
                <RadioGroupItem value="csv" id="csv" />
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <div>
                    <span className="text-sm font-medium">CSV</span>
                    <p className="text-xs text-muted-foreground">Pour Excel</p>
                  </div>
                </div>
              </label>
              <label className={`
                flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${exportFormat === 'json' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
              `}>
                <RadioGroupItem value="json" id="json" />
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <span className="text-sm font-medium">JSON</span>
                    <p className="text-xs text-muted-foreground">Pour intégration</p>
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Données à inclure</Label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={includeCapacity}
                  onCheckedChange={(checked) => setIncludeCapacity(checked === true)}
                />
                <div>
                  <span className="text-sm font-medium">Capacité</span>
                  <p className="text-xs text-muted-foreground">Charge et disponibilité</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer">
                <Checkbox
                  checked={includeSlots}
                  onCheckedChange={(checked) => setIncludeSlots(checked === true)}
                />
                <div>
                  <span className="text-sm font-medium">Créneaux détaillés</span>
                  <p className="text-xs text-muted-foreground">Planning jour par jour</p>
                </div>
              </label>
              {exportFormat === 'csv' && (
                <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={includeTasks}
                    onCheckedChange={(checked) => setIncludeTasks(checked === true)}
                  />
                  <div>
                    <span className="text-sm font-medium">Liste des tâches</span>
                    <p className="text-xs text-muted-foreground">Tâches planifiées sur la période</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Period info */}
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Période : </span>
            <span className="font-medium">
              {format(startDate, 'd MMMM', { locale: fr })} - {format(endDate, 'd MMMM yyyy', { locale: fr })}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Télécharger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
