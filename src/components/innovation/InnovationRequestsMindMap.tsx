import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Maximize2, ChevronRight } from 'lucide-react';
import { STATUS_CONFIG, GROUPING_FIELDS, type InnoRequest, type GroupingField } from './constants';

interface Props {
  requests: InnoRequest[];
  onOpenDetail: (id: string) => void;
}

const CLUSTER_LIMIT = 15;

const LEVEL_COLORS = [
  'hsl(var(--primary))',
  'hsl(210 70% 55%)',
  'hsl(270 55% 55%)',
  'hsl(160 55% 45%)',
  'hsl(30 80% 55%)',
];

function getFieldValue(req: InnoRequest, field: GroupingField): string {
  if (field === 'status') return STATUS_CONFIG[req.status]?.label || req.status;
  return (req[field] as string) || '(vide)';
}

function getRawFieldValue(req: InnoRequest, field: GroupingField): string {
  if (field === 'status') return req.status;
  return (req[field] as string) || '';
}

function buildGraph(
  requests: InnoRequest[],
  groupBy: GroupingField,
  subGroupBy: GroupingField | null,
  drillPath: string[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const rootId = 'root';
  nodes.push({
    id: rootId,
    position: { x: 0, y: 0 },
    data: {
      label: `Demandes Innovation (${requests.length})`,
      count: requests.length,
      level: 0,
      isRoot: true,
    },
    type: 'default',
    style: {
      background: LEVEL_COLORS[0],
      color: '#fff',
      borderRadius: 12,
      padding: '12px 20px',
      fontWeight: 700,
      fontSize: 14,
      border: 'none',
      minWidth: 200,
      textAlign: 'center' as const,
    },
  });

  // Group by level 1
  const groups = new Map<string, InnoRequest[]>();
  requests.forEach(r => {
    const key = getFieldValue(r, groupBy);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  const groupEntries = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const drillLevel1 = drillPath[0];
  const filteredGroups = drillLevel1 ? groupEntries.filter(([k]) => k === drillLevel1) : groupEntries;

  const l1Spacing = 220;
  const l1StartX = -(filteredGroups.length - 1) * l1Spacing / 2;

  filteredGroups.forEach(([groupLabel, groupReqs], gi) => {
    const gId = `g1-${gi}`;
    const gx = l1StartX + gi * l1Spacing;
    const gy = 140;

    nodes.push({
      id: gId,
      position: { x: gx, y: gy },
      data: { label: `${groupLabel} (${groupReqs.length})`, count: groupReqs.length, level: 1, groupKey: groupLabel },
      style: {
        background: LEVEL_COLORS[1],
        color: '#fff',
        borderRadius: 10,
        padding: '10px 16px',
        fontWeight: 600,
        fontSize: 12,
        border: 'none',
        cursor: 'pointer',
        minWidth: 140,
        textAlign: 'center' as const,
      },
    });
    edges.push({ id: `e-root-${gId}`, source: rootId, target: gId, style: { stroke: LEVEL_COLORS[1], strokeWidth: 2 } });

    // Sub-group or leaf
    if (subGroupBy) {
      const subGroups = new Map<string, InnoRequest[]>();
      groupReqs.forEach(r => {
        const key = getFieldValue(r, subGroupBy);
        if (!subGroups.has(key)) subGroups.set(key, []);
        subGroups.get(key)!.push(r);
      });

      const subEntries = [...subGroups.entries()].sort((a, b) => b[1].length - a[1].length);
      const drillLevel2 = drillPath[1];
      const filteredSubs = drillLevel2 ? subEntries.filter(([k]) => k === drillLevel2) : subEntries;
      const l2Spacing = 180;
      const l2StartX = gx - (filteredSubs.length - 1) * l2Spacing / 2;

      filteredSubs.forEach(([subLabel, subReqs], si) => {
        const sId = `g2-${gi}-${si}`;
        const sx = l2StartX + si * l2Spacing;
        const sy = gy + 130;

        nodes.push({
          id: sId,
          position: { x: sx, y: sy },
          data: { label: `${subLabel} (${subReqs.length})`, count: subReqs.length, level: 2, groupKey: subLabel },
          style: {
            background: LEVEL_COLORS[2],
            color: '#fff',
            borderRadius: 8,
            padding: '8px 14px',
            fontWeight: 500,
            fontSize: 11,
            border: 'none',
            cursor: 'pointer',
            minWidth: 120,
            textAlign: 'center' as const,
          },
        });
        edges.push({ id: `e-${gId}-${sId}`, source: gId, target: sId, style: { stroke: LEVEL_COLORS[2], strokeWidth: 1.5 } });

        // Leaf nodes
        const leafReqs = subReqs.length > CLUSTER_LIMIT ? subReqs.slice(0, CLUSTER_LIMIT) : subReqs;
        const showCluster = subReqs.length > CLUSTER_LIMIT;
        const leafSpacing = 160;
        const leafStartX = sx - (leafReqs.length + (showCluster ? 1 : 0) - 1) * leafSpacing / 2;

        leafReqs.forEach((r, ri) => {
          const nId = `leaf-${r.id}`;
          nodes.push({
            id: nId,
            position: { x: leafStartX + ri * leafSpacing, y: sy + 120 },
            data: { label: r.nom_projet || r.title, requestId: r.id, level: 3, status: r.status },
            style: {
              background: STATUS_CONFIG[r.status]?.color || '#888',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              maxWidth: 150,
              whiteSpace: 'nowrap' as const,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center' as const,
            },
          });
          edges.push({ id: `e-${sId}-${nId}`, source: sId, target: nId, style: { stroke: '#ccc', strokeWidth: 1 } });
        });

        if (showCluster) {
          const clusterId = `cluster-${gi}-${si}`;
          nodes.push({
            id: clusterId,
            position: { x: leafStartX + leafReqs.length * leafSpacing, y: sy + 120 },
            data: { label: `+${subReqs.length - CLUSTER_LIMIT} demandes`, level: 3, isCluster: true },
            style: {
              background: 'hsl(var(--muted))',
              color: 'hsl(var(--muted-foreground))',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 500,
              border: '1px dashed hsl(var(--border))',
              cursor: 'default',
              textAlign: 'center' as const,
            },
          });
          edges.push({ id: `e-${sId}-${clusterId}`, source: sId, target: clusterId, style: { stroke: '#ccc', strokeWidth: 1, strokeDasharray: '4 4' } });
        }
      });
    } else {
      // No sub-grouping: show leaves directly
      const leafReqs = groupReqs.length > CLUSTER_LIMIT ? groupReqs.slice(0, CLUSTER_LIMIT) : groupReqs;
      const showCluster = groupReqs.length > CLUSTER_LIMIT;
      const leafSpacing = 160;
      const leafStartX = gx - (leafReqs.length + (showCluster ? 1 : 0) - 1) * leafSpacing / 2;

      leafReqs.forEach((r, ri) => {
        const nId = `leaf-${r.id}`;
        nodes.push({
          id: nId,
          position: { x: leafStartX + ri * leafSpacing, y: gy + 130 },
          data: { label: r.nom_projet || r.title, requestId: r.id, level: 3, status: r.status },
          style: {
            background: STATUS_CONFIG[r.status]?.color || '#888',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            maxWidth: 150,
            whiteSpace: 'nowrap' as const,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'center' as const,
          },
        });
        edges.push({ id: `e-${gId}-${nId}`, source: gId, target: nId, style: { stroke: '#ccc', strokeWidth: 1 } });
      });

      if (showCluster) {
        const clusterId = `cluster-${gi}`;
        nodes.push({
          id: clusterId,
          position: { x: leafStartX + leafReqs.length * leafSpacing, y: gy + 130 },
          data: { label: `+${groupReqs.length - CLUSTER_LIMIT} demandes`, level: 3, isCluster: true },
          style: {
            background: 'hsl(var(--muted))',
            color: 'hsl(var(--muted-foreground))',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 10,
            fontWeight: 500,
            border: '1px dashed hsl(var(--border))',
            cursor: 'default',
            textAlign: 'center' as const,
          },
        });
        edges.push({ id: `e-${gId}-${clusterId}`, source: gId, target: clusterId, style: { stroke: '#ccc', strokeWidth: 1, strokeDasharray: '4 4' } });
      }
    }
  });

  return { nodes, edges };
}

function MindMapInner({ requests, onOpenDetail }: Props) {
  const [groupBy, setGroupBy] = useState<GroupingField>('status');
  const [subGroupBy, setSubGroupBy] = useState<GroupingField | null>('entite_concernee');
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const { fitView } = useReactFlow();

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(requests, groupBy, subGroupBy, drillPath),
    [requests, groupBy, subGroupBy, drillPath],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when data changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [initialNodes, initialEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const data = node.data as any;
    if (data.requestId) {
      onOpenDetail(data.requestId);
      return;
    }
    if (data.isRoot || data.isCluster) return;
    if (data.level === 1) {
      setDrillPath([data.groupKey]);
    } else if (data.level === 2) {
      setDrillPath(prev => [prev[0] || '', data.groupKey]);
    }
  }, [onOpenDetail]);

  const breadcrumb = useMemo(() => {
    const items: { label: string; onClick: () => void }[] = [
      { label: 'Racine', onClick: () => setDrillPath([]) },
    ];
    if (drillPath[0]) {
      const field1 = GROUPING_FIELDS.find(f => f.value === groupBy)?.label || groupBy;
      items.push({ label: `${field1}: ${drillPath[0]}`, onClick: () => setDrillPath([drillPath[0]]) });
    }
    if (drillPath[1] && subGroupBy) {
      const field2 = GROUPING_FIELDS.find(f => f.value === subGroupBy)?.label || subGroupBy;
      items.push({ label: `${field2}: ${drillPath[1]}`, onClick: () => setDrillPath([drillPath[0], drillPath[1]]) });
    }
    return items;
  }, [drillPath, groupBy, subGroupBy]);

  const subGroupOptions = GROUPING_FIELDS.filter(f => f.value !== groupBy);

  return (
    <div className="h-[calc(100vh-280px)] min-h-[500px] rounded-lg border bg-background relative">
      {/* Top controls */}
      <Panel position="top-left" className="flex flex-wrap items-center gap-2 p-2 bg-background/90 backdrop-blur rounded-lg border shadow-sm m-2">
        <span className="text-xs font-medium text-muted-foreground">Grouper par :</span>
        <Select value={groupBy} onValueChange={v => { setGroupBy(v as GroupingField); setDrillPath([]); }}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {GROUPING_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs font-medium text-muted-foreground">Sous-grouper :</span>
        <Select value={subGroupBy || 'none'} onValueChange={v => { setSubGroupBy(v === 'none' ? null : v as GroupingField); setDrillPath([]); }}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucun</SelectItem>
            {subGroupOptions.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8" onClick={() => fitView({ padding: 0.2, duration: 300 })}>
          <Maximize2 className="w-3.5 h-3.5 mr-1" /> Centrer
        </Button>
      </Panel>

      {/* Breadcrumb */}
      {drillPath.length > 0 && (
        <Panel position="top-right" className="flex items-center gap-1 p-2 bg-background/90 backdrop-blur rounded-lg border shadow-sm m-2">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <button
                onClick={item.onClick}
                className="text-xs hover:underline text-primary font-medium"
              >
                {item.label}
              </button>
            </span>
          ))}
        </Panel>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          style={{ width: 120, height: 80 }}
        />
      </ReactFlow>
    </div>
  );
}

export function InnovationRequestsMindMap(props: Props) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  );
}
