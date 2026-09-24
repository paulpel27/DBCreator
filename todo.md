# DBCreator TODO

## Phase 1 — Core App
- [x] IndexedDB data layer (projects, tables, fields, relationships, forms, reports, menus)
- [x] DBContext global state provider
- [x] Neomorphism CSS theme (Obsidian Forge — dark charcoal + amber)
- [x] PWA manifest + service worker
- [x] AppLayout with collapsible sidebar
- [x] Home page — project dashboard with schema canvas empty state
- [x] Table Designer — 17 field types, drag-to-reorder, foreign key/LOV config
- [x] Relationships page — master-detail, one-to-many, many-to-one
- [x] Forms page — form designer + runtime form runner
- [x] Reports page — report designer + runtime viewer with CSV export
- [x] Menus page — hierarchical menu creator

## Phase 2 — AI Features
- [x] AI Provider config library (aiProvider.ts) — pure IndexedDB, no backend
- [x] AI Settings page — add/edit/delete providers, preset templates
- [x] AI Settings — API key input with show/hide toggle
- [x] AI Settings — Base URL with preset defaults and reset button
- [x] AI Settings — Model input with Fetch from API button
- [x] AI Settings — Temperature and max tokens sliders
- [x] AI Settings — Test Connection button with live feedback
- [x] AI Settings — Save/load provider profiles locally
- [x] AI Settings — Set active provider
- [x] AI Chat page — context-aware chat with full DBCreator schema in system prompt
- [x] AI Chat page — suggested prompts for common use cases
- [x] AI Chat page — streaming responses
- [x] AI Chat page — message history with copy button
- [x] AI Chat page — clear conversation
- [x] Sidebar nav — AI Assistant and AI Settings items

## Future Ideas
- [x] Visual ERD diagram canvas
- [x] Import/export database as JSON (via Published App backup/restore)
- [x] Computed fields and validation rules (intentionally deferred — v2 roadmap, not in current scope)

## Phase 3 — AI Execute Feature
- [x] Define structured JSON schema for AI execution plans (tables, fields, relationships, forms, reports)
- [x] Update AI system prompt to always append a JSON execution block to responses
- [x] Build aiExecutor.ts — execution engine that maps JSON plan to DBContext create* calls
- [x] Add Execute button to AI chat messages that contain an execution plan
- [x] Build execution preview dialog showing what will be created before confirming
- [x] Show execution progress and results (created items with links)
- [x] Handle partial execution and errors gracefully

## Phase 4 — Visual ERD Diagram
- [x] ERD canvas page with draggable table nodes
- [x] Table nodes show table name, type badge, and all fields with types
- [x] SVG relationship lines connecting table nodes
- [x] Crow's foot notation on relationship endpoints (one / many)
- [x] Zoom in/out and pan (mouse wheel + drag)
- [x] Auto-layout algorithm (force-directed or grid)
- [x] Fit-to-screen button
- [x] Highlight a table and its relationships on hover/click
- [x] ERD accessible from sidebar nav
- [x] ERD accessible from Relationships page (View Diagram button)
- [x] Empty state when no tables exist

## Phase 5 — Local SaaS Publisher
- [x] App Publisher page — configure app name, subtitle, theme color, icon
- [x] App Publisher — select which menus/forms/reports to include
- [x] App Publisher — generate self-contained HTML bundle with embedded schema + runtime
- [x] Runtime engine — menu navigation (top nav + sidebar based on menu tree)
- [x] Runtime engine — form renderer with all field types and data entry
- [x] Runtime engine — report viewer with filtering, sorting, CSV export
- [x] Runtime engine — IndexedDB data storage in published app
- [x] Runtime engine — master-detail form support
- [x] Runtime engine — LOV (list of values) dropdowns from linked tables
- [x] App Publisher — live in-browser preview iframe
- [x] App Publisher — Download as HTML button (single-file bundle)
- [x] App Publisher — copy shareable URL (opens published app in new tab)
- [x] Published app accessible from sidebar nav
- [x] Published app runs standalone (no DBCreator dependency)

## Phase 5 — Gaps to Address
- [x] DBCreator project export as JSON (schema + forms + reports + menus) from Home page
- [x] DBCreator project import from JSON backup file on Home page
- [x] Verify 'Open in New Tab' button is visible in PublisherPage UI (confirmed in preview toolbar)

## Phase 5 — Import Row Integrity
- [x] Preserve row _id values during import (avoid breaking FK references in row data)

## Phase 6 — Full CRUD Fix
- [x] Table Designer: rename table (edit name/description/type/color)
- [x] Table Designer: delete table with confirmation
- [x] Field Editor: edit existing field properties (name, type, required, default, LOV values, FK config)
- [x] Field Editor: delete field with confirmation
- [x] Forms page: edit form (name, display name, description, settings)
- [x] Forms page: delete form with confirmation
- [x] Reports page: edit report (name, display name, description, settings)
- [x] Reports page: delete report with confirmation
- [x] Menus page: edit menu (name, display name, description)
- [x] Menus page: delete menu with confirmation
- [x] Menus page: edit individual menu items (label, icon, type, target)
- [x] Menus page: delete individual menu items
- [x] Relationships page: edit relationship (type, cascade delete)
- [x] Relationships page: delete relationship with confirmation
- [x] DBContext: verify updateTable, updateField, deleteField, updateForm, deleteForm, updateReport, deleteReport, updateMenu, deleteMenu, updateRelationship, deleteRelationship all exist
- [x] Make edit/delete buttons always visible (removed opacity-0 group-hover:opacity-100 hiding) across all pages
- [x] Add Edit Table button to TableDesignerPage header

## Phase 7 — Data Integrity (Future Improvements)
- [x] Implement cascade cleanup when deleting a table: remove related relationships, forms, reports, menus that reference the deleted table
- [x] Implement cascade cleanup when deleting a field: clean up relationships, form fields, and report columns that reference the deleted field

## Phase 8 — Master-Detail Form Runner
- [x] FormRunnerPage: detect detailFormIds on a form and render split-panel master-detail layout
- [x] Master list panel: searchable, shows avatar + primary/secondary fields, amber highlight for selected row
- [x] Master panel: inline create/edit/delete buttons for master records
- [x] Detail panel: sub-grid filtered by FK to selected master, with add/edit/delete
- [x] Detail panel: FK field auto-filled and hidden from the form dialog
- [x] Detail panel: tabbed support for multiple detail forms per master
- [x] FormsPage: "DETAIL FORMS" section in form designer dialog to link detail forms to a master form
- [x] FormsPage: formData.detailFormIds state + persist to DBForm.detailFormIds JSON field

## Phase 9 — AI Execute Button Redesign + Menu Support
- [x] Replace small inline Execute badge+button with a large "Build This in DBCreator" card below each AI message that contains a plan
- [x] Card shows colored chips: Database (amber), Tables (indigo), Forms (pink), Reports (cyan), Menus (green)
- [x] Card header shows EXECUTABLE PLAN label + item count summary
- [x] Full-width amber "Build This in DBCreator" button with glow shadow
- [x] Add PlanMenu / PlanMenuItem types to aiExecutor.ts
- [x] Add menus field to ExecutionPlan schema
- [x] Add menu to PlanSummaryItem type and summarizePlan
- [x] Add createMenu to ExecutorContext and executePlan (step 6)
- [x] Wire db.createMenu into runExecution in AIChatPage.tsx
- [x] Update success toast to include menu count
- [x] Update ExecuteDialog result summary to show menu count
- [x] Add menu icon to ExecuteDialog iconForType switch
- [x] Update system prompt to instruct AI to include menus in plans

## Phase 10 — SaaS Export Bug Fixes
- [x] Fix: menu items stored as flat parentId array but runtime expects nested children tree — convert on export
- [x] Fix: buildBundle() misses FK-referenced tables (LOV dropdowns broken in exported app)
- [x] Fix: CSV export uses literal \\n instead of real newline — one-line CSV output
- [x] Fix: include detail form tables in bundle (master-detail in exported app)

## Phase 11 — Master-Detail in Exported SaaS App
- [x] Add master-detail runtime support to saasRuntime.ts: detect detailFormIds, render split-panel layout, filter detail rows by FK

## Phase 12 — PWABuilder Compliance
- [x] Generate 192x192 and 512x512 PNG icons (separate files, not one image declared at two sizes)
- [x] Rewrite manifest.json: id, scope, display_override, theme_color #f5a623, lang, dir, categories, shortcuts, share_target, screenshots, separate purpose entries for any/maskable
- [x] Rewrite sw.js: proper install/activate/fetch lifecycle, push handler, notificationclick handler, sync handler (all required by PWABuilder)
- [x] Update index.html: theme-color matches manifest, mobile-web-app-capable, msapplication-TileImage, OG tags, separate apple-touch-icon entries for 192 and 512

## Phase 13 — App Templates Subscreen
- [x] Create 6 complete application template definitions (CRM, Inventory, Project Tracker, School, Restaurant, HR)
- [x] Build TemplatesPage.tsx with polished card grid, preview modal, and one-click install
- [x] Wire /templates route in App.tsx
- [x] Add "App Templates" nav entry in AppLayout sidebar with LayoutTemplate icon
- [x] Install engine: creates project, tables, fields, relationships, forms (with detailFormIds), reports, menus

## Phase 14 — Help & Information Page
- [x] Build HelpPage.tsx with left TOC sidebar and 5 sections
- [x] Section 1: What You Can Do — 9 feature cards with icons, colours, and descriptions
- [x] Section 2: How To Use It — 11 accordion FAQ items covering all major workflows
- [x] Section 3: Disclaimer & Liability — "as is" notice, no direct/indirect liability, data backup responsibility
- [x] Section 4: About Peltagsoftware — branding, description, link to info.pelsoft.org
- [x] Section 5: Contact — email peltagsoftware (The Netherlands), web info.pelsoft.org
- [x] Wire /help route in App.tsx
- [x] Add "Help & Info" nav entry in AppLayout sidebar with HelpCircle icon

## Phase 15 — Help Text Update (All New Features)
- [x] Update "What You Can Do" section: expand template count to 8, add AI Mock Data Generator card, add Backup & Export card, add Light/Dark Theme card, add Install as App (PWA) card, update cascade delete note in Table Designer card, update SaaS Publisher card with master-detail and FK table fixes
- [x] Update "How To Use It" FAQ: add Q&A for AI mock data generation, delete template data, exporting backup, switching theme, installing as PWA; update template install Q&A to mention 8 templates and sample data; update backup Q&A to mention always-visible amber button; update AI assistant Q&A to mention prominent Build This card
- [x] Preserve all 5 sections, disclaimer, Peltagsoftware branding, and contact info unchanged
- [x] Zero TypeScript errors confirmed

## Phase 16 — SaaS Export Bug Fix (Empty Menus/Forms/Reports)
- [x] Root cause: PublisherPage initialised selectedForms/selectedReports/selectedMenuId with useState at mount time, before DBContext.loadAll() completed — all three captured empty arrays
- [x] Fix: replaced stale useState initialisers with a useEffect that waits for loading===false, then seeds selections from the real projectForms/projectReports/projectMenus data; a selectionInitialised guard prevents overwriting user changes on subsequent renders
- [x] Zero TypeScript errors confirmed

## Phase 17 — SaaS Export Deep Fix (Empty App — No Menus/Forms/Reports/Data)

Root cause analysis:
The exported HTML app had two independent bugs:
1. The SaasBundle type had no `data` field — row data was never read or embedded in the export.
2. The SaaS runtime created a brand-new empty IndexedDB (`saas_{projectId}`) and never seeded it with the project's existing rows from `dbcreator_data_{projectId}`.

Fixes applied:
- [x] Added `data: Record<string, Record<string, unknown>[]>` field to `SaasBundle` interface in saasRuntime.ts
- [x] Made `buildBundle()` async in PublisherPage.tsx; it now calls `openDataDB` + `rowGetAll` for every included table to read all existing rows
- [x] Updated `generatePreview`, `downloadApp`, and `openInNewTab` to await the async `buildBundle()`
- [x] Added seed-data bootstrap in the exported HTML's `DOMContentLoaded` handler: on first open it checks each table store, and if empty, pre-loads the embedded rows via `putRow`
- [x] Zero TypeScript errors confirmed

## Phase 18 — SaaS Export: Real Root Cause Fix (JavaScript Syntax Errors)

Root cause: The `generateSaasHtml` function in `saasRuntime.ts` returns a TypeScript template literal
(backtick string). All the runtime JavaScript code is embedded directly inside this template literal.
Inside a TypeScript template literal:
- `\'` is just `'` — the backslash is consumed, leaving a bare single quote that breaks JS strings
- `'\n'` produces a literal newline character inside a JS string, which is a syntax error

Two classes of bugs were found and fixed:

Bug 1 — Broken onclick handlers (12 lines):
All `onclick="showForm(\''`, `onclick="showReport(\''`, etc. had `\'` which became bare `'` in the
output, terminating the JS string prematurely and causing a SyntaxError on every page load.
Fix: Changed `\'` to `\\'` on all 12 affected lines so the output JS contains a literal `\'`.

Bug 2 — Broken CSV export (2 lines):
The `exportReport()` function used `'\n'` to join CSV rows and build the Blob.
Inside the template literal, `'\n'` becomes a literal newline character, breaking the JS string.
Fix: Changed `'\n'` to `'\\n'` so the output JS has the two-character escape sequence `\n`.

Verification:
- [x] Generated test HTML from fixture data using tsx
- [x] Ran `node --check` on the extracted script — zero syntax errors
- [x] Opened in browser: sidebar shows Dashboard, Customers form, Customer Report
- [x] Clicked Customers form: shows Alice Smith and Bob Jones from seed data
- [x] Zero TypeScript errors confirmed

## Phase 19 — Exported App: Sidebar Long Labels + LOV Values

- [x] Fix sidebar CSS: long menu labels truncate/overflow badly — added text-overflow:ellipsis, flex:1, min-width:0 to .nav-label; removed white-space:nowrap from .nav-item; added title attributes to all nav buttons
- [x] Include LOV values in SaasBundle: LOV table rows are included via the existing buildBundle data export (referencedTableId tables are already collected)
- [x] Runtime: LOV (foreign_key) fields already render as <select> dropdowns from referenced table rows
- [x] Runtime: added Reference Data section to sidebar for all tableType==='lov' tables
- [x] Runtime: implemented showLovManager() with full CRUD — list view with pagination, + Add Value, Edit (modal), Delete (confirm)
- [x] Runtime: added showModal() helper reused by LOV manager
- [x] Fixed all JS quoting issues in LOV manager: used data-lovid attributes and window._lovEditId to avoid single-quote escaping in onclick handlers
- [x] Zero TypeScript errors, zero JS syntax errors in generated HTML verified in browser

## Phase 20 — Exported App: LOV Display + Sidebar Wrapping (Definitive Fix)
- [x] Sidebar nav-label: changed white-space:nowrap to white-space:normal with -webkit-line-clamp:2 so long menu names wrap to 2 readable lines instead of truncating
- [x] LOV display in form list: added _fkCache map + loadFkCache() + clearFkCache() helpers
- [x] formatValue() now resolves foreign_key IDs to display labels using _fkCache (loaded before renderFormList renders rows)
- [x] formatValue() now resolves inline lov fieldType values to their labels from lovValues JSON
- [x] renderFormList pre-loads FK caches with Promise.all before rendering rows
- [x] clearFkCache() called on save and delete so labels stay fresh
- [x] Verified in browser: Gender column shows "Male" not "g1"; sidebar shows full 2-line label
- [x] Zero TypeScript errors, zero JS syntax errors

## Phase 22 — Startup Walkthrough
- [x] Add a skippable walkthrough that opens automatically whenever DBCreator starts
- [x] Cover the core workflow: create or install a database, design tables and fields, connect relationships/LOVs, build forms and reports, enter data, and publish/export
- [x] Provide Back, Next, Finish, and Skip controls with keyboard-accessible dialog behavior
- [x] Keep dismissal scoped to the currently mounted app session, so the walkthrough appears after each app startup
- [x] Add a replay walkthrough entry point in Help & Info
- [x] Verify the walkthrough in the browser, confirm zero TypeScript errors, and add a passing focused Vitest check
- [x] Make the Help & Info walkthrough replay control visible and usable on mobile, then re-verify the replay flow

## Phase 23 — Help Page Copy & Layout Refinement
- [x] Improve the Help page introduction and feature-card text for clearer, more concise guidance
- [x] Add scannable bullet lists to feature cards and FAQ answers where the user needs ordered actions or key outcomes
- [x] Improve Help page visual hierarchy for quick scanning without changing the disclaimer, Peltagsoftware branding, or contact information
- [x] Verify the refined Help page in the browser, confirm zero TypeScript errors, and add passing focused content tests

## Phase 24 — Help Discovery & Preview Connectivity
- [x] Add a Help-page search field that filters relevant feature cards and FAQ answers by topic
- [x] Add direct navigation actions from the Help page to the relevant DBCreator screens
- [x] Resolve the Vite development-preview WebSocket error by serving the managed preview from a static Vite build without the /@vite/client runtime
- [x] Verify Help search, direct navigation, static preview connectivity, zero TypeScript errors, and seven focused tests

## Phase 25 — Help Search Highlighting
- [x] Highlight case-insensitive Help search matches in visible feature-card and FAQ text
- [x] Keep highlighting safe, readable in light and dark themes, and inert when search is empty
- [x] Add focused tests and browser verification for highlighted results, then confirm zero TypeScript errors

## Phase 26 — Help Search Suggestions
- [x] Add a common-topic suggestion dropdown that opens when the Help search field receives focus
- [x] Include practical common topics such as Backups, LOVs, Templates, Publishing, Forms, and AI
- [x] Support mouse selection, keyboard navigation, Escape dismissal, and an accessible combobox/listbox relationship
- [x] Add focused tests and browser verification for suggestion selection, then confirm zero TypeScript errors
