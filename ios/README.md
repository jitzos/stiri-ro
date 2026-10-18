# Știri RO pentru iPhone — v0.0.10

Aplicație SwiftUI nativă pentru iOS 16.4 sau mai nou. Proiectul Xcode este generat din `project.yml`, iar `codemagic.yaml` produce o arhivă IPA nesemnată pentru instalare cu Sideloadly.

## Funcții comune cu Windows 0.0.10

- Cele 24 de fluxuri RSS, filtre pe sursă/categorie, căutare, știri salvate și marcaj citit/necitit.
- Istoric local cu cel mult 2.000 de articole, căutare cu diacritice ignorate și filtrare pe perioadă.
- Filtru de știri locale după numele localității selectate; potrivire textuală orientativă, nu un motor geografic.
- Publicații favorite, ascunderea surselor și reordonarea manuală din Setări.
- Cuvinte-cheie excluse din listă, rezumat și notificări.
- Rezumat zilnic ne-AI, cu până la 10 articole din ultimele 24 de ore (maximum 2 pe publicație).
- Prognoză Open-Meteo cu vremea actuală, 24 de ore și următoarele 5 zile, loc automat/manual.
- Backup și restaurare JSON **în formatul aplicației iOS**. Backupurile Windows nu sunt interschimbabile direct.
- Cel mult o notificare locală la 6 ore, cu până la 5 titluri, respectând filtrele și orele de liniște.
- Numărul versiunii este afișat în bara de titlu și în Setări → Despre; versiunea este definită în `project.yml`.

Funcțiile exclusiv Windows (system tray, pornirea odată cu Windows, actualizarea prin instalator NSIS) nu se transferă pe iOS.
Actualizările iOS necesită un nou IPA și reinstalare prin Sideloadly; publicarea automată Windows nu actualizează iPhone-ul.

## Build în Codemagic

1. Adaugă repository-ul `jitzos/stiri-ro` în Codemagic.
2. Alege configurarea din `codemagic.yaml`.
3. Rulează workflow-ul **iOS unsigned IPA for Sideloadly**.
4. Descarcă artifactul `StiriRO-unsigned.ipa`.

Buildul nu cere certificat Apple deoarece Sideloadly semnează aplicația în momentul instalării.

## Instalare cu Sideloadly

1. Instalează Sideloadly și componentele Apple cerute de acesta pe Windows.
2. Conectează iPhone-ul prin USB și confirmă `Trust This Computer`.
3. Trage `StiriRO-unsigned.ipa` în Sideloadly, introdu Apple ID-ul și apasă **Start**.
4. Pe iPhone activează **Developer Mode** dacă este solicitat.
5. Autorizează profilul din **Settings → General → VPN & Device Management**.

Cu un Apple ID gratuit, semnătura expiră de regulă după 7 zile și aplicația trebuie reinstalată. Datele locale pot fi pierdute dacă aplicația este ștearsă înainte de reinstalare.

## Compatibilitate Sideloadly și eroarea bundle_main_missing

Aplicația are numele afișat **Știri RO**, însă numele tehnic al pachetului și executabilului sunt **StiriRO** (fără diacritice), ca să evităm incompatibilități cu parsarea căilor IPA în unele versiuni de Sideloadly.
Arhiva corectă trebuie să conțină `Payload/StiriRO.app/StiriRO` și `Payload/StiriRO.app/Info.plist`; `CFBundleExecutable` trebuie să fie `StiriRO`.
Pe macOS, scriptul `scripts/verify-ios-ipa.sh` verifică executabilul Mach-O ARM64, permisiunile și versiunea.
Dacă Sideloadly continuă să afișeze `bundle_main_missing`, descarcă din nou IPA-ul corectat și asigură-te că nu selectezi o copie mai veche.

## Verificări înainte de instalare

Verificarea de compilare pentru simulator și testele Node rulează în GitHub Actions pe pull request, fără să creeze release.
Codemagic compilează IPA-ul pentru dispozitiv când rulezi explicit workflow-ul `ios-sideload` pe versiunea dorită.

## Limitări iOS

- Aplicația verifică fluxurile la deschidere, manual și cât timp rămâne activă.
- iOS suspendă aplicațiile sideloaded în fundal; verificarea periodică și notificările locale nu sunt garantate când aplicația este închisă.
- Push-ul Apple real necesită capabilitatea APNs și, în practică, Apple Developer Program plus un serviciu care trimite notificările.

