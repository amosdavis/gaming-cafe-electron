#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Hardens a Windows PC for gaming cafe kiosk use.
  Run ONCE per machine setup. Revert with unharden-kiosk.ps1.
  Addresses: F-09 (Task Manager), F-25 (Win key), F-26 (Alt+Tab),
             F-27 (USB AutoRun + storage), F-29 (new user accounts)
#>

param([switch]$WhatIf)

$ErrorActionPreference = 'Stop'
$applied = @()

function Set-Reg {
  param($Path, $Name, $Value, $Type = 'DWord')
  if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
  if ($WhatIf) {
    Write-Host "[WhatIf] Set $Path\$Name = $Value ($Type)"
  } else {
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type -Force
  }
  $script:applied += "$Path\$Name = $Value"
}

Write-Host "`n=== Gaming Cafe Kiosk Hardening ===" -ForegroundColor Cyan

# F-09: Disable Task Manager
Write-Host "`n[F-09] Disabling Task Manager..."
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System' 'DisableTaskMgr' 1

# F-25: Disable Windows key shortcuts
Write-Host "[F-25] Disabling Windows key shortcuts..."
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoWinKeys' 1

# F-26: Reduce Alt+Tab exposure (best-effort; full lockdown requires Group Policy)
Write-Host "[F-26] Configuring AltTab behavior (best-effort)..."
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'MultiTaskingAltTabFilter' 3

# F-27: Disable AutoRun / AutoPlay for all drives
Write-Host "[F-27] Disabling AutoRun/AutoPlay..."
Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoDriveTypeAutoRun' 0xFF
Set-Reg 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoDriveTypeAutoRun' 0xFF
Set-Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' 'NoAutoplayfornonVolume' 1

# F-27: Disable USB Mass Storage (prevents portable app execution from USB drives)
Write-Host "[F-27] Disabling USB Mass Storage class..."
$usbStorPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\UsbStor'
if (Test-Path $usbStorPath) {
  Set-Reg $usbStorPath 'Start' 4  # 4 = Disabled
} else {
  Write-Warning "UsbStor registry key not found — USB storage may not be present on this system."
}

# F-29: Prevent creation of new local user accounts via User Accounts CPL
Write-Host "[F-29] Restricting user account management..."
Set-Reg 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'NoLocalUserCreation' 1

# Summary
Write-Host "`n=== Applied $($applied.Count) hardening settings ===" -ForegroundColor Green
$applied | ForEach-Object { Write-Host "  + $_" -ForegroundColor Gray }
Write-Host "`nREBOOT REQUIRED for some settings to take full effect." -ForegroundColor Yellow
Write-Host "To revert, run: .\unharden-kiosk.ps1`n" -ForegroundColor Cyan
