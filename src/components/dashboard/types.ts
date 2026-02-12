import { Task, TaskStatus, TaskPriority } from '@/types/task';

export type WidgetType = 
  | 'stats-summary' 
  | 'bar-chart' 
  | 'pie-chart' 
  | 'line-chart' 
  | 'data-table'
  | 'progress-ring';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataKey?: string; // status, priority, assignee, category, etc.
  chartType?: 'bar' | 'pie' | 'line' | 'donut';
  size: { w: number; h: number };
  position: { x: number; y: number };
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
}

export interface CrossFilters {
  dateRange: { start: Date | null; end: Date | null };
  period: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  assigneeIds: string[];
  departmentIds: string[];
  categoryIds: string[];
  processIds: string[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
}

export const DEFAULT_CROSS_FILTERS: CrossFilters = {
  dateRange: { start: null, end: null },
  period: 'month',
  assigneeIds: [],
  departmentIds: [],
  categoryIds: [],
  processIds: [],
  statuses: [],
  priorities: [],
};

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats-1', type: 'stats-summary', title: 'Vue d\'ensemble', size: { w: 4, h: 2 }, position: { x: 0, y: 0 } },
  { id: 'bar-1', type: 'bar-chart', title: 'Par statut', dataKey: 'status', size: { w: 2, h: 3 }, position: { x: 0, y: 2 } },
  { id: 'pie-1', type: 'pie-chart', title: 'Par priorité', dataKey: 'priority', size: { w: 2, h: 3 }, position: { x: 2, y: 2 } },
  { id: 'line-1', type: 'line-chart', title: 'Évolution temporelle', dataKey: 'timeline', size: { w: 4, h: 3 }, position: { x: 0, y: 5 } },
  { id: 'table-1', type: 'data-table', title: 'Liste des demandes', size: { w: 4, h: 4 }, position: { x: 0, y: 8 } },
];

export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface TimelineDataPoint {
  date: string;
  created: number;
  completed: number;
  inProgress: number;
}
