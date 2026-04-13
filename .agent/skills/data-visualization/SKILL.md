---
name: data-visualization
description: Chart creation, data export (Excel/CSV/Image), and dashboard patterns using Recharts, html2canvas, and xlsx. Covers chart styling, responsive design, and multi-format export.
---

# Data Visualization & Export

## Charts (Recharts 3.5.x)

### Library
This project uses **Recharts** for all charts and data visualizations.

### Common Chart Types Used

| Component | View | Purpose |
|---|---|---|
| `BarChart` | Dashboard, MonthlyPlanActual | Revenue comparison |
| `ComposedChart` | Dashboard | Combined bar + line |
| `LineChart` | LongTermPlan | Trend visualization |
| `PieChart` | Dashboard | Category breakdown |

### Chart Styling Conventions

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="plannedRevenue" fill="#3B82F6" name="Plan" />
    <Bar dataKey="actualRevenue" fill="#10B981" name="Actual" />
  </BarChart>
</ResponsiveContainer>
```

### Color Palette

| Purpose | Color | Hex |
|---|---|---|
| Plan/Planned | Blue | `#3B82F6` |
| Actual | Green | `#10B981` |
| Warning | Yellow/Amber | `#F59E0B` |
| Danger | Red | `#EF4444` |
| Accent | Purple | `#8B5CF6` |

### Responsive Charts
- Always wrap in `<ResponsiveContainer>`
- Use percentage width (`100%`) and fixed height
- Charts must render correctly at mobile breakpoints

## Chart Export (html2canvas)

Located in `utils/chartExport.ts`:

### Export to PNG
```typescript
import html2canvas from 'html2canvas';

async function exportChartAsImage(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,            // 2x for crisp export
    backgroundColor: '#ffffff',
    useCORS: true,
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

### Section Export (SectionExportMenu)
The `SectionExportMenu` component provides export buttons for any section:
- Export as PNG
- Export as CSV
- Copy to clipboard

### Known Issues
- ⚠️ X-axis labels can disappear on export if container is too narrow
- ⚠️ Recharts SVG requires `useCORS: true` in html2canvas config
- ⚠️ Chart must be visible (not hidden behind a tab) during export

## Excel Export (xlsx)

Located in `services/exportService.ts`:

```typescript
import * as XLSX from 'xlsx';

export function exportToExcel(data: ProjectRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(flattenedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Projects');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
```

### CSV Export
Located in `utils/csvExport.ts` for table data download.

## Data Flow: DB → Chart

```
Supabase DB
    ↓
Service Layer (e.g., DashboardService.getDashboardStats())
    ↓
Transform to MonthlyStats / AccumulatedStats
    ↓
Component state (useState)
    ↓
Recharts component rendering
    ↓
html2canvas (export)
```

## Dashboard KPI Metrics

Key metrics computed in `DashboardService`:
- **Total Revenue** (Actual): Sum of actual_hours × unit_price
- **Total Planned Revenue**: Sum of planned_hours × plan_price
- **Achievement Rate**: (actual / planned) × 100
- **Active Projects**: Count of active-status projects
- **Capacity Line**: Configurable target line for charts

## Table Styling

Utility classes for data tables in `utils/tableStyles.ts`:
- Consistent cell padding
- Alternating row colors
- Sticky header support
- Export-friendly formatting
