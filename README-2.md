# Hertz Freerider varsler 🚗

Automatisk varsel på Telegram når en Hertz Freerider-tur fra **Trondheim til Ålesund** blir tilgjengelig. Kjører gratis i skyen via GitHub Actions — du trenger ikke ha PC-en på.

---

## Oppsett — gjøres én gang (ca. 10 minutter)

### Steg 1: Lag en Telegram-bot og hent ut to verdier

Du trenger to ting fra Telegram: en **bot-token** og en **chat-ID**.

**1a) Lag boten:**
1. Åpne Telegram, søk etter `@BotFather` og start en chat.
2. Send `/newbot`.
3. Følg instruksjonene — gi den et navn (f.eks. "Freerider Varsler") og et brukernavn som slutter på `bot` (f.eks. `freerider_trd_alesund_bot`).
4. BotFather svarer med en melding som inneholder en linje som ser slik ut:
   ```
   1234567890:AAH8x...lang-streng-her
   ```
   **Dette er bot-token din. Kopier og ta vare på den.**

**1b) Finn din chat-ID:**
1. Søk opp boten din i Telegram (brukernavnet fra steget over) og start en chat — trykk **Start**, og send hva som helst (f.eks. "hei").
2. Åpne denne URL-en i nettleseren, men bytt ut `DIN_TOKEN`:
   ```
   https://api.telegram.org/botDIN_TOKEN/getUpdates
   ```
3. Du får et JSON-svar. Finn `"chat":{"id":123456789` — det tallet er din **chat-ID**.

---

### Steg 2: Lag et GitHub-repo

1. Gå til [github.com/new](https://github.com/new).
2. Gi det et navn (f.eks. `hertz-freerider-varsler`).
3. Sett det til **Private** (anbefales).
4. Hak av for "Add a README file".
5. Klikk **Create repository**.

---

### Steg 3: Last opp filene

Last opp disse filene til repoet (dra-og-slipp via GitHub-grensesnittet fungerer fint):

- `check_routes.py`
- `requirements.txt`
- `seen_trips.json`
- `.github/workflows/check.yml`  ← viktig at den ligger i mappen `.github/workflows/`

**Tips:** Når du drar-og-slipper på GitHub, kan du skrive `.github/workflows/check.yml` som filnavn for å lage mappestrukturen automatisk.

---

### Steg 4: Legg inn hemmelighetene i GitHub

1. I repoet ditt: gå til **Settings** (øverst til høyre).
2. I venstre meny: **Secrets and variables → Actions**.
3. Klikk **New repository secret** og legg inn:
   - Name: `TELEGRAM_BOT_TOKEN` — Value: tokenen fra steg 1a
4. Klikk **New repository secret** igjen og legg inn:
   - Name: `TELEGRAM_CHAT_ID` — Value: chat-IDen fra steg 1b

---

### Steg 5: Aktiver og test

1. Gå til **Actions**-fanen i repoet.
2. Hvis GitHub spør om å aktivere Actions: trykk **I understand my workflows, go ahead and enable them**.
3. Klikk på workflowen "**Sjekk Hertz Freerider**" i venstre meny.
4. Klikk **Run workflow → Run workflow** for å teste at alt fungerer.
5. Etter ~30 sekunder skal jobben vise grønt hakemerke. Klikk inn og se loggen — du vil se hvor mange turer som ble funnet.

Hvis du har grønn jobb: **du er ferdig!** Skriptet kjører nå hvert 30. minutt og varsler deg på Telegram så snart en tur dukker opp.

---

## Tilpasninger

### Endre rute eller legge til flere

Rediger `check_routes.py`, øverst i fila:

```python
ROUTES = [
    {"from": "Trondheim", "to": "Ålesund"},
    {"from": "Ålesund", "to": "Trondheim"},   # legg til retur
    {"from": "Trondheim", "to": "Oslo"},      # eller en annen rute
]
```

### Sjekke oftere eller sjeldnere

I `.github/workflows/check.yml`, endre cron-uttrykket:

- `"*/15 * * * *"` — hvert 15. minutt
- `"*/30 * * * *"` — hvert 30. minutt (default)
- `"0 * * * *"` — én gang i timen
- `"0 7-22 * * *"` — én gang i timen mellom 07:00 og 22:00

> **Merk:** GitHub Actions har en gratis kvote på 2000 minutter/måned for private repo. Selv hvert 15. minutt holder seg innenfor med god margin.

---

## Feilsøking

**Får ingen varsler?**
- Sjekk loggen i Actions-fanen — hvis det står "Fant 0 turer på siden" kan API-endepunktet ha endret seg (se neste punkt).
- Kjør workflowen manuelt fra Actions-fanen for å teste.

**Skriptet feiler med "Klarte ikke å finne et fungerende endepunkt"**

Den norske Freerider-siden har en relativt ny nettside, og API-URL-en kan endre seg. Slik finner du den nye:

1. Åpne [hertzfreerider.no](https://hertzfreerider.no) i Chrome.
2. Trykk **F12** for å åpne utviklerverktøyene.
3. Gå til **Network**-fanen.
4. Last siden på nytt, og søk/bla i tilgjengelige turer.
5. Se etter en URL som returnerer JSON med turdata (typisk under "Fetch/XHR"-filteret).
6. Lim inn URL-en øverst i `ENDPOINTS_TO_TRY` i `check_routes.py`.

**Ved feil sender skriptet et Telegram-varsel automatisk**, så du oppdager raskt hvis noe slutter å fungere.

---

## Hvordan det fungerer

- GitHub Actions kjører `check_routes.py` på en tidsplan.
- Skriptet henter alle Freerider-turer, filtrerer på rutene dine, og sammenligner med `seen_trips.json` (en fil i repoet som husker hvilke turer du allerede er varslet om).
- Nye turer → Telegram-melding.
- `seen_trips.json` commits tilbake til repoet automatisk.

Alt er gratis: GitHub-konto, GitHub Actions, og Telegram Bot API.
