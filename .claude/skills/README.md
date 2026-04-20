# Claude Code Skills — EMJmedia Fabrik v2

**Installiert:** 2026-04-21
**Strategie:** Vendored Copies (Option C). Jeder Skill ist eine eingefrorene Kopie.
Updates werden bewusst per Re-Clone + Diff-Review eingepflegt, nicht automatisch.

## Enthaltene Skills (10)

| Skill | Zweck | Quelle |
|-------|-------|--------|
| impeccable | Anti-Slop Design-Sprache, 24 Design-Quality-Checks | pbakaus/impeccable |
| emil-kowalski | UI-Polish, Animationen, Micro-Interactions | emilkowalski/skill |
| taste-skill | High-Agency Frontend Guardrails | Leonxlnx/taste-skill |
| web-quality-skills | Lighthouse + Core Web Vitals Optimierung | addyosmani/web-quality-skills |
| claude-seo | Technical SEO, E-E-A-T, Schema, GEO | AgriciDaniel/claude-seo |
| local-seo-skills | Local SEO (GBP, Citations, Reviews, Maps) | garrettjsmith/localseoskills |
| landing-page-copywriter | PAS/AIDA/StoryBrand Landing Page Copy | onewave-ai/claude-skills |
| cold-email | B2B Cold Outreach + Follow-Up Sequences | alirezarezvani/claude-skills |
| browser-use | Browser-Automation via CDP (Lighthouse lokal prüfen) | browser-use/browser-use |
| n8n-skills | 7 Sub-Skills für n8n Workflow Building | czlonkowski/n8n-skills |

## Nicht als Skill eingebunden

- **spec-kit** (github/spec-kit): CLI-Toolkit, nicht Skill. Wird in Session 0.2 per `uvx` in der Spec-Kit Constitution aktiviert.
- **n8n-mcp** (czlonkowski/n8n-mcp): Der MCP-Server-Teil. Wird in Session 0.3 auf dem n8n-VPS als MCP-Server konfiguriert. Der `n8n-skills`-Teil (oben) enthält den passenden Claude-Skill.
- **browser-use Python-Library**: Wird in Session 0.3 auf dem VPS via `pip install browser-use` installiert. Die Library-Logik läuft auf dem VPS, der Skill hier gibt Claude den Kontext.

## Update-Prozess

1. `git clone --depth=1 <source-url> /tmp/<name>`
2. `diff -r /tmp/<name> .claude/skills/<name>` — Änderungen prüfen
3. Bewusst übernehmen oder lassen
4. Bei Übernahme: Commit mit "update skill: <name> → <neue-sha>"

## Quellen-Log (Install-Commits)

Details siehe `SOURCES.md` im selben Ordner.
