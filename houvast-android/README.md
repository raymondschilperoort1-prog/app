# Houvast Android

Android Trusted Web Activity voor de Houvast-PWA.

- Appnaam: `Houvast`
- Pakketnaam: `nl.vertierkaartjes.houvast`
- Website: `https://app.vertierkaartjes.nl/`
- `compileSdk`: 36
- `targetSdk`: 36
- `minSdk`: 23

## Belangrijk voor volledig scherm en pushmeldingen

Publiceer `assetlinks.json` zonder redirect en met contenttype `application/json` op:

`https://app.vertierkaartjes.nl/.well-known/assetlinks.json`

Voor een via Google Play geïnstalleerde app moet dit bestand de SHA-256-vingerafdruk van de **Play-app-ondertekeningssleutel** bevatten. De buildartifact bevat daarnaast een bestand met de upload-sleutelvingerafdruk voor lokaal testen.

## Build

De GitHub Actions-workflow maakt:

- een ondertekende `Houvast-release.aab` voor Google Play;
- een ondertekende `Houvast-release.apk` voor directe testinstallatie;
- een nieuwe uploadkeystore en bijbehorende bewaargegevens;
- een voorbeeld van `assetlinks.json`;
- SHA-256-controlesommen.

Bewaar de uploadkeystore en wachtwoorden veilig. Zonder deze sleutel kan een volgende update niet met dezelfde uploadidentiteit worden ondertekend, tenzij Google Play een upload-key reset uitvoert.
