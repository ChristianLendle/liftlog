# PRSONAL – Energy Balance System: Spezifikation

> Konsolidierte Spec für den Umbau von einem reinen Trainings-Tracker zu einem
> adaptiven Energiebilanz-System. Grundlage für die UI/UX-Umsetzung mit Claude design
> und die spätere KI-Coach-Integration.
>
> **Leitidee:** Nicht die perfekte Kalorienformel, sondern ein System, das mehrere
> Datenquellen kombiniert, jede Schätzung mit einer Confidence versieht und sich über
> den Gewichtsverlauf selbst kalibriert.

---

## 0. Bestand & Designprinzipien

Die App ist eine Vanilla-JS-PWA mit localStorage als Quelle der Wahrheit und einem
Supabase-Snapshot zur Synchronisation (`syncAllUserData` / `restoreFromRemote`, ein
JSON-Payload pro User). Jeder Datentyp folgt demselben Muster: ein `liftlog_*_v1`-Key
plus ein `getX()` / `saveX()`-Paar, wobei `saveX()` den Sync auslöst.

**Drei Prinzipien, die alles zusammenhalten:**

1. **Einheitliches Schätz-Objekt.** Jeder Energiewert – egal ob Mahlzeit, Lauf oder
   Krafttraining – wird als `{ best_estimate, confidence, source }` modelliert. Dadurch
   sprechen Verbrauchs- und Zufuhrseite dieselbe Sprache.
2. **Entkopplung von Berechnung und Anreicherungs-Daten.** Die Kalorienmathematik
   braucht **keine** Übungs-Datenbank. Die Übungs-DB existiert ausschließlich für die
   Bodymap und Autocomplete. (Begründung in §6 / §7.)
3. **Trends statt Absolutwerte.** Ziel ist konsistente relative Genauigkeit. Die
   absolute Kalibrierung übernimmt der Gewichtsverlauf (§4.7).

---

## 1. Navigationsstruktur

Fünf Tabs. Wo ein Tab mehrere gleichrangige Inhalte trägt, kommt ein flacher
**Segmented Control** zum Einsatz – keine tiefe Unter-Navigation. Detail-/Edit-Ansichten
bleiben Drill-downs (Karte antippen → Detail), genau wie bisher.

```
Dashboard     → Heute-Blick: Kalorienziel, Bilanz, Trend, Quick-Actions
Training      → [ Sessions | Fortschritt | Bodymap ]
                  Sessions   = Log-Liste, Tap → Detail/Edit (bestehender Drill-down)
                  Fortschritt= echte PRs, Volumen, Dauer-Chart  (1RM-Rechner entfällt)
                  Bodymap    = trainierte Muskeln, Volumen/Erholung pro Gruppe
Ernährung     → Meal-Log (Tagesansicht) + Food-DB
Gesundheit    → [ Bilanz | Gewicht & KFA ]
                  Bilanz       = BMR/Grundverbrauch, Tagesziel, Verbrauch vs. Zufuhr
                  Gewicht & KFA= Tracking + Verlauf
Einstellungen → Profil/Ziel/Ernährungsart + Stammdaten (Standorte, Kategorien, Übungs-DB)
```

> **Änderung ggü. Erstfassung:** Bodymap ist inhaltlich Trainingsanalytik (trainierte
> Muskeln/Volumen pro Gruppe, analog zu Fortschritt), nicht Gesundheitsdaten wie BMR/Gewicht
> — deshalb unter Training statt Gesundheit. Bleibt weiterhin zurückgestellt bis
> Asset-/Design-Recherche (SVG Front/Back) abgeschlossen ist.

**Rollen der Tabs:** Dashboard zeigt *heute*, Gesundheit erklärt *warum* (die
Rechen-Engine), Einstellungen steuert *wonach* (Ziel/Profil).

**Konkrete Änderungen am bestehenden `VIEWS`-Array** (`['dashboard','progress','body','sessions','settings','training']`):

| Alt | Neu | Anmerkung |
|-----|-----|-----------|
| `dashboard` | `dashboard` | Inhalt wird auf Keyfacts umgebaut |
| `sessions` | → `training` (Segment „Sessions") | mit Detail/Edit-Drill-down |
| `progress` | → `training` (Segment „Fortschritt") | 1RM-Rechner entfernen, PRs/Volumen/Dauer behalten |
| `body` | → `gesundheit` (Segment „Gewicht & KFA") | erweitert um KFA |
| — | `ernaehrung` (neu) | Meal-Log + Food-DB |
| — | `gesundheit` (neu, Segmente Bilanz/Gewicht&KFA) | |
| — | Bodymap als 3. Segment von `training` (statt `gesundheit`) | s. Hinweis oben |
| `settings` | `settings` | um Profil/Ziel/Ernährung erweitert |
| `training` (Full-Screen-Modus beim aktiven Workout) | bleibt | unverändert |

> Hinweis: Der bestehende `training`-Wert bezeichnet aktuell den Vollbild-Workout-Modus.
> Um Namenskollision zu vermeiden, den neuen Tab z. B. `train` nennen und den
> Workout-Modus `workout` – oder den Full-Screen-Modus als Unterzustand des `train`-Tabs
> führen. Benennung beim Bauen final festlegen.

---

## 2. Datenmodell

### 2.1 Neue Storage-Keys (Muster wie `liftlog_weight_v1`)

```js
// MAHLZEITEN (Log)
const MEALS_KEY  = 'liftlog_meals_v1';
const getMeals   = () => JSON.parse(localStorage.getItem(MEALS_KEY)  || '[]');
const saveMeals  = (m) => { localStorage.setItem(MEALS_KEY, JSON.stringify(m)); syncAllUserData(); };

// FOOD-DB (wiederverwendbare Lebensmittel/Rezepte)
const FOODDB_KEY = 'liftlog_fooddb_v1';
const getFoodDb  = () => JSON.parse(localStorage.getItem(FOODDB_KEY) || '[]');
const saveFoodDb = (f) => { localStorage.setItem(FOODDB_KEY, JSON.stringify(f)); syncAllUserData(); };

// ÜBUNGS-DB (nur für Bodymap + Autocomplete, NICHT für Kalorien)
const EXDB_KEY   = 'liftlog_exercisedb_v1';
const getExDb    = () => JSON.parse(localStorage.getItem(EXDB_KEY)   || 'null') || SEED_EXERCISES;
const saveExDb   = (e) => { localStorage.setItem(EXDB_KEY, JSON.stringify(e)); syncAllUserData(); };
```

### 2.2 Schemas

**Food-DB-Eintrag** (pro 100 g, plus optionale Portionsgröße):

```js
{
  id: 'f_...',                 // crypto.randomUUID()
  name: 'Haferflocken',
  brand: null,                 // optional
  per100: { kcal: 372, protein: 13.5, carbs: 59, fat: 7 },
  servingG: 40,                // optionale Standardportion in g
  source: 'manual' | 'off',    // off = Open Food Facts
  barcode: null,               // bei off-Quelle gesetzt
  confidence: 0.7,             // manuell 0.7, off-Barcode 0.9
  createdAt: '2026-06-29'
}
```

**Meal-Log-Eintrag** (verweist auf Food-DB-Items × Menge; Werte werden beim Loggen
denormalisiert eingefroren, damit spätere Food-DB-Änderungen alte Logs nicht verzerren):

```js
{
  id: 'm_...',
  date: '2026-06-29',
  time: '12:30',
  mealType: 'breakfast'|'lunch'|'dinner'|'snack',
  items: [
    { foodId: 'f_...', name: 'Haferflocken', grams: 80,
      kcal: 298, protein: 10.8, carbs: 47.2, fat: 5.6 }
  ],
  totals: { kcal: 298, protein: 10.8, carbs: 47.2, fat: 5.6 },
  confidence: 0.7,             // min/gewichtetes Mittel der Item-Confidences
  source: 'fooddb'
}
```

**Übungs-DB-Eintrag** (Muskel-Mapping für die Bodymap):

```js
{
  id: 'ex_...',
  name: 'Bankdrücken',
  aliases: ['bench press','bankdruecken'],   // für Freitext-Matching
  primaryMuscles:   ['chest'],
  secondaryMuscles: ['triceps','front_delts'],
  custom: false                              // true = vom Nutzer ergänzt
}
```

### 2.3 Erweiterungen am Bestand

**`cfg` (`liftlog_cfg_v1`) um ein `profile`-Objekt erweitern** – alle Felder optional:

```js
profile: {
  sex: 'm'|'f'|null,
  birthYear: 1995 | null,        // Alter = aktuelles Jahr − birthYear
  heightCm: 182 | null,
  goal: 'cut'|'maintain'|'bulk'|null,
  goalIntensity: 'moderate'|'aggressive'|null,   // aggressive cut = "Shredd", aggressive bulk = "Totalitäre Masse"
  dietType: 'omnivore'|'vegetarian'|'vegan'|null,
  activityBaseline: 1.2 | 1.375 | 1.55 | null,   // grobe Selbsteinschätzung, nur Startwert
  startWeight: 84.0 | null,
  startKfa: 22 | null,            // Körperfettanteil in %
  startDate: '2026-06-29' | null,
  calibrationFactor: 1.0          // adaptiver Korrekturfaktor, s. §4.7
}
```

**Weight-Eintrag (`liftlog_weight_v1`) um optionalen KFA erweitern:**

```js
{ date: '2026-06-29', weight: 84.0, kfa: 22, note: 'Startgewicht' }
```

**Session-Objekt um Intensität + berechneten Verbrauch erweitern:**

```js
{
  ...bestehend (date, exercises[], duration, ...),
  intensity: 'low'|'mod'|'high'|null,   // EIN Tap am Ende des Trainings
  burnedKcal: 312,                      // berechnet, s. §4.3
  burnConfidence: 0.6
}
```

### 2.4 Sync einbinden

In **`syncAllUserData`** den Payload ergänzen:

```js
const payload = {
  sessions:   loadDB().sessions,
  weightLog:  getWeightEntries(),
  plans:      getPlans(),
  categories: getCategories(),
  locations:  getLocations(),
  cfg:        getCfg(),
  meals:      getMeals(),       // neu
  foodDb:     getFoodDb(),      // neu
  exerciseDb: getExDb(),        // neu
};
```

In **`restoreFromRemote`** spiegelbildlich mergen:

- `meals` → Merge per `id` (wie Sessions; kein Verlust bei Offline-Nutzung)
- `foodDb` → Merge per `id`; bei `barcode`-Kollision Remote gewinnt
- `exerciseDb` → Merge per `id`; Seed-Einträge nicht duplizieren
- `cfg.profile` → Remote gewinnt (nicht additiv), aber `calibrationFactor` nie auf
  Default zurücksetzen, wenn lokal bereits gelernt

---

## 3. Onboarding (Registrierung)

**Vollständig optional und überspringbar.** Kein Feld ist Pflicht; die App funktioniert
auch ohne Profil (dann nur Logging ohne Zielberechnung). Ziel: niedrige Einstiegshürde,
aber wer Daten angibt, bekommt sofort eine sinnvolle Energiebilanz.

**Schrittfolge (jeder Schritt skippbar):**

1. **Basis für den Grundverbrauch:** Geschlecht, Geburtsjahr (→ Alter), Größe.
2. **Startgewicht** + **KFA (optional).**
3. **Ziel:** Abnehmen / Halten / Muskelaufbau – plus **Intensität** (moderat /
   aggressiv = „Shredd" bzw. „Totalitäre Masse"), nur im Advanced-Schritt.
4. **Ernährungsart:** Alles-Esser / Vegetarisch / Vegan.
5. **Grobe Aktivität** (sitzend / leicht aktiv / aktiv) – nur Startwert, wird später
   durch echte Logs ersetzt.

**Startgewicht-Logik (wichtig für „runde" Daten):**
Bei Eingabe des Startgewichts wird **sofort ein erster Weight-Eintrag** geschrieben
(`date = heute`, `note = 'Startgewicht'`, `kfa` falls angegeben) **und** parallel in
`cfg.profile.startWeight/startKfa/startDate` abgelegt. Dadurch:

- erscheint das Startgewicht als erster Punkt im Gewichtsverlauf,
- kann das Profil dauerhaft „Startgewicht: 84,0 kg (29.06.2026)" sowie das aktuelle
  Gewicht und das Delta anzeigen,
- hat die KI später einen sauberen Ausgangspunkt.

---

## 4. Berechnungslogik

Alle Formeln im SI-System (kg, cm, min). Werte, die bewusst justierbar sind, in §8.

### 4.1 Grundumsatz (BMR)

Zwei Formeln, automatische Auswahl nach Datenlage:

```
Wenn KFA bekannt → Katch-McArdle (genauer, geschlechtsunabhängig):
    LBM = Gewicht × (1 − KFA/100)            // fettfreie Masse
    BMR = 370 + 21.6 × LBM

Sonst → Mifflin-St Jeor:
    Mann:  BMR = 10×kg + 6.25×cm − 5×Alter + 5
    Frau:  BMR = 10×kg + 6.25×cm − 5×Alter − 161
```

### 4.2 Erwarteter Tagesverbrauch (Ziel-Baseline)

Das ist **nicht** die tatsächliche Tagesbilanz (die nutzt echte Logs), sondern die
Basis, auf die das Ziel-Offset gerechnet wird:

```
Wenn ≥7 Tage Historie vorhanden:
    E = gleitender Durchschnitt (7–14 Tage) des tatsächlichen Tagesverbrauchs
        (BMR + geloggte Aktivität) × calibrationFactor
Sonst (Kaltstart):
    E = BMR × activityBaseline   (1.2 sitzend … 1.55 aktiv; Default 1.3)
```

### 4.3 Krafttraining-Verbrauch

**Keine Übungsdaten nötig** – nur Dauer und eine Gesamt-Intensität:

```
kcal_brutto = MET × 3.5 × Gewicht(kg) / 200 × Dauer(min)

MET nach Intensität:   low = 3.5   mod = 5.0   high = 6.0
Confidence:            0.6
```

**Doppelzählungs-Korrektur** (empfohlen, da BMR bereits 24 h Grundumsatz abdeckt):
Aktivität *netto über Ruhe* rechnen, also `(MET − 1)` statt `MET`:

```
kcal_netto = (MET − 1) × 3.5 × kg / 200 × Dauer(min)
```

Verbrauchsseite konsequent netto führen, damit `Tagesverbrauch = BMR(24h) + Σ netto-Aktivität`.

### 4.4 Cardio & NEAT (Activity Engine – modular)

Jede Aktivität ein eigenes Modell, einheitliches Schätz-Objekt. Qualitätsrang der
Quellen: **Watt > Herzfrequenz > MET(Modell/Gerät) > Geräte-kcal.**

| Aktivität | Modell | Confidence |
|-----------|--------|-----------|
| Laufen | `kcal ≈ Gewicht(kg) × Distanz(km)` (netto, sehr stabil); alt. MET über Tempo | 0.8 |
| Radfahren (outdoor) | Distanz+Zeit → Geschwindigkeit → MET; netto | 0.7 |
| Radfahren (indoor) | Watt bevorzugt (`kcal ≈ Watt × min × 0.06`, entspricht ~24 % Wirkungsgrad), sonst Geräte-MET | 0.9 / 0.7 |
| Steps (NEAT) | `kcal = Schritte × 0.0005 × Gewicht(kg)` (gewichtsskaliert, eigenes Modell) | 0.6 |
| StairMaster | Dauer + Level → MET; Stockwerke sekundär | 0.6 |

> MET ist modellabhängig, nicht absolut (Standard-MET ≠ Geräte-MET). Quelle pro Eintrag
> mitführen.

### 4.5 Tagesbilanz

```
Tagesverbrauch = BMR(24h) + Σ netto-Aktivität(Tag)
Tageszufuhr    = Σ Meal-Log kcal(Tag)
Tagesbilanz    = Tagesverbrauch − Tageszufuhr      // positiv = Defizit
```

Jede Summe trägt ein **Fehlerband** aus den Confidences der Einzelteile (s. §4.6).
Im UI nie eine nackte Zahl, sondern Wert + Unsicherheitsbereich.

### 4.6 Zielwerte: Kalorien & Makros

**Kalorienziel** auf Basis des erwarteten Tagesverbrauchs `E`:

| Ziel | Offset | grobe KG-Wirkung |
|------|--------|------------------|
| Halten | `E` | ±0 |
| Abnehmen moderat | `E × 0.80` (≈ −20 %) | ~ −0,5 %/Woche |
| Abnehmen aggressiv („Shredd") | `E × 0.72` (≈ −28 %) | ~ −1 %/Woche |
| Aufbau moderat (Lean) | `E × 1.10` (≈ +10 %) | langsamer, fettarmer Aufbau |
| Aufbau aggressiv („Totalitäre Masse") | `E × 1.20` (≈ +20 %) | schneller, mehr Fettanteil |

**Sicherheits-Floor:** Zielzufuhr nie unter `BMR × 1.1` (kein Crash-Defizit).

**Makros** (aus Ziel + Ernährungsart):

```
Protein:
    Cut     → 2.2 g/kg     (Muskelerhalt im Defizit)
    Halten  → 1.8 g/kg
    Bulk    → 1.8 g/kg
    Vegetarisch/Vegan: ×1.10 (geringere Verdaulichkeit/Leucin-Gehalt)
Fett:
    min 0.8 g/kg (Hormonhaushalt)
Kohlenhydrate:
    Rest der Kalorien nach Protein & Fett
    (kcal: Protein 4, Carbs 4, Fett 9)
```

Ernährungsart steuert vorerst nur die Protein-Korrektur und – für die spätere
KI – die Vorschlags-/Filterlogik der Food-DB.

### 4.7 Confidence & Selbst-Kalibrierung (das „lernende" System)

**Confidence (0–1) als Fehlerband interpretieren**, nicht als vages Vertrauen –
z. B. 0.8 ≈ ±10 %. Nur so lässt sie sich durch alle Ebenen rechnen. Default-Quellen:

```
Zufuhr:    OFF-Barcode 0.9 | manuell 0.7 | (KI später) 0.5
Verbrauch: Watt 0.95 | HF 0.85 | MET-Modell 0.7 | Kraft(Dauer×Int.) 0.6 | Geräte-kcal 0.5
```

**Gewichts-Kalibrierung** – der einzige echte Lern-Anker:

```
1 kg Körpergewicht ≈ 7700 kcal
Über ein rollendes Fenster (14–28 Tage):
    erwartete KG-Änderung  = Σ Tagesbilanz / 7700
    tatsächliche KG-Änderung = Trend aus Gewichts-Logs (geglättet)
    Abweichung → justiert profile.calibrationFactor (gedämpft, z. B. ±5 %/Update)
```

Der `calibrationFactor` korrigiert den erwarteten Tagesverbrauch (§4.2) und macht aus
den Einzelschätzungen über Zeit ein personalisiertes System. Wichtig: **nur** den
Trend nutzen, keine Tagesschwankungen (Wasser/Glykogen) – sonst rauscht die Kalibrierung.

---

## 5. Ernährung: Food-DB + Open Food Facts

**Zwei Ebenen strikt trennen:** Food-DB (wiederverwendbare Lebensmittel) vs. Meal-Log
(Tageseinträge, die Food-DB-Items referenzieren). Das macht das Loggen schnell.

### 5.1 Phase 1 – Manuelle Food-DB (Fundament, offline)
Lebensmittel mit kcal + Makros pro 100 g (oder pro Portion) anlegen, beim Loggen mit
Menge auswählen. `source: 'manual'`, `confidence: 0.7`. Voll offline, kein API-Key.

### 5.2 Phase 2 – Open Food Facts (Genauigkeits-Layer)
Kostenlose, riesige Produkt-DB mit Barcode. Treffer wird als Food-DB-Eintrag mit
`source: 'off'`, `confidence: 0.9` **gecacht** → danach offline verfügbar.

**Endpunkte (öffentlich, kein Key; eigener `User-Agent` Pflicht laut OFF-Policy):**

```
Produkt per Barcode:
  GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
      ?fields=product_name,brands,nutriments,serving_size

Textsuche:
  GET https://world.openfoodfacts.org/cgi/search.pl
      ?search_terms={q}&search_simple=1&action=process&json=1&page_size=20

Header: User-Agent: PRSONAL/1.0 (kontakt@deinedomain)
```

**Relevante Felder** in `product.nutriments`:
`energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`.
Defensiv parsen – Felder fehlen oft; bei fehlenden kcal optional aus `energy-kj` umrechnen
(`kcal = kJ / 4.184`). Produkt ohne Nährwerte → als „unvollständig" markieren, Nutzer
manuell ergänzen lassen.

**Barcode-Scan im Browser:** native `BarcodeDetector`-API (Android-Chrome) bevorzugt,
Fallback eine JS-Lib (z. B. ZXing/`html5-qrcode`). CORS: OFF erlaubt GET aus dem Browser.

### 5.3 Phase 3 – KI-Freitextschätzung (später)
„große Schüssel Pasta mit Tomatensauce" → LLM schätzt kcal/Makros + Confidence (0.5).
Erst nach 1+2, als Fallback für Selbstgekochtes. Fügt sich nahtlos in das
`{best_estimate, confidence, source}`-Modell ein und kann an den geplanten KI-Coach
andocken.

---

## 6. Bodymap + Übungs-DB

**Zweck-Trennung:** Die Übungs-DB dient **nicht** der Kalorienberechnung (die ist
übungsunabhängig, §4.3), sondern ausschließlich der Bodymap und dem Autocomplete.

**Kuratierte Starter-DB** (`SEED_EXERCISES`, ~40–60 gängige Übungen) mit Muskel-Mapping,
editierbar. Da bestehende Sessions Übungsnamen als **Freitext** speichern, braucht es
eine **Matching-Schicht**:

```
normalize(name) = lowercase + trim + Umlaute/Sonderzeichen vereinheitlichen
Match gegen name + aliases der Übungs-DB.
Kein Treffer → App fragt EINMALIG „Welche Muskeln?", legt custom-Eintrag an, cacht ihn.
```

So muss kein Altbestand migriert werden. Muskelgruppen-Schlüssel (Vorschlag, Front/Back):
`chest, front_delts, side_delts, rear_delts, biceps, triceps, forearms, abs, obliques,
lats, traps, lower_back, glutes, quads, hamstrings, calves`.

**Bodymap-Ansicht:** SVG-Körper (Vorder-/Rückseite) als Heatmap, eingefärbt nach
Trainingsvolumen pro Muskel im gewählten Zeitraum (Sätze × Übungs-Gewichtung). Zeigt
Ausgewogenheit und Erholung. Läuft **parallel** zur Energiebilanz, ist nicht Teil der
Kalorienmathematik.

---

## 7. Eingabe-Vereinfachung (Session-View)

Ziel: weniger Klicks, schnelleres Loggen.

- **Set-Häkchen entfernen** (`toggleSetDone` / `.set-done`): nicht benötigt, kostet pro
  Satz einen Tap.
- **Flow:** Übung wählen (Autocomplete aus Übungs-DB) → Sätze zeilenweise (Gewicht/Wdh)
  → **einmal** am Ende Gesamt-Intensität (3 Stufen) → Speichern.
- **Dauer** automatisch per Timer ab Trainingsstart (oder manuell überschreibbar) –
  liefert den Input für §4.3 ohne Extra-Eingabe.
- Intensität ist **optional**: ohne Angabe rechnet die App mit `mod` und senkt die
  Confidence.

---

## 8. Justierbare Parameter (zentral halten)

In ein `ENERGY_CONFIG`-Objekt auslagern, damit Tuning ohne Logik-Änderung möglich ist:

| Parameter | Default | Zweck |
|-----------|---------|-------|
| `MET.strength` | `{low:3.5, mod:5.0, high:6.0}` | Krafttraining-Intensität |
| `cutModerate` / `cutAggressive` | `0.80` / `0.72` | Defizit-Offsets |
| `bulkModerate` / `bulkAggressive` | `1.10` / `1.20` | Surplus-Offsets |
| `deficitFloorFactor` | `1.1` | Min-Zufuhr = BMR × Faktor |
| `protein.cut/maintain/bulk` | `2.2 / 1.8 / 1.8` g/kg | Protein-Ziele |
| `protein.plantMultiplier` | `1.10` | veg/vegan-Korrektur |
| `kcalPerKg` | `7700` | Gewichts-Kalibrierung |
| `calibrationWindowDays` | `14–28` | Kalibrierungs-Fenster |
| `calibrationMaxStep` | `0.05` | max. Faktor-Änderung pro Update |
| `confidence.*` | s. §4.7 | Quellen-Confidences |

---

## 9. Übergabepunkte für Claude design (UI-Surfaces)

Pro Screen die anzuzeigenden Daten/Komponenten – Datenmodell steht, nur das Visuelle fehlt:

**Dashboard:** Kalorienziel-Ring (Ziel vs. bereits gegessen), Bilanz-Balken
(Verbrauch ↔ Zufuhr), Restbudget, Makro-Mini-Bars (P/C/F), Gewichtstrend-Pfeil,
Karte „letztes/heutiges Training", FAB → Quick-Actions (Training / Mahlzeit / Gewicht).

**Training:** Segmented [Sessions | Fortschritt | Bodymap]. Sessions = Log-Liste (Karten,
Tap → Detail/Edit, bestehender Drill-down). Fortschritt = echte PRs, Volumen-Verlauf,
Dauer-Chart (kein 1RM-Rechner). Bodymap = SVG Front/Back-Heatmap, Auswahl Zeitraum
(zurückgestellt bis Asset-Recherche abgeschlossen).

**Ernährung:** Tages-Log gruppiert nach Mahlzeit, Tagessumme kcal + Makros. Add-Sheet
mit drei Wegen: Suche (OFF) / Barcode-Scan / manuell. Food-DB-Verwaltung (Liste,
bearbeiten, Favoriten).

**Gesundheit:** Segmented [Bilanz | Gewicht & KFA]. Bilanz = BMR/Grundverbrauch,
erwarteter Tagesverbrauch, Ziel + Offset, Verbrauch-vs-Zufuhr mit Fehlerband.
Gewicht & KFA = Eingabe + Verlaufschart (Gewicht + KFA-Linie), Δ zum Startgewicht.

**Onboarding:** mehrstufig, jeder Schritt skippbar (§3); Startgewicht-Bestätigung.

**Einstellungen/Profil:** Profilkarte (Startgewicht + Datum, aktuell, Δ, KFA, Ziel),
Ziel-Auswahl + Advanced-Intensität, Ernährungsart, Stammdaten (Standorte, Kategorien,
Übungs-DB-Pflege).

---

## 10. Umsetzungs-Reihenfolge (Phasen)

1. **Profil-Fundament:** `cfg.profile` + Onboarding + Startgewicht-Logik + BMR/Ziel-Engine
   + Dashboard-Keyfacts. (Ab hier liefert die App ein Kalorienziel.)
2. **Ernährung:** Meal-Log + manuelle Food-DB + Makros, dann Open Food Facts (Suche/Barcode).
3. **Verbrauch:** Kraft-Intensität + kcal (§4.3), Activity Engine für Cardio/NEAT.
4. **Gesundheit/Bilanz:** Bilanz-Ansicht mit Fehlerband + Gewichts-Kalibrierung (§4.7).
5. **Bodymap:** Übungs-DB-Seed + Matching + SVG-Heatmap.
6. **KI-Coach (später):** nutzt Profil, Ziel, Bilanz-Historie und Ernährungsart als Kontext;
   übernimmt zugleich die Freitext-kcal-Schätzung (Phase 3 der Ernährung).

**Querschnitt für jede Phase:** neue Keys in Sync ein-/aushängen (§2.4); jede Schätzung
trägt `{best_estimate, confidence, source}`.
