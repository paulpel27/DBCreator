# DBCreator — Design Brainstorm

## Three Stylistic Approaches

### Approach A — Soft Clay Studio
**Theme Name:** Soft Clay Studio  
**Brief:** Warm off-white surfaces with deep embossed shadows, like sculpted clay under diffuse studio lighting. Every panel feels physically present.  
**Probability:** 0.07

### Approach B — Arctic Neomorphism
**Theme Name:** Arctic Neomorphism  
**Brief:** Cool slate-grey base with icy blue accents. Crisp, precise shadows give a high-tech instrument feel — like a professional database IDE carved from frosted metal.  
**Probability:** 0.04

### Approach C — Obsidian Forge
**Theme Name:** Obsidian Forge  
**Brief:** Dark charcoal neomorphism with amber/gold accent highlights. Deep inset wells and raised buttons evoke a premium engineering workbench.  
**Probability:** 0.09

---

## Chosen Approach: **Obsidian Forge** (C)

### Design Movement
Dark Neomorphism — a fusion of skeuomorphic depth with modern flat-design restraint. Surfaces are dark, tactile, and dimensional.

### Core Principles
1. Every interactive element is either **raised** (buttons, cards) or **inset** (inputs, wells) — never flat.
2. **Amber/gold** is the single accent color used sparingly for active states, highlights, and CTAs.
3. Typography is **crisp and technical** — monospace for data labels, humanist sans for prose.
4. Spatial hierarchy is communicated through **shadow depth**, not color contrast.

### Color Philosophy
- Base: `#1e1e2e` — deep charcoal-blue, the "forge surface"
- Surface raised: `#252535` — slightly lighter for elevated cards
- Surface inset: `#181828` — darker for input wells
- Shadow light: `rgba(255,255,255,0.04)` — subtle highlight edge
- Shadow dark: `rgba(0,0,0,0.5)` — deep drop shadow
- Accent: `#f5a623` — warm amber, used for active/selected/CTA
- Accent soft: `#f5a62333` — amber glow for hover states
- Text primary: `#e8e8f0` — near-white
- Text secondary: `#8888aa` — muted lavender-grey
- Destructive: `#e05555`

### Layout Paradigm
Persistent left sidebar (72px icon rail + 240px expanded panel) with a main content area using a **card-grid** layout. No centered hero — the UI is a professional tool, so it fills the viewport efficiently. Panels slide in from the right for detail views.

### Signature Elements
1. **Neomorphic cards** — `box-shadow: 6px 6px 12px rgba(0,0,0,0.4), -3px -3px 8px rgba(255,255,255,0.04)` on raised surfaces
2. **Inset input wells** — `box-shadow: inset 3px 3px 8px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(255,255,255,0.03)`
3. **Amber pulse** — active nav items and selected rows glow with a soft amber left-border + background tint

### Interaction Philosophy
Interactions feel physical: buttons depress on click (scale 0.97), inputs feel carved into the surface, drag-and-drop has tactile resistance. No jarring transitions — everything eases with `cubic-bezier(0.23, 1, 0.32, 1)`.

### Animation
- Sidebar expand/collapse: 200ms ease-out width transition
- Panel slide-in: 250ms translateX from right
- Modal appear: 200ms scale(0.96→1) + opacity(0→1)
- Row hover: 120ms background tint
- Button press: 100ms scale(0.97)
- Toast slide: 180ms from bottom

### Typography System
- **Display / Headings:** `Space Grotesk` — geometric, technical, distinctive
- **Body / UI:** `Inter` — clean and readable for dense data
- **Monospace / Data:** `JetBrains Mono` — for field names, SQL-like identifiers, code
- Scale: 11px labels → 13px body → 15px subheadings → 20px headings → 28px page titles

### Brand Essence
**DBCreator** — the local-first database studio for builders who think in tables. For developers, analysts, and power users who want full control without a server. *Precise. Powerful. Yours.*  
Personality: **Authoritative, Crafted, Efficient**

### Brand Voice
Headlines are direct and tool-like: "Design your schema. Own your data."  
CTAs are action-first: "Create Table", "Run Report", "Add Field"  
No filler: never "Welcome to DBCreator" — instead "Your databases, locally stored."

### Wordmark & Logo
A bold geometric mark: two overlapping rectangles (representing linked tables) with a subtle amber connection node between them. No text in the mark — used as favicon and sidebar icon.

### Signature Brand Color
**Amber `#f5a623`** — warm, precise, unmistakably DBCreator.

---

## Style Decisions
- Neomorphic shadows use dual-layer (dark drop + light highlight) on all raised surfaces
- Inset wells for all text inputs, textareas, and data grids
- Amber accent reserved exclusively for: active nav, selected rows, primary CTAs, and field type badges
- JetBrains Mono for all field names, table names, and data values
- Space Grotesk for all headings and section titles
