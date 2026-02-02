import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

export function useTableSort<T extends Record<string, any>>(
  data: T[],
  defaultSortKey?: keyof T | string,
  defaultDirection: SortDirection = 'asc'
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultSortKey || '',
    direction: defaultSortKey ? defaultDirection : null,
  });

  const handleSort = useCallback((key: keyof T | string) => {
    setSortConfig((current) => {
      if (current.key === key) {
        // Cycle through: asc -> desc -> null
        if (current.direction === 'asc') {
          return { key, direction: 'desc' };
        } else if (current.direction === 'desc') {
          return { key: '', direction: null };
        }
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key as string);
      const bValue = getNestedValue(b, sortConfig.key as string);

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Handle booleans
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        const result = aValue === bValue ? 0 : aValue ? -1 : 1;
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const result = aValue - bValue;
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        const result = aValue.getTime() - bValue.getTime();
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Handle date strings
      const aDate = Date.parse(String(aValue));
      const bDate = Date.parse(String(bValue));
      if (!isNaN(aDate) && !isNaN(bDate)) {
        const result = aDate - bDate;
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Handle strings (default)
      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();
      const result = aString.localeCompare(bString, 'fr');
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig]);

  return {
    sortedData,
    sortConfig,
    handleSort,
    setSortConfig,
  };
}

// Helper to get nested object values like "company.name"
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
