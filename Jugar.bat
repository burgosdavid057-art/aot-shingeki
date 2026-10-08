@echo off
title Ataque a los Titanes
chcp 65001 >nul
cd /d "%~dp0"
python main.py
if errorlevel 1 pause
