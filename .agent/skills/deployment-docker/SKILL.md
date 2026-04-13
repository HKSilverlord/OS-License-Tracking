---
name: deployment-docker
description: Docker-based deployment and production build pipeline. Covers multi-stage Docker build, nginx configuration, environment variable injection, and deployment workflow.
---

# Deployment & Docker

## Build Pipeline

### Multi-Stage Dockerfile

```
Stage 1: node:20-alpine (Builder)
  → npm ci
  → npm run build (Vite)
  → Output: /app/dist/

Stage 2: nginx:alpine (Server)
  → Copy dist/ to /usr/share/nginx/html
  → Apply custom nginx.conf
  → Expose port 80
```

### Build Command

```powershell
docker build -t os-management-system . `
  --build-arg VITE_SUPABASE_URL=$env:VITE_SUPABASE_URL `
  --build-arg VITE_SUPABASE_ANON_KEY=$env:VITE_SUPABASE_ANON_KEY
```

### Run Container

```powershell
docker run -p 8080:80 os-management-system
```

## Nginx Configuration

File: `nginx.conf`

Key settings:
- SPA fallback: `try_files $uri $uri/ /index.html`
- Gzip compression enabled
- Static asset caching
- Port 80

## Environment Variables

### Build-time (Baked into JS bundle)
| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |

### Local Development
Store in `.env.local` (gitignored):
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## Production Build (No Docker)

```bash
npm run build    # Output: dist/
npm run preview  # Preview production build locally
```

## Deployment Checklist

- [ ] Environment variables set
- [ ] `npm run build` succeeds with no errors
- [ ] Docker image builds successfully
- [ ] Container starts and serves on expected port
- [ ] Supabase connection works (check browser console)
- [ ] Auth flow works (login/logout)
- [ ] RLS policies are active on all tables
