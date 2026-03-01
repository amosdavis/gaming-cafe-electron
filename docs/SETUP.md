# GitHub Repository Setup Guide

Follow these steps once to configure the repository before running the ISO build pipeline.

---

## 1. GitHub Repository Secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

### `AZURE_STORAGE_KEY`
The access key for the `isobuilds` Azure Storage Account.

To retrieve it:
```
Azure Portal → Storage accounts → isobuilds
  → Security + networking → Access keys
  → key1 → Show → copy the key value
```

### `KIOSK_PASSWORD`
The password that will be baked into the Windows image for the `KioskAdmin` local account.

> ⚠️ Choose a strong password. This account has administrator rights on every deployed machine.

---

## 2. GitHub Repository Variables

Go to **Settings → Secrets and variables → Actions → Variables** and add:

### `WIN11_ISO_URL`

Current direct download URL for **Windows 11 Enterprise LTSC 2024 Evaluation (en-us, x64)**:

```
https://software-static.download.prss.microsoft.com/dbazure/888969d5-f34g-4e03-ac9d-1f9786c66749/26100.1742.240906-0331.ge_release_svc_refresh_CLIENT_LTSC_EVAL_x64FRE_en-us.iso
```

> This is a 90-day evaluation ISO direct from Microsoft's servers. Update this URL when a newer
> evaluation build is released. Do NOT use unofficial mirror URLs.

---

## 3. GitHub Pages

Go to **Settings → Pages** and set:
- **Source**: `Deploy from a branch`
- **Branch**: `gh-pages` / `/ (root)`

The pipeline will auto-create and update this branch on every release.

---

## 4. Azure Storage — Public Blob Read

The pipeline creates the `kiosk-releases` container automatically with public blob access on first run.
If it already exists, ensure it has **blob-level public access** enabled:

```
Azure Portal → Storage accounts → isobuilds
  → Data storage → Containers → kiosk-releases
  → Change access level → Blob (anonymous read for blobs only)
```

---

## 5. Triggering a Build

**From a Git tag:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Manually (from GitHub UI):**
Go to **Actions → Build & Publish Kiosk ISO → Run workflow** and enter the version label.

---

## 6. Output

After a successful run:
- **ISO**: `https://isobuilds.blob.core.windows.net/kiosk-releases/<version>/GamingCafeKiosk-<version>.iso`
- **PXE files**: `https://isobuilds.blob.core.windows.net/kiosk-releases/<version>/pxe-files.zip`
- **Download page**: `https://<org>.github.io/<repo>/`
