# Reporte: Automatización de pedidos por WhatsApp → impresión automática

**Proyecto:** K'apul'Its (App Birria) · **Fecha:** 2026-08-17

## 1. Qué quieres lograr

Que el número de WhatsApp del negocio **atienda solo**: el cliente escribe, un
asistente le muestra el menú, arma el pedido, le confirma **qué pidió, a dónde
va y cuánto cuesta**, y cuando el cliente dice "sí", el pedido **entra a la app y
se imprime automáticamente** en la impresora Bluetooth, sin que nadie lo capture
a mano.

Esto es factible. No es un cambio pequeño: la app de hoy es 100% del lado del
dispositivo (una PWA con datos en el navegador + Supabase). Para atender WhatsApp
en automático se necesita **una pieza nueva que viva en internet 24/7** (un
servidor/servicio), porque WhatsApp no puede "entrar" a una app que solo corre en
tu teléfono. Abajo está todo lo que se necesita.

---

## 2. El flujo ideal, paso a paso

1. Cliente manda mensaje al WhatsApp del negocio.
2. El asistente responde: saludo + menú (con precios).
3. Cliente arma su pedido (texto libre o botones/lista).
4. El asistente pregunta lo que falte: **tipo** (recoger / mesa / envío),
   **dirección** si es envío, y calcula **subtotal + costo de envío + total**.
5. El asistente manda un **resumen para confirmar**: productos, dirección, total.
6. Cliente confirma ("sí, así está").
7. El pedido se **guarda en la base de datos compartida** (Supabase) como
   "pendiente / origen: WhatsApp".
8. La app, abierta en tu dispositivo, **detecta el pedido nuevo en tiempo real**
   y lo **imprime automáticamente** (ya existe `printTicket`), y opcionalmente te
   avisa con sonido.
9. El pedido aparece en la pantalla de Pedidos como cualquier otro, listo para
   cobrar. Todo el flujo de caja/cierre sigue igual.

---

## 3. Arquitectura propuesta

```
[Cliente WhatsApp]
      │  (mensajes)
      ▼
[WhatsApp Cloud API de Meta]  ← número oficial de negocio
      │  webhook (cada mensaje)
      ▼
[Backend en la nube 24/7]  ── Vercel Functions (o similar)
   • recibe el mensaje
   • motor de conversación (menú + entender el pedido)
   • calcula totales y envío
   • pide confirmación
      │  al confirmar, escribe el pedido
      ▼
[Supabase]  ← MISMA base que ya usa la app (tabla de pedidos pendientes)
      │  realtime (aviso de pedido nuevo)
      ▼
[Tu app / PWA en el dispositivo]
   • escucha Supabase en tiempo real
   • auto-imprime (printTicket, ya existe) + sonido
   • muestra el pedido en la lista para cobrar
```

**Idea clave:** Supabase es el "puente". El bot **no** habla directo con la
impresora (no puede). El bot deja el pedido en Supabase; tu app —que sí está
conectada a la impresora— lo recoge y lo imprime. Ustedes **ya usan Supabase**,
así que media arquitectura ya existe.

---

## 4. Componentes que se necesitan (con opciones y recomendación)

### 4.1 Número + API de WhatsApp
- **Recomendado: WhatsApp Cloud API (oficial de Meta).** Es la vía legítima para
  automatizar. Gratis en volúmenes bajos; requiere una **cuenta de Meta Business
  verificada** y un número dedicado (no puede ser el mismo que usas en la app de
  WhatsApp normal en el teléfono; se puede migrar un número o usar uno nuevo).
- Alternativas (más caras/rápidas de montar): Twilio, 360dialog, Gupshup. Cobran
  por encima de Meta pero simplifican el alta.
- **Evitar** librerías no oficiales (whatsapp-web.js, Baileys): violan términos de
  WhatsApp y **pueden banear tu número**. Para un negocio real, no.

### 4.2 Backend en la nube (el cerebro, 24/7)
- Recibe los webhooks de WhatsApp y responde. Debe estar siempre encendido.
- **Recomendado: Vercel Functions** (ya tienes el entorno de Vercel disponible).
  También sirve Supabase Edge Functions, o cualquier Node en un host.
- Aquí vive la lógica de conversación, cálculo de totales y la escritura del
  pedido en Supabase.

### 4.3 Motor de conversación (entender el pedido)
Dos caminos, combinables:
- **A) Estructurado (botones y listas de WhatsApp).** El cliente elige del menú
  con botones. Más barato, más predecible, menos "inteligente". Bueno para el MVP.
- **B) Lenguaje natural con IA (Claude API).** El cliente escribe "2 combos
  jarocho y una agua de un litro para llevar a tal dirección" y la IA lo traduce
  a productos del menú, cantidades y tipo de entrega. Más natural, costo por
  mensaje bajo, pero hay que **validar contra el menú real** para no inventar
  productos ni precios.
- **Recomendación:** empezar estructurado (A) para el MVP y añadir IA (B) encima
  cuando el flujo básico ya imprima bien.

### 4.4 Base de datos compartida
- **Supabase, la que ya usan.** Solo hay que definir/usar una tabla de pedidos
  pendientes con un campo `origen = 'whatsapp'` y estado `pendiente_confirmacion`.
- El menú, precios y tarifas de envío deben quedar como **fuente única** que
  lean tanto la app como el bot (hoy el menú vive en la app; conviene exponerlo
  en Supabase para que el bot use exactamente los mismos precios).

### 4.5 Puente con la app + auto-impresión
- La app debe **suscribirse a Supabase Realtime** y, al llegar un pedido
  `origen=whatsapp`, ejecutar `printTicket` (ya existe) + sonido, e insertarlo en
  la jornada activa.
- **Limitación real a tener clara:** la impresión Bluetooth exige que la app esté
  **abierta en el dispositivo conectado a la impresora**. Si el teléfono está
  apagado o la app cerrada, el pedido se guarda pero no imprime hasta que la
  abras. (Mitigación: dejar una tablet/teléfono dedicado siempre encendido con la
  app abierta, tipo "estación de impresión".)

---

## 5. Cómo encaja con lo que YA tienen (a favor)

- **Ya usan Supabase** → el puente de datos ya existe, solo hay que darle una
  tabla/estado para pedidos entrantes.
- **Ya existe `printTicket` y la conexión Bluetooth/USB** → la impresión
  automática reusa código actual; solo hay que dispararla desde el evento de
  Supabase.
- **Ya tienen el ticket como imagen** (recién agregado) → el bot puede mandarle
  al cliente la **misma imagen del ticket** como confirmación por WhatsApp.
- **El modelo de caja/cierre no cambia**: un pedido de WhatsApp entra igual que
  uno capturado a mano y sigue el mismo flujo de cobro y cierre.

---

## 6. Requisitos previos (lo que hay que gestionar)

1. **Cuenta de Meta Business + verificación del negocio** (documentos del
   negocio). Puede tardar días.
2. **Número dedicado** para la API (nuevo o migrado). Ojo: al migrarlo a la API
   deja de funcionar en la app normal de WhatsApp de ese teléfono.
3. Alta de la app en el **panel de desarrolladores de Meta** y configuración del
   webhook.
4. Un **host 24/7** para el backend (Vercel u otro).
5. Definir el **menú/precios/zonas de envío como fuente única** accesible por el
   bot.

---

## 7. Costos estimados (orden de magnitud, no cotización)

- **WhatsApp Cloud API:** las conversaciones de servicio (cuando el cliente te
  escribe primero) son de bajo costo o gratis dentro de límites; las plantillas
  iniciadas por el negocio se cobran por conversación. Para un negocio local el
  costo mensual suele ser bajo (unos pocos dólares a decenas, según volumen).
- **Host del backend (Vercel):** plan gratuito puede alcanzar para empezar;
  crecer a un plan de pago si sube el volumen.
- **Supabase:** ya lo pagan/usan; el uso extra es marginal.
- **IA (Claude API), si se usa el camino B:** costo por mensaje muy bajo; con
  cientos de pedidos al mes sigue siendo económico.
- **Desarrollo:** es el costo real principal (tiempo de implementación e
  integración), no la infraestructura.

---

## 8. Riesgos y cosas a cuidar

- **Baneo de número** si se usan librerías no oficiales → usar solo Cloud API.
- **La app debe estar abierta** para imprimir (limitación de Bluetooth en
  navegador) → estación de impresión dedicada siempre encendida.
- **Errores de interpretación del pedido** (sobre todo con IA) → **confirmación
  obligatoria** antes de imprimir; el cliente debe decir "sí" al resumen.
- **Precios desincronizados** entre app y bot → menú como fuente única.
- **Horario**: definir qué responde el bot fuera de horario (mensaje de "abrimos
  a tal hora") para no aceptar pedidos que no se van a preparar.
- **Datos personales** (dirección/teléfono del cliente): se guardan en Supabase;
  cuidar acceso y no exponerlos.

---

## 9. Plan por fases (recomendado)

**Fase 0 — Preparación (gestión, sin código de más):**
Cuenta Meta Business, número dedicado, verificación, y exponer menú/precios en
Supabase como fuente única.

**Fase 1 — MVP "recibir e imprimir" (el salto de valor real):**
- Bot con menú por **botones/listas** (sin IA todavía).
- Cliente arma pedido → confirma → se guarda en Supabase.
- App escucha Supabase y **auto-imprime** + sonido + aparece en Pedidos.
- Resultado: pedidos de WhatsApp entran e imprimen solos. Ya es un gran avance.

**Fase 2 — Confirmación rica y envío:**
- Cálculo de zonas de envío y dirección.
- Mandar al cliente la **imagen del ticket** como confirmación.
- Manejo de horario y de "pedido recibido / en preparación".

**Fase 3 — Lenguaje natural (IA):**
- Claude API para entender pedidos escritos libres, validados contra el menú.
- Sugerencias, combos, "lo de siempre" para clientes frecuentes.

**Fase 4 — Extras:**
- Estados hacia el cliente (recibido → listo), encuestas, reordenar con un clic.

---

## 10. Decisiones que necesito de ti para arrancar

1. **Número:** ¿usamos uno nuevo para la API, o migramos el actual? (migrar el
   actual lo saca de la app normal de WhatsApp de ese teléfono).
2. **Estación de impresión:** ¿puedes dejar una tablet/teléfono siempre encendido
   con la app abierta junto a la impresora?
3. **Alcance del MVP:** ¿arrancamos con menú por botones (más rápido y seguro) o
   quieres directo el de texto libre con IA?
4. **Envíos:** ¿el bot debe calcular costo por zona/dirección, o al inicio solo
   "recoger" y "envío tarifa fija"?
5. **Horario de atención** del bot.

Con esas respuestas puedo detallar Fase 0 + Fase 1 con tareas concretas y una
estimación de tiempo.

---

### Nota honesta de alcance
Esto es un proyecto nuevo (un servicio en la nube + integración), no un ajuste a
la app actual. La buena noticia: por usar ya Supabase y tener ya la impresión y
la imagen del ticket, **una parte importante del camino ya está construida**. El
MVP (Fase 1) es lo que entrega el 80% del valor: pedidos que entran e imprimen
solos.
