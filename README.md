# Ataque a los Titanes — fan game 3D de acción

**Gancho ODM, cortes a la nuca y permadeath real, en tu navegador y sin internet.**

Juego de acción en tiempo real inspirado en *Attack on Titan*: cámara en tercera
persona, gancho ODM con vuelo real hacia la nuca, titanes de hasta 15 metros,
escuadrón con IA, permadeath, modo historia y gestión de tu brigada. Corre con
Three.js + WebGL servido desde un mini-servidor local en Python. Incluye además la
versión original en terminal (ASCII).

![Python](https://img.shields.io/badge/Python-3-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-000000?style=for-the-badge&logo=threedotjs&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Rich](https://img.shields.io/badge/Rich-terminal_UI-4B8BBE?style=for-the-badge)
![Windows](https://img.shields.io/badge/Windows-.bat_launchers-0078D6?style=for-the-badge&logo=windows&logoColor=white)

> **Aviso legal.** Fan game no oficial y sin fines de lucro. *Attack on Titan*
> (*Shingeki no Kyojin*) y sus personajes son propiedad de **Hajime Isayama /
> Kodansha**. Este proyecto no está afiliado ni respaldado por ellos.

---

## Cómo correrlo

Requisitos: Python 3 y un navegador moderno.

```bash
git clone https://github.com/burgosdavid057-art/aot-shingeki.git
cd aot-shingeki
python serve.py          # servidor local en http://localhost:8377
```

Abre `http://localhost:8377` en el navegador (consejo: pantalla completa con **F11**).
En Windows basta con doble click en **`Jugar3D.bat`**: levanta el servidor y abre
el navegador solo. Cierra esa ventana para apagar el juego.

`serve.py` acepta el puerto como argumento (`python serve.py 9000`) y sirve sin
caché, así los cambios en `web/` se ven al recargar.

## Modelos 3D (no vienen en el repo)

Los modelos `.glb` de `web/assets/` **no están versionados**: son de terceros
(Sketchfab, con licencias de cada autor, la mayoría CC-BY) y pesan demasiado.
**El juego funciona igual sin ellos**: si un modelo falta o no carga, usa su
modelo procedural propio y lo avisa en la consola (F12).

Si quieres los modelos, descarga los `.glb` que prefieras de Sketchfab y cópialos
en `web/assets/` con estos nombres:

| Archivo | Uso |
|---|---|
| `house.glb`, `house2.glb`, `house4.glb` | casas de pueblos y defensas |
| `gatehouse.glb` | caseta de la puerta en la muralla |
| `city1.glb` | panorama del distrito tras la muralla |
| `blades.glb` | hojas del soldado |
| `skin_mikasa.glb`, `skin_annie.glb`, `skin_historia.glb`, `skin_reiner.glb`, `skin_zeke.glb` | skins de personaje (se desbloquean en la Armería) |
| `titan_hembra.glb`, `titan_bestia.glb`, `titan_mandibula.glb` | titanes especiales |
| `titan_anormal.glb` | los Anormales |
| `titan_grande.glb` | titanes de 15 m |
| `titan_colosal.glb` | aparición escénica en la misión final |

Se cargan de forma perezosa (solo cuando una misión los necesita). El detalle
completo está en [`web/assets/LEEME.txt`](web/assets/LEEME.txt). Si publicas algo
con ellos, da crédito a cada autor según su licencia.

## Controles (en misión)

| Entrada | Acción |
|---|---|
| **Mouse** | mover la cámara (se captura al hacer click en el juego) |
| `W A S D` | moverte (y forcejear si un titán te atrapa) |
| `ESPACIO` | saltar |
| `SHIFT` | impulso ODM en la dirección de movimiento (gasta gas) |
| **Click derecho** (o `E`) | disparar / soltar el **gancho ODM** |
| **Click izquierdo** | atacar con las hojas (gasta filo) |
| `Q` | lanzar **lanza trueno** (si las equipaste en la Armería) |
| `T` | orden al escuadrón: «¡A mí!» / «¡Ataquen libres!» |
| `F` | transformación en titán (se desbloquea al completar el capítulo 4) |
| `ESC` | pausa / retirarse de la misión |

El gancho se ancla a titanes, **árboles altos, tejados y la muralla**: apunta y
dispara para columpiarte por el mapa; al llegar sales disparado conservando el
impulso.

**La regla de oro:** a un titán solo lo mata un corte en la **nuca**, la placa
roja tras el cuello. Engánchate, vuela hasta ella y corta justo al pasar. De
frente solo conseguirás un manotazo... o que te **atrape**: machaca `WASD` antes
de que te lleve a la boca. Sin gas no hay ODM.

## Características

- **Modo historia**: 5 capítulos (entrenamiento, defensa de la puerta por
  oleadas, escolta de la carreta, cacería del Anormal en el bosque gigante y la
  operación final en 2 fases para retomar el Muro María).
- **Permadeath real**: un caído tira por su vida; muere para siempre (va al
  memorial) o pasa días en el hospital. Si cae tu personaje, sigues con otro.
- **Titanes con IA**: Puros que persiguen, Anormales en zigzag que saltan, titanes
  de 15 m con barrido. La nuca siempre queda a su espalda.
- **Los especiales**: Titán Hembra (endurece la nuca en ciclos), Titán Acorazado
  (placas que hay que romper) y Titán Bestia (lanza rocas desde lejos).
- **Escuadrón con IA**: hasta 4 compañeros que vuelan con ODM, flanquean,
  rescatan a los atrapados y entran en pánico.
- **Recursos con peso**: gas y hojas salen del almacén; lo que se gasta no vuelve.
- **Defensa de murallas**: la muralla acumula daño entre misiones; a 0, game over.
- **Expediciones** Cercana / Media / Lejana por tramos, con opción de regresar con el botín.
- **Cuartel**: entrenar, reclutar, forjar, descansar, árbol de progresión de 3
  ramas, Armería (hojas estándar/pesadas, lanzas trueno) y capas desbloqueables.
- **Guardado**: 3 slots en `localStorage` con autosave tras cada misión (nunca a mitad de una).

## Stack

- **Versión 3D**: JavaScript (ES modules) + **Three.js** incluido en `web/lib/`
  (con `GLTFLoader` y `SkeletonUtils`), sin build ni dependencias de npm.
- **Servidor**: `serve.py`, servidor HTTP de la librería estándar de Python.
- **Versión terminal**: Python + [Rich](https://github.com/Textualize/rich).

## Estructura

```
aot-shingeki/
├── Jugar3D.bat          lanzador 3D (servidor + navegador)
├── Jugar.bat            lanzador de la versión terminal
├── serve.py             servidor local sin caché (puerto 8377)
├── main.py              entrada de la versión terminal
├── requirements.txt
├── aot/                 motor de la versión terminal
│   ├── engine.py  missions.py  titan_ai.py  hq.py
│   ├── models.py  progression.py  save.py  ui.py ...
├── tests/               test_smoke.py, test_integration.py
└── web/
    ├── index.html       página, HUD y estilos
    ├── assets/LEEME.txt guía de modelos .glb
    ├── lib/             Three.js + loaders/utils
    └── src/
        ├── main.js      bucle principal y estados
        ├── combat.js    misiones, objetivos, oleadas, input
        ├── player.js    tercera persona + física ODM
        ├── titan.js     titanes procedurales e IA
        ├── allies.js    IA del escuadrón
        ├── world.js     terreno, muralla, bosques, carreta
        ├── hq.js        cuartel, expediciones, capítulos, memorial
        ├── state.js     soldados, recursos, árbol, guardado
        ├── assets.js    carga perezosa de modelos
        └── fx.js  hud.js  audio.js  menubg.js
```

## Bonus: versión de terminal

La primera versión del juego, en ASCII (pensada para Windows):

```bash
pip install -r requirements.txt
python main.py           # o doble click en Jugar.bat
```

## Tests

Cubren el motor de la versión terminal:

```bash
python -m tests.test_smoke
python -m tests.test_integration
```

## Autor

**David Burgos**, desarrollador full-stack + IA, Medellín.

- Portafolio: https://davidburgos.dev
- GitHub: https://github.com/burgosdavid057-art
- LinkedIn: https://www.linkedin.com/in/david-burgos-ab673433a/

*«Dedicad vuestros corazones.»*
