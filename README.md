# Știri RO

Aplicație desktop pentru Windows care adună știrile publicate de 24 de publicații românești prin fluxurile lor RSS.

## Funcții

- flux comun, ordonat după data publicării;
- filtrare după publicație și căutare în titluri;
- categorii normalizate: Actualitate, Politică, Economie, Externe, Societate, Sănătate, Sport, Tehnologie și Cultură & lifestyle;
- imagine, sursă, oră și scurt extras pentru fiecare articol;
- deschiderea articolului în aplicație, cu revenire la poziția anterioară din listă;
- actualizare manuală și automată la interval configurabil;
- o sursă indisponibilă nu blochează restul fluxului;
- 24 de publicații românești prin fluxurile lor RSS oficiale;
- selector de surse cu derulare;
- opțiune de minimizare în system tray;
- intervale separate de actualizare pentru fereastra vizibilă și system tray;
- cel mult o notificare Windows la 6 ore cu până la 5 articole, configurabilă după sursă, categorie, cuvinte-cheie și ore de liniște;
- surse ascunse, favorite și reordonabile;
- articole salvate, filtru pentru necitite și marcare în masă ca citite;
- știri locale pe baza locației meteo, istoric local și căutare avansată;
- subiecte ascunse prin cuvinte-cheie;
- rezumat zilnic diversificat, cu prioritate pentru sursele favorite;
- backup și restaurare pentru setări, salvate, istoric și starea de citire;
- scurtături de tastatură pentru acțiunile principale;
- teme luminoasă/întunecată/automată, mărime de text și densitate a cardurilor;
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
Pornirea odată cu Windows este administrată exclusiv din **Setări → Pornește odată cu Windows**.

Buildul generează și metadatele necesare actualizării prin GitHub Releases.
Aplicația verifică automat actualizările la pornire și apoi la fiecare 6 ore.
Din **Setări → Actualizări**, utilizatorul poate verifica, descărca și instala o versiune nouă.

## Publicarea unei versiuni

Actualizează câmpul `version` din `package.json`, apoi creează și publică un tag cu aceeași versiune:

```bash
git tag v0.0.9
git push origin v0.0.9
```

Workflow-ul GitHub Actions testează proiectul, construiește installerul Windows și publică automat release-ul și metadatele folosite de updater.
