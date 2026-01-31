// Gantt components barrel export
// Performance-optimized components for workload planning

// Core layout components
export { GanttFilterBar, type ZoomLevel, type DensityMode } from './GanttFilterBar';
export { GanttCalendarHeader, TodayLine, TodayColumnHighlight, WeekendOverlay, WeekSeparators, type ViewMode } from './GanttCalendarHeader';
export { GanttLegend, GanttMiniLegend } from './GanttLegend';

// Row components
export { GanttRowCollaborator, GanttRowGroupHeader } from './GanttRowCollaborator';
export { GanttMemberRow, GanttGroupHeader } from './GanttMemberRow';

// Event/Task bar components
export { GanttEventBar, GanttLeaveBar, GanttHolidayCell, QuickAddSelectionOverlay } from './GanttEventBar';
export { GanttHoverCard } from './GanttHoverCard';

// Virtualization
export { VirtualizedGanttGrid, type VirtualizedGanttGridProps, type VirtualizedGanttGridRef } from './VirtualizedGanttGrid';
export { VirtualizedGanttRows } from './VirtualizedGanttRows';

// Interaction components
export { QuickAddPopover } from './QuickAddPopover';
export { useGanttMultiSelect, GanttMultiSelectBar } from './GanttMultiSelect';
export { useGanttUndo, GanttUndoToasts, SavingIndicator } from './GanttUndoManager';

// KPIs and metrics
export { GanttKPIs } from './GanttKPIs';
export { MemberHeatmapBar } from './MemberHeatmapBar';

// Legacy exports for backward compatibility
export { GanttTimeline } from './GanttTimeline';
export { GanttTaskBarInteractive } from './GanttTaskBarInteractive';
