// Verificacion del folio de pedido. Es el numero que el cliente ve impreso en
// papel y con el que el dueno busca el pedido en la app: si dos dispositivos lo
// resuelven distinto, el ticket deja de coincidir con la pantalla (bug real
// reportado: "el ticket dice 5 y la app dice 4").
//
//   node test_folios.mjs
//
// Sin framework: extrae las funciones de merge del index.html y las ejercita.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');

function extraer(nombre){
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, `no se encontro function ${nombre} en index.html`);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  throw new Error(`llave sin cerrar en ${nombre}`);
}

const cuerpo = ['_mergeById','_mergePedidos','_mergeJornada'].map(extraer).join('\n');
// _repairVentas no participa en el folio: se sustituye por identidad.
const {_mergePedidos, _mergeJornada} = new Function(
  `const _repairVentas = v => v;\n${cuerpo}\nreturn {_mergePedidos, _mergeJornada};`
)();

const jornada = pedidos => ({id:'j1', pedidos, mandaditos:[], gastos:[], ventas:[], contadorPedido:6});
const folios = j => Object.fromEntries(j.pedidos.map(p => [p.id, p.numero]));

// Dos meseros crean un pedido a la vez sin haber sincronizado: ambos toman el 5.
const enCaja   = {id:'a', numero:5, _ts:'2026-09-07T17:00:00.000Z', hora:'11:00 a.m.', total:10};
const enMesero = {id:'b', numero:5, _ts:'2026-09-07T17:00:01.000Z', hora:'11:00 a.m.', total:20};

const desdeCaja   = _mergeJornada(jornada([enCaja]),   jornada([enMesero]));
const desdeMesero = _mergeJornada(jornada([enMesero]), jornada([enCaja]));

// 1. Los dos dispositivos llegan al MISMO folio para cada pedido.
assert.deepEqual(folios(desdeCaja), folios(desdeMesero), 'los dispositivos asignaron folios distintos');

// 2. Gana el que se creo primero; el otro se corre al siguiente libre.
assert.deepEqual(folios(desdeCaja), {a:5, b:6});

// 3. El folio que YA SE IMPRIMIO queda registrado para poder buscar el papel.
const renumerado = desdeCaja.pedidos.find(p => p.id === 'b');
assert.deepEqual(renumerado.foliosPrevios, [5]);

// 4. Los objetos de entrada no se mutan (vienen de la nube y se comparten).
assert.equal(enCaja.numero, 5);
assert.equal(enMesero.numero, 5);

// 5. El contador queda por encima del folio mas alto: el siguiente pedido no
//    puede repetir un numero ya entregado.
assert.equal(desdeCaja.contadorPedido, 7);

// 6. Volver a fusionar el resultado no vuelve a mover los folios.
const otraVez = _mergeJornada(desdeCaja, desdeCaja);
assert.deepEqual(folios(otraVez), {a:5, b:6});

// 7. Sin colision no se toca nada.
const sinColision = _mergePedidos(
  [{id:'x', numero:1, _ts:'2026-09-07T17:00:00.000Z'}],
  [{id:'y', numero:2, _ts:'2026-09-07T17:00:01.000Z'}]
);
assert.deepEqual(sinColision.map(p => p.numero), [1, 2]);
assert.ok(!sinColision.some(p => p.foliosPrevios));

console.log('folios: 7 verificaciones OK');
