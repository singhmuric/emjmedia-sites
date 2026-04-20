# EMJmedia — Project Constitution

**Version:** 1.1
**Stand:** 21.04.2026
**Gilt für:** Alle Agenten (Opus/Sonnet/Haiku), Menschen und Automationen, die an diesem Repo arbeiten.

Diese Constitution ist das oberste Gesetz des Projekts. Spec, Plan, Tasks und Implementation müssen sie einhalten. Abweichungen nur durch eine neue Constitution-Version (siehe §10 Governance).

---

## Präambel — Was wir bauen

EMJmedia betreibt eine **Website-Fabrik**: automatisiert generierte One-Page-Demos für deutsche KMU, die per Cold-Email an den Betrieb gehen. Wer sich meldet, wird Kunde; die Demo wird zur Live-Site. Der Stack ist schlank, die Qualität ist nicht verhandelbar. Jede Seite muss sich anfühlen, als hätte sie ein guter Mensch gebaut — weil das das einzige ist, was das Modell rechtfertigt.

**Kernziele:** 800–1.500 €+ pro Site, Lighthouse ≥ 90 auf allen Pillars, ~130 €/Mo Betriebskosten, erste zahlende Kunden bis Ende Mai 2026.

---

## §1 — Design-Standard

1.1 **Ästhetik-Anker:** Die vendored Skills `impeccable`, `emil-kowalski`, `taste-skill` und `landing-page-copywriter` sind der Maßstab für Layout, Typografie, Whitespace, Hierarchie. Bauende Agenten müssen den jeweils relevanten Skill-Prompt vor dem Code laden.

1.2 **Tech-Stack (verbindlich):** Plain HTML + CSS + vanilla JS, gestylt mit **Tailwind CSS** (Build-Zeit, kein CDN in Production — gepurgt in ein statisches CSS-File). Kein React, kein Astro, kein Next.js für One-Pages. Jede Seite ist ein Ordner unter `sites/onepages/{slug}/` mit `index.html`, einem generierten `styles.css` und optional `scripts.js`.

1.3 **Kein Framework-Kreep:** Wenn ein Agent ein Framework vorschlägt, lehnt Review ab. Ausnahme: `sites/clients/{slug}/` für Kunden, die nachweislich Dashboards/Portale brauchen — dort darf Astro oder Next.js eingesetzt werden, mit eigener Spec.

1.4 **Typografie:** System-Font-Stack oder **maximal zwei** selbst gehostete Webfonts pro Site (WOFF2, `font-display: swap`, im Repo als `sites/onepages/{slug}/fonts/`). Keine Google-Fonts-CDN-Einbindung (DSGVO — Entscheidung EuGH 20.01.2022, LG München I).

1.5 **Farben & Kontrast:** Jede Seite erfüllt WCAG 2.1 AA Kontrast (mind. 4.5:1 für Body-Text, 3:1 für Large-Text und UI). CTAs brauchen sichtbaren Focus-State (Outline, mind. 2 px, 3:1 Kontrast zum Hintergrund).

1.6 **Bildmaterial — Quellen-Policy:**
  - Erlaubt: lizenzfreie/gekaufte Stock-Fotos, KI-generierte Bilder (Szenen, Werkzeuge, Hintergründe, Objekte), kundeneigene Fotos.
  - Verboten: KI-generierte „Menschen als Testimonials", KI-generierte Fotos die echte Mitarbeiter/Kunden darstellen sollen, urheberrechtlich geschützte Bilder ohne Lizenz.
  - Pro Branche wird ein **Bild-Pool** einmalig angelegt (`_templates/images/{branche}/`, ~30–50 Bilder gemischt KI + Stock) und von allen Demos dieser Branche wiederverwendet.
  - Sobald ein Lead Kunde wird: Kundenfotos ersetzen Pool-Bilder (Flow in Session 4.1 Fragebogen).
  - Format: WebP oder AVIF. `<img>` mit expliziten `width/height` (CLS-Prävention) und sinnvollem `alt`. Hero-Bilder `fetchpriority="high"`, alle anderen `loading="lazy"`.

1.7 **Visuelle Referenzen:** Für jedes neue Branchen-Template liefert Opus in Session *.1 Claude-Design-Screenshots als Anker in die Spec, damit Sonnet die Ästhetik nicht drift.

1.8 **Responsive (mobile-first):** Jede Seite wird mobile-first gebaut. Pflicht-Test-Viewports vor Review: 375 px (iPhone SE), 768 px (iPad), 1440 px (Desktop). Keine horizontale Scrollbar in keinem Viewport. Touch-Targets ≥ 44×44 px. Navigation auf Mobile als Hamburger oder Bottom-Bar — niemals abgeschnittene Desktop-Nav.

---

## §2 — JavaScript-Policy (Progressive Enhancement)

2.1 **Grundsatz:** Alle kritischen Nutzerpfade (Navigation, Impressum/DSGVO lesen, CTA klicken, Formular absenden) müssen ohne JavaScript funktionieren.

2.2 **JS erlaubt für:** Mobile-Menu-Toggle, Smooth-Scroll, Lightbox/Gallery, Form-Validation-UX (zusätzlich zu Server/HTML-Validation), Accordion/Tab-Widgets.

2.3 **JS verboten für:** Rendering kritischer Inhalte (SSR/Static-HTML zwingend), Tracking vor Consent, dritte-Partei-Widgets ohne DSGVO-Prüfung.

2.4 **Budgets:** Gesamt-JS pro One-Page ≤ **30 kB** minified+gzipped. Kein externes JS-Framework. Wenn ein Agent Alpine.js oder HTMX einsetzt, explizit in der Spec begründen und unterm Budget bleiben.

2.5 **Animationen:** `prefers-reduced-motion` respektieren. Keine auto-playenden Carousels ohne Pause-Button. Scroll-Animationen nie Layout-blockierend.

---

## §3 — SEO-Standard

3.1 **On-Page (nicht verhandelbar):** Ein einziges `<h1>` pro Seite. Semantische HTML5-Tags (`<header>`, `<main>`, `<section>`, `<footer>`). Sinnvolle `<title>` (≤ 60 Zeichen) und `<meta name="description">` (≤ 160 Zeichen). Canonical-URL gesetzt. OpenGraph + Twitter-Cards für Share-Previews.

3.2 **Strukturierte Daten:** JSON-LD mit `LocalBusiness`-Schema auf jeder Kunden-Seite (Name, Adresse, Telefon, Öffnungszeiten, `geo`). Der Skill `local-seo-skills` ist Pflichtlektüre beim Bauen.

3.3 **Local-SEO:** Für jede Demo wird — sofern Daten vorhanden — die Branche + Ort klar in `<h1>`, `<title>` und dem ersten Absatz benannt. NAP-Konsistenz (Name/Adresse/Telefon) zwischen Site, Google Business Profile und Impressum.

3.4 **Sitemap + Robots:** Jede Site hat `sitemap.xml` und `robots.txt`. Demos können per Meta-Robots `noindex,nofollow` vor dem Kunden-Deal ausgeblendet werden — dann **vor** Go-Live entfernen.

3.5 **Claude-SEO-Skill:** Der vendored `claude-seo`-Skill ist für jede neue Seite beim Review zu konsultieren.

---

## §4 — Performance-Minima (Quality Gates)

4.1 **Lighthouse (Mobile, Slow 4G, Moto G4 Simulation):** Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90, SEO ≥ 90. Eine Site, die das nicht erreicht, wird nicht ausgeliefert.

4.2 **Core Web Vitals (75. Perzentil Mobile):** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1.

4.3 **Payload-Budgets:**
- HTML initial: ≤ 50 kB gzipped
- CSS total: ≤ 30 kB gzipped (Tailwind gepurgt)
- JS total: ≤ 30 kB gzipped
- Hero-Bild: ≤ 180 kB (WebP/AVIF)
- Gesamt-Page-Weight initial: ≤ 400 kB

4.4 **Messung:** Jeder Build generiert einen Lighthouse-Report in `_logs/lighthouse/{slug}-{timestamp}.json`. Die `web-quality-skills` (Chrome DevTools) leiten die Messung.

---

## §5 — Tone of Voice (Deutsch-Mittelstand)

5.1 **Sprachregister:** Sie-Form. Klar, konkret, handwerklich. Kein Marketing-Sprech, keine Anglizismen wo nicht nötig. "Werkstatt", "Betrieb", "Meister", "Angebot" — nicht "Solution", "Touchpoint", "Journey".

5.2 **Länge:** Hero-Claim ≤ 10 Wörter. Absätze ≤ 4 Zeilen. CTAs imperativ, ≤ 4 Wörter ("Termin anfragen", "Jetzt anrufen").

5.3 **Trust-Signale zuerst:** Telefonnummer klickbar und above-the-fold. Adresse, Öffnungszeiten, Meister-/Innungs-Siegel, Jahr der Gründung, lokale Referenzen. Der `landing-page-copywriter`-Skill und der Psychology-Anker aus `GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK.md` sind Pflichtlektüre.

5.4 **Keine Halbwahrheiten:** Wenn ein Detail über den Kunden unbekannt ist (Gründungsjahr, Anzahl Mitarbeiter, Zertifizierungen), bleibt es weg — nicht erfinden. Demo-Seiten sind als solche nicht kenntlich nötig, aber dürfen keine falschen Referenzen oder erfundene Testimonials enthalten.

---

## §6 — Rechtliche Pflichten

6.1 **Impressum:** Jede Seite hat `/impressum` mit den Pflichtangaben nach §5 TMG / §55 RStV. Bei Demos vor Kunden-Deal: Impressum von EMJmedia (Singh/Muric GbR, Kaltenkirchen) bis der Kunde seine eigenen Daten liefert.

6.2 **Datenschutz:** Jede Seite hat `/datenschutz` mit einer DSGVO-konformen Erklärung. Template im Repo unter `_templates/legal/datenschutz.html` pflegen.

6.3 **Cookies:** Policy ist **"notwendig ohne Consent, alles andere nicht"**:
  - Keine Tracker (kein Meta Pixel, kein GA4, kein Hotjar) auf Demo-Seiten.
  - Keine Google-Fonts-CDN, kein Google-Maps-Embed ohne Consent-Wrapper.
  - Nur technisch notwendige Cookies (Session, Consent selbst). Kein Cookie-Banner nötig, solange nur technisch notwendige Cookies gesetzt werden.
  - Wenn ein Kunde Tracking will (später in Phase 4/5): eigene Spec + Consent-Lösung (z.B. Klaro oder Cookiebot). Niemals heimlich einbauen.

6.4 **Formulare:** Kontaktformulare speichern nur was nötig ist, nennen Zweck + Rechtsgrundlage, haben Checkbox "Ich habe die Datenschutzerklärung gelesen".

6.5 **Externe Schriften/Assets:** Nur selbst gehostet (siehe §1.4). Jeder Agent, der ein externes CDN einbindet, verletzt die Constitution.

---

## §7 — Accessibility (WCAG 2.1 AA als Minimum)

7.1 **Semantisches HTML:** Ein `<h1>`, korrekte Heading-Hierarchie, Landmarks (`<main>`, `<nav>`, `<footer>`). Buttons sind `<button>`, Links sind `<a>`. Keine `<div onclick>`.

7.2 **Tastatur:** Jede interaktive Funktion ist keyboard-bedienbar. Fokus-Reihenfolge = Lese-Reihenfolge. Skip-Link zu `<main>`.

7.3 **Kontraste:** Siehe §1.5.

7.4 **Formulare:** Jedes Input hat `<label>`, Fehlermeldungen sind `aria-describedby`-verknüpft, Pflichtfelder sind nicht nur durch Farbe markiert.

7.5 **Bilder:** Alt-Texte inhaltstragend (nicht "Bild 1") oder `alt=""` bei rein dekorativen Bildern.

7.6 **Mess-Gate:** Lighthouse-Accessibility ≥ 90 + axe-Core-Check ohne Critical-Issues.

---

## §8 — Repo-Konventionen

8.1 **Struktur:**
```
sites/onepages/{slug}/      ← eine One-Page pro Ordner
sites/clients/{slug}/       ← aktive Kunden-Sites (eigene Spec erlaubt)
.specify/                   ← Specs + dieser Constitution
.claude/skills/             ← vendored Skills (eingefrorene Kopien)
_templates/                 ← Shared HTML/CSS-Bausteine, Legal-Templates
_logs/                      ← Lighthouse-Reports, Build-Protokolle
_outreach/                  ← Cold-Mail-Sequences, Target-Listen (nicht deploybar)
```

8.2 **Branches + Commits:** `main` ist deploybar. Feature-Arbeit in `feat/{thema}`-Branches, PR in main. Conventional-Commit-Prefixes (`feat:`, `fix:`, `chore:`, `docs:`). Claude-Code-generierte Commits werden als solche kenntlich (Co-Author-Trailer).

8.3 **Secrets:** Keine Keys/Tokens im Repo. `.env` ist gitignored. API-Keys liegen im VPS (`/opt/emjmedia-sites/.env`) oder in `_Strategie/secrets/` im Vault (nicht im Repo).

8.4 **Slug-Konvention:** `{branche}-{ort}-{kurzname}`, kleinbuchstabig, Bindestriche. Beispiel: `kfz-kaltenkirchen-mueller`.

---

## §9 — Build-Prozess + Modell-Split

9.1 **Spec-Kit-Pflicht:** Jede neue Branche / jedes neue Template durchläuft den Spec-Kit-Flow: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`. Abkürzungen sind nicht zulässig.

9.2 **Modell-Zuordnung (verbindlich):**
  - Specs, Pläne, Reviews, strategische Entscheidungen → **Opus 4.7** in Cowork
  - Implementation (HTML/CSS/Copy), Refactors, Bugfixes → **Sonnet 4.6** in Claude Code (lokal oder Headless VPS)
  - Klassifikation, Lead-Scoring, Mail-Routing → **Haiku** in n8n

9.3 **Review-Gate:** Vor jedem Merge in `main` prüft Opus die Diffs gegen diese Constitution. Findet er Verstöße → zurück an Sonnet mit konkretem Fix-Auftrag.

9.4 **Skills-First:** Bevor Sonnet Code schreibt, lädt er die für die Aufgabe relevanten Skill-Prompts aus `.claude/skills/`. Liste der Pflicht-Skills pro Aufgabentyp steht im jeweiligen Plan.

---

## §10 — Governance

10.1 **Änderungen:** Diese Constitution wird nur über einen expliziten PR mit Titel `constitution: vX.Y — {grund}` geändert. PR-Beschreibung listet jede geänderte Klausel und begründet sie.

10.2 **Versionierung:** Major (`2.0`) bei Prinzipienwechsel, Minor (`1.1`) bei Ergänzungen, Patch (`1.0.1`) bei Klarstellungen ohne inhaltliche Änderung.

10.3 **Konflikt-Auflösung:** Widerspricht ein Skill oder ein externes Dokument dieser Constitution, gilt die Constitution. Der Konflikt wird in `.specify/CONFLICTS.md` protokolliert und im nächsten Session-Review behandelt.

10.4 **Single Source of Truth:** Diese Datei (`.specify/CONSTITUTION.md`) ist die einzige autoritative Quelle für Projekt-Prinzipien. `EMJmedia/BIBEL.md` im Vault fasst Strategie zusammen — bei Widerspruch zu operativen Regeln gewinnt die Constitution.

---

## §11 — Non-Negotiables (Zusammenfassung)

Jede Seite, die ausgeliefert wird, erfüllt ausnahmslos:

- [ ] Lighthouse Mobile ≥ 90 auf allen 4 Pillars
- [ ] LCP ≤ 2,5 s / INP ≤ 200 ms / CLS ≤ 0,1
- [ ] WCAG 2.1 AA (Kontraste, Keyboard, Alt-Texte, Labels)
- [ ] Ein `<h1>`, semantisches HTML, JSON-LD LocalBusiness
- [ ] Impressum + Datenschutz erreichbar, DSGVO-konform
- [ ] Keine externen CDNs für Fonts/Scripts, keine Tracker vor Consent
- [ ] Payload initial ≤ 400 kB, JS ≤ 30 kB
- [ ] Sie-Form, Mittelstand-Ton, Telefonnummer klickbar above-the-fold
- [ ] Getestet auf 375 px / 768 px / 1440 px ohne horizontale Scrollbar
- [ ] Bilder aus Branchen-Pool, keine erfundenen Menschen/Testimonials

---

## Änderungshistorie

- **1.1 — 21.04.2026** — Präzisierung §1.6 (Bild-Quellen-Policy + Branchen-Pool-Modell + Kundenfoto-Übergabe in 4.1), neuer §1.8 (Responsive mobile-first, Test-Viewports 375/768/1440 px, Touch-Target ≥ 44 px), Checkliste §11 um 2 Punkte ergänzt.
- **1.0 — 21.04.2026** — Initial. Phase 0 Session 0.2. Stack plain HTML/Tailwind, Progressive Enhancement, WCAG AA, minimaler Legal-Scope.
