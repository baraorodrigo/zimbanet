# ZIMBANET — Portal

Portal de notícias e comunidade regional de Imbituba, SC. Tagline: "Imbituba conectada".

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind + Supabase**.

## Setup local

```bash
npm install
cp .env.local.example .env.local   # preencher com credenciais Supabase
npm run dev
```

Abre em http://localhost:3000.

## Variáveis de ambiente

| Var | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mesmo lugar |

## Auth providers a configurar no Supabase

- Google OAuth
- Facebook OAuth
- SMS (phone OTP) — requer provider SMS configurado (Twilio, MessageBird etc.)

## Estrutura

```
src/
├── app/                   # App Router (páginas, layouts, actions)
├── components/            # UI compartilhado (a criar)
├── lib/supabase/          # clients browser/server/middleware
└── middleware.ts          # refresh de sessão Supabase
public/logos/              # logos SVG da marca
```

Detalhes de marca, convenções e arquitetura em [`CLAUDE.md`](./CLAUDE.md).
