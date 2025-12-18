# Project Context: prompt-web

This file serves as a quick reference guide for AI agents to understand the purpose, architecture, and technology stack of this project.

## 🚀 Purpose
`prompt-web` is a **Prompt Exploration and Discovery Tool**. It enables users to browse, search, and filter a curated collection of AI prompts.

## 🏗️ Architecture
The project is a **Monorepo** managed by `pnpm`.

- **`/apps/api`**: Fastify-based backend.
  - Loads data from `data/prompts.seed.json`.
  - Exposes REST endpoints for list and retrieval with filtering/paging logic.
- **`/apps/web`**: React + Vite + Tailwind frontend.
  - Premium UI using a custom "banana" design system.
  - Uses TanStack Query for data fetching.
  - Syncs search/filter state to URL parameters.
- **`/data`**: Contains the static data source (`prompts.seed.json`).

## 🛠️ Technology Stack
| Layer | Technology |
| :--- | :--- |
| **Package Manager** | `pnpm` (Workspace support) |
| **Backend Framework** | [Fastify](https://fastify.dev/) |
| **Frontend Framework** | [React](https://react.dev/) + [Vite](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Data Fetching** | [TanStack Query](https://tanstack.com/query) |
| **Routing** | [React Router](https://reactrouter.com/) |
| **Validation** | [Zod](https://zod.dev/) |

## 🔑 Key Features
- **Semantic Search**: Filter by Title, Genre, Style, and Mood.
- **URL-Driven State**: Filters are shared via the URL.
- **Local Bookmarks**: Save prompts locally using `localStorage`.
- **Copy-to-Clipboard**: Quick access to prompt text.

## 📂 Directory Map
- `apps/api/src/server.ts`: Entry point for the backend.
- `apps/api/src/routes/prompts.ts`: Core API logic and search implementation.
- `apps/web/src/views/ExplorePage.tsx`: Main UI entry point.
- `apps/web/src/api/`: Frontend API client wrappers.
- `data/prompts.seed.json`: The "Source of Truth" for prompts.
