# Cookmedical – Værktøjs status

En enkel webside, der tjekker status for et værktøj: om det er **SW Valid** og **Process Valid**. Hvis der findes et billede af værktøjet, bliver det også vist.

## Sådan bruges siden

1. Åbn `index.html` i en browser. Der kræves ingen server eller internetforbindelse.
2. Skriv værktøjets nummer, fx `EQ00011597`, `52580` eller `52580-C`.
3. Resultatet vises mens du skriver, eller når du trykker på **Søg**.

## Hvad viser siden

| Resultat | Kilde |
|---|---|
| **Equipment name** og **Status** | `SW_TOOL_DATA` i `data.js` (fra D00174522-Rev103.xlsx) |
| `Active` → "Værktøjet er SW valid" (grøn) | |
| `Obsolete` → "Not SW Valid" (rød) | |
| **Process Valid / Not process Valid** | `PROCESS_TOOL_DATA` i `data.js` (fra D00018073-Rev075.xlsx) |
| **Billede** (billede af værktøjet) | Mappen `images/tools/` |

Siden søger i tre kolonner: `eq` (EQ-Number), `dnum` (D-number) og `legacy` (Legacy number). Søgningen skelner ikke mellem store og små bogstaver.

Hvis nummeret ikke findes, vises beskeden: "Please check input or Værktøjet ikke på SW Valid list".

## Filer

```
index.html        Sidens struktur
style.css         Design (skrifttypen er indlejret i filen)
script.js         Søgning og visning af resultater og billeder
data.js           Data udtrukket fra Excel-filerne
images/           Logo og ikoner
images/tools/     Billeder af værktøjer
```

## Billeder af værktøjer

En browser kan ikke se, hvilke filer der ligger i en mappe. Derfor prøver siden mulige filnavne i rækkefølge, indtil den finder et billede. Understøttede filtyper: `png`, `jpg`, `jpeg`, `webp`, `gif`.

Rækkefølgen for billedsøgningen:

1. **Det fulde nummer** som indtastet, derefter værktøjets andre numre fra data. Eksempel: `153916-A.jpg`
2. **Nummeret uden bogstav-endelsen**. Eksempel: `52827-A` → `52827.jpg`
3. **Et alias** fra listen `NAME_IMAGE_ALIASES` i `script.js`. Eksempel: `Balloon Machine` → `Ballonmaskine.jpg`
4. **Equipment name** skrevet på flere måder. Eksempel: `Laser welder.jpg`

**Sådan tilføjer du et billede:** Læg filen i `images/tools/` og navngiv den efter værktøjets nummer, fx `52580.jpg`.
Hvis filnavnet er forskelligt fra Equipment name, skal du tilføje en linje i `NAME_IMAGE_ALIASES`:

```js
"balloon machine": "Ballonmaskine.jpg",
```

> Bemærk: Hvis der findes to filer med samme navn men forskellig filtype, vises `.png`-filen, fordi siden prøver `.png` før `.jpg`.

## Opdatering af data

1. Erstat indholdet af `SW_TOOL_DATA` eller `PROCESS_TOOL_DATA` i `data.js` med de nye data fra Excel-filerne.
2. Opdater filnavnene (Rev) i footeren i `index.html`.
3. **Hæv versionsnummeret** `?v=14` i `index.html` (fx til `?v=15`). Ellers kan browsere blive ved med at vise de gamle filer fra deres cache.
