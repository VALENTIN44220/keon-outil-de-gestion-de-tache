import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeResizer,
  Position,
  Handle,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeProps,
  type Edge,
  type EdgeProps,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ITSolutionLinkFormDialog } from '@/components/it/ITSolutionLinkFormDialog';
import { useITSolutions } from '@/hooks/useITSolutions';
import {
  CRITICITE_CONFIG,
  DIRECTION_LABEL,
  FLUX_TYPE_CONFIG,
  resolveFluxType,
  type ITSolution,
  type ITSolutionLink,
} from '@/types/itSolution';

interface Props {
  solutions: ITSolution[];
  links: ITSolutionLink[];
  onSelectSolution?: (s: ITSolution) => void;
}

type SolutionNodeData = Record<string, unknown> & {
  solution: ITSolution;
  onSelect?: (s: ITSolution) => void;
};

type SolutionLinkData = Record<string, unknown> & {
  link: ITSolutionLink;
  onEdit: (link: ITSolutionLink) => void;
};

const DEFAULT_NODE_W = 220;
const DEFAULT_NODE_H = 90;

/**
 * Layout dagre — DAG layered, minimise les croisements d'arêtes. Utilisé
 * uniquement pour les nœuds dont la position n'est PAS encore enregistrée
 * en base (les nœuds avec position_x/y sont laissés à leur place).
 */
function dagreLayout(
  solutions: ITSolution[],
  links: ITSolutionLink[]
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const s of solutions) {
    g.setNode(s.id, { width: s.width ?? DEFAULT_NODE_W, height: s.height ?? DEFAULT_NODE_H });
  }
  for (const l of links) {
    if (g.hasNode(l.source_solution_id) && g.hasNode(l.target_solution_id)) {
      g.setEdge(l.source_solution_id, l.target_solution_id);
    }
  }

  dagre.layout(g);

  const out: Record<string, { x: number; y: number }> = {};
  for (const s of solutions) {
    const n = g.node(s.id);
    if (n) {
      // dagre renvoie le centre du nœud, ReactFlow attend le coin haut-gauche
      const w = s.width ?? DEFAULT_NODE_W;
      const h = s.height ?? DEFAULT_NODE_H;
      out[s.id] = { x: n.x - w / 2, y: n.y - h / 2 };
    }
  }
  return out;
}

function nodeBorder(crit: ITSolution['criticite']): string {
  switch (crit) {
    case 'tres_forte': return 'border-red-500';
    case 'forte':      return 'border-orange-500';
    case 'moyenne':    return 'border-blue-400';
    case 'faible':     return 'border-slate-300';
    default:           return 'border-slate-300';
  }
}

function SolutionNode({ data, selected }: NodeProps<Node<SolutionNodeData>>) {
  const { solution: s, onSelect } = data;
  return (
    <div
      onClick={() => onSelect?.(s)}
      className={cn(
        'group relative h-full w-full rounded-lg border-2 bg-background shadow-sm hover:shadow-md transition-shadow px-3 py-2 cursor-pointer overflow-hidden',
        nodeBorder(s.criticite ?? null),
        selected && 'ring-2 ring-primary'
      )}
    >
      <NodeResizer
        color="#6366f1"
        isVisible={selected}
        minWidth={140}
        minHeight={64}
        handleClassName="!w-2 !h-2 !rounded-sm"
        lineClassName="!border-primary"
      />

      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" id="t" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" id="b" />
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" id="l" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" id="r" />

      <div className="flex items-start gap-2 h-full">
        {s.logo_url && (
          <img
            src={s.logo_url}
            alt=""
            className="h-8 w-8 shrink-0 rounded border bg-white object-contain p-0.5"
            draggable={false}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight break-words">{s.nom}</p>
          {s.categorie && (
            <p className="text-[10px] text-muted-foreground leading-tight break-words mt-0.5">{s.categorie}</p>
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
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, id, style, markerStart } = props;
  // smoothstep : routage orthogonal qui réduit fortement les croisements
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12,
  });

  const link = data?.link;
  const flux = link?.type_flux ? resolveFluxType(link.type_flux) : null;
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
        markerStart={markerStart}
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
  const { updateSolutionLayout } = useITSolutions();
  const [editingLink, setEditingLink] = useState<ITSolutionLink | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  /**
   * Position de chaque nœud :
   *  - Si position_x/y présents en DB → on les utilise
   *  - Sinon on utilise dagre pour calculer un layout sans croisements
   */
  const initialPositions = useMemo(() => {
    const fallback = dagreLayout(solutions, links);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const s of solutions) {
      if (typeof s.position_x === 'number' && typeof s.position_y === 'number') {
        positions[s.id] = { x: Number(s.position_x), y: Number(s.position_y) };
      } else {
        positions[s.id] = fallback[s.id] ?? { x: 0, y: 0 };
      }
    }
    return positions;
  }, [solutions, links]);

  const buildNodes = useCallback((): Node<SolutionNodeData>[] =>
    solutions.map((s) => ({
      id: s.id,
      type: 'solution',
      position: initialPositions[s.id] ?? { x: 0, y: 0 },
      width: s.width ?? DEFAULT_NODE_W,
      height: s.height ?? DEFAULT_NODE_H,
      style: { width: s.width ?? DEFAULT_NODE_W, height: s.height ?? DEFAULT_NODE_H },
      data: { solution: s, onSelect: onSelectSolution },
    })),
    [solutions, initialPositions, onSelectSolution]
  );

  const buildEdges = useCallback((): Edge<SolutionLinkData>[] =>
    links.map((l) => {
      const flux = l.type_flux ? resolveFluxType(l.type_flux) : null;
      return {
        id: l.id,
        source: l.source_solution_id,
        target: l.target_solution_id,
        type: 'characterized',
        animated: l.criticite === 'tres_forte' || l.criticite === 'forte',
        markerEnd: { type: MarkerType.ArrowClosed, color: flux?.color ?? '#6b7280' },
        markerStart: l.direction === 'bidirectionnel'
          ? { type: MarkerType.ArrowClosed, color: flux?.color ?? '#6b7280' }
          : undefined,
        style: { stroke: flux?.color ?? '#6b7280', strokeWidth: 2 },
        data: {
          link: l,
          onEdit: (link) => { setEditingLink(link); setLinkDialogOpen(true); },
        },
      };
    }),
    [links]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SolutionNodeData>>(buildNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<SolutionLinkData>>(buildEdges());

  // Resync when source data change (DB invalidation)
  useEffect(() => { setNodes(buildNodes()); }, [buildNodes, setNodes]);
  useEffect(() => { setEdges(buildEdges()); }, [buildEdges, setEdges]);

  // Debounce de persistance pour drag/resize (évite de spammer la DB)
  const pendingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const schedulePersist = useCallback((id: string, payload: { x?: number; y?: number; w?: number; h?: number }) => {
    const existing = pendingTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      pendingTimers.current.delete(id);
      updateSolutionLayout.mutate({
        id,
        position_x: payload.x,
        position_y: payload.y,
        width: payload.w,
        height: payload.h,
      });
    }, 600);
    pendingTimers.current.set(id, t);
  }, [updateSolutionLayout]);

  // Hook ReactFlow : intercepte les changements de position et de dimension
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) {
        // Drag terminé
        schedulePersist(c.id, { x: c.position.x, y: c.position.y });
      } else if (c.type === 'dimensions' && c.dimensions && c.resizing === false) {
        // Resize terminé
        schedulePersist(c.id, { w: c.dimensions.width, h: c.dimensions.height });
      }
    }
  }, [onNodesChange, schedulePersist]);

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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
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
        <p className="font-semibold mt-2 mb-1">Astuce</p>
        <p className="text-muted-foreground">Glissez pour déplacer, sélectionnez puis tirez les coins pour redimensionner.</p>
      </div>

      <ITSolutionLinkFormDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        link={editingLink}
      />
    </div>
  );
}
