---
name: database-migrations
description: Database schema management for Supabase PostgreSQL. Covers migration conventions, schema reference, RLS policies, and SQL script patterns used in the db/ directory.
---

# Database Migrations & Schema

## Overview

All database changes are managed as SQL files in the `db/` directory.
The database is **PostgreSQL** hosted on **Supabase**.

## Schema Files

| File | Purpose |
|---|---|
| `schema.sql` | Core table definitions |
| `supabase_schema.sql` | Extended schema with RLS |
| `supabase_full_setup.sql` | Complete setup (tables + RLS + functions) |
| `migration_*.sql` | Incremental migrations |
| `import_*.sql` | Data seeds and imports |
| `add_*.sql` | Column additions |
| `SETUP_GUIDE.md` | Initial setup instructions |
| `README.md` | Migration history & docs |

## Core Tables

### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Other',
  software TEXT DEFAULT 'Other',
  status TEXT DEFAULT 'active',  -- active/completed/pending/archived
  unit_price NUMERIC DEFAULT 2300,  -- DEPRECATED: use period_projects
  plan_price NUMERIC DEFAULT 2300,
  actual_price NUMERIC DEFAULT 2300,
  notes TEXT DEFAULT '',
  exclusion_mark TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `monthly_records`
```sql
CREATE TABLE monthly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  planned_hours NUMERIC DEFAULT 0,
  actual_hours NUMERIC DEFAULT 0,
  UNIQUE(project_id, year, month)
);
```

### `periods`
```sql
CREATE TABLE periods (
  label TEXT PRIMARY KEY,  -- e.g., '2025-H1'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `period_projects` (Junction Table)
```sql
CREATE TABLE period_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT REFERENCES periods(label) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  plan_price NUMERIC DEFAULT 2300,
  actual_price NUMERIC DEFAULT 2300,
  UNIQUE(period_label, project_id)
);
```

### `settings`
```sql
CREATE TABLE settings (
  label TEXT PRIMARY KEY,  -- e.g., '2025-H1'
  exchange_rate NUMERIC DEFAULT 1,
  license_computers INTEGER DEFAULT 0,
  license_per_computer NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 2300
);
```

### `catia_license_data`
CATIA license tracking (columns vary by implementation).

## Migration Conventions

### File Naming
```
migration_<descriptive_name>.sql
```
Examples:
- `migration_add_fields.sql`
- `migration_period_scoping.sql`
- `migration_add_period_to_projects.sql`

### Writing Idempotent Migrations

```sql
-- Always check before altering
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Use DO blocks for complex checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'exclusion_mark'
  ) THEN
    ALTER TABLE projects ADD COLUMN exclusion_mark TEXT DEFAULT '';
  END IF;
END $$;
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users
CREATE POLICY "Authenticated users can read projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

## Applying Migrations

1. Open Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Execute
4. Verify in Table Editor
5. Update `db/README.md` with migration notes

## Rollback Strategy

- No automated rollback — manual SQL required
- Always write reversible migrations when possible
- Document rollback steps in the migration file comments

## Data Import/Seeds

Import files handle data population:
```sql
-- Example: Import with existing project lookup
INSERT INTO monthly_records (project_id, period_label, year, month, planned_hours, actual_hours)
SELECT p.id, '2025-H1', 2025, 1, 100, 95
FROM projects p WHERE p.code = 'OS-001';
```
