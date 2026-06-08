# Reglas de trabajo para agentes

## No soluciones de fachada

Cuando se arregle, agregue o modifique una funcion de la app, queda prohibida la "solucion de fachada": cambiar solo lo que el usuario ve sin corregir la fuente de verdad, el modelo de datos, la persistencia y los calculos que dependen de ese dato.

Antes de cerrar cualquier cambio que afecte caja, pedidos, pagos, ventas, gastos, reportes o sincronizacion, el agente debe verificar:

- La UI captura el dato real que el negocio necesita.
- El dato se guarda en el estado persistente.
- Los calculos internos usan ese dato guardado, no una etiqueta visual.
- Ediciones posteriores actualizan el mismo dato de origen.
- Los datos historicos o legacy tienen una migracion/reconciliacion conservadora.
- El cierre, reportes e impresion leen la misma fuente de verdad.

Nombre operativo: **solucion de fachada**. Si una solucion entra en esa categoria, no se considera terminada.
