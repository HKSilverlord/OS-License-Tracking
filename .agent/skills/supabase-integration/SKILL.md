---
name: supabase-integration
description: Supabase integration patterns for this project — client setup, database queries, auth, RLS, and migration conventions.
---

# Supabase Integration Guide

## Overview

This project uses **Supabase** (hosted PostgreSQL) as its backend with:
- Supabase Auth for authentication
- Direct client SDK calls for data access
- Row Level Security (RLS) for authorization
- SQL migrations stored in `db/` directory

## Client Setup

### Singleton Client

Located at `lib/supabase.ts` (legacy) and `src/data/clients/supabaseClient.ts` (clean arch):

```typescript
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**RULE**: Never create a new `createClient()`. Always import the singleton.

## Database Schema (Core Tables)

| Table | Purpose |
|---|---|
| `projects` | Project master data (code, name, type, software, status) |
| `monthly_records` | Time tracking data (planned/actual hours per month) |
| `periods` | Period definitions (e.g., "2025-H1", "2025-H2") |
| `period_projects` | Junction table linking projects ↔ periods with prices |
| `settings` | System settings (exchange rate, license costs) |
| `catia_license_data` | CATIA license tracking data |

### Naming Conventions
- Tables: `snake_case`, plural (`projects`, `monthly_records`)
- Columns: `snake_case` (`created_at`, `project_id`, `unit_price`)
- Primary keys: `id` (UUID, auto-generated)
- Foreign keys: `<table_singular>_id` (e.g., `project_id`)
- Timestamps: `created_at`, `updated_at` (auto-managed)

## Query Patterns

### Select with Filtering
```typescript
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('status', 'active')
  .order('display_order', { ascending: true });
```

### Upsert (Insert or Update)
```typescript
const { error } = await supabase
  .from('monthly_records')
  .upsert({
    project_id,
    period_label,
    year,
    month,
    planned_hours,
    actual_hours
  }, { onConflict: 'project_id,year,month' });
```

### Join via period_projects
```typescript
const { data } = await supabase
  .from('period_projects')
  .select('*, projects(*)')
  .eq('period_label', '2025-H1');
```

## Authentication

The app uses Supabase Auth with email/password:
```typescript
// Sign in
await supabase.auth.signInWithPassword({ email, password });

// Get session
const { data: { session } } = await supabase.auth.getSession();

// Sign out
await supabase.auth.signOut();
```

Auth state managed in `App.tsx` with `onAuthStateChange` listener.

## Error Handling

**In Data Layer (repositories)**:
```typescript
const { data, error } = await supabase.from('table').select('*');
if (error) {
  console.error('Supabase Error:', error);
  throw new Error(`Failed to fetch: ${error.message}`);
}
return data;
```

**NEVER** pass raw Supabase errors to the UI layer.

## Migrations

All schema changes go into `db/` as `.sql` files:
- `schema.sql` — Base schema definition
- `supabase_full_setup.sql` — Complete setup script
- `migration_*.sql` — Incremental migrations
- `import_*.sql` — Data seed/import scripts

### Creating a Migration
1. Create `db/migration_<description>.sql`
2. Write idempotent SQL (`IF NOT EXISTS`, `ALTER TABLE IF`)
3. Apply via Supabase Dashboard SQL Editor
4. Update `db/README.md` with migration notes

## Security Rules

- ✅ RLS enabled on all tables
- ✅ Environment variables for credentials
- ✅ Anonymous key (not service role key) on client
- ❌ Never expose service_role key in frontend
- ❌ Never disable RLS without explicit reason
