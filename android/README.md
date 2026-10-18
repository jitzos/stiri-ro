# Știri RO Android 0.0.10 — versiune de test

Proiect Android nativ (Kotlin, Jetpack Compose), în același repository cu Windows și iOS.

## Funcții disponibile în primul APK

- Cele **24 de publicații RSS** definite în proiectul iOS, categorii, căutare și filtrare
- **Top 10** subiecte recente, grupate euristic după similaritatea titlurilor
- **Subiectele mele**, filtre de excludere și surse favorite/ascunse
- Articole salvate, citite/necitite, istoric local (până la 2.000), citire în aplicație
- Rezumate dimineața/seara, statisticile articolelor deschise pe ultimele 30 de zile
- Vreme Open-Meteo pentru un oraș ales manual (24 de ore și 5 zile)
- Notificări locale grupate, maximum 5 articole, cel puțin 6 ore între notificări, ore de liniște
- Import/export **StiriRO-sync.json**, același format ca Windows și iOS (manual)

**Limite cunoscute ale acestei prime versiuni:** Localizarea meteo este manuală; prima versiune nu include detecția automată GPS. Nu există încă sincronizare automată în cloud. Actualizarea RSS în prim-plan folosește intervalul ales; în fundal, Android poate amâna semnificativ lucrările WorkManager, deci notificările nu sosesc garantat la o oră fixă. Rezumatele sunt selecții locale, nu notificări programate la ore fixe. Nu există încă distribuție prin Google Play.

## APK de test prin GitHub Actions

1. Deschide workflow-ul **Build Android test APK** din secțiunea Actions a repository-ului.
2. După un build reușit, descarcă artifactul **StiriRO-Android-0.0.10-debug-APK**.
3. Dezarhivează și transferă `app-debug.apk` pe Android.
4. Permite instalarea din sursa aleasă când Android solicită aprobarea.

Debug APK este semnat automat cu o **cheie de dezvoltare generată de GitHub Actions**. Pentru actualizări care să păstreze datele între builduri este necesară o cheie de semnare Android stabilă. Nu este o versiune destinată publicării în Google Play.

## Build local

Deschide folderul `android/` în Android Studio (JDK 17), sau, cu Gradle 8.7 și Android SDK 34 instalate, rulează `gradle :app:assembleDebug` din acel folder. Minimum Android 8.0 (API 26).

Datele de citire, filtrele și statisticile rămân local pe telefon. Fișierele JSON transferate conțin informații despre citire: folosește o metodă de transfer de încredere.
