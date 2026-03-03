import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Lightbulb, Plus, TableIcon, GitBranchPlus } from 'lucide-react';
import { InnoFiltersBar } from '@/components/innovation/InnoFiltersBar';
import { InnovationRequestsTable } from '@/components/innovation/InnovationRequestsTable';
import { InnovationRequestsMindMap } from '@/components/innovation/InnovationRequestsMindMap';
import { useInnovationRequests } from '@/hooks/useInnovationRequests';
import { STATUS_CONFIG, type InnoFilters } from '@/components/innovation/constants';

export default function InnovationRequests() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'table' | 'mindmap'>('table');
  const [filters, setFilters] = useState<InnoFilters>({
    search: '',
    status: 'all',
    entite: 'all',
    codeProjet: 'all',
    usage: 'all',
  });

  const { requests, isLoading, distinctValues, counters, total } = useInnovationRequests(filters);

  const handleOpenDetail = (id: string) => {
    // Navigate to detail (can be enhanced later with a dedicated page)
    navigate(`/innovation/requests/${id}`);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="innovation" onViewChange={() => {}} />
      <main className="flex-1 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-6 h-6 text-warning" />
            <PageHeader title="Demandes Innovation" />
          </div>
          <Button onClick={() => navigate('/requests')}>
            <Plus className="w-4 h-4 mr-2" /> Nouvelle demande
          </Button>
        </div>

        {/* Counters */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-sm">{total} demande{total > 1 ? 's' : ''}</Badge>
          {Object.entries(counters).map(([status, count]) => (
            <Badge
              key={status}
              variant="outline"
              className="text-xs gap-1"
              style={{ borderColor: STATUS_CONFIG[status]?.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_CONFIG[status]?.color }} />
              {STATUS_CONFIG[status]?.label || status}: {count}
            </Badge>
          ))}
        </div>

        {/* Filters + view toggle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <InnoFiltersBar filters={filters} onChange={setFilters} distinctValues={distinctValues} />
          <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as 'table' | 'mindmap')}>
            <ToggleGroupItem value="table" aria-label="Vue table" className="gap-1">
              <TableIcon className="w-4 h-4" /> Table
            </ToggleGroupItem>
            <ToggleGroupItem value="mindmap" aria-label="Vue mind map" className="gap-1">
              <GitBranchPlus className="w-4 h-4" /> Mind Map
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground">Chargement...</div>
        ) : viewMode === 'table' ? (
          <InnovationRequestsTable requests={requests} onOpenDetail={handleOpenDetail} />
        ) : (
          <InnovationRequestsMindMap requests={requests} onOpenDetail={handleOpenDetail} />
        )}
      </main>
    </div>
  );
}
