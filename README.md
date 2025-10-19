# Remote Assist — MultiCam (PWA · GitHub-Only) + Laser

Questa build aggiunge:
- **Laser pointer sincronizzato** sulla vista documenti (overlay con coordinate normalizzate 0..1)
- Pulsante **Apri con PDF.js (CDN)** per un viewer PDF avanzato senza server (funziona solo con file serviti via HTTP, non con blob)

## Uso del Laser
1. Tab **Documenti** → **Laser ON** (si illumina il puntatore locale).
2. Muovi il puntatore sull'area documento; il remoto vede il tuo laser in tempo reale.
3. **Laser OFF** per disattivarlo. Il tasto **Sync vista** invia la posizione di scroll corrente.

## PDF.js (opzionale via CDN)
- Premi **Apri con PDF.js (CDN)** per usare il viewer standard di pdf.js con pagina, zoom, ricerca, miniature.
- Per funzionare deve trattarsi di un PDF servito via HTTP (es. dentro `/docs/` del repo). I file caricati via `<input>` diventano blob e non sono apribili dal viewer CDN.
- Se vuoi **offline completo**, possiamo includere `pdfjs-dist` nel repo e metterlo in cache nel service worker.

## Collegamento peer (Pages-only)
- **Manuale**: Genera Offerta → invia JSON → Crea Risposta → Applica Risposta.
- **GitHub Issues (beta)**: usa un Issue come “stanza” postando/rileggendo i blob SDP.

**Licenza**: MIT.
