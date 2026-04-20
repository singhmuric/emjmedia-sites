# emjmedia-sites

Automated website factory for EMJmedia. Generates branch-specific one-page websites for cold outreach and full multi-page sites for paying clients.

## System

Part of Singh/Muric GbR's Fabrik v2 architecture:

- **Orchestration:** Opus 4.7 in Cowork writes specs and plans via [GitHub Spec-Kit](https://github.com/github/spec-kit)
- **Implementation:** Sonnet 4.6 in Claude Code (local or headless on n8n-VPS) writes code
- **Lead-Pipeline:** n8n + Google Places API + Haiku scoring → triggers builds via HTTP endpoint
- **Deploy:** Vercel wildcard subdomains `*.emj-media.de`

## Repo Structure

```
.claude/skills/    11 skills: impeccable, taste, emil-kowalski, web-quality,
                   claude-seo, localseo, landing-page-copywriter, cold-email,
                   spec-kit, browser-use, n8n-MCP
.specify/          Spec-Kit artifacts (constitution, specs, plans, tasks)
_templates/        Branch-specific page templates (starting with kfz-werkstatt)
_outreach/         Cold-email sequences per branch
_logs/             Build/deploy logs, feedback patterns
sites/onepages/    Generated demo sites for cold outreach leads
sites/clients/     Paying client projects
```

## Workflow

1. `/speckit.specify` — define what to build (Opus)
2. `/speckit.plan` — architecture decisions (Opus)
3. `/speckit.tasks` — task breakdown (Opus)
4. `/speckit.implement` — write code (Sonnet in Claude Code)
5. Self-review via web-quality-skills (Lighthouse ≥ 90 all pillars)
6. Push → Vercel auto-deploy

## Status

Phase 0 — foundation. See `_Strategie/EMJmedia/WEBSITE_FABRIK_PLAN_v2.md` in the Obsidian vault for the current session plan.

## License

Private. All rights reserved. Singh/Muric GbR.
