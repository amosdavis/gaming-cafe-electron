#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Reverts all gaming cafe kiosk hardening applied by harden-kiosk.ps1.
  Run this when decommissioning a kiosk PC or doing maintenance.
#>

$ErrorActionPreference = 'Continue'

function Remove-RegVal {
  param($Path, $Name)
  if (Test-Path $Path) {
    try { Remove-ItemProperty -Path $Path -Name $Name -Force -ErrorAction SilentlyContinue } catch {}
    Write-Host "  - Removed $Path\$Name"
  }
}

function Set-Reg {
  param($Path, $Name, $Value, $Type = 'DWord')
  if (Test-Path $Path) {
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type -Force
    Write-Host "  ~ Restored $Path\$Name = $Value"
  }
}

Write-Host "`n=== Reverting Kiosk Hardening ===" -ForegroundColor Cyan

Remove-RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System' 'DisableTaskMgr'
Remove-RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoWinKeys'
Remove-RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'MultiTaskingAltTabFilter'
Remove-RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoDriveTypeAutoRun'
Set-Reg 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer' 'NoDriveTypeAutoRun' 0x91
Remove-RegVal 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer' 'NoAutoplayfornonVolume'
Set-Reg 'HKLM:\SYSTEM\CurrentControlSet\Services\UsbStor' 'Start' 3  # 3 = Manual (default)
Remove-RegVal 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' 'NoLocalUserCreation'

Write-Host "`n=== Hardening reverted. Reboot recommended. ===" -ForegroundColor Green
