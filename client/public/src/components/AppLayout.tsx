/**
 * AppLayout — Persistent sidebar shell
 * Obsidian Forge: deep neomorphic sidebar + workbench canvas
 * Design: tactile raised/inset surfaces, amber accent, JetBrains Mono data labels
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Database,
  Table2,
  FileText,
  BarChart3,
  Menu,
  ChevronLeft,
  ChevronRight,
  Plus,
  GitBranch,
  Home,
  Layers,
  Sparkles,
  Settings2,
  Network,
  Rocket,
  LayoutTemplate,
  HelpCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { useDB } from '@/contexts/DBContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
}

function getProjectNav(projectId: string): NavItem[] {
  return [
    { icon: <Table2 size={14} />, label: 'Tables', href: `/designer/${projectId}` },
    { icon: <GitBranch size={14} />, label: 'Relationships', href: `/relationships/${projectId}` },
    { icon: <Network size={14} />, label: 'ERD Diagram', href: `/erd/${projectId}` },
    { icon: <FileText size={14} />, label: 'Forms', href: `/forms/${projectId}` },
    { icon: <BarChart3 size={14} />, label: 'Reports', href: `/reports/${projectId}` },
    { icon: <Menu size={14} />, label: 'Menus', href: `/menus/${projectId}` },
    { icon: <Rocket size={14} />, label: 'Publish App', href: `/publish/${projectId}` },
  ];
}

// DBCreator brand mark: two overlapping rectangles with amber node
function DBCreatorMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      {/* Back rect */}
      <rect x="1" y="5" width="13" height="10" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      {/* Front rect */}
      <rect x="8" y="7" width="13" height="10" rx="2" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      {/* Amber connection node */}
      <circle cx="11" cy="12" r="2.5" fill="#f5a623" />
      <circle cx="11" cy="12" r="1.2" fill="#1e1e2e" />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const [location, navigate] = useLocation();
  const { projects, activeProject, setActiveProject, createProject } = useDB();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Detect active project from URL
  useEffect(() => {
    const match = location.match(/\/(designer|tables|relationships|erd|forms|reports|menus|run|view|publish)\/([^/]+)/);
    if (match) {
      const pid = match[2];
      const proj = projects.find((p) => p.id === pid);
      if (proj && proj.id !== activeProject?.id) {
        setActiveProject(proj);
      }
    }
  }, [location, projects, activeProject, setActiveProject]);

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location.startsWith(href);
  };

  const handleNewProject = async () => {
    const p = await createProject({ name: 'New Database', description: '' });
    await setActiveProject(p);
    navigate(`/designer/${p.id}`);
  };

  const sidebarWidth = expanded ? 256 : 60;

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: 'var(--neo-base)' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width: sidebarWidth,
          background: 'var(--neo-inset)',
          boxShadow: '6px 0 24px rgba(0,0,0,0.45), inset -1px 0 0 rgba(255,255,255,0.04)',
          transition: 'width 200ms cubic-bezier(0.23,1,0.32,1)',
          zIndex: 10,
        }}
      >
        {/* Logo + toggle */}
        <div
          className="flex items-center gap-3 px-3 py-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          {/* Brand mark */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'oklch(0.195 0.014 270)',
              boxShadow: '3px 3px 8px rgba(0,0,0,0.5), -1px -1px 4px rgba(255,255,255,0.05), 0 0 12px rgba(245,166,35,0.15)',
              border: '1px solid oklch(1 0 0 / 0.08)',
            }}
          >
            <DBCreatorMark size={22} />
          </div>
          {expanded && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <div
                className="font-bold text-sm leading-tight truncate"
                style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.01em' }}
              >
                DBCreator
              </div>
              <div
                className="text-xs truncate"
                style={{ color: 'var(--amber)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', opacity: 0.8 }}
              >
                LOCAL DATABASE STUDIO
              </div>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150"
            style={{
              color: 'var(--muted-foreground)',
              background: 'oklch(1 0 0 / 0.05)',
              boxShadow: '2px 2px 4px rgba(0,0,0,0.3), -1px -1px 2px rgba(255,255,255,0.03)',
            }}
          >
            {expanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        {/* Home nav */}
        <div className="px-2 pt-2 flex-shrink-0">
          <SidebarNavBtn
            icon={<Home size={15} />}
            label="Home"
            active={isActive('/')}
            expanded={expanded}
            onClick={() => navigate('/')}
          />
        </div>

        {/* Databases section */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {expanded && (
            <div className="flex items-center justify-between px-2 mb-2 mt-1">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}
              >
                Databases
              </span>
              <button
                onClick={handleNewProject}
                className="w-5 h-5 rounded flex items-center justify-center transition-all duration-150"
                style={{
                  color: 'var(--muted-foreground)',
                  background: 'oklch(1 0 0 / 0.05)',
                }}
                title="New Database"
              >
                <Plus size={11} />
              </button>
            </div>
          )}
          {!expanded && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleNewProject}
                  className="w-full flex justify-center py-2 mb-1 rounded-lg transition-all duration-150"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <Plus size={15} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">New Database</TooltipContent>
            </Tooltip>
          )}

          {/* Project items */}
          {projects.map((proj) => {
            const isActiveProj = activeProject?.id === proj.id;
            return (
              <div key={proj.id}>
                <button
                  onClick={async () => {
                    await setActiveProject(proj);
                    navigate(`/designer/${proj.id}`);
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-all duration-150 text-left"
                  style={{
                    color: isActiveProj ? 'var(--amber)' : 'var(--muted-foreground)',
                    background: isActiveProj ? 'var(--amber-soft)' : 'transparent',
                    boxShadow: isActiveProj ? 'inset 0 0 0 1px oklch(0.75 0.18 65 / 0.2)' : 'none',
                    borderLeft: isActiveProj ? '2px solid var(--amber)' : '2px solid transparent',
                    paddingLeft: '10px',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isActiveProj ? 'var(--amber)' : 'oklch(1 0 0 / 0.08)',
                      color: isActiveProj ? '#1e1e2e' : 'var(--muted-foreground)',
                      fontFamily: 'Space Grotesk, sans-serif',
                      boxShadow: isActiveProj ? '0 0 6px rgba(245,166,35,0.3)' : 'none',
                    }}
                  >
                    {proj.name.charAt(0).toUpperCase()}
                  </div>
                  {expanded && (
                    <span
                      className="text-sm font-medium truncate"
                      style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                      {proj.name}
                    </span>
                  )}
                </button>

                {/* Sub-nav for active project */}
                {isActiveProj && expanded && (
                  <div
                    className="ml-3 mt-1 mb-2 space-y-0.5 animate-slide-in-up"
                    style={{
                      borderLeft: '1px solid oklch(0.75 0.18 65 / 0.2)',
                      paddingLeft: '8px',
                    }}
                  >
                    {getProjectNav(proj.id).map((item) => {
                      const active = isActive(item.href);
                      return (
                        <button
                          key={item.href}
                          onClick={() => navigate(item.href)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all duration-120"
                          style={{
                            color: active ? 'var(--amber)' : 'var(--muted-foreground)',
                            background: active ? 'var(--amber-glow)' : 'transparent',
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {projects.length === 0 && expanded && (
            <div className="px-2 py-4 text-center">
              <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                No databases yet.
              </p>
              <button
                onClick={handleNewProject}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--amber)', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Create your first →
              </button>
            </div>
          )}
        </div>

        {/* Templates nav */}
        <div className="px-2 pb-1 flex-shrink-0" style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)', paddingTop: '8px' }}>
          <SidebarNavBtn
            icon={<LayoutTemplate size={15} />}
            label="App Templates"
            active={isActive('/templates')}
            expanded={expanded}
            onClick={() => navigate('/templates')}
          />
        </div>

        {/* Help nav */}
        <div className="px-2 pb-1 flex-shrink-0" style={{ paddingTop: '2px' }}>
          <SidebarNavBtn
            icon={<HelpCircle size={15} />}
            label="Help & Info"
            active={isActive('/help')}
            expanded={expanded}
            onClick={() => navigate('/help')}
          />
        </div>

        {/* AI Tools nav */}
        <div className="px-2 pb-1 flex-shrink-0" style={{ paddingTop: '4px' }}>
          <SidebarNavBtn
            icon={<Sparkles size={15} />}
            label="AI Assistant"
            active={isActive('/ai-chat')}
            expanded={expanded}
            onClick={() => navigate('/ai-chat')}
          />
          <SidebarNavBtn
            icon={<Settings2 size={15} />}
            label="AI Settings"
            active={isActive('/ai-settings')}
            expanded={expanded}
            onClick={() => navigate('/ai-settings')}
          />
        </div>

        {/* Bottom status bar + theme toggle */}
        <div
          className="px-3 py-2.5 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {expanded ? (
            <div className="flex items-center justify-between gap-2">
              {/* Status dot + label */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#10b981', boxShadow: '0 0 4px rgba(16,185,129,0.5)' }}
                />
                <p
                  className="text-xs truncate"
                  style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}
                >
                  All data stored locally
                </p>
              </div>
              {/* Theme toggle pill */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 transition-all duration-200"
                    style={{
                      background: isDark ? 'oklch(1 0 0 / 0.07)' : 'oklch(0 0 0 / 0.07)',
                      border: `1px solid ${isDark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0 0 0 / 0.1)'}`,
                      color: 'var(--muted-foreground)',
                    }}
                    aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                  >
                    {isDark ? <Sun size={11} /> : <Moon size={11} />}
                    <span style={{ fontSize: '0.6rem', fontFamily: 'JetBrains Mono, monospace' }}>
                      {isDark ? 'Light' : 'Dark'}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isDark ? 'Switch to white background' : 'Switch to black background'}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {/* Status dot */}
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#10b981', boxShadow: '0 0 4px rgba(16,185,129,0.5)' }}
              />
              {/* Collapsed theme toggle icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
                    style={{
                      background: isDark ? 'oklch(1 0 0 / 0.07)' : 'oklch(0 0 0 / 0.07)',
                      border: `1px solid ${isDark ? 'oklch(1 0 0 / 0.1)' : 'oklch(0 0 0 / 0.1)'}`,
                      color: 'var(--muted-foreground)',
                    }}
                    aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                  >
                    {isDark ? <Sun size={13} /> : <Moon size={13} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isDark ? 'Switch to white background' : 'Switch to black background'}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main workbench canvas ─────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-hidden flex flex-col"
        style={{
          background: 'var(--neo-base)',
          backgroundImage: `
            radial-gradient(circle at 20% 20%, oklch(0.75 0.18 65 / 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, oklch(0.6 0.2 270 / 0.03) 0%, transparent 50%)
          `,
        }}
      >
        {children}
      </main>
    </div>
  );
}

function SidebarNavBtn({
  icon, label, active, expanded, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className="w-full flex justify-center py-2.5 rounded-lg transition-all duration-150"
            style={{
              color: active ? 'var(--amber)' : 'var(--muted-foreground)',
              background: active ? 'var(--amber-soft)' : 'transparent',
            }}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-lg transition-all duration-150 text-left"
      style={{
        color: active ? 'var(--amber)' : 'var(--muted-foreground)',
        background: active ? 'var(--amber-soft)' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px oklch(0.75 0.18 65 / 0.2)' : 'none',
        borderLeft: active ? '2px solid var(--amber)' : '2px solid transparent',
        paddingLeft: '10px',
      }}
    >
      {icon}
      <span className="text-sm font-medium" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
        {label}
      </span>
    </button>
  );
}
