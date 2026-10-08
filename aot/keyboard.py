# -*- coding: utf-8 -*-
"""Input no bloqueante para Windows: teclado + clicks del mouse.

Eventos que produce poll():
    ("key", <char minúscula o 'ESC'/'SPACE'>)
    ("mouse_left",)   click izquierdo  -> atacar
    ("mouse_right",)  click derecho    -> cortar tendones
"""
from __future__ import annotations

import ctypes
import ctypes.wintypes as wt

# --- constantes de la API de consola
STD_INPUT_HANDLE = -10
ENABLE_PROCESSED_INPUT = 0x0001
ENABLE_MOUSE_INPUT = 0x0010
ENABLE_EXTENDED_FLAGS = 0x0080
ENABLE_QUICK_EDIT_MODE = 0x0040

KEY_EVENT = 0x0001
MOUSE_EVENT = 0x0002
MOUSE_MOVED = 0x0001

FROM_LEFT_1ST_BUTTON = 0x0001
RIGHTMOST_BUTTON = 0x0002

VK_ESCAPE = 0x1B
VK_SPACE = 0x20


class _CHAR_UNION(ctypes.Union):
    _fields_ = [("UnicodeChar", wt.WCHAR), ("AsciiChar", ctypes.c_char)]


class _KEY_EVENT_RECORD(ctypes.Structure):
    _fields_ = [
        ("bKeyDown", wt.BOOL),
        ("wRepeatCount", wt.WORD),
        ("wVirtualKeyCode", wt.WORD),
        ("wVirtualScanCode", wt.WORD),
        ("uChar", _CHAR_UNION),
        ("dwControlKeyState", wt.DWORD),
    ]


class _MOUSE_EVENT_RECORD(ctypes.Structure):
    _fields_ = [
        ("dwMousePosition", wt._COORD),
        ("dwButtonState", wt.DWORD),
        ("dwControlKeyState", wt.DWORD),
        ("dwEventFlags", wt.DWORD),
    ]


class _EVENT_UNION(ctypes.Union):
    _fields_ = [("KeyEvent", _KEY_EVENT_RECORD), ("MouseEvent", _MOUSE_EVENT_RECORD)]


class _INPUT_RECORD(ctypes.Structure):
    _fields_ = [("EventType", wt.WORD), ("Event", _EVENT_UNION)]


class WinInput:
    """Lee teclado y mouse de la consola de Windows sin bloquear."""

    def __init__(self) -> None:
        self._k32 = ctypes.windll.kernel32
        self._handle = self._k32.GetStdHandle(STD_INPUT_HANDLE)
        self._old_mode = wt.DWORD()
        if not self._k32.GetConsoleMode(self._handle, ctypes.byref(self._old_mode)):
            raise OSError("stdin no es una consola interactiva")
        # Mouse activado; QuickEdit desactivado (se comería los clicks).
        new_mode = ENABLE_EXTENDED_FLAGS | ENABLE_MOUSE_INPUT
        self._k32.SetConsoleMode(self._handle, new_mode)
        self._prev_buttons = 0
        self.mouse_ok = True

    def close(self) -> None:
        self._k32.SetConsoleMode(self._handle, self._old_mode)

    def flush(self) -> None:
        self._k32.FlushConsoleInputBuffer(self._handle)
        self._prev_buttons = 0

    def poll(self) -> list[tuple]:
        events: list[tuple] = []
        count = wt.DWORD()
        if not self._k32.GetNumberOfConsoleInputEvents(self._handle, ctypes.byref(count)):
            return events
        n = count.value
        if n == 0:
            return events
        buf = (_INPUT_RECORD * n)()
        read = wt.DWORD()
        if not self._k32.ReadConsoleInputW(self._handle, buf, n, ctypes.byref(read)):
            return events
        for i in range(read.value):
            rec = buf[i]
            if rec.EventType == KEY_EVENT:
                ke = rec.Event.KeyEvent
                if not ke.bKeyDown:
                    continue
                if ke.wVirtualKeyCode == VK_ESCAPE:
                    events.append(("key", "ESC"))
                elif ke.wVirtualKeyCode == VK_SPACE:
                    for _ in range(max(1, ke.wRepeatCount)):
                        events.append(("key", "SPACE"))
                else:
                    ch = ke.uChar.UnicodeChar
                    if ch and ch.isprintable():
                        for _ in range(max(1, ke.wRepeatCount)):
                            events.append(("key", ch.lower()))
            elif rec.EventType == MOUSE_EVENT:
                me = rec.Event.MouseEvent
                if me.dwEventFlags & MOUSE_MOVED:
                    continue
                pressed = me.dwButtonState & ~self._prev_buttons
                self._prev_buttons = me.dwButtonState
                if pressed & FROM_LEFT_1ST_BUTTON:
                    events.append(("mouse_left",))
                if pressed & RIGHTMOST_BUTTON:
                    events.append(("mouse_right",))
        return events


class MsvcrtInput:
    """Fallback solo-teclado (j = atacar, k = tendones)."""

    def __init__(self) -> None:
        import msvcrt
        self._msvcrt = msvcrt
        self.mouse_ok = False

    def close(self) -> None:
        pass

    def flush(self) -> None:
        while self._msvcrt.kbhit():
            self._msvcrt.getwch()

    def poll(self) -> list[tuple]:
        events: list[tuple] = []
        while self._msvcrt.kbhit():
            ch = self._msvcrt.getwch()
            if ch in ("\x00", "\xe0"):     # tecla especial: descartar el segundo byte
                self._msvcrt.getwch()
                continue
            if ch == "\x1b":
                events.append(("key", "ESC"))
            elif ch == " ":
                events.append(("key", "SPACE"))
            elif ch.isprintable():
                events.append(("key", ch.lower()))
        return events


class ScriptedInput:
    """Para tests: dict {tick: [eventos]}. Llamar advance() cada tick."""

    def __init__(self, script: dict[int, list[tuple]]) -> None:
        self.script = script
        self.tick = -1
        self.mouse_ok = True

    def close(self) -> None:
        pass

    def flush(self) -> None:
        pass

    def advance(self) -> None:
        self.tick += 1

    def poll(self) -> list[tuple]:
        self.advance()
        return list(self.script.get(self.tick, []))


def make_input():
    """Crea el mejor proveedor de input disponible."""
    try:
        return WinInput()
    except Exception:
        return MsvcrtInput()
