# Știri RO pentru iPhone

Aplicație SwiftUI nativă pentru iOS 16.4 sau mai nou. Proiectul Xcode este generat din `project.yml`, iar `codemagic.yaml` produce o arhivă IPA nesemnată pentru instalare cu Sideloadly.

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

## Limitări iOS

- Aplicația verifică fluxurile la deschidere, manual și cât timp rămâne activă.
- iOS suspendă aplicațiile sideloaded în fundal; verificarea periodică și notificările locale nu sunt garantate când aplicația este închisă.
- Push-ul Apple real necesită capabilitatea APNs și, în practică, Apple Developer Program plus un serviciu care trimite notificările.

