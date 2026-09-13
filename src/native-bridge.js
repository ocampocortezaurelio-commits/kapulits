// Puente Bluetooth nativo para la app iOS (Capacitor + CoreBluetooth).
// esbuild lo empaqueta a ../native-bridge.js (npm run bridge). En web es inerte:
// Capacitor.isNativePlatform() es false, asi que index.html nunca lo usa.
//
// Expone window.NativePrinter con la misma forma que espera index.html:
//   available()  -> true solo dentro de la app nativa
//   isConnected()-> hay impresora conectada por BLE
//   connect()    -> muestra el selector nativo de iOS, conecta y recuerda el equipo
//   reconnect()  -> reconecta al equipo recordado (auto-arranque)
//   send(text)   -> manda ESC/POS por BLE en trozos; devuelve true/false
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

// Mismos servicios candidatos que el camino web (impresoras ESC/POS BLE comunes).
const SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];
const LS_KEY = 'kapulits_ble_device';

let deviceId = null;
let svcUuid = null;
let chrUuid = null;
let writeNoResp = true;
let connected = false;
let inited = false;

async function ensureInit() {
  if (inited) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  inited = true;
}

// Elige la primera caracteristica de escritura; prefiere una dentro de un
// servicio conocido de impresora, si existe.
function pickWritable(services) {
  let fallback = null;
  for (const s of services) {
    for (const c of s.characteristics || []) {
      const w = c.properties && (c.properties.write || c.properties.writeWithoutResponse);
      if (!w) continue;
      const hit = { s: s.uuid, c: c.uuid, wnr: !!c.properties.writeWithoutResponse };
      if (SERVICES.includes(String(s.uuid).toLowerCase())) return hit;
      if (!fallback) fallback = hit;
    }
  }
  return fallback;
}

async function doConnect(id) {
  await BleClient.connect(id, () => { connected = false; });
  const services = await BleClient.getServices(id);
  const picked = pickWritable(services);
  if (!picked) { try { await BleClient.disconnect(id); } catch (e) {} throw new Error('La impresora no expone una caracteristica de escritura'); }
  deviceId = id; svcUuid = picked.s; chrUuid = picked.c; writeNoResp = picked.wnr; connected = true;
}

async function connect() {
  await ensureInit();
  const device = await BleClient.requestDevice({ optionalServices: SERVICES }); // selector nativo iOS
  await doConnect(device.deviceId);
  try { localStorage.setItem(LS_KEY, device.deviceId); } catch (e) {}
  return { success: true, name: device.name || 'Impresora BT' };
}

async function reconnect() {
  if (connected) return true;
  let id = deviceId;
  if (!id) { try { id = localStorage.getItem(LS_KEY); } catch (e) {} }
  if (!id) return false;
  try { await ensureInit(); await doConnect(id); return true; } catch (e) { return false; }
}

async function send(text) {
  if (!connected && !(await reconnect())) return false;
  const bytes = Uint8Array.from(Array.from(text, (c) => c.charCodeAt(0) & 0x7f));
  const CHUNK = 180; // MTU BLE tipico; troceado como en el camino USB
  try {
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      const view = new DataView(slice.buffer, slice.byteOffset, slice.byteLength);
      if (writeNoResp) await BleClient.writeWithoutResponse(deviceId, svcUuid, chrUuid, view);
      else await BleClient.write(deviceId, svcUuid, chrUuid, view);
    }
    return true;
  } catch (e) { connected = false; return false; }
}

window.NativePrinter = {
  available: () => { try { return Capacitor.isNativePlatform(); } catch (e) { return false; } },
  isConnected: () => connected,
  connect,
  reconnect,
  send,
};
