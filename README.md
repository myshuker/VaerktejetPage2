# Cookmedical – Værktøjs status

En enkel webside, der tjekker status for et værktøj: om det er **SW Valid** og **Process Valid**. Hvis der findes et billede af værktøjet, bliver det også vist.

## Sådan bruges siden

1. Åbn `index.html` i en browser. Der kræves ingen server eller internetforbindelse.
2. Skriv i feltet **Værktøjet nummer eller navn**:
   - **Et nummer**, fx `EQ00011597`, `52580`, `52580-C` eller et Asset-nummer som `1006378`. Resultatet vises mens du skriver.
   - **En del af navnet**, fx `balloon` eller `ballonmaskine ø2`. Der vises forslag med værktøjets navn. Vælg et forslag med musen eller med piletasterne og Enter. Trykker du **Søg** uden at vælge, bruges det første forslag.
3. **Scan en stregkode** med Asset-nummeret:
   - **Håndscanner (USB/Bluetooth):** Markøren står i søgefeltet, når siden åbnes. Scan stregkoden, så søges der med det samme. Efter hver søgning er teksten markeret, så næste scanning erstatter den.
   - **Kamera på telefon/tablet:** Tryk på **Scan** og ret kameraet mod stregkoden. Knappen vises kun på telefon og tablet (iPhone og Android), ikke på pc. Browserens egen stregkodelæser bruges, hvis den findes, ellers ZXing-biblioteket (`zxing.min.js`). Kameraet virker kun, når siden åbnes fra en webserver med **https** (ikke som fil).

## Hvad viser siden

| Resultat | Kilde |
|---|---|
| **Equipment name** | Kolonnen **Description** i `ASSET_DATA` i `asset-data.js` (fra værktøj.xlsx). Dækker nummeret flere rækker, vises navnet uden "(...)" og uden gentagelser, fx `Pulling machine - Nedtrækningsmaskine`. Hvis nummeret ikke findes dér: navnet fra `SW_TOOL_DATA` |
| **Status** (Active/Obsolete) | `SW_TOOL_DATA` i `data.js` (fra D00174522-Rev104.xlsx) |
| `Active` → "Værktøjet er SW valid" (grøn) | |
| `Obsolete` → "Not SW Valid" (rød) | |
| **Quality Risk Group** og **Status (værktøj)** | `ASSET_DATA` i `asset-data.js` (fra værktøj.xlsx) |
| **Process Valid / Not process Valid** | `PROCESS_TOOL_DATA` i `data.js` (fra D00018073-Rev075.xlsx) |
| **Billede** (billede af værktøjet) | Mappen `images/tools/` |

Nummersøgningen bruger disse kolonner:

- I SW-data: `eq` (EQ-Number), `dnum` (D-number) og `legacy` (Legacy number).
- I værktøj.xlsx: **Alias**, **Asset** og **Category** (EQ-nummer). Findes intet, sammenlignes med Alias-nummeret før den første "-", fx `154071` finder `154071-∞_ID3980`.

Navnesøgningen bruger kolonnen **Description** i værktøj.xlsx. Alle indtastede ord skal indgå i navnet, i vilkårlig rækkefølge.

Hvis et Asset-nummer ikke findes i SW-data, bruger siden værktøjets Alias og EQ-nummer fra værktøj.xlsx i stedet. Når et EQ-nummer dækker flere assets, vises alle de forskellige værdier, fx "Installed, Retired".

Findes nummeret stadig ikke, søger siden med nummeret før den første "-", fx `154426-1,30-∞_ID5247` → `154426`. Det gælder SW-status, Process Valid og billedet.

Søgningen skelner ikke mellem store og små bogstaver.

Hvis værktøjet kun findes i værktøj.xlsx, vises Equipment name sammen med "Værktøjet ikke på SW Valid list". Findes nummeret slet ikke, vises beskeden: "Please check input or Værktøjet ikke på SW Valid list".

## Filer

```
index.html        Sidens struktur
style.css         Design (skrifttypen er indlejret i filen)
script.js         Søgning og visning af resultater og billeder
data.js           Data fra D00174522 og D00018073
asset-data.js     Data fra værktøj.xlsx
zxing.min.js      ZXing 0.23.0 (Apache-2.0-licens) til at læse stregkoder med kameraet
images/           Logo og ikoner
images/tools/     Billeder af værktøjer
```

## Billeder af værktøjer

En browser kan ikke se, hvilke filer der ligger i en mappe. Derfor prøver siden mulige filnavne i rækkefølge, indtil den finder et billede. Understøttede filtyper: `png`, `jpg`, `jpeg`, `webp`, `gif`.

Rækkefølgen for billedsøgningen:

1. **Det fulde nummer** som indtastet, derefter værktøjets andre numre fra data. Eksempel: `153916-A.jpg`
2. **Nummeret uden bogstav-endelsen**, derefter **nummeret før den første "-"**. Eksempel: `52827-A` → `52827.jpg`, `153227-∞` → `153227.jpg`
3. **Et alias** fra listen `NAME_IMAGE_ALIASES` i `script.js`. Eksempel: `Balloon Machine` → `Ballonmaskine.jpg`
4. **Navnet fra SW-data** (D00174522) skrevet på flere måder. Eksempel: `Laser welder.jpg`
5. **Description fra værktøj.xlsx**: hele teksten, hver del omkring " - " og hver del uden "(...)". Eksempel: `Laser welder - Lasersvejser` → `Laser welder` → alias `Lasersvejser.jpg`. Trin 3 og 4 bruges også på hver af disse navne.

**Sådan tilføjer du et billede:** Læg filen i `images/tools/` og navngiv den efter værktøjets nummer, fx `52580.jpg`.
Hvis filnavnet er forskelligt fra Equipment name, skal du tilføje en linje i `NAME_IMAGE_ALIASES`:

```js
"balloon machine": "Ballonmaskine.jpg",
```

> Bemærk: Hvis der findes to filer med samme navn men forskellig filtype, vises `.png`-filen, fordi siden prøver `.png` før `.jpg`.

## Opdatering af data

1. Erstat indholdet af `SW_TOOL_DATA` eller `PROCESS_TOOL_DATA` i `data.js` med de nye data fra Excel-filerne.
   For værktøj.xlsx: Erstat rækkerne i `ASSET_DATA` i `asset-data.js`. Hver række er `[Category, Alias, Asset, Description, Status, Quality Risk Group]`.
2. Opdater filnavnene (Rev) i footeren i `index.html`.
3. **Hæv versionsnummeret** `?v=34` i `index.html` (fx til `?v=35`). Ellers kan browsere blive ved med at vise de gamle filer fra deres cache.
