# frontend — UCP Books

Next.js (App Router) client for the UCP Books workshop: the human shopping UI and the AI shopping agent, both calling the Go backend's UCP endpoints (`../backend`).

See the [repo root README](../README.md) and [docs/](../docs) for the full workshop walkthrough — this file only covers local frontend commands.

```bash
npm install
cp .env.local.example .env.local
npm run dev      # http://localhost:3000, requires backend running on :8080
npm run lint
npm run build
```
