/**
 * HelpPage — practical user guide, disclaimer, and contact information.
 * Sections: What you can do · How to use it · Disclaimer · About · Contact
 */
import { useMemo, useRef, useState } from 'react';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { useDB } from '@/contexts/DBContext';
import { useLocation } from 'wouter';
import {
  HelpCircle,
  Sparkles,
  Table2,
  FileText,
  BarChart3,
  Menu,
  GitBranch,
  Network,
  Rocket,
  LayoutTemplate,
  ChevronRight,
  ExternalLink,
  Mail,
  Globe,
  Shield,
  BookOpen,
  Zap,
  Sun,
  Download,
  Smartphone,
  Wand2,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  Search,
  X,
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
}

interface Feature {
  icon: React.ReactNode;
  color: string;
  title: string;
  summary: string;
  bullets: readonly string[];
  target: HelpTarget;
}

interface FAQItem {
  q: string;
  intro: string;
  steps: readonly string[];
  tip?: string;
}

export interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

export interface HelpSearchSuggestion {
  label: string;
  query: string;
  description: string;
}

type HelpTarget =
  | 'home'
  | 'designer'
  | 'relationships'
  | 'erd'
  | 'forms'
  | 'reports'
  | 'menus'
  | 'ai-chat'
  | 'ai-settings'
  | 'templates'
  | 'publisher';

const SECTIONS: Section[] = [
  { id: 'what', icon: <BookOpen size={15} />, title: 'What You Can Do', color: '#f59e0b' },
  { id: 'howto', icon: <Zap size={15} />, title: 'How To Use It', color: '#6366f1' },
  { id: 'disclaimer', icon: <Shield size={15} />, title: 'Disclaimer & Liability', color: '#ef4444' },
  { id: 'about', icon: <Globe size={15} />, title: 'About Peltagsoftware', color: '#10b981' },
  { id: 'contact', icon: <Mail size={15} />, title: 'Contact', color: '#0ea5e9' },
];

export const HELP_SEARCH_SUGGESTIONS: readonly HelpSearchSuggestion[] = [
  { label: 'Backups & Restore', query: 'backup', description: 'Export and recover local database data' },
  { label: 'LOVs & Reference Data', query: 'lov', description: 'Set up dropdown choices and lookup values' },
  { label: 'Templates', query: 'template', description: 'Start from a complete example database' },
  { label: 'Publishing', query: 'publish', description: 'Download a standalone HTML application' },
  { label: 'Forms & Reports', query: 'form', description: 'Create data-entry forms and review reports' },
  { label: 'AI Assistant', query: 'ai', description: 'Generate a database design or mock records' },
];

export const QUICK_START = [
  {
    number: '01',
    title: 'Start a workspace',
    desc: 'Create a database from scratch, restore a backup, or install a template.',
    color: '#f59e0b',
  },
  {
    number: '02',
    title: 'Model the data',
    desc: 'Add tables and fields, then connect records with relationships or LOVs.',
    color: '#6366f1',
  },
  {
    number: '03',
    title: 'Build the experience',
    desc: 'Create forms for data entry, reports for review, and menus for navigation.',
    color: '#10b981',
  },
  {
    number: '04',
    title: 'Share and protect',
    desc: 'Publish a standalone HTML app and export JSON backups regularly.',
    color: '#ef4444',
  },
] as const;

export const FEATURES: Feature[] = [
  {
    icon: <Table2 size={16} />,
    color: '#6366f1',
    title: 'Database & Table Designer',
    summary: 'Design the structure of your app before you enter any records.',
    bullets: [
      'Create tables and add fields from 17 practical data types.',
      'Set required fields, defaults, validation, LOV choices, and foreign keys.',
      'Rename or remove tables and fields with dependent design items cleaned up automatically.',
    ],
    target: 'designer',
  },
  {
    icon: <GitBranch size={16} />,
    color: '#f59e0b',
    title: 'Relationships',
    summary: 'Connect records so related information stays organised and easy to navigate.',
    bullets: [
      'Create one-to-many links such as Customers → Orders.',
      'Choose foreign key fields and configure cascade-delete behaviour.',
      'Use master-detail forms to work with parent and child records together.',
    ],
    target: 'relationships',
  },
  {
    icon: <Network size={16} />,
    color: '#8b5cf6',
    title: 'ERD Diagram',
    summary: 'See your full data model as an interactive Entity-Relationship Diagram.',
    bullets: [
      'Drag tables, pan the canvas, zoom, and use auto-layout.',
      'Inspect crow’s-foot relationship cardinality at a glance.',
    ],
    target: 'erd',
  },
  {
    icon: <FileText size={16} />,
    color: '#10b981',
    title: 'Form Builder & Runner',
    summary: 'Build focused data-entry screens for any table, then run them immediately.',
    bullets: [
      'Choose visible fields, labels, required settings, and form layout.',
      'Create, edit, and delete records from the form runner.',
      'Use split-panel master-detail layouts for records such as Orders and Order Lines.',
    ],
    target: 'forms',
  },
  {
    icon: <BarChart3 size={16} />,
    color: '#0ea5e9',
    title: 'Report Viewer',
    summary: 'Create read-only data views for reviewing, sorting, filtering, and sharing.',
    bullets: [
      'Select the columns and default sort order you need.',
      'Filter and sort records in the report viewer.',
      'Export a report to CSV with one click.',
    ],
    target: 'reports',
  },
  {
    icon: <Menu size={16} />,
    color: '#ec4899',
    title: 'Menu Builder',
    summary: 'Give users a clear route through forms and reports in your published app.',
    bullets: [
      'Link menu items to forms and reports.',
      'Set item labels, icons, hierarchy, and display order.',
    ],
    target: 'menus',
  },
  {
    icon: <Wand2 size={16} />,
    color: '#f59e0b',
    title: 'AI Mock Data Generator',
    summary: 'Populate a table with realistic sample records without manual typing.',
    bullets: [
      'Generate between 1 and 100 rows from the table schema.',
      'Add a context hint, preview the output, then seed accepted rows.',
      'Open it from the Table Designer or an empty form.',
    ],
    target: 'designer',
  },
  {
    icon: <Sparkles size={16} />,
    color: '#a855f7',
    title: 'AI Assistant',
    summary: 'Describe an application and let AI propose the database design for you to review.',
    bullets: [
      'Generate tables, fields, relationships, forms, reports, and menus.',
      'Review the plan before using Build This in DBCreator.',
    ],
    target: 'ai-chat',
  },
  {
    icon: <LayoutTemplate size={16} />,
    color: '#6366f1',
    title: 'App Templates',
    summary: 'Begin with a complete example instead of a blank database.',
    bullets: [
      'Choose from eight templates, including CRM, HR, Doctor’s Practice, and Small Hospital.',
      'Install tables, forms, reports, menus, and sample data in one action.',
      'Delete installed template data later with a double-confirmation step.',
    ],
    target: 'templates',
  },
  {
    icon: <Rocket size={16} />,
    color: '#ef4444',
    title: 'SaaS App Publisher',
    summary: 'Download your database as a complete, self-contained HTML application.',
    bullets: [
      'Include selected menus, forms, reports, reference data, and records.',
      'Use the exported app offline in a modern browser with no server required.',
      'Keep master-detail forms and lookup values available in the exported app.',
    ],
    target: 'publisher',
  },
  {
    icon: <Download size={16} />,
    color: '#f59e0b',
    title: 'Backup & Restore',
    summary: 'Keep a portable copy of every database before making major changes.',
    bullets: [
      'Use the amber Export Backup button on each Home-page database card.',
      'Use Export All Backups to download every project at once.',
      'Restore a JSON backup from Home with Import Backup.',
    ],
    target: 'home',
  },
  {
    icon: <Sun size={16} />,
    color: '#f59e0b',
    title: 'Light / Dark Theme',
    summary: 'Choose the workspace appearance that is most comfortable for you.',
    bullets: [
      'Use the Sun/Moon control in the sidebar footer.',
      'Your preference is saved automatically for later visits.',
    ],
    target: 'home',
  },
  {
    icon: <Smartphone size={16} />,
    color: '#10b981',
    title: 'Install as App (PWA)',
    summary: 'Install DBCreator for a focused, app-like, offline experience.',
    bullets: [
      'Use Install App from Home in Chrome, Edge, or Android.',
      'In iOS Safari, use Share → Add to Home Screen.',
    ],
    target: 'home',
  },
];

export const HOW_TO: FAQItem[] = [
  {
    q: 'How do I create my first database?',
    intro: 'A database is the workspace that holds its tables, forms, reports, menus, and records.',
    steps: [
      'Open Home and select New Database, or use the + button beside Databases in the sidebar.',
      'Enter a name and create the database.',
      'Continue directly to the Table Designer to add the first table.',
    ],
  },
  {
    q: 'How do I add a table and define its fields?',
    intro: 'Tables describe the subjects your app stores, such as Customers, Orders, Products, or Patients.',
    steps: [
      'In Tables, choose Add Table and set its name, type, and colour.',
      'Open the table card to access the Field Editor.',
      'Use Add Field to choose each field type, label, required setting, and any defaults or LOV values.',
    ],
  },
  {
    q: 'How do I link two tables with a foreign key?',
    intro: 'Use a foreign key when one record should point to another record, such as an Order pointing to a Customer.',
    steps: [
      'In the child table, add a field with the Foreign Key type.',
      'Choose the parent table and the field that should be displayed to users.',
      'Open Relationships and create the link using the foreign key field.',
    ],
    tip: 'For fixed options such as Gender or Status, use an LOV table or an inline LOV field instead of free text.',
  },
  {
    q: 'How do I generate realistic sample data with AI?',
    intro: 'AI mock data is useful when you want to test forms, reports, and published apps before real data is available.',
    steps: [
      'Open a table and select ✨ Mock Data, or use Generate Mock Data with AI in an empty form.',
      'Choose a row count from 1 to 100 and optionally add a context hint.',
      'Review the generated rows and select Seed into Database when they look right.',
    ],
  },
  {
    q: 'How do I create a form for data entry?',
    intro: 'Forms are the editable screens that users use to create and update records.',
    steps: [
      'Open Forms for the database and choose New Form.',
      'Select the table, then decide which fields appear and how they are labelled.',
      'Save the form and use Run Form from its card to enter records.',
    ],
  },
  {
    q: 'How do I set up a master-detail form?',
    intro: 'Master-detail forms keep parent records and their related child records together on one screen.',
    steps: [
      'Create a form for the detail table first, such as Order Lines.',
      'Create or edit the master form, such as Orders.',
      'In Detail Forms, select the detail form to attach; running the master form then shows a linked detail panel.',
    ],
  },
  {
    q: 'How do I create a report?',
    intro: 'Reports are read-only views designed for reviewing and exporting data safely.',
    steps: [
      'Open Reports and choose New Report.',
      'Choose its table, visible columns, and default sort order.',
      'Save it, open View Report, then filter, sort, or export the result to CSV.',
    ],
  },
  {
    q: 'How do I use the AI Assistant to build an app?',
    intro: 'The AI Assistant can draft a complete data model from a plain-language description.',
    steps: [
      'Configure an AI provider in AI Settings with a compatible API key.',
      'Describe the app you need, for example an invoicing system with customers and invoice lines.',
      'Review the generated plan, then use Build This in DBCreator to create the proposed design.',
    ],
  },
  {
    q: 'How do I install an App Template?',
    intro: 'Templates are the quickest way to learn DBCreator with a ready-made example.',
    steps: [
      'Open App Templates in the sidebar.',
      'Use Preview to inspect the proposed schema and included components.',
      'Select Install to create a new database with its sample data, forms, reports, and menus.',
    ],
  },
  {
    q: 'How do I delete data installed by a template?',
    intro: 'Template data can be removed when you no longer need the installed example.',
    steps: [
      'Find the installed template and select the red Delete Data button.',
      'Read the list of tables, forms, reports, menus, and records that will be removed.',
      'Tick the confirmation box, then select Yes, Delete Everything.',
    ],
    tip: 'This deletion is permanent. Export a backup first if you might need the template again.',
  },
  {
    q: 'How do I publish my app as a standalone HTML file?',
    intro: 'Publishing creates one HTML file that contains the selected app structure and data.',
    steps: [
      'Open a database and select Publish App from its sidebar navigation.',
      'Set the app identity and select the menus, forms, and reports to include.',
      'Choose Download HTML, then open the saved file in a browser to use it offline.',
    ],
  },
  {
    q: 'How do I back up and restore my databases?',
    intro: 'Backups protect locally stored browser data from accidental deletion, browser resets, or device changes.',
    steps: [
      'On Home, use Export Backup on a database card or Export All Backups for every database.',
      'Store the downloaded JSON file somewhere safe outside the browser.',
      'Use Import Backup on Home and choose the JSON file when you need to restore it.',
    ],
    tip: 'Back up before large schema changes and at regular intervals while working on an important project.',
  },
  {
    q: 'How do I switch between light and dark mode?',
    intro: 'DBCreator remembers the workspace appearance you choose.',
    steps: [
      'Use the Sun/Moon control in the sidebar footer.',
      'Choose the labelled control in an expanded sidebar or the icon control when the sidebar is collapsed.',
    ],
  },
  {
    q: 'How do I install DBCreator as an app on my device?',
    intro: 'Installing the PWA removes browser chrome and keeps DBCreator available offline.',
    steps: [
      'In Chrome, Edge, or Android, select Install App in the Home-page install banner.',
      'In iOS Safari, use Share and then Add to Home Screen.',
      'Launch DBCreator from the new device icon after installation.',
    ],
  },
  {
    q: 'Where is my data stored?',
    intro: 'Your database schemas, forms, reports, menus, and records are stored locally in your browser’s IndexedDB storage.',
    steps: [
      'Data stays on the device and is not sent to a DBCreator server.',
      'Use Export Backup regularly because cleared browser storage cannot be recovered by the app.',
    ],
  },
];

export function matchesHelpSearch(query: string, content: readonly string[]): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return !normalizedQuery || content.join(' ').toLowerCase().includes(normalizedQuery);
}

export function filterHelpSearchSuggestions(query: string): readonly HelpSearchSuggestion[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return HELP_SEARCH_SUGGESTIONS;
  return HELP_SEARCH_SUGGESTIONS.filter((suggestion) => (
    [suggestion.label, suggestion.query, suggestion.description]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
  ));
}

export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const needle = query.trim();
  if (!needle) return [{ text, isMatch: false }];

  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerNeedle, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) segments.push({ text: text.slice(cursor, matchIndex), isMatch: false });
    segments.push({ text: text.slice(matchIndex, matchIndex + needle.length), isMatch: true });
    cursor = matchIndex + needle.length;
    matchIndex = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), isMatch: false });
  return segments.length ? segments : [{ text, isMatch: false }];
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlightSegments(text, query).map((segment, index) => (
        segment.isMatch ? (
          <mark
            key={`${segment.text}-${index}`}
            className="rounded-sm px-0.5 py-px font-semibold"
            style={{ background: 'oklch(0.75 0.18 65 / 0.3)', color: 'var(--foreground)', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}
          >
            {segment.text}
          </mark>
        ) : <span key={`${segment.text}-${index}`}>{segment.text}</span>
      ))}
    </>
  );
}

function AccordionItem({ item, searchQuery }: { item: FAQItem; searchQuery: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        border: `1px solid ${open ? 'oklch(0.75 0.18 65 / 0.25)' : 'oklch(1 0 0 / 0.07)'}`,
        background: open ? 'oklch(1 0 0 / 0.035)' : 'transparent',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all duration-150"
        aria-expanded={open}
      >
        <span className="flex-shrink-0 mt-0.5 transition-transform duration-200" style={{ color: 'var(--amber)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <ChevronRight size={14} />
        </span>
        <span className="flex-1 text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>
          <HighlightedText text={item.q} query={searchQuery} />
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pl-10 pr-5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
            <HighlightedText text={item.intro} query={searchQuery} />
          </p>
          <ol className="mt-3 space-y-2" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
            {item.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <span
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[0.62rem] font-bold"
                  style={{ background: 'var(--amber-soft)', color: 'var(--amber)', border: '1px solid oklch(0.75 0.18 65 / 0.24)', fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {index + 1}
                </span>
                <span><HighlightedText text={step} query={searchQuery} /></span>
              </li>
            ))}
          </ol>
          {item.tip && (
            <div className="mt-3 rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'var(--amber-soft)', color: 'var(--muted-foreground)', border: '1px solid oklch(0.75 0.18 65 / 0.18)', fontFamily: 'Inter, sans-serif' }}>
              <strong style={{ color: 'var(--amber)' }}>Tip: </strong><HighlightedText text={item.tip} query={searchQuery} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ id, icon, title, color }: Section) {
  return (
    <div id={id} className="flex items-center gap-3 mb-4 pt-2 scroll-mt-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '22', color, border: `1px solid ${color}33`, boxShadow: `0 0 12px ${color}22` }}>
        {icon}
      </div>
      <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
        {title}
      </h2>
    </div>
  );
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('what');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { openWalkthrough } = useWalkthrough();
  const { activeProject } = useDB();
  const [, navigate] = useLocation();

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const matchingFeatures = useMemo(() => FEATURES.filter((feature) => {
    return matchesHelpSearch(normalizedSearch, [feature.title, feature.summary, ...feature.bullets]);
  }), [normalizedSearch]);
  const matchingFaqs = useMemo(() => HOW_TO.filter((item) => {
    return matchesHelpSearch(normalizedSearch, [item.q, item.intro, ...item.steps, item.tip ?? '']);
  }), [normalizedSearch]);
  const visibleSuggestions = useMemo(() => filterHelpSearchSuggestions(searchQuery), [searchQuery]);

  const selectSuggestion = (suggestion: HelpSearchSuggestion) => {
    setSearchQuery(suggestion.query);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(0);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const updateSearchQuery = (value: string) => {
    setSearchQuery(value);
    setSuggestionsOpen(true);
    setActiveSuggestionIndex(0);
  };

  const actionLabel = (target: HelpTarget) => ({
    home: 'Open Home',
    designer: activeProject ? 'Open Designer' : 'Choose a database',
    relationships: activeProject ? 'Open Relationships' : 'Choose a database',
    erd: activeProject ? 'Open ERD' : 'Choose a database',
    forms: activeProject ? 'Open Forms' : 'Choose a database',
    reports: activeProject ? 'Open Reports' : 'Choose a database',
    menus: activeProject ? 'Open Menus' : 'Choose a database',
    'ai-chat': 'Open AI Assistant',
    'ai-settings': 'Open AI Settings',
    templates: 'Open Templates',
    publisher: activeProject ? 'Open Publisher' : 'Choose a database',
  }[target]);

  const navigateTo = (target: HelpTarget) => {
    const projectId = activeProject?.id;
    if (!projectId && ['designer', 'relationships', 'erd', 'forms', 'reports', 'menus', 'publisher'].includes(target)) {
      navigate('/');
      return;
    }
    const routes: Record<HelpTarget, string> = {
      home: '/',
      designer: `/designer/${projectId}`,
      relationships: `/relationships/${projectId}`,
      erd: `/erd/${projectId}`,
      forms: `/forms/${projectId}`,
      reports: `/reports/${projectId}`,
      menus: `/menus/${projectId}`,
      'ai-chat': '/ai-chat',
      'ai-settings': '/ai-settings',
      templates: '/templates',
      publisher: `/publish/${projectId}`,
    };
    navigate(routes[target]);
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex h-full overflow-hidden">
      <nav className="w-52 flex-shrink-0 overflow-y-auto py-6 px-3 hidden md:flex flex-col gap-1" style={{ borderRight: '1px solid oklch(1 0 0 / 0.07)', background: 'oklch(1 0 0 / 0.015)' }}>
        <p className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
          Contents
        </p>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollTo(section.id)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150"
            style={{
              color: activeSection === section.id ? section.color : 'var(--muted-foreground)',
              background: activeSection === section.id ? section.color + '15' : 'transparent',
              borderLeft: activeSection === section.id ? `2px solid ${section.color}` : '2px solid transparent',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ opacity: activeSection === section.id ? 1 : 0.6 }}>{section.icon}</span>
            {section.title}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 flex-shrink-0" style={{ borderBottom: '1px solid oklch(1 0 0 / 0.07)' }}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--amber-soft)', boxShadow: '0 0 14px rgba(245,166,35,0.2)', border: '1px solid oklch(0.75 0.18 65 / 0.2)' }}>
              <HelpCircle size={18} style={{ color: 'var(--amber)' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
                Help & Information
              </h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                A practical guide to designing, running, and sharing your local database apps.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openWalkthrough}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:brightness-110 flex-shrink-0"
            style={{ background: 'var(--amber)', color: '#1e1e2e', boxShadow: '0 5px 14px rgba(245,166,35,0.16)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            <PlayCircle size={15} />
            <span className="sm:hidden">Tour</span>
            <span className="hidden sm:inline">Start walkthrough</span>
          </button>
        </div>

        <div className="px-5 py-7 sm:px-8 sm:py-8 max-w-5xl space-y-12">
          <section>
            <SectionHeading {...SECTIONS[0]} />
            <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, oklch(0.75 0.18 65 / 0.1), oklch(1 0 0 / 0.025))', border: '1px solid oklch(0.75 0.18 65 / 0.22)' }}>
              <p className="max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>
                DBCreator is a local, browser-based database studio for turning an idea into a working data app. Design the schema, create the screens people use, review data in reports, and export a standalone app — all without writing code.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Local by default', 'No-code workflow', 'Offline-ready exports'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--amber)', background: 'oklch(0.75 0.18 65 / 0.11)', border: '1px solid oklch(0.75 0.18 65 / 0.2)', fontFamily: 'Inter, sans-serif' }}>
                    <CheckCircle2 size={12} /> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Recommended first workflow</h3>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>Four steps from idea to working app</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {QUICK_START.map((item) => (
                  <div key={item.number} className="rounded-xl p-4" style={{ background: 'oklch(1 0 0 / 0.028)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
                    <span className="text-xs font-bold" style={{ color: item.color, fontFamily: 'JetBrains Mono, monospace' }}>{item.number}</span>
                    <h4 className="mt-2 text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{item.title}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-xl p-4 sm:p-5" style={{ background: 'oklch(0.65 0.17 270 / 0.07)', border: '1px solid oklch(0.65 0.17 270 / 0.17)' }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Find a topic or go straight to a screen</h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>Search feature guidance and FAQ steps, then use a card action to continue working.</p>
                </div>
                {normalizedSearch && (
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: '#a5b4fc', fontFamily: 'Inter, sans-serif' }}>
                    {matchingFeatures.length + matchingFaqs.length} matching topic{matchingFeatures.length + matchingFaqs.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="mt-3 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#a5b4fc' }} />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => updateSearchQuery(event.target.value)}
                  onFocus={() => {
                    setSuggestionsOpen(true);
                    setActiveSuggestionIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setSuggestionsOpen(false);
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setSuggestionsOpen(true);
                      setActiveSuggestionIndex((index) => Math.min(index + 1, Math.max(visibleSuggestions.length - 1, 0)));
                      return;
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setSuggestionsOpen(true);
                      setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
                      return;
                    }
                    if (event.key === 'Enter' && suggestionsOpen && visibleSuggestions[activeSuggestionIndex]) {
                      event.preventDefault();
                      selectSuggestion(visibleSuggestions[activeSuggestionIndex]);
                    }
                  }}
                  placeholder="Search Help: backups, LOV, publish, templates..."
                  aria-label="Search Help topics"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsOpen && visibleSuggestions.length > 0}
                  aria-controls="help-search-suggestions"
                  aria-activedescendant={suggestionsOpen && visibleSuggestions[activeSuggestionIndex] ? `help-search-suggestion-${activeSuggestionIndex}` : undefined}
                  className="w-full rounded-lg py-3 pl-10 pr-10 text-sm outline-none transition-colors"
                  style={{ background: 'oklch(0.17 0.02 270 / 0.7)', color: 'var(--foreground)', border: '1px solid oklch(0.65 0.17 270 / 0.25)', fontFamily: 'Inter, sans-serif' }}
                />
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchQuery(''); setSuggestionsOpen(true); setActiveSuggestionIndex(0); }} aria-label="Clear Help search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition-colors" style={{ color: 'var(--muted-foreground)' }}>
                    <X size={15} />
                  </button>
                )}
                {suggestionsOpen && visibleSuggestions.length > 0 && (
                  <ul
                    id="help-search-suggestions"
                    role="listbox"
                    aria-label="Common Help topics"
                    className="absolute z-20 left-0 right-0 mt-2 overflow-hidden rounded-xl p-1.5 shadow-2xl"
                    style={{ background: 'oklch(0.18 0.025 270)', border: '1px solid oklch(0.65 0.17 270 / 0.32)', boxShadow: '0 14px 30px rgba(0,0,0,0.28)' }}
                  >
                    <li className="px-3 py-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em]" style={{ color: '#a5b4fc', fontFamily: 'JetBrains Mono, monospace' }}>
                      Common topics
                    </li>
                    {visibleSuggestions.map((suggestion, index) => (
                      <li
                        key={suggestion.query}
                        id={`help-search-suggestion-${index}`}
                        role="option"
                        aria-selected={index === activeSuggestionIndex}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectSuggestion(suggestion);
                        }}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        className="cursor-pointer rounded-lg px-3 py-2.5 transition-colors"
                        style={{ background: index === activeSuggestionIndex ? 'oklch(0.65 0.17 270 / 0.18)' : 'transparent' }}
                      >
                        <span className="block text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{suggestion.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>{suggestion.description}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {matchingFeatures.map((feature) => (
                <article key={feature.title} className="rounded-xl p-5 flex gap-4" style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: feature.color + '20', color: feature.color, border: `1px solid ${feature.color}30` }}>
                    {feature.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>{feature.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}><HighlightedText text={feature.summary} query={searchQuery} /></p>
                    <ul className="mt-3 space-y-1.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                      {feature.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2 text-xs leading-relaxed">
                          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" style={{ color: feature.color }} />
                          <span><HighlightedText text={bullet} query={searchQuery} /></span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => navigateTo(feature.target)}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-all duration-150 hover:brightness-125"
                      style={{ color: feature.color, fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                      {actionLabel(feature.target)} <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {normalizedSearch && matchingFeatures.length === 0 && (
              <p className="mt-5 rounded-lg px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.03)', border: '1px dashed oklch(1 0 0 / 0.12)', fontFamily: 'Inter, sans-serif' }}>No feature cards match “{searchQuery}”. Try a broader word such as “data”, “form”, or “backup”.</p>
            )}
          </section>

          <section>
            <SectionHeading {...SECTIONS[1]} />
            <div className="rounded-xl px-4 py-3.5 mb-5" style={{ background: 'oklch(0.65 0.17 270 / 0.08)', border: '1px solid oklch(0.65 0.17 270 / 0.16)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                Expand a question for a short explanation and a numbered set of actions. For a guided overview instead, use <strong style={{ color: 'var(--foreground)' }}>Start walkthrough</strong> above.
              </p>
            </div>
            <div className="space-y-2">
              {matchingFaqs.map((item) => <AccordionItem key={item.q} item={item} searchQuery={searchQuery} />)}
            </div>
            {normalizedSearch && matchingFaqs.length === 0 && (
              <p className="mt-3 rounded-lg px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)', background: 'oklch(1 0 0 / 0.03)', border: '1px dashed oklch(1 0 0 / 0.12)', fontFamily: 'Inter, sans-serif' }}>No FAQ answers match “{searchQuery}”.</p>
            )}
          </section>

          <section>
            <SectionHeading {...SECTIONS[2]} />
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'oklch(0.3 0.05 20 / 0.15)', border: '1px solid oklch(0.6 0.15 20 / 0.25)' }}>
              <div className="flex items-start gap-3">
                <Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div className="space-y-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Software Provided "As Is"</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                    DBCreator is provided <strong style={{ color: 'var(--foreground)' }}>"as is"</strong>, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement.
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                    In no event shall <strong style={{ color: 'var(--foreground)' }}>Peltagsoftware</strong> or its contributors be liable for any claim, damages, or other liability — whether in an action of contract, tort, or otherwise — arising from, out of, or in connection with the software or the use or other dealings in the software. This includes, without limitation, any <strong style={{ color: 'var(--foreground)' }}>direct, indirect, incidental, special, exemplary, or consequential damages</strong>, including loss of data, loss of profit, or business interruption.
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                    All data created with DBCreator is stored locally in your browser. <strong style={{ color: 'var(--foreground)' }}>It is your sole responsibility</strong> to maintain regular backups of your data using the Export Backup function. Peltagsoftware accepts no responsibility for data loss due to browser storage clearing, device failure, software bugs, or any other cause.
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>By using this software you acknowledge and agree to these terms.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeading {...SECTIONS[3]} />
            <div className="rounded-xl p-5" style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-lg" style={{ background: 'linear-gradient(135deg, #10b981, #0ea5e9)', color: '#fff', fontFamily: 'Space Grotesk, sans-serif', boxShadow: '0 0 16px rgba(16,185,129,0.3)' }}>P</div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Peltagsoftware</h3>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>The Netherlands</p>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                    Peltagsoftware develops practical, no-nonsense software tools for individuals and small businesses. DBCreator is one of several applications in the Peltagsoftware portfolio. All applications are designed to be lightweight, privacy-respecting, and easy to use without technical expertise.
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>To discover more applications from Peltagsoftware, visit the information portal:</p>
                  <a href="https://info.pelsoft.org" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150" style={{ background: 'oklch(1 0 0 / 0.06)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', fontFamily: 'Space Grotesk, sans-serif', textDecoration: 'none' }}>
                    <Globe size={14} /> info.pelsoft.org <ExternalLink size={12} style={{ opacity: 0.6 }} />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeading {...SECTIONS[4]} />
            <div className="rounded-xl p-5" style={{ background: 'oklch(1 0 0 / 0.03)', border: '1px solid oklch(1 0 0 / 0.07)' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.25)', boxShadow: '0 0 12px rgba(14,165,233,0.15)' }}>
                  <Mail size={20} />
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--foreground)', fontFamily: 'Space Grotesk, sans-serif' }}>Get in Touch</h3>
                    <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>
                      For questions, feedback, bug reports, or feature requests, please contact Peltagsoftware by email. We are based in the Netherlands and aim to respond within a few business days.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)' }}>
                      <Mail size={14} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>Email</p>
                        <p className="text-sm font-medium" style={{ color: '#0ea5e9', fontFamily: 'Space Grotesk, sans-serif' }}>peltagsoftware</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}>(The Netherlands)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <Globe size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>Web</p>
                        <a href="https://info.pelsoft.org" target="_blank" rel="noopener noreferrer" className="text-sm font-medium inline-flex items-center gap-1" style={{ color: '#10b981', fontFamily: 'Space Grotesk, sans-serif', textDecoration: 'none' }}>
                          info.pelsoft.org <ExternalLink size={11} style={{ opacity: 0.7 }} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-5 flex items-center justify-between gap-4" style={{ borderTop: '1px solid oklch(1 0 0 / 0.06)' }}>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>DBCREATOR · PELTAGSOFTWARE · THE NETHERLANDS</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 4px rgba(16,185,129,0.6)' }} />
                <p className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>ALL DATA STORED LOCALLY</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
