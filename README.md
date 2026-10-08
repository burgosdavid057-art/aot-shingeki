# ⚔ Ataque a los Titanes — juego 3D de acción

Juego de acción **3D en tiempo real** inspirado en *Attack on Titan*: cámara en
tercera persona, gancho ODM con vuelo real hacia la nuca, titanes de hasta 15
metros, escuadrón con IA, permadeath, modo historia y gestión de tu brigada.
Corre en el navegador (Three.js + WebGL), sin internet y sin instalar nada.

## Cómo jugar

**Doble click en el acceso directo del escritorio** («Ataque a los Titanes 3D»)
o ejecuta `Jugar3D.bat`. Se abre en tu navegador en `http://localhost:8377`.

Requisitos: Python (para el mini-servidor local) y un navegador moderno.
Consejo: pantalla completa con **F11**.

## Controles (en misión)

| Entrada | Acción |
|---|---|
| **Mouse** | mover la cámara (se captura al hacer click en el juego) |
| `W A S D` | moverte |
| `ESPACIO` | saltar |
| `SHIFT` | impulso ODM en la dirección de movimiento (gasta gas) |
| **Click derecho** (o `E`) | disparar el **gancho ODM** al titán que apuntas: vuelas hacia su nuca |
| **Click izquierdo** | atacar con las hojas (gasta filo) |
| `Q` | lanzar **lanza trueno** (si las equipaste en la Armería) |
| `T` | orden al escuadrón: «¡A mí!» / «¡Ataquen libres!» |
| `ESC` | pausa / retirarse de la misión |

El gancho también se ancla a **árboles altos, tejados y la muralla**: apunta y
dispara para columpiarte por el mapa como en el anime — al llegar al punto sales
disparado conservando el impulso (honda).

## Los Nueve (eventos especiales)

En expediciones y defensas puede aparecer uno de los titanes legendarios, con
mérito enorme si lo derrotas:

- **TITÁN HEMBRA** — rápida; endurece su nuca en ciclos (cristal azul = inmune).
- **TITÁN ACORAZADO** — placas que bloquean la nuca: rómpelas a cortes o de un
  lanzazo trueno.
- **TITÁN BESTIA** — pelea desde lejos lanzando rocas; cierra la distancia.

## Armería y vestuario (en el cuartel)

- **Hojas estándar / Hojas pesadas** (+daño, más lentas; requieren tecnología).
- **Lanzas trueno** (4 por misión, cuestan hojas del almacén; tras el cap. 2).
- **Capas desbloqueables**: Policía Militar, Capa de luto, Uniforme de gala,
  Ala de la Libertad... se ganan jugando (kills, memorial, especiales).

## Modelos 3D personalizados

Puedes ponerle los modelos de Sketchfab que quieras: descarga el `.glb` y
cópialo en `web/assets/` como `player.glb`, `house.glb`, `house2.glb` o
`house3.glb`. El juego los carga solo. Instrucciones: `web/assets/LEEME.txt`.

**La regla de oro:** a un titán solo lo mata un corte en la **NUCA** — la placa
roja tras el cuello. Engánchate (click derecho), vuela hasta ella y corta (click
izquierdo) justo al pasar. De frente solo conseguirás un manotazo... o que te
**atrape**: si eso pasa, machaca `WASD` antes de que te lleve a la boca.
Sin gas no hay ODM: estás a pie, lento y casi muerto.

## Sistemas

- **Modo historia** — 5 capítulos: entrenamiento, defensa de la puerta por
  oleadas, escolta de la carreta, cacería del Anormal en el bosque gigante y la
  operación final en 2 fases para retomar el Muro María.
- **Permadeath real** — un caído tira por su vida: muere para siempre (su nombre
  va al memorial) o pasa días en el hospital. A los devorados no les toca tirada.
  Si muere tu personaje, continúas como otro soldado de la tropa.
- **Recursos con peso** — el gas y las hojas salen del almacén; lo que se gasta
  no vuelve. Cada soldado que llevas reparte el stock disponible.
- **Titanes con IA** — Puros que te persiguen, Anormales que corren en zigzag y
  saltan (y en defensas ignoran a todos para ir a la puerta), titanes de 15 m
  con barrido. Cada uno con orientación real: la nuca queda a su espalda.
- **Escuadrón con IA** — hasta 4 compañeros que vuelan con ODM, flanquean
  nucas, rescatan a los atrapados, entran en pánico al ver morir a un amigo y
  gastan gas y hojas de verdad.
- **Defensa de murallas** — la muralla acumula daño entre misiones: ignorar
  alertas o fallar defensas la debilita; a 0, game over.
- **Expediciones** — Cercana/Media/Lejana por tramos con eventos; puedes
  regresar con el botín entre tramos. Más lejos = más botín y más tumbas.
- **Gestión** — entrenar stats, reclutar, forjar, descansar, y un **árbol de
  progresión** de 3 ramas + la tecnología que desbloquea la misión final.
- **Guardado** — 3 slots (localStorage del navegador) con autosave tras cada
  misión. No se guarda en mitad de una misión: el permadeath no se negocia.

## Estructura

```
Jugar3D.bat        lanzador (servidor local + navegador)
web/index.html     página, HUD y estilos
web/js/main.js     bucle principal y estados
web/js/combat.js   misiones 3D: specs, objetivos, oleadas, input
web/js/player.js   controlador en tercera persona + física ODM
web/js/titan.js    mallas procedurales y IA de titanes
web/js/allies.js   IA del escuadrón
web/js/world.js    terreno, muralla, bosques, carreta
web/js/hq.js       menús: cuartel, expediciones, capítulos, memorial
web/js/state.js    soldados, recursos, árbol, guardado
web/js/fx.js       partículas (vapor, sangre, chispas)
web/lib/three.module.js  Three.js (local, funciona sin internet)
```

## Bonus: versión de terminal

La primera versión del juego (ASCII en terminal, por si te da nostalgia):
`Jugar.bat` o `python main.py`. Tests: `python -m tests.test_smoke` y
`python -m tests.test_integration`.

*«Dedicad vuestros corazones.»*
