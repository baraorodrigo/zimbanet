# CLAUDE.md

Guidance for Claude Code working in `zimbanet-portal/`.

## Project

**ZIMBANET** — portal de notícias e comunidade regional de Imbituba, SC.
Tagline: "Imbituba conectada". Cobertura: Imbituba, Garopaba, Laguna, Imaruí, Paulo Lopes e região.
Evolução do BOMBEI Imbituba (`@bombei_imbituba`). Toda UI e conteúdo em PT-BR.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind v3
- **Backend:** Supabase (Auth + Postgres + Storage)
- **Auth providers:** Google OAuth · Facebook OAuth · SMS (phone OTP)
- **SDKs:** `@supabase/supabase-js`, `@supabase/ssr`

## Commands

```bash
npm run dev      # dev server em http://localhost:3000
npm run build
npm run start
npm run lint
```

## Estrutura

- `src/app/` — App Router (pages, layouts, route handlers, Server Actions)
- `src/components/` — UI compartilhado (criar conforme necessário)
- `src/lib/supabase/` — clients: `client.ts` (browser), `server.ts` (RSC + Server Actions), `middleware.ts` (refresh de sessão)
- `src/middleware.ts` — Next middleware: chama `updateSession` em toda request
- `public/logos/` — logos SVG da marca

## Marca — tokens Tailwind

| Token | Hex | Uso |
|---|---|---|
| `navy` | #0D1B2A | primária, header, footer, dark surfaces |
| `zimba-blue` | #1B3A5C | secundária, hovers, apoio |
| `zimba-gold` | #E8B100 | CTAs, "NET" no logo, links ativos, destaque |
| `off-white` | #F5F5F5 | bg claro principal |
| `alert-red` | #C62828 | breaking news, urgente, ao vivo |
| `eco-green` | #2E7D32 | positivo, doações, sustentabilidade |

**Tipografia:** `font-serif` (Georgia stack) para headlines · `font-sans` (Inter via `next/font/google`) para corpo. H1–H6 já vêm com `font-serif` aplicado no `globals.css`.

**Conceito visual:** "nostalgia moderna" — densidade dos portais brasileiros dos anos 2000 (UOL/Terra) com design contemporâneo. Flat (sem gradientes pesados, sem sombras 3D), cantos 4–8px, alta densidade acima da dobra.

Brandbook completo + guia editorial em `../Portal Zimba1000grau/marca/` (PDFs e prompts). Logos em `public/logos/` foram copiados de `../design system1/assets/`.

## Editorias planejadas

INÍCIO · CIDADE · POLÍTICA · ESPORTE · CULTURA · POLÍCIA · PRAIAS · **#ZIMBAMILGRAU** (mural comunitário, "voz do povo") · **#BAZARDAZIMBA** (classificados regionais).

## Workspace pai (NÃO MODIFICAR — apenas consultar)

`Zimbanet/` contém pastas-irmãs de referência:
- `design system1/` — design system HTML/CSS/JS gerado no Claude.ai/design + SVGs
- `Portal Zimba1000grau/` — brandbook PDF, guia editorial, prompts de design
- `radar-regional antigo/` — código legado BOMBEI (FastAPI + Vite/React). Lógica de scraping, scoring (Claude Haiku), drafting (Claude Sonnet) e aprovação editorial via Telegram. Consultar para portar regras de negócio — **não copiar código diretamente**.

## Convenções

- **Server Components por padrão.** `"use client"` só onde houver interatividade ou hooks.
- **Server Actions** para mutações de dados (criar post, comentar, anunciar no bazar etc.).
- **Auth via `@supabase/ssr`** — nunca usar `@supabase/auth-helpers-nextjs` (deprecated).
- **Cores SEMPRE pelos tokens da marca** — nunca `blue-600`, `red-500`, `gray-*` para superfícies de marca. Use os 6 tokens.
- **Slugs, copy, comentários:** PT-BR. URLs amigáveis (`/cidade/...`, `/zimbamilgrau`, `/bazardazimba`).
- **Mobile-first** mas desktop deve brilhar em layout de 3 colunas.
