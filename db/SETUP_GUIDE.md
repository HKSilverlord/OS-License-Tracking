# Supabase Setup Guide

How to provision the backend for OS License Tracking.

> **Security notice.** Earlier revisions of this guide contained a shared plaintext
> password and real user email addresses. Those values are still present in the git
> history, so **treat every account that ever used them as compromised: rotate the
> passwords, and rotate the Supabase `anon`/`service_role` keys if they were ever pasted
> into a committed file.** Never put credentials in this repository.

---

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. From **Project Settings > API**, copy the **Project URL** and the **anon public** key.
   Keep the `service_role` key secret — it must never reach the frontend or the repo.

## 2. Run the SQL

Open **SQL Editor > New query** in the Supabase dashboard and run these files **in this
order**. Paste the whole file, click **Run**, and confirm it reports success before moving
to the next one.

| # | File | Required? | What it does |
|---|---|---|---|
| 1 | `db/schema.sql` | **Yes** | Creates `periods`, `projects`, `period_projects`, `monthly_records`, `settings`, `user_roles`, the `get_my_role()` helper, all indexes and all RLS policies. Idempotent. |
| 2 | `db/migration_rbac.sql` | Legacy databases only | Adds `user_roles`, `get_my_role()` and the read/admin-write policies to a database created **before** `schema.sql` existed. A fresh database already has all of this from step 1 — running it again fails with `policy ... already exists`, which is harmless but aborts the script. |
| 3 | `db/migration_fix_rbac_recursion.sql` | Legacy databases only | Drops the recursive `user_roles: admin full` policy. `schema.sql` never creates it, so on a fresh database this is a no-op. |
| 4 | `db/migration_catia_license.sql` | **Yes** | Creates `catia_license_data`, the server-side store for CATIA licence costs and revenues. |
| 5 | `db/migration_catia_license_seed.sql` | **Yes** | Publishes the canonical CATIA sheet into the row step 4 created. Step 4 leaves `license_costs` empty, which the app reads as "never published" and answers by uploading whichever admin opens it first from their own browser. Run this and no client ever makes that decision. Safe to re-run: it will not overwrite a sheet that has already been published. |
| 6 | `db/import_2025_data.sql` | Optional | Seeds the demo/handover project and monthly-record data. Skip it if you are starting from scratch. |

**Fresh project, short version:** run `db/schema.sql`, then `db/migration_catia_license.sql`,
then `db/migration_catia_license_seed.sql`.

**Order matters for the CATIA pair:** run both before deploying the app, and step 5 straight
after step 4. Between them the sheet is unpublished, and the first admin to open the app
fills it from their browser's local copy.

## 3. Create the users

Sign-up is disabled in the app (it is an internal tool), so every account is created by
hand.

1. Go to **Authentication > Users** in the Supabase dashboard.
2. Click **Add user > Create new user**.
3. For each person:
   * enter their work **email address**;
   * set a **strong, unique password** — do not reuse one password across accounts, and
     hand it over through a password manager or another secure channel, never in a file,
     ticket or chat message that is retained;
   * tick **Auto Confirm User** so they can sign in immediately.
4. Ask each user to change their password on first sign-in.

## 4. Grant the admin role

Everyone who signs in can read all data. Only users listed in `public.user_roles` with
role `admin` can create, edit or delete anything, so grant it explicitly — run this in the
SQL Editor once per administrator, replacing the address:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (user_id) do update set role = excluded.role;
```

To add a read-only user explicitly, use `'user'` instead of `'admin'` (a user with no row
at all is already treated as read-only).

Verify:

```sql
select u.email, r.role
from public.user_roles r
join auth.users u on u.id = r.user_id;
```

While logged in as that user, `select public.get_my_role();` should return `admin`.

## 5. Connect the application

Create `.env.local` in the repository root (copy `.env.example`) and fill in the two values
from step 1:

```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

`.env.local` is git-ignored. Do not commit it, and do not put the `service_role` key in it.

## 6. Deployment

Set the same two variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your hosting
platform's environment settings — Vercel/Netlify project settings, or `--build-arg` values
for the Docker build described in the root `README.md`. They are compiled into the client
bundle at build time, so a rebuild is required after changing them.

## Troubleshooting

* **Everything is read-only for an admin** — the `user_roles` row is missing or has the
  wrong `user_id`. Re-run step 4 and check `select public.get_my_role();`.
* **`permission denied` / writes silently fail** — RLS is doing its job; the signed-in user
  is not an admin.
* **`policy ... already exists`** — you ran `db/migration_rbac.sql` on a database that was
  created from `db/schema.sql`. Skip step 2.
* **Empty dashboards** — no `periods` rows yet. Create one from **Period Management** in
  the app (as an admin), or run `db/import_2025_data.sql`.
