# KFZ-Branchen-Bild-Pool — Brief

**Stand:** 2026-04-21 (Session 1.3 / T-030)
**Spec:** `.specify/specs/kfz-template-v1/spec.md` §9
**Plan:** `.specify/specs/kfz-template-v1/plan.md` §8
**Constitution:** §1.6 (Bild-Quellen-Policy)

35 Bild-Slots, gemischt aus 25 KI-generierten und 10 lizenzierten Stock-Fotos. Ziel: ein Pool, aus dem alle KFZ-Demos ihre Bilder ziehen, ohne dass derselbe Hero zweimal hintereinander auf Outreach-Empfänger trifft.

## Verbindliche Regeln

- **Format des Originals:** JPG oder PNG, mind. 1920 px Breite, sRGB-Farbraum.
- **Speicherort:** `_templates/images/kfz/src/{nn}-{motiv}.jpg` (zweistellige Nummer, Bindestrich, Motiv-Slug).
- **Derivate** (320/768/1200/1920 px in WebP+AVIF) erzeugt `npm run images:convert`.
- **Constitution §1.6 Verbote:** keine erfundenen Mitarbeiter-Gesichter, keine KI-generierten „Testimonial"-Personen, keine geschützten Bilder ohne Lizenz.
- **Personen:** nur in Stock-Fotos, und auch dort entweder **ohne erkennbares Gesicht** (Hände, Rücken) oder mit Lizenz, die kommerzielle Nutzung erlaubt + Modell-Release.

## Variant-Hinweis

`a` = warm/klassisch (Off-White-Hintergrund, Tiefblau-Akzent) — Bilder dürfen warmer Look haben.
`b` = modern/Signal (Weiß, Rot-Akzent) — Bilder neutraler/heller, klarer.
`c` = handwerklich/dunkel (Dark Mode, Gelb-Akzent) — kontrastreich, Werkstatt bei Dämmerung, harte Schatten.
`*` = neutral, alle Varianten geeignet.

---

## A — KI-generierte Bilder (25)

### A1 Werkstatt-Außenansicht (5 Slots, hero-Pool)

- [ ] 01-aussen-kleinstaedtisch — Variant `a` — Backstein-Werkstatt, kleiner Vorhof, 2 Stellplätze, sonniger Tag, weiches Licht
- [ ] 02-aussen-industriell — Variant `b` — Modernes Werkstatt-Gebäude mit großen Garagentoren, Asphalt, klares Licht
- [ ] 03-aussen-moderne-halle — Variant `b` — Glasfassade-Eingang, sauberes Logo-Schild, perspektivisch
- [ ] 04-aussen-reihengebaeude — Variant `*` — Werkstatt im Reihenverbund, typisch Kleinstadt-Gewerbegebiet
- [ ] 05-aussen-flachdach — Variant `c` — Dunkler Flachdach-Bau, abendliche Beleuchtung, dramatisch

### A2 Werkstatt-Halle innen (5 Slots, hero + werkstatt-innen-Pool)

- [ ] 06-innen-hebebuehne-auto — Variant `a` — Hebebühne mit angehobenem Mittelklassewagen, helle Halle, ohne Personen
- [ ] 07-innen-werkzeugregale — Variant `*` — Saubere Werkzeug-Wand, Schublade halb offen, Detail-Reichtum
- [ ] 08-innen-diagnoseplatz — Variant `b` — Tablet/Laptop am Diagnose-Wagen, OBD-Stecker an Auto, modern
- [ ] 09-innen-reifenlager — Variant `*` — Reifenstapel im Regal, geordnet, gleichmäßiges Licht
- [ ] 10-innen-uebersicht — Variant `c` — Weite Halle, mehrere Hebebühnen, Werkstatt bei Tagesende, kontrastreich

### A3 Detail-Shots (8 Slots, detail-Pool)

- [ ] 11-detail-hand-am-motor — Variant `*` — Hand mit Handschuh am V8-Motorblock, Schraubenschlüssel im Bild
- [ ] 12-detail-wagenheber — Variant `*` — Pneumatischer Wagenheber unter Achse, sauber inszeniert
- [ ] 13-detail-reifenprofil — Variant `*` — Profiltiefe-Messer am Reifen, Close-up, schöne Bokeh
- [ ] 14-detail-bremsscheibe — Variant `*` — Glanzgedrehte Bremsscheibe, neuer Bremssattel, Werkstatt-Hintergrund
- [ ] 15-detail-oelwanne — Variant `*` — Ölwannenstöpsel, Tropfen, Auffangbehälter
- [ ] 16-detail-diagnose-tablet — Variant `b` — Tablet mit Fehlercode-Screen, modern, Werkstatt-Hintergrund unscharf
- [ ] 17-detail-drehmomentschluessel — Variant `*` — Drehmoment-Anzeige im Fokus, Hand im Hintergrund unscharf
- [ ] 18-detail-scheinwerfer — Variant `c` — Scheinwerfer-Einstellung mit Lichtprojektion auf Wand, dunkle Atmosphäre

### A4 Werkzeug-Stillleben (4 Slots, detail-Pool)

- [ ] 19-werkzeug-wagen — Variant `*` — Sauber sortierter Werkzeug-Wagen, Schublade halb offen, geometrische Komposition
- [ ] 20-werkzeug-regalordnung — Variant `*` — Werkzeug an Lochwand, jeder Schlüssel an seinem Platz, Wand-Schatten
- [ ] 21-werkzeug-werkbank — Variant `a` — Werkbank-Detail mit Schraubstock, Klemmbrett, alte Patina, charaktervoll
- [ ] 22-werkzeug-schluesselbund — Variant `*` — Schlüsselbund am Schlüsselboard, mehrere Brettbeschriftungen, Werkstatt-Atmosphäre

### A5 Atmosphäre (3 Slots, hero-Pool)

- [ ] 23-atmosphaere-daemmerung — Variant `c` — Werkstatt bei Sonnenuntergang, warmes Licht, einladend
- [ ] 24-atmosphaere-offenes-tor — Variant `a` — Offenes Garagentor mit Blick in helle Werkstatt, einladend
- [ ] 25-atmosphaere-e-auto — Variant `b` — Modern-Hebebühne mit E-Auto, blaue Akzente, futuristisch

---

## B — Stock-Fotos (10)

Quellen: Unsplash (CC0), Pexels (free), Pixabay (Pixabay-Lizenz). Alle dürfen kommerziell genutzt werden, Attribution ist nett aber nicht verpflichtend. Lizenz-URL pro Bild in MANIFEST.md notieren.

### B1 Mit Personen, Gesicht nicht primär (10 Slots)

- [ ] 26-stock-kundenberatung-01 — Variant `*` — Beratungsgespräch über Auto-Motorhaube, Hände zeigen, Gesichter weich
- [ ] 27-stock-kundenberatung-02 — Variant `*` — Werkstatt-Mitarbeiter erklärt Kunden Diagnose-Befund am Bildschirm
- [ ] 28-stock-kundenberatung-03 — Variant `b` — Tablet-Übergabe mit Reparatur-Vorschlag
- [ ] 29-stock-mechaniker-01 — Variant `*` — Hände mit Werkzeug am Motor (kein Gesicht im Bild)
- [ ] 30-stock-mechaniker-02 — Variant `*` — Mechaniker-Hände unter Auto auf Hebebühne
- [ ] 31-stock-mechaniker-03 — Variant `c` — Hände mit Drehmomentschlüssel an Felge
- [ ] 32-stock-mechaniker-04 — Variant `*` — Hände mit Diagnose-Stecker am OBD-Port
- [ ] 33-stock-uebergabe-schluessel-01 — Variant `*` — Schlüssel-Übergabe (nur Hände)
- [ ] 34-stock-uebergabe-schluessel-02 — Variant `a` — Schlüssel mit Werkstatt-Anhänger im Hintergrund unscharf
- [ ] 35-stock-team-neutral — Variant `b` — Werkstatt-Team von hinten / weiße Arbeitskleidung sichtbar (Gesichter abgewandt)

---

## Akzeptanz dieses Briefs

- Pro Slot ein Original im `src/`-Ordner, korrekt benannt.
- `npm run images:convert` produziert je 8 Derivate (4 Breiten × 2 Formate).
- `MANIFEST.md` (T-033) listet alle 35 Bilder mit Quelle, Lizenz, Motiv-Tag, Variant, alt-Text-Vorschlag.
- `image-pool.mjs` (T-013) liest Manifest und kann pro `(slug, variant)` reproduzierbar ein Hero-Bild auswählen.
