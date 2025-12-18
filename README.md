# Prompt Web

A modern, fast, and curated AI Prompt exploration tool.

## 🚀 Features
- **Exploration**: Browse and filter curated prompts by genre, style, and mood.
- **Search**: Instant semantic search across titles and content.
- **Performance**: Edge-native API running on Cloudflare Workers.
- **UI/UX**: Premium "Banana" design system with reactive URL-driven state.

## 🛠️ Tech Stack
- **Monorepo**: `pnpm` Workspaces
- **Backend**: [Fastify](https://fastify.dev/) (Local) / [Cloudflare Workers](https://workers.cloudflare.com/) (Production)
- **Frontend**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/) + [Cloudflare Workers](https://workers.cloudflare.com/)

## 📦 Project Structure
- `apps/api`: Fastify API server.
- `apps/web`: React frontend application.
- `data`: Seed data for prompts.

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)

### Installation
```bash
pnpm install
```

### Development
Runs both the API and the Web app concurrently:
```bash
pnpm dev
```
- API: `http://localhost:8787`
- Web: `http://localhost:5173`

## ☁️ Deployment
The project is configured for automatic deployment via **GitHub Actions**.

### Cloudflare Setup
1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to your GitHub repository secrets.
2. Push to the `main` branch to trigger the deployment.

### Backend (Workers)
Configured in `apps/api/wrangler.toml`.

### Frontend (Pages)
Configured for Cloudflare Pages with SPA support via `public/_redirects`.
