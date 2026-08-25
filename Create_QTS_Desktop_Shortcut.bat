@echo off
setlocal
set "QTS_APPDIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$app=$env:QTS_APPDIR; $desktop=[Environment]::GetFolderPath('Desktop'); $lnk=Join-Path $desktop 'Q.T.S Scheduler.lnk'; if(Test-Path $lnk){Remove-Item $lnk -Force}; $ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut($lnk); $s.TargetPath=Join-Path $app 'index.html'; $s.WorkingDirectory=$app; $s.IconLocation=(Join-Path $app 'qts-scheduler.ico') + ',0'; $s.Description='Q.T.S Scheduler'; $s.Save()"
if errorlevel 1 (
  echo.
  echo Shortcut creation failed.
  echo Please keep all files in this folder and try again.
  pause
  exit /b 1
)
echo.
echo Q.T.S Scheduler desktop shortcut was created.
echo You can close this window.
pause
