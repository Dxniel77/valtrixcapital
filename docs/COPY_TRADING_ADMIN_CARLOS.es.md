# Copy Trading — Guía del panel admin (Carlos)

## Qué es esto

Los usuarios copian traders. Los traders no abren órdenes reales. El motor en vivo abre y cierra operaciones cortas; al cerrar cada operación se actualiza el saldo de copy de quien ya está invertido. La empresa gana con comisiones de entrada, salida, fee de plataforma al abrir y fee sobre beneficio. Sin un cierre (motor o Close now) no cambia el saldo del copiador.

---

## Dónde trabajar

Entra a **Admin → Copy trading**. Ahí ves la lista de traders (incluido el Performance Fee de cada uno), el objetivo del día, fees y los botones de preview / publish. Si abres un trader, ves su desk: capital, copiers, stats públicas, el **Performance Fee editable** y el tape de operaciones.

---

## Configuración base (hazlo una vez)

Arriba del panel están fees y reglas: comisión al copiar, al salir, fee de plataforma al abrir, y el % de red sobre el Performance Fee. La red N1–N6 se calcula sobre el Performance Fee de **ese** trader (ese monto = 100%), no sobre la ganancia del usuario. Guarda estos valores y no los toques cada día salvo que quieras cambiar la política.

---

## Cómo financiar copy cash

El copy no usa staking ni el saldo retirable. En v1 el admin carga o resta **efectivo copy idle** en **Admin → Users → ajustar saldo → Copy trading cash**. Eso no toca dinero ya copiado en un trader. El usuario copia traders desde ese efectivo y, al salir, el dinero vuelve al instante al mismo bolsillo. No hay transferencia withdrawable → copy.

---

## Traders: qué controlar

En la lista puedes filtrar por Featured, Visible u Hidden. **Featured** destaca al trader en la app. **Visible** lo muestra. Si lo ocultas, desaparece del catálogo. También puedes editar un trader: nombre, límites de %, **Performance Fee** (estándar 30%, distinto por trader; el usuario lo ve al copiar), máximo de inversores y “displayed copiers” (número mostrado, aunque no haya tantos copiers reales). En el desk del trader el fee se cambia y se guarda sin editar el resto del perfil.

Importante: si el min/max del trader solo permite números positivos, Harvest no podrá ponerle pérdida. Entonces Random draft te avisará. Para Harvest, ese trader necesita rango que permita % negativo.

---

## Objetivo del día (lo más importante)

Cada día eliges un modo. **Growth** = los usuarios ganan (inviertes en crecimiento). **Neutral** = cerca de cero. **Harvest** = el libro gana (los usuarios pierden de forma controlada). Luego pones el monto en USDT.

Con **Allocate & preview** el sistema reparte % entre traders para acercarse a ese objetivo y te muestra el preview. Con **Random draft** rellena % según el modo y también lanza preview. Úsalo cuando quieras variación natural entre traders, no un target exacto.

Después del preview mira tres cosas: P&L total de usuarios, ingreso de la empresa (fees sobre beneficio) e impacto por usuario. Si algo no te gusta, cambia modo/monto o el draft y vuelve a previsualizar. Cuando esté bien, pulsa **Publish all**. Publish solo funciona si hay preview válido. Confirma el mensaje y el día queda aplicado.

---

## Orden recomendado cada día

Abre el panel. Elige Growth, Neutral o Harvest y el monto. Dale a Allocate & preview o Random draft. Revisa números. Si está ok, Publish all. Si no, ajusta y previsualiza otra vez. Nunca publiques sin mirar el preview.

---

## Errores típicos

Si Harvest solo da positivos en un trader, su min/max no permite pérdidas. Si Publish está bloqueado, falta un preview correcto.

---

## Reglas simples

Primero preview, después publish. Harvest = cobrar. Growth = crecer usuarios. No publiques a ciegas.

---

## En una frase

Eliges el objetivo del día, el panel arma el borrador, revisas el impacto y publicas.
