/**
 * ERD Page — Visual Entity-Relationship Diagram
 * Obsidian Forge neomorphism design
 *
 * Features:
 *  - Draggable table nodes with field list and type badges
 *  - SVG relationship lines with crow's foot notation
 *  - Zoom / pan (wheel + drag canvas)
 *  - Auto-layout (force-directed grid)
 *  - Fit-to-screen
 *  - Highlight table + its relationships on click
 *  - Empty state when no tables
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ZoomIn, ZoomOut, Maximize2, LayoutGrid, ArrowLeft,
  GitBranch, Table2, RefreshCw,
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBTable, DBField, DBRelationship, FieldType } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodePos {
  x: number;
  y: number;
}

interface NodeSize {
  width: number;
  height: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEADER_H = 40;
const NODE_FIELD_H = 26;
const NODE_PADDING_BOTTOM = 8;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

// ─── Field type color map ─────────────────────────────────────────────────────

const FIELD_TYPE_COLOR: Record<FieldType, string> = {
  id: '#f5a623',
  text: '#6366f1',
  large_text: '#8b5cf6',
  number: '#06b6d4',
  decimal: '#06b6d4',
  boolean: '#10b981',
  date: '#f59e0b',
  datetime: '#f59e0b',
  time: '#f59e0b',
  image: '#ec4899',
  file: '#ec4899',
  foreign_key: '#ef4444',
  lov: '#84cc16',
  email: '#6366f1',
  url: '#6366f1',
  color: '#ec4899',
  json: '#8b5cf6',
};

function getFieldTypeShort(ft: FieldType): string {
  const map: Record<FieldType, string> = {
    id: 'PK', text: 'TXT', large_text: 'TXT+', number: 'INT',
    decimal: 'DEC', boolean: 'BOOL', date: 'DATE', datetime: 'DT',
    time: 'TIME', image: 'IMG', file: 'FILE', foreign_key: 'FK',
    lov: 'LOV', email: 'EMAIL', url: 'URL', color: 'CLR', json: 'JSON',
  };
  return map[ft] ?? ft.toUpperCase().slice(0, 4);
}

// ─── Node height calculation ──────────────────────────────────────────────────

function calcNodeHeight(fields: DBField[]): number {
  return NODE_HEADER_H + fields.length * NODE_FIELD_H + NODE_PADDING_BOTTOM;
}

// ─── Auto-layout: force-directed grid ────────────────────────────────────────

function autoLayout(
  tables: DBTable[],
  fieldsByTable: Map<string, DBField[]>,
  relationships: DBRelationship[],
): Map<string, NodePos> {
  const positions = new Map<string, NodePos>();
  if (tables.length === 0) return positions;

  const COLS = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const H_GAP = 60;
  const V_GAP = 60;

  // Initial grid placement
  tables.forEach((tbl, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    positions.set(tbl.id, {
      x: col * (NODE_WIDTH + H_GAP) + 40,
      y: row * (300 + V_GAP) + 40,
    });
  });

  // Simple force-directed relaxation (20 iterations)
  const REPULSION = 18000;
  const ATTRACTION = 0.04;
  const IDEAL_DIST = NODE_WIDTH + H_GAP;

  for (let iter = 0; iter < 20; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    tables.forEach((t) => forces.set(t.id, { fx: 0, fy: 0 }));

    // Repulsion between all pairs
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const a = positions.get(tables[i].id)!;
        const b = positions.get(tables[j].id)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces.get(tables[i].id)!.fx -= fx;
        forces.get(tables[i].id)!.fy -= fy;
        forces.get(tables[j].id)!.fx += fx;
        forces.get(tables[j].id)!.fy += fy;
      }
    }

    // Attraction along relationships
    relationships.forEach((rel) => {
      const a = positions.get(rel.fromTableId);
      const b = positions.get(rel.toTableId);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = ATTRACTION * (dist - IDEAL_DIST);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fa = forces.get(rel.fromTableId);
      const fb = forces.get(rel.toTableId);
      if (fa) { fa.fx += fx; fa.fy += fy; }
      if (fb) { fb.fx -= fx; fb.fy -= fy; }
    });

    // Apply forces
    tables.forEach((t) => {
      const pos = positions.get(t.id)!;
      const f = forces.get(t.id)!;
      const speed = 0.3;
      positions.set(t.id, {
        x: Math.max(20, pos.x + f.fx * speed),
        y: Math.max(20, pos.y + f.fy * speed),
      });
    });
  }

  return positions;
}

// ─── Crow's foot SVG markers ──────────────────────────────────────────────────

function SvgDefs() {
  return (
    <defs>
      {/* Arrow (one-side) */}
      <marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="rgba(245,166,35,0.7)" />
      </marker>
      {/* Crow's foot (many-side) */}
      <marker id="erd-crow" markerWidth="12" markerHeight="12" refX="2" refY="6" orient="auto">
        <path d="M2,6 L10,2 M2,6 L10,10 M2,6 L10,6" stroke="rgba(245,166,35,0.7)" strokeWidth="1.5" fill="none" />
      </marker>
      {/* One (single line) */}
      <marker id="erd-one" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
        <line x1="4" y1="1" x2="4" y2="7" stroke="rgba(245,166,35,0.7)" strokeWidth="1.5" />
      </marker>
      {/* LOV diamond */}
      <marker id="erd-lov" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
        <polygon points="5,1 9,5 5,9 1,5" fill="none" stroke="rgba(132,204,22,0.8)" strokeWidth="1.2" />
      </marker>
    </defs>
  );
}

// ─── Relationship line ────────────────────────────────────────────────────────

interface RelLineProps {
  rel: DBRelationship;
  fromPos: NodePos;
  fromSize: NodeSize;
  toPos: NodePos;
  toSize: NodeSize;
  highlighted: boolean;
  fromFields: DBField[];
  toFields: DBField[];
}

function RelLine({ rel, fromPos, fromSize, toPos, toSize, highlighted, fromFields, toFields }: RelLineProps) {
  // Find which row the from/to fields are on (for vertical offset)
  const fromFieldIdx = fromFields.findIndex((f) => f.id === rel.fromFieldId);
  const toFieldIdx = toFields.findIndex((f) => f.id === rel.toFieldId);

  const fromFieldY = NODE_HEADER_H + (fromFieldIdx >= 0 ? fromFieldIdx * NODE_FIELD_H + NODE_FIELD_H / 2 : NODE_FIELD_H / 2);
  const toFieldY = NODE_HEADER_H + (toFieldIdx >= 0 ? toFieldIdx * NODE_FIELD_H + NODE_FIELD_H / 2 : NODE_FIELD_H / 2);

  // Determine which side to connect from/to
  const fromCenterX = fromPos.x + fromSize.width / 2;
  const toCenterX = toPos.x + toSize.width / 2;

  let x1: number, x2: number;
  if (fromCenterX < toCenterX) {
    x1 = fromPos.x + fromSize.width;
    x2 = toPos.x;
  } else {
    x1 = fromPos.x;
    x2 = toPos.x + toSize.width;
  }

  const y1 = fromPos.y + fromFieldY;
  const y2 = toPos.y + toFieldY;

  // Bezier control points
  const dx = Math.abs(x2 - x1);
  const cpOffset = Math.max(60, dx * 0.4);
  const cp1x = x1 + (x1 < x2 ? cpOffset : -cpOffset);
  const cp2x = x2 + (x1 < x2 ? -cpOffset : cpOffset);

  const path = `M ${x1} ${y1} C ${cp1x} ${y1} ${cp2x} ${y2} ${x2} ${y2}`;

  const isLov = rel.type === 'lov';
  const strokeColor = highlighted
    ? (isLov ? 'rgba(132,204,22,0.95)' : 'rgba(245,166,35,0.95)')
    : (isLov ? 'rgba(132,204,22,0.45)' : 'rgba(245,166,35,0.45)');

  // Determine markers
  let markerStart = '';
  let markerEnd = '';
  if (isLov) {
    markerStart = 'url(#erd-lov)';
    markerEnd = 'url(#erd-lov)';
  } else if (rel.type === 'one_to_many') {
    markerStart = 'url(#erd-one)';
    markerEnd = 'url(#erd-crow)';
  } else if (rel.type === 'many_to_one') {
    markerStart = 'url(#erd-crow)';
    markerEnd = 'url(#erd-one)';
  } else {
    markerStart = 'url(#erd-one)';
    markerEnd = 'url(#erd-one)';
  }

  return (
    <g>
      {/* Shadow/glow for highlighted */}
      {highlighted && (
        <path
          d={path}
          fill="none"
          stroke={isLov ? 'rgba(132,204,22,0.2)' : 'rgba(245,166,35,0.2)'}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={highlighted ? 2 : 1.5}
        strokeLinecap="round"
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{ transition: 'stroke 150ms, stroke-width 150ms' }}
      />
      {/* Relationship label */}
      {highlighted && (
        <text
          x={(x1 + x2) / 2}
          y={Math.min(y1, y2) - 8}
          textAnchor="middle"
          fill={isLov ? 'rgba(132,204,22,0.9)' : 'rgba(245,166,35,0.9)'}
          fontSize={10}
          fontFamily="JetBrains Mono, monospace"
        >
          {rel.name || rel.type.replace(/_/g, '-')}
        </text>
      )}
    </g>
  );
}

// ─── Table Node ───────────────────────────────────────────────────────────────

interface TableNodeProps {
  table: DBTable;
  fields: DBField[];
  pos: NodePos;
  selected: boolean;
  highlighted: boolean;
  onMouseDown: (e: React.MouseEvent, tableId: string) => void;
  onClick: (tableId: string) => void;
  onHover: (tableId: string | null) => void;
  allTables: DBTable[];
}

function TableNode({ table, fields, pos, selected, highlighted, onMouseDown, onClick, onHover, allTables }: TableNodeProps) {
  const height = calcNodeHeight(fields);
  const borderColor = selected
    ? 'var(--amber)'
    : highlighted
    ? `${table.color}99`
    : 'oklch(1 0 0 / 0.08)';

  const headerBg = selected
    ? `linear-gradient(135deg, ${table.color}33, ${table.color}18)`
    : `linear-gradient(135deg, ${table.color}22, ${table.color}0d)`;

  const tableTypeBadge: Record<string, { label: string; color: string }> = {
    standard: { label: 'TABLE', color: 'rgba(255,255,255,0.3)' },
    master: { label: 'MASTER', color: 'rgba(245,166,35,0.7)' },
    detail: { label: 'DETAIL', color: 'rgba(99,102,241,0.7)' },
    lov: { label: 'LOV', color: 'rgba(132,204,22,0.7)' },
  };
  const badge = tableTypeBadge[table.tableType] ?? tableTypeBadge.standard;

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      style={{ cursor: 'grab' }}
      onMouseDown={(e) => onMouseDown(e, table.id)}
      onClick={(e) => { e.stopPropagation(); onClick(table.id); }}
      onMouseEnter={() => onHover(table.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Drop shadow */}
      <rect
        x={3} y={3}
        width={NODE_WIDTH} height={height}
        rx={10}
        fill="rgba(0,0,0,0.45)"
      />

      {/* Node background */}
      <rect
        x={0} y={0}
        width={NODE_WIDTH} height={height}
        rx={10}
        fill="oklch(0.195 0.014 270)"
        stroke={borderColor}
        strokeWidth={selected ? 2 : 1}
        style={{ transition: 'stroke 150ms' }}
      />

      {/* Header */}
      <rect x={0} y={0} width={NODE_WIDTH} height={NODE_HEADER_H} rx={10} fill="transparent" />
      <rect x={0} y={10} width={NODE_WIDTH} height={NODE_HEADER_H - 10} fill={`${table.color}18`} />
      {/* Header top-rounded */}
      <rect x={0} y={0} width={NODE_WIDTH} height={NODE_HEADER_H} rx={10}
        fill={`${table.color}18`}
        clipPath="inset(0 0 10px 0)"
      />
      {/* Header separator */}
      <line x1={0} y1={NODE_HEADER_H} x2={NODE_WIDTH} y2={NODE_HEADER_H}
        stroke={`${table.color}33`} strokeWidth={1} />

      {/* Table icon */}
      <rect x={10} y={11} width={18} height={18} rx={4}
        fill={`${table.color}33`}
        stroke={`${table.color}55`} strokeWidth={1}
      />
      <text x={19} y={23.5} textAnchor="middle" fill={table.color} fontSize={9} fontFamily="sans-serif">⊞</text>

      {/* Table name */}
      <text
        x={34} y={24}
        fill="oklch(0.92 0.008 270)"
        fontSize={12}
        fontWeight={700}
        fontFamily="Space Grotesk, sans-serif"
        style={{ userSelect: 'none' }}
      >
        {table.displayName.length > 18 ? table.displayName.slice(0, 17) + '…' : table.displayName}
      </text>

      {/* Type badge */}
      <text
        x={NODE_WIDTH - 8} y={24}
        textAnchor="end"
        fill={badge.color}
        fontSize={7.5}
        fontFamily="JetBrains Mono, monospace"
        style={{ userSelect: 'none' }}
      >
        {badge.label}
      </text>

      {/* Fields */}
      {fields.map((field, idx) => {
        const fy = NODE_HEADER_H + idx * NODE_FIELD_H;
        const isFK = field.fieldType === 'foreign_key';
        const isId = field.fieldType === 'id';
        const refTable = isFK && field.referencedTableId
          ? allTables.find((t) => t.id === field.referencedTableId)
          : null;
        const typeColor = FIELD_TYPE_COLOR[field.fieldType] ?? '#aaa';

        return (
          <g key={field.id}>
            {/* Row background on hover — handled via opacity */}
            {idx % 2 === 0 && (
              <rect x={0} y={fy} width={NODE_WIDTH} height={NODE_FIELD_H}
                fill="oklch(1 0 0 / 0.02)"
              />
            )}
            {/* PK/FK indicator */}
            {(isId || isFK) && (
              <rect x={0} y={fy + 8} width={3} height={NODE_FIELD_H - 16} rx={1.5}
                fill={typeColor}
              />
            )}
            {/* Field name */}
            <text
              x={isId || isFK ? 10 : 8} y={fy + 17}
              fill={isId ? 'var(--amber)' : isFK ? '#ef4444' : 'oklch(0.82 0.008 270)'}
              fontSize={10.5}
              fontFamily={isId ? 'JetBrains Mono, monospace' : 'Inter, sans-serif'}
              fontWeight={isId ? 700 : 400}
              style={{ userSelect: 'none' }}
            >
              {field.displayName.length > 18 ? field.displayName.slice(0, 17) + '…' : field.displayName}
              {field.required && !isId ? ' *' : ''}
            </text>
            {/* FK reference */}
            {refTable && (
              <text
                x={NODE_WIDTH - 8} y={fy + 17}
                textAnchor="end"
                fill="rgba(239,68,68,0.6)"
                fontSize={8.5}
                fontFamily="JetBrains Mono, monospace"
                style={{ userSelect: 'none' }}
              >
                → {refTable.displayName.slice(0, 10)}
              </text>
            )}
            {/* Type badge */}
            {!refTable && (
              <text
                x={NODE_WIDTH - 8} y={fy + 17}
                textAnchor="end"
                fill={typeColor}
                fontSize={8.5}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                style={{ userSelect: 'none' }}
              >
                {getFieldTypeShort(field.fieldType)}
              </text>
            )}
            {/* Row separator */}
            {idx < fields.length - 1 && (
              <line x1={6} y1={fy + NODE_FIELD_H} x2={NODE_WIDTH - 6} y2={fy + NODE_FIELD_H}
                stroke="oklch(1 0 0 / 0.05)" strokeWidth={1}
              />
            )}
          </g>
        );
      })}

      {/* Selection glow */}
      {selected && (
        <rect x={-2} y={-2} width={NODE_WIDTH + 4} height={height + 4} rx={12}
          fill="none"
          stroke={`${table.color}55`}
          strokeWidth={4}
        />
      )}
    </g>
  );
}

// ─── Main ERD Page ────────────────────────────────────────────────────────────

export default function ERDPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, tables, fields, relationships } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const projectTables = useMemo(
    () => tables.filter((t) => t.projectId === projectId),
    [tables, projectId]
  );
  const projectRelationships = useMemo(
    () => relationships.filter((r) => r.projectId === projectId),
    [relationships, projectId]
  );

  // Fields grouped by table
  const fieldsByTable = useMemo(() => {
    const map = new Map<string, DBField[]>();
    projectTables.forEach((t) => {
      map.set(t.id, fields.filter((f) => f.tableId === t.id).sort((a, b) => a.sortOrder - b.sortOrder));
    });
    return map;
  }, [fields, projectTables]);

  // Node positions (persisted in state so dragging works)
  const [positions, setPositions] = useState<Map<string, NodePos>>(new Map());
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Initialize / re-layout when tables change
  useEffect(() => {
    if (projectTables.length === 0) return;
    const newPos = autoLayout(projectTables, fieldsByTable, projectRelationships);
    setPositions(newPos);
  }, [layoutVersion, projectTables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Viewport transform
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Drag state
  const draggingNode = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const draggingCanvas = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);

  // Selected table (for highlighting)
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // Hovered table (for hover highlighting)
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);

  // Active highlight = selected takes priority, then hovered
  const activeHighlight = selectedTable ?? hoveredTable;

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Zoom ──────────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Fit to screen ─────────────────────────────────────────────────────────

  const fitToScreen = useCallback(() => {
    if (projectTables.length === 0 || !containerRef.current) return;
    const container = containerRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    projectTables.forEach((t) => {
      const pos = positions.get(t.id);
      if (!pos) return;
      const flds = fieldsByTable.get(t.id) ?? [];
      const h = calcNodeHeight(flds);
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + NODE_WIDTH);
      maxY = Math.max(maxY, pos.y + h);
    });

    const contentW = maxX - minX + 80;
    const contentH = maxY - minY + 80;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(W / contentW, H / contentH) * 0.9));
    const newPanX = (W - contentW * newZoom) / 2 - minX * newZoom + 40 * newZoom;
    const newPanY = (H - contentH * newZoom) / 2 - minY * newZoom + 40 * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [projectTables, positions, fieldsByTable]);

  // Fit on initial layout
  useEffect(() => {
    if (positions.size > 0) {
      setTimeout(fitToScreen, 50);
    }
  }, [positions.size]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node drag ─────────────────────────────────────────────────────────────

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    const pos = positions.get(tableId);
    if (!pos) return;
    draggingNode.current = {
      id: tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  }, [positions]);

  // ── Canvas drag ───────────────────────────────────────────────────────────

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    draggingCanvas.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };
    setSelectedTable(null);
  }, [pan]);

  // ── Mouse move ────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode.current) {
      const { id, startX, startY, origX, origY } = draggingNode.current;
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(id, { x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) });
        return next;
      });
    } else if (draggingCanvas.current) {
      const { startX, startY, origPanX, origPanY } = draggingCanvas.current;
      setPan({
        x: origPanX + (e.clientX - startX),
        y: origPanY + (e.clientY - startY),
      });
    }
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    draggingNode.current = null;
    draggingCanvas.current = null;
  }, []);

  // ── Highlighted relationships ─────────────────────────────────────────────

  const highlightedRelIds = useMemo(() => {
    if (!activeHighlight) return new Set<string>();
    return new Set(
      projectRelationships
        .filter((r) => r.fromTableId === activeHighlight || r.toTableId === activeHighlight)
        .map((r) => r.id)
    );
  }, [activeHighlight, projectRelationships]);

  const highlightedTableIds = useMemo(() => {
    if (!activeHighlight) return new Set<string>();
    const ids = new Set<string>([activeHighlight]);
    projectRelationships.forEach((r) => {
      if (r.fromTableId === activeHighlight) ids.add(r.toTableId);
      if (r.toTableId === activeHighlight) ids.add(r.fromTableId);
    });
    return ids;
  }, [activeHighlight, projectRelationships]);

  // ─── Empty state ────────────────────────────────────────────────────────────

  if (projectTables.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)', background: 'var(--neo-base)' }}
        >
          <button
            onClick={() => navigate(`/relationships/${projectId}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150"
            style={{
              color: 'var(--muted-foreground)',
              background: 'var(--neo-raised)',
              boxShadow: 'var(--neo-shadow-raised)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <ArrowLeft size={13} /> Back
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              Entity-Relationship Diagram
            </h1>
            {project && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                {project.name}
              </p>
            )}
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            className="rounded-2xl p-10 flex flex-col items-center text-center max-w-sm"
            style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}
          >
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" opacity="0.5" className="mb-4">
              <rect x="5" y="15" width="40" height="30" rx="4" fill="none" stroke="rgba(245,166,35,0.5)" strokeWidth="1.5" />
              <rect x="75" y="25" width="40" height="30" rx="4" fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" />
              <line x1="45" y1="30" x2="75" y2="40" stroke="rgba(245,166,35,0.3)" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x="25" y="34" textAnchor="middle" fill="rgba(245,166,35,0.6)" fontSize="7" fontFamily="JetBrains Mono">TABLE</text>
              <text x="95" y="44" textAnchor="middle" fill="rgba(99,102,241,0.6)" fontSize="7" fontFamily="JetBrains Mono">TABLE</text>
            </svg>
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              No tables yet
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
              Create tables in the Table Designer or use the AI Assistant to generate a schema, then come back to see the diagram.
            </p>
            <button
              onClick={() => navigate(`/designer/${projectId}`)}
              className="neo-btn-primary px-5 py-2 text-sm font-semibold rounded-lg"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Go to Table Designer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main canvas ────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100%' }}>
      {/* Header toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)', background: 'var(--neo-base)' }}
      >
        <button
          onClick={() => navigate(`/relationships/${projectId}`)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150"
          style={{
            color: 'var(--muted-foreground)',
            background: 'var(--neo-raised)',
            boxShadow: 'var(--neo-shadow-raised)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <ArrowLeft size={13} /> Back
        </button>

        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
            Entity-Relationship Diagram
          </h1>
          {project && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              {project.name} · {projectTables.length} table{projectTables.length !== 1 ? 's' : ''} · {projectRelationships.length} relationship{projectRelationships.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1.5">
          {/* Zoom out */}
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.8))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' }}
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>

          {/* Zoom level */}
          <div
            className="px-2.5 h-8 flex items-center rounded-lg text-xs font-bold"
            style={{
              color: 'var(--amber)',
              background: 'var(--neo-inset)',
              boxShadow: 'var(--neo-shadow-inset)',
              fontFamily: 'JetBrains Mono, monospace',
              minWidth: '52px',
              justifyContent: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </div>

          {/* Zoom in */}
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' }}
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>

          {/* Fit to screen */}
          <button
            onClick={fitToScreen}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' }}
            title="Fit to screen"
          >
            <Maximize2 size={14} />
          </button>

          {/* Re-layout */}
          <button
            onClick={() => setLayoutVersion((v) => v + 1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' }}
            title="Auto-layout"
          >
            <LayoutGrid size={14} />
          </button>

          {/* Refresh */}
          <button
            onClick={() => { setLayoutVersion((v) => v + 1); setSelectedTable(null); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)' }}
            title="Reset"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Legend */}
        <div
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}
        >
          {[
            { color: 'rgba(245,166,35,0.8)', label: '1:N' },
            { color: 'rgba(245,166,35,0.5)', label: '1:1' },
            { color: 'rgba(132,204,22,0.8)', label: 'LOV' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <svg width="20" height="10">
                <line x1="0" y1="5" x2="20" y2="5" stroke={color} strokeWidth="1.5" />
              </svg>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected table info bar */}
      {selectedTable && (() => {
        const tbl = projectTables.find((t) => t.id === selectedTable);
        if (!tbl) return null;
        const relCount = projectRelationships.filter((r) => r.fromTableId === selectedTable || r.toTableId === selectedTable).length;
        const fldCount = (fieldsByTable.get(selectedTable) ?? []).length;
        return (
          <div
            className="flex items-center gap-4 px-5 py-2 flex-shrink-0 animate-slide-in-up"
            style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)', background: `${tbl.color}0d` }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: tbl.color }} />
              <span className="text-sm font-bold" style={{ color: tbl.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                {tbl.displayName}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${tbl.color}22`, color: tbl.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                {tbl.tableType.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
              <Table2 size={12} />
              <span className="text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>{fldCount} fields</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
              <GitBranch size={12} />
              <span className="text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>{relCount} relationships</span>
            </div>
            <button
              onClick={() => navigate(`/tables/${projectId}/${selectedTable}`)}
              className="ml-auto text-xs px-3 py-1 rounded-md transition-all duration-150"
              style={{
                color: tbl.color,
                background: `${tbl.color}18`,
                border: `1px solid ${tbl.color}33`,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Open Table Designer →
            </button>
            <button
              onClick={() => setSelectedTable(null)}
              className="text-xs px-2 py-1 rounded-md"
              style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)' }}
            >
              ✕
            </button>
          </div>
        );
      })()}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{
          background: 'var(--neo-base)',
          backgroundImage: `
            radial-gradient(circle at 30% 30%, oklch(0.75 0.18 65 / 0.04) 0%, transparent 60%),
            radial-gradient(circle at 70% 70%, oklch(0.6 0.2 270 / 0.04) 0%, transparent 60%),
            linear-gradient(oklch(1 0 0 / 0.025) 1px, transparent 1px),
            linear-gradient(90deg, oklch(1 0 0 / 0.025) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 28px 28px, 28px 28px',
          cursor: draggingCanvas.current ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <SvgDefs />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Relationship lines (drawn below nodes) */}
            {projectRelationships.map((rel) => {
              const fromPos = positions.get(rel.fromTableId);
              const toPos = positions.get(rel.toTableId);
              if (!fromPos || !toPos) return null;
              const fromFields = fieldsByTable.get(rel.fromTableId) ?? [];
              const toFields = fieldsByTable.get(rel.toTableId) ?? [];
              const fromSize: NodeSize = { width: NODE_WIDTH, height: calcNodeHeight(fromFields) };
              const toSize: NodeSize = { width: NODE_WIDTH, height: calcNodeHeight(toFields) };
              return (
                <RelLine
                  key={rel.id}
                  rel={rel}
                  fromPos={fromPos}
                  fromSize={fromSize}
                  toPos={toPos}
                  toSize={toSize}
                  highlighted={highlightedRelIds.has(rel.id)}
                  fromFields={fromFields}
                  toFields={toFields}
                />
              );
            })}

            {/* Table nodes */}
            {projectTables.map((tbl) => {
              const pos = positions.get(tbl.id);
              if (!pos) return null;
              const flds = fieldsByTable.get(tbl.id) ?? [];
              return (
                <TableNode
                  key={tbl.id}
                  table={tbl}
                  fields={flds}
                  pos={pos}
                  selected={selectedTable === tbl.id}
                  highlighted={highlightedTableIds.has(tbl.id)}
                  onMouseDown={handleNodeMouseDown}
                  onClick={setSelectedTable}
                  onHover={setHoveredTable}
                  allTables={projectTables}
                />
              );
            })}
          </g>
        </svg>

        {/* Zoom hint */}
        <div
          className="absolute bottom-4 right-4 text-xs px-2.5 py-1.5 rounded-lg pointer-events-none"
          style={{
            color: 'var(--muted-foreground)',
            background: 'oklch(0.15 0.01 270 / 0.8)',
            fontFamily: 'Inter, sans-serif',
            backdropFilter: 'blur(4px)',
          }}
        >
          Scroll to zoom · Drag to pan · Click table to highlight
        </div>
      </div>
    </div>
  );
}
