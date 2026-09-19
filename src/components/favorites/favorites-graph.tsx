'use client';

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n/use-i18n';
import { cn } from '@/lib/utils';
import { useFavoriteStore } from '@/stores/favorite-store';
import type { FavoriteItem } from '@/types/favorite';

type NodeKind = 'word' | 'folder' | 'tag';

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: NodeKind;
  label: string;
  radius: number;
  item?: FavoriteItem;
  memberIds?: string[];
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

const NODE_COLOR: Record<NodeKind, { fill: string; stroke: string; text: string }> = {
  word: { fill: '#eef2ff', stroke: '#818cf8', text: '#3730a3' },
  folder: { fill: '#4f46e5', stroke: '#4338ca', text: '#ffffff' },
  tag: { fill: '#22c55e', stroke: '#16a34a', text: '#ffffff' },
};

const WIDTH = 900;
const HEIGHT = 560;

function buildGraph(
  favorites: FavoriteItem[],
  folders: { id: string; name: string; emoji: string }[],
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const folderMembers = new Map<string, string[]>();
  const tagMembers = new Map<string, string[]>();

  for (const fav of favorites) {
    nodes.push({ id: `word:${fav.id}`, kind: 'word', label: fav.text, radius: 14, item: fav });

    for (const folderId of fav.folderIds) {
      if (!folderMembers.has(folderId)) folderMembers.set(folderId, []);
      folderMembers.get(folderId)!.push(fav.text);
      links.push({ source: `word:${fav.id}`, target: `folder:${folderId}` });
    }

    for (const tag of fav.tags ?? []) {
      if (!tagMembers.has(tag)) tagMembers.set(tag, []);
      tagMembers.get(tag)!.push(fav.text);
      links.push({ source: `word:${fav.id}`, target: `tag:${tag}` });
    }
  }

  for (const [folderId, members] of folderMembers) {
    const folder = folders.find((f) => f.id === folderId);
    nodes.push({
      id: `folder:${folderId}`,
      kind: 'folder',
      label: folder ? `${folder.emoji} ${folder.name}` : folderId,
      radius: 16 + Math.min(members.length, 12),
      memberIds: members,
    });
  }

  for (const [tag, members] of tagMembers) {
    nodes.push({
      id: `tag:${tag}`,
      kind: 'tag',
      label: `#${tag}`,
      radius: 14 + Math.min(members.length, 12),
      memberIds: members,
    });
  }

  return { nodes, links };
}

export function FavoritesGraph() {
  const favorites = useFavoriteStore((s) => s.favorites);
  const folders = useFavoriteStore((s) => s.folders);
  const { messages: t } = useI18n('favorites');

  const { nodes, links } = useMemo(() => buildGraph(favorites, folders), [favorites, folders]);

  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const nodeElsRef = useRef<Map<string, SVGGElement>>(new Map());
  const linkElsRef = useRef<SVGLineElement[]>([]);
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; originX: number; originY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const neighborIds = useMemo(() => {
    const activeId = hoveredId ?? selected?.id ?? null;
    if (!activeId) return null;
    const set = new Set<string>([activeId]);
    for (const link of links) {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      if (sourceId === activeId) set.add(targetId);
      if (targetId === activeId) set.add(sourceId);
    }
    return set;
  }, [hoveredId, selected, links]);

  useEffect(() => {
    if (nodes.length === 0) return;

    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(70)
          .strength(0.5),
      )
      .force('charge', forceManyBody().strength(-160))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        'collide',
        forceCollide<GraphNode>().radius((d) => d.radius + 6),
      );
    simulationRef.current = simulation;

    simulation.on('tick', () => {
      for (const node of nodes) {
        const el = nodeElsRef.current.get(node.id);
        if (el) el.setAttribute('transform', `translate(${node.x ?? 0}, ${node.y ?? 0})`);
      }
      linkElsRef.current.forEach((el, index) => {
        const link = links[index];
        if (!link || !el) return;
        const source = typeof link.source === 'string' ? undefined : link.source;
        const target = typeof link.target === 'string' ? undefined : link.target;
        if (!source || !target) return;
        el.setAttribute('x1', String(source.x ?? 0));
        el.setAttribute('y1', String(source.y ?? 0));
        el.setAttribute('x2', String(target.x ?? 0));
        el.setAttribute('y2', String(target.y ?? 0));
      });
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    const y = ((clientY - rect.top) / rect.height) * HEIGHT;
    return { x: (x - transform.x) / transform.k, y: (y - transform.y) / transform.k };
  };

  const handleNodePointerDown = (node: GraphNode) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragNodeRef.current = node;
    simulationRef.current?.alphaTarget(0.3).restart();
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: transform.x,
      originY: transform.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragNodeRef.current) {
      const point = toSvgPoint(e.clientX, e.clientY);
      dragNodeRef.current.fx = point.x;
      dragNodeRef.current.fy = point.y;
      return;
    }
    if (panRef.current.active) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setTransform((prev) => ({ ...prev, x: panRef.current.originX + dx, y: panRef.current.originY + dy }));
    }
  };

  const handlePointerUp = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.fx = null;
      dragNodeRef.current.fy = null;
      simulationRef.current?.alphaTarget(0);
      dragNodeRef.current = null;
    }
    panRef.current.active = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({ ...prev, k: Math.min(3, Math.max(0.3, prev.k * delta)) }));
  };

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-20 text-center">
        <p className="text-lg font-medium text-slate-600">{t.graphEmptyTitle}</p>
        <p className="mt-1 max-w-sm text-sm text-slate-400">{t.graphEmptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[560px] w-full touch-none select-none"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          <title>{t.graphTitle}</title>
          <g ref={gRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
            {links.map((_link, index) => (
              <line
                key={`link-${index}`}
                ref={(el) => {
                  if (el) linkElsRef.current[index] = el;
                }}
                stroke="#c7d2fe"
                strokeWidth={1.25}
                opacity={0.6}
              />
            ))}
            {nodes.map((node) => {
              const colors = NODE_COLOR[node.kind];
              const dimmed = neighborIds ? !neighborIds.has(node.id) : false;
              return (
                <g
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeElsRef.current.set(node.id, el);
                  }}
                  role="button"
                  tabIndex={-1}
                  aria-label={node.label}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.15 : 1}
                  onPointerDown={handleNodePointerDown(node)}
                  onPointerEnter={() => setHoveredId(node.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(node);
                  }}
                >
                  <circle r={node.radius} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
                  <text
                    textAnchor="middle"
                    dy={node.kind === 'word' ? node.radius + 12 : 4}
                    fontSize={node.kind === 'word' ? 11 : 10}
                    fontWeight={node.kind === 'word' ? 500 : 700}
                    fill={node.kind === 'word' ? '#334155' : colors.text}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selected && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
          {selected.kind === 'word' && selected.item ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-lg font-bold text-indigo-950">{selected.item.text}</h3>
                <Volume2 className="h-4 w-4 text-indigo-300" />
              </div>
              <p className="text-sm text-slate-600">{selected.item.translation}</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.item.pos && <Badge variant="secondary">{selected.item.pos}</Badge>}
                {selected.item.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="border-indigo-200 text-indigo-500">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Link href="/favorites" className="inline-block text-xs font-medium text-indigo-600 underline">
                {t.viewInFavorites}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="font-heading text-base font-bold text-indigo-950">{selected.label}</h3>
              <div className="flex flex-wrap gap-1.5">
                {selected.memberIds?.map((label) => (
                  <span
                    key={label}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs',
                      selected.kind === 'folder' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700',
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
