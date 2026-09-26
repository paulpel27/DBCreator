/**
 * MenusPage — Menu Creator
 * Obsidian Forge: hierarchical menu builder linking forms and reports
 */
import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  Menu, Plus, Trash2, Edit3, ChevronLeft, GripVertical,
  ChevronRight, ChevronDown as ChevronDownIcon, FileText, BarChart3,
  Link, FolderOpen, ExternalLink
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import type { DBMenu, MenuItem } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

const ITEM_ICONS = [
  'home', 'database', 'table', 'form', 'report', 'settings', 'users',
  'folder', 'star', 'bookmark', 'chart', 'list', 'grid', 'search',
];

const ITEM_TYPE_OPTIONS = [
  { value: 'form', label: 'Form', icon: FileText, color: '#f5a623' },
  { value: 'report', label: 'Report', icon: BarChart3, color: '#6366f1' },
  { value: 'link', label: 'External Link', icon: Link, color: '#06b6d4' },
  { value: 'group', label: 'Group / Folder', icon: FolderOpen, color: '#10b981' },
  { value: 'separator', label: 'Separator', icon: ChevronRight, color: '#6b7280' },
];

export default function MenusPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const { projects, forms, reports, menus, createMenu, updateMenu, deleteMenu } = useDB();

  const project = projects.find((p) => p.id === projectId);
  const projectMenus = menus.filter((m) => m.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);
  const projectForms = forms.filter((f) => f.projectId === projectId);
  const projectReports = reports.filter((r) => r.projectId === projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [editMenu, setEditMenu] = useState<DBMenu | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DBMenu | null>(null);
  const [menuName, setMenuName] = useState('');
  const [menuDesc, setMenuDesc] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    label: '',
    type: 'form' as MenuItem['type'],
    targetId: '',
    url: '',
    icon: 'form',
    parentId: '',
    badge: '',
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!menuName.trim()) return;
    await createMenu({
      projectId,
      name: menuName.trim().toLowerCase().replace(/\s+/g, '_'),
      displayName: menuName.trim(),
      description: menuDesc.trim(),
      items: JSON.stringify(menuItems),
      isDefault: projectMenus.length === 0,
    });
    setShowCreate(false);
    resetState();
    toast.success('Menu created');
  };

  const handleEdit = async () => {
    if (!editMenu) return;
    await updateMenu({
      ...editMenu,
      displayName: menuName.trim(),
      description: menuDesc.trim(),
      items: JSON.stringify(menuItems),
    });
    setEditMenu(null);
    toast.success('Menu updated');
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteMenu(confirmDelete.id);
    setConfirmDelete(null);
    toast.success('Menu deleted');
  };

  const openEdit = (m: DBMenu) => {
    setEditMenu(m);
    setMenuName(m.displayName);
    setMenuDesc(m.description);
    try { setMenuItems(JSON.parse(m.items) as MenuItem[]); } catch { setMenuItems([]); }
  };

  const resetState = () => {
    setMenuName('');
    setMenuDesc('');
    setMenuItems([]);
    setEditItem(null);
    setItemForm({ label: '', type: 'form', targetId: '', url: '', icon: 'form', parentId: '', badge: '' });
  };

  const addItem = () => {
    if (!itemForm.label.trim()) return;
    const newItem: MenuItem = {
      id: nanoid(),
      label: itemForm.label.trim(),
      type: itemForm.type,
      targetId: itemForm.targetId || undefined,
      url: itemForm.url || undefined,
      icon: itemForm.icon,
      parentId: itemForm.parentId || undefined,
      badge: itemForm.badge || undefined,
      sortOrder: menuItems.length,
      visible: true,
    };
    setMenuItems([...menuItems, newItem]);
    setItemForm({ label: '', type: 'form', targetId: '', url: '', icon: 'form', parentId: '', badge: '' });
    toast.success('Item added');
  };

  const updateItem = () => {
    if (!editItem) return;
    setMenuItems((prev) => prev.map((item) =>
      item.id === editItem.id
        ? { ...item, label: itemForm.label, type: itemForm.type, targetId: itemForm.targetId || undefined, url: itemForm.url || undefined, icon: itemForm.icon, badge: itemForm.badge || undefined }
        : item
    ));
    setEditItem(null);
    setItemForm({ label: '', type: 'form', targetId: '', url: '', icon: 'form', parentId: '', badge: '' });
  };

  const removeItem = (id: string) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id && item.parentId !== id));
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEditItem = (item: MenuItem) => {
    setEditItem(item);
    setItemForm({
      label: item.label,
      type: item.type,
      targetId: item.targetId ?? '',
      url: item.url ?? '',
      icon: item.icon ?? 'form',
      parentId: item.parentId ?? '',
      badge: item.badge ?? '',
    });
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const arr = [...menuItems];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    setMenuItems(arr);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const getItemTypeInfo = (type: string) => ITEM_TYPE_OPTIONS.find((t) => t.value === type);

  const getTargetLabel = (item: MenuItem): string => {
    if (item.type === 'form') {
      return projectForms.find((f) => f.id === item.targetId)?.displayName ?? item.targetId ?? '';
    }
    if (item.type === 'report') {
      return projectReports.find((r) => r.id === item.targetId)?.displayName ?? item.targetId ?? '';
    }
    if (item.type === 'link') return item.url ?? '';
    return '';
  };

  // Render menu items tree
  const rootItems = menuItems.filter((i) => !i.parentId);
  const getChildren = (parentId: string) => menuItems.filter((i) => i.parentId === parentId);

  const MenuItemRow = ({ item, depth = 0 }: { item: MenuItem; depth?: number }) => {
    const typeInfo = getItemTypeInfo(item.type);
    const TypeIcon = typeInfo?.icon ?? FileText;
    const children = getChildren(item.id);
    const isExpanded = expandedGroups.has(item.id);

    return (
      <>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg group transition-all"
          style={{
            marginLeft: depth * 20,
            background: 'oklch(1 0 0 / 0.02)',
            border: '1px solid oklch(1 0 0 / 0.04)',
            marginBottom: 4,
          }}
        >
          {item.type === 'group' && (
            <button onClick={() => toggleGroup(item.id)} className="w-4 h-4 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              {isExpanded ? <ChevronDownIcon size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
          {item.type !== 'group' && <div className="w-4 flex-shrink-0" />}
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: `${typeInfo?.color ?? '#6b7280'}22` }}
          >
            <TypeIcon size={12} style={{ color: typeInfo?.color ?? '#6b7280' }} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</span>
            {getTargetLabel(item) && (
              <span className="text-xs ml-2" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                → {getTargetLabel(item)}
              </span>
            )}
          </div>
          {item.badge && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-soft)', color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
              {item.badge}
            </span>
          )}
          <div className="flex gap-1">
            <button onClick={() => openEditItem(item)} className="w-5 h-5 rounded flex items-center justify-center" style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}>
              <Edit3 size={10} />
            </button>
            <button onClick={() => removeItem(item.id)} className="w-5 h-5 rounded flex items-center justify-center" style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}>
              <Trash2 size={10} />
            </button>
          </div>
        </div>
        {item.type === 'group' && isExpanded && children.map((child) => (
          <MenuItemRow key={child.id} item={child} depth={depth + 1} />
        ))}
      </>
    );
  };

  const ItemFormSection = () => (
    <div className="neo-inset rounded-xl p-4 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
        {editItem ? 'Edit Item' : 'Add Item'}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>LABEL *</label>
          <input
            className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg"
            value={itemForm.label}
            onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
            placeholder="Menu item label"
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>TYPE</label>
          <select
            className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg"
            value={itemForm.type}
            onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as MenuItem['type'], targetId: '' })}
          >
            {ITEM_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {itemForm.type === 'form' && (
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>FORM</label>
          <select className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg" value={itemForm.targetId} onChange={(e) => setItemForm({ ...itemForm, targetId: e.target.value })}>
            <option value="">Select form...</option>
            {projectForms.map((f) => <option key={f.id} value={f.id}>{f.displayName}</option>)}
          </select>
        </div>
      )}

      {itemForm.type === 'report' && (
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>REPORT</label>
          <select className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg" value={itemForm.targetId} onChange={(e) => setItemForm({ ...itemForm, targetId: e.target.value })}>
            <option value="">Select report...</option>
            {projectReports.map((r) => <option key={r.id} value={r.id}>{r.displayName}</option>)}
          </select>
        </div>
      )}

      {itemForm.type === 'link' && (
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>URL</label>
          <input className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg" value={itemForm.url} onChange={(e) => setItemForm({ ...itemForm, url: e.target.value })} placeholder="https://" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
        </div>
      )}

      {/* Parent group */}
      {menuItems.some((i) => i.type === 'group') && (
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>PARENT GROUP</label>
          <select className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg" value={itemForm.parentId} onChange={(e) => setItemForm({ ...itemForm, parentId: e.target.value })}>
            <option value="">Root level</option>
            {menuItems.filter((i) => i.type === 'group').map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>BADGE</label>
          <input className="neo-input w-full px-2.5 py-1.5 text-sm rounded-lg" value={itemForm.badge} onChange={(e) => setItemForm({ ...itemForm, badge: e.target.value })} placeholder="New, 5, Beta..." />
        </div>
        <div className="flex items-end">
          <button
            onClick={editItem ? updateItem : addItem}
            disabled={!itemForm.label.trim()}
            className="neo-btn-primary w-full py-1.5 text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {editItem ? 'Update Item' : '+ Add Item'}
          </button>
        </div>
      </div>
      {editItem && (
        <button onClick={() => { setEditItem(null); setItemForm({ label: '', type: 'form', targetId: '', url: '', icon: 'form', parentId: '', badge: '' }); }} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Cancel edit
        </button>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-slide-in-up">
        <button onClick={() => navigate(`/designer/${projectId}`)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: 'var(--muted-foreground)', background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised-sm)' }}>
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>{project?.name}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Menu Creator</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{projectMenus.length} menu{projectMenus.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowCreate(true); resetState(); }} className="neo-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg">
          <Plus size={16} />New Menu
        </button>
      </div>

      {/* Menus list */}
      {projectMenus.length === 0 ? (
        <div className="animate-fade-in">
          <div className="rounded-2xl p-8" style={{ background: 'var(--neo-inset)', boxShadow: 'var(--neo-shadow-inset)' }}>
            {/* Menu tree motif */}
            <div className="flex justify-center mb-6">
              <svg width="180" height="90" viewBox="0 0 180 90" fill="none" opacity="0.6">
                {/* Root */}
                <rect x="60" y="5" width="60" height="14" rx="3" fill="rgba(245,166,35,0.2)" stroke="rgba(245,166,35,0.5)" strokeWidth="1.5" />
                <text x="90" y="16" textAnchor="middle" fill="rgba(245,166,35,0.9)" fontSize="7" fontFamily="JetBrains Mono">MAIN MENU</text>
                {/* Vertical stem */}
                <line x1="90" y1="19" x2="90" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                {/* Horizontal bar */}
                <line x1="30" y1="32" x2="150" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                {/* Branch A */}
                <line x1="30" y1="32" x2="30" y2="40" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <rect x="5" y="40" width="50" height="12" rx="2" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.4)" strokeWidth="1" />
                <text x="30" y="49" textAnchor="middle" fill="rgba(99,102,241,0.8)" fontSize="6" fontFamily="JetBrains Mono">FORM_A</text>
                {/* Branch B */}
                <line x1="90" y1="32" x2="90" y2="40" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <rect x="65" y="40" width="50" height="12" rx="2" fill="rgba(16,185,129,0.15)" stroke="rgba(16,185,129,0.4)" strokeWidth="1" />
                <text x="90" y="49" textAnchor="middle" fill="rgba(16,185,129,0.8)" fontSize="6" fontFamily="JetBrains Mono">REPORT_B</text>
                {/* Branch C */}
                <line x1="150" y1="32" x2="150" y2="40" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                <rect x="125" y="40" width="50" height="12" rx="2" fill="rgba(236,72,153,0.15)" stroke="rgba(236,72,153,0.4)" strokeWidth="1" />
                <text x="150" y="49" textAnchor="middle" fill="rgba(236,72,153,0.8)" fontSize="6" fontFamily="JetBrains Mono">FORM_C</text>
                {/* Sub-items under A */}
                <line x1="30" y1="52" x2="30" y2="60" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <rect x="10" y="60" width="40" height="10" rx="2" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x="30" y="68" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="5" fontFamily="JetBrains Mono">SUB_ITEM</text>
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>No menus yet</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>Create navigation menus that link your forms and reports together.</p>
              <button onClick={() => setShowCreate(true)} className="neo-btn-primary px-6 py-2.5 text-sm font-semibold rounded-lg">Create Menu</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Navigation Menu', desc: 'Top-level app menu', color: '#f5a623' },
              { label: 'Nested Items', desc: 'Sub-menus & groups', color: '#6366f1' },
              { label: 'Form & Report Links', desc: 'Link any form or report', color: '#10b981' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl p-3" style={{ background: 'var(--neo-raised)', boxShadow: 'var(--neo-shadow-raised)', borderTop: `2px solid ${t.color}` }}>
                <div className="text-xs font-bold mb-0.5" style={{ fontFamily: 'Space Grotesk, sans-serif', color: t.color }}>{t.label}</div>
                <div className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {projectMenus.map((menu) => {
            let parsedItems: MenuItem[] = [];
            try { parsedItems = JSON.parse(menu.items) as MenuItem[]; } catch {}
            return (
              <div key={menu.id} className="neo-raised rounded-xl overflow-hidden group">
                <div className="h-1" style={{ background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.3)' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>{menu.displayName}</h3>
                        {menu.isDefault && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--amber-soft)', color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>DEFAULT</span>
                        )}
                      </div>
                      {menu.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{menu.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(menu)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.05)' }}>
                        <Edit3 size={11} />
                      </button>
                      <button onClick={() => setConfirmDelete(menu)} className="w-6 h-6 rounded flex items-center justify-center" style={{ color: 'var(--destructive)', background: 'oklch(1 0 0 / 0.05)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 mt-3">
                    {parsedItems.filter((i) => !i.parentId).slice(0, 5).map((item) => {
                      const typeInfo = getItemTypeInfo(item.type);
                      const TypeIcon = typeInfo?.icon ?? FileText;
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <TypeIcon size={10} style={{ color: typeInfo?.color, flexShrink: 0 }} />
                          <span className="truncate">{item.label}</span>
                        </div>
                      );
                    })}
                    {parsedItems.length > 5 && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                        +{parsedItems.length - 5} more items
                      </p>
                    )}
                    {parsedItems.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No items yet</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate || !!editMenu} onOpenChange={() => { setShowCreate(false); setEditMenu(null); }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)', boxShadow: 'var(--neo-shadow-raised)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>
              {editMenu ? 'Edit Menu' : 'Create Menu'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>MENU NAME *</label>
                <input className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={menuName} onChange={(e) => setMenuName(e.target.value)} placeholder="Main Navigation" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>DESCRIPTION</label>
                <input className="neo-input w-full px-3 py-2 text-sm rounded-lg" value={menuDesc} onChange={(e) => setMenuDesc(e.target.value)} placeholder="Optional description" />
              </div>
            </div>

            {/* Item form */}
            <ItemFormSection />

            {/* Items tree */}
            {menuItems.length > 0 && (
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
                  MENU ITEMS ({menuItems.length})
                </label>
                <div className="space-y-1">
                  {rootItems.map((item) => (
                    <MenuItemRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button onClick={() => { setShowCreate(false); setEditMenu(null); }} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button
              onClick={editMenu ? handleEdit : handleCreate}
              disabled={!menuName.trim()}
              className="neo-btn-primary px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {editMenu ? 'Save' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent style={{ background: 'var(--neo-raised)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)' }}>Delete Menu</DialogTitle>
          </DialogHeader>
          <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>Delete menu <strong style={{ color: 'var(--foreground)' }}>{confirmDelete?.displayName}</strong>?</p>
          <DialogFooter className="gap-2">
            <button onClick={() => setConfirmDelete(null)} className="neo-btn px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--muted-foreground)' }}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ background: 'var(--destructive)', color: 'white' }}>Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
