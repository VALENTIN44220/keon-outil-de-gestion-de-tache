import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  Handle,
  Position,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ITSolutionLinkFormDialog } from '@/components/it/ITSolutionLinkFormDialog';
import {
  CRITICITE_CONFIG,
  DIRECTION_LABEL,
  FLUX_TYPE_CONFIG,
  type ITSolution,
  type ITSolutionLink,
} from '@/types/itSolution';

interface Props {
  solutions: ITSolution[];
  links: ITSolutionLink[];
  onSelectSolution?: (s: ITSolution) => void;
}

type SolutionNodeData = {
  solution: ITSolution;
  onSelect?: (s: ITSolution) => void;
};

type SolutionLinkData = {
  link: ITSolutionLink;
  onEdit: (link: ITSolutionLink) => void;
};

/**
 * Pose les nœuds en couches concentriques par catégorie. Le « hub » data
 * (Datalake / catégorie Plateforme data) est placé au centre, les autres
 * solutions distribuées en cercles autour selon leur catégorie.
 */
function computeLayout(solutions: ITSolution[]): Record<string, { x: number; y: number }> {
  if (solutions.length === 0) return {};
  const positions: Record<string, { x: number; y: number }> = {};

  // Hub : la première solution dont la catégorie est "Plateforme data" sinon
  // la solution avec le plus de liens entrants (déterminé en amont si on
  // l'avait — ici on prend simplement la 1ère "Plateforme data").
  const hub = solutions.find((s) => (s.categorie ?? '').toLowerCase().includes('plateforme'))
    ?? solutions[0];
  positions[hub.id] = { x: 0, y: 0 };

  // Regroupe par catégorie hors hub
  const buckets = new Map<string, ITSolution[]>();
  for (const s of solutions) {
    if (s.id === hub.id) continue;
    const k = s.categorie?.trim() || 'Sans catégorie';
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(s);
  }

  const categories = Array.from(buckets.keys());
  const totalCats = categories.length || 1;
  const baseRadius = 360;
  const angleStep = (2 * Math.PI) / totalCats;

  categories.forEach((cat, ci) => {
    const items = buckets.get(cat)!;
    const baseAngle = ci * angleStep;
    const radius = baseRadius + (items.length > 3 ? 80 : 0);
    items.forEach((s, i) => {
      // Spread items in a small arc around the category direction
      const arc = items.length > 1 ? (i / (items.length - 1) - 0.5) * 0.45 : 0;
      const a = baseAngle + arc;
      positions[s.id] = {
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
      };
    });
  });

  return positions;
}

/** Couleur de bordure du nœud selon la criticité de la solution. */
function nodeBorder(crit: ITSolution['criticite']): string {
  switch (crit) {
    case 'tres_forte': return 'border-red-500';
    case 'forte':      return 'border-orange-500';
    case 'moyenne':    return 'border-blue-400';
    case 'faible':     return 'border-slate-300';
    default:           return 'border-slate-300';
  }
}

function SolutionNode({ data }: NodeProps<Node<SolutionNodeData>>) {
  const { solution: s, onSelect } = data;
  return (
    <div
      onClick={() => onSelect?.(s)}
      className={cn(
        'group rounded-lg border-2 bg-background shadow-sm hover:shadow-md transition-shadow px-3 py-2 cursor-pointer min-w-[180px] max-w-[220px]',
        nodeBorder(s.criticite ?? null)
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" id="left" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" id="right" />

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{s.nom}</p>
          {s.categorie && (
            <p className="text-[10px] text-muted-foreground truncate">{s.categorie}</p>
          )}
        </div>
        {s.criticite && (
          <Badge
            variant="outline"
            className={cn('shrink-0 text-[9px] h-4 px-1', CRITICITE_CONFIG[s.criticite].className)}
          >
            {CRITICITE_CONFIG[s.criticite].label}
          </Badge>
        )}
      </div>
    </div>
  );
}

function CharacterizedEdge(props: EdgeProps<Edge<SolutionLinkData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, id, style } = props;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  const link = data?.link;
  const flux = link?.type_flux ? FLUX_TYPE_CONFIG[link.type_flux] : null;
  const direction = link?.direction ? DIRECTION_LABEL[link.direction] : null;

  return (
    <>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={flux?.color ?? '#6b7280'}
        strokeWidth={2}
        markerEnd={markerEnd}
        style={style}
      />
      {link && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data?.onEdit(link); }}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            className="absolute pointer-events-auto rounded-full border bg-background px-2 py-0.5 text-[10px] shadow-sm hover:bg-accent transition-colors"
          >
            <span className="font-medium" style={{ color: flux?.color }}>
              {flux?.label ?? '·'}
            </span>
            {direction && <span className="ml-1 text-muted-foreground">{direction.symbol}</span>}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes = { solution: SolutionNode };
const edgeTypes = { characterized: CharacterizedEdge };

export function ITCartographieGraph({ solutions, links, onSelectSolution }: Props) {
  const [editingLink, setEditingLink] = useState<ITSolutionLink | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const layout = useMemo(() => computeLayout(solutions), [solutions]);

  const nodes: Node<SolutionNodeData>[] = useMemo(
    () => solutions.map((s) => ({
      id: s.id,
      type: 'solution',
      position: layout[s.id] ?? { x: 0, y: 0 },
      data: { solution: s, onSelect: onSelectSolution },
    })),
    [solutions, layout, onSelectSolution]
  );

  const edges: Edge<SolutionLinkData>[] = useMemo(
    () => links.map((l) => {
      const flux = l.type_flux ? FLUX_TYPE_CONFIG[l.type_flux] : null;
      const arrow = l.direction === 'bidirectionnel' ? MarkerType.ArrowClosed : MarkerType.ArrowClosed;
      return {
        id: l.id,
        source: l.source_solution_id,
        target: l.target_solution_id,
        type: 'characterized',
        animated: l.criticite === 'tres_forte' || l.criticite === 'forte',
        markerEnd: { type: arrow, color: flux?.color ?? '#6b7280' },
        markerStart: l.direction === 'bidirectionnel' ? { type: arrow, color: flux?.color ?? '#6b7280' } : undefined,
        style: { stroke: flux?.color ?? '#6b7280', strokeWidth: 2 },
        data: {
          link: l,
          onEdit: (link) => { setEditingLink(link); setLinkDialogOpen(true); },
        },
      };
    }),
    [links]
  );

  const openCreateLink = useCallback(() => {
    setEditingLink(null);
    setLinkDialogOpen(true);
  }, []);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <Button type="button" size="sm" onClick={openCreateLink} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nouveau lien
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} pannable zoomable />
      </ReactFlow>

      {/* Légende des types de flux */}
      <div className="absolute bottom-2 left-2 z-10 rounded-md border bg-background/90 backdrop-blur p-2 text-[11px] shadow-sm">
        <p className="font-semibold mb-1">Types de flux</p>
        <div className="flex flex-col gap-0.5">
          {(Object.entries(FLUX_TYPE_CONFIG) as [keyof typeof FLUX_TYPE_CONFIG, typeof FLUX_TYPE_CONFIG.data][]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: v.color }} />
              <span>{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ITSolutionLinkFormDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        link={editingLink}
      />
    </div>
  );
}
