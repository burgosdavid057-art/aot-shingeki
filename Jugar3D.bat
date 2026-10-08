@echo off
title Ataque a los Titanes 3D - servidor local
cd /d "%~dp0"
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8377"
echo Juego corriendo en http://localhost:8377
echo CIERRA ESTA VENTANA para apagar el juego.
python serve.py 8377
