@echo off
:: Gaming Cafe Kiosk — Post-Install Setup Script
:: Runs as SYSTEM on first boot via autounattend.xml FirstLogonCommands.
:: Injected into the ISO at: $OEM$\$$\Setup\Scripts\SetupComplete.cmd
:: Maps to: C:\Windows\Setup\Scripts\SetupComplete.cmd

setlocal EnableDelayedExpansion

set LOG=C:\Windows\Setup\Scripts\SetupComplete.log
set SETUP_DIR=C:\KioskSetup

echo [%date% %time%] === Gaming Cafe Kiosk First-Boot Setup === >> %LOG%

:: ── Step 1: Wait for network / desktop to stabilise ─────────────────────────
echo [%date% %time%] Waiting for system to stabilise... >> %LOG%
timeout /t 10 /nobreak > nul

:: ── Step 2: Silently install Gaming Cafe Kiosk ──────────────────────────────
echo [%date% %time%] Installing Gaming Cafe Kiosk... >> %LOG%

set INSTALLER=%SETUP_DIR%\GamingCafeKiosk-Setup.exe
if not exist "%INSTALLER%" (
    echo [%date% %time%] ERROR: Installer not found at %INSTALLER% >> %LOG%
    goto :error
)

"%INSTALLER%" /S
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: NSIS installer failed with code %errorlevel% >> %LOG%
    goto :error
)
echo [%date% %time%] Kiosk installed successfully. >> %LOG%

:: ── Step 3: Run OS hardening script ─────────────────────────────────────────
echo [%date% %time%] Running OS lockdown script... >> %LOG%

set LOCKDOWN=%SETUP_DIR%\windows-lockdown.ps1
if not exist "%LOCKDOWN%" (
    echo [%date% %time%] ERROR: Lockdown script not found at %LOCKDOWN% >> %LOG%
    goto :error
)

:: Read kiosk password from the environment variable injected by autounattend
:: KIOSK_PASSWORD is set via the registry/environment before this script runs.
:: Fall back to "ChangeMe123!" if not set — admin should change this immediately.
if not defined KIOSK_PASSWORD set KIOSK_PASSWORD=ChangeMe123!

powershell.exe -NoProfile -ExecutionPolicy Bypass ^
    -File "%LOCKDOWN%" ^
    -KioskUser "KioskAdmin" ^
    -KioskPassword "%KIOSK_PASSWORD%" >> %LOG% 2>&1

if %errorlevel% neq 0 (
    echo [%date% %time%] WARN: Lockdown script exited with code %errorlevel% (continuing) >> %LOG%
)
echo [%date% %time%] OS hardening applied. >> %LOG%

:: ── Step 4: Replace Windows shell with the kiosk exe ────────────────────────
echo [%date% %time%] Replacing Windows shell (explorer.exe → kiosk)... >> %LOG%

set KIOSK_EXE=C:\Program Files\Gaming Cafe Kiosk\Gaming Cafe Kiosk.exe
if not exist "%KIOSK_EXE%" (
    echo [%date% %time%] ERROR: Kiosk exe not found at "%KIOSK_EXE%" >> %LOG%
    goto :error
)

:: Set the shell for ALL users via the machine hive
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" ^
    /v Shell /t REG_SZ ^
    /d "\"%KIOSK_EXE%\"" /f >> %LOG% 2>&1

:: Set it for the default user profile too (new accounts)
reg add "HKU\.DEFAULT\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" ^
    /v Shell /t REG_SZ ^
    /d "\"%KIOSK_EXE%\"" /f >> %LOG% 2>&1

echo [%date% %time%] Shell replacement configured. >> %LOG%

:: ── Step 5: Disable Windows auto-update restart prompts ─────────────────────
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" ^
    /v NoAutoRebootWithLoggedOnUsers /t REG_DWORD /d 1 /f >> %LOG% 2>&1
echo [%date% %time%] Auto-reboot on update disabled. >> %LOG%

:: ── Step 6: Schedule cleanup of setup files ─────────────────────────────────
:: Delete KioskSetup folder on next reboot using RunOnce
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce" ^
    /v "CleanupKioskSetup" ^
    /t REG_SZ ^
    /d "cmd /c rd /s /q \"%SETUP_DIR%\"" /f >> %LOG% 2>&1
echo [%date% %time%] Cleanup scheduled. >> %LOG%

:: ── Done ─────────────────────────────────────────────────────────────────────
echo [%date% %time%] === First-boot setup COMPLETE. Rebooting in 5s... === >> %LOG%
timeout /t 5 /nobreak > nul
shutdown /r /t 0 /f /c "Gaming Cafe Kiosk setup complete — rebooting"
exit /b 0

:error
echo [%date% %time%] === First-boot setup FAILED. Check %LOG% === >> %LOG%
exit /b 1
