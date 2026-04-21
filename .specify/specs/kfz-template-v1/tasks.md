# Tasks — KFZ-Branchen-Template v1

**Spec:** `.specify/specs/kfz-template-v1/spec.md` (Draft, 21.04.2026)
**Plan:** `.specify/specs/kfz-template-v1/plan.md` (Freigegeben, 21.04.2026)
**Stand:** 21.04.2026
**Autor:** Opus 4.7 in Cowork (Session 1.2 abschließend)
**Bearbeitung:** Sonnet 4.6 in Claude Code Terminal (Session 1.3)

Diese Task-Liste ist ein linearer Umsetzungs-Pfad vom leeren Template-Ordner bis zur ersten gerenderten Demo-Seite (Archetyp-Fixture). Jede Task ist in sich abgeschlossen, hat ein Acceptance-Signal, und ihre Dependencies sind explizit.

**Arbeitsweise für Sonnet:**
1. Vor jeder Phase die Pflicht-Skills aus der Phasen-Kopfzeile laden (Constitution §9.4).
2. Tasks in Reihenfolge abarbeiten. Nicht überspringen — die Dependencies sind echt.
3. Nach jeder Task: Git-Commit mit `Conventional-Commit`-Präfix. Bei größeren Tasks pro Subtask einen Commit.
4. Wenn ein Blocker auftaucht: kurz in `_logs/builds/session-1.3-journal.md` notieren, dann weiter zur nächsten unabhängigen Task oder zurück an Cowork-Review.
5. Am Ende jeder Phase: das Phasen-Acceptance-Signal prüfen.

Gesamt-Budget Session 1.3: ~90 Minuten laut Fabrik-Plan v2 (wird beim ersten Durchlauf länger dauern — das ist erwartet).

---

## Phase I — Setup & Dependencies

**Pflicht-Skills:** keine (reine Infrastruktur).

### T-001 — Node-Projekt initialisieren
- `package.json` im Repo-Root anlegen (`"type": "module"`).
- `package-lock.json` wird von `npm install` erzeugt.
- Dependencies: `eta@^3.4`, `tailwindcss@^3.4`, `sharp@^0.33`, `lighthouse@^12`, `puppeteer@^23`.
- Dev-Scripts laut Plan §11.1 (`render`, `render:demo`, `dev`, `tw:build`, `images:convert`, `lighthouse`, `validate`).
- **Acceptance:** `npm install` läuft fehlerfrei, `node --version` und dependencies in `node_modules/` vorhanden.
- **Commit:** `chore: init node project with eta/tailwind/sharp/lighthouse/puppeteer`.

### T-002 — .gitignore erweitern
- `node_modules/`, `_logs/builds/`, `_logs/lighthouse/`, `.DS_Store`, `.env` hinzufügen (falls nicht schon drin).
- **Acceptance:** `git status` zeigt keine Fremd-Dateien nach `npm install`.
- **Commit:** `chore: extend .gitignore for node build artifacts`.

### T-003 — Ordner-Skelett anlegen (leer)
Erstelle die Ordner aus Plan §2.1, alle mit `.gitkeep` zum Einchecken:
- `_templates/kfz-werkstatt/{partials,schema,legal,styles,icons,fixtures}/`
- `_templates/images/kfz/src/`
- `scripts/lib/`
- `_logs/builds/`
- **Acceptance:** `tree _templates scripts _logs` matched Plan §2.1.
- **Commit:** `chore: scaffold folder structure for kfz-template-v1`.

---

## Phase II — Render-Infrastruktur (Node-Scripts)

**Pflicht-Skills:** keine.

### T-010 — `scripts/lib/variant.mjs`
- FNV-1a 32-bit Hash aus Plan §5.2 implementieren.
- Export: `variantFromSlug(slug: string): 'a' | 'b' | 'c'` + optionaler Override aus `data.designvariante`.
- Unit-Selftest am Dateiende unter `if (import.meta.url === …)`.
- **Acceptance:** Selftest druckt für 10 verschiedene Slugs A/B/C annähernd 1/3 : 1/3 : 1/3.
- **Commit:** `feat(render): fnv-1a slug-hash variant resolver`.

### T-011 — `scripts/lib/validate-lead.mjs`
- Validator für das Lead-JSON-Schema aus Plan §6.1.
- Prüft Pflichtfelder, Regex für Slug/Telefon/PLZ, Enum-Werte, Ranges.
- Export: `validateLead(lead): { ok: boolean, errors: string[] }`.
- **Acceptance:** Valides Archetyp-Fixture (T-030) besteht, verfälschte Variante (z. B. PLZ "1234") wird abgelehnt.
- **Commit:** `feat(render): lead json schema validator`.

### T-012 — `scripts/lib/schema.mjs`
- Zwei Builder: `buildAutoRepairJsonLd(lead)` und `buildFaqPageJsonLd(faqItems)`.
- Konditionale Logik (Plan §7.1): fehlt ein Feld → kommt nicht ins Output-JSON (nicht `null` reinschreiben).
- Export: Funktionen + `pretty(obj)` Helper.
- **Acceptance:** Output-JSON wird durch Google Rich Results Test validator bestätigt (manuell gegen Fixture-Daten prüfen).
- **Commit:** `feat(render): json-ld builders for autorepair + faqpage`.

### T-013 — `scripts/lib/image-pool.mjs`
- Liest `_templates/images/kfz/MANIFEST.md` (T-040) → baut internes Index-Objekt.
- Export: `selectImages(slug, variant): { hero, werkstattInnen, werkstattAussen, details[] }` — deterministisch per Slug-Hash, aber mit anderem Salt als Variant-Hash.
- Fallback: Wenn Manifest leer → Fehlerabbruch mit lesbarer Meldung.
- **Acceptance:** Zwei unterschiedliche Slugs bekommen reproduzierbar unterschiedliche Hero-Bilder derselben Variante.
- **Commit:** `feat(render): image pool selection with per-variant pools`.

### T-014 — `scripts/lib/eta.mjs`
- Eta-Instanz konfigurieren: Views-Pfad, Cache, Partial-Loading.
- Helper registrieren: `formatTel(e164, display)`, `formatOeffnungszeiten(oz)`, `if` / `each`-Wrappers falls benötigt, `safeInclude(partial, data)`.
- **Acceptance:** Lädt `layout.eta` ohne Runtime-Error, rendert ein Minimal-Partial erfolgreich.
- **Commit:** `feat(render): eta engine config + template helpers`.

### T-015 — `scripts/render.mjs`
- Haupt-Generator laut Plan §3.3. CLI-Parsing (`--lead path`, `--slug`, `--fixture path`, `--validate-only`).
- Orchestriert: validate → variant → image → schema → eta render → write files → build-log.
- Output nach `sites/onepages/{slug}/` (index.html, impressum.html, datenschutz.html, styles.css, robots.txt, sitemap.xml, assets/).
- Build-Log nach `_logs/builds/{slug}-{ts}.json` (Variant, Bild-IDs, fehlende Optionals).
- Exit-Codes: 0 success / 1 validation-error / 2 render-error.
- **Acceptance:** `node scripts/render.mjs --validate-only --fixture _templates/kfz-werkstatt/fixtures/archetyp.json` → Exit 0 + Log-Zeile „Validation ok".
- **Commit:** `feat(render): main render.mjs orchestrator`.

### T-016 — `scripts/convert-images.mjs`
- Liest `_templates/images/kfz/src/*` → konvertiert zu 4 Breiten (320/768/1200/1920 px) als WebP + AVIF mit `sharp`.
- Output: `_templates/images/kfz/{name}-{width}.webp` / `.avif`.
- Überspringt Dateien, deren Derivate schon aktueller sind als Original.
- **Acceptance:** Einmal laufen lassen gegen zwei Platzhalter-Originale → jeweils 8 Derivate.
- **Commit:** `feat(render): image conversion pipeline with sharp`.

### T-017 — `scripts/dev-preview.mjs`
- Kleiner HTTP-Server (Node `http` oder `express`) auf `localhost:4000`.
- Serviert `sites/onepages/` mit Subdomain-Emulation (Host-Header → Unterordner).
- **Acceptance:** `npm run dev` → `curl http://localhost:4000/kfz-demo/` liefert gerendertes HTML.
- **Commit:** `feat(dev): local subdomain emulator`.

---

## Phase III — Bild-Pool aufbauen

**Pflicht-Skills:** `browser-use` (falls Bilder mit Claude Design oder ähnlichem ausgespielt werden).

### T-030 — Bild-Pool-Brief schreiben
- In `_templates/images/kfz/BRIEF.md`: 35 Motiv-Slots aus Spec §9.1 + 9.2 als Checkliste. Pro Slot: Größe, Stil-Note, gewünschter Variant-Pool (A/B/C/neutral).
- **Acceptance:** 35 nummerierte Einträge mit Zielen.
- **Commit:** `docs(images): briefing for kfz image pool`.

### T-031 — KI-Bilder generieren (25 Stück)
- Per Claude Design oder Stable Diffusion / Midjourney-Account.
- Keine erkennbaren Gesichter. Werkstatt-Setting. Deutsche Mittelstands-Ästhetik.
- Speicher-Ort: `_templates/images/kfz/src/ki-{nn}-{motiv}.jpg` (Original, hohe Auflösung).
- **Acceptance:** 25 Dateien im `src/`-Ordner, in BRIEF.md abgehakt.
- **Commit:** `feat(images): 25 ai-generated base images for kfz pool`.

### T-032 — Stock-Fotos lizenzieren (10 Stück)
- Quellen: Unsplash (CC0) / Pexels / Pixabay.
- Dokumentation der Lizenz-URL in T-033.
- Speicher: `_templates/images/kfz/src/stock-{nn}-{motiv}.jpg`.
- **Acceptance:** 10 Dateien + Lizenz-Nachweise.
- **Commit:** `feat(images): 10 stock photos for kfz pool`.

### T-033 — `MANIFEST.md` schreiben
- Pro Bild eine Zeile: Dateiname, Quelle, Lizenz, Motiv-Tag, Variant-Zuordnung, alt-Text-Vorschlag, Datum.
- **Acceptance:** Alle 35 Bilder gelistet, image-pool.mjs (T-013) kann laden.
- **Commit:** `docs(images): manifest for kfz pool`.

### T-034 — Bild-Derivate generieren
- `npm run images:convert` ausführen.
- **Acceptance:** `_templates/images/kfz/*-{320,768,1200,1920}.{webp,avif}` vorhanden.
- **Commit:** `chore(images): generate responsive derivates`.

---

## Phase IV — CSS + Design-Tokens

**Pflicht-Skills:** `impeccable`, `taste-skill`.

Sonnet lädt beide Skill-Prompts **vor** dem Code-Schreiben.

### T-040 — `tailwind.config.cjs`
- Content-Globs auf `_templates/kfz-werkstatt/**/*.eta` + `sites/onepages/**/*.html`.
- Theme-Extensions minimal halten — das meiste kommt aus Custom-Props.
- Safelist für Varianten-agnostische Utilities (z. B. `data-variant`-Selektoren).
- **Acceptance:** `npx tailwindcss -c ... -i styles/entry.css -o /tmp/test.css` läuft fehlerfrei.
- **Commit:** `feat(css): tailwind config for kfz template`.

### T-041 — `styles/tokens.css`
- Default-Tokens auf `:root` (konservative Basis).
- Variant-Überschreibungen auf `[data-variant="a"]`, `[data-variant="b"]`, `[data-variant="c"]` — Farben, Fonts, Radien, Shadows laut Plan §4.1.
- **Acceptance:** Datei lädt, alle Tokens definiert für alle drei Varianten.
- **Commit:** `feat(css): variant tokens for a/b/c`.

### T-042 — `styles/base.css`
- Reset (modern-normalize oder Eigenbau: box-sizing, margin-reset, img-display-block, form-inherit-font).
- Basis-Typografie: `html { font-family: var(--font-body); color: var(--color-fg); background: var(--color-bg); }`.
- Fokus-Outlines: 2 px Akzentfarbe auf `:focus-visible`.
- Skip-Link-Styles.
- **Acceptance:** Gerenderte Seite hat saubere Defaults ohne browser-spezifische Kaprizen.
- **Commit:** `feat(css): base reset + typography`.

### T-043 — `styles/components.css`
- Section-weite Regeln: `.section`, `.container` (max-width + padding), `.card`, `.btn-primary`, `.btn-secondary`, `.faq-item summary/details`, `.form-field`.
- Jede Komponente respektiert Tokens aus T-041.
- **Acceptance:** Komponenten rendern in allen drei Varianten sichtbar unterschiedlich.
- **Commit:** `feat(css): shared component styles`.

### T-044 — Fonts einbinden
- WOFF2-Dateien in `_templates/kfz-werkstatt/fonts/` ablegen (Fraunces + Inter + JetBrains Mono, jeweils Variable oder benötigte Weights).
- `@font-face`-Deklarationen in `base.css`, Preload-Link in `layout.eta` für Hero-Font.
- Lizenz-Notiz in `fonts/LICENSES.md`.
- **Acceptance:** In DevTools → Network Tab sind nur lokale Font-Requests, keine googleapis.com-Calls.
- **Commit:** `feat(fonts): self-host fraunces/inter/jetbrains-mono`.

---

## Phase V — Icons

**Pflicht-Skills:** keine.

### T-050 — 12 Icons als inline-SVG bereitstellen
- Quelle: Lucide Icons (MIT) — einzelne SVGs aus dem Repo laden, monochrom-Stil, 24×24 viewbox.
- Liste: inspektion, tuev, bremsen, oelwechsel, reifen, klima, unfall, achse, e-auto, hol-bring, ersatzwagen, meister-wappen.
- Als einzelne `.svg`-Dateien in `_templates/kfz-werkstatt/icons/`, Farbe per `currentColor`.
- **Acceptance:** Alle 12 Dateien vorhanden, beim Inline-Einbau nehmen sie Akzentfarbe an.
- **Commit:** `feat(icons): 12 lucide-based service icons`.

---

## Phase VI — Copy-Pool + FAQ-Basis

**Pflicht-Skills:** `landing-page-copywriter`, `GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK`.

Beide Skills vor dem Schreiben laden.

### T-060 — `faq-base.json`
- 7 Q&A aus Spec FR-111. Antworten 2–4 Sätze, konkret, ohne erfundene Preise.
- Schlüssel stabil (z. B. `tuev_ablauf`, `marken_alle`, `kva`) — damit `faq_overrides` (Lead-JSON) gezielt einzelne Fragen ersetzen kann.
- **Acceptance:** 7 Einträge, jede Antwort ≤ 4 Sätze.
- **Commit:** `feat(content): base faq for kfz template`.

### T-061 — `copy-pool.json`
- Arrays für:
  - `hero_h1_patterns[]` (3 Muster, Platzhalter `{firmenname}`, `{ort}`, `{gruendungsjahr}`, `{kernleistung}`)
  - `hero_promise[]` (5 Varianten)
  - `cta_band_primary[]` (3 Varianten pro Variante A/B/C, insg. 9)
  - `meta_descriptions[]` (5 Patterns ≤ 155 Zeichen)
  - `leistungs_beschreibungen{}` (je Leistung 1 Zeile ≤ 12 Wörter, laut Spec FR-033)
  - `ablauf_standard[]` (4 Schritte aus Spec FR-070)
- **Acceptance:** Alle Felder, keine Anglizismen, Sie-Form.
- **Commit:** `feat(content): copy pool for kfz template`.

### T-062 — Legal-Templates
- `_templates/legal/impressum-emjmedia.md` (Demo-Phase): Singh/Muric GbR, Kaltenkirchen.
- `_templates/legal/datenschutz-basis.md`: DSGVO-konformer Basistext, Platzhalter für Kunden-Daten.
- **Acceptance:** Beide Texte existieren, Impressum deckt §5 TMG ab.
- **Commit:** `feat(legal): impressum + datenschutz base templates`.

---

## Phase VII — Template-Partials (Eta)

**Pflicht-Skills:** `impeccable`, `emil-kowalski` (für Micro-Interactions am Ende der Phase).

### T-070 — `layout.eta` (Hülle)
- `<!doctype html>` mit `data-variant` auf `<html>`, `<head>` mit allen Meta + JSON-LD-Einbindungen, `<body>` mit `<%~ include('./partials/header') %>` usw.
- Security-Header via `vercel.json` (schon gesetzt in 0.4).
- **Acceptance:** Skelett rendert mit Dummy-Daten ohne Validation-Error.
- **Commit:** `feat(template): layout shell`.

### T-071 — `partials/header.eta`
- Sticky Header laut FR-010 bis FR-013. Mobile-Hamburger mit `<details>`-Trick (funktioniert ohne JS).
- **Acceptance:** In allen drei Viewports getestet, kein horizontaler Scroll.
- **Commit:** `feat(template): sticky header partial`.

### T-072 — `partials/hero.eta`
- H1-Pattern aus Copy-Pool, Versprechen, 2 CTAs, Vertrauens-Zeile, Hero-Bild mit `srcset`.
- Fallback-Logik: fehlende Trust-Signale = weglassen, nicht leer-füllen.
- **Acceptance:** Above-the-fold auf 375 px getestet (H1 + Versprechen + Primär-CTA sichtbar).
- **Commit:** `feat(template): hero partial`.

### T-073 — `partials/leistungen.eta`
- Loop über `lead.leistungs_liste`, Karten aus Icon + Titel + 1-Zeilen-Copy.
- 3/2/1-Spalten-Grid.
- **Acceptance:** Mit 6 und mit 9 Leistungen getestet — Layout bleibt stabil.
- **Commit:** `feat(template): leistungen partial`.

### T-074 — `partials/trust-block.eta`
- Konditionale Badges aus `lead.trust_signale`, Google-Rating, Gründungsjahr.
- Kein Badge ohne Datenbasis.
- **Acceptance:** Mit komplettem Trust-Signale-Objekt + mit allen Signalen `null` getestet — Section verhält sich laut Spec FR-041.
- **Commit:** `feat(template): trust block partial`.

### T-075 — `partials/cta-band.eta`
- Vollbreites Band, ein CTA, Variant-spezifischer Text aus Copy-Pool.
- **Acceptance:** Pro Variante eigener Text, Kontrast WCAG AA.
- **Commit:** `feat(template): cta band partial`.

### T-076 — `partials/ueber-uns.eta`
- 1 Absatz (max. 80 Wörter) + Werkstatt-Bild. Fallback ohne Meister-Name.
- **Acceptance:** Beide Fälle getestet.
- **Commit:** `feat(template): ueber-uns partial`.

### T-077 — `partials/ablauf.eta`
- 4 Schritte als Zeitachse oder Karten-Reihe.
- **Acceptance:** Mobile = vertikale Stapel, Desktop = horizontal.
- **Commit:** `feat(template): ablauf partial`.

### T-078 — `partials/kundenstimmen.eta`
- Loop über `lead.google_review_zitate`. Wenn Array leer oder fehlt → **ganze Section nicht rendern** (Spec FR-081).
- **Acceptance:** Mit 3, 5 und 0 Zitaten getestet.
- **Commit:** `feat(template): kundenstimmen partial`.

### T-079 — `partials/oeffnungszeiten.eta`
- Tabelle aus Wochentagen, geschlossene Tage explizit markiert, statisches Karten-Bild (aus Pool), Maps-Link als `<a>`.
- **Acceptance:** Kein iframe, kein externer CDN-Call.
- **Commit:** `feat(template): oeffnungszeiten partial`.

### T-080 — `partials/kontakt.eta`
- Formular mit HTML-Validation, Honeypot, WhatsApp-Fallback (konditional).
- Action auf `https://n8n.emj-media.de/webhook/kfz-kontakt`, hidden inputs für `slug` + `firmenname`.
- **Acceptance:** Formular sendbar auch ohne JS, `required`-Attribute greifen.
- **Commit:** `feat(template): kontakt partial with n8n webhook target`.

### T-081 — `partials/faq.eta`
- Loop über FAQ-Items (base + overrides), `<details>`/`<summary>`.
- **Acceptance:** Funktioniert mit JS aus.
- **Commit:** `feat(template): faq partial`.

### T-082 — `partials/footer.eta`
- NAP kompakt, Links zu Impressum/Datenschutz, Copyright-Jahr.
- **Acceptance:** Keine Social-Icons in v1.
- **Commit:** `feat(template): footer partial`.

### T-083 — `schema/autorepair.eta` + `schema/faqpage.eta`
- JSON-LD-Blöcke, die aus den Schema-Buildern in `scripts/lib/schema.mjs` gespeist werden.
- **Acceptance:** Google Rich Results Test validiert beide Schemata gegen Archetyp-Rendering.
- **Commit:** `feat(template): jsonld blocks`.

### T-084 — Micro-Interactions polieren
- `emil-kowalski`-Skill laden. Fokus-States, Hover-Transitions, Button-Press-Feedback, sanfte Scroll-Animationen (mit `prefers-reduced-motion`-Respekt).
- **Acceptance:** Keyboard-Tab durchquert die Seite flüssig, kein Flackern.
- **Commit:** `style(template): micro-interactions polish`.

---

## Phase VIII — Erste Demo rendern

**Pflicht-Skills:** `claude-seo`, `local-seo-skills` (für SEO-Feinschliff nach erstem Build).

### T-090 — Archetyp-Demo rendern
- `npm run render:demo` → `sites/onepages/kfz-demo/` wird erzeugt.
- Variant wird aus Slug `kfz-demo` deterministisch bestimmt.
- **Acceptance:** Datei-Output komplett, Build-Log ohne Fehler.
- **Commit:** `feat(demo): first render of kfz archetype`.

### T-091 — Lokaler Dev-Test
- `npm run dev`, Seite auf `http://localhost:4000/kfz-demo/` im Browser öffnen.
- Alle drei Viewports (375/768/1440) manuell durchklicken.
- **Acceptance:** Keine Layout-Brüche, keine Konsolen-Fehler, Formular-Honeypot versteckt.
- **Commit:** (keine Code-Änderung, nur Bestätigung im Journal).

### T-092 — SEO-Check
- `claude-seo`-Skill + `local-seo-skills` laden.
- Title/Meta/H1/JSON-LD/OG/Sitemap/Robots-Meta gegen Checkliste prüfen.
- **Acceptance:** Alle §10.4-Punkte der Spec abgehakt.
- **Commit:** `docs(seo): checklist results logged`.

---

## Phase IX — Alle drei Varianten + Push

**Pflicht-Skills:** `taste-skill` (Varianten-Vergleich), `web-quality-skills` (nächste Phase).

### T-100 — Pro Variante eine Demo rendern
- `kfz-demo-a`, `kfz-demo-b`, `kfz-demo-c` mit `--slug`-Overrides oder Fixture-Varianten.
- **Acceptance:** Drei Ordner in `sites/onepages/`, sichtbar verschieden.
- **Commit:** `feat(demo): render all three variants`.

### T-101 — Git-Push + Vercel-Deploy
- `git push` → Vercel builds und deployt.
- Verifikation: `kfz-demo-a.emj-media.de`, `-b`, `-c` sind live.
- **Acceptance:** Alle drei Subdomains antworten mit 200 + rendern die erwartete Variant.
- **Commit:** (Push ist der Commit; hier nur Verifikation).

---

## Phase X — Quality-Gates (Acceptance-Criteria der Spec)

**Pflicht-Skills:** `web-quality-skills`.

### T-110 — Lighthouse-CI pro Variante
- `npm run lighthouse -- --url https://kfz-demo-a.emj-media.de` × 3.
- Reports unter `_logs/lighthouse/`.
- **Acceptance:** Alle 4 Pillars ≥ 90 pro Variante (Spec §10.3).
- **Commit:** `test(lighthouse): reports for all three variants`.

### T-111 — Accessibility-Scan
- axe-Core gegen jede Variante (puppeteer-skript oder manuell via DevTools).
- **Acceptance:** Keine Critical-Issues.
- **Commit:** `test(a11y): axe results`.

### T-112 — Payload-Budget-Check
- DevTools Network Tab: initial transferred ≤ 400 kB.
- **Acceptance:** Laut Spec §10.3 erfüllt. Wenn nicht → Task T-113 anhängen und iterieren.

### T-113 — Acceptance-Criteria-Checkliste (Spec §10)
- Jeden Punkt aus §10.1–§10.5 manuell prüfen oder scripted.
- Ergebnisse in `_logs/builds/session-1.3-acceptance.md`.
- **Acceptance:** Alle Haken gesetzt.
- **Commit:** `docs(qa): acceptance criteria checklist results`.

---

## Phase XI — Abschluss

### T-120 — Template-Version taggen
- `git tag kfz-v1.0 && git push --tags`.
- **Acceptance:** Tag auf GitHub sichtbar.

### T-121 — Session-1.3-Journal finalisieren
- `_logs/builds/session-1.3-journal.md`: was lief, wo Hürden, welche Spec-Punkte angepasst wurden (Spec-Changelog-Kandidaten für 1.4-Review).
- **Acceptance:** Datei liegt, 1–2 Seiten.
- **Commit:** `docs(session-1.3): build journal`.

### T-122 — Übergang zu Session 1.4
- Cowork-Session 1.4 (Opus) reviewt gegen Spec + Plan + Lighthouse-Reports.
- Findet Opus Verstöße → zurück an Sonnet als Fix-Task.
- Iteration bis Review grün.

---

## Abhängigkeits-Graph (wichtigste Kanten)

```
T-001 → T-002 → T-003 → alle weiteren
T-003 → T-010..T-017 (lib + render)
T-003 → T-030..T-034 (image pool)  [parallel zu lib]
T-040 → T-041 → T-042 → T-043 (CSS)
T-044 → (blockiert nichts, aber vor T-070 sinnvoll)
T-050 (Icons) → T-073 (leistungen)
T-060 + T-061 → T-070..T-084 (partials)
T-083 benötigt T-012 (schema builders)
T-090 benötigt alles davor
T-110..T-113 benötigen T-101 (deployt)
```

Sonnet kann Phase II und Phase III **parallel** laufen (Bild-Pool-Aufbau blockiert nicht den Render-Code). Phase VII benötigt IV + V + VI.

---

## Was absichtlich NICHT in Session 1.3 ist

- Ad-hoc-Optimierungen, die aus dem Live-Test auffallen — landen als Spec-Änderungsvorschlag, nicht als direkter Fix (Constitution §9.1 Spec-Kit-Flow).
- Lead-Pipeline (Phase 2) — erst Sessions 2.1–2.3.
- Kunden-Fragebogen-Anbindung — erst Session 4.1.
- Zweites Branchen-Template — erst Phase 5.
- Tracking, Analytics, Cookie-Banner — in v1 nicht vorgesehen (Constitution §6.3).

---

## Abschluss-Signal Session 1.3

Session 1.3 gilt als abgeschlossen, wenn:
1. `git tag kfz-v1.0` existiert
2. `_logs/builds/session-1.3-journal.md` geschrieben ist
3. Alle drei Varianten auf `*.emj-media.de` live sind
4. Alle vier Lighthouse-Pillars ≥ 90 für jede Variante
5. Ein Cowork-Hand-off-Signal an Opus geht: „bereit für Session 1.4-Review"

---

## Änderungshistorie

- **21.04.2026 (Session 1.2, nach Plan-Freigabe):** Initial. Opus in Cowork. 11 Phasen, ~50 Tasks, lineare Dependencies, Skills-First, Acceptance-Signale pro Task. Bereit für Session 1.3 in Claude Code Terminal.
