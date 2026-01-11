# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
# Note: Ensure ARG/ENVs are provided during build if baking is necessary,
# OR rely on runtime configuration if using a config.js injection strategy.
# For this setup, we assume environment variables are provided at build time via --build-arg
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG GEMINI_API_KEY 

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
