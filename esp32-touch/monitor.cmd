@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\esp32-pio.ps1" device monitor
