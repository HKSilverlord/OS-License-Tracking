# Supabase Setup Guide

Follow these steps to configure your Supabase backend.

## 1. Create a Project
1. Go to [Supabase](https://supabase.com) and create a new project.
2. Note down your `Project URL` and `anon public key` from the **Settings > API** section.

## 2. Setup Database Schema
1. In your Supabase Dashboard, go to the **SQL Editor** (icon on the left sidebar).
2. Click **New Query**.
3. Copy the entire content of `db/schema.sql` (found in this folder) and paste it into the query editor.
4. Click **Run**.
   * *Success:* You should see "Success, no rows returned" or similar.

## 3. Setup Authentication (Create Users)
The application requires users to be logged in. Since sign-up is disabled in the app interface (it's an internal tool), you must create the users manually.

1. Go to **Authentication > Users** in the Supabase Dashboard.
2. Click **Add User** -> **Create New User**.
3. Add the Owner:
   * **Email:** `mactuananh.work@gmail.com`
   * **Password:** `Esutech@123` (or your preferred password)
   * Check "Auto Confirm User?" so they can login immediately.
4. Add the OS Leader 1:
   * **Email:** `linh.trandinh@esutech.vn`
   * **Password:** `Esutech@123`
   * Check "Auto Confirm User?"
5. Add the OS Leader 2:
   * **Email:** `linhtd@esutech.edu.vn`
   * **Password:** `Esutech@123`
   * Check "Auto Confirm User?"

## 4. Connect the Application
1. Create a `.env` file in the root of your project (if not already there).
2. Add your credentials:

```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 5. Deployment
When you deploy (e.g., to Vercel/Netlify), ensure you add these Environment Variables in your deployment settings as well.
