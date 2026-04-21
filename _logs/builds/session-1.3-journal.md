# Session 1.3 — Build-Journal

**Datum:** 2026-04-21
**Bearbeiter:** Sonnet 4.6 in Claude Code Terminal
**Spec:** `.specify/specs/kfz-template-v1/spec.md` (Draft)
**Plan:** `.specify/specs/kfz-template-v1/plan.md` (Freigegeben)
**Tasks:** `.specify/specs/kfz-template-v1/tasks.md` (50 Tasks, 11 Phasen)

---

## Fortschritt

### Phase I — Setup & Dependencies (✓ abgeschlossen)
- T-001 ✓ `chore: init node project with eta/tailwind/sharp/lighthouse/puppeteer` (`4d13932`)
- T-002 ✓ `chore: extend .gitignore for node build artifacts` (`7aa4d0c`)
- T-003 ✓ `chore: scaffold folder structure for kfz-template-v1` (`5705bc0`)

### Phase II — Render-Infrastruktur (✓ abgeschlossen)
- T-010 ✓ `feat(render): fnv-1a slug-hash variant resolver` (`65edf28`)
- T-011 ✓ `feat(render): lead json schema validator` (`16bc224`)
- T-012 ✓ `feat(render): json-ld builders for autorepair + faqpage` (`70e8df4`)
- T-013 ✓ `feat(render): image pool selection with per-variant pools` (`81b0cf9`)
- T-014 ✓ `feat(render): eta engine config + template helpers` (`93fadb5`)
- T-015 ✓ `feat(render): main render.mjs orchestrator` (`eb9aee1`)
- T-016 ✓ `feat(render): image conversion pipeline with sharp` (`2799d44`)
- T-017 ✓ `feat(dev): local subdomain emulator` (`680dcc9`)

### Phase III — Bild-Pool (Übergang Option 3)
- T-030 ✓ `docs(images): briefing for kfz image pool` (`4a0f2f6`)
- T-031+T-032 ✓ `feat(images): 35 placeholder originals + manifest` (`fc085ad`)
- T-033 ✓ kombiniert in `fc085ad`
- T-034 ✓ `chore(images): generate responsive derivates` (`1a258be`)

### Phase IV — CSS + Tokens (✓)
- T-040 ✓ `feat(css): tailwind config for kfz template` (`9498543`) + CONFLICTS.md C-01
- T-041 ✓ `feat(css): variant tokens for a/b/c` (`576c53a`)
- T-042 ✓ `feat(css): base reset + typography` (`a17d0e3`) — postcss tooling added
- T-043 ✓ `feat(css): shared component styles` (`94b1435`)
- T-044 ✓ `feat(fonts): self-host fraunces/inter/jetbrains-mono` (`adf68cc`)

### Phase V — Icons (✓)
- T-050 ✓ `feat(icons): 12 lucide-based service icons` (`522850c`)

### Phase VI — Copy + FAQ + Legal (✓)
- T-060 ✓ `feat(content): base faq for kfz template` (`163605c`)
- T-061 ✓ `feat(content): copy pool for kfz template` (`deb1282`)
- T-062 ✓ `feat(legal): impressum + datenschutz base templates` (`be96c27`)

### Phase VII — Partials (✓)
- T-070 ✓ `feat(template): layout shell + 14 partial stubs` (`dd53269`)
- T-071..T-082 ✓ je ein Commit pro Section
- T-083 ✓ `feat(template): jsonld blocks` (`cab8740`) — Eta `<%-` vs `<%~` fix
- T-084 ✓ `style(template): micro-interactions polish` (`3ba1d61`)

### Phase VIII — Erste Demo (in progress)
- T-090 ✓ `feat(demo): first render of kfz archetype` (`345a862`) — slug=kfz-demo, variant=c by hash
- T-091 ✓ structural smoke via dev-preview server: all routes 200, single H1, noindex meta present, title/meta/OG/Twitter populated, H1 contains Branche + Ort. **Visual viewport sweep (375/768/1440)** deferred to T-110 lighthouse runs in headless Chrome.
- T-092 — pending (next)

---

## Blocker / offene Fragen

### B-01 (Phase III T-031/T-032) — Bild-Pool-Akquise

**Was ist offen:** 25 KI-generierte Bilder + 10 Stock-Fotos müssen physisch ins Repo unter `_templates/images/kfz/src/` gelegt werden. Das ist gemäß User-Brief Fall (c) — externer Dienst nötig.

**Was ich vorbereitet habe:**
- `BRIEF.md` mit 35 nummerierten Slots, Variant-Hinweisen und Komposition-Notizen
- `image-pool.mjs` (T-013) liest ein MD-Tabellen-Manifest, kann gegen leeren Pool sauber fehlschlagen
- `convert-images.mjs` (T-016) verifiziert mit synthetischen 2000×1200-Placeholdern → 8 Derivate pro Original

**Optionen für den User:**
1. **Claude Design (Cowork)** für die 25 KI-Bilder, Unsplash/Pexels für die 10 Stock-Fotos — beste Qualität, aber 60–90 min Hand-Arbeit.
2. **Stable Diffusion / Midjourney** lokal/Cloud — schneller batch, etwas weniger Style-Kontrolle.
3. **Ich rendere mit synthetischen Placeholder-Bildern** (sharp synthetisiert farbige Rechtecke) und der Pool wird in Session 1.4 oder später echter befüllt — erlaubt T-090..T-101 jetzt durchzulaufen, aber Lighthouse-Performance auf echtem Hero-Bild bleibt unbestätigt.

**Empfehlung von Sonnet:** Option 3 als Übergang, damit Phase IV–VII jetzt durchgezogen werden können und die Pipeline ein End-to-End-Build sieht; vor T-101 (Push) auf echte Bilder umstellen.

---

## Spec-Anpassungs-Kandidaten für Session 1.4-Review

- **A-01:** `puppeteer@23.x` ist von npm als deprecated markiert (Empfehlung ≥24.15). Plan §11.1 listet `^23.0.0`. Vorschlag: Bump auf `^24` in nächster Plan-Iteration.
- **A-02:** Plan §2.1 listet `_templates/kfz-werkstatt/MANIFEST.md` als Pflicht-Datei, ist aber in Tasks-Liste nicht explizit zugeordnet. Wahrscheinlich Phase XI Abschluss-Task; offen halten.
- **A-03:** `impeccable`-Skill rejected die in Plan §4.3 + Plan §15 Punkt 4 von Emin freigegebenen Fonts (Fraunces/Inter/JetBrains Mono). Konflikt voll dokumentiert in `.specify/CONFLICTS.md` C-01. Plan gilt für 1.3, Skill für andere Aspekte (OKLCH/spacing/no-border-left/line-length-cap) angewendet.

## B-Blocker

- **B-02 (Phase IV CSS):** PostCSS + postcss-import als zusätzliche Dev-Deps eingeführt, weil Tailwind-CLI alleine `@import` nicht auflöst. `tw:build`-Script auf `postcss` umgestellt. Im Plan §11.1 nicht explizit, aber notwendig — sollte 1.4 als Plan-Patch nachgetragen werden.
- **B-03 (Phase VI Copy):** Plan §10 + Constitution §5.3 referenzieren `_Strategie/GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK.md`. Datei existiert nicht im Repo (vault location). Copy-Pool wurde mit PAS-Framework + Mittelstand-Heuristiken geschrieben; Psychologie-Verfeinerung in 1.4-Review oder bei Vault-Zugriff nachholbar.

---

## Nächste Schritte (geplant)

Während die Bild-Frage geklärt wird, kann ich parallel arbeiten:
- Phase IV (CSS + Tokens) — Pflicht-Skills `impeccable` + `taste-skill`
- Phase V (Icons) — kein Skill nötig
- Phase VI (Copy + FAQ + Legal) — Pflicht-Skills `landing-page-copywriter` + `GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK`
- Phase VII (Partials) — Pflicht-Skills `impeccable` + `emil-kowalski`
