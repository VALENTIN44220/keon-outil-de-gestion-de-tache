import { useState, useEffect, useCallback, useMemo } from 'react';

export type ItemTypeFilter = 'all' | 'tasks' | 'leaves';
export type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';

export interface WorkloadFiltersState {
  searchQuery: string;
  selectedUserIds: string[];
  selectedProcessId: string | null;
  selectedCompanyId: string | null;
  selectedDepartmentId: string | null;
  selectedStatuses: string[];
  selectedPriorities: string[];
  itemType: ItemTypeFilter;
  showOnlyOverloaded: boolean;
  showOnlyWithConflicts: boolean;
}

const DEFAULT_FILTERS: WorkloadFiltersState = {
  searchQuery: '',
  selectedUserIds: [],
  selectedProcessId: null,
  selectedCompanyId: null,
  selectedDepartmentId: null,
  selectedStatuses: [],
  selectedPriorities: [],
  itemType: 'all',
  showOnlyOverloaded: false,
  showOnlyWithConflicts: false,
};

const STORAGE_KEY = 'keon-workload-filters';

export function useWorkloadFilters() {
  const [filters, setFilters] = useState<WorkloadFiltersState>(() => {
    if (typeof window === 'undefined') return DEFAULT_FILTERS;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_FILTERS, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load workload filters:', error);
    }
    return DEFAULT_FILTERS;
  });

  // Persist to localStorage whenever filters change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.warn('Failed to save workload filters:', error);
    }
  }, [filters]);

  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setSelectedUserIds = useCallback((ids: string[]) => {
    setFilters(prev => ({ ...prev, selectedUserIds: ids }));
  }, []);

  const setSelectedProcessId = useCallback((id: string | null) => {
    setFilters(prev => ({ ...prev, selectedProcessId: id }));
  }, []);

  const setSelectedCompanyId = useCallback((id: string | null) => {
    setFilters(prev => ({ ...prev, selectedCompanyId: id }));
  }, []);

  const setSelectedDepartmentId = useCallback((id: string | null) => {
    setFilters(prev => ({ ...prev, selectedDepartmentId: id }));
  }, []);

  const setSelectedStatuses = useCallback((statuses: string[]) => {
    setFilters(prev => ({ ...prev, selectedStatuses: statuses }));
  }, []);

  const setSelectedPriorities = useCallback((priorities: string[]) => {
    setFilters(prev => ({ ...prev, selectedPriorities: priorities }));
  }, []);

  const setItemType = useCallback((type: ItemTypeFilter) => {
    setFilters(prev => ({ ...prev, itemType: type }));
  }, []);

  const setShowOnlyOverloaded = useCallback((show: boolean) => {
    setFilters(prev => ({ ...prev, showOnlyOverloaded: show }));
  }, []);

  const setShowOnlyWithConflicts = useCallback((show: boolean) => {
    setFilters(prev => ({ ...prev, showOnlyWithConflicts: show }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchQuery !== '' ||
      filters.selectedUserIds.length > 0 ||
      filters.selectedProcessId !== null ||
      filters.selectedCompanyId !== null ||
      filters.selectedDepartmentId !== null ||
      filters.selectedStatuses.length > 0 ||
      filters.selectedPriorities.length > 0 ||
      filters.itemType !== 'all' ||
      filters.showOnlyOverloaded ||
      filters.showOnlyWithConflicts
    );
  }, [filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.selectedUserIds.length > 0) count++;
    if (filters.selectedProcessId) count++;
    if (filters.selectedCompanyId) count++;
    if (filters.selectedDepartmentId) count++;
    if (filters.selectedStatuses.length > 0) count++;
    if (filters.selectedPriorities.length > 0) count++;
    if (filters.itemType !== 'all') count++;
    if (filters.showOnlyOverloaded) count++;
    if (filters.showOnlyWithConflicts) count++;
    return count;
  }, [filters]);

  return {
    filters,
    setSearchQuery,
    setSelectedUserIds,
    setSelectedProcessId,
    setSelectedCompanyId,
    setSelectedDepartmentId,
    setSelectedStatuses,
    setSelectedPriorities,
    setItemType,
    setShowOnlyOverloaded,
    setShowOnlyWithConflicts,
    clearFilters,
    hasActiveFilters,
    activeFiltersCount,
  };
}
