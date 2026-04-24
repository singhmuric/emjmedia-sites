# CLAUDE.md — Auto-Loader für Claude Code

**Gilt für:** Alle Claude-Code-Sessions in diesem Repo (lokal Mac, Headless VPS).
**Autorität:** Constitution v1.2 (`.specify/CONSTITUTION.md`) ist das Gesetz. Diese Datei macht sie ausführbar.
**Stand:** 2026-04-23

---

## 1. Erstes, was du tust bei Session-Start

1. Lies `.specify/CONSTITUTION.md` vollständig. Das ist nicht optional.
2. Prüfe, ob in der aktuellen Task ein Session-Handover referenziert ist (`EMJmedia/SESSION_*_HANDOVER.md` im Vault). Wenn ja: vollständig lesen bevor du Code anfasst.
3. Bei UI-Arbeit: lies §12 der Constitution nochmal und folge der Skill-Ladung strikt.

## 2. Skill-Pflicht-Matrix

**Verbindlich laut Constitution §12.** Jede UI-Implementation (Komponenten, Hover, Motion, Layout, Typo, Copy) triggert die passenden Skills. Nicht-Laden = Constitution-Verstoß.

| Task-Typ | Pflicht-Skills (vor dem Code) | Post-Build |
|---|---|---|
| **Neues Template / Section** | `taste-skill`, `emil-kowalski/emil-design-eng`, `frontend-design`, `web-design-guidelines`, `impeccable` | `web-quality-skills` + Puppeteer-Screenshot |
| **Motion / Hover / Scroll-Reveal** | `emil-kowalski/emil-design-eng` (Pflicht), `taste-skill` (Rhythmus) | Visual-Check reduced-motion |
| **Typografie / Spacing / Rhythmus** | `taste-skill`, `impeccable`, `frontend-design` | `web-design-guidelines` A11y-Audit |
| **Copy / CTAs / Hero-Text** | `landing-page-copywriter`, `taste-skill` (Typo-Hierarchie) | — |
| **SEO / Meta / JSON-LD** | `claude-seo`, `local-seo-skills` | — |
| **Cold-Mail / Outreach** | `cold-email`, `landing-page-copywriter` (Headlines) | — |
| **n8n-Workflow** | `n8n-skills` | — |
| **Lead-Research automatisiert** | `browser-use` | — |

**Invoke-Muster für `emil-design-eng`:** Immer mit konkreter Frage invoken („Anwenden auf NFR-C-09: welches Easing für 400ms Scroll-Reveal-Enter?"). Ohne Frage bleibt der Skill beim Opening-Block stehen — Wirkung null.

## 3. Log-Pflicht

Jede geladene Skill-Regel wird in `_logs/{session}-skill-invocations.md` dokumentiert. Format:

```
[HH:MM] skill: NAME geladen vor Task TASK-ID — Zitat/Kerninhalt der genutzten Regel
Quelle: <Dateipfad + Zeilennummer>
```

Ohne Log gilt der Task als nicht abgeschlossen. Das Log ist Pflicht-Deliverable, nicht Bonus.

## 4. Wortschatz-Brücke (Anti-Trigger-Gap)

Wenn eine Anforderung Animation, Motion, Hover, Reveal, Typo-Hierarchie oder Materiality betrifft, **nenne einen Skill-Begriff beim Namen**:

- ✅ „Scroll-Reveal gemäß `emil-design-eng` Motion-Durations (Marketing-Range 400ms, `--ease-out`)"
- ❌ „Elemente beim Scroll einblenden mit IntersectionObserver"

Beide sagen dasselbe, aber nur das erste triggert den Skill zuverlässig. Engineering-Sprache ist erlaubt, darf aber den Skill-Namen nicht verdrängen.

## 5. Fail-Safe-Regel (Progressive Enhancement)

UI-Code mit JS-Abhängigkeit (Reveal, Counter, Stagger, Sticky-Bar) folgt diesem Muster:

```css
/* Default: sichtbar, keine Animation. */
[data-reveal], [data-reveal-stagger] > * {
  opacity: 1;
  transform: none;
}

/* Hidden nur wenn JS erfolgreich initialisiert hat. */
html.js-reveal-ready [data-reveal],
html.js-reveal-ready [data-reveal-stagger] > * {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 400ms var(--ease-out), transform 400ms var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  html.js-reveal-ready [data-reveal],
  html.js-reveal-ready [data-reveal-stagger] > * {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

```js
// Flag NUR setzen wenn Observer existiert + Elemente da + Motion erlaubt.
if ('IntersectionObserver' in window
    && !matchMedia('(prefers-reduced-motion: reduce)').matches
    && document.querySelector('[data-reveal], [data-reveal-stagger]')) {
  document.documentElement.classList.add('js-reveal-ready');
  // ... Observer-Setup beobachtet BEIDE Attribute.
}
```

Wenn JS bricht, langsam lädt oder blockiert, bleibt Content sichtbar. Ohne diese Regel verschwinden Sektionen (siehe 1.4-Bug: 5 Sektionen leer trotz Lighthouse 100/100/96/69).

## 6. Modell-Wahl

Diese Instanz läuft als **Sonnet 4.6** für Implementation. Wenn du auf eine strategische Entscheidung stößt (Architektur, Scope, Design-Richtung), die du nicht aus Spec + Plan eindeutig ableiten kannst: **stoppen**, im Handover-Log Flag setzen, in Cowork (Opus) eskalieren. Nicht raten.

Aus Constitution §9.2:
- Specs, Pläne, Reviews → Opus in Cowork
- Code, HTML, CSS, Copy → Sonnet hier
- Klassifikation, Scoring → Haiku in n8n

## 7. Auto-Approve-Ampel (Terminal-Runs)

Bei langen Build-Läufen (Emin ggf. weg, `caffeinate -dimsu -t 7200`):

- 🟢 **Auto-Approve erlaubt:** File-Edits im Repo, `npm run`-Skripte, Git-Commits lokal, Test-Läufe, Lighthouse-Runs.
- 🟡 **Rückfrage im Log:** Design-Entscheidung, die die Spec/NFRs nicht eindeutig klärt. Nicht blockieren — Default annehmen, Flag setzen, weitermachen.
- 🔴 **Hard Stop:** Scope-Erweiterung, neue Dependency, neue Sektion, neue Schriftart, externes CDN, Constitution-Verstoß. Commit blocken, im Log begründen.

## 8. Repo-Konventionen (Kurzfassung)

- `main` ist deploybar. Feature-Arbeit in `feat/{thema}`.
- Conventional-Commit-Prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `perf:`.
- Claude-Code-Commits tragen Co-Author-Trailer.
- Slug-Konvention: `{branche}-{ort}-{kurzname}`.
- Secrets nie im Repo. `.env` ist gitignored.

Volle Details in `.specify/CONSTITUTION.md` §8.

## 9. Definition of Done (vor Tag/Push)

Bevor du einen Session-Run als „fertig" meldest:

1. Alle Skills aus §2 wurden geladen und im `_logs/*-skill-invocations.md` dokumentiert.
2. Lighthouse Mobile ≥ 90 auf allen 4 Pillars (Constitution §11).
3. Puppeteer-Screenshot pro Sektion zeigt: keine leere Sektion, keine abgeschnittenen Elemente.
4. `prefers-reduced-motion` schaltet alle Motion zuverlässig ab.
5. Mobile-Viewports 375/768/1440 px getestet — keine horizontale Scrollbar.
6. Accept-Kriterien aus dem Handover alle abgehakt.
7. Commit-Message listet Skills, die angewendet wurden.

Fehlt einer der Punkte: Task nicht fertig.

## 10. Eskalationspfad (wenn du steckst)

1. Skill nochmal lesen — meist steht die Antwort drin.
2. Handover-File prüfen — häufig wird die Frage dort direkt beantwortet.
3. Spec/Plan lesen — oft klärt der höhere Layer.
4. **Bleib nicht im Terminal raten.** Im Log-File Flag setzen („BLOCKER: <Frage>"), Emin eskaliert zu Cowork.

---

**Ende.** Diese Datei ist kompakt absichtlich. Details: Constitution §1–§12.
