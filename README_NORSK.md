# Impostor

Et norsk bløffespill for 3–15 personer som spiller sammen med én telefon. Appen er en statisk nettside uten konto, backend eller byggesteg.

## Spille

1. Velg antall spillere, antall impostorer og kategori. Skriv inn navn, eller start direkte med den lagrede gjengen.
2. Send telefonen til spilleren på skjermen. Hold knappen nede for å se rollen. Alternativt kan rollen vises i åtte sekunder med en egen knapp. Skjul før telefonen sendes videre.
3. Startspilleren trekkes tilfeldig. Gå med klokken og gi ett kort hint hver, uten å si ordet, deler av det, rim eller oversettelser. Impostorene kjenner bare kategorien.
4. Diskuter og stem samtidig. Verten markerer like mange mistenkte som det finnes impostorer. Ved uavgjort stemmer gruppen på nytt mellom de aktuelle spillerne.
5. Bekreft gruppens valg. Spillerne vinner dersom alle impostorene blir funnet. Ellers vinner impostorene. Disse reglene har ingen ekstra gjetterunde.

Med 3–6 spillere brukes én impostor, med 7–9 opptil to og med 10–15 opptil tre. «Ny runde» beholder gjengen og oppsettet; «Endre oppsett» lar dere justere før neste runde.

## Personvern og gjenopptakelse

- Navn, oppsett, ordhistorikk og tema lagres lokalt i nettleseren. Ingen data sendes til en spillserver, og appen bruker ingen eksterne fonter eller analyseverktøy.
- Den aktuelle runden og tidsuret lagres i fanens `sessionStorage`. Oppfriskning beholder runden, men en åpen hemmelighet gjenopptas alltid på overleveringsskjermen.
- Slett lagrede navn fra Innstillinger. Hvis nettleseren blokkerer lagring, fungerer spillet i minnet frem til siden lukkes eller lastes på nytt.
- Rollevisning skjules ved slipp, tapt fokus, appbytte og sidenavigasjon. Begge roller har samme utseende. Enheten skal fortsatt skjermes for andre mens man leser.

## Kjør lokalt

Bruk Node.js 22 eller nyere:

```sh
npm ci
npm start
```

Åpne `http://127.0.0.1:4173`. Produksjonen kan servere filene direkte over HTTPS, også under en undermappe som `/Imposter/` på GitHub Pages.

## Tester

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Enhetstestene dekker blant annet rolleutdeling ved alle støttede gruppestørrelser, vinnerregler, ordstokker, tidsur og feil i lagring. Nettlesertestene dekker hele spillflyten, gjentatt rollevisning, fokusbytte, lange navn og ord, mobilbredder, omspill, gjenopptakelse og offlineoppdateringer i lyst og mørkt tema.

`IMPOSTOR_CHROMIUM_PATH` kan peke på en eksisterende Chromium-installasjon i testmiljøer. CI kjører både enhetstester og nettlesertester ved endringer på `main` og i pull requests. Installasjon og oppførsel på fysisk iPhone og Android må i tillegg kontrolleres på enhetene.

## Kode

| Fil                     | Ansvar                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `index.html`, `app.css` | Skjermer, dialoger og responsivt utseende                                               |
| `app.js`                | Skjermflyt, rollevisning og brukerhandlinger                                            |
| `game.js`               | Rene funksjoner for runder, vinnerregler, tidsur og validering av gjenopptakelse        |
| `words.js`              | Fem ordkategorier og uttrekk uten gjentakelse; «Blandet» er unionen av alle kategoriene |
| `storage.js`            | Lokal lagring med minne som reserve ved feil                                            |
| `app-shell.js`          | Tema, installasjon og oppdateringsmeldinger                                             |
| `sw.js`                 | Versjonert offlinepakke og trygg aktivering                                             |
| `app-info.js`           | Appnavn og én felles versjonsverdi                                                      |

## Publisering og oppdatering

1. Endre `version` i `app-info.js` ved hver publisering. Publiser alle kildefiler og ikoner samlet. Service workeren beholder klassisk registrering slik at også tidligere installerte utgaver kan hente oppdateringen.
2. Den nye service workeren laster ned hele offlinepakken. En feil i nedlastingen avviser installasjonen og beholder gjeldende pakke.
3. En ferdig nedlastet oppdatering venter. Meldingen vises når ingen runde pågår. Bare et eksplisitt trykk på «Oppdater» aktiverer og laster siden på nytt. «Senere» lar oppdateringen vente.
4. Første installasjon laster ikke siden på nytt. Hvis en annen fane aktiverer en oppdatering, lastes en pågående runde heller ikke automatisk på nytt.
5. Kun gamle cacher med appens eget `impostor-shell-`-prefiks ryddes bort. Appen serverer én komplett installert versjon frem til neste blir akseptert.

PNG-ikonene er rasterversjoner av `icon.svg`. `maskable-512.png` har ekstra marg for beskjæring på hjemskjermer, og `apple-touch-icon.png` brukes på iPhone/iPad.
