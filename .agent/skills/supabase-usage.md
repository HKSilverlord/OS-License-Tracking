---
name: supabase-usage
description: Best practices and snippets for interacting with Supabase in this project.
---

# Supabase Usage Guidelines

## 1. Client Access
Always use the singleton instance exported from `src/utils/supabaseClient.ts` (or equivalent location). Do not create new instances.

```typescript
import { supabase } from '@/utils/supabaseClient';
```

## 2. Strong Typing
Use the generated database types if available.

```typescript
import { Database } from '@/types/supabase'; // Ensure this type definition exists
// ...
await supabase.from('table_name').select('*');
```

## 3. RLS and Security
- Always assume RLS is active.
- Use `supabase.auth.getUser()` to verify the current session user if context is needed manually (though often handled by context).

## 4. Error Handling
Supabase errors should be caught and transformed into domain errors in the Repository layer, NOT passed to the UI directly.

```typescript
const { data, error } = await supabase...;
if (error) {
  console.error("Supabase Error:", error);
  throw new Error("Failed to fetch data"); // Better: Custom Domain Error
}
```
