# App nativa iOS (K'apul'Its) — build e instalación sin App Store

App familiar. La web sigue igual en GitHub Pages. La app iOS es un cascarón
Capacitor que empaqueta la misma web y le da **Bluetooth nativo** (CoreBluetooth),
lo único que iOS no permite desde Safari. Un iPhone puede ser el servidor de
impresión.

## Qué hace un iPhone que la web no podía
- Conectar e imprimir por Bluetooth directo (Safari no tiene Web Bluetooth).
- Con la conexión BLE activa + modo `bluetooth-central`, **sigue imprimiendo con la
  pantalla apagada o la app en segundo plano** (no si la cierras a la fuerza).

## Requisito honesto de instalación (léelo antes)
Apple no deja instalar un `.ipa` libre como un `.apk` de Android. Para tus iPhones:

- **Gratis (Apple ID personal):** Xcode instala directo al iPhone conectado, PERO
  la app **caduca a los 7 días** y hay que reinstalar cada semana por cable. No
  sirve para teléfonos fijos en un punto.
- **Apple Developer Program ($99 USD/año) — lo que necesitas:** registras el UDID
  de cada iPhone (hasta 100), exportas un `.ipa` **Ad Hoc** firmado ~1 año e
  instalas por cable (Apple Configurator) o por enlace. Sin revisión de App Store.
  Se re-firma una vez al año.

Sin el plan de $99/año, la instalación estable no es posible (solo la de 7 días).

## Primera vez (una sola vez en tu Mac)

1. CocoaPods (no está instalado):
   ```bash
   sudo gem install cocoapods
   ```
2. Dependencias JS (ya instaladas si corriste `npm install`):
   ```bash
   npm install
   ```
3. Genera assets del cascarón y agrega la plataforma iOS:
   ```bash
   npm run bridge   # compila native-bridge.js
   npm run www      # copia la web a www/
   npx cap add ios  # crea ios/ (necesita CocoaPods)
   ```
4. Permisos Bluetooth: edita `ios/App/App/Info.plist` y agrega dentro de `<dict>`:
   ```xml
   <key>NSBluetoothAlwaysUsageDescription</key>
   <string>K'apul'Its usa Bluetooth para conectar la impresora de tickets.</string>
   <key>UIBackgroundModes</key>
   <array>
     <string>bluetooth-central</string>
   </array>
   ```
5. Abre Xcode:
   ```bash
   npm run open:ios
   ```
   En el target **App → Signing & Capabilities**: elige tu Team (tu Apple ID o la
   cuenta Developer $99). Bundle id: `com.kapulits.pos`.

## Registrar e instalar en cada iPhone
- Conecta el iPhone al Mac. En Xcode aparece como destino.
- Xcode registra el UDID automáticamente al primer build a ese equipo (con cuenta
  Developer). Dale **Run** (▶) para instalar.
- En el iPhone: Ajustes → General → VPN y gestión de dispositivos → confía en tu
  perfil de desarrollador (solo la primera vez).
- Para varios equipos sin cable: en Xcode **Product → Archive → Distribute App →
  Ad Hoc**, genera el `.ipa` e instálalo con Apple Configurator.

## Actualizar la app (cada cambio de código)
La web (GitHub Pages) se actualiza como siempre con `git push`. La **app nativa
NO** se actualiza sola: hay que reconstruir e reinstalar.
```bash
npm run sync:ios     # bridge + www + cap sync ios
npm run open:ios     # Xcode → Run en cada iPhone (o Archive → Ad Hoc → instalar)
```
Solo necesitas rehacer `npx cap add ios` / Info.plist si borras la carpeta `ios/`.

## Probar la impresora (en iPhone real, no simulador)
El Bluetooth NO existe en el simulador. En un iPhone físico:
1. Admin → Impresora → **Conectar Bluetooth** → sale el selector nativo de iOS.
2. **Ticket de prueba**. Si sale, prende **"Este equipo es la impresora servidor"**.
3. Desde otro teléfono crea un pedido y confirma que imprime solo.

## Notas
- La app carga las librerías (React, etc.) desde CDN: necesita wifi al abrir. Si
  quieres que arranque 100% sin internet, hay que bajar esas librerías a la app
  (paso extra, no incluido).
- El service worker se desactiva solo dentro de la app (rompe el bridge nativo);
  en web sigue activo.
