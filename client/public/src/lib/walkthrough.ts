export type WalkthroughIconKey =
  | 'sparkles'
  | 'database'
  | 'table'
  | 'relationship'
  | 'form'
  | 'rocket';

export interface WalkthroughStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  highlights: readonly string[];
  hint: string;
  icon: WalkthroughIconKey;
  color: string;
}

/**
 * The core workflow shown whenever the app starts. It intentionally remains
 * concise: the Help page holds the comprehensive reference material.
 */
export const STARTUP_WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  {
    id: 'welcome',
    eyebrow: 'WELCOME TO DBCREATOR',
    title: 'Build local database apps without code.',
    description:
      'DBCreator keeps your schema, records, forms, and reports in your browser. Nothing needs to be installed on a server before you can begin.',
    highlights: ['Your data stays on this device', 'Use the sidebar to move through each design stage'],
    hint: 'You can skip this tour at any time and reopen it later from Help & Info.',
    icon: 'sparkles',
    color: '#f5a623',
  },
  {
    id: 'start',
    eyebrow: 'STEP 1 · START A DATABASE',
    title: 'Create, import, or install a ready-made app.',
    description:
      'From Home, choose New Database for a blank project, Import Backup to restore a JSON backup, or App Templates to start with a complete example.',
    highlights: ['New Database → design from scratch', 'App Templates → CRM, inventory, medical, and more'],
    hint: 'A database is your top-level workspace; it can contain many tables, forms, reports, and menus.',
    icon: 'database',
    color: '#f59e0b',
  },
  {
    id: 'model',
    eyebrow: 'STEP 2 · DESIGN THE DATA',
    title: 'Create tables, then define their fields.',
    description:
      'Open Tables to add the subjects you need, such as Customers, Orders, or Products. Add fields for names, dates, amounts, text, and other information.',
    highlights: ['Choose from 17 field types', 'Use LOV fields for fixed choices and foreign keys for linked records'],
    hint: 'Start simple. You can return to the Table Designer to edit fields at any time.',
    icon: 'table',
    color: '#6366f1',
  },
  {
    id: 'connect',
    eyebrow: 'STEP 3 · CONNECT RECORDS',
    title: 'Model relationships and reference data.',
    description:
      'Use Relationships to connect tables. A typical example is one Customer with many Orders. Add LOV tables when people need to choose values such as Gender or Status.',
    highlights: ['Link child records with a foreign key', 'Use master-detail forms for parent and child records together'],
    hint: 'The ERD Diagram gives you a visual check of every table and connection.',
    icon: 'relationship',
    color: '#8b5cf6',
  },
  {
    id: 'build',
    eyebrow: 'STEP 4 · CREATE THE USER EXPERIENCE',
    title: 'Build forms, reports, and menus.',
    description:
      'Create a form to enter and update records, create a report to review data, and create menus to give people a simple navigation path through the app.',
    highlights: ['Run forms to add, edit, and delete data', 'Generate AI mock data when you want realistic sample rows'],
    hint: 'Forms are for editing; reports are read-only and can be exported to CSV.',
    icon: 'form',
    color: '#10b981',
  },
  {
    id: 'publish',
    eyebrow: 'STEP 5 · SHARE AND PROTECT YOUR WORK',
    title: 'Publish a standalone app and make backups.',
    description:
      'Use Publish App to download a self-contained HTML app with your menus, forms, reports, lookup values, and records. Use Export Backup from Home to protect your DBCreator project.',
    highlights: ['Published HTML apps work offline in a browser', 'Back up regularly because browser storage is local'],
    hint: 'Your essential workflow: design → connect → build forms/reports → publish and back up.',
    icon: 'rocket',
    color: '#ef4444',
  },
];
