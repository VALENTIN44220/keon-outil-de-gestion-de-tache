import { useState, useEffect } from 'react';
import { Loader2, Database, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface TableViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  tableLabel: string;
}

type TableName = 'companies' | 'departments' | 'job_titles' | 'hierarchy_levels' | 'permission_profiles' | 'profiles' | 'assignment_rules' | 'categories';

const TABLE_COLUMNS: Record<TableName, { key: string; label: string }[]> = {
  companies: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description' },
  ],
  departments: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description' },
    { key: 'company_id', label: 'Société ID' },
    { key: 'id_services_lucca', label: 'ID Lucca' },
  ],
  job_titles: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description' },
    { key: 'department_id', label: 'Service ID' },
  ],
  hierarchy_levels: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'level', label: 'Niveau' },
    { key: 'description', label: 'Description' },
  ],
  permission_profiles: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description' },
  ],
  profiles: [
    { key: 'id', label: 'ID' },
    { key: 'display_name', label: 'Nom' },
    { key: 'company_id', label: 'Société ID' },
    { key: 'department_id', label: 'Service ID' },
    { key: 'job_title_id', label: 'Poste ID' },
    { key: 'manager_id', label: 'Manager ID' },
    { key: 'id_lucca', label: 'ID Lucca' },
  ],
  assignment_rules: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description' },
    { key: 'priority', label: 'Priorité' },
    { key: 'is_active', label: 'Actif' },
  ],
  categories: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'description', label: 'Description' },
  ],
};

export function TableViewDialog({
  open,
  onOpenChange,
  tableName,
  tableLabel,
}: TableViewDialogProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && tableName) {
      loadData();
    }
  }, [open, tableName]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: result, error: queryError } = await supabase
        .from(tableName as TableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (queryError) throw queryError;
      setData(result || []);
    } catch (err) {
      console.error('Error loading table data:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const columns = TABLE_COLUMNS[tableName as TableName] || [];

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const truncateId = (value: unknown): string => {
    const str = formatCellValue(value);
    if (str.length > 8 && str.includes('-')) {
      return str.substring(0, 8) + '...';
    }
    return str;
  };

  const exportToCSV = () => {
    if (data.length === 0) return;

    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(row => 
      columns.map(col => {
        const value = row[col.key];
        const formatted = formatCellValue(value);
        // Escape quotes and wrap in quotes if contains comma
        if (formatted.includes(',') || formatted.includes('"')) {
          return `"${formatted.replace(/"/g, '""')}"`;
        }
        return formatted;
      }).join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tableName}_export.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {tableLabel}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>
              Table: <code className="bg-muted px-1 rounded">{tableName}</code>
            </span>
            <Badge variant="secondary">{data.length} enregistrements</Badge>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            <p>{error}</p>
            <Button variant="outline" onClick={loadData} className="mt-4">
              Réessayer
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée dans cette table</p>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
            </div>
            <ScrollArea className="h-[50vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.key} className="whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, index) => (
                    <TableRow key={row.id as string || index}>
                      {columns.map((col) => (
                        <TableCell 
                          key={col.key} 
                          className="max-w-[200px] truncate"
                          title={formatCellValue(row[col.key])}
                        >
                          {col.key.includes('id') && col.key !== 'is_active'
                            ? truncateId(row[col.key])
                            : formatCellValue(row[col.key])
                          }
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
