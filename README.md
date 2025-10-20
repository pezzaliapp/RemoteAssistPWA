# Remote Assist — MultiCam (PWA · GitHub-Only) — Smart Glasses Mode

Questa build aggiunge la **Smart Glasses Mode**:
- Uso come **dispositivo audio/microfono** (pairing Bluetooth a livello di sistema).
- **Web Bluetooth** per leggere la **batteria** (`battery_service`, se esposto).
- Se supportato, **selezione uscita audio** (`setSinkId`; non su iOS).

Restano inclusi: Laser pointer sincronizzato, Annotazioni, PDF.js (CDN), Chat, Registrazione,
Signaling Manuale e via GitHub Issues (beta).

**Nota:** molti occhiali Bluetooth non espongono video UVC. Per video “head-mounted” serve una cam UVC o la cam del telefono.
