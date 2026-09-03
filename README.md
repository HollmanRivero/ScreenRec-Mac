# ScreenRec

A modern, high-performance desktop screen recorder built with **Electron** and **Node.js**. 

Record your entire display or individual application windows, overlay your webcam with draggable picture-in-picture (PiP), capture and mix microphone and desktop audio, and export cleanly to **MP4, WebM, MOV, AVI, or animated WebP**.

---

## 🌟 Key Features

- **10-Minutters Gratis Prøvetid (Free Trial)**:
  - Test alle funksjoner med opptil 10 minutter aktiv opptakstid før kjøp.
  - Live nedtelling i topplinjen (`⏳ Prøvetid: 10:00`).
  - Enkel aktivering med lisensnøkkel (`SCREC-XXXX-XXXX-XXXX`) for å låse opp permanent **PRO-versjon**.
- **Hurtigvalg (Quick 1-Click Modes)**:
  - 🖥️ **Bare Skjermen (Screen Only)** — ta opp hele skjermen med ett klikk.
  - 🎥 **Skjerm + Webcam (Combo Overlay)** — legg webkameraet som et flyttbart bilde-i-bilde over skjermen.
  - 🤳 **Kun Webcam (Webcam Only)** — ta opp direkte fra webkameraet som hovedkilde.
- **Kildevalg & Sanntids Miniatyrbilder**:
  - Filtrer etter **Alle**, **Skjermer**, eller **Vinduer**.
  - Oppdater kildelisten umiddelbart med roterende `⟳`-knapp.
- **Flyttbart Webkamera (PiP)**:
  - Klikk og dra webkameraet til ønsket posisjon hvor som helst over forhåndsvisningen.
- **Flerkanals Lydopptak**:
  - Ta opp mikrofonlyd med støydemping og ekkokansellering.
  - Ta opp system-/skrivebordslyd.
- **Flere Eksportformater via FFmpeg**:
  - **MP4** (H.264 + AAC), **WebM** (rask lagring), **MOV** (Apple QuickTime), **AVI**, og **Animert WebP**.
- **Plattformstøtte**:
  - Optimalisert for **macOS** (ScreenCaptureKit), **Windows 10/11**, og **Ubuntu / Linux**.

---

## 💰 Kjøp Lisens / Betalingsmåter

ScreenRec leveres med en **10-minutters gratis prøveperiode**. For å fortsette å bruke programmet ubegrenset etter prøvetiden kan du kjøpe en lisensnøkkel:

1. 💳 **Kort / Vipps / Apple Pay (Lemon Squeezy)**:
   - [Kjøp via Lemon Squeezy](https://hollmanrivero.lemonsqueezy.com/checkout)
2. 🅿️ **PayPal**:
   - [Betal direkte med PayPal](https://paypal.me/hollmanrivero)
3. 💬 **Direkte via WhatsApp**:
   - Send melding til **[+47 972 69 623](https://wa.me/4797269623?text=Hei%20Hollman!%20Jeg%20vil%20kj%C3%B8pe%20lisens%20til%20ScreenRec.)** for direkte kjøp og umiddelbar overlevering av lisensnøkkel.

### Slik aktiverer du lisensen i appen:
1. Klikk på **Prøvetid**-merket øverst i appen (eller vent til betalingsvinduet dukker opp).
2. Skriv inn lisensnøkkelen du mottok ved kjøp (format: `SCREC-XXXX-XXXX-XXXX`).
3. Klikk **Aktiver**. Merket endrer seg til **⭐ PRO LISENS**, og all tidsbegrensning fjernes permanent.

---

## 🚀 Installasjon og Kjøring

### 1. Klon repositoryet
```bash
git clone https://github.com/HollmanRivero/ScreenRec.git
cd ScreenRec
```

### 2. Installer avhengigheter
```bash
npm install
```

### 3. Start appen
```bash
npm start
```

### 4. Kjør automatiserte tester
```bash
npm test
```

---

## 🔑 Generering av Lisensnøkler (For Eier)

Som eier av prosjektet kan du når som helst generere nye gyldige lisensnøkler til kunder:

```bash
# Generer 1 lisensnøkkel:
node generate-key.js

# Generer f.eks. 5 lisensnøkler samtidig:
node generate-key.js 5
```

---

---

## 📥 Installasjonsveiledning for Kunder (Produksjonsfiler)

Last ned riktig installasjonsfil for ditt operativsystem fra [GitHub Releases](https://github.com/HollmanRivero/ScreenRec/releases):

### 🍏 macOS (`.dmg`)
1. Last ned `ScreenRec-1.0.0.dmg`.
2. Dobbeltklikk på `.dmg`-filen og dra **ScreenRec** over til **Applications (Programmer)**.
3. **Viktig første gang på Mac:**
   - Gå til **Systeminnstillinger ➔ Personvern og sikkerhet ➔ Skjermopptak** og sørg for at ScreenRec er huket av.
   - Gi tilgang til Kamera og Mikrofon når appen ber om det.

### 🪟 Windows (`.exe`)
1. Last ned `ScreenRec-Setup-1.0.0.exe`.
2. Dobbeltklikk på installasjonsfilen for å installere.
3. Start **ScreenRec** fra skrivebordet eller startmenyen.

### 🐧 Ubuntu / Linux (`.deb` og `.AppImage`)

Ubuntu og andre Linux-distribusjoner krever ofte spesielle grep ved installasjon av tredjeparts `.deb`-pakker. Her er hvordan du løser det:

#### Alternativ 1: `.deb` pakke (Anbefalt via Terminal)
Ubuntu Software Center blokkerer ofte tredjeparts `.deb`-filer. Bruk Terminalen for en ren installasjon:
```bash
# Gå til mappen der du lastet ned filen (f.eks. Downloads):
cd ~/Downloads

# Installer med apt (dette henter automatisk inn eventuelle manglende avhengigheter):
sudo apt install ./ScreenRec_1.0.0_amd64.deb
```
*Hvis du møter en feil om manglende avhengigheter:*
```bash
sudo apt-get install -f
```

*For Ubuntu 24.04 (AppArmor / User Namespaces restriksjon):*
Hvis appen ikke åpner på nyeste Ubuntu 24.04:
```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
# Eller kjør appen med:
screenrec --no-sandbox
```

#### Alternativ 2: `.AppImage` (Kjører direkte uten installasjon)
Krever ingen `sudo` eller installasjon:
```bash
chmod +x ScreenRec-1.0.0.AppImage
./ScreenRec-1.0.0.AppImage
```

---

## 📦 Bygg Installatører (For Utvikler)

Som utvikler kan du bygge ferdige produksjonsfiler:

```bash
# Bygg for Mac (.dmg og .zip):
npm run build:mac

# Bygg for Windows (.exe / NSIS installer):
npm run build:win

# Bygg for Linux (.deb og .AppImage):
npm run build:linux
```
Alle ferdige installatører havner automatisk i mappen **`dist/`**.

---

## 👤 Eier og Utvikler

**Hollman Enrique Salazar Rivero**

- 💬 **WhatsApp:** [wa.me/4797269623](https://wa.me/4797269623) (`+47 972 69 623`)
- 📧 **E-post:** [hollman.rivero@smart-things.site](mailto:hollman.rivero@smart-things.site)

---

## 📄 Lisens og Bruksvilkår

Copyright (c) 2026 **Hollman Enrique Salazar Rivero**. Alle rettigheter forbeholdt.

Dette programmet er kommersiell programvare (Commercial Trialware):
- ✅ **10-minutters gratis prøvetid**: Enhver bruker har rett til å evaluere programmet i 10 minutter med aktiv opptakstid.
- 🔒 **Krav om betalt lisens**: All videre bruk etter prøvetiden krever kjøp av en gyldig lisensnøkkel.
- ❌ **Forbud mot modifisering**: Det er strengt forbudt å endre, dekompilere, tilpasse eller lage avledede verker av kildekoden eller applikasjonen.
- ❌ **Forbud mot videresalg**: Det er strengt forbudt å videreselge, leie ut, viderelisensiere eller redistribuere programmet uten skriftlig tillatelse fra opphavsrettsinnehaveren.

Se filen [LICENSE](LICENSE) for fullstendige juridiske vilkår.
