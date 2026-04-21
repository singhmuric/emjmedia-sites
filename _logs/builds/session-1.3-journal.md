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

### Phase III — Bild-Pool (teilweise)
- T-030 ✓ `docs(images): briefing for kfz image pool` (`4a0f2f6`)
- T-031 ⏸ Blocker — siehe unten.
- T-032 ⏸ Blocker — siehe unten.
- T-033 ⏸ wartet auf T-031/T-032
- T-034 ⏸ wartet auf T-031/T-032

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

---

## Nächste Schritte (geplant)

Während die Bild-Frage geklärt wird, kann ich parallel arbeiten:
- Phase IV (CSS + Tokens) — Pflicht-Skills `impeccable` + `taste-skill`
- Phase V (Icons) — kein Skill nötig
- Phase VI (Copy + FAQ + Legal) — Pflicht-Skills `landing-page-copywriter` + `GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK`
- Phase VII (Partials) — Pflicht-Skills `impeccable` + `emil-kowalski`
