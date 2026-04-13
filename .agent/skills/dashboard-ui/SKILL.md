---
name: dashboard-ui
description: Dashboard UI patterns using React + Tailwind CSS. Covers layout architecture, component design, charting integration, table patterns, responsive design, dark mode, and premium styling for data-heavy admin dashboards.
---

# Dashboard UI — React + Tailwind CSS

> Based on [Choosing a Frontend Stack for Dashboards with Charts and Tables](../../data/Choosing%20a%20Frontend%20Stack%20for%20Dashboards%20with%20Charts%20and%20Tables.md)

## Why React + Tailwind CSS?

This project uses **React + Tailwind CSS** because it offers:

- **Largest ecosystem** of dashboard templates, UI kits, and charting integrations
- **Strong TypeScript support** with Vite for fast DX
- **Utility-first styling** for rapid, consistent, responsive UI
- **Mature charting** via Recharts, D3, Tremor, Victory
- **Premium dashboard aesthetics** with minimal custom CSS

Reference frameworks/templates for design inspiration:
- **Tremor** — 35+ open-source dashboard components (KPI cards, charts, tables)
- **TailAdmin** — Full admin template with analytics, tables, charts
- **TailPanel** — React 19 + TypeScript 5 + Tailwind v4 + Vite

---

## Tailwind CSS Setup

### Installation (Tailwind CSS v4 + Vite)

This project uses **Tailwind CSS v4** with the official Vite plugin:

```bash
npm install tailwindcss @tailwindcss/vite
```

**vite.config.ts**:
```typescript
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

**index.css** (entry stylesheet):
```css
@import "tailwindcss";
```

### Tailwind v4 Key Differences
- **No `tailwind.config.js`** — configuration via CSS `@theme` directive
- **No `@tailwind` directives** — use `@import "tailwindcss"` instead
- **CSS-first config** — customize via `@theme { ... }` blocks
- **Automatic content detection** — no `content` array needed

### Custom Theme (via CSS)

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', system-ui, sans-serif;

  /* Dashboard color palette */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;

  --color-success-500: #10b981;
  --color-warning-500: #f59e0b;
  --color-danger-500: #ef4444;
}
```

---

## Dashboard Layout Architecture

### App Shell Pattern

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────┐ │
│ │          │ │ Top Bar (year selector, search,  │ │
│ │ Sidebar  │ │ actions, language toggle)        │ │
│ │          │ ├─────────────────────────────────┤ │
│ │ Nav      │ │                                 │ │
│ │ Links    │ │ Main Content Area               │ │
│ │          │ │ (scrollable, flex-1)             │ │
│ │          │ │                                 │ │
│ │          │ │ KPI Cards / Charts / Tables      │ │
│ │          │ │                                 │ │
│ ├──────────┤ │                                 │ │
│ │ User     │ │                                 │ │
│ │ Profile  │ │                                 │ │
│ └──────────┘ └─────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Tailwind Implementation

```tsx
{/* App Shell */}
<div className="flex h-screen bg-slate-50 overflow-hidden">
  {/* Sidebar - collapsible */}
  <aside className={`hidden md:flex flex-col bg-slate-900 text-white
    shadow-xl z-20 shrink-0 transition-all duration-300
    ${collapsed ? 'w-16' : 'w-64'}`}>
    {/* Logo / Nav / User */}
  </aside>

  {/* Main */}
  <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
    {/* Top Bar */}
    <header className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm z-10 shrink-0">
      {/* Year selector, search, action buttons */}
    </header>

    {/* Page Content (scrollable) */}
    <div className="flex-1 overflow-auto p-6">
      {/* Route content */}
    </div>
  </main>
</div>
```

### Responsive Behavior
- **Desktop (md+)**: Sidebar + main content side by side
- **Mobile (<md)**: Full-width hamburger menu overlay
- Sidebar supports **collapse** mode (icons only, `w-16`)

---

## Component Patterns

### KPI Card

```tsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6
  hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      <p className={`text-sm mt-1 ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
      </p>
    </div>
    <div className="p-3 bg-blue-50 rounded-lg">
      <Icon className="w-6 h-6 text-blue-600" />
    </div>
  </div>
</div>
```

### Data Table

```tsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
  {/* Table header with title + actions */}
  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <div className="flex gap-2">{/* Export, filter buttons */}</div>
  </div>

  {/* Scrollable table */}
  <div className="overflow-x-auto custom-scrollbar">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 sticky top-0">
        <tr>
          <th className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
            {header}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        <tr className="hover:bg-slate-50 transition-colors">
          <td className="px-4 py-3 whitespace-nowrap">{cell}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### Chart Container

```tsx
<div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <ChartExportMenu elementId={chartId} />
  </div>
  <div id={chartId} className="h-72">
    <ResponsiveContainer width="100%" height="100%">
      {/* Recharts component */}
    </ResponsiveContainer>
  </div>
</div>
```

### Nav Link (Sidebar)

```tsx
<Link
  to={path}
  className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium
    transition-all duration-200
    ${isActive
      ? 'bg-blue-600 text-white shadow-md'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
>
  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
  {label}
</Link>
```

---

## Charting Integration (Recharts)

### Color System for Charts

| Semantic | Tailwind Class | Hex | Usage |
|----------|---------------|-----|-------|
| Plan/Forecast | `text-blue-500` | `#3B82F6` | Planned values |
| Actual | `text-emerald-500` | `#10B981` | Actual values |
| Warning | `text-amber-500` | `#F59E0B` | Threshold alerts |
| Danger | `text-red-500` | `#EF4444` | Over-budget |
| Accent | `text-violet-500` | `#8B5CF6` | Secondary series |
| Neutral | `text-slate-400` | `#94A3B8` | Gridlines, axis |

### Responsive Chart Pattern

```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
    <YAxis stroke="#64748b" fontSize={12} />
    <Tooltip
      contentStyle={{
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      }}
    />
    <Bar dataKey="planned" fill="#3B82F6" radius={[4, 4, 0, 0]} />
    <Bar dataKey="actual" fill="#10B981" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

## Styling Best Practices

### Card Hierarchy

| Level | Usage | Classes |
|-------|-------|---------|
| **Container** | Page sections | `bg-white rounded-xl shadow-sm border border-slate-200` |
| **Elevated** | Important cards | `bg-white rounded-xl shadow-md` |
| **Inset** | Nested sections | `bg-slate-50 rounded-lg` |
| **Outlined** | Subtle containers | `border border-slate-200 rounded-lg` |

### Typography Scale

| Purpose | Classes |
|---------|---------|
| Page title | `text-2xl font-bold text-slate-900` |
| Section title | `text-lg font-semibold text-slate-900` |
| Card label | `text-sm font-medium text-slate-500` |
| KPI value | `text-2xl font-bold text-slate-900` |
| Body text | `text-sm text-slate-600` |
| Table header | `text-xs font-semibold text-slate-600 uppercase tracking-wider` |
| Table cell | `text-sm text-slate-700` |

### Status Badges

```tsx
const statusColors: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  pending:   'bg-amber-100 text-amber-700',
  archived:  'bg-slate-100 text-slate-500',
};

<span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
  {status}
</span>
```

### Button Variants

| Variant | Classes |
|---------|---------|
| Primary | `bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors` |
| Success | `bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm` |
| Ghost | `text-slate-600 hover:bg-slate-100 rounded-lg transition-colors` |
| Danger | `bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg` |
| Outlined | `border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg` |

### Animations & Transitions

```css
/* Sidebar collapse animation */
.transition-all.duration-300

/* Hover elevation */
.hover:shadow-md.transition-shadow

/* Color transitions */
.transition-colors

/* Nav link transitions */
.transition-all.duration-200
```

### Custom Scrollbar (CSS)

```css
.custom-scrollbar::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;  /* slate-100 */
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;  /* slate-300 */
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;  /* slate-400 */
}
```

---

## Responsive Design Breakpoints

| Breakpoint | Prefix | Usage |
|-----------|--------|-------|
| Mobile | (default) | Single column, hamburger menu |
| Tablet | `md:` (768px+) | Sidebar visible, tables scroll |
| Desktop | `lg:` (1024px+) | Full layout, wider search bar |
| Wide | `xl:` (1280px+) | Multi-column dashboard grids |

### Grid Patterns for Dashboard

```tsx
{/* KPI cards row */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  {kpis.map(kpi => <KPICard key={kpi.id} {...kpi} />)}
</div>

{/* Charts row */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
  <RevenueChart />
  <TrendChart />
</div>

{/* Full-width table */}
<div className="w-full">
  <ProjectTable />
</div>
```

---

## Export Considerations

When exporting charts/sections via `html2canvas`:

1. Use `id` attributes on exportable containers
2. Ensure white background (`bg-white`) for clean exports
3. Avoid `overflow-hidden` on export targets (can clip content)
4. Use `scale: 2` for retina-quality exports
5. Charts must be visible (not behind tabs) during capture

---

## Dark Mode (Future)

Tailwind v4 supports dark mode via `@media (prefers-color-scheme: dark)` or class-based toggle. Prepare by:

- Using semantic color tokens (`slate-*` palette) instead of hardcoded hex
- Adding `dark:` variants to key components when ready
- Using CSS variables for chart colors so they can be swapped

```tsx
{/* Dark-mode-ready example */}
<div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
  border-slate-200 dark:border-slate-700">
```

---

## Anti-Patterns to Avoid

| ❌ Don't | ✅ Do Instead |
|----------|--------------|
| Inline `style={{}}` for colors/spacing | Tailwind utility classes |
| `px-[13px]` arbitrary values | Use standard spacing scale (`px-3`, `px-4`) |
| Mix vanilla CSS with Tailwind extensively | Use `@layer` for custom CSS, Tailwind for everything else |
| Overuse `!important` | Adjust specificity with Tailwind's layer system |
| CDN `<script src="tailwindcss">` | Proper Vite plugin build |
| Generic `div` soup with no semantic meaning | Use `section`, `nav`, `header`, `main`, `aside` |
