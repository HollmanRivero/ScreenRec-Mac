@echo off
REM ── Stille launcher for ScreenRec ──
REM Skjuler Chromium sine WGC-feilmeldinger ved å rute stderr til NUL.
REM Dobbeltklikk denne fila for å starte appen uten konsoll-støy.

cd /d "%~dp0"
npx electron . 2>NUL
exit
