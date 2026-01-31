import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMemberWorkload, WorkloadSlot } from '@/types/workload';
import { Task } from '@/types/task';
import { toast } from 'sonner';

export interface ExportData {
  workloadData: TeamMemberWorkload[];
  tasks: Task[];
  slots: WorkloadSlot[];
  startDate: Date;
  endDate: Date;
}

// CSV Export
export function exportToCSV(data: ExportData): void {
  const { workloadData, tasks, slots, startDate, endDate } = data;
  
  // Build header
  const headers = [
    'Collaborateur',
    'Service',
    'Date',
    'Demi-journée',
    'Tâche',
    'Priorité',
    'Statut',
    'Capacité utilisée (%)',
  ];
  
  const rows: string[][] = [];
  
  workloadData.forEach(member => {
    const memberSlots = slots.filter(s => s.user_id === member.memberId);
    const capacityUsed = member.totalSlots > 0 
      ? Math.round((member.usedSlots / (member.totalSlots - member.holidaySlots - member.leaveSlots)) * 100)
      : 0;
    
    member.days.forEach(day => {
      // Morning slot
      if (day.morning.slot) {
        const task = tasks.find(t => t.id === day.morning.slot?.task_id);
        rows.push([
          member.memberName,
          member.department || '',
          format(new Date(day.date), 'dd/MM/yyyy'),
          'Matin',
          task?.title || '',
          task?.priority || '',
          task?.status || '',
          `${capacityUsed}%`,
        ]);
      }
      
      // Afternoon slot
      if (day.afternoon.slot) {
        const task = tasks.find(t => t.id === day.afternoon.slot?.task_id);
        rows.push([
          member.memberName,
          member.department || '',
          format(new Date(day.date), 'dd/MM/yyyy'),
          'Après-midi',
          task?.title || '',
          task?.priority || '',
          task?.status || '',
          `${capacityUsed}%`,
        ]);
      }
    });
  });
  
  // Generate CSV content
  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
  ].join('\n');
  
  // Download
  downloadFile(
    csvContent,
    `plan-charge-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.csv`,
    'text/csv;charset=utf-8;'
  );
  
  toast.success(`Exporté ${rows.length} créneaux au format CSV`);
}

// JSON Export with full details
export function exportToJSON(data: ExportData): void {
  const { workloadData, tasks, slots, startDate, endDate } = data;
  
  // Calculate KPIs
  const totalMembers = workloadData.length;
  const totalSlots = workloadData.reduce((sum, m) => sum + m.usedSlots, 0);
  const avgCapacity = workloadData.length > 0
    ? Math.round(
        workloadData.reduce((sum, m) => {
          const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
          return sum + (available > 0 ? (m.usedSlots / available) * 100 : 0);
        }, 0) / workloadData.length
      )
    : 0;
  
  const overloadedMembers = workloadData.filter(m => {
    const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
    return available > 0 && (m.usedSlots / available) > 1;
  });
  
  const exportPayload = {
    metadata: {
      exportDate: new Date().toISOString(),
      periodStart: format(startDate, 'yyyy-MM-dd'),
      periodEnd: format(endDate, 'yyyy-MM-dd'),
      version: '1.0',
    },
    kpis: {
      totalMembers,
      totalPlannedSlots: totalSlots,
      averageCapacityUsage: `${avgCapacity}%`,
      overloadedMembers: overloadedMembers.length,
    },
    members: workloadData.map(member => {
      const available = member.totalSlots - member.holidaySlots - member.leaveSlots;
      return {
        id: member.memberId,
        name: member.memberName,
        department: member.department,
        jobTitle: member.jobTitle,
        capacity: {
          total: member.totalSlots,
          available,
          used: member.usedSlots,
          holidays: member.holidaySlots,
          leaves: member.leaveSlots,
          percentage: available > 0 ? Math.round((member.usedSlots / available) * 100) : 0,
        },
        plannedTasks: slots
          .filter(s => s.user_id === member.memberId)
          .reduce((acc, slot) => {
            if (!acc.find(t => t.taskId === slot.task_id)) {
              const task = tasks.find(t => t.id === slot.task_id);
              if (task) {
                acc.push({
                  taskId: task.id,
                  title: task.title,
                  priority: task.priority,
                  status: task.status,
                  dueDate: task.due_date,
                  slots: slots.filter(s => s.task_id === task.id && s.user_id === member.memberId).length,
                });
              }
            }
            return acc;
          }, [] as any[]),
      };
    }),
  };
  
  // Download
  downloadFile(
    JSON.stringify(exportPayload, null, 2),
    `plan-charge-${format(startDate, 'yyyy-MM-dd')}-${format(endDate, 'yyyy-MM-dd')}.json`,
    'application/json'
  );
  
  toast.success('Données exportées au format JSON');
}

// Summary report export (Markdown)
export function exportSummaryReport(data: ExportData): void {
  const { workloadData, tasks, slots, startDate, endDate } = data;
  
  const totalSlots = workloadData.reduce((sum, m) => sum + m.usedSlots, 0);
  const avgCapacity = workloadData.length > 0
    ? Math.round(
        workloadData.reduce((sum, m) => {
          const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
          return sum + (available > 0 ? (m.usedSlots / available) * 100 : 0);
        }, 0) / workloadData.length
      )
    : 0;
  
  const overloaded = workloadData.filter(m => {
    const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
    return available > 0 && (m.usedSlots / available) > 1;
  });
  
  const underutilized = workloadData.filter(m => {
    const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
    return available > 0 && (m.usedSlots / available) < 0.5;
  });
  
  let report = `# Rapport Plan de Charge\n\n`;
  report += `**Période:** ${format(startDate, 'd MMMM yyyy', { locale: fr })} au ${format(endDate, 'd MMMM yyyy', { locale: fr })}\n\n`;
  report += `**Généré le:** ${format(new Date(), 'd MMMM yyyy à HH:mm', { locale: fr })}\n\n`;
  
  report += `## Résumé\n\n`;
  report += `| Indicateur | Valeur |\n`;
  report += `|------------|--------|\n`;
  report += `| Collaborateurs | ${workloadData.length} |\n`;
  report += `| Créneaux planifiés | ${totalSlots} |\n`;
  report += `| Capacité moyenne | ${avgCapacity}% |\n`;
  report += `| En surcharge | ${overloaded.length} |\n`;
  report += `| Sous-utilisés (<50%) | ${underutilized.length} |\n\n`;
  
  if (overloaded.length > 0) {
    report += `## ⚠️ Collaborateurs en surcharge\n\n`;
    overloaded.forEach(m => {
      const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
      const pct = available > 0 ? Math.round((m.usedSlots / available) * 100) : 0;
      report += `- **${m.memberName}** (${m.department || 'N/A'}): ${pct}%\n`;
    });
    report += `\n`;
  }
  
  report += `## Détail par collaborateur\n\n`;
  workloadData.forEach(m => {
    const available = m.totalSlots - m.holidaySlots - m.leaveSlots;
    const pct = available > 0 ? Math.round((m.usedSlots / available) * 100) : 0;
    const memberSlots = slots.filter(s => s.user_id === m.memberId);
    const uniqueTasks = new Set(memberSlots.map(s => s.task_id)).size;
    
    report += `### ${m.memberName}\n`;
    report += `- **Service:** ${m.department || 'N/A'}\n`;
    report += `- **Charge:** ${pct}% (${m.usedSlots}/${available} créneaux)\n`;
    report += `- **Tâches:** ${uniqueTasks}\n`;
    report += `- **Congés:** ${m.leaveSlots} créneaux\n\n`;
  });
  
  // Download
  downloadFile(
    report,
    `rapport-charge-${format(startDate, 'yyyy-MM-dd')}.md`,
    'text/markdown'
  );
  
  toast.success('Rapport de synthèse généré');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
