import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Trash2, ChevronRight, Hash, ShieldCheck, Eye, EyeOff, CheckCircle, XCircle,
} from 'lucide-react';
import type { WfStep } from '@/types/workflow';
import type { WfValidationConfig, WfValidationConfigInsert, WfValidationConfigUpdate } from '@/types/workflowTaskConfig';
import {
  OBJECT_TYPE_LABELS, VALIDATOR_TYPE_LABELS, VALIDATION_MODE_CONFIG_LABELS,
  ON_APPROVED_LABELS, ON_REJECTED_LABELS,
} from '@/types/workflowTaskConfig';
import { WfValidationDetailPanel } from './WfValidationDetailPanel';
import { WfValidationAddDialog } from './WfValidationAddDialog';

interface Props {
  validationConfigs: WfValidationConfig[];
  steps: WfStep[];
  canManage: boolean;
  onAdd: (v: Omit<WfValidationConfigInsert, 'workflow_id'>) => Promise<WfValidationConfig | null>;
  onUpdate: (id: string, u: WfValidationConfigUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function WfValidationsSection({ validationConfigs, steps, canManage, onAdd, onUpdate, onDelete }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const sorted = [...validationConfigs].sort((a, b) => a.order_index - b.order_index);
  const selected = sorted.find(v => v.id === selectedId) || null;

  const getStepName = (key: string | null) => {
    if (!key) return '—';
    return steps.find(s => s.step_key === key)?.name || key;
  };

  return (
    <>
      <div className={`grid gap-4 ${selected ? 'grid-cols-1 lg:grid-cols-[1fr_400px]' : 'grid-cols-1'}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Validations
              </CardTitle>
              <CardDescription>{sorted.length} validation(s) configurée(s)</CardDescription>
            </div>
            {canManage && (
              <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Aucune validation configurée. Ajoutez des validations pour contrôler les passages clés.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Validation</TableHead>
                    <TableHead className="hidden md:table-cell">Objet</TableHead>
                    <TableHead className="hidden md:table-cell">Étape source</TableHead>
                    <TableHead className="hidden lg:table-cell">Validateur</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        /
                        <XCircle className="h-3 w-3 text-red-600" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[44px]"></TableHead>
                    {canManage && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(v => {
                    const isSelected = selectedId === v.id;
                    return (
                      <TableRow
                        key={v.id}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''} ${!v.is_active ? 'opacity-50' : ''}`}
                        onClick={() => setSelectedId(isSelected ? null : v.id)}
                      >
                        <TableCell>
                          <div className="min-w-0">
                            <span className="font-medium text-sm">{v.name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Hash className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground font-mono">{v.validation_key}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-[10px]">
                            {OBJECT_TYPE_LABELS[v.object_type] || v.object_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs">{getStepName(v.source_step_key)}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs">{VALIDATOR_TYPE_LABELS[v.validator_type] || v.validator_type}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <span className="text-green-700">✓ {ON_APPROVED_LABELS[v.on_approved_effect] || v.on_approved_effect}</span>
                            <span className="text-red-700">✗ {ON_REJECTED_LABELS[v.on_rejected_effect] || v.on_rejected_effect}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(v.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {selected && (
          <WfValidationDetailPanel
            validation={selected}
            steps={steps}
            canManage={canManage}
            onUpdate={onUpdate}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {isAddOpen && (
        <WfValidationAddDialog
          steps={steps}
          existingKeys={validationConfigs.map(v => v.validation_key)}
          onSave={async (data) => {
            await onAdd(data);
            setIsAddOpen(false);
          }}
          onClose={() => setIsAddOpen(false)}
        />
      )}
    </>
  );
}
