# Știri RO

Aplicație desktop pentru Windows care adună știrile publicate de 24 de publicații românești prin fluxurile lor RSS.

## Funcții

- flux comun, ordonat după data publicării;
- filtrare după publicație și căutare în titluri;
- categorii normalizate: Actualitate, Politică, Economie, Externe, Societate, Sănătate, Sport, Tehnologie și Cultură & lifestyle;
- imagine, sursă, oră și scurt extras pentru fiecare articol;
- deschiderea articolului în aplicație, cu revenire la poziția anterioară din listă;
- actualizare manuală și automată la fiecare 10 minute;
- o sursă indisponibilă nu blochează restul fluxului.
- 24 de publicații românești prin fluxurile lor RSS oficiale;
- selector de surse cu derulare;
- opțiune de minimizare în system tray;
- actualizare la fiecare 10 minute cât timp fereastra este vizibilă și la fiecare 5 minute când aplicația este ascunsă în system tray.
- installer Windows cu pornire opțională la autentificare;
- actualizări automate prin GitHub Releases.

## Dezvoltare

```bash
npm install
npm start
```

## Teste

```bash
npm test
```

## Pachet Windows

Pe Linux sau Windows:

```bash
npm run package:win
```

Installerul NSIS va fi creat în `release/installer/StiriRO-Setup-<versiune>.exe`.
La instalare, utilizatorul poate alege dacă aplicația pornește odată cu Windows.
Setarea poate fi schimbată ulterior din **Setări → Pornește odată cu Windows**.

Buildul generează și metadatele necesare actualizării prin GitHub Releases.
Aplicația verifică automat actualizările la pornire și apoi la fiecare 6 ore.
Din **Setări → Actualizări**, utilizatorul poate verifica, descărca și instala o versiune nouă.

## Publicarea unei versiuni

Actualizează câmpul `version` din `package.json`, apoi creează și publică un tag cu aceeași versiune:

```bash
git tag v0.0.4
git push origin v0.0.4
```

Workflow-ul GitHub Actions testează proiectul, construiește installerul Windows și publică automat release-ul și metadatele folosite de updater.
