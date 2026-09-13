// Copia los assets web al directorio www/ que Capacitor empaqueta en la app.
// Ejecuta primero `npm run bridge` para que native-bridge.js exista.
import { mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

// Archivos que necesita la app para correr (mismo set que GitHub Pages).
const ASSETS = [
  'index.html',
  'native-bridge.js',
  'manifest.json',
  'logo.svg',
  'icon-192.png',
  'icon-512.png',
  'coin.mp3',
  'print.mp3',
  // sw.js se incluye pero index.html NO lo registra dentro de la app nativa.
  'sw.js',
];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

let faltan = [];
for (const f of ASSETS) {
  const src = join(root, f);
  if (!existsSync(src)) { faltan.push(f); continue; }
  copyFileSync(src, join(www, f));
}

if (faltan.includes('native-bridge.js')) {
  console.error('Falta native-bridge.js. Corre primero: npm run bridge');
  process.exit(1);
}
if (faltan.length) console.warn('Avisos, no copiados (no existen):', faltan.join(', '));
console.log('www/ listo con', ASSETS.length - faltan.length, 'archivos.');
