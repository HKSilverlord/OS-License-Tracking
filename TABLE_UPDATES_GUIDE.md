# Table Updates Implementation Guide

## Overview
This guide documents the changes made to hide the Code column and add new columns (Exclusion Mark and Notes) with row reordering functionality.

## Changes Completed ✅

### 1. Database Migration
**File**: `db/migration_add_fields.sql`
- Added `notes` (TEXT) column - 補足 (Supplementary notes)
- Added `exclusion_mark` (TEXT) column - 除外記号 (Exclusion mark)
- Added `display_order` (INTEGER) column - For manual sorting
- Created index on `display_order` for performance
- Auto-populated `display_order` for existing projects

**To Apply**: Run the SQL script in Supabase SQL Editor:
```bash
# Navigate to Supabase Dashboard → SQL Editor
# Copy and paste the contents of db/migration_add_fields.sql
# Click "Run"
```

### 2. TypeScript Types
**File**: `types.ts`
- Updated `Project` interface to include:
  - `notes: string` - 補足
  - `exclusion_mark: string` - 除外記号
  - `display_order: number` - Sort order

### 3. Table Styling Constants
**File**: `utils/tableStyles.ts`
- Added column widths:
  - `exclusionMark: 50px` - 除外記号 column
  - `notes: 150px` - 補足 column
  - `sortButtons: 50px` - Up/down arrow buttons
- Code column width kept (112px) but will be hidden from UI

### 4. Database Service Functions
**File**: `services/dbService.ts`
- Added `moveProjectUp(projectId, periodLabel)` - Move project up in list
- Added `moveProjectDown(projectId, periodLabel)` - Move project down in list
- Updated `getProjects()` to sort by `display_order` instead of `code`

### 5. Translations
**File**: `contexts/LanguageContext.tsx`
- Added translations for all 3 languages (JA/EN/VN):
  - `tracker.exclusionMark` - 除外記号 / Exclusion Mark / Ký hiệu loại trừ
  - `tracker.notes` - 補足 / Notes / Ghi chú
  - `tracker.moveUp` - 上へ移動 / Move Up / Di chuyển lên
  - `tracker.moveDown` - 下へ移動 / Move Down / Di chuyển xuống

---

## Changes Needed (TrackingView.tsx) ⚠️

### Current Column Structure:
```
No. | Code | Company Name | Software | Business Content | Price | Type | [Months...] | Actions
```

### New Column Structure:
```
Sort | No. | Excl. | Company Name | Notes | Software | Business Content | Price | Type | [Months...] | Actions
```

### Implementation Steps:

#### 1. Update Width Calculations (Line ~370)
```typescript
const {
  sortButtons: SORT_BUTTONS_WIDTH,
  no: LEFT_NO_WIDTH,
  exclusionMark: LEFT_EXCLUSION_WIDTH,
  // code: LEFT_CODE_WIDTH, // REMOVED from UI
  name: LEFT_NAME_WIDTH,
  notes: LEFT_NOTES_WIDTH,
  software: LEFT_SOFTWARE_WIDTH,
  businessContent: BUSINESS_CONTENT_WIDTH,
  month: MONTH_WIDTH,
  actions: RIGHT_ACTIONS_WIDTH
} = TABLE_COLUMN_WIDTHS;
```

#### 2. Update Table Header (Lines ~423-459)
Remove Code column, add Sort, Exclusion Mark, and Notes columns:

```typescript
<thead className="bg-gray-50 sticky top-0 z-40">
  <tr>
    {/* Sort Buttons - Sticky Left */}
    <th scope="col" style={{ left: 0, width: `${SORT_BUTTONS_WIDTH}px` }}
        className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
      {/* Empty header for sort buttons */}
    </th>

    {/* No. Column */}
    <th scope="col" style={{ left: `${SORT_BUTTONS_WIDTH}px`, width: `${LEFT_NO_WIDTH}px` }}
        className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
      {t('tracker.no')}
    </th>

    {/* Exclusion Mark Column */}
    <th scope="col" style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH}px`, width: `${LEFT_EXCLUSION_WIDTH}px` }}
        className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
      {t('tracker.exclusionMark')}
    </th>

    {/* Company Name Column */}
    <th scope="col" style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH + LEFT_EXCLUSION_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }}
        className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
      {t('tracker.projectName')}
    </th>

    {/* Notes Column */}
    <th scope="col" style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH + LEFT_EXCLUSION_WIDTH + LEFT_NAME_WIDTH}px`, width: `${LEFT_NOTES_WIDTH}px` }}
        className={`px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
      {t('tracker.notes')}
    </th>

    {/* Software Column */}
    <th scope="col" style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH + LEFT_EXCLUSION_WIDTH + LEFT_NAME_WIDTH + LEFT_NOTES_WIDTH}px`, width: `${LEFT_SOFTWARE_WIDTH}px` }}
        className={`px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b ${stickyLeftHeaderClass} ${stickyCornerZ}`}>
      {t('tracker.software')}
    </th>

    {/* Rest of columns remain the same... */}
  </tr>
</thead>
```

#### 3. Update Table Body (Lines ~462-550)
Add Sort buttons, Exclusion Mark, and Notes cells:

```typescript
{filteredProjects.map((project, index) => {
  const projRecords = records[project.id] || [];
  const isFirst = index === 0;
  const isLast = index === filteredProjects.length - 1;

  return (
    <React.Fragment key={project.id}>
      {/* ROW 1: Plan */}
      <tr className="hover:bg-gray-50 group">
        {/* Sort Buttons - Sticky Left */}
        <td rowSpan={2} style={{ left: 0, width: `${SORT_BUTTONS_WIDTH}px` }}
            className={`px-1 py-2 text-center ${stickyLeftClass} align-middle`}>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleMoveUp(project.id)}
              disabled={isFirst}
              className={`p-1 rounded hover:bg-gray-200 ${isFirst ? 'opacity-30 cursor-not-allowed' : ''}`}
              title={t('tracker.moveUp')}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => handleMoveDown(project.id)}
              disabled={isLast}
              className={`p-1 rounded hover:bg-gray-200 ${isLast ? 'opacity-30 cursor-not-allowed' : ''}`}
              title={t('tracker.moveDown')}
            >
              ▼
            </button>
          </div>
        </td>

        {/* No. Column */}
        <td rowSpan={2} style={{ left: `${SORT_BUTTONS_WIDTH}px`, width: `${LEFT_NO_WIDTH}px` }}
            className={`px-2 py-3 text-center text-sm font-medium text-gray-500 ${stickyLeftClass} align-top`}>
          {index + 1}
        </td>

        {/* Exclusion Mark Column */}
        <td rowSpan={2} style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH}px`, width: `${LEFT_EXCLUSION_WIDTH}px` }}
            className={`px-2 py-2 text-center ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
          <input
            type="text"
            className="w-full text-center text-sm border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-transparent"
            value={project.exclusion_mark || ''}
            onChange={(e) => handleUpdateProject(project.id, { exclusion_mark: e.target.value })}
            maxLength={3}
            placeholder="×"
          />
        </td>

        {/* Company Name Column */}
        <td rowSpan={2} style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH + LEFT_EXCLUSION_WIDTH}px`, width: `${LEFT_NAME_WIDTH}px` }}
            className={`px-2 py-2 text-sm text-gray-700 border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
          <div className="font-medium line-clamp-2" title={project.name}>{project.name}</div>
        </td>

        {/* Notes Column */}
        <td rowSpan={2} style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH + LEFT_EXCLUSION_WIDTH + LEFT_NAME_WIDTH}px`, width: `${LEFT_NOTES_WIDTH}px` }}
            className={`px-2 py-2 text-xs text-gray-600 border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
          <textarea
            className="w-full min-h-[50px] text-xs border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-1 py-1 bg-transparent resize-none overflow-hidden"
            value={project.notes || ''}
            onChange={(e) => handleUpdateProject(project.id, { notes: e.target.value })}
            placeholder={t('tracker.notes')}
            rows={2}
          />
        </td>

        {/* Software Column */}
        <td rowSpan={2} style={{ left: `${SORT_BUTTONS_WIDTH + LEFT_NO_WIDTH + LEFT_EXCLUSION_WIDTH + LEFT_NAME_WIDTH + LEFT_NOTES_WIDTH}px`, width: `${LEFT_SOFTWARE_WIDTH}px` }}
            className={`px-2 py-2 text-xs text-gray-600 text-center border-b ${stickyLeftClass} align-top group-hover:bg-gray-50`}>
          <textarea
            className="w-full min-h-[50px] text-xs border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center px-1 py-1 bg-transparent resize-none overflow-hidden"
            value={project.software || ''}
            onChange={(e) => handleUpdateProject(project.id, { software: e.target.value })}
            placeholder="CAD"
            rows={2}
          />
        </td>

        {/* Rest of columns remain the same... */}
      </tr>
    </React.Fragment>
  );
})}
```

#### 4. Add Handler Functions (After line ~360)
```typescript
const handleMoveUp = async (projectId: string) => {
  try {
    await dbService.moveProjectUp(projectId, currentPeriodLabel);
    await fetchData(); // Refresh to show new order
  } catch (error) {
    console.error('Error moving project up:', error);
    alert('Failed to reorder project');
  }
};

const handleMoveDown = async (projectId: string) => {
  try {
    await dbService.moveProjectDown(projectId, currentPeriodLabel);
    await fetchData(); // Refresh to show new order
  } catch (error) {
    console.error('Error moving project down:', error);
    alert('Failed to reorder project');
  }
};
```

---

## Changes Needed (YearlyDataView.tsx) ⚠️

Similar changes as TrackingView:
1. Hide Code column (keep in data)
2. Add Exclusion Mark column
3. Add Notes column
4. Add Sort buttons column
5. Update sticky positioning calculations

---

## Testing Checklist

After applying changes:

- [ ] Run database migration in Supabase
- [ ] Verify Code column is hidden but data is retained
- [ ] Test Exclusion Mark input (max 3 characters)
- [ ] Test Notes textarea (multi-line input)
- [ ] Test Sort Up button (disabled on first row)
- [ ] Test Sort Down button (disabled on last row)
- [ ] Verify sticky columns work correctly with new layout
- [ ] Test on mobile/tablet (responsive design)
- [ ] Test all 3 languages (JA/EN/VN)
- [ ] Verify project ordering persists after refresh

---

## File Summary

### Modified Files:
1. ✅ `types.ts` - Added new fields to Project interface
2. ✅ `utils/tableStyles.ts` - Added column width constants
3. ✅ `services/dbService.ts` - Added reordering functions, updated sorting
4. ✅ `contexts/LanguageContext.tsx` - Added translations
5. ✅ `db/migration_add_fields.sql` - Database migration script
6. ⚠️ `components/TrackingView.tsx` - **NEEDS UPDATE** (see above)
7. ⚠️ `components/YearlyDataView.tsx` - **NEEDS UPDATE** (similar to TrackingView)

### New Files:
- `TABLE_UPDATES_GUIDE.md` - This guide

---

## Notes

- **Code column is hidden but NOT removed** from database - still used as unique identifier
- **Display order** is independent from code - users can reorder freely
- **Exclusion Mark** is free text (suggest ×, ○, △, -symbols)
- **Notes** supports multi-line text for additional project information
- **Sort buttons** swap display_order values between adjacent projects

---

**Created**: 2026-01-09
**Last Updated**: 2026-01-09
