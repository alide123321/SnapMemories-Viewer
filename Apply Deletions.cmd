@echo off
REM Moves memories you deleted in the viewer into the "Deleted Memories" folder.
REM First, in the viewer's Deleted tab, click "Export deletion list".
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python apply_deletions.py
) else (
  py apply_deletions.py
)
echo.
pause
