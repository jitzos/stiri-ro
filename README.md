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

## Funcții experimentale — branch feature/top-stories-topics-stats-sync

Aceste funcții **nu sunt încă incluse în versiunea 0.0.10 în curs de publicare**:

- **Top 10**: selectează până la zece subiecte recente (36 h), combină titluri RSS asemănătoare și favorizează acoperirea din mai multe publicații. Scorul este euristic; **nu este o evaluare editorială independentă și nu garantează că subiectele sunt cele mai importante**.
- **Subiectele mele**: maximum 20 de expresii, cu potrivire locală în titluri și descrieri (diacritice ignorate).
- **Statistici personale**: deschiderile articolelor în ultimele 30 de zile, categorii și publicații, calculate din evenimente păstrate doar local. Nu reconstruim retroactiv istoricul de citire.
- **Transfer Windows–iOS**: în Setări, exportă/importă `StiriRO-sync.json` pentru subiecte urmărite, surse favorite/ascunse, articole salvate, ID-uri citite și evenimente de citire. Fișierul are `app: "StiriRO-sync"` și `formatVersion: 1` pe ambele platforme. Importul **combină** datele (nu le șterge), deci eliminările de favorite ori salvate făcute pe un dispozitiv nu se propagă automat. Transferă fișierul printr-o metodă de încredere și șterge copiile inutile, deoarece conține date personale de citire.

**Limitare:** în această etapă sincronizarea este *manuală*, prin export/import JSON între dispozitive. Sincronizarea automată în cloud, autentificarea și rezolvarea conflictelor necesită un furnizor de stocare aprobat de utilizator și vor fi proiectate separat. Fișierul comun este diferit de backupurile existente Windows/iOS.

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
git tag v0.0.10
git push origin v0.0.10
```

Workflow-ul GitHub Actions testează proiectul, construiește installerul Windows și publică automat release-ul și metadatele folosite de updater.
