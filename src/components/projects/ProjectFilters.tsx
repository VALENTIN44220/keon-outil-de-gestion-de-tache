import { useMemo } from 'react';
import { BEProject } from '@/types/beProject';
import { ColumnFilter } from '@/hooks/useProjectViewConfig';

export function applyColumnFilters(
  projects: BEProject[],
  filters: Record<string, ColumnFilter>
): BEProject[] {
  if (Object.keys(filters).length === 0) return projects;

  return projects.filter(project => {
    return Object.entries(filters).every(([columnKey, filter]) => {
      if (!filter.value) return true;

      const cellValue = (project as any)[columnKey];
      if (cellValue === null || cellValue === undefined) {
        return filter.value === '';
      }

      const stringValue = String(cellValue).toLowerCase();
      const filterValue = filter.value.toLowerCase();

      switch (filter.operator) {
        case 'equals':
          return stringValue === filterValue;
        case 'startsWith':
          return stringValue.startsWith(filterValue);
        case 'endsWith':
          return stringValue.endsWith(filterValue);
        case 'contains':
        default:
          return stringValue.includes(filterValue);
      }
    });
  });
}

export function useFilteredProjects(
  projects: BEProject[],
  filters: Record<string, ColumnFilter>
): BEProject[] {
  return useMemo(() => applyColumnFilters(projects, filters), [projects, filters]);
}
