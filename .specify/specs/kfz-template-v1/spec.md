# Spec — KFZ-Branchen-Template v1

**Slug:** `kfz-template-v1`
**Branche:** KFZ-Werkstatt (freie Werkstatt, Meisterbetrieb, kein Vertragshändler)
**Stand:** 21.04.2026
**Autor:** Opus 4.7 in Cowork (Session 1.1)
**Status:** Draft — wartet auf Freigabe Emin
**Constitution-Version:** v1.1 (21.04.2026)

Diese Spec ist das Fundament für alle KFZ-One-Pages der Fabrik. Sie beschreibt, **was** jede KFZ-Demo leisten muss und wie der Inhalt aussieht — nicht, wie der Code strukturiert ist (das ist Aufgabe des `plan.md` in Session 1.2).

---

## 1. Kontext + Scope

### 1.1 Was wird gebaut
Ein wiederverwendbares Template, aus dem pro KFZ-Lead automatisiert eine One-Page-Demo gerendert wird (Subdomain `{slug}.emj-media.de`). Die Demo liegt dem Cold-Mail-Outreach bei und dient als sichtbarer Gegenwert vor dem Deal. Wer sich meldet, wird Kunde, und die Demo wird mit Kundendaten zur Live-Site ausgebaut.

### 1.2 Scope dieser Spec
- Ein HTML-Skelett, identischer Content-Aufbau
- **Drei visuelle Varianten** via `taste-skill` Design-Token (Variante A/B/C — siehe §6)
- Vollständig lokalisierbar auf **jeden deutschen Ort** (Sprache: Deutsch, Sie-Form, keine Regional-Dialekte)
- Zielgruppen-Betrieb: **freie KFZ-Werkstatt, typischer Mittelstand**
- Out-of-Scope für v1: Vertragshändler-Seiten, reine Reifenhandlungen, Tuning-Spezialisten, Karosserie-Only, LKW-Werkstätten. Diese bekommen später eigene Templates, wenn die Lead-Zahlen es rechtfertigen.

### 1.3 Bezug zur Constitution
Diese Spec ist der Constitution (`.specify/CONSTITUTION.md` v1.1) nachgeordnet. Jeder Absatz hier wird durch einen Constitution-Paragraphen gedeckt. Widersprüche werden zugunsten der Constitution aufgelöst.

---

## 2. Ziel-Archetyp (Persona des Betriebs)

Das Template wird für einen Durchschnittsbetrieb geschrieben, nicht für einen konkreten Kunden. Der Archetyp deckt geschätzt ~70 % aller Lead-Treffer aus Google Places ab.

**Betrieb:**
- Freie KFZ-Meisterwerkstatt, 2–8 Mitarbeiter, ein Standort
- Deutschland-weit verteilt (kein regionaler Schwerpunkt — Outreach geht flächendeckend, Seite muss überall funktionieren)
- Gründungsjahr typischerweise 1975–2015 (Tradition als Verkaufsargument)
- Positionierung mittig: solide, seriös, fair — **nicht** Billig-Schrauber, **nicht** Premium/Tuning
- Leistungsspektrum (Pflicht-Überschneidung): Inspektion, TÜV/AU-Abwicklung, Bremsen, Ölwechsel, Reifenservice, Klima, Unfallschaden-Abwicklung
- Optional ergänzend: E-Auto-Service, Achsvermessung, Hol-/Bringservice, Ersatzwagen

**Endkunden des Betriebs:**
- Privatkunden, lokal (Pendler, Familien)
- Ø-Fahrzeugalter 5–15 Jahre (Gebrauchtwagen außerhalb der Vertragswerkstatt-Garantie)
- Entscheidungstreiber: Vertrauen > Preis > Nähe
- Sorgen, die die Seite adressieren muss: Wird hier ehrlich beraten? Ist das Gerät modern? Komme ich da zügig zu einem Termin? Habe ich einen Ersatzwagen?

**Betrieb-interne Rolle der Website:**
- Primär: Termin-/Anruf-Generator (nicht Reputations-Broschüre)
- Sekundär: Lokales SEO-Rankingmittel
- Tertiär: Vertrauensanker für Google-Business-Profile-Besucher, die noch unentschieden sind

---

## 3. Jobs to be done

Diese Jobs bestimmen, was auf der Seite stehen muss. Jede Section im Template hat eine Referenz auf die JTBD, die sie bedient.

**JTBD-1 — „Ich brauche dringend einen Termin"**
Nutzer hat akutes Problem (Warnleuchte, komischer Geräusch, TÜV fällig). Sucht nach „kfz werkstatt [ort]" oder ruft aus Google Business Profile heraus. Will in <15 s entscheiden: anrufen oder weiter suchen. → **Hero + Telefon klickbar + Öffnungszeiten** müssen above-the-fold sein.

**JTBD-2 — „Ich bin neu in der Gegend und suche eine ehrliche Werkstatt"**
Nutzer hat Umzug hinter sich, vergleicht 2–3 Betriebe. Will Signale: Wie lange gibt es die? Was sagen andere? Welche Leistungen? → **Über uns + Trust-Signale + Kundenstimmen + Leistungen** tragen die Entscheidung.

**JTBD-3 — „Mein Auto soll zum TÜV, was kostet das, und dauert das lange?"**
Nutzer will Klarheit über Ablauf und grobe Kosten. → **Ablauf-Section + FAQ** zerstreuen Unsicherheit.

**JTBD-4 — „Ich will schnell fragen, nicht telefonieren"**
Jüngere Zielgruppe / Nicht-Anrufer-Typ. → **Kontaktformular (kurz) + WhatsApp-Link** als Alternative.

**JTBD-5 — „Googles AI Search fragt: ,Welche Werkstatt macht TÜV am Ort X schnell?'"**
AI-Search-Agents / LLM-basierte Suchassistenten parsen FAQ- und LocalBusiness-Schema. → **FAQ mit FAQPage-Schema + LocalBusiness-JSON-LD** sind nicht optional.

---

## 4. Funktionale Anforderungen

Jede Anforderung hat eine Kennung (FR-###), eine Begründung (*Warum*) und die verbundene Constitution-Klausel.

### 4.1 Seitenstruktur
**FR-001** — Die Seite ist **eine** One-Page, kein Multi-Page. Legal-Seiten (Impressum, Datenschutz) sind separate Dokumente, aber inhaltlich minimal. *(Constitution §1.2, §6.1, §6.2)*

**FR-002** — Die Seite hat genau **12 Sections** in dieser Reihenfolge:
  1. Sticky Header
  2. Hero
  3. Leistungen
  4. Trust-Block
  5. CTA-Zwischenband
  6. Über uns
  7. Ablauf
  8. Kundenstimmen
  9. Öffnungszeiten + Anfahrt
  10. Kontaktformular
  11. FAQ
  12. Footer

Jede Section ist ein `<section>` mit semantischem `id`. Skip-Links in den Footer zeigen auf mindestens Hero, Leistungen, Kontakt. *(Constitution §3.1, §7.2)*

**FR-003** — Die Section-Reihenfolge folgt einer Trust-Ladder (Versprechen → Leistung beweisen → Trust stapeln → zur Tat rufen → Sorgen zerstreuen → Social Proof → Kontakt einfach machen). Abweichungen erfordern eigene Spec-Anpassung.

### 4.2 Section „Sticky Header"

**FR-010** — Immer sichtbar beim Scrollen, Höhe ≤ 64 px Desktop / ≤ 56 px Mobile. Hintergrund opak (nicht transparent) für Lesbarkeit.

**FR-011** — Enthält: Logo links (Textlogo oder SVG), Telefonnummer klickbar rechts (Desktop), Hamburger-Icon rechts (Mobile).

**FR-012** — Keine horizontale Desktop-Nav mit Menüpunkten — die Seite ist One-Page, Navigation ist Scrollen. Einzige sichtbare CTAs: Telefon + Termin-Scroll. *(Constitution §1.8)*

**FR-013** — Mobile: Hamburger öffnet ein Slide-in-Menü mit Anker-Links zu Leistungen, Über uns, Kontakt, Anfahrt. Schließbar per Button und ESC. Touch-Targets ≥ 44×44 px. *(Constitution §1.8, §7.2)*

### 4.3 Section „Hero"

**FR-020** — Enthält **ein `<h1>`** im Muster:
> `{Kernleistung} in {Ort} — {Firmenname}`
> Beispiel: „KFZ-Werkstatt in Kaltenkirchen — Meisterbetrieb Müller"

Alternative Muster (Sonnet wählt bei Generierung passend zu Firmenname-Länge):
> `{Firmenname} — Ihre KFZ-Werkstatt in {Ort}`
> `{Firmenname}: {Kernleistung} in {Ort} seit {Gründungsjahr}`

**FR-021** — Enthält **ein Versprechen** (`<p>` unter H1), max. 20 Wörter, konkret. Beispielpool:
- „Seit {Gründungsjahr} kümmern wir uns in {Ort} um alle Marken — fair, gründlich, pünktlich."
- „Inspektion, TÜV, Reparatur — alles aus Meisterhand in {Ort}."
- „Ihre freie Werkstatt in {Ort}. Ehrliche Beratung, faire Preise, schnelle Termine."

**FR-022** — Enthält **zwei CTAs**, klare Hierarchie:
- **Primär:** Telefon klickbar (`tel:` Link), sichtbar als Button mit Telefon-Icon und Nummer. *(Constitution §5.3)*
- **Sekundär:** „Termin anfragen" → Smooth-Scroll zu Kontaktformular (Anchor `#kontakt`).

**FR-023** — Enthält eine **Vertrauens-Zeile** direkt unter den CTAs mit drei Signalen (nur vorhandene zeigen):
- „Meisterbetrieb seit {Gründungsjahr}" (wenn Meisterbetrieb)
- „{Sterne} Sterne bei {Anzahl} Google-Bewertungen" (wenn Daten vorhanden)
- „TÜV-Partner / AU-Stelle" (wenn vorhanden)

**FR-024** — Hero-Bild: eine Komposition aus dem Branchen-Bild-Pool (siehe §9), lokal gehostet, WebP/AVIF, `fetchpriority="high"`, explizite `width`/`height`, Größe ≤ 180 kB. *(Constitution §1.6, §4.3)*

**FR-025** — Das Hero ist **mobile above-the-fold auf 375 px**, d.h. H1 + Versprechen + Primär-CTA + Telefonnummer sind ohne Scrollen sichtbar. *(Constitution §1.8, §5.3)*

### 4.4 Section „Leistungen"

**FR-030** — 6–9 Leistungs-Karten. Pflicht-Set (6): Inspektion, TÜV/AU, Bremsen, Ölwechsel, Reifenservice, Klimaservice. Optional-Ergänzung (bis zu 3): Unfallschaden, Achsvermessung, E-Auto-Service, Hol-/Bringservice, Ersatzwagen.

**FR-031** — Jede Karte besteht aus: Icon (SVG, monochrom, Linien-Stil), Titel (≤ 3 Wörter), 1-Zeilen-Beschreibung (≤ 12 Wörter), optional Link zu Ankersprung oder FAQ-Antwort.

**FR-032** — Layout responsive: 3-Spalten Desktop ≥ 1024 px, 2-Spalten Tablet 640–1024 px, 1-Spalte Mobile < 640 px. *(Constitution §1.8)*

**FR-033** — Beschreibungstexte sind generisch genug, dass sie für 90 % aller Zielbetriebe ohne Anpassung funktionieren. Beispiel „Bremsen": „Bremsbeläge und Scheiben wechseln wir zügig — mit Sicherheitscheck."

### 4.5 Section „Trust-Block"

**FR-040** — Enthält **mindestens drei** der folgenden, in Reihenfolge der verfügbaren Daten:
- Meisterbetrieb-Siegel (offizielles Logo der Handwerkskammer, nur wenn lizenz-geklärt — sonst als Text-Badge „Meisterbetrieb")
- Innungsmitgliedschaft (als Text-Badge „Mitglied der Kfz-Innung {Region}")
- TÜV-Partner-Badge (als Text-Badge, nicht offizielles Logo wegen Lizenzrecht)
- Gründungsjahr als prominentes Zahlen-Element („Seit 1987" / „Über 35 Jahre Erfahrung")
- Google-Bewertungen: Sterne-Zahl + Anzahl — als Zahlen, **kein** offizielles Google-Logo (Marken-Richtlinie)

**FR-041** — **Keine erfundenen Siegel.** Wenn Daten fehlen, wird die betreffende Komponente weggelassen. Niemals Platzhalter wie „4,9 Sterne" ohne Datenbasis. *(Constitution §5.4)*

**FR-042** — Ein bis drei Kundenstimmen-Zitate als **Teaser** (kurzes Statement, Vorname, Monat/Jahr) — volle Zitate in der späteren Kunden-Stimmen-Section (FR-080). Quelle ausschließlich: handverlesene, echte Google-Reviews des Betriebs.

### 4.6 Section „CTA-Zwischenband"

**FR-050** — Volle Breite, kontrastierend (Farbe aus Akzent-Palette der jeweiligen Variante), eine einzige starke Aussage + **ein** CTA: Telefon.

**FR-051** — Beispiel-Text: „Warnleuchte an? Rufen Sie uns an — meist bekommen Sie noch diese Woche einen Termin." Der konkrete Text wird pro Variante leicht angepasst (A: seriös, B: modern, C: direkt).

**FR-052** — Nur ein CTA im Band. Mehrere CTAs verwässern die Entscheidung.

### 4.7 Section „Über uns"

**FR-060** — 1 Absatz Fließtext, max. 4 Zeilen / ~80 Wörter. Enthält: Gründungsjahr, Name des Meisters (wenn bekannt), Anzahl Mitarbeiter (ungefähr, wenn bekannt), Haltung/Philosophie (1 Satz). *(Constitution §5.1, §5.2)*

**FR-061** — Begleitendes Bild: Werkstatt-Foto (Außenansicht oder Halle mit Hebebühne). **Kein KI-generiertes Personal**. Bei fehlendem Kundenfoto: neutrales Pool-Bild mit Werkstatt-Setting ohne erkennbare Menschen. *(Constitution §1.6)*

**FR-062** — Wenn Daten fehlen, wird die Section entweder mit generisch-wahren Aussagen gefüllt („Wir arbeiten in {Ort}.") oder kürzer. **Keine erfundenen Meister-Namen**, keine erfundenen Gründungsjahre.

### 4.8 Section „Ablauf"

**FR-070** — 3–4 Schritte, visuell als Zeitachse oder nummerierte Karten. Standard-Schritte:
1. **Anfrage** — „Sie rufen an oder schreiben uns."
2. **Termin** — „Wir nennen Ihnen zügig einen Termin, oft noch in dieser Woche."
3. **Reparatur** — „Wir arbeiten zum vereinbarten Festpreis. Kommt etwas dazu, fragen wir vorher."
4. **Abholung** — „Sie holen Ihr Auto ab. Wir erklären, was gemacht wurde."

**FR-071** — Zweck: Unsicherheit zerstreuen. Ersetzt nicht die FAQ, ergänzt sie.

### 4.9 Section „Kundenstimmen"

**FR-080** — 3–5 echte Google-Review-Zitate. Pro Zitat: Vorname + Initial Nachname, Monat/Jahr, Sterne, Fließtext (max. 3 Zeilen). Auswahl kuratiert: authentisch, inhaltlich verschieden (einer zu Tempo, einer zu Preis/Ehrlichkeit, einer zu Qualität).

**FR-081** — **Keine erfundenen Zitate.** Wenn der Lead-Datensatz keine Reviews hergibt, entfällt die Section komplett — **nicht** mit Platzhaltern füllen. *(Constitution §5.4)*

**FR-082** — Visuelles: kein Foto der Person, nur Initial-Avatar oder Sterne-Icon. Kein KI-generiertes Gesicht. *(Constitution §1.6)*

### 4.10 Section „Öffnungszeiten + Anfahrt"

**FR-090** — Strukturierte Öffnungszeiten-Tabelle, Wochentage Deutsch ausgeschrieben, Zeiten im 24-h-Format. Sonntag/geschlossene Tage explizit markiert.

**FR-091** — Adresse vollständig (Straße, PLZ, Ort). Telefon klickbar. E-Mail klickbar.

**FR-092** — **Kein Google-Maps-Embed** (DSGVO-Risiko, externer CDN verboten). Stattdessen: statisches Bild der Karten-Umgebung (optional, aus Branchen-Pool oder generiert) + klickbarer Link zu Google Maps mit vorausgefüllter Route. *(Constitution §6.3, §6.5)*

**FR-093** — Hinweis auf ÖPNV/Parkplätze, wenn bekannt. Max. 1 Satz.

### 4.11 Section „Kontaktformular"

**FR-100** — Felder (minimaler Satz):
- Name (Pflicht, `type=text`)
- Telefon **oder** E-Mail (eines Pflicht, beide erlaubt)
- Nachricht (Pflicht, `textarea`, max. 1000 Zeichen)
- Checkbox: „Ich habe die Datenschutzerklärung gelesen und stimme der Verarbeitung zu." (Pflicht)

**FR-101** — Jedes Feld hat `<label>`. Fehler sind `aria-describedby`-verknüpft. Pflichtfelder nicht nur durch Farbe markiert. *(Constitution §7.1, §7.4)*

**FR-102** — Formular funktioniert ohne JavaScript (HTML `required`, `pattern`, `type=email`, `type=tel`). JS ergänzt UX-Validation, ist aber nicht Voraussetzung. *(Constitution §2.1)*

**FR-103** — Neben dem Formular: **WhatsApp-Fallback** als `wa.me`-Link mit vorbefüllter Nachricht „Hallo {Firmenname}, ich habe eine Frage zu …". Wird nur gezeigt, wenn der Lead-Datensatz eine WhatsApp-Nummer enthält (sonst weglassen — nicht erfinden).

**FR-104** — Absende-Ziel: in der Demo-Phase eine statische Bestätigungsseite oder ein simpler Form-Receiver (Vercel-Serverless-Function im Plan klären). In der Kunden-Phase: E-Mail an Kunden oder Webhook in n8n.

### 4.12 Section „FAQ"

**FR-110** — 5–7 Fragen-Paare, als HTML-`<details>` / `<summary>` (semantisch, funktioniert ohne JS). *(Constitution §2.1)*

**FR-111** — Pflicht-Fragen (mind. 4 davon):
1. „Wie läuft der TÜV bei Ihnen ab?"
2. „Arbeiten Sie auch an meiner Marke / meinem Modell?"
3. „Bekomme ich einen Kostenvoranschlag?"
4. „Gibt es einen Ersatzwagen oder Hol-/Bringservice?"
5. „Wie schnell bekomme ich einen Termin?"
6. „Reparieren Sie auch E-Autos / Hybride?"
7. „Was kostet eine Inspektion ungefähr?"

**FR-112** — Antworten sind konkret, 2–4 Sätze, adressieren die echte Sorge hinter der Frage. Keine Preise nennen, die man nicht kennt („ab {Preis} €" nur wenn Daten belastbar; sonst „auf Anfrage, kurzer Anruf genügt").

**FR-113** — FAQPage-Schema (JSON-LD) wird mitgerendert (siehe §8). *(Constitution §3.2)*

### 4.13 Section „Footer"

**FR-120** — Enthält: Firmenname, Adresse kompakt, Telefon klickbar, E-Mail klickbar, Öffnungszeiten kompakt, Links zu `/impressum` und `/datenschutz`, Copyright mit Jahr.

**FR-121** — Keine Social-Media-Icons im Footer, es sei denn der Lead hat aktive Profile — in v1 weglassen (komplizieren die Pflege).

---

## 5. Content-Regeln (gelten sektionsübergreifend)

**FR-200** — Sprachregister: Sie-Form, Mittelstand-Deutsch, keine Anglizismen wenn deutsche Begriffe existieren. *(Constitution §5.1)*

**FR-201** — Wortlängen: Hero-H1 ≤ 10 Wörter, Absätze ≤ 4 Zeilen, CTA-Labels ≤ 4 Wörter, Meta-Description ≤ 155 Zeichen. *(Constitution §5.2)*

**FR-202** — **Keine Halbwahrheiten.** Wenn ein Datenpunkt für den konkreten Betrieb unbekannt ist, wird der Satz/die Komponente weggelassen. Beispiele:
- Kein „Seit über 30 Jahren" wenn Gründungsjahr unbekannt
- Kein „5-Sterne-Werkstatt" ohne Bewertungsbasis
- Kein „Meisterbetrieb" wenn nicht bestätigt
- Kein erfundener Mitarbeiter-Name, keine erfundene Kundenstimme
*(Constitution §5.4)*

**FR-203** — Stadt + Branche müssen in `<h1>`, `<title>`, erster Absatz und `meta[name=description]` stehen. *(Constitution §3.3)*

**FR-204** — NAP-Konsistenz (Name, Adresse, Telefon) identisch in Header, Öffnungszeiten-Section, Footer, Impressum, JSON-LD, OpenGraph. *(Constitution §3.3)*

**FR-205** — Der Copywriter-Skill (`landing-page-copywriter`) und der Psychology-Anker (`GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK.md`) sind Pflichtlektüre beim Generieren jeder Text-Komponente. *(Constitution §5.3)*

---

## 6. Design-Varianten (Taste-Settings)

Drei visuelle Varianten desselben Skeletts. Sonnet (oder später ein Haiku-Classifier) wählt pro Lead eine Variante — deterministisch (z. B. auf Basis eines Slug-Hashs) oder per Lead-Signal (Branche+Modernitäts-Heuristik).

### 6.1 Variante A — „Meister klassisch"
- **Zielbild:** Betrieb mit Kundschaft 45+, viele Stammkunden, „sicherer Hafen"
- **Farbwelt:** Off-White-Hintergrund (warm, leicht gelblich), Tiefblau als Akzent (#1E3A5F o. ä.), Anthrazit als Text
- **Typografie:** Serif für Headings (z. B. Fraunces oder Source Serif), Sans für Body (Inter oder System-Sans)
- **Flächen:** großzügiges Whitespace, klare Trennlinien zwischen Sections (dünne Border), keine starken Shadows

### 6.2 Variante B — „Moderne Werkstatt"
- **Zielbild:** Betrieb mit jüngerer Kundschaft, E-Auto-affin, vielleicht auch Flottenkunden
- **Farbwelt:** Neutraler Hintergrund (Weiß oder sehr helles Grau), Signalrot (#DC2626 o. ä.) als Akzent, Dunkelgrau als Text
- **Typografie:** Sans durchgängig (Inter / Geist / System-Stack), Heading-Weights 700, Body 400
- **Flächen:** kompakter, klarer Grid, sanfte Shadows auf Karten, runde Ecken mittelstark

### 6.3 Variante C — „Handwerk pur"
- **Zielbild:** Betrieb Richtung Tuning/Sport/Spezialisten, oder Betriebe die bewusst mit handwerklichem Selbstbewusstsein auftreten
- **Farbwelt:** Dark Mode (Anthrazit/Schwarz Hintergrund), Gelb (#FACC15 o. ä.) als Akzent, helles Off-White als Text
- **Typografie:** Mono-Style H1 (z. B. JetBrains Mono oder IBM Plex Mono) für Hero, Sans für Body
- **Flächen:** harte Kontraste, eckige Karten, keine Shadows

### 6.4 Gemeinsame Design-Regeln (alle Varianten)
- Responsive Breakpoints: 375 / 768 / 1024 / 1440 (`plan.md` definiert die genaue Tailwind-Breakpoints-Mapping)
- Fokus-Outlines in der Akzentfarbe, mind. 2 px, Kontrast ≥ 3:1 *(Constitution §1.5)*
- Kein auto-playender Media-Content. `prefers-reduced-motion` respektieren *(Constitution §2.5)*
- Max. 2 selbst gehostete Webfonts pro Variante *(Constitution §1.4)*

---

## 7. Trust-Signal-Matrix

Welches Signal darf unter welcher Datenlage gezeigt werden:

| Signal | Daten-Voraussetzung | Darstellung |
|---|---|---|
| Meisterbetrieb | Bestätigt im Lead-Datensatz (z. B. „Meisterbetrieb" in Google-Profil-Text oder auf bestehender Site) | Text-Badge mit Wappen-Icon. Kein offizielles HWK-Logo ohne Lizenz. |
| Innung | Aus Lead-Datensatz oder Betriebs-Website | Text-Badge „Mitglied der Kfz-Innung" |
| TÜV-Partner | Erwähnung in Profil/Site | Text-Badge „TÜV-Partner / AU-Stelle". **Kein** TÜV-Süd/-Nord/-Rheinland-Logo (Markenrecht). |
| Gründungsjahr | Jahreszahl im Profil oder berechnet aus Site-Impressum | „Seit {Jahr}" oder „Über {Jahre} Jahre Erfahrung" |
| Google-Sterne | Aus Places-API | „{Sterne} / 5 Sterne bei {Anzahl} Google-Bewertungen" — **ohne** Google-Logo |
| Review-Zitate | handverlesen aus Places-API-Reviews | Fließtext, Vorname + Initial, Monat/Jahr |
| Mitarbeiterzahl | nur wenn konkret bekannt | „{N}-köpfiges Team" (nicht erfinden) |
| Zertifikate (Bosch Service, Meisterhaft, ATU-Verbund etc.) | nur mit expliziter Bestätigung | erst ab Kundendaten-Phase 4 |

---

## 8. Local-SEO + Strukturierte Daten

### 8.1 Title + Meta + H1
- **`<title>`** (≤ 60 Zeichen): `{Firmenname} | KFZ-Werkstatt in {Ort}`
- **`meta[name=description]`** (≤ 155 Zeichen, Copywriter generiert pro Lead, Stadt + 2 Kernleistungen + Soft-Call): z. B. „Ihre freie KFZ-Werkstatt in {Ort}: Inspektion, TÜV und Reparatur aus Meisterhand. Faire Preise, schnelle Termine — jetzt anrufen."
- **`<h1>`** nach Muster aus FR-020
- **Canonical** auf Apex-Domain der Demo-/Kundenseite
- **OpenGraph:** `og:title`, `og:description`, `og:image` (≥ 1200×630), `og:locale=de_DE`, `og:type=website`. Twitter-Cards parallel. *(Constitution §3.1)*

### 8.2 JSON-LD — AutoRepair (Subtyp von LocalBusiness)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "AutoRepair",
  "name": "{Firmenname}",
  "image": "https://{slug}.emj-media.de/images/hero.webp",
  "@id": "https://{slug}.emj-media.de#autorepair",
  "url": "https://{slug}.emj-media.de",
  "telephone": "{Telefon E.164}",
  "priceRange": "€€",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{Straße Hausnummer}",
    "postalCode": "{PLZ}",
    "addressLocality": "{Ort}",
    "addressRegion": "{Bundesland-Kürzel}",
    "addressCountry": "DE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "{Lat}",
    "longitude": "{Lng}"
  },
  "openingHoursSpecification": [/* pro Wochentag ein Eintrag */],
  "areaServed": "{Ort} und Umgebung",
  "sameAs": ["{Google-Business-Profile-URL}"]
}
```

**FR-300** — Alle Datenfelder kommen aus dem Lead-Datensatz (Phase 2). Fehlt ein Feld, wird es aus dem JSON-LD **entfernt** (nicht leer lassen). *(Constitution §3.2)*

### 8.3 JSON-LD — FAQPage

Zweiter JSON-LD-Block auf der Seite, gefüllt aus dem FAQ-Inhalt (FR-110 bis FR-112).

### 8.4 Sitemap + Robots
- `sitemap.xml` mit mindestens `/`, `/impressum`, `/datenschutz`
- `robots.txt`:
  - **Demo-Phase (vor Kunden-Deal):** `User-agent: *` + `Disallow: /` + zusätzlich `<meta name="robots" content="noindex,nofollow">` in `<head>` jeder Seite. Cold-Mail-Landeseiten werden nicht in Google indexiert.
  - **Kunden-Phase (nach Deal):** `Allow: /`, Meta-Robots entfernen.
*(Constitution §3.4)*

---

## 9. Bild-Pool KFZ (`_templates/images/kfz/`)

**FR-400** — Einmaliger Aufbau vor Session 1.3, ~35 Bilder, Hybrid aus KI-generiert und Stock. Jedes Bild im Pool: WebP oder AVIF, Responsive-Sizes (320 / 768 / 1200 / 1920 Breite), alt-Text-Vorschlag im Dateinamen-Manifest.

### 9.1 KI-generierte Bilder (ca. 25)
Sujet ohne erkennbare Menschen oder nur Hände/Rücken:
- **Werkstatt-Außenansicht** (5 Varianten: klein-städtisch, industriell, moderne Halle, Reihengebäude, Flachdach)
- **Werkstatt-Halle innen** (5: Hebebühne mit Auto, Regale mit Werkzeug, Diagnose-Platz, Reifenlager, breite Übersicht)
- **Detail-Shots** (8: Hand an Motor, Wagenheber, Reifenprofil, Bremsscheibe, Ölwanne-Close-up, Diagnosegerät-Tablet, Drehmomentschlüssel, Scheinwerfer-Einstellung)
- **Werkzeug-Stillleben** (4: sauberer Werkzeug-Wagen, Regalordnung, Werkbank-Detail, Schlüsselbund am Board)
- **Atmosphäre** (3: Werkstattbeleuchtung bei Dämmerung, offenes Tor, moderne Hebebühne mit E-Auto)

### 9.2 Stock-Fotos (ca. 10)
Sujets mit Menschen — nur wenn echte Mitarbeiter später ersetzen:
- Kundenberatung (3)
- Mechaniker-Hände bei Arbeit (4, Gesicht nicht erkennbar)
- Übergabe Schlüssel (2)
- Team-Stilbild neutral (1)

### 9.3 Hero-Bild-Rotationspool
Pro Variante (A/B/C) wird ein kuratiertes Sub-Set hinterlegt (je 3 Kandidaten), aus denen Sonnet pro Demo zufällig eines wählt — verhindert visuelle Wiederholung bei Serien-Outreach.

### 9.4 Governance
- Bei Kundenakquise (Phase 4) werden Pool-Bilder durch Kundenfotos ersetzt, **bevor** die Site live geht.
- Neue Bilder werden in `_templates/images/kfz/MANIFEST.md` dokumentiert (Quelle, Lizenz, Motiv, alt-Text-Vorschlag, Session der Aufnahme ins Repo). *(Constitution §1.6)*

---

## 10. Acceptance Criteria

Die Template-v1 gilt als akzeptiert, wenn **alle** folgenden Checks grün sind. Diese Liste wird in Session 1.4 zur Review-Grundlage.

### 10.1 Content
- [ ] H1, Title, Meta-Description, erster Absatz enthalten jeweils Branche + Ort
- [ ] Telefonnummer `tel:`-klickbar in Header, Hero, CTA-Band, Öffnungszeiten, Footer
- [ ] NAP in Header, Footer, Öffnungszeiten, Impressum, JSON-LD identisch
- [ ] Kein erfundenes Datum/Personal/Siegel/Zitat (FR-202)
- [ ] Jede Section erfüllt ihre Pflicht-Inhalte oder wird komplett ausgelassen

### 10.2 Design (pro Variante A/B/C einzeln)
- [ ] Mobile-first, kein horizontaler Scroll auf 375 / 768 / 1440 px
- [ ] Touch-Targets ≥ 44×44 px
- [ ] Kontraste WCAG 2.1 AA (4.5:1 Body, 3:1 Large + UI)
- [ ] Fokus-Outlines sichtbar, 2 px, ≥ 3:1 Kontrast
- [ ] Typografie: max. 2 Webfonts, WOFF2, `font-display: swap`
- [ ] Hero above-the-fold auf Mobile 375 px (H1 + Versprechen + Primär-CTA)

### 10.3 Technik
- [ ] Lighthouse Mobile ≥ 90 auf Performance, A11y, Best Practices, SEO *(Constitution §4.1)*
- [ ] LCP ≤ 2,5 s / INP ≤ 200 ms / CLS ≤ 0,1 *(Constitution §4.2)*
- [ ] HTML ≤ 50 kB gz / CSS ≤ 30 kB gz / JS ≤ 30 kB gz / gesamt ≤ 400 kB *(Constitution §4.3)*
- [ ] Seite funktioniert mit JS deaktiviert (Navigation, Formular, FAQ, CTA) *(Constitution §2.1)*
- [ ] Keine externen CDNs, keine Google-Fonts, kein Maps-Embed *(Constitution §6.3, §6.5)*

### 10.4 SEO
- [ ] `<h1>` einmalig, semantische Heading-Hierarchie
- [ ] AutoRepair JSON-LD valid (Google Rich Results Test)
- [ ] FAQPage JSON-LD valid
- [ ] sitemap.xml + robots.txt vorhanden und korrekt für Demo- vs. Kunden-Phase
- [ ] OpenGraph + Twitter-Cards vorhanden

### 10.5 Legal
- [ ] `/impressum` + `/datenschutz` erreichbar, DSGVO-konform
- [ ] Datenschutz-Checkbox im Formular
- [ ] In Demo-Phase: EMJmedia-Impressum, `noindex,nofollow`
- [ ] Keine Tracker, keine Third-Party-Assets

---

## 11. Variablen / Placeholder (Schnittstelle zu Phase 2)

Jede dieser Variablen wird aus dem Lead-Datensatz gefüllt. Wenn leer → Komponente wird weggelassen oder generischer Fallback. Diese Liste ist der Vertrag zwischen Spec und Lead-Pipeline.

**Pflicht (Seite wird ohne sie nicht generiert):**
- `{slug}` — URL-sicherer Betriebs-Kurzname
- `{firmenname}` — offizieller Name
- `{ort}` — Stadt/Gemeinde
- `{straße}`, `{plz}` — Adresse
- `{telefon_e164}` — Telefonnummer im E.164-Format für `tel:`-Link
- `{telefon_anzeige}` — dieselbe Nummer human-formatiert für Text
- `{öffnungszeiten}` — strukturiertes Objekt Mo–So mit Öffnungs-/Schließzeit, `null` für geschlossen

**Stark empfohlen (starke Qualitätssteigerung, wenn vorhanden):**
- `{gründungsjahr}` — Integer
- `{meister_name}` — Vorname + Nachname oder leer
- `{mitarbeiter_anzahl}` — Integer oder leer
- `{kernleistung}` — z. B. „KFZ-Werkstatt" / „Meisterwerkstatt" / „Karosserie & Lack" (Auswahl aus Enum)
- `{leistungs_liste}` — Array aus Pflicht-6 + bis zu 3 Optional-Leistungen
- `{email}` — Kontakt-Mail
- `{google_rating}` — Float 0–5
- `{google_reviews_count}` — Integer
- `{google_review_zitate}` — Array aus `{text, vorname, monat_jahr, sterne}` (3–5 Einträge)
- `{geo_lat}`, `{geo_lng}` — Koordinaten
- `{bundesland_kuerzel}` — z. B. „SH", „BY"

**Optional:**
- `{whatsapp_nummer}` — für wa.me-Link
- `{hero_image_id}` — Pool-Bild-ID oder leer → Random aus Varianten-Pool
- `{designvariante}` — A/B/C oder leer → deterministisch aus Slug-Hash
- `{faq_overrides}` — optionale Override-Antworten für FAQ-Items

---

## 12. Anti-Patterns (explizit nicht)

Diese Elemente gehören **nicht** ins Template. Wenn Sonnet sie vorschlägt, werden sie in der Review zurückgewiesen:

- Carousel/Slider als Hero (CLS-Risiko, Accessibility-Problem, nicht nötig)
- Parallax-Scrolling (Performance, Barrierefreiheit)
- Video-Hintergrund (Payload, DSGVO bei Third-Party)
- Cookie-Banner (wir setzen keine Consent-pflichtigen Cookies)
- Exit-Intent-Popup, Newsletter-Popup
- Live-Chat-Widgets (Tawk, Intercom etc.)
- „Geprüfter Betrieb"-Badges ohne lizenzierte Quelle
- KI-generierte Mitarbeiter-Fotos mit Namen („Das ist Hans")
- Floating WhatsApp-Button (ohne Consent fragwürdig, auch visuell billig)
- Autoplay-Sounds/Videos
- Fake Counter („Heute X Anfragen")
- „Als gesehen in"-Media-Logo-Zeilen ohne Beleg

---

## 13. Offene Punkte für `plan.md` (Session 1.2)

Diese Punkte sind für die Umsetzungs-Architektur relevant und werden im nächsten Schritt entschieden — **nicht hier**:

- Konkrete Tailwind-Breakpoint-Tokens je Variante
- Genaue Webfont-Auswahl pro Variante (Lizenz + WOFF2-Hosting)
- Dateistruktur unter `_templates/kfz-werkstatt/` (Partials, Include-Mechanik)
- Template-Engine: reines HTML mit String-Replace vs. Minimal-Templating (z. B. Nunjucks oder Eta) → Performance- und Wartbarkeits-Tradeoff
- Form-Submit-Endpoint: statische Bestätigungsseite vs. Vercel-Function vs. n8n-Webhook
- Icon-Set für Leistungs-Karten (Lucide, Heroicons, eigenes SVG-Set — Lizenz + Pflege)
- Deterministische Varianten-Wahl: Hash-Algorithmus + Verteilungs-Quoten
- FAQ-Content-Generierung: statisch im Template vs. via Copywriter-Skill pro Lead individualisiert
- Lighthouse-CI-Integration (jeder Build → Report in `_logs/lighthouse/`)

---

## 14. Referenzen

- `.specify/CONSTITUTION.md` v1.1 — übergeordnetes Projekt-Regelwerk
- `.claude/skills/impeccable/` — Design-Exzellenz-Anker
- `.claude/skills/emil-kowalski/` — Animation/Detail-Polish
- `.claude/skills/taste-skill/` — Varianten-Settings
- `.claude/skills/landing-page-copywriter/` — Copy-Generator
- `.claude/skills/claude-seo/` + `.claude/skills/local-seo-skills/` — SEO-Pflicht
- `.claude/skills/web-quality-skills/` — Lighthouse-Review-Grundlage
- `_Strategie/GOOGLE_ADS_SPEZIALIST/PSYCHOLOGY_PLAYBOOK.md` — Psychologie-Anker für Copy

---

## Änderungshistorie

- **21.04.2026 (Session 1.1):** Initial. Opus in Cowork. Archetyp generisch, drei Design-Varianten, 12-Section-Struktur, Local-SEO-Anforderungen, Placeholder-Vertrag Phase 2.
