# Gaming Cafe Kiosk — PXE Boot Setup Guide

The GitHub Actions release publishes a `pxe-files.zip` containing:

```
pxe-files/
  boot.wim          — WinPE boot image (extracted from the kiosk ISO)
  pxe-ipxe.cfg      — Sample iPXE boot script
  BCD               — Boot Configuration Data for WDS/TFTP
```

---

## Option A — Windows Deployment Services (WDS) on Windows Server

1. **Install WDS** role on a Windows Server on the same LAN.
2. **Configure WDS** to respond to all PXE clients.
3. **Add boot image**: Import `boot.wim` as a Boot Image in WDS.
4. **Add install image**: Import `install.wim` from the kiosk ISO (extract it first with 7-Zip) as an Install Image.
5. **Create answer file** pointing to the unattended install (optional — `autounattend.xml` is already embedded in `install.wim`).
6. **Boot a kiosk PC from network** — it will download `boot.wim` via TFTP, load WinPE, then apply the image automatically.

---

## Option B — wimboot + iPXE (Linux TFTP server)

### Prerequisites
```bash
apt-get install tftpd-hpa syslinux-common wimtools
```

### Directory layout on TFTP server
```
/var/lib/tftpboot/
  wimboot               # download from https://github.com/ipxe/wimboot/releases
  boot.wim              # from pxe-files.zip
  ipxe.cfg              # see below
```

### Sample iPXE script (`ipxe.cfg`)
```
#!ipxe
dhcp
kernel tftp://${next-server}/wimboot
initrd tftp://${next-server}/boot.wim      boot.wim
boot
```

### DHCP options (ISC DHCP / dnsmasq)
```
# ISC DHCP
option space ipxe;
option ipxe.no-pxedhcp code 176 = unsigned integer 8;
next-server <TFTP_SERVER_IP>;
filename "ipxe.cfg";
```

### Serving install.wim
WinPE will look for `install.wim` over the network. Place it on an SMB share reachable by the kiosk PCs and reference it in `autounattend.xml`'s `<InstallFrom><Path>` element, or serve it via WDS.

---

## Option C — Ventoy USB (fallback)

1. Download the kiosk ISO from the release page.
2. Install [Ventoy](https://www.ventoy.net/) on a USB drive.
3. Copy the ISO to the Ventoy USB drive.
4. Boot a kiosk PC from USB — Ventoy boots the ISO directly.

---

## Notes

- `autounattend.xml` is already embedded in the kiosk ISO root — no additional configuration is needed for fully unattended network installs.
- PXE boot requires the kiosk PC's BIOS/UEFI to have **Network Boot (PXE)** enabled and set as the first boot device, or triggered via `F12`.
- The `KioskAdmin` account password was baked into the image during the GitHub Actions build from the `KIOSK_PASSWORD` secret. Change it after first boot via `net user KioskAdmin <newpassword>`.
