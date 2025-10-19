# Remote Assist — MultiCam (PWA) — GitHub‑Only

Versione **100% GitHub Pages** senza server: WebRTC con **segnaling manuale** (copia/incolla SDP) e opzione **GitHub Issues (beta)** come canale di scambio.
- Multi‑camera (UVC), chat e annotazioni via DataChannel
- Viewer documenti (PDF/immagini) con sync
- Registrazione locale `.webm`
- PWA installabile (manifest + service worker)

## Deploy su GitHub Pages
1. Crea repo e pubblica il contenuto di questa cartella sul branch `gh-pages` (o abilita Pages dal branch `main`/`docs`).
2. Apri l’URL Pages dalla barra del browser (HTTPS).

## Collegamento tra due utenti (senza server)
1. Vai nella tab **Segnaling**.
2. **Esperto** → clicca **Genera Offerta** e invia il JSON al Tecnico (es. WhatsApp).
3. **Tecnico** → incolla nel box e clicca **Crea Risposta**, poi inviala all’Esperto.
4. **Esperto** → incolla la risposta e premi **Applica Risposta**.

## Opzione "GitHub Issues" (beta)
- Imposta `owner/repo`, `issue #` e un **token** con permessi sul repo (il token resta nel tuo browser).
- I blob SDP vengono postati/recuperati come commenti nell’Issue.
- Ideale per test interni senza server dedicato.

> Limitazioni: iOS ha vincoli extra su codec e registrazione `.webm`. Per sessioni multi‑parte stabili e registrazioni centralizzate, in futuro potrai migrare a un **SFU** (es. mediasoup) mantenendo questa UI.

**Licenza**: MIT.
