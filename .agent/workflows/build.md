---
description: Build the application for production using Docker
---

1. Ensure environment variables are set in `.env.local` or passed as build args.

2. Build the Docker image
   Replace `<IMAGE_NAME>` with your desired image name (e.g., `os-management-system`).
   
   ```powershell
   docker build -t <IMAGE_NAME> . --build-arg VITE_SUPABASE_URL=$env:VITE_SUPABASE_URL --build-arg VITE_SUPABASE_ANON_KEY=$env:VITE_SUPABASE_ANON_KEY
   ```

3. (Optional) Run the container to test
   
   ```powershell
   docker run -p 8080:80 <IMAGE_NAME>
   ```
