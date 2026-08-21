# Work Dashboard (ops monorepo)

Private operations monorepo: Jiji marketplace scraper at the repo root, and the Next.js personal ops dashboard under `apps/web`.

## Layout

| Path | Role |
|------|------|
| `main.py`, `config.py`, `requirements.txt` | Jiji scraper entrypoints and deps |
| `scraper/`, `database/`, `scorer/`, `outreach/` | Scraper pipeline modules |
| `apps/web/` | Next.js dashboard (buyers CRM, knowledge base, materials) |

## Web dashboard

```bash
cd apps/web
npm install
npm run dev
```

**Vercel:** set the project **Root Directory** to `apps/web` (not the repo root).

Copy env from `apps/web/.env.example` into `apps/web/.env.local` (do not commit secrets).

## Scraper

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Keep `data/`, `output/`, and `.venv/` local; they are gitignored.
