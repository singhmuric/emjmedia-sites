# KFZ Image Pool — MANIFEST

**Stand:** 2026-04-21 (Session 1.3 / T-033, B-01 Übergang: Platzhalter)

Diese Tabelle wird von `scripts/lib/image-pool.mjs` (T-013) gelesen.
Format: `| filename | motiv | variant | alt | source | license |`

`variant` darf `a`, `b`, `c` oder `*` (alle) sein. `motiv` steuert die Kandidaten-Listen für hero/werkstatt-innen/werkstatt-aussen/detail.

Aktueller Pool besteht aus **synthetischen Platzhaltern** (sharp + SVG, farbcodiert nach Variant). Die Originale unter `src/` und alle Derivate (`*-{320,768,1200,1920}.{webp,avif}`) werden vor T-101 durch echte KI-/Stock-Bilder ersetzt — Slot-Nummern und Dateinamen bleiben identisch, nur die Pixel werden ausgetauscht. Das Manifest muss dann nur in den Spalten `source` + `license` aktualisiert werden.

| filename | motiv | variant | alt | source | license |
|---|---|---|---|---|---|
| 01-aussen-kleinstaedtisch.webp | hero | a | "Werkstatt-Außenansicht im kleinstädtischen Stil mit Vorhof" | placeholder | placeholder (will become AI-generated) |
| 02-aussen-industriell.webp | hero | b | "Modernes Werkstatt-Gebäude mit großen Garagentoren" | placeholder | placeholder (will become AI-generated) |
| 03-aussen-moderne-halle.webp | hero | b | "Werkstatt-Eingang mit Glasfassade und Logo-Schild" | placeholder | placeholder (will become AI-generated) |
| 04-aussen-reihengebaeude.webp | hero | * | "Werkstatt im Gewerbegebiet im Reihenverbund" | placeholder | placeholder (will become AI-generated) |
| 05-aussen-flachdach.webp | hero | c | "Werkstatt-Flachdachbau bei Abendbeleuchtung" | placeholder | placeholder (will become AI-generated) |
| 06-innen-hebebuehne-auto.webp | werkstatt-innen | a | "Helle Werkstatt-Halle mit Auto auf Hebebühne" | placeholder | placeholder (will become AI-generated) |
| 07-innen-werkzeugregale.webp | werkstatt-innen | * | "Sortierte Werkzeug-Wand in einer Werkstatt" | placeholder | placeholder (will become AI-generated) |
| 08-innen-diagnoseplatz.webp | werkstatt-innen | b | "Diagnose-Tablet am OBD-Stecker eines Autos" | placeholder | placeholder (will become AI-generated) |
| 09-innen-reifenlager.webp | werkstatt-innen | * | "Geordnetes Reifenlager im Regal" | placeholder | placeholder (will become AI-generated) |
| 10-innen-uebersicht.webp | hero | c | "Weite Werkstatt-Halle mit mehreren Hebebühnen am Tagesende" | placeholder | placeholder (will become AI-generated) |
| 11-hand-am-motor.webp | detail | * | "Hand mit Werkstatthandschuh am Motorblock" | placeholder | placeholder (will become AI-generated) |
| 12-wagenheber.webp | detail | * | "Pneumatischer Wagenheber unter einer Achse" | placeholder | placeholder (will become AI-generated) |
| 13-reifenprofil.webp | detail | * | "Profiltiefen-Messer am Reifen, Detail-Aufnahme" | placeholder | placeholder (will become AI-generated) |
| 14-bremsscheibe.webp | detail | * | "Glanzgedrehte Bremsscheibe mit neuem Bremssattel" | placeholder | placeholder (will become AI-generated) |
| 15-oelwanne.webp | detail | * | "Ölwannenstöpsel mit Auffangbehälter" | placeholder | placeholder (will become AI-generated) |
| 16-diagnose-tablet.webp | detail | b | "Tablet mit Fehlercode-Anzeige in der Werkstatt" | placeholder | placeholder (will become AI-generated) |
| 17-drehmomentschluessel.webp | detail | * | "Drehmomentschlüssel mit Anzeige im Fokus" | placeholder | placeholder (will become AI-generated) |
| 18-scheinwerfer.webp | detail | c | "Scheinwerfer-Einstellung mit Lichtprojektion auf Wand" | placeholder | placeholder (will become AI-generated) |
| 19-werkzeug-wagen.webp | detail | * | "Sortierter Werkzeug-Wagen mit halb offener Schublade" | placeholder | placeholder (will become AI-generated) |
| 20-werkzeug-regalordnung.webp | detail | * | "Werkzeuge an einer Lochwand, jedes an seinem Platz" | placeholder | placeholder (will become AI-generated) |
| 21-werkzeug-werkbank.webp | detail | a | "Werkbank-Detail mit Schraubstock und Klemmbrett" | placeholder | placeholder (will become AI-generated) |
| 22-werkzeug-schluesselbund.webp | detail | * | "Schlüsselbund am Schlüsselboard in einer Werkstatt" | placeholder | placeholder (will become AI-generated) |
| 23-atmosphaere-daemmerung.webp | hero | c | "Werkstatt bei Sonnenuntergang mit warmem Licht" | placeholder | placeholder (will become AI-generated) |
| 24-atmosphaere-offenes-tor.webp | hero | a | "Offenes Garagentor mit Blick in helle Werkstatt" | placeholder | placeholder (will become AI-generated) |
| 25-atmosphaere-e-auto.webp | hero | b | "Modern-Hebebühne mit E-Auto und blauen Akzenten" | placeholder | placeholder (will become AI-generated) |
| 26-kundenberatung-01.webp | werkstatt-aussen | * | "Beratungsgespräch über die Motorhaube eines Autos" | placeholder | placeholder (will become stock CC0) |
| 27-kundenberatung-02.webp | werkstatt-aussen | * | "Werkstatt-Mitarbeiter zeigt Kunden Diagnose-Befund" | placeholder | placeholder (will become stock CC0) |
| 28-kundenberatung-03.webp | werkstatt-aussen | b | "Tablet-Übergabe mit Reparatur-Vorschlag" | placeholder | placeholder (will become stock CC0) |
| 29-mechaniker-01.webp | detail | * | "Hände mit Werkzeug am Motor" | placeholder | placeholder (will become stock CC0) |
| 30-mechaniker-02.webp | detail | * | "Mechaniker-Hände unter einem Auto auf der Hebebühne" | placeholder | placeholder (will become stock CC0) |
| 31-mechaniker-03.webp | detail | c | "Hände mit Drehmomentschlüssel an einer Felge" | placeholder | placeholder (will become stock CC0) |
| 32-mechaniker-04.webp | detail | * | "Hände mit Diagnose-Stecker am OBD-Port" | placeholder | placeholder (will become stock CC0) |
| 33-uebergabe-schluessel-01.webp | werkstatt-aussen | * | "Schlüssel-Übergabe in einer Werkstatt" | placeholder | placeholder (will become stock CC0) |
| 34-uebergabe-schluessel-02.webp | werkstatt-aussen | a | "Schlüssel mit Werkstatt-Anhänger im Vordergrund" | placeholder | placeholder (will become stock CC0) |
| 35-team-neutral.webp | werkstatt-aussen | b | "Werkstatt-Team in Arbeitskleidung von hinten" | placeholder | placeholder (will become stock CC0) |

## Slot-Verteilung

- **hero:** 9 Bilder (Variant-aufgeteilt für Hero-Pool-Auswahl)
- **werkstatt-innen:** 4
- **werkstatt-aussen:** 6
- **detail:** 16

## Variant-Quoten der Hero-Bilder

- variant=a: 2
- variant=b: 3
- variant=c: 3
- variant=*: 1
