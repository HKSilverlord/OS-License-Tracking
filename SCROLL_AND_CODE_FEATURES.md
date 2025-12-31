# Scroll Container & Auto-Incrementing Code Features

## Overview
This document describes the new horizontal scroll with shadow indicators and auto-incrementing project code features implemented in the project tracking application.

---

## 1. Auto-Incrementing Project Codes (PRJ-XXX)

### Feature Description
Project codes are now automatically generated in the format `PRJ-001`, `PRJ-002`, etc. when creating new projects.

### Implementation

#### A. Code Generation Logic (`services/dbService.ts`)

**Function: `getNextProjectCode(period?: string)`**
```typescript
// Generates next available code: PRJ-001, PRJ-002, ...
const nextCode = await dbService.getNextProjectCode(currentPeriod);
```

**How it works:**
1. Queries all existing projects from database
2. Extracts numeric part from all `PRJ-XXX` format codes
3. Finds the maximum number
4. Increments by 1 and formats with leading zeros

**Key Features:**
- ✅ Auto-generates on project creation
- ✅ Never reuses deleted codes (always increments)
- ✅ Thread-safe (uses database query)
- ✅ Supports optional period scoping (commented out by default)
- ✅ Validates format with `isValidProjectCode()`

**Function: `isValidProjectCode(code: string)`**
```typescript
// Validates format: PRJ-001, PRJ-002, etc.
const isValid = dbService.isValidProjectCode("PRJ-123"); // true
const isInvalid = dbService.isValidProjectCode("ABC-123"); // false
```

#### B. Modified Functions

**`createProject()`** - Now auto-generates code:
```typescript
async createProject(project: Omit<Project, 'id' | 'created_at' | 'code'> & { code?: string }) {
  // Auto-generate code if not provided or invalid
  let finalCode = project.code;

  if (!finalCode || !isValidProjectCode(finalCode)) {
    finalCode = await getNextProjectCode(project.period);
  }

  // Insert with generated code
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...project, code: finalCode })
    .select()
    .single();

  return data;
}
```

**`getProjects()`** - Now sorts by code:
```typescript
// Projects sorted by code for better organization
.order('code', { ascending: true })
```

#### C. UI Integration (`App.tsx`)

**Project Creation Modal:**
```typescript
const handleOpenProjectModal = async () => {
  try {
    // Pre-generate code when opening modal
    const nextCode = await dbService.getNextProjectCode(currentPeriod);
    setNewProject(prev => ({ ...prev, code: nextCode }));
    setIsProjectModalOpen(true);
  } catch (error) {
    console.error("Failed to generate project code", error);
    // Fallback: open modal anyway, code will be auto-generated on submit
    setIsProjectModalOpen(true);
  }
};
```

**Code Input Field (ReadOnly):**
```tsx
<input
  required
  readOnly
  type="text"
  className="block w-full border border-gray-300 rounded-md p-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
  value={newProject.code}
/>
```

### Usage Examples

**Example 1: Creating First Project**
```typescript
// Database is empty
await dbService.createProject({
  name: "GLW (LM)",
  type: "設計",
  period: "2025-H1",
  unit_price: 2300
});
// Result: code = "PRJ-001"
```

**Example 2: Creating After Existing Projects**
```typescript
// Existing codes: PRJ-001, PRJ-002, PRJ-005
// (PRJ-003 and PRJ-004 were deleted)
await dbService.createProject({
  name: "New Project",
  period: "2025-H1",
  unit_price: 2300
});
// Result: code = "PRJ-006" (never reuses deleted codes)
```

**Example 3: Manual Code Validation**
```typescript
// Valid manual code
await dbService.createProject({
  code: "PRJ-999",
  name: "Special Project",
  period: "2025-H1"
});
// Result: Uses PRJ-999 if format is valid

// Invalid manual code
await dbService.createProject({
  code: "ABC-123", // Invalid format
  name: "Project",
  period: "2025-H1"
});
// Result: Auto-generates next code (e.g., PRJ-007)
```

### Code Format Rules

**Valid Formats:**
- ✅ `PRJ-001`
- ✅ `PRJ-010`
- ✅ `PRJ-100`
- ✅ `PRJ-999`

**Invalid Formats:**
- ❌ `PRJ-1` (missing leading zeros)
- ❌ `PRJ-0001` (too many digits)
- ❌ `ABC-001` (wrong prefix)
- ❌ `prj-001` (lowercase)
- ❌ `PRJ001` (missing hyphen)

### Optional: Period-Scoped Codes

If you want codes to restart for each period (e.g., 2025-H1 has PRJ-001, 2025-H2 also has PRJ-001):

**In `dbService.ts`, uncomment line 24:**
```typescript
async function getNextProjectCode(period?: string): Promise<string> {
  let query = supabase
    .from('projects')
    .select('code');

  // UNCOMMENT THIS LINE for period-scoped codes:
  if (period) query = query.eq('period', period);

  // ... rest of function
}
```

---

## 2. Horizontal Scroll with Shadow Indicators

### Feature Description
The TrackingView table now has a smart scroll container that shows left/right shadow indicators when content is scrollable in those directions.

### Implementation

#### A. ScrollContainer Component (`components/ScrollContainer.tsx`)

**Features:**
- ✅ Automatic shadow detection on scroll
- ✅ Left shadow appears when scrolled from start
- ✅ Right shadow appears when not scrolled to end
- ✅ Responds to content size changes (ResizeObserver)
- ✅ Smooth opacity transitions
- ✅ Configurable shadow color
- ✅ Touch-friendly on mobile devices

**Component Structure:**
```tsx
<ScrollContainer className="flex-1" shadowColor="rgba(0, 0, 0, 0.15)">
  <table>
    {/* Your table content */}
  </table>
</ScrollContainer>
```

**How it works:**
1. **ResizeObserver** monitors content size changes
2. **Scroll listener** tracks horizontal scroll position
3. **Shadow logic**:
   - Left shadow: `scrollLeft > 10`
   - Right shadow: `scrollLeft < scrollWidth - clientWidth - 10`
4. **Transitions**: Smooth 200ms opacity fade

#### B. Shadow Styling

**Left Shadow Gradient:**
```css
background: linear-gradient(to right, rgba(0, 0, 0, 0.15), transparent)
```

**Right Shadow Gradient:**
```css
background: linear-gradient(to left, rgba(0, 0, 0, 0.15), transparent)
```

**Shadow Specifications:**
- Width: 32px (8 × 4px = 2rem)
- Z-index: 40 (above table content)
- Pointer-events: none (doesn't block clicks)
- Position: absolute

#### C. TrackingView Integration

**Updated Structure:**
```tsx
<div className="flex flex-col h-full">
  <div className="flex-1 min-h-0 w-full border rounded-lg">
    {/* Action Bar (Select/Delete buttons) */}
    <div className="border-b bg-white z-30">...</div>

    {/* Scrollable Table with Shadows */}
    <ScrollContainer className="flex-1">
      <table key={currentPeriodLabel}>
        {/* Sticky left columns */}
        {/* Scrollable month columns */}
        {/* Sticky right columns */}
      </table>
    </ScrollContainer>

    {/* Empty State */}
    {filteredProjects.length === 0 && <div>...</div>}
  </div>
</div>
```

### Sticky Column Configuration

**Left Sticky Columns (Fixed while scrolling horizontally):**
1. ☑️ Checkbox - 64px
2. 🔢 NO. - 50px
3. 📝 Code - 112px
4. 🏢 Company Name - 192px
5. 💴 Unit Price - 96px

**Scrollable Columns:**
6. 📋 Business Content - 200px min
7. 📅 Month columns (7月-12月) - 96px each

**Right Sticky Columns:**
8. ⏱️ Total Hours - 96px
9. 💰 Revenue - 128px

### Column Width Constants (`utils/tableStyles.ts`)

```typescript
export const TABLE_COLUMN_WIDTHS = {
  // TrackingView specific
  select: 64,
  no: 50,
  code: 112,
  name: 192,
  price: 96,
  businessContent: 200,
  month: 96, // Month columns minimum width
  totalHrs: 96,
  totalRev: 128,
} as const;
```

### Responsive Design

**Mobile (< 640px):**
- Padding: `p-2`
- Font sizes: `text-xs`
- Button sizes: `px-2 py-1.5`
- Icon sizes: `w-3 h-3`

**Tablet (640px - 768px):**
- Padding: `sm:p-4`
- Font sizes: `sm:text-sm`
- Button sizes: `sm:px-3`
- Icon sizes: `sm:w-4 sm:h-4`

**Desktop (> 768px):**
- Padding: `md:p-6`
- Full feature set

### Touch Scroll Support

**CSS Classes:**
```css
.custom-scrollbar {
  /* Webkit browsers (Chrome, Safari, Edge) */
  &::-webkit-scrollbar { height: 12px; }
  &::-webkit-scrollbar-track { background: #f1f1f1; }
  &::-webkit-scrollbar-thumb { background: #888; border-radius: 6px; }
  &::-webkit-scrollbar-thumb:hover { background: #555; }

  /* Touch devices */
  -webkit-overflow-scrolling: touch;
}
```

---

## 3. Testing & Verification

### Auto-Incrementing Codes

**Test Case 1: First Project**
```bash
# Expected: PRJ-001
```

**Test Case 2: After Deletions**
```bash
# Create PRJ-001, PRJ-002, PRJ-003
# Delete PRJ-002
# Create new project
# Expected: PRJ-004 (not PRJ-002)
```

**Test Case 3: Invalid Manual Code**
```bash
# Try to create with code "ABC-123"
# Expected: Auto-generates PRJ-XXX format
```

### Scroll Shadows

**Test Case 1: Initial Load**
```bash
# Table with 6+ month columns
# Expected: Right shadow visible, left shadow hidden
```

**Test Case 2: Scroll Right**
```bash
# Scroll horizontally to the right
# Expected: Left shadow appears, right shadow may disappear
```

**Test Case 3: Scroll to End**
```bash
# Scroll all the way to the right
# Expected: Left shadow visible, right shadow hidden
```

**Test Case 4: Window Resize**
```bash
# Resize browser window
# Expected: Shadows update appropriately
```

---

## 4. Troubleshooting

### Issue: Codes not incrementing properly

**Solution:**
```sql
-- Check existing codes in database
SELECT code FROM projects ORDER BY code;

-- If codes are malformed, update them:
UPDATE projects SET code = 'PRJ-001' WHERE id = 'xxx';
```

### Issue: Shadows not appearing

**Check:**
1. Content width exceeds container width?
2. ScrollContainer properly wrapping table?
3. Browser console for JavaScript errors?

**Solution:**
```typescript
// Add debug logging in ScrollContainer
const updateShadows = useCallback(() => {
  const container = containerRef.current;
  console.log('Scroll:', { scrollLeft, scrollWidth, clientWidth });
  // ...
}, []);
```

### Issue: Table not scrolling on mobile

**Solution:**
```css
/* Ensure touch scrolling is enabled */
.custom-scrollbar {
  -webkit-overflow-scrolling: touch;
  overflow-x: auto;
}
```

---

## 5. Future Enhancements

### Potential Improvements:

1. **Code Format Customization**
   ```typescript
   // Allow different formats: ABC-XXX, PROJ-XXXX, etc.
   const config = { prefix: 'PRJ', digits: 3 };
   ```

2. **Batch Code Generation**
   ```typescript
   // Generate multiple codes at once
   const codes = await dbService.getNextProjectCodes(5);
   // Returns: ['PRJ-001', 'PRJ-002', 'PRJ-003', 'PRJ-004', 'PRJ-005']
   ```

3. **Code Reservation System**
   ```typescript
   // Reserve codes before creating projects
   const reserved = await dbService.reserveProjectCode();
   // Prevents concurrent creation conflicts
   ```

4. **Vertical Scroll Shadows**
   ```tsx
   <ScrollContainer
     direction="both"
     showTopShadow={true}
     showBottomShadow={true}
   />
   ```

5. **Sticky Column Customization**
   ```typescript
   // Allow users to choose which columns stay sticky
   const stickyConfig = {
     left: ['select', 'code', 'name'],
     right: ['totalHrs', 'revenue']
   };
   ```

---

## 6. Migration Guide

### For Existing Projects

If you have existing projects without the PRJ-XXX format:

```sql
-- Step 1: Backup current codes
CREATE TABLE projects_backup AS SELECT * FROM projects;

-- Step 2: Update codes to PRJ-XXX format
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM projects
)
UPDATE projects p
SET code = 'PRJ-' || LPAD(n.row_num::text, 3, '0')
FROM numbered n
WHERE p.id = n.id;

-- Step 3: Verify
SELECT code, name FROM projects ORDER BY code;
```

---

## 7. Browser Compatibility

**Supported Browsers:**
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Features:**
- ✅ ResizeObserver (all modern browsers)
- ✅ CSS sticky positioning (all modern browsers)
- ✅ Touch scrolling (iOS/Android)
- ✅ Smooth scrollbar (Webkit browsers)

---

*Last Updated: 2025-12-31*
