// Verificacion de tickets (v2.13): ticket de COCINA (letra grande, sin dinero ni
// datos del local), ticket de CLIENTE sin destinos duplicados en "recoger", y
// comensales (personas de la mesa) que no se fusionan al agregar rondas.
//
//   node test_tickets.mjs
//
// Sin framework: extrae las funciones/constantes del index.html y las ejercita.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');

// Desde `inicio` hasta el cierre de la llave/expresion a profundidad 0.
function cortar(inicio, desc){
  const i = src.indexOf(inicio);
  assert.ok(i >= 0, `no se encontro ${desc} en index.html`);
  let d = 0, abierto = false;
  for (let k = i; k < src.length; k++){
    const c = src[k];
    if ('{[('.includes(c)){ d++; abierto = true; }
    else if ('}])'.includes(c)) d--;
    else if (c === ';' && d === 0) return src.slice(i, k + 1);
    if (abierto && d === 0 && c === '}' && inicio.startsWith('function')) return src.slice(i, k + 1);
  }
  throw new Error(`sin cierre: ${desc}`);
}
const fn = n => cortar(`function ${n}(`, n);
const cn = n => cortar(`const ${n}=`, n);
const cs = n => cortar(`const ${n} =`, n);

const codigo = [
  cs('NEGOCIO'), cs('TARIFAS_ENVIO'), cs('COMBO_DESC'),
  cn('recogerTipoLabel'), cn('tipoLabelDe'), cn('destinoTicket'), cn('nombreGenerico'),
  cn('comensalesDe'), cn('agruparPorComensal'), cn('esMesa'), cn('rondasDe'), cn('componentesCombo'),
  cn('ACCENT_MAP'), cn('EMOJI_MAP'), fn('sanitize'), cn('TICKET_COLS'), fn('_wrapWords'), fn('_ticketField'),
  cn('_lineaItem'), fn('_buildBTText'), cn('COCINA_ESC'), cn('COCINA_COLS'), fn('_buildCocinaText'),
  fn('lineaUid'), fn('buildItem'), fn('mismaLinea'),
].join('\n');
const api = new Function(
  `const fmt=n=>'$'+Number(n||0);\n${codigo}\nreturn {tipoLabelDe,nombreGenerico,_buildBTText,_buildCocinaText,buildItem,mismaLinea,comensalesDe};`
)();

const mesa = {
  numero: 7, fecha: '2026-10-08', hora: '13:00', tipoEntrega: 'mesa_2', tipoLabel: 'Mesa 2 · Adentro',
  cliente: 'Cliente Mesa 2', sinNombre: true, telefono: '', direccion: '', notas: 'sin cebolla',
  items: [
    { productoId: 'qm', id: 'l1', nombre: 'Quesabirria de mano', cantidad: 5, precio: 30, subtotal: 150, comensal: 1 },
    { productoId: 'qm', id: 'l2', nombre: 'Quesabirria de mano', cantidad: 1, precio: 30, subtotal: 30, comensal: 2 },
  ],
  totalProductos: 180, costoEnvio: 0, total: 180,
};

// ── Cocina: grande, minimo, por persona ──────────────────────────────
const coc = api._buildCocinaText(mesa);
assert.ok(coc.startsWith('\x1b@\x1b!0'), 'cocina inicia con reset + doble tamano');
assert.ok(coc.includes('#007 MESA 2'), coc);
assert.ok(coc.includes('PERSONA 1') && coc.includes('PERSONA 2'), 'separa por persona');
assert.ok(coc.indexOf('PERSONA 1') < coc.indexOf('5x Quesabirria') && coc.indexOf('5x Quesabirria') < coc.indexOf('PERSONA 2'));
assert.ok(coc.includes('NOTA: SIN') && coc.includes('CEBOLLA'), 'nota envuelta a 16 col');
for (const prohibido of ['$', "K'APUL", 'Gracias', '981', 'Escarcega', 'TOTAL', 'Cliente'])
  assert.ok(!coc.includes(prohibido), `cocina no debe llevar "${prohibido}"`);
for (const l of coc.replace(/\x1b[@!]./g, '').split('\n')) assert.ok(l.length <= 16, `linea >16 col: "${l}"`);

// Ronda: solo la tanda nueva.
const ronda = { n: 2, items: [{ productoId: 'cc', nombre: 'Coca-Cola', cantidad: 2, precio: 35, subtotal: 70, comensal: 2 }] };
const cocR = api._buildCocinaText(mesa, ronda);
assert.ok(cocR.includes('RONDA 2') && cocR.includes('2x Coca-Cola') && !cocR.includes('Quesabirria'));

// Llevar: destino + subtipo, nunca "PASA A RECOGER".
const llevar = { ...mesa, numero: 12, tipoEntrega: 'recoger', tipoLabel: 'Pasa a recoger', recogerTipo: 'mandaditos', sinNombre: false, cliente: 'Ana',
  items: [{ productoId: 'qm', nombre: 'Quesabirria de mano', cantidad: 3, precio: 30, subtotal: 90 }] };
const cocL = api._buildCocinaText(llevar);
assert.ok(cocL.includes('#012 LLEVAR') && cocL.includes('MANDADITOS') && !cocL.includes('PERSONA'));

// ── Cliente: un solo destino en recoger ──────────────────────────────
const cli = api._buildBTText(llevar);
assert.ok(cli.includes('MANDADITOS'));
assert.ok(!cli.includes('PASA A RECOGER'), 'sin destino duplicado');
assert.equal(cli.split('MANDADITOS').length - 1, 1, 'MANDADITOS aparece una vez');
assert.ok(cli.includes('Cliente: Ana'));
// Mesa por persona: subtotales por persona y sin el nombre generico.
const cliM = api._buildBTText(mesa);
assert.ok(cliM.includes('PERSONA 1') && cliM.includes('Subtotal persona 1:') && !cliM.includes('Cliente:'));

// ── Etiquetas ────────────────────────────────────────────────────────
assert.equal(api.tipoLabelDe({ tipoEntrega: 'recoger', tipoLabel: 'Pasa a recoger', recogerTipo: 'cliente' }), 'El cliente pasa');
assert.equal(api.tipoLabelDe({ tipoEntrega: 'recoger', tipoLabel: 'Pasa a recoger' }), 'Pasa a recoger', 'legacy intacto');
assert.equal(api.tipoLabelDe({ tipoEntrega: 'mesa_1', tipoLabel: 'Mesa 1 · Afuera' }), 'Mesa 1 · Afuera', 'etiqueta congelada manda');
assert.equal(api.nombreGenerico('mesa_2'), 'Cliente Mesa 2');
assert.equal(api.nombreGenerico('mesa_barra'), 'Cliente Barra');
assert.equal(api.nombreGenerico('recoger'), 'Cliente sin nombre');

// ── Comensales: no se pierden ni se fusionan ─────────────────────────
const a = api.buildItem({ id: 'qm', productoId: 'qm', nombre: 'Quesabirria de mano', cantidad: 1, precio: 30, subtotal: 30, comensal: 1 });
const b = api.buildItem({ id: 'qm', productoId: 'qm', nombre: 'Quesabirria de mano', cantidad: 1, precio: 30, subtotal: 30, comensal: 2 });
assert.equal(a.comensal, 1);
assert.ok(a.id && a.id !== 'qm' && a.id !== b.id, 'cada persona con linea propia');
assert.equal(api.mismaLinea(a, b), false, 'persona distinta = otra linea');
assert.equal(api.mismaLinea(a, { ...b, comensal: 1, id: 'otro' }), true, 'misma persona, mismo platillo = suma');
assert.equal(api.mismaLinea(a, { ...a, nombre: 'Agua · Jamaica' }), false, 'sabor distinto no se fusiona');
const legacy = { productoId: 'qm', nombre: 'Q', cantidad: 1, precio: 30, subtotal: 30 };
assert.equal(api.mismaLinea(legacy, { ...legacy }), true, 'sin comensal: comportamiento previo');
assert.deepEqual(api.comensalesDe(mesa.items), [1, 2]);

console.log('test_tickets: OK');
