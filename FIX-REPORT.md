# Fix report — pezzaliAPP Remote Assist SUITE

Branch: `fix/audit`. Riferimento: `AUDIT.md`. Verifica per ogni commit con
`npm run check` (`node --check sw.js && node --check app.js`) → sempre OK.

## P0 — blockers

| ID | Stato | Cosa è stato fatto | File |
|----|-------|--------------------|------|
| **BUG-01** | ✅ Risolto | Ricomposta su una riga la stringa `'./styles.css'` spezzata da un newline letterale che causava `SyntaxError`; ora il SW si installa. | `sw.js:3-5` |
| **BUG-11** | ✅ Risolto | Rimosso `c.navigate()` dei client all'`activate`; reload gestito solo lato pagina su `controllerchange`. Cache versioning serio (cancella solo cache diverse da quella corrente) e fetch handler solo per GET. | `sw.js`, `app.js` |
| **SEC-01** | ✅ Risolto | `safeDocUrl()` valida l'URL ricevuto dal peer prima di assegnarlo a `iframe.src`: ammessi solo `http:`/`https:`/`blob:` di stessa origine, rifiutati `javascript:`/`data:`/`vbscript:`. Aggiunto `sandbox` all'iframe `docFrame`. | `app.js`, `index.html:106` |
| **SEC-03** | ✅ Risolto | Aggiunta meta CSP restrittiva; spostata la registrazione del SW da script inline a `app.js` per evitare `'unsafe-inline'` negli script. | `index.html`, `app.js` |
| **BUG-02** | ✅ Risolto | Implementati i 4 pulsanti Mobile Cam con feature-detection e degradazione: camera posteriore (`facingMode`), torch (`applyConstraints`, disabilitato se assente), fullscreen, `screen.orientation.lock` (disabilitato se assente). | `app.js` |
| **BUG-03** | ✅ Risolto | `#btnJoin`/`#btnLeave` cablati al ciclo WebRTC in base a `#role` (Tecnico genera l'offerta, Esperto predispone l'accept); Esci chiude `pc`/`dc`, ferma le tracce, pulisce la grid e l'indicatore live. | `app.js` |
| **BUG-04** | ✅ Risolto | `#sigMode` mostra/nasconde `#ghBox2` (default Manuale → nascosto). | `app.js`, `index.html` |

## P1 — robustezza

| ID | Stato | Cosa è stato fatto | File |
|----|-------|--------------------|------|
| **BUG-05** | ✅ Risolto | Rimossa la `getUserMedia` automatica al load; enumerazione device senza prompt, ripopolata dopo il primo "Aggiungi". | `app.js` |
| **BUG-06** | ✅ Risolto | `addCam()` avvolto in try/catch con messaggio in chat. | `app.js` |
| **BUG-07** | ✅ Risolto | `MediaRecorder.isTypeSupported` con fallback (vp9→vp8→webm→mp4), guardia su stream vuoto, costruttore in try/catch, estensione coerente col mimeType. | `app.js` |
| **BUG-08** | ✅ Risolto | `waitIce()` con timeout di 2s che risolve con la `localDescription` parziale. | `app.js` |
| **BUG-09** | ✅ Risolto | `applyAnswer()` controlla `pc!=null` e gestisce `JSON.parse` in try/catch; `makeOffer`/`makeAnswerFromOffer` con try/catch e feedback. | `app.js` |
| WebRTC | ✅ Migliorato | `onnegotiationneeded` rigenera l'offerta a camera aggiunta a caldo; solo l'offerer crea il data channel (no doppio canale); `onconnectionstatechange` riflesso nel live indicator; `iceServers` configurabili via `localStorage`. **TURN non incluso** (necessario per reti reali): nessuna credenziale inventata. | `app.js` |

## P2 — funzioni / signaling

| ID | Stato | Cosa è stato fatto | File |
|----|-------|--------------------|------|
| **BUG-10** | ✅ Risolto | Ricezione `annoImage` disegna il PNG sul canvas via `ctx.drawImage`. | `app.js` |
| **SEC-02** | ✅ Mitigato | Avviso visibile che l'SDP contiene IP e che gli issue pubblici li espongono; raccomandati issue privati e token fine-grained. Architettura invariata (resta beta). | `index.html`, `styles.css` |

## P3 — igiene

- Rimossi `test_scroll.html`, `test-scroll-cam-grid.html`, `styles.patch.css`, `PATCH-README.txt`.
- `manifest.webmanifest`: aggiunti `id`, `description`, `lang`, `scope`, `orientation`, icone `purpose: "any maskable"`.
- Aggiunto `package.json` con script `check` (`node --check`).
- Sostituiti i `catch{}` che ingoiavano errori reali con `console.warn` diagnosticabili.

## Note residue (fuori scope di questo branch)

- **TURN server**: indispensabile per connettere su NAT reali; va fornito dall'operatore (config in `localStorage.iceServers`).
- Il viewer PDF.js/Office e il signaling GitHub restano dipendenti dalla rete: la dicitura "offline" copre solo l'app-shell.
