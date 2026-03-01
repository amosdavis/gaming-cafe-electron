<#
.SYNOPSIS
    Gaming Cafe Kiosk — Windows OS Lockdown Script

.DESCRIPTION
    Hardens the Windows environment to prevent kiosk escape and malware vectors.
    Addresses failure modes: F-09, F-27, F-28, F-29, F-31 from FAILURE_MODES.md.
    Can be run interactively (no params) or non-interactively (supply all params).

.PARAMETER KioskUser
    Windows username of the kiosk account for auto-login.
    Prompted interactively if not supplied.

.PARAMETER KioskPassword
    Plain-text password for the kiosk account auto-login registry entry.
    Prompted interactively if not supplied.

.NOTES
    Must run as Administrator or SYSTEM.
    Reboot the PC after running this script for all changes to take effect.
#>
[CmdletBinding()]
param(
    [string]$KioskUser     = '',
    [string]$KioskPassword = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$msg) {
    Write-Host "`n[LOCKDOWN] $msg" -ForegroundColor Cyan
}

function Write-OK([string]$msg) {
    Write-Host "    OK: $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "    WARN: $msg" -ForegroundColor Yellow
}

# ── Prompt for kiosk account credentials ────────────────────────────────────

Write-Step "Gaming Cafe Kiosk — Windows Lockdown Setup"
Write-Host "    This script configures the PC for secure kiosk operation."
Write-Host "    A reboot is required after this script completes.`n"

# Resolve credentials — use supplied params or prompt interactively
if (-not $KioskUser) {
    $KioskUser = Read-Host "Kiosk Windows username (the account that runs the kiosk)"
}
if (-not $KioskPassword) {
    $sec = Read-Host "Kiosk Windows password (for auto-login)" -AsSecureString
    $KioskPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    )
}

# ── F-09: Disable Task Manager for current user ──────────────────────────────

Write-Step "F-09: Disabling Task Manager"
$tmKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System"
if (-not (Test-Path $tmKey)) { New-Item -Path $tmKey -Force | Out-Null }
Set-ItemProperty -Path $tmKey -Name "DisableTaskMgr" -Value 1 -Type DWord
Write-OK "Task Manager disabled for current user profile."

# Also disable via machine policy (applies to all non-admin users)
$tmKeyLM = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
if (-not (Test-Path $tmKeyLM)) { New-Item -Path $tmKeyLM -Force | Out-Null }
try {
    Set-ItemProperty -Path $tmKeyLM -Name "DisableTaskMgr" -Value 1 -Type DWord
    Write-OK "Task Manager disabled machine-wide."
} catch {
    Write-Warn "Could not set machine-wide Task Manager policy: $_"
}

# ── F-27: Disable USB AutoRun ────────────────────────────────────────────────

Write-Step "F-27: Disabling USB AutoRun"
$explorerKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer"
if (-not (Test-Path $explorerKey)) { New-Item -Path $explorerKey -Force | Out-Null }
# 0xFF = disable AutoRun on all drive types
Set-ItemProperty -Path $explorerKey -Name "NoDriveTypeAutoRun" -Value 0xFF -Type DWord
Write-OK "AutoRun disabled on all drive types (0xFF)."

# Disable AutoPlay via policy
$autoPlayKey = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Explorer"
if (-not (Test-Path $autoPlayKey)) { New-Item -Path $autoPlayKey -Force | Out-Null }
Set-ItemProperty -Path $autoPlayKey -Name "NoAutoplayfornonVolume" -Value 1 -Type DWord
Write-OK "AutoPlay disabled for non-volume devices."

# ── F-31: Enforce Windows Defender real-time protection ──────────────────────

Write-Step "F-31: Enforcing Windows Defender"
try {
    Set-MpPreference -DisableRealtimeMonitoring $false
    Write-OK "Real-time monitoring enabled."
} catch {
    Write-Warn "Could not configure Defender (may not be available): $_"
}

# Block USB/removable storage device class via policy
# StorageDevicePolicies WriteProtect = 1 prevents writes; to fully block, use device installation policy
$storageKey = "HKLM:\SYSTEM\CurrentControlSet\Control\StorageDevicePolicies"
if (-not (Test-Path $storageKey)) { New-Item -Path $storageKey -Force | Out-Null }
Set-ItemProperty -Path $storageKey -Name "WriteProtect" -Value 1 -Type DWord
Write-OK "USB storage write-protect enabled (prevents malware install from USB)."

# ── F-28: Enable Windows Auto-Login for kiosk account ───────────────────────

Write-Step "F-28: Configuring auto-login for '$KioskUser'"
$winlogonKey = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
Set-ItemProperty -Path $winlogonKey -Name "AutoAdminLogon"    -Value "1"           -Type String
Set-ItemProperty -Path $winlogonKey -Name "DefaultUserName"   -Value $KioskUser    -Type String
Set-ItemProperty -Path $winlogonKey -Name "DefaultPassword"   -Value $KioskPassword -Type String
Set-ItemProperty -Path $winlogonKey -Name "DefaultDomainName" -Value $env:COMPUTERNAME -Type String
Write-OK "Auto-login configured. PC will log into '$KioskUser' on reboot."

# Clear the plain-text password from memory
$KioskPassword = $null
[System.GC]::Collect()

# ── F-29: Restrict new user account creation ────────────────────────────────

Write-Step "F-29: Restricting new user account creation"
$systemKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
if (-not (Test-Path $systemKey)) { New-Item -Path $systemKey -Force | Out-Null }

# Hide the "Add a user" option in Settings
try {
    Set-ItemProperty -Path $systemKey -Name "NoLocalUserCreate" -Value 1 -Type DWord
    Write-OK "Local user creation blocked via policy."
} catch {
    Write-Warn "NoLocalUserCreate not supported on this edition: $_"
}

# Remove the kiosk user from Administrators if present (principle of least privilege)
try {
    $adminGroup = [ADSI]"WinNT://./Administrators,group"
    $members    = @($adminGroup.Invoke("Members")) | ForEach-Object { $_.GetType().InvokeMember("Name","GetProperty",$null,$_,$null) }
    if ($KioskUser -in $members) {
        Remove-LocalGroupMember -Group "Administrators" -Member $KioskUser -ErrorAction SilentlyContinue
        Write-OK "Removed '$KioskUser' from Administrators group."
    } else {
        Write-OK "'$KioskUser' is already a standard user."
    }
} catch {
    Write-Warn "Could not check Administrators group membership: $_"
}

# ── Disable lock screen / Ctrl+Alt+Del requirement ──────────────────────────

Write-Step "Disabling Ctrl+Alt+Del login requirement (for smooth auto-login)"
try {
    Set-ItemProperty -Path $systemKey -Name "disableCAD" -Value 1 -Type DWord
    Write-OK "Ctrl+Alt+Del requirement disabled."
} catch {
    Write-Warn "Could not disable CAD requirement: $_"
}

# ── Disable Windows Error Reporting dialogs ──────────────────────────────────

Write-Step "Silencing Windows Error Reporting (prevents popup dialogs)"
$werKey = "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting"
if (-not (Test-Path $werKey)) { New-Item -Path $werKey -Force | Out-Null }
Set-ItemProperty -Path $werKey -Name "Disabled" -Value 1 -Type DWord
Write-OK "Windows Error Reporting disabled."

# ── Summary ──────────────────────────────────────────────────────────────────

Write-Host "`n" + ("=" * 60) -ForegroundColor White
Write-Host "  LOCKDOWN COMPLETE" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor White
Write-Host @"

Changes applied:
  [F-09] Task Manager disabled
  [F-27] USB AutoRun disabled; USB storage write-protected
  [F-28] Auto-login configured for '$KioskUser'
  [F-29] New local user creation restricted
  [F-31] Windows Defender real-time protection enforced

ACTION REQUIRED: Reboot the PC now for all changes to take effect.
"@
