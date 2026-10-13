@echo off
rem Startet Vokabel-Monster als Vollbild-Fenster in Microsoft Edge (ohne Internet)
start "" msedge --app="file:///%~dp0index.html" --start-fullscreen
