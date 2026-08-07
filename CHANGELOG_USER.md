# Novedades de FinMoves

Lo nuevo y lo que mejoró, versión por versión.

---

## [2.109.1] — 2026-08-07

### La sugerencia de recurrente ya no molesta con gastos de todos los días
Antes te sugería marcar como recurrente cosas que cargás seguido dentro del mismo período
(un café, el almuerzo). Ahora solo te lo sugiere si lo cargás **una vez por período**, que es
como se comporta un pago fijo de verdad (alquiler, una suscripción).

---

## [2.109.0] — 2026-08-05

### Te sugiere marcar como recurrente lo que repetís seguido
Si cargaste el mismo gasto o ingreso (misma categoría y descripción) en 3 períodos distintos
y todavía no lo marcaste como recurrente, ahora te aparece un aviso debajo del toggle
"Repetir" sugiriéndotelo. No hace falta que sea el mismo monto — sirve para alquiler con
ajuste o cuotas que suben de precio.

### Reportes te avisa cuando una categoría se dispara
En Reportes → Gastos, si una categoría este período gastó más de un 50% por encima de tu
promedio de los últimos 3 períodos, aparece una sección nueva mostrándotela — además de la
comparación de siempre contra el período anterior.

---

## [2.108.0] — 2026-08-04

### Aviso si no llegás a fin de período
Si al ritmo que venís gastando no vas a llegar a fin de período, ahora te llega una
notificación con cuánto podés gastar por día para llegar — antes solo lo veías si abrías la
app y mirabas Inicio.

---

## [2.107.0] — 2026-08-04

### Te avisa si vas atrasado con tu meta de ahorro
Si le pusiste fecha a tu meta de ahorro (o de compra en dólares/euros) y tu ritmo actual no
alcanza para llegar a tiempo, ahora te avisa cuánto más necesitás ahorrar por período. Si vas
bien, no dice nada — solo te avisa cuando hace falta cambiar algo.

---

## [2.106.0] — 2026-08-04

### Ves el presupuesto mientras cargás el gasto
Al elegir categoría en un Gasto nuevo, aparece un chip con el % de tu presupuesto que llevás
gastado en esa categoría (incluyendo el monto que estás tipeando) — verde, amarillo o rojo
según cuánto te queda. Antes solo lo veías en Reportes o al día siguiente por notificación.

---

## [2.105.3] — 2026-07-31

Arreglos menores o correcciones de bugs. Sin cambios visibles.

---

## [2.105.2] — 2026-07-31

### Arreglos de carga y edición de movimientos
- **Nuevo movimiento siempre va al período actual.** Antes, si estabas mirando un período
  anterior en el calendario y cargabas algo sin darte cuenta, se guardaba ahí en silencio.
- **Editar un ingreso de Ahorros** ahora te muestra los mismos orígenes para elegir que al
  cargarlo (ya no dejaba escribir cualquier cosa).
- **Borrar una categoría** ahora también la saca del presupuesto y desactiva los recurrentes
  que la usaban — antes seguía apareciendo "fantasma" en Presupuesto.

---

## [2.105.1] — 2026-07-30

Mejoras internas y de testing. Sin cambios visibles.

---

## [2.105.0] — 2026-07-24

### El presupuesto no te deja distribuir más de lo que ganás
Ahora, al armar el presupuesto, ves **cuánto de tu ingreso ya distribuiste y cuánto te queda** —
con una barra que se pone verde, amarilla o roja según cuánto ocupaste. Así podés ajustar los
gastos a lo que entra.

- **Presupuesto del período (Reportes):** no te deja guardar si la suma pasa tu ingreso del mes
  (sueldo + retiros de ahorro). Te avisa "te queda $X" o, si te pasás, "llegaste al tope".
- **Template por defecto (Ajustes → Movimientos):** la misma barra, pero acá solo te avisa si
  superás tu último sueldo (no te bloquea, porque el template es general y no es de un mes puntual).

---

## [2.104.4] — 2026-07-24

Mejoras internas y de seguridad. Sin cambios visibles.

---

## [2.104.3] — 2026-07-24

### Arreglado: los cambios ahora se reflejan al abrir la app
Había un problema por el que, si cambiabas algo (como renombrar o fusionar una categoría) y
recargabas, la app seguía mostrando lo viejo porque no re-leía la configuración desde el servidor.
Ahora al abrir la app siempre verifica si hubo cambios y los trae. Si un cambio "no se tomaba"
aunque recargaras, era esto.

---

## [2.104.2] — 2026-07-24

### Arreglado: renombrar una categoría no arrastraba los movimientos viejos
Al renombrar una categoría, en algunos casos los movimientos históricos se quedaban con el
nombre anterior, y además a la categoría le aparecía un ícono distinto al que tenía. Las dos
cosas ya están arregladas: ahora el rename actualiza todos los movimientos que la usan y conserva
su ícono y color.

**Ojo:** si ya renombraste una categoría antes de esta actualización y te quedaron movimientos
colgados, volvé a renombrarla ahora y se acomodan solos.

---

## [2.104.1] — 2026-07-24

Actualizaciones de seguridad y correcciones menores.

---

## [2.104.0] — 2026-07-24

### Ahora podés renombrar una categoría
Antes podías cambiarle el ícono, el color y el presupuesto a una categoría, pero no el nombre.
Ahora sí: en Ajustes → Movimientos → Categorías, tocá el ícono de una categoría y arriba de todo
tenés el campo **Nombre**.

Lo importante: al renombrar **se actualizan también todos los movimientos** que la usaban, más su
presupuesto y sus recurrentes. Así no se te parte el historial — nada queda colgado en la
categoría vieja. Antes de guardar te avisa cuántos movimientos se van a actualizar.

---

## [2.103.1] — 2026-07-23

### El calendario vuelve a marcar con puntitos
En la versión anterior el día con algo se pintaba entero (fondo y recuadro incluidos) y quedaba
demasiado cargado: se comía la grilla. Ahora el día marcado se ve por **el número en color y un
punto abajo**, y el fondo queda solo para el día que tocás.

Cada cosa tiene su punto: verde para hoy, el del recordatorio y el del recurrente. Un día que
tenga las tres muestra los tres, sin agrandarse.

---

## [2.103.0] — 2026-07-23

### Tus recurrentes ahora se ven en el calendario
El calendario del Inicio te muestra **cuándo se espera cada gasto recurrente** (Netflix, el
gimnasio, lo que tengas marcado). Antes te enterabas solo cuando llegaba la notificación; ahora
lo ves venir.

El color te dice qué tan cerca está: naranja si falta, amarillo si se aproxima, rojo si ya se
pasó. Tocá el día y ves cuáles son, con su monto.

Los que ya se pasaron aparecen en el día de hoy, para que no se te pierdan en una fecha vieja.
Las notificaciones siguen funcionando igual que siempre.

### El día de hoy se marca con un punto verde
Antes el día actual se distinguía por un fondo grisecito que, si ese día tenía algo agendado,
quedaba tapado por el color. Ahora lleva un **punto verde** abajo del número que no lo tapa nada,
así siempre sabés dónde estás parado.

### El día marcado ahora se ve mejor
Antes el día con algo solo tenía un puntito gris que había que buscar. Ahora **el número va en
color** además del punto, así se distingue sin tener que fijarse. Los recordatorios mantienen sus
colores (violeta los que se repiten, celeste los puntuales) y los recurrentes usan los de arriba.

También arreglamos que al cambiar de mes con un día abierto, el detalle quedaba flotando sobre
un mes que no era el suyo.

### Al tocar una categoría, se agrupan los gastos iguales
En Reportes → Gastos, tocar una categoría te mostraba un renglón por cada movimiento: en cosas
como peajes era un scroll interminable de la misma línea repetida. Ahora **se agrupan por
descripción**, con el total de cada una y cuántas veces fue. Se pierde la fecha y el medio de
pago, pero eso lo tenés en el filtro de Movimientos.

### Los modales cortos ahora son cards flotantes
Los que tenían poca info subían desde abajo ocupando toda la pantalla, que es mucho gesto para
mostrar dos botones. Ahora **aparecen como una card en el centro**, más liviano y más cerca de
donde estabas mirando.

Cambiaron: ir a un período, historial de sueldo, directo a ahorros, detalle por medio de pago,
el rango y el detalle del día en Análisis, el código de invitación, el historial de sync y el
detalle de una categoría (el del período actual y el del anterior).

Los que siguen subiendo desde abajo son los que tienen listas largas de verdad: el top 20 de
gastos, el presupuesto y el changelog.

### "vs período anterior" ahora se puede tocar
Cada categoría de la comparativa abre **en qué se te fue la plata el período anterior**, agrupado
igual, para poder comparar los dos lados de la misma manera.

### Un día cerrado te dice cuánto gastaste
Antes, al colapsar un día en Movimientos, veías cuántos movimientos hubo de cada tipo. Saber que
hubo "3" no servía de mucho. Ahora ves **cuánto gastaste ese día**, que es el dato que
importa. Si además hubo un ingreso o un move, aparece un puntito de color al lado. Si no hubo
gastos, va un guioncito en vez de un $0.

### Sacamos el gráfico "Por día" de Reportes
Con el total de cada día ya visible en Movimientos, el gráfico repetía la misma información.

---

## [2.102.0] — 2026-07-23

### Sacamos la vibración
La vibración nunca funcionó en iPhone: Apple no la permite en apps web, y no hay forma de
esquivarlo. Tener un botón de "Vibración" en Ajustes prometía algo que en muchos teléfonos no
pasaba, así que lo sacamos junto con la opción.

### A cambio, el efecto visual pega más fuerte
Ahora que es la única respuesta al tocar, la reforzamos: al guardar, el botón se hunde y
**rebota**; al borrar hace una sacudida más marcada; al navegar o seleccionar, un toque corto.
Se siente la diferencia entre confirmar y borrar sin necesidad de vibración.

### Paleta nueva: un color por ícono
Los colores de categorías pasaron a estar **ordenados como un arcoíris** (rojo → amarillo →
verde → celeste → azul → violeta → rosa), así encontrás el que buscás de un vistazo en vez de
recorrer una lista desordenada. Ahora hay 18 colores y 18 íconos: uno para cada, para que cada
categoría tenga identidad propia.

Sumamos tonos que faltaban (verde profundo, petróleo, aguamarina, oliva oscuro, azul grisáceo)
y sacamos algunos que se confundían entre sí. Si alguna categoría tuya usaba uno de esos, toma
automáticamente el color que le corresponde por su nombre — no tenés que hacer nada.

### Tres íconos nuevos
**Gimnasio**, **regalo** y **café**. Además se asignan solos: si tu categoría se llama "Gym",
"Regalos" o "Bar", ya les toca el ícono correcto sin que lo elijas.

---

## [2.101.1] — 2026-07-22

### El deslizar ahora habla tu idioma de colores
Cuando deslizás un movimiento para borrarlo o editarlo, el resaltado toma **el color de la
categoría** que vos elegiste, no un color genérico. Se siente que es tu app.

### Más colores para tus categorías
Sumamos cinco tonos nuevos (coral, turquesa, lavanda, dorado y violeta) para que tengas más
variedad al armar tus categorías, sin que se confundan entre sí.

### Arreglos menores
Correcciones internas.

---

## [2.101.0] — 2026-07-22

### Vibración al usar la app
Ahora la app **te responde** al guardar, borrar, cambiar de pestaña o seleccionar: una vibración
(en Android) más un pequeño efecto visual. Lo podés apagar en Configuración → Preferencias — eso
apaga solo la vibración, el efecto visual queda siempre.

### Arreglos en la selección múltiple
- Si deseleccionás todo, ahora **salís del modo selección** solo (antes se quedaba en "0
  seleccionados").
- En modo selección ya no se te abre el deslizar de una fila por error.
- Antes de borrar varios, **te pregunta para confirmar**.

---

## [2.100.0] — 2026-07-22

### Simulador en tus metas
En cada meta de Inversión ahora hay un **"¿Y si…?"** que podés desplegar: movés una perilla y
ves cuántos períodos antes llegarías. En la meta de ahorro simulás cuánto más guardar por
período; en la de dólares/euros, cuánto más comprar. No cambia nada de tus datos, es solo para
probar.

### Todo se abre más lindo
Unificamos el efecto de apertura en toda la app: modals, hojas y ventanitas ahora aparecen con
el mismo pequeño rebote, en vez de cada una a su manera.

### El deslizar para borrar, más suave
En Movimientos, deslizar una fila ahora se siente fluido en vez de brusco: acompaña el dedo, se
resalta con el color del tipo de movimiento (rojo gasto, verde ingreso…) y da un toquecito al
abrirse. Y ya no se queda trabada a medias con un roce.

### Ícono de los Move
Los movimientos entre disponible y ahorros ahora tienen un ícono de **flechas cruzándose** con
su color, en vez del genérico.

---

## [2.99.1] — 2026-07-22

### Nuevos datos en Inicio y Reportes
En **Inicio**, en vez de "Gastado" ahora ves **"Hoy"**: cuánto llevás gastado en el día. Y se
pinta según cómo vas — verde si gastaste menos de lo recomendado para el día, amarillo si estás
cerca, rojo si ya te pasaste.

En **Reportes → Movimientos** sumamos dos datos que antes no estaban: tu **día más activo** (el
que más movimientos cargaste) y tu **gasto más grande** del período. Y al día que más gastaste
ahora le ves cuántos movimientos tuvo.

---

## [2.99.0] — 2026-07-22

### Resumen al cerrar el período
Cuando cargás el sueldo del período nuevo, ahora podés ver un **resumen del período que
cerraste**: cuánto gastaste y ahorraste (y cómo cambió respecto del anterior), la categoría que
más se disparó, lo que arrastraste al nuevo período y algunos datos más.

Aparece en el botón de arriba de Reportes y te avisa por la campana. Se queda hasta que lo
mirás una vez; después vuelve solo cuando cierres el próximo período.

---

## [2.98.1] — 2026-07-22

### Mejoramos los colores y los íconos de las categorías
Los colores que se podían elegir tenían **tres naranjas parecidos** y **dos violetas casi
iguales**, más un gris que no aportaba nada. Ahora son diez tonos bien distintos entre sí, y
sumamos uno nuevo que **se adapta al tema**: se ve negro cuando usás la app en claro y blanco
cuando la usás en oscuro.

En los íconos sacamos cuatro que no se entendían bien (el regalo, la pelota, el archivador y
el de belleza) y **sumamos un chanchito** para las categorías de ahorro.

### Arreglos
- Las compras y ventas de dólares ahora se ven con el **signo $ en amarillo**, que es como la
  app las marca en todos lados. Antes les tocaba un ícono cualquiera.
- En el detalle ya no aparece "COMPRAUSD · COMPRAUSD" repetido.

---

## [2.98.0] — 2026-07-22

### Cada categoría tiene su ícono y su color
Hasta ahora las categorías eran solo texto. Ahora cada una tiene **su propio ícono con color**,
y aparece en la lista de movimientos, en el detalle y en la tabla de la computadora.

- En la lista, el ícono ocupa el lugar del puntito de color que había antes. Ese punto decía
  si era gasto o ingreso, pero **eso ya lo dice el color del monto**, así que ahora ese espacio
  muestra algo nuevo: de qué categoría es.
- **Sacamos el nombre de la categoría** de abajo de cada movimiento: con el ícono alcanza, y
  queda más lugar para la observación.

### No tenés que configurar nada
Tus categorías ya tienen un ícono y un color asignados automáticamente según su nombre: Games
con el joystick, Car con el auto, Loki con la patita, Daily con la casa, Health con el corazón.

Si querés cambiar alguno, entrá a **Configuración → Movimientos** y tocá el ícono de la
categoría: elegís entre 18 íconos y 10 colores, y ves al instante cómo va a quedar.

Los colores que se pueden elegir **no incluyen** los que la app usa para otra cosa (el verde de
ingreso, el rojo de gasto, el violeta de ahorro…), así no se confunden entre sí.

---

## [2.97.1] — 2026-07-21

### Deslizá para eliminar
En las notificaciones y en el historial de dólares, ahora **deslizás la fila hacia el costado
y se elimina**, como en Mercado Pago: mientras arrastrás aparece un fondo rojo con el tachito,
y cuando pasás cierto punto soltás y listo. Si no llegás, la fila vuelve sola a su lugar.

En el historial de dólares te sigue preguntando antes de borrar, porque eso afecta tu patrimonio.

Sacamos el botón de "eliminar todas" que habíamos puesto: con este gesto, borrarlas de a una es
más rápido y no hay riesgo de vaciar todo sin querer.

---

## [2.97.0] — 2026-07-21

### La campana se pone al día cuando abrís la app
Los avisos los manda un proceso que corre cada varias horas. Entre una corrida y la otra el
dólar se mueve o cargás gastos que cambian tu presupuesto, así que al entrar la campana estaba
atrasada.

Ahora, **cada vez que abrís la app**, FinMoves revisa qué pasó y lo suma a la campana: el
dólar, el presupuesto, los recurrentes que te faltan cargar, una versión nueva y los
recordatorios que están por vencer. **No te llega una notificación al teléfono por esto** —
para eso siguen estando los avisos de siempre; esto solo completa la campana.

### El aviso de presupuesto ahora distingue dos cosas
Antes decía "van camino a pasarse" incluso para categorías que **ya** se habían pasado. Ahora
son dos avisos distintos: uno para las que ya te pasaste y otro para las que todavía estás a
tiempo de frenar.

### Notificaciones más ordenadas
- Cada notificación se ve en **una línea**. Tocala una vez y se abre con el detalle completo
  (por ejemplo, todas las categorías, no solo tres); tocala de nuevo y te lleva a la pantalla.
- Nuevo botón para **eliminar todas** las notificaciones de una, con confirmación.

### Arreglos
- En Inicio, el panel de notificaciones quedaba pegado a la campana.
- El detalle de un movimiento de Reserva repetía el nombre dos veces y mostraba los pesos como
  dato principal. Ahora muestra **cuántos dólares** compraste o vendiste, con los pesos abajo.

---

## [2.96.0] — 2026-07-21

### Borrá o recategorizá varios movimientos de una
Hasta ahora los movimientos se manejaban de a uno: deslizar, abrir, confirmar. Para limpiar
cinco cargas repetidas eran quince toques.

Ahora podés **elegir varios y hacerlo todo junto**:

- En el celular, **mantené apretado** un movimiento y entrás en modo selección con ese ya
  marcado. Después tocá los que quieras sumar.
- En la computadora, el botón **"Seleccionar"** arriba de la tabla te muestra las casillas, y
  la del encabezado marca todo de una.

Con lo elegido podés **borrarlo** o **cambiarle la categoría** a todo junto — muy útil para
ordenar movimientos viejos que quedaron mal clasificados.

### Si borrás de más, lo podés deshacer
Después de borrar aparece un aviso **"Se borraron 5 · Deshacer"** con una barra que muestra
cuánto tiempo te queda para arrepentirte. Si tocás Deshacer, los movimientos vuelven tal cual
estaban, con sus comprobantes.

### Detalles
- El **sueldo que abre el período no se puede borrar** (es el que le da la fecha), así que si
  lo seleccionás, el botón de borrar queda apagado.
- Los movimientos de tipo Move, las compras de dólares y el RESTO no se pueden recategorizar:
  su categoría es parte de cómo la app calcula el período.

---

## [2.95.0] — 2026-07-21

### Recordatorios que se repiten todos los meses
Antes un recordatorio avisaba una vez y desaparecía. Ahora podés hacer que **vuelva el mismo
día de cada mes**: lo cargás para el 23 y te avisa el 23 de agosto, el 23 de septiembre, y así.

Si lo ponés un 31, en febrero te avisa el 28 pero en marzo **vuelve al 31** — no se queda pegado
en el día más chico. Los recordatorios que ya tenías se pueden volver repetibles desde
Configuración → Notificaciones.

### El recordatorio ahora se carga desde un calendario
La card de recordatorios tiene un **calendario que podés recorrer mes a mes**. Tocás el día que
querés y ahí mismo escribís el recordatorio, sin tener que cargar la fecha a mano. Los días que
ya tienen algo aparecen con un punto: violeta si se repite, verde agua si es por única vez. Si
tocás uno de esos días, ves lo que tenías y lo podés borrar.

### En Inicio: cuánto podés gastar por día
Donde antes decía "Desvío" (un número que no servía para decidir nada) ahora ves **cuánto podés
gastar por día para llegar bien al cierre del período**. Se pone en rojo si al ritmo que venís
no llegás.

Para saber cuántos días faltan, la app mira **cuánto duran tus períodos de verdad** (no asume
que son de 30 días). Tocá el número y te dice, aproximadamente, cuánto te dura el disponible al
ritmo que venís gastando.

### Arreglos
- Algunas etiquetas se veían con Mayúscula En Cada Palabra ("Por Período"); ahora se leen normal.
- El título de la card Reserva tenía las letras más juntas que el resto de las cards.

---

## [2.94.0] — 2026-07-21

### Buscar en todos los períodos
Hasta ahora la lupa de Movimientos solo buscaba dentro del período que tenías abierto. Si
querías saber cuándo compraste la heladera, no había forma de encontrarlo desde ahí.

Ahora el filtro tiene un **"buscar en todos los períodos"**. Cuando lo activás:

- Los períodos de arriba se achican y **quedan solo los que tienen lo que buscás**, cada uno
  con el número de coincidencias. Tocás uno y ves los movimientos de ese período.
- Si el período donde estabas no tiene nada, te lleva solo al más reciente que sí.
- Mientras escribís te dice cuántas coincidencias hay y en cuántos períodos.

Funciona igual en el celular y en la computadora.

---

## [2.93.0] — 2026-07-21

### Aviso antes de pasarte del presupuesto
FinMoves ahora te avisa **antes** de que te pases del presupuesto de una categoría, no cuando
ya es tarde. Mira a qué ritmo vas gastando en el período y, si a ese ritmo la categoría va a
cerrar por encima de lo que le pusiste, te manda un aviso: *"A este ritmo, Comida cierra en
180% de su presupuesto."*

- Te avisa **una sola vez** por categoría en cada período, así no molesta.
- Espera unos días del período antes de avisar, para no dispararse con poca información.
- Necesitás tener notificaciones activadas y un presupuesto puesto en la categoría.

---

## [2.92.2] — 2026-07-21

### Arreglos
- La guía todavía mencionaba el ahorro automático, que ya habíamos sacado. Corregido para que
  no explique algo que ya no está.

---

## [2.92.1] — 2026-07-20

### Se fue el ahorro automático
La opción que sumaba un monto fijo a tus ahorros con cada gasto ya no está. Los ahorros que
ya se generaron con esa función quedan como están (son ahorros de verdad); simplemente de acá
en adelante no se agrega ninguno solo. Podés seguir moviendo plata a ahorros a mano cuando
quieras.

### Arreglos
- En la computadora, comparar períodos en Reportes podía mostrar una mejora como si fuera un
  empeoramiento cuando el disponible estaba en negativo. Ahora la flecha y el color apuntan
  para el lado correcto.
- Pequeños ajustes en la carga rápida de la computadora.

---

## [2.92.0] — 2026-07-18

### FinMoves ahora se usa en la computadora
Hasta ahora la app en una pantalla grande era la versión del celular estirada, con mucho
espacio desperdiciado. Ahora cada pantalla aprovecha el monitor:

- **Movimientos**: una tabla con todos tus movimientos, que podés **ordenar por cualquier
  columna** (fecha, monto, categoría). El buscador queda siempre a la vista y hay una fila
  para **cargar gastos con el teclado**: escribís el monto, Tab, la descripción, Enter, y
  ya estás cargando el siguiente. Sin tocar el mouse.
- **Inicio**: tu período a la izquierda (disponible, KPIs, en qué se te va) y los últimos
  movimientos a la derecha, todo de un vistazo.
- **Reportes**: elegí dos o más períodos y los ves **comparados lado a lado**, con cuánto
  subió o bajó cada cosa entre uno y otro.
- **Inversión**: tu patrimonio, tu posición en dólares y tu ritmo de ahorro agrupados, y el
  historial de la reserva completo (antes había que abrirlo con el ícono del reloj).
- **Configuración**: las secciones a la izquierda y el contenido al lado, sin entrar y volver.

En el celular no cambia nada: sigue funcionando exactamente igual.

### Arreglos
- **El "por período" de tus ahorros podía contradecir a tu patrimonio.** Si alguna vez
  sacaste de ahorros más de lo que tenías registrado, la app mostraba un ritmo muy negativo
  mientras arriba tu total decía otra cosa. Ahora los dos números cuentan la misma historia.
- El monto de tus metas se veía en rojo aunque recién estuvieras empezando: el color ahora
  está solo en la barra de progreso.

## [2.91.0] — 2026-07-18

### Ahora festejamos tus metas en el momento
- **Cuando cruzás el 50%, 75% o 100% de una meta, te lo festejamos ahí mismo**, apenas cargás el
  movimiento que te hizo llegar. Antes te llegaba una notificación al rato (o al día siguiente)
  avisándote algo que ya habías visto en pantalla: tus ahorros solo se mueven cuando cargás algo,
  así que la notificación siempre llegaba tarde.
- **El aviso del dólar sigue igual**: ese sí tiene sentido, porque la cotización se mueve sola
  mientras vos hacés otra cosa.

### En Reportes
- El número grande de Ingresos ahora se llama **Total disponible** (es todo lo que entró en el
  período) y abajo te muestra, además de la comparación con el período anterior, **cuánto te
  queda hoy** sin gastar. Los dos datos juntos, sin tener que ir al Inicio.

### Arreglos
- **El resumen de Movimientos contaba de más.** Los ingresos y gastos en dólares de tu reserva
  aparecían mezclados con los movimientos del período, inflando el total y los gráficos. La
  reserva se maneja aparte; las compras y ventas de divisa sí siguen contando porque mueven pesos.
- El detalle de un ingreso en euros mostraba "USD".
- Al cargar un Ingreso ya no aparece el campo de descripción antes de elegir la categoría: tanto
  Sueldo como Ahorros la completan solos.

## [2.90.1] — 2026-07-18

- Correcciones visuales menores en el historial de la reserva.

## [2.90.0] — 2026-07-18

### Los números de ahorro y proyección ahora son consistentes
- **Tu ritmo de ahorro descuenta lo que sacás.** Antes solo miraba lo que depositabas, así que
  podía mostrar un ritmo mayor a tus propios ahorros. Ahora resta lo que movés de vuelta a
  disponible: es lo que realmente sumás por período.
- **Cuenta el período actual.** Si ya ahorraste este período, cuenta — antes te decía "no
  ahorrás nada" mientras el total de arriba mostraba la plata.
- **Todos los promedios arrancan desde el mismo punto** y usan toda tu historia desde ahí, en
  vez de una ventana fija distinta en cada pantalla.
- **La proyección de gasto ahora se mueve.** Antes promediaba solo períodos terminados y el
  número quedaba casi siempre igual; ahora también mira cómo venís gastando este período.
- Si estás **usando** ahorros en vez de sumarlos, el número aparece en rojo y te lo dice con
  todas las letras, en lugar de mostrar un cero o desaparecer.
- Si tu moneda es dólar o euro, las proyecciones ya **no** se ajustan por inflación argentina.

### Reserva en divisa
- **Deslizá una fila del historial para borrar** un ingreso o gasto en divisa (esos movimientos
  no aparecen en Movimientos, así que era la única forma de sacarlos).
- Abrir el detalle de un movimiento ya no cierra el historial: al volver seguís donde estabas.
- Textos de ayuda más cortos y claros en todas las tarjetas.

## [2.89.1] — 2026-07-18

- **Tu reserva ahora es exactamente lo que cargaste.** Antes se le sumaba un "saldo inicial"
  que ya no se podía ver ni editar, así que el total mostraba plata que no correspondía a ningún
  movimiento. Si tenías uno cargado, vas a ver la reserva más baja: ese es el número real de lo
  que registraste.

## [2.89.0] — 2026-07-17

### Metas de ahorro para todos
- Ahora **cualquier usuario** puede ponerse una **meta de ahorro** en su moneda, medida sobre los
  ahorros que la app ya venía calculando. No hace falta cargar ningún saldo a mano.
- Si tu moneda es **dólar o euro**, la pestaña **Inversión** ahora te muestra lo tuyo: tu
  **patrimonio** (disponible + ahorros), tu **meta**, tu **ritmo de ahorro** y tu **mejor y peor
  período**.
- Si trabajás en **pesos**, seguís teniendo tu **reserva en divisa** y su meta como hasta ahora,
  y además tu propia meta de ahorro más abajo.

### Cambios en Inversión
- La pestaña **Inversión** se movió al **4° lugar** de la barra.
- El **historial** de tu reserva ahora se abre desde un ícono arriba a la derecha, en un panel
  aparte (queda más limpia la pantalla). El botón para **cargar reserva** vive dentro de ese panel.
- Podés **prender o apagar** la pestaña Inversión desde Configuración; si la apagás, tus metas
  quedan guardadas igual.

### Correcciones
- El **ritmo de ahorro** ya no puede dar un número mayor a lo que tenés ahorrado.
- Arreglos menores.

## [2.87.0] — 2026-07-16

### Novedades
- **Recordatorios a mano**: el atajo de Recordatorio en Inicio ahora te muestra el **próximo a vencer** (con color según la urgencia) y te deja cargar uno nuevo ahí mismo. Para ver todos, Configuración → Notificaciones.
- **Aviso del resumen anual**: el 31/12 te llega una notificación para que veas tu año en FinMoves.

### Mejoras
- **El aviso de "hace días que no cargás" ya no se calla**: antes avisaba una sola vez y no volvía a insistir aunque pasaran semanas. Ahora te recuerda cada ~3 días mientras sigas sin cargar.
- **El resumen anual también aparece en enero** (del 26/12 al 5/1), como estaba previsto.
- **Inflación**: en Inicio volvés a ver la misma métrica que en Reportes → Períodos.

---

## [2.86.1] — 2026-07-16

### Mejoras
- **Inicio y Reportes ya no muestran lo mismo**: en Inicio, el número ahora es **"Gasto vs anterior"** — cuánto llevás gastado en este período comparado con todo el anterior (el dato del momento). En Reportes seguís viendo la tendencia: el promedio entre todos tus períodos. Antes los dos mostraban el mismo número con explicaciones distintas.

---

## [2.86.0] — 2026-07-16

### Novedades
- **Atajos útiles en Inicio**: además de cargar un movimiento, ahora podés cargar una **divisa** (compra/venta de dólares o euros) y crear un **recordatorio** directo desde el inicio, sin dar vueltas.
- **Total del día al filtrar**: cuando filtrás tus movimientos, cada día abierto te muestra su total a la derecha, en el color según el tipo.

### Mejoras
- **La inflación volvió a funcionar**: el proveedor del dato dejó de permitir el acceso directo desde el navegador; ahora lo traemos por otro camino y se actualiza solo.
- **"Análisis"** (antes "Filtrar y comparar") ahora se abre desde Reportes y al volver, regresás a Reportes.
- **Reportes más despejado**: sacamos el "Top 5 descripciones" (ya lo cubre el filtro de Movimientos) y el resumen anual (Wrapped) aparece cerca de fin de año.

---

## [2.85.1] — 2026-07-15

### Mejoras
- **Recordatorios de recurrentes más insistentes**: ahora te avisamos a los ~25 días, de nuevo a los ~28 si no lo cargaste, y después una vez por semana hasta que lo registres. Si es un recurrente nuevo que nunca cargaste, cuenta desde que lo creaste.

---

## [2.85.0] — 2026-07-15

### Novedades
- **Plantillas para ingresos y sin monto**: ahora podés guardar plantillas también de ingresos, y sin monto (lo completás al usarla).
- **Cargar el sueldo, más rápido** (para el dueño): al cargar el Sueldo ya no te pide la descripción ni el medio de pago (quedan fijos), y las observaciones siguen libres.

### Mejoras
- **Origen de ahorro**: los orígenes van en una sola fila deslizable, ordenados por los que más usás.
- **Recurrentes más precisos**: si cargás un movimiento que ya es un recurrente tuyo, aparece la etiqueta "Movimiento recurrente" en vez del check. La identidad del recurrente (incluida la observación) ahora es consistente en todos lados.

---

## [2.84.0] — 2026-07-15

### Novedades
- **Filtrar movimientos sin salir de la pantalla**: la lupa en Movimientos ahora abre un buscador ahí mismo. Escribí una palabra (ej. "peajes") y la lista se filtra a ese período, con un resumen arriba (total, cuántos y promedio). Ya no te lleva a otra pantalla.
- **Análisis avanzado desde Reportes**: el análisis completo (comparar, evolución, proporción) ahora se abre con un ícono en Reportes.

### Mejoras
- **Íconos de Configuración** unificados en gris, más prolijos.

---

## [2.83.2] — 2026-07-15

### Mejoras
- **Los tips ahora se quedan cerrados**: si descartabas un tip de gesto y cambiabas de pestaña, volvía a aparecer una y otra vez. Ya no.

---

## [2.83.1] — 2026-07-15

### Mejoras
- **Deslizar entre modos en Analizar**: podés cambiar entre Comparar, Evolución y Proporción deslizando el dedo, sin tener que volver arriba a tocar los botones.

---

## [2.83.0] — 2026-07-15

### Novedades
- **Tips de gestos**: la primera vez en cada pantalla, un aviso te muestra los gestos que quizás no descubras solo — deslizar una fila para editar/borrar, deslizar entre las pestañas de Reportes, y tocar los números para entenderlos. Y ahora no vuelven a aparecer aunque reinstales la app.

---

## [2.82.1] — 2026-07-15

### Mejoras
- **Subir imágenes más confiable**: adjuntar una foto al editar un movimiento podía fallar con un error de conexión la primera vez tras un rato. Ahora reintenta solo y se recupera.

---

## [2.82.0] — 2026-07-15

### Novedades
- **Onboarding renovado**: al empezar, ahora además de configurar tu cuenta te enseña lo básico — qué es un período (tu sueldo lo abre), un par de gestos clave (deslizar para editar, tocar los números, deslizar entre pestañas) y dónde está la guía completa.

---

## [2.81.0] — 2026-07-14

### Novedades
- **Guía renovada y completa** (Configuración → Guía): ahora explica todo lo que podés hacer en FinMoves, organizado en temas que se despliegan — cómo funciona (los períodos), cargar movimientos, ahorros e inversión, los **gestos** (deslizar para editar/borrar, deslizar entre pestañas, tocar los números y gráficos), analizar y comparar, y ajustes útiles.

---

## [2.80.1] — 2026-07-14

### Mejoras
- **Adjuntar imágenes al editar volvió a funcionar**: el selector de foto/PDF quedaba tapado detrás de la tarjeta de edición y no se podía usar. Ya aparece por delante.

---

## [2.80.0] — 2026-07-13

### Novedades
- **Analizar, renovado**: la pantalla de análisis ahora tiene 3 modos para comparar de verdad tus movimientos:
  - **Comparar**: poné varios términos (ej. Netflix, Spotify) y velos lado a lado — total, promedio, cuántas veces, y cuánto se diferencian. Tocá los que quieras sumar y te muestra el total de lo seleccionado.
  - **Evolución**: seguí un gasto en el tiempo, por período, por mes o por semana, y ves si sube o baja.
  - **Proporción**: cuánto pesa algo (ej. delivery) sobre tu gasto del período.
- **Agrupar como quieras**: por descripción, categoría u observación — así podés comparar, por ejemplo, dos peajes distintos aunque estén en la misma categoría.
- **Rango de fechas libre**: además de elegir períodos, ahora podés elegir un desde/hasta.
- **Mientras escribís** te dice cuántos movimientos coinciden, para saber que lo escribiste bien antes de fijarlo.

---

## [2.79.2] — 2026-07-13

### Mejoras
- **El deslizar de un movimiento se cierra solo**: si abrís los botones de editar/eliminar deslizando una fila, ahora se cierran al tocar cualquier otro lado o al hacer scroll (antes quedaban abiertos hasta deslizar otra fila).

---

## [2.79.0] — 2026-07-13

### Novedades
- **Deslizá entre las pestañas de Reportes**: ahora podés cambiar entre Gastos, Ingresos, Movimientos y Períodos deslizando el dedo, sin tener que volver arriba a tocar los botones. La pantalla siguiente ya está lista y el cambio es fluido, con la pastilla de arriba acompañando el gesto.

---

## [2.78.0] — 2026-07-13

### Novedades
- **Editar y eliminar, ahora con deslizar**: deslizá un movimiento hacia la izquierda y aparecen dos botones: el lapicito para editar y el tachito para eliminar. Editar te lleva directo al formulario.
- **El detalle es solo para mirar**: tocás un movimiento y ves su tarjeta con toda la info, linda y clara. Para editarlo o borrarlo, deslizás.
- **Editar renovado**: al editar se abre una tarjeta con el mismo estilo del detalle (antes subía desde abajo), con un "‹ Detalle" para volver.
- **Detalle de reserva igual de lindo**: la reserva (desde Inversión) ahora se ve con la misma tarjeta que los movimientos.

### Mejoras
- **Cancelar el borrado ya no te saca al listado**: volvés a la tarjeta del movimiento por si lo querés editar.

---

## [2.77.0] — 2026-07-13

### Novedades
- **Notificaciones en todos tus dispositivos**: si usás FinMoves en el celular y en otro dispositivo, ahora los avisos te llegan a todos. Antes, activar las notificaciones en uno "apagaba" las del otro.

### Mejoras
- **Recordatorios de recurrentes más confiables**: si tenés un gasto recurrente y hace rato que no lo registrás, ahora FinMoves te lo recuerda igual (una vez al mes). Antes, si pasaba mucho tiempo, el recordatorio se quedaba mudo y no volvía a avisarte.

---

## [2.76.0] — 2026-07-13

### Mejoras
- **La inflación volvió a funcionar**: el proveedor del dato de inflación (IPC) cambió de dirección y la app había dejado de traerlo. Ya está apuntando al lugar correcto y se actualiza solo.
- **Inflación más clara**: cuando el número no está ajustado por IPC —por ejemplo si tu moneda no es el peso, o si el dato de inflación no está disponible— la tarjeta ahora dice **"Infl. nominal"** para que sepas que es la variación de tu gasto sin ajustar, y no te confunda un cambio de golpe.
- **Cambios entre dispositivos**: si editás un movimiento en el celular, al abrir la app en otro dispositivo ahora se ve el cambio (antes, algunas ediciones podían tardar en reflejarse).

---

## [2.75.0] — 2026-07-13

### Novedades
- **Detalle del movimiento renovado**: al tocar un movimiento se abre una tarjeta linda en el centro, con el ícono del tipo, el monto grande en su color, la fecha, el medio de pago y el comprobante a la vista. Abajo, un lapicito para editar y un tachito para borrar.
- **Deslizar para eliminar, mejor**: ahora la fila se achica y el tachito aparece a la derecha sin cortar el texto. El tachito queda en su propia zona para no confundirse con el monto.
- **Notificaciones desde la campanita**: el panel se despliega desde la campana (arriba a la derecha), en vez de subir desde abajo.

### Mejoras
- **En Inicio, los movimientos son solo para mirar**: tocás uno y ves el detalle, pero para editar o borrar entrás a Movimientos.

---

## [2.74.1] — 2026-07-12

### Mejoras
- **Deslizar para eliminar mejorado**: ahora podés deslizar la fila hacia cualquier lado y el tachito aparece prolijo del lado hacia donde deslizás, sin ocupar de más. Un segundo deslizamiento (o tocar la fila) la acomoda de vuelta.

---

## [2.74.0] — 2026-07-12

### Novedades
- **Deslizá para eliminar**: en el panel de notificaciones y en las listas de movimientos (Movimientos e Inicio), deslizá una fila hacia la izquierda y aparece un tachito rojo. En notificaciones lo tocás y se borra; en movimientos te abre la confirmación de siempre. (Deslizar ya no marca como leída: para eso tocá la notificación o usá "marcar todas".)
- **Se quitó el cambio de pestaña deslizando**: chocaba con los gestos nuevos. Las pestañas se cambian desde la barra de abajo, como siempre.
- **Se quitó el borrado con "mantener apretado"** en los movimientos: ahora se borra deslizando (el tachito). Tocar el movimiento sigue abriendo la edición.

---

## [2.73.1] — 2026-07-12

### Arreglos
- **Los recordatorios vencidos ya no se pierden**: si el aviso de un recordatorio fallaba justo ese día, no volvía a intentarse nunca. Ahora reintenta hasta que te llegue.
- **El botón "Cargar" del aviso de recurrente ahora abre la carga ya completada** (antes abría el formulario vacío; solo funcionaba tocando el cuerpo del aviso).
- **Aviso "ya lo cargaste"**: si abrís la carga de un recurrente desde una notificación vieja y ya lo habías cargado este mes, aparece un cartel amarillo para que no lo dupliques sin querer.
- **Recurrentes sin duplicados por mayúsculas**: "Steam" y "steam" ahora son el mismo recurrente (antes se creaban dos y avisaban doble).
- El aviso del dólar y otros avisos ya no se silencian si el envío falla una vez; reintentan solos.

---

## [2.73.0] — 2026-07-11

### Novedades
- **Títulos renovados**: ahora van centrados, en mayúsculas y con una letra redondeada que acompaña al logo. Las acciones de cada pantalla quedan a los costados; en Inicio, los días del período van justo debajo del título.
- **"Repetir" se marca solo**: si cargás un gasto que ya tenés como recurrente, la opción de repetir viene marcada (con el aviso "ya lo tenés"). No hace falta tildarla cada mes.
- **Se ve que es recurrente**: al abrir o editar un movimiento recurrente aparece la etiqueta "Movimiento recurrente".

### Mejoras
- En Inversión queda un solo ojito para ocultar valores (el de Patrimonio).
- Se quitó "Compartir backup" (no funcionaba de forma confiable); el backup se descarga como siempre.

---

## [2.72.0] — 2026-07-11

### Novedades
- **Panel de notificaciones**: una campanita en Inicio (con un globito rojo si tenés avisos sin leer) abre la lista de todas tus notificaciones. Antes se perdían apenas las descartabas; ahora quedan guardadas.
  - **Tocá una** para ir directo a donde corresponde: el dólar te lleva a Inversión, la de versión nueva al changelog, la de un recurrente te abre la carga ya completada (solo ponés el monto), etc.
  - **Deslizá** una notificación para marcarla como leída sin abrirla, o usá "Marcar todas".

### Arreglos
- **El relojito de recurrente ya no aparece de más**: un gasto con la misma descripción que un recurrente pero distinta observación (ej. Steam "eso pass" vs el recurrente "eso+") ya no se muestra como recurrente.

---

## [2.71.0] — 2026-07-11

### Arreglos
- **Los recordatorios ya no se pierden**: si un aviso push fallaba una vez (por un error momentáneo), el sistema te daba por avisado y no volvía a intentarlo — por eso el recordatorio del sueldo no salió el mes pasado. Ahora se marca como avisado **solo si el aviso llegó de verdad**, y reintenta si falla. Esto vale para sueldo, recurrentes, carga olvidada y recordatorios.
- Los **recordatorios puntuales** ya no se borran si el aviso no llegó.

### Mejoras
- **Gastos recurrentes por observación**: si tenés dos gastos con la misma descripción pero distinta observación (ej. Steam "eso+" y Steam "eso pass"), ahora son recurrentes distintos y no se pisan entre sí.
- En **Reportes**, el detalle de ingresos queda ordenado por fecha (más nuevo arriba).
- **Datos** (Google Sheets, Backup, Invitaciones) pasó a estar dentro de **Cuenta**.
- En **Filtrar y comparar**, el detalle del día quedó más limpio: tocás el día y se abre una tarjeta con las observaciones agrupadas.

---

## [2.70.0] — 2026-07-11

### Novedades
- **Filtrar y comparar** (la lupa arriba en Movimientos): buscá por palabras sueltas y fijalas como etiquetas para juntar varias cosas a la vez (podés comparar, por ejemplo, peajes con nafta).
- Los resultados se agrupan por descripción, con el detalle día por día (con año y observación).
- **Gráfico**: arranca mostrando el total; tocás un grupo y se desglosa en su propia línea de color para ver cuál crece más. Cada grupo elegido tiene un color distinto.
- **Períodos a elección**: tocás los períodos que querés mirar. Si elegís **2**, cada fila te muestra la comparación directa (viejo → nuevo y cuánto varió: verde si gastaste menos, rojo si más).

---

## [2.69.2] — 2026-07-09

### Mejoras
- La pantalla de desbloqueo muestra el indicador de carga mientras valida la huella, y el logo se ve más nítido.

---

## [2.69.1] — 2026-07-09

### Arreglos
- En "Filtrar y comparar", el gráfico ahora muestra el período más reciente a la izquierda (como el resto de la app).

---

## [2.69.0] — 2026-07-09

### Novedades
- **Filtrar y comparar** (nueva 🔍 en Movimientos): buscá por observación/descripción o categoría y mirá cómo evoluciona ese gasto período a período. Los resultados se agrupan por descripción (ej. "Peajes") y, al abrir, ves el detalle por día (mismo día sumado). Total, cantidad y gráfico de evolución incluidos.

---

## [2.68.0] — 2026-07-08

### Cambios
- Sacamos la vibración (no funcionaba bien). Se mantiene el resaltado del movimiento recién cargado.
- Sacamos "compartir a FinMoves" desde otras apps (nunca llegó a funcionar).

---

## [2.67.1] — 2026-07-08

### Arreglos
- **Subir comprobante** ya no falla en el primer intento cuando la app estuvo un rato inactiva (reintenta solo hasta que sube).

---

## [2.67.0] — 2026-07-07

### Novedades
- **Nueva animación de carga**: el logo FM con dos aros girando en los colores de la app.

---

## [2.66.1] — 2026-07-07

### Arreglos
- El botón "+" vuelve a flotar donde debe (se había desubicado con el cambio de pestañas anterior).
- **Menos consumo de batería**: sacamos una conexión que quedaba abierta todo el tiempo.
- La vibración al guardar ahora se siente (era muy cortita).

---

## [2.66.0] — 2026-07-07

### Novedades
- **Compartí un pago a FinMoves y se pre-carga solo**: al compartir desde Mercado Pago (u otra app), tomamos el monto y una descripción y abrimos la carga con eso listo. Vos revisás y guardás.
- **Cambiar de pestaña ahora se siente nativo**: el contenido sigue tu dedo al deslizar y la nueva pestaña entra desde el costado. Además, al volver a una pestaña quedás donde estabas (no vuelve arriba de todo).
- **Aviso "Sincronizando…"** mientras se guardan tus movimientos, para que sepas que está subiendo.
- **Compartir backup**: en Configuración › Datos podés mandar tu copia de seguridad por WhatsApp, mail, etc.

---

## [2.65.0] — 2026-07-12

### Novedades
- **Cargar un movimiento ahora es instantáneo**: se guarda y cierra al toque, sin esperar. El comprobante se sube solo por detrás; si falla, te avisa con un botón "Reintentar" y no perdés la foto.
- **Al crear tu cuenta podés cargar tu sueldo** en el último paso: así el inicio ya te muestra datos desde el día 1.

### Arreglos
- Ahora sí vibra al guardar, editar y borrar (antes no llegaba a dispararse).

---

## [2.64.0] — 2026-07-12

### Mejoras
- Ahora cuando guardás, editás o borrás un movimiento sentís una vibración y el nuevo aparece resaltado por un instante. Se puede apagar desde Configuración › Preferencias.
- La "inflación personal" muestra el mismo número en Inicio y en Reportes (antes podían diferir).
- Textos más legibles (mejor contraste) y la app carga con su tipografía de una, sin parpadeo.
- Íconos más prolijos al adjuntar comprobante y botones más fáciles de tocar.
- Detalles finos en tema claro y en los avisos de instalar/actualizar.

---

## [2.63.2] — 2026-07-12

### Arreglos
- La ganancia de la reserva en dólares/euros ahora se calcula solo sobre lo comprado en la app (el saldo inicial la inflaba).
- Al vender o gastar euros, la cotización que se muestra es la que se usa (antes podía mostrar la del dólar).
- Editar un movimiento ya no permite guardar sin monto (rompía los números del período).
- Al editar, los medios de pago ahora son los tuyos (antes aparecía una lista fija).
- Arreglos menores de colores en tema claro y mejoras internas.

---

## [2.63.1] — 2026-07-12

### Mejoras
- El selector de comprobante ahora es una tarjeta flotante compacta, solo con íconos.
- Al abrir la carga de movimiento ya no se levanta el teclado solo.

---

## [2.63.0] — 2026-07-12

### Novedades
- **Nuevo selector al adjuntar comprobante**: tocando 📎 ahora elegís entre Cámara (abre directo la cámara), Galería o Archivo (PDF), con el estilo de la app.

---

## [2.62.0] — 2026-07-12

### Novedades
- **El botón atrás ahora se comporta como una app nativa** (en Android): cierra el modal abierto, vuelve de una subpantalla a su sección, desde cualquier pestaña te lleva a Inicio, y en Inicio te avisa "tocá atrás de nuevo para salir" antes de cerrar.

---

## [2.61.1] — 2026-07-12

### Mejoras
- Arreglos menores internos (sin cambios visibles).

---

## [2.61.0] — 2026-07-12

### Mejoras
- Arreglos menores internos (sin cambios visibles).

---

## [2.60.2] — 2026-07-12

### Mejoras
- Arreglos menores internos (sin cambios visibles).

---

## [2.60.1] — 2026-07-12

### Mejoras
- Arreglos menores internos (sin cambios visibles).

---

## [2.60.0] — 2026-07-12

### Mejoras
- Arreglos menores internos. (Se está probando una función experimental de "doble atrás para salir", por ahora apagada y sin efecto para vos.)

---

## [2.59.4] — 2026-07-11

### Arreglos
- Se corrigió que al escribir un número en el presupuesto (y en otros formularios) se cerraba el teclado en cada tecla.

---

## [2.59.3] — 2026-07-11

### Arreglos
- Se corrigió un problema serio: al abrir un KPI (o en otras pantallas) te llevaba a Inicio, y al cargar el presupuesto se cerraba el teclado. Se quitó el "doble atrás para salir", que era lo que lo causaba.

---

## [2.59.2] — 2026-07-11

### Mejoras
- Mejoras internas de organización del código (sin cambios visibles).

---

## [2.59.1] — 2026-07-04

### Mejoras
- Mejoras internas y más tests (sin cambios visibles).

---

## [2.59.0] — 2026-07-04

### Mejoras
- **Atajos para cargar más rápido**: mantené apretado el ícono de FinMoves → "Nuevo movimiento"; o compartí un texto a FinMoves desde otra app; o tocá **"Cargar"** en los avisos de recurrentes/carga olvidada. Todo abre directo la carga de movimiento.
- Nuevo intento de arreglo del "doble atrás para salir" en Inicio (a confirmar en tu teléfono).

---

## [2.58.2] — 2026-07-04

### Mejoras
- Arreglo del "doble atrás para salir": en Inicio el primer atrás ahora **avisa** y el segundo cierra (antes, en algunos casos, salía sin avisar).

---

## [2.58.1] — 2026-07-04

### Mejoras
- Se rehízo el **doble atrás para salir** con el comportamiento nativo: el "atrás" en una pantalla que no es Inicio te lleva a Inicio, y desde Inicio el primer "atrás" avisa y el segundo cierra la app.

---

## [2.58.0] — 2026-07-03

### Mejoras
- **Se siente más nativa**: se desactivó el zoom con los dedos (como las apps nativas), el contenido ya no queda tapado por el notch en iPhone, y el long-press ya no selecciona texto ni abre el menú de copiar sobre los botones.
- **Detalles**: tocar de nuevo la pestaña activa te lleva al tope, y hay vibración sutil al navegar.

---

## [2.57.1] — 2026-07-03

### Mejoras
- Correcciones menores y optimizaciones internas.

---

## [2.57.0] — 2026-07-03

### Mejoras
- La app carga más rápido y consume menos: cuando cargaste movimientos desde otro dispositivo, ahora trae solo lo nuevo en vez de releer todo.
- La sincronización con Google Sheets volvió a ser diaria, ahora agregando solo los movimientos nuevos. Si editás o borrás algo, la próxima sincronización rehace la hoja completa para que siempre quede fiel. El botón manual sigue dejando la hoja perfecta al instante.

---

## [2.56.2] — 2026-07-03

### Mejoras
- La sincronización automática con Google Sheets ahora es semanal (antes diaria) para bajar el costo de lecturas. El botón de sincronización manual sigue disponible cuando necesites la hoja al día.

---

## [2.56.1] — 2026-07-02

### Mejoras
- **La plantilla de presupuesto ahora se aplica sola**: en el período en curso, si no cargaste un presupuesto propio, se usan los valores de tu plantilla automáticamente. Ya no tenés que cargar todo a mano.
- **El "disponible" del Inicio usa la misma escala que Reportes**: verde mientras tenés margen, rojo solo si te pasás. Y ya no se pone en rojo solo por mover plata a ahorros.
- **Gráfico "Gastos totales" más claro**: las barras muestran los pesos (magnitud) en un color neutro; el semáforo de % queda en el gráfico "gasto sobre sueldo", donde tiene sentido.
- **El período en curso ya no se marca como "el mejor"**: como todavía no terminó, no compite contra los meses completos.

---

## [2.56.0] — 2026-07-02

### Mejoras
- **Colores más consistentes**: la compra de dólares ahora se ve amarilla en todas las pantallas (antes en Inicio salía roja).
- **El "Gastado" ya no es rojo todo el tiempo**: la escala se ajustó a tu ingreso. Verde mientras tenés margen, amarillo al acercarte al límite y rojo solo cuando te pasás del sueldo.
- **La Tendencia ahora se adapta a vos**: en vez de un límite fijo, el color mira tu propia variabilidad. Solo se pone en alerta cuando el período se sale de lo que es normal para tu historial.
- **Números más honestos**: un cambio de 0% real se muestra en color neutro; y si el cambio es chiquito (ej. 0,67%) ya no se redondea a "0%", te muestra el decimal.

---

## [2.55.7] — 2026-07-02

### Mejoras
- En Reportes → Gastos ahora ves el **gasto real** al lado de la tendencia (lo que gastaste sin contar compras de dólares/euros).
- En Reportes → Ingresos los dos "moves" (a disponible y a ahorros) quedaron juntos en una sola card **Moves**, diferenciados por color.
- Menos ruido: sacamos datos repetidos en la tendencia y en el sueldo.

---

## [2.55.6] — 2026-07-01

### Arreglos
- Los recordatorios de gastos recurrentes volvieron a funcionar en meses con muchos movimientos: antes, si cargabas muchos ítems, el aviso de "hace ~1 mes que no cargás esto" podía no llegar.

---

## [2.55.5] — 2026-07-01

### Mejoras
- Correcciones menores.

---

## [2.55.4] — 2026-07-01

### Mejoras
- Correcciones menores.

---

## [2.55.3] — 2026-07-01

### Mejoras
- Correcciones menores.

---

## [2.55.2] — 2026-07-01

### Mejoras
- Correcciones menores.

---

## [2.55.1] — 2026-07-01

### Mejoras
- Arreglos menores y limpieza interna.

---

## [2.55.0] — 2026-07-01

### Mejoras
- **App más liviana y económica**: optimizamos cómo lee datos la app y los recordatorios automáticos, para que consuma menos y ande más ágil.
- **Sincronización con la planilla más prolija**: el botón de sincronizar a mano ahora solo aparece si algo falló. La sincronización se hace sola de forma automática.

---

## [2.54.1] — 2026-06-30

### Mejoras
- Ajustamos el botón de comparar períodos en Reportes para que quede del mismo tamaño que las pastillas.

---

## [2.54.0] — 2026-06-30

### Mejoras
- **Títulos más limpios**: sacamos el textito de arriba de cada sección. "Resumen" ahora se llama **Inicio** y "Cuenta" pasa a llamarse **Configuración**.
- **Cards más prolijas**: los textos de las tarjetas van con mayúscula inicial; la reserva muestra "RESERVA" sin el "USD" repetido, y sacamos el "Objetivo USD" redundante en la meta.
- Pastillas de Reportes al mismo tamaño que las de Movimientos.

---

## [2.53.2] — 2026-06-30

### Mejoras
- El **título/selector de gráfico** en Reportes ahora usa el mismo degradé de la app que los demás selectores, en vez del azul sólido.

---

## [2.53.1] — 2026-06-30

### Mejoras
- **Selectores más lindos y consistentes**: los botones de Reportes (Gastos/Ingresos/Movimientos/Períodos) y las pastillas de año y período ahora usan el mismo degradé de la app (azul→verde), con un fondo suave cuando están seleccionados.

---

## [2.53.0] — 2026-06-29

### Novedades
- **Ingreso en dólares/euros**: ahora podés registrar plata que te entra en divisa (un pago en USD, etc.). Suma a tu reserva sin pasar por el disponible. Lo cargás desde Inversión, en el modal de Reserva (nuevo botón "Ingreso").

### Mejoras
- **Modal de Reserva más prolijo**: los cuatro tipos en una sola fila (Compra/Ingreso en verde, Venta/Gasto en rojo). El Ingreso funciona como el Gasto (solo la cantidad). En Compra/Venta sacamos las opciones de cotización (usa el oficial por defecto) y la fecha quedó más a mano.
- **"Resto del período anterior"**: ya que es plata que ya tenías, dejó de figurar como un ingreso nuevo y ahora se muestra como un movimiento a ahorros (en azul). Tus números no cambian, solo se ve más claro.
- El **sueldo** siempre aparece primero en el período, en cualquier dispositivo.

### Correcciones
- Arreglamos la **inflación personal**, que mostraba valores raros (negativos) apenas arrancaba un período nuevo.

---

## [2.52.0] — 2026-06-29

### Mejoras
- **Configuración más simple**: agrupamos todo en menos secciones (Cuenta, Preferencias, Notificaciones, Movimientos, Inversión, Datos, Ayuda) y volvió el selector de **moneda principal**.
- **Gastado del inicio** ahora muestra el gasto real (sin las compras de dólares/euros).
- **Reportes**: en Gastos, una leyenda aclara cuánto es gasto real y cuánto son compras de divisas.

---

## [2.51.0] — 2026-06-29

### Novedades
- **Evolución del sueldo**: nuevo gráfico en Reportes que muestra tu sueldo a lo largo del tiempo, en dólares (oficial) o ajustado por inflación. Para ver cómo evolucionó tu poder de compra.

### Mejoras
- **Selector de gráficos** más prolijo: en vez de la fila de botones, ahora tocás uno y elegís de una lista. Renombramos las opciones para que se entiendan mejor.
- **"Tu año"** ahora aparece solo en diciembre (es un recap de fin de año).

---

## [2.50.0] — 2026-06-29

### Novedades
- **"Tu año" (resumen anual)**: un recap a pantalla completa, estilo historia, con lo más importante de tu año — cuánto gastaste, dónde, cuánto ahorraste, tu mejor mes, tu inflación vs la del país y cuánto subió tu sueldo. Aparece para años cerrados (y el año en curso recién en diciembre). Lo abrís desde Reportes.

---

## [2.49.0] — 2026-06-29

### Novedades
- **Recurrentes marcados en la lista**: los movimientos que son recurrentes ahora muestran un relojito al lado del nombre, para reconocerlos de un vistazo.

### Mejoras
- **Comprobantes más seguros**: la subida y el borrado de comprobantes ahora pasan por el servidor (con validación), en vez de ir directo. Para vos no cambia nada al usarlo.

---

## [2.48.1] — 2026-06-29

### Mejoras
- **Categorías, medios y orígenes** ahora se manejan como una lista clara: cada uno en su fila con un interruptor para activar/desactivar y un tacho para borrar. Agregar es un botón "+ Agregar" que abre el campo. Mucho más cómodo que los chips de antes.

---

## [2.48.0] — 2026-06-29

### Novedades
- **Configuración renovada**: ahora es tipo Cuenta/Perfil, con tu foto y datos arriba y cada grupo (Preferencias, Notificaciones, Seguridad, Movimientos, Presupuestos, Inversión, Datos, Ayuda) abriéndose en su propia pantalla. Más ordenado y el botón atrás funciona como esperás.

---

## [2.47.0] — 2026-06-28

### Novedades
- **Movimientos recurrentes**: al cargar un gasto o ingreso, podés marcar "Repetir cada período". La app te manda un recordatorio (~1 mes después de la última vez) para que lo cargues, sin crearlo sola. Los administrás en Configuración → Generales → Movimientos recurrentes (pausar o borrar).

### Mejoras
- Aclaramos el texto de "Proyección ahorro" (es lo que vas a sumar el próximo período, no tu saldo total).
- Los modales ya no seleccionan texto sin querer al mantenerlos apretados para moverlos.

---

## [2.46.1] — 2026-06-28

### Mejoras
- **Botón atrás**: si hay un modal abierto, "atrás" lo cierra en vez de salir de la app. Y el deslizar entre secciones se desactiva mientras hay un modal abierto.
- **Mover los modales**: ahora podés arrastrarlos desde toda la cabecera o manteniendo apretado en el medio, sin tener que ir hasta la barrita de arriba.
- **Gasto/Sueldo**: muestra cuánto te pasaste del 100% del sueldo (+86% = gastaste 186%; -14% = gastaste 86%).
- **Proyección de ahorro**: ajustada por inflación, ya no queda por debajo de tu nivel actual.
- **Día pico** (Movimientos): ya no cuenta las compras de dólares.
- **Gráfico de inflación**: muestra el período más reciente a la izquierda y podés tocar cualquier parte de la columna para ir al período.

---

## [2.46.0] — 2026-06-28

### Novedades
- **Poder de compra de tu sueldo**: card nueva en Reportes > Períodos que te dice, en puntos, si tu sueldo le gana o le pierde a la inflación acumulada del país.
- **Gráfico de inflación acumulada**: en la pestaña IP ahora ves tu inflación acumulada vs la del país, lado a lado, desde tu período más viejo.

### Mejoras
- **Reportes más ordenados**: Gasto típico junto a su proyección, Ahorro típico junto a la suya. Sacamos "Ingreso típico".
- **Proyección más precisa**: ahora ajusta por inflación (lleva los períodos viejos a pesos de hoy y proyecta al próximo mes).
- **IPC más fiel a tus períodos**: como cargás el sueldo a fin de mes, el cálculo usa el mes que el período realmente abarca.
- Gráficos variados: Días en área, Gasto/Sueldo en puntos.

---

## [2.45.2] — 2026-06-28

### Mejoras
- **Gráfico de inflación más moderno**: ahora es de puntos conectados por una línea, en vez de barras. Cada punto es un período (arriba en rojo si gastaste más, abajo en verde si gastaste menos).

---

## [2.45.1] — 2026-06-28

### Mejoras
- **Gráfico de inflación (IP)**: ahora incluye el período actual y muestra arriba tu inflación personal promedio. Antes escondía el período en curso y calculaba el cambio al revés.
- **Inflación nominal vs real**: la card de Reportes pasó a llamarse "Inflación nominal" (sin ajustar por inflación) para diferenciarla del gráfico IP, que sí ajusta por IPC.

---

## [2.45.0] — 2026-06-28

### Novedades
- **Gráfico de inflación personal**: en Reportes > Períodos, nueva opción "IP" que muestra, período a período, cuánto cambió tu gasto real (ajustado por inflación) contra el período anterior. Barras hacia arriba en rojo (gastaste más que la inflación) o hacia abajo en verde (le ganaste).

### Mejoras
- **Inflación ajustada de verdad**: ahora usamos datos de inflación (IPC) actualizados, así el dato de inflación del inicio refleja si gastás por encima o por debajo de la inflación real, no solo cuánto subió tu gasto.

---

## [2.44.1] — 2026-06-28

### Mejoras
- **Inflación en el inicio**: ahora compara tu gasto contra el período anterior (antes usaba el promedio histórico). El dato en Reportes > Períodos sigue siendo el promedio histórico.

---

## [2.44.0] — 2026-06-28

### Novedades
- **Inflación personal en el inicio**: reemplazamos "Prom. por mov." por tu inflación personal — cuánto subió (o bajó) tu gasto de un período al otro, sin contar compras de divisas. Verde si bajó, rojo si subió.
- **Gasto sin divisas en Reportes**: nueva opción "Real" en el gráfico de períodos (solo si tu moneda es ARS), que muestra cuánto gastás sin contar compras de dólares o euros.

---

## [2.43.1] — 2026-06-28

### Mejoras
- **Sesión**: ahora dura 3 días sin uso (antes 8 horas) — más cómodo si recibís una notificación y abrís la app sin haberla tocado ese día.
- **Ícono de notificación**: corregido para que muestre el logo de FinMoves en Android.
- **Gráfico de días por período**: el período actual ya muestra el valor correcto, consistente con lo que aparece en el inicio.

---

## [2.43.0] — 2026-06-28

### Accesibilidad
- Mejoras para teclado y lectores de pantalla: ahora podés **cerrar las ventanas con Esc**, el foco se maneja bien al abrirlas/cerrarlas, y los interruptores y gráficos se anuncian correctamente.

---

## [2.42.0] — 2026-06-27

### Interfaz
- El **tema oscuro ahora es el predeterminado** (el diseñado). El claro sigue disponible desde Configuración.
- **Botones más fáciles de tocar**: agrandamos los selectores de período/métrica en Movimientos y Reportes.
- Si tenés activado **"reducir movimiento"** en tu teléfono, ahora la app respeta esa preferencia y baja las animaciones.
- Corregimos textos que aparecían en español estando la app en inglés.

---

## [2.41.1] — 2026-06-27

### Privacidad y seguridad
- Cuando **eliminás tu cuenta**, ahora también se borran tus **comprobantes y foto de perfil** (antes quedaban guardados).
- Arreglamos la **foto de perfil** (la copia desde Google funcionaba mal por un permiso).

---

## [2.41.0] — 2026-06-27

### Reportes · Períodos
- Ahora podés **tocar una barra del gráfico** y te pregunta si querés ir a ese período: desde el gráfico de **gasto** te lleva a Gastos y desde el de **ingreso** a Ingresos, ya filtrados por ese período.
- **El sueldo ahora muestra el del período que estás viendo** (antes mostraba siempre el del último período).
- La **tendencia** y la **proyección** se muestran solo en el período vigente, que es donde tienen sentido.
- Las tarjetas de "gasto más frecuente" y "mayor gasto" muestran el detalle más limpio al tocarlas, y la explicación de los valores típicos quedó más corta.

### Inicio
- Recalibramos los colores del **desvío** para que el verde/amarillo/rojo tenga sentido (antes casi todo daba rojo).

---

## [2.40.0] — 2026-06-27

### Reportes
- Los **promedios, tendencias, desvíos, proyecciones y el ritmo de gasto** ya no se distorsionan por las **compras de dólares/euros**: esos cálculos ahora miran solo tu gasto real. El gráfico de gasto por período también queda más legible.
- Tranquilo: en el **total gastado** y en el detalle **por categoría** las compras de divisa se siguen viendo como siempre.

---

## [2.39.0] — 2026-06-27

### Reportes · Períodos
- Tu gasto top ahora son **dos tarjetas**: **gasto más frecuente** (la categoría con más movimientos) y **mayor gasto** (la que más plata se llevó). Para que entre mejor, el detalle se ve al tocar: la frecuente te muestra las veces y la de mayor gasto el monto exacto.
- Sumamos **ahorro típico** por período y una **proyección de ahorro** para el próximo período.

### Reportes · Movimientos
- En la torta, la leyenda quedó más limpia: **Ahorros** y **Disponible** (el color ya indica que es un move) y **USD** para las compras de dólares.

---

## [2.38.0] — 2026-06-27

### Reportes · Períodos
- La sección quedó como un **resumen general**: arriba tu **inflación personal** (cuánto fue cambiando tu gasto período a período, sin contar compras de dólares).
- Sumamos tu **gasto más frecuente** (categoría, cuántas veces y total) y el **ingreso y gasto típico** por período. Tocá cada uno para ver el número exacto y la explicación.
- Los 4 gráficos de períodos ahora son **uno solo** con un selector (Gasto · Ingreso · Días · Gasto/Sueldo) y un texto abajo que aclara qué estás viendo.

---

## [2.37.0] — 2026-06-27

### Movimientos
- En **Nuevo movimiento**, las categorías ahora van en una sola fila (con scroll lateral si no entran) y ordenadas por las que más usás.

### Reportes
- En **Por categoría** con presupuesto, el color (verde/amarillo/rojo) queda en la barra y el porcentaje; el monto y la meta se ven en neutro.
- En **Por categoría** y **Top descripciones**, las barras ahora van en rojo para gastos y amarillo para compras de dólares. Los montos quedan en blanco/gris.
- En los detalles (descripciones y categoría) los montos se ven en blanco.
- En **Por medio de pago**, la vista previa muestra solo los contadores por tipo; tocando un medio se abre el detalle con los totales por tipo de movimiento (cantidad y plata).

### Inversión
- Al cargar un **gasto en dólares**, debajo del monto ahora ves cuánta reserva tenés y cuánto te queda después del gasto (en verde/amarillo/rojo según cuánto consume).

### Configuración
- Se corrigió que el **teclado se abría solo** al entrar a Ajustes.

---

## [2.36.0] — 2026-06-27

### Toda la app
- Los **ventanas/modals** ahora son todos iguales: el mismo panel que sube desde abajo (como el Historial de sync), con su tirador para arrastrar y cerrar. Se unificaron los de Ajustes (Auto-ahorro, Historial de sync, Changelog, Recordatorios, Invitaciones) con los de Reportes y carga.
- Cuando aparece el **teclado**, los modals suben para no quedar tapados.

### Movimientos
- Al abrir **Nuevo movimiento** el cursor va directo al **monto**, y si cambiás de tipo (Gasto/Ingreso/Move) vuelve al monto. En **+ Reserva** también arranca con el foco puesto.
- El **detalle** de una compra se rediseñó: el monto se ve grande y claro, sin quedar apretado.

### Inicio
- Un **Move "a disponible"** ahora se muestra en celeste (antes salía en violeta); solo los Move "a ahorro" quedan en violeta.

### Reportes
- En la **tendencia de gastos**, al tocarla ahora ves los números: lo gastado este período vs. el promedio histórico.

### Inversión
- El indicador **Por período** ya no se corta; el promedio y la meta se ven al tocar la card.

---

## [2.35.0] — 2026-06-26

### Inversión
- Los indicadores **Por período**, **Proyección** y **Para la meta** ahora se calculan según lo que realmente comprás de dólares/euros cada período (no según lo que sobra en pesos). El promedio arranca en el período actual y se va afinando mes a mes.

### Reportes
- En **Por día** las barras ahora muestran en rojo los gastos y en amarillo las compras de dólares, así un día con compra grande no parece todo gasto. Al abrir el día también se listan esas compras.
- En **Movimientos**, el gráfico de torta quedó centrado y debajo hay una leyenda con cada tipo: tocás el tipo (en vez de la porción del gráfico) y se resalta. Mucho más fácil en el celular.

---

## [2.34.0] — 2026-06-26

### Configuración
- En **Ajustes > General** hay una nueva opción "Dashboard clásico" para volver a los KPIs anteriores (sueldo, gastado, ahorros, retiros).

---

## [2.33.0] — 2026-06-25

### Inicio
- Los **4 indicadores del dashboard** son nuevos: Gastado · Ahorros acumulados · Promedio por movimiento · Desvío. Tocando cualquiera aparece una explicación breve.

---

## [2.32.2] — 2026-06-24

### Reportes
- En **Por medio de pago** ya no aparece la fila "—": los movimientos sin medio asignado se suman a Mercado Pago.

---

## [2.32.1] — 2026-06-24

### Reportes
- Con el **presupuesto** tildado, ahora cada categoría muestra cuánto te **pasaste** (en rojo) o cuánto te **falta** para llegar (en verde), tanto en plata como en porcentaje, en vez del gasto absoluto.

---

## [2.32.0] — 2026-06-24

### Novedades
- **Globo en el ícono de la app**: cuando te llega una notificación, ahora aparece un contador en el ícono de FinMoves (como en otras apps). Se borra recién cuando entrás a la app, no si descartás la notificación. Necesitás tener la app instalada en la pantalla de inicio y las notificaciones activadas.
- **Aviso de versión nueva**: cuando sale una actualización importante, te llega una notificación. Al entrar, el cartel de "Actualizar" hace el resto.

---

## [2.31.0] — 2026-06-23

### Reportes
- **Gráfico de torta interactivo** en la tarjeta de Movimientos: tocás un segmento y te muestra el porcentaje de ese tipo de movimiento en el centro. Tocás de nuevo para deseleccionar.
- **Días por período** — nuevo gráfico en la sección Períodos. Verde si el período duró hasta 29 días, amarillo 30–31, rojo 32 o más.
- La **tendencia** en Movimientos ahora compara la cantidad de movimientos (no el monto gastado). El detalle muestra cuántos movimientos tuvo este período y cuál es el promedio histórico.
- Los **medios de pago**: los gastos sin medio de pago asignado ahora aparecen bajo "Mercado Pago" en el gráfico.

### Inicio
- El período activo ahora muestra **cuántos días lleva** en curso en vez de la fecha de inicio.

---

## [2.30.0] — 2026-06-23

### Mejoras en Reportes
- La sección **Movimientos** ahora muestra el **día pico de gasto** del período en vez del promedio por movimiento.
- La sección **Gastos** ahora muestra el total **movido a ahorros** del período (en violeta).
- La **tendencia** compara el período actual contra el promedio histórico de todos los períodos anteriores, en lugar de los últimos 3 vs. los 3 previos — más representativo cuando tenés muchos meses cargados.
- Nuevo esquema de colores en Reportes: **Movimientos** usa un gradiente teal→violeta, **Períodos** usa rojo→verde. Cada sección tiene su propio tono de fondo en la tarjeta principal.

---

## [2.29.2] — 2026-06-23

### Correcciones
- El badge del día en movimientos ahora muestra los Auto-ahorro en violeta (en vez de amarillo).

---

## [2.29.0] — 2026-06-22

### Mejoras
- El aviso para **instalar la app** ahora aparece como un banner flotante en la parte baja de la pantalla, igual que el de actualización. Queda hasta que la instalés.
- El **código de invitación** se muestra en una tarjeta centrada con botón para copiar.
- El botón de **eliminar cuenta** baja al final de configuración. En vez de borrar inmediatamente, envía una solicitud al admin para que confirme la eliminación de tus datos.

---

## [2.28.1] — 2026-06-22

### Visual
- Los movimientos de **Move a ahorros** ahora aparecen en violeta en toda la app (lista, modal, reportes, inicio).

---

## [2.28.0] — 2026-06-22

### Reportes — Movimientos

- **Hoy**: nuevo KPI que muestra cuánto gastaste hoy (solo período activo).
- **Por categoría**: ahora muestra el total en pesos además de la cantidad de movimientos.
- **Por medio de pago**: se movió al tab Movimientos y ahora desglosa la cantidad por tipo (gasto, ingreso, move, etc.) con colores.
- Se eliminaron "Top 5 descripciones" y el gráfico por día de semana.

### Reportes — Gastos

- Se eliminaron "Categoría que más creció" y "Por medio de pago" (ahora en Movimientos).

---

## [2.27.0] — 2026-06-22

### Presupuestos por período

- **Presupuesto por categoría**: en Reportes → Por categoría, el nuevo ícono de lápiz abre un panel para definir cuánto querés gastar en cada categoría durante el período activo. Se guarda por período; podés tener distintos presupuestos cada mes.
- **Template por defecto**: en Ajustes → Presupuestos podés definir valores base que se pre-cargan al abrir el editor de cada período nuevo.
- **Vista de presupuesto activable**: el botón "Presupuesto" aparece en el encabezado de "Por categoría" cuando hay un presupuesto guardado. Al activarlo, las barras cambian de color (verde / amarillo / rojo según cuánto gastaste) y muestran el monto límite al costado. Por defecto está apagado.
- **Detalle por categoría**: tocando cualquier categoría se abre un panel con todos los gastos de esa categoría en el período, ordenados por fecha.

### Movimientos

- Los contadores de día ahora diferencian "Mover a disponible" (teal) de "Mover a ahorros" (naranja).

---

## [2.26.0] — 2026-06-19

### Configuración inicial

- **Onboarding más rápido**: el proceso de bienvenida pasó de 11 pantallas a 3. Ingresás tu nombre (opcional), elegís la moneda del día a día y si gestionás reservas en divisas, y configurás biometría y notificaciones. Listo.
- **Reportes activos por defecto**: al completar el onboarding, la sección Reportes queda habilitada automáticamente.
- **Tips en la primera visita**: la primera vez que abrís Movimientos, Reportes o Inversión aparece una tarjeta con una breve descripción de la sección. Se cierra con ×.

---

## [2.25.9] — 2026-06-19

### Nuevo en Configuración

- **Backup JSON**: el botón de Backup ahora descarga un archivo `.json` con todos tus movimientos y tu configuración (categorías, medios de pago, orígenes de ahorro). Más completo y fácil de procesar que el CSV anterior.
- **Eliminar cuenta**: podés borrar tu cuenta y todos tus datos desde Configuración → Datos. Se te pide la contraseña para confirmar. La acción es irreversible.
- **Historial de accesos**: si el administrador activó o desactivó un permiso en tu cuenta, ahora lo ves en Configuración → Datos, con la fecha y el motivo.

---

## [2.25.6] — 2026-06-18

### Mejoras
- **Reportes / Movimientos**: los moves a ahorros (naranja) y a disponible (teal) ahora aparecen separados en la barra, la leyenda y las listas de categoría y descripción.
- **Carga de Move**: el chip "Move" tiene borde degradado teal→naranja. Los botones "A Disponible" y "A Ahorros" muestran cada uno su color propio, y el recuadro de info se adapta.

---

## [2.25.5] — 2026-06-18

### Mejoras
- **Moves diferenciados**: los moves a ahorros (naranja) y los moves a disponible (teal) ahora tienen colores distintos y se cuentan por separado. Ya no se mezclan ni se netan entre sí.
- **KPI "Move disponible"**: antes se llamaba "Retiros" y podía verse afectado por el auto-ahorro. Ahora muestra solo los retiros manuales de ahorros hacia disponible.
- **Ahorros acumulados**: el cálculo ahora incluye los moves a ahorros correctamente, mejorando la proyección y el ritmo de ahorro.

---

## [2.25.4] — 2026-06-18

### Nuevo
- **Instalar en iPhone**: la app te guía con dos pasos claros para agregarla a la pantalla de inicio desde Safari.

---

## [2.25.3] — 2026-06-18

### Mejoras
- **Splash en iOS**: al abrir la app instalada en iPhone ahora aparece una pantalla de carga con el logo de FinMoves en lugar de una pantalla en blanco.

---

## [2.25.2] — 2026-06-18

### Corrección
- **Auto-ahorro**: corregido un error donde el monto de auto-ahorro no se descontaba del disponible. A partir de ahora funciona como un Move a ahorros: el disponible baja y los ahorros suben correctamente. Los registros anteriores también fueron corregidos.

---

## [2.25.0] — 2026-06-17

### Nuevo
- **Tendencia de cantidad de movimientos**: los Reportes ahora muestran si hiciste más o menos transacciones que los 3 meses anteriores (en verde si menos, en rojo si más).

### Mejoras
- **KPIs de movimientos reordenados**: layout 2x2 más claro — día/mayor arriba, tendencia/promedio abajo.
- **Gastos sin "Días libres"**: sacamos ese KPI para simplificar.

---

## [2.24.1] — 2026-06-17

### Mejoras
- **Selector de moneda mejorado**: la moneda actual ahora se ve con un icono $ en verde. El botón de la moneda seleccionada se resalta en verde y no se puede hacer clic en él. Orden de secciones en Cuenta reorganizado para mejor flujo.

---

## [2.24.0] — 2026-06-17

### Nuevo
- **Historial de cambios de permisos**: el administrador ahora ve cuándo y por qué (Fix / Bug / Error) se activó o desactivó cada permiso en tu cuenta. Notificaciones de cambios incluyen la fecha y hora.

### Mejoras
- **Estado de conexión más claro**: la fila "Última conexión" ahora muestra si estás conectado (punto verde) o cuándo fue tu última sesión.

---

## [2.23.3] — 2026-06-16

### Arreglos
- **Historial de movimientos**: los gastos de la reserva (GastoUSD/GastoEUR) ya no aparecen en el listado — solo afectan tu inversión, no tus movimientos de pesos.

---

## [2.23.2] — 2026-06-16

### Arreglos
- **Ganancia de la reserva**: el precio promedio y la ganancia ahora se calculan bien al vender o gastar (antes la ganancia quedaba mucho más negativa de lo real).
- **Botón "atrás"**: estando con la sesión iniciada, "atrás" ya no te lleva a la página de bienvenida.

### Mejoras
- La proyección de inversión ahora aclara que es a 3 períodos.

---

## [2.23.0] — 2026-06-15

### Nuevo
- **Tema claro/oscuro desde el inicio**: botón de sol/luna en la página de bienvenida para cambiar el tema de toda la app.

---

## [2.22.0] — 2026-06-15

### Nuevo
- **Inicio renovado**: las funciones ahora se ven en un carrusel con capturas reales que se desliza solo (y con swipe en el celu).
- **Idioma en la bienvenida**: podés ver la página de inicio en español o inglés con el botón de arriba.

### Arreglos
- **Botón "atrás"**: estando con la sesión iniciada, "atrás" ya no te devuelve a la pantalla de inicio de sesión.
- Al entrar a finmoves.app ahora ves la página de bienvenida (antes iba directo al login).

---

## [2.20.0] — 2026-06-15

### Nuevo
- **Página de inicio**: nueva landing con capturas reales de la app, efectos de hover en las cards y botón para instalar la app directamente desde la página de bienvenida.

### Mejoras
- **Plantillas**: se ordenan de mayor a menor uso — la que más usás aparece primero.

### Arreglos
- **Inversión**: cuando alcanzás tu meta de ahorro aparece el badge "ALCANZADA" en la tarjeta.

---

## [2.19.0] — 2026-06-15

### Nuevo
- **Perfil**: el modal de edición pasó a ser una card deslizable desde abajo, con foto y nombre al tope, y las banderas de idioma al lado del botón de cambiar contraseña.

### Arreglos
- Se corrigió el popup de Google que en algunos casos no cerraba correctamente (error COOP).
- El nombre y foto de Google ahora se sincronizan correctamente al vincular la cuenta.

---

## [2.18.4] — 2026-06-15

### Mejoras
- El correo de contacto ahora es **info@finmoves.app**.

---

## [2.18.3] — 2026-06-15

### Arreglos
- Se corrigió un problema que impedía **entrar con Google** (y a veces el ingreso normal) y cargaba mal las tipografías.

---

## [2.18.2] — 2026-06-15

### Mejoras
- Nueva página pública de inicio que explica qué es FinMoves (para el ingreso con Google).

---

## [2.18.1] — 2026-06-15

### Mejoras
- Agregamos las páginas de **Política de Privacidad** y **Condiciones del Servicio** (enlaces al pie del ingreso).

---

## [2.18.0] — 2026-06-15

### Novedades
- **Entrar con Google**: ahora podés vincular tu cuenta de Google (Configuración → Cuenta) y entrar con un toque. Al vincular, tomamos tu **nombre y foto** de Google para tu perfil.

---

## [2.17.1] — 2026-06-15

### Mejoras
- **Recordatorios más inteligentes**: te avisan unos días antes (cuando faltan 3 o menos) y de nuevo el día. Al avisarte el día, el recordatorio se borra solo.

---

## [2.17.0] — 2026-06-15

### Novedades
- **Venta de divisa** en Inversión: al vender, **baja tu reserva** y el dinero en pesos **suma a tu disponible** del mes. El selector ahora es Compra · Venta · Gasto.

### Mejoras
- En la carga, la fila de tipo es más ancha y "Guardar como plantilla" quedó como ícono.
- En Movimientos, las compras y ventas de dólares/euros se ven en **amarillo** (color de divisa).

---

## [2.16.0] — 2026-06-15

### Mejoras
- **Recordatorios** ahora abre como tarjeta centrada, y su acceso se pone **verde** cuando tenés alguno cargado.
- **Configuración reordenada** (Generales): Modo oscuro, Notificaciones, Recordatorios, Huella, Reportes, Auto-ahorro. El **desbloqueo con huella** pasó a Generales.
- Al abrir una ventana, **el fondo ya no se mueve**.
- El botón **Atrás** ahora **sale de la app** en vez de saltar entre secciones.

---

## [2.15.2] — 2026-06-15

### Arreglos
- Deslizar dentro de una ventana emergente ya no cambia de sección: ahora podés scrollear los modales sin que se escape el swipe.

---

## [2.15.1] — 2026-06-15

### Mejoras
- **Auto-ahorro** ahora abre como una tarjeta centrada.
- **Notificaciones y Recordatorios** quedaron arriba de todo en Generales.

---

## [2.15.0] — 2026-06-14

### Mejoras
- **Configuración reordenada**: Notificaciones y Recordatorios ahora están en **Generales**, y la configuración de **Inversión** quedó dentro de la sección **Inversión** (más ordenado).

---

## [2.14.2] — 2026-06-14

### Arreglos
- Las ventanas emergentes (como Recordatorios) ya no aparecían descolocadas o translúcidas: ahora se muestran bien centradas abajo.

---

## [2.14.1] — 2026-06-14

### Mejoras
- **Deslizar dentro de un gráfico o carrusel ya no te cambia de sección** sin querer.
- El aviso de **"Actualizar"** ahora aparece en cada versión nueva.

---

## [2.14.0] — 2026-06-14

### Novedades
- **Recordatorios**: en Configuración (con notificaciones activadas) podés cargar avisos puntuales con **texto + fecha**; te llega como notificación ese día.
- **Aviso si te olvidás de cargar**: si pasan varios días sin registrar un movimiento, te lo recordamos.

### Mejoras
- **"Guardar como plantilla"** quedó arriba, al lado del tipo, más a mano.

---

## [2.13.0] — 2026-06-14

### Novedades
- **Plantillas de gastos**: guardá un gasto frecuente como plantilla y la próxima vez cargalo con **un toque** — se precarga todo (categoría, monto editable, descripción, medio de pago) y solo confirmás. Cada plantilla se borra con la ×.

### Mejoras
- El color **naranja del Move** ahora también en Inicio.

---

## [2.12.1] — 2026-06-14

### Mejoras
- **Move tiene su propio color** (naranja), para distinguirlo de los dólares.
- En **Movimientos**, los días anteriores al más reciente se ven resumidos con la **cantidad de movimientos por tipo** (en color) y se abren con un toque.

---

## [2.12.0] — 2026-06-14

### Novedades
- **Días plegables en Movimientos**: solo el último día queda abierto; los días anteriores se muestran resumidos (fecha · cantidad · total gastado) y se abren con un toque. Adiós al scroll eterno cuando hay muchos días.

### Mejoras
- Las ventanas emergentes de Reportes (historial de sueldo, directo a ahorros, detalle del día, listas completas) ahora son todas la misma hoja deslizable, consistente con el resto de la app.
- **Las actualizaciones ya no molestan**: la app se actualiza sola la próxima vez que la abrís. Solo vas a ver el aviso "Actualizar" cuando una versión lo requiera de verdad.

---

## [2.11.0] — 2026-06-14

### Novedades
- **Deslizá entre secciones**: pasá de una pestaña a la de al lado deslizando el dedo hacia los costados (respeta tu orden y las pestañas que tengas ocultas). El gesto arranca desde el centro para no chocar con el "volver" de iOS ni con los carruseles.
- **Más datos en Períodos**: ahora ves la **mediana** de gasto por período (el valor típico, que no se distorsiona por un período raro) y una **variación** (`±%`) que te dice qué tan parejo es tu gasto entre períodos: verde = parejo, rojo = irregular. Mejor y peor período quedaron arriba, al lado.

### Mejoras
- La tarjeta de proyección del próximo período ya no repetía dos veces "promedio de los últimos 3".

---

## [2.10.2] — 2026-06-14

### Mejoras
- **Editar o borrar un movimiento es instantáneo** y usa menos datos.
- Si una edición o borrado falla, ahora te avisa con un mensaje (antes no se veía).

---

## [2.10.1] — 2026-06-14

### Mejoras
- **Hoja de carga renovada**: fondo desenfocado y una apertura más suave. La **barrita de arriba ahora funciona**: arrastrala hacia abajo para achicar la hoja (sin perder lo que cargaste), hacia arriba para agrandarla, y bien abajo para cerrarla.
- Las **fotos de comprobantes cargan mucho más rápido**.

---

## [2.10.0] — 2026-06-14

### Novedades
- **Tocá un KPI para ver el detalle**: en Reportes y en la meta de Inversión, al tocar una tarjeta se abre una card flotante con el **número exacto** y una explicación de qué significa. Las tarjetas quedaron más limpias.
- **Confirmaciones y detalles como card flotante**: eliminar un movimiento, borrar categorías/medios/orígenes, las advertencias de Configuración, el detalle del historial de Inversión y el historial de aumentos de sueldo ahora abren en una card centrada (antes era una hoja desde abajo).

### Mejoras
- **Reportes**: "vs período anterior" ahora muestra la **diferencia en $**; "categoría que más creció" muestra cuánto era antes. Aclaramos Tendencia (rojo = gastás más, verde = menos). El botón **"Comparar" pasó a "Varios"**.
- **Inversión**: precio promedio y ganancia se sumaron al recuadro principal (sacamos las dos tarjetas grandes).
- **Comprobantes**: la foto se ve enmarcada y el fondo del visor es más transparente (se ve la app detrás).

---

## [2.9.1] — 2026-06-14

### Novedades
- **Los comprobantes se abren dentro de la app**: al tocar una foto se abre un visor a pantalla completa con **zoom de dos dedos**, doble-toque para acercar y arrastrar para moverla. Los PDF se ven embebidos. Se cierra con ×, tocando afuera o Escape. Ya no te manda a esa dirección web fea.

---

## [2.9.0] — 2026-06-14

### Novedades
- **Cargá tu reserva desde Inversión**: un **+** verde abre un modal **+Reserva / −Reserva** en tu moneda (USD/EUR), rápido y compacto (tipo + fecha en una fila, "ingresar en" + cotización juntos). Cargás en pocos toques.
- **Disponible y restante en vivo**: al comprar reserva ves cuánto te queda del período a medida que cargás, con semáforo (verde / amarillo / rojo) según cuánto gastás.
- **El historial ahora muestra también los retiros** (−Reserva), en rojo, además de las compras.
- **Tocá un movimiento del historial** para ver su **detalle completo** (cantidad, cotización, etc.). Editar sigue siendo desde Movimientos.
- El historial muestra los **últimos 5** con "ver más".

### Cambios
- Las cargas a la reserva (+/−) salieron del modal de movimientos: ahora se hacen desde la pantalla de Inversión.

---

## [2.8.1] — 2026-06-14

### Arreglos
- **Se mezclaban preferencias entre cuentas en el mismo dispositivo**: la moneda de inversión y los toggles de secciones (Inversión/Reportes) quedaban guardados solo en el dispositivo y se filtraban de un usuario a otro. Ahora cada cuenta guarda lo suyo en su perfil, se carga al iniciar sesión y se limpia al cerrar sesión.

---

## [2.8.0] — 2026-06-14

### Novedades
- **Cotización manual** (Configuración → Inversión): un switch para usar un valor fijo en vez del automático de bluelytics. Si lo activás, ese valor se usa para valuar tu reserva en la moneda de inversión. Arriba ves siempre qué cotización estás usando.
- **Borrar un movimiento ahora es con mantener apretado**: dejá el dedo sobre el movimiento (en Movimientos o en Inicio) y se abre directo la confirmación para eliminar. Sacamos el tachito de la edición. (El sueldo que abre un período sigue sin poder borrarse.)

### Mejoras
- Tu **cotización es siempre la oficial**; el blue solo lo elegís al cargar una compra/gasto en dólares o euros.
- La sección **Inversión** ahora muestra el nombre en grande y la(s) moneda(s) arriba en chiquito.
- **Reportes** ya no se configura por partes: se ve todo siempre. Queda solo el encendido/apagado en Generales.
- Al entrar a **Configuración**, la sección **Cuenta** aparece abierta.
- **Editar movimiento** más prolijo: arriba Tipo · Categoría · Fecha, y abajo Monto + Descripción en una fila. Observaciones ya no dice "(opcional)".
- En el **changelog**, el "+" pasó a ser un **"ver más"** al pie.

---

## [2.7.0] — 2026-06-14

### Novedades
- **Descripción más inteligente**: te sugiere lo que ya cargaste antes según la categoría elegida.
- En el **changelog**, un botón **"+"** abre el historial completo en la web (te avisamos antes de salir del sitio).
- Si no usás la sección **Inversión**, ya no aparecen las cargas a la reserva (+USD/-USD/+EUR/-EUR).
- Ajustes en la pantalla de carga: el comprobante quedó como ícono junto a observaciones y el botón de confirmar.

---

## [2.6.2] — 2026-06-14

### Mejoras
- Pantalla de carga más compacta: el **comprobante** es un ícono al lado del medio de pago, y **observaciones** comparte fila con el botón de confirmar.

---

## [2.6.1] — 2026-06-14

### Mejoras
- Cargar un movimiento es más rápido: el **monto va primero**, con la **fecha al lado**.

---

## [2.6.0] — 2026-06-14

### Novedades
- Los **comprobantes** ahora también pueden ser **PDF**, no solo fotos.

---

## [2.5.0] — 2026-06-14

### Novedades
- **Comprobantes**: ahora podés adjuntar una **foto** a cada movimiento (al crearlo o editarlo), verla, reemplazarla o quitarla. Se guarda de forma segura y privada.

---

## [2.4.2] — 2026-06-14

### Correcciones
- Al cargar un gasto, el aviso de auto-ahorro ya no aparece si la descripción es una de las que excluís — la pantalla queda más limpia.

---

## [2.4.1] — 2026-06-14

### Mejoras
- La app **carga más rápido** y consume menos datos.

---

## [2.4.0] — 2026-06-14

### Novedades
- **Move en dos direcciones**: además de pasar plata de Ahorros a Disponible, ahora podés hacer el inverso (**Disponible → Ahorros**) para guardar. Elegís la dirección al cargar el Move; baja tu disponible y suma a tus ahorros.

---

## [2.3.2] — 2026-06-13

### Mejoras
- Las **notificaciones del dólar** ahora son más a tiempo y avisan por el cambio acumulado del día (antes podían no saltar).

---

## [2.3.0] — 2026-06-13

### Mejoras
- **Guía de inicio renovada**: ahora explica los **tipos de movimiento** y cómo funcionan los **ahorros y la reserva**, con el flujo de sueldo actualizado (sumar al período o abrir uno nuevo).
- Desde la guía ya podés **activar el desbloqueo con huella y las notificaciones**, sin tener que ir a Configuración.

---

## [2.2.0] — 2026-06-13

### Novedades
- **Aviso de novedades**: cada tanto (cada 5 versiones) te aparece un aviso con un botón **"Ver cambios"** que abre el detalle de las novedades. Así te enterás de lo nuevo sin que te moleste en cada actualización chica. También llega como notificación.

---

## [2.1.4] — 2026-06-13

### Correcciones
- La **cotización del euro** ahora carga bien también para usuarios nuevos (antes podía aparecer vacía).
- Si tu inversión es en **euros**, la **reserva inicial** ahora se carga y se muestra en EUR (antes quedaba fija en USD y se ignoraba).

---

## [2.1.3] — 2026-06-13

### Mejoras
- Un sueldo que **suma** al período en curso ahora se puede **eliminar**; el sueldo que **abre** el período no (es el que lo sostiene).
- Al eliminar, te avisamos que **la acción no se puede deshacer**.

---

## [2.1.2] — 2026-06-13

### Mejoras
- **"Tablero" ahora se llama "Resumen".**
- En Resumen, los atajos quedaron ordenados: Nuevo movimiento · Inversión · Reportes.
- El aviso de "sin conexión" ahora aparece **arriba**.
- Pequeño ajuste visual en la pantalla de carga.

---

## [2.1.0] — 2026-06-13

### Novedades
- **Sueldo con ingresos variables**: al cargar el sueldo ahora podés elegir entre **"Sumar al actual"** o **"Nuevo período"**. Ideal si cobrás por día o de forma irregular: vas sumando durante el ciclo y decidís cuándo arranca el período nuevo.
- Cuando un sueldo **abre un período nuevo**, lo que te sobró del anterior pasa solo a **Ahorros**.
- Ahora podés **editar la descripción** de un sueldo cargado.

### Mejoras
- **Cambiar contraseña** más seguro: te pide tu **contraseña actual** para confirmar y, al cambiarla, cierra la sesión para que entres con la nueva.
- El botón flotante **+** ahora se oculta mientras deslizás la lista y reaparece al soltar, así no te tapa los movimientos.

---

## [2.0.0] — 2026-06-13

¡Llegamos a la **versión 2.0**! 🎉 Un hito que junta todo lo último: crear y editar movimientos desde Inicio, contador en el ícono de la app, Reportes e Inversión renovados, notificaciones nuevas (metas de ahorro y recordatorio de sueldo), idioma completo ES/EN y una app más rápida. Por dentro también se mudó a una base más sólida. Nada cambia en cómo la usás: todo sigue donde estaba, mejor.

---

## [1.30.0] — 2026-06-13

### Novedades
- **Nuevas notificaciones**: te avisamos cuando alcanzás un hito de tu meta de ahorro (50/75/100%) y te recordamos cargar el sueldo cuando arranca un período nuevo.

---

## [1.29.0] — 2026-06-13

### Mejoras
- Desde **Inicio** ahora podés crear un movimiento o tocar uno reciente para editarlo, y se abre ahí mismo (ya no te lleva a la pestaña de Movimientos).
- La app instalada muestra un **contador** en su ícono con los movimientos del período.

---

## [1.28.0] — 2026-06-13

### Mejoras
- **Mejor experiencia como app instalada**: la barra del navegador toma el color correcto según el tema (claro/oscuro) y, si te quedás sin internet, ves una pantalla de "Sin conexión" en vez de un error.
- Mejoras internas de rendimiento y orden del código (sin cambios visibles en el uso diario).

---

## [1.27.1] — 2026-06-13

### Mejoras
- Iconos y logo de la app actualizados y más livianos.

---

## [1.27.0] — 2026-06-13

### Mejoras
- **Inicio renovado**: los datos (Sueldo, Gastado, Ahorros, Retiros) se ven en tarjetitas parejas con el resto de la app, y sumamos **atajos** para crear un movimiento o ir a Reportes/Inversión de un toque.
- Desde Inicio, tocá un movimiento de "Últimos movimientos" y se abre directo para editarlo.
- En Movimientos ya no hace falta el lapicito: tocás cualquier parte del movimiento y se abre para editarlo.

---

## [1.26.0] — 2026-06-13

### Mejoras
- **Inversión renovada**: misma estética que Reportes. La Reserva (USD/EUR) queda como tarjeta destacada y el resto con un look más limpio y parejo. Los datos de precio promedio, ganancia y la meta ahora se ven en tarjetitas ordenadas.
- Los números de la meta se calculan todos con la misma base (promedio de los últimos 3 períodos), así son coherentes entre sí, y se muestran con separador de miles.

---

## [1.25.1] — 2026-06-13

### Mejoras
- Ajustes visuales en Configuración: el icono de Backup quedó del mismo color que el de códigos de invitación, y sacamos las flechitas de la derecha en las filas donde el propio icono ya hace la acción.
- Sincronización con Google Sheets: ahora tocás la fila para ver el historial (sacamos el botón del relojito), igual que el resto de las opciones.
- Reportes: la selección de períodos es más cómoda al tacto. Ahora un toque elige un período, y con el botón **Comparar** sumás o sacás varios para compararlos (antes había que mantener apretado). Botones más grandes y fáciles de tocar.

---

## [1.25.0] — 2026-06-13

### Mejoras
- **Idioma completo**: ahora toda la app cambia de idioma de punta a punta, incluidos los títulos grandes de cada pantalla (Tablero, Movimientos, Reportes, Configuración, Dólares/Euros) y varios textos que antes quedaban fijos. Tus datos no se modifican: el cambio es solo visual.

---

## [1.24.2] — 2026-06-13

### Mejoras
- **Cambiar contraseña** más prolijo: ahora es una opción que se despliega solo si la tocás, con un ojito para ver lo que escribís. Ya no aparece un campo vacío colgado.
- Los iconos de **huella** y **notificaciones** se ponen en **verde** cuando están activos.
- El botón **Guardar** del perfil se activa solo si hay cambios.
- En Reportes, el gráfico "Evolución ingresos" ahora tiene el mismo borde que el resto.
- La proyección de ahorros arranca en **3 períodos** por defecto.

### Correcciones
- Si tenés el desbloqueo por huella activo, el aviso de **nueva versión** ya aparece aunque la app esté bloqueada.

---

## [1.24.1] — 2026-06-13

### Novedades
- **Instalá FinMoves como app**: nuevo botón en Configuración para instalarla en tu teléfono o compu (aparece solo si tu navegador lo permite y todavía no la instalaste).
- **Accesos directos**: al mantener presionado el ícono de la app podés saltar directo a Nuevo movimiento, Reportes o Inversión.

---

## [1.24.0] — 2026-06-13

### Novedades
- **Tu perfil**: tocá tu usuario en Configuración para ponerte un **nombre** y cambiar la **contraseña**. Cuando cargás tu nombre, aparece en lugar de "Usuario".
- **Guía siempre a mano**: nueva sección "Guía" en Configuración que explica cómo funciona la app, con un botón para **volver a ver el tutorial** cuando quieras.
- El selector de idioma ahora vive dentro de tu perfil.

---

## [1.23.0] — 2026-06-13

### Novedades
- **Reportes renovados por completo**: Gastos, Ingresos, Movimientos y Períodos quedaron más limpios y modernos, con un dato principal destacado arriba y métricas claras debajo.
- Movimientos ahora muestra la distribución por tipo y el movimiento más grande del período.
- Períodos pasó a ser una vista histórica (deja de repetir datos que ya ves en otras secciones).

### Mejoras
- Los montos grandes en Reportes ahora se ven completos (abreviados, ej. $1,6M).

---

## [1.22.2] — 2026-06-12

### Mejoras
- Arranque guiado para cuentas nuevas: si todavía no empezaste, la app te lleva a cargar tu primer sueldo.

---

## [1.22.1] — 2026-06-12

### Mejoras
- Arreglamos el arranque para cuentas nuevas: ahora el primer sueldo abre tu primer período sin trabas.
- Podés cargar tu **reserva inicial en USD** desde Configuración → Inversión.
- La pantalla de cargar movimiento quedó toda traducida.
- Reportes (Gastos) más limpio y fácil de leer.

---

## [1.22.0] — 2026-06-12

### Novedades
- **Guía de bienvenida** para usuarios nuevos: una pantalla simple que explica cómo funciona la app y deja todo listo en un minuto.
- **¿Olvidaste tu contraseña?** en el ingreso, para recuperarla por email.

### Mejoras
- La app quedó lista como aplicación instalable (íconos y detalles de PWA).
- Pequeños ajustes visuales.

---

## [1.21.0] — 2026-06-12

### Novedades
- **Notificaciones al celular**: activalas en Configuración → Cuenta. Te avisan cuando falla la sincronización, cuando hay una versión nueva, y cuando el dólar oficial se mueve fuerte (3% o más).

---

## [1.20.0] — 2026-06-11

### Novedades
- **Sección Inversión renovada**: más limpia y compacta. Pasó de muchas tarjetas a 3 bloques (Reserva, Meta e Historial), con toda la info de la meta en un solo lugar.

### Mejoras
- Sacamos el "U$D" repetido en cada número: el símbolo queda solo donde hace falta y se lee más fácil.

---

## [1.19.0] — 2026-06-11

### Novedades
- **Configuración renovada**: ahora todo está en una sola pantalla, con secciones que se despliegan al tocarlas. Tu cuenta y la sincronización quedaron arriba de todo.
- **Cambio de idioma con confirmación**: tocás la bandera, confirmás y la app se recarga ya en el idioma elegido.

### Mejoras
- El changelog ahora muestra solo las novedades más recientes, en lenguaje claro.

---

## [1.18.0] — 2026-06-11

### Novedades
- **Desbloqueo con huella**: activalo en Configuración → Cuenta. Al abrir la app te pide la huella antes de mostrar tus datos. Si falla, podés entrar con tu contraseña.
- **Aviso de fallo de sincronización**: si la sincronización con Google Sheets falla, aparece un punto rojo en el ícono de Configuración para que sepas que hay que revisar.

---

## [1.17.0] — 2026-06-11

### Novedades
- **Funciona sin conexión**: tus movimientos quedan disponibles aunque te quedes sin internet, y lo que cargues se sincroniza al reconectar.

### Mejoras
- El aviso de "nueva versión disponible" se ve más moderno y prolijo.
- El ícono de la app quedó más nítido.

---

## [1.16.0] — 2026-06-11

### Novedades
- **Pantalla de ingreso renovada**: más moderna y simple, con mostrar/ocultar contraseña.
- **La sesión se cierra sola** tras 8 horas sin uso, por seguridad.
- **Aviso cuando no hay internet**: una franja te avisa si te quedás sin conexión.

### Mejoras
- Los mensajes de error al ingresar ahora son claros ("Email o contraseña incorrectos") en vez de textos técnicos.

---

## [1.15.0] — 2026-06-11

### Novedades
- **Español e inglés**: cambiá el idioma de toda la app desde Configuración → Cuenta, tocando la bandera.

---
