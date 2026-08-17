# Copy Trading — Requisitos Daniel

> Comparar el **simulador HTML** (panel admin) con el sistema actual Valtrix.  
> Objetivo: acercar el producto real al comportamiento y al admin del HTML.

---

## 1. Performance Fee + red

Cada trader tiene su propio Performance Fee (ej. 20%, 30%). Solo se cobra si hay ganancia.

La red **no** cobra sobre la ganancia del usuario.  
Cobra sobre el **Performance Fee** (ese monto = 100% a repartir).

Ejemplo: gana $100, fee 30% → $30. Sobre $30: L1 30%, L2 15%, L3 10%, L4–L6 5% cada uno.

Misma red para staking, copy y otros productos (un solo patrocinador).

---

## 2. Operaciones (como el HTML)

- Máx. ops por día configurable (ej. 20 en 24 h); el número real es aleatorio (8, 10, 20…).  
- Abren en momentos aleatorios. Usuario **no** ve la próxima apertura; **admin sí**.  
- Admin puede cerrar a mano.  
- Duración aleatoria, máx. 10 min (3 / 5 / 10…).  
- Cierran en positivo o negativo.

### Efecto “tiempo real” para el usuario

El usuario debe sentir que el trader opera en vivo. Para eso la app muestra:

- Operación **abierta** ahora (par, long/short, hora de apertura).  
- Historial de cierres (ganancias y pérdidas).  
- Stats y curva de rendimiento que se actualizan con esas ops.  

El usuario **no** debe ver: countdown de la próxima op, máx. diario, objetivo forzado, fees internos de empresa, ni controles de admin.

Así parece trading real y motiva a copiar; el azar y el control quedan solo en admin.

---

## 3. Qué muestra el admin del HTML (y Valtrix aún no iguala)

### Resumen empresa
- Balance empresa (fee plataforma al **abrir**: 0,05% sobre nocional capital × apalancamiento).  
- Performance fee cobrado (gestión, solo en profit).  
- Ganancia bruta / pérdida bruta / neto del sistema.  
- Total depositado real por clientes.  
- Suma total ingresos (plataforma + gestión).

### Tabla: comisión por operación cerrada
Por cada cierre: trader, activo, resultado %, fee plataforma, fee gestión, hora.  
Fee gestión = $0 si el resultado es negativo.

### Tabla: rendimiento en vivo por trader
Capital, hoy / semana / mes / histórico (% y nº ops), fees, **ops hoy / objetivo**, operación actual **o** countdown “próxima en Xm”.

### Por trader (ficha)
- Máx. diario + objetivo del día (ej. 1/16, máx. 30).  
- % ganancia / pérdida configurados (ej. 60% / 40%).  
- Próxima operación (countdown, solo admin).  
- Capital vitrina vs depositado real vs saldo real clientes.  
- Actualizar / desactivar / eliminar.  
- Generar historial (meses + tendencia).  
- Registrar ganancia/pérdida manual (% + delay en minutos).  
- Objetivos forzados (ej. −50% / −90% en 10 días).  
- Fee de gestión editable.  
- Monedas activas (solo opera en las marcadas).

---

## 4. Qué hay hoy en Valtrix (y por qué no es igual)

Hoy el admin Copy es sobre todo **resultado diario en %** (Growth / Neutral / Harvest → preview → publish).  
No hay motor de ops aleatorias cortas como el HTML.

| Del HTML | En Valtrix ahora | Qué falta |
|----------|------------------|-----------|
| Ops aleatorias en el día + countdown admin | No | Motor de schedule + UI admin |
| Duración 3–10 min, cierre +/− | Ops de mesa más “vitrina”; saldo por publish diario | Cerrar ops = actualizar saldo / fee |
| Fee 0,05% al abrir | Fees copy de entrada/salida distintos | Modelo fee al abrir (o mapear) |
| Fee gestión solo en profit | Sí (al publicar) | Aplicarlo **por operación cerrada** |
| Red desde Performance Fee | No | Pagar 6 niveles desde el fee |
| Resumen financiero HTML (bruto+/−, fees, total) | Parcial (company fees agregados) | Dashboard como el HTML |
| Tabla fee por cada op cerrada | No | Log por operación |
| Ops hoy / objetivo + próxima en… | No | Contadores + countdown |
| Forzar −50%/−90% en N días | No (book target diario global) | Objetivo por trader + periodo |
| Monedas activas por plataforma | Pares de trade globales | Lista “solo copy ops” si aplica |
| Usuarios no ven próxima op | N/A (no hay schedule) | Ocultar schedule en app usuario |

---

## 5. Pendientes (checklist corta)

1. Motor ops: máx/día, aleatorio, duración ≤10 min, win/loss, countdown solo admin, cierre manual.  
2. App usuario: ops abiertas + historial en vivo (sin revelar schedule).  
3. Al cerrar op: P&L usuario + fee plataforma (si aplica) + Performance Fee si profit.  
4. Red: repartir el Performance Fee en 6 niveles (editable en admin).  
5. Admin tipo HTML: resumen empresa, tabla por op, tabla traders en vivo, ficha trader (objetivo, historial, forzar periodo, fees).  
6. Perfiles (conservador / moderado / agresivo) + objetivo mensual (ej. 6%).  
7. Reportes ingresos Copy: día / semana / mes / trimestre / total.  
8. Referidos únicos multi-producto (ya existe la red; falta conectar Copy).

---

## 6. Objetivo

Que el admin y la lógica de Copy se parezcan al **simulador HTML**: ops en vivo controladas, fees claros, ingresos de empresa visibles, y comisiones de red saliendo solo del Performance Fee — todo parametrizable desde admin.
