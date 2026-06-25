# Audit tecnico — pezzaliAPP Remote Assist SUITE v1.0

**Data:** 2026-06-25
**Revisore:** analisi statica + verifica eseguibile (parsing dei file, `node --check`, grep degli handler, controllo asset)
**Repository:** PWA di assistenza remota (HTML/CSS/JS vanilla, nessuna build, nessuna dipendenza npm)

> Metodologia: non ho dato per buono nulla di ciò che il codice o il README dichiarano. Ho
> controllato la sintassi di ogni file JS con `node --check`, ho verificato la presenza degli
> handler degli eventi con grep, ho confrontato la lista degli asset cache-ati con i file
> realmente presenti su disco, e ho ispezionato i percorsi cross-browser del codice WebRTC/SW.

---

## 1) Funziona davvero? Verdetto sintetico

**No, non nello stato dichiarato.** L'interfaccia si carica e le funzioni "vetrina" (tab, laser
sui documenti, annotazioni, chat locale, tour) sono presenti, ma:

- **La dicitura "Offline-ready" è FALSA.** Il service worker (`sw.js`) contiene un **errore di
  sintassi fatale** e non viene mai registrato/installato dal browser. Nessun asset viene messo
  in cache, l'app **non funziona offline** e l'auto-refresh dichiarato non parte mai.
- **Intere modalità sono morte.** I pulsanti della modalità **"Mobile Cam"** (posteriore, torch,
  fullscreen, blocco orientamento) e i pulsanti di sessione **"Entra"/"Esci"** non hanno alcun
  handler in `app.js`: cliccarli non fa nulla.
- Le funzioni eseguibili (registrazione, uscita audio) sono **rotte su Safari/iOS** e su Firefox.

Riepilogo stato funzioni:

| Funzione | Stato | Note |
|---|---|---|
| Caricamento UI, tab, modalità Standard/Glasses/Mobile (switch viste) | ✅ Funziona | |
| Service Worker / offline / auto-refresh | ❌ **Rotto** | SyntaxError, SW mai installato |
| Modalità **Mobile Cam** (4 pulsanti) | ❌ **Monca** | Nessun handler in `app.js` |
| Pulsanti sessione **Entra / Esci** | ❌ **Monchi** | Nessun handler; `#role`, `#sigMode` mai letti |
| Aggiungi camera / Stop / lista camere | ⚠️ Parziale | Funziona ma senza gestione errori; prompt camera all'avvio |
| Laser su documenti / su tile video | ✅ Funziona (Chrome) | Dipende dal data channel |
| Annotazioni (penna/gomma/clear/share) | ⚠️ Parziale | `annoImage` ricevuto ma mai disegnato |
| Chat (via data channel) | ✅ Funziona | Solo testo, `textContent` (no XSS) |
| WebRTC signaling manuale | ⚠️ Fragile | Solo STUN, nessun TURN, nessun timeout ICE |
| Signaling GitHub Issues | ⚠️ Beta/insicuro | Token in chiaro, SDP pubblica |
| Registrazione (MediaRecorder) | ⚠️ Solo Chrome/FF | Crash su Safari/iOS; crash se nessun video |
| Web Bluetooth batteria | ✅/N/A | Gestito; assente su Safari/iOS/Firefox |
| Cambio uscita audio (setSinkId) | ⚠️ Solo Chrome | Gestito con disable altrove |
| Tour / tutorial | ✅ Funziona | |

---

## 2) Bug — file, riga, causa, effetto, fix

### 🔴 BUG-01 — Service worker non parsabile: niente offline, niente auto-refresh
- **File/riga:** `sw.js:3-4`
- **Causa:** la stringa dell'array `ASSETS` è interrotta da un **a capo reale dentro un literal
  con apici singoli**:
  ```js
  const ASSETS=['./','./index.html','./styles.css
  ','./app.js', ...];
  ```
  In JavaScript una stringa con apici singoli non può contenere un newline letterale →
  `SyntaxError: Invalid or unexpected token`. **Verificato** con `node --check sw.js` (fallisce).
- **Effetto utente:** il browser non riesce a valutare lo script del SW, quindi `register('sw.js')`
  fallisce silenziosamente. **Nessuna cache, nessun supporto offline, nessun auto-refresh.** La
  promessa "Offline-ready" del README e dell'app è falsa. (Tutti gli asset elencati esistono su
  disco: l'**unica** causa del fallimento offline è questo errore di sintassi.)
- **Fix:** ricomporre la stringa su una riga sola:
  ```js
  const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest',
    './icons/icon-192.png','./icons/icon-512.png','./icons/pezzaliAPP-logo.svg',
    './docs/sample.pdf','./docs/bg.jpg','./docs/guida.html'];
  ```

### 🔴 BUG-02 — Modalità "Mobile Cam" completamente non funzionante
- **File/riga:** `index.html:78` (pulsanti) vs `app.js` (handler assenti)
- **Causa:** i pulsanti `#btnRearCam`, `#btnTorch`, `#btnFullscreen`, `#btnLock` esistono nell'HTML
  ma **non hanno alcun `addEventListener` in `app.js`** (verificato con grep: 0 occorrenze di
  ciascun id nel JS).
- **Effetto utente:** in modalità Mobile Cam nessun pulsante fa qualcosa: non si avvia la camera
  posteriore, non si accende il torch, niente fullscreen né blocco orientamento. Una delle tre
  modalità pubblicizzate è solo un guscio.
- **Fix:** implementare gli handler (es. `getUserMedia({video:{facingMode:{exact:'environment'}}})`
  per la posteriore; `track.applyConstraints({advanced:[{torch:true}]})` per il torch — solo Chrome
  Android; `element.requestFullscreen()`; `screen.orientation.lock('portrait')`), oppure rimuovere
  i pulsanti finché non sono pronti.

### 🔴 BUG-03 — Pulsanti sessione "Entra"/"Esci" inerti
- **File/riga:** `index.html:55` (`#btnJoin`, `#btnLeave`) vs `app.js` (handler assenti)
- **Causa:** nessun handler per `#btnJoin`/`#btnLeave`; anche i select `#role` e `#sigMode` non
  vengono **mai letti** nel codice (grep: 0 occorrenze). Il `PATCH-README.txt` chiede di aggiungere
  `id="btnLeave"` ma l'handler non è mai stato scritto.
- **Effetto utente:** il riquadro "Sessione" suggerisce un flusso entra/esci e una scelta
  ruolo/signaling che non esistono: i pulsanti non fanno nulla e la scelta del ruolo è ignorata.
- **Fix:** o cablare Entra/Esci alla logica WebRTC (es. Entra = `makeOffer`/`makeAnswer` in base al
  ruolo, Esci = `pc.close()` + stop tracce), o rimuovere i controlli.

### 🟠 BUG-04 — Selettore "Segnaling: GitHub Issues" senza effetto
- **File/riga:** `index.html:52-53` (`#sigMode`)
- **Causa:** `#sigMode` non è letto da nessuna parte; il box GitHub (`#ghBox2`) è sempre visibile
  nella tab Segnaling indipendentemente dalla scelta.
- **Effetto utente:** confusione UI; la selezione "Manuale/GitHub" è puramente decorativa.
- **Fix:** mostrare/nascondere `#ghBox2` in base a `#sigMode`, oppure rimuovere il select.

### 🟠 BUG-05 — Prompt camera all'avvio senza gesto utente e senza gestione errori
- **File/riga:** `app.js:154`
- **Causa:** `navigator.mediaDevices?.getUserMedia?.({video:true}).then(()=>listCams())` viene
  eseguito al caricamento, **prima di qualunque interazione**, solo per popolare le etichette delle
  camere. Non c'è `.catch()`.
- **Effetto utente:** all'apertura della pagina compare subito il prompt dei permessi camera (UX
  invadente e penalizzante per la fiducia). Se l'utente nega o non c'è camera → **unhandled promise
  rejection** in console e `listCams()` non viene chiamata (lista camere vuota).
- **Fix:** non chiedere la camera all'avvio; enumerare i device dopo che l'utente preme "Aggiungi"
  (le etichette restano vuote finché non c'è un permesso, ma è accettabile). Aggiungere `.catch()`
  con messaggio utente.

### 🟠 BUG-06 — `addCam()` senza try/catch
- **File/riga:** `app.js:88-95`
- **Causa:** `getUserMedia` può rigettare (permesso negato, device occupato, `OverconstrainedError`
  su `deviceId exact`). Non c'è gestione.
- **Effetto utente:** il clic su "Aggiungi" fallisce in silenzio; nessun riquadro, nessun avviso.
- **Fix:** avvolgere in `try/catch` e mostrare un messaggio (es. `appendChat(..., 'sys')`).

### 🟠 BUG-07 — Registrazione: crash su Safari/iOS e con grid vuota
- **File/riga:** `app.js:158-175`
- **Causa:** (a) `new MediaRecorder(mix,{mimeType:'video/webm;codecs=vp9'})` — Safari/iOS **non
  supporta** la registrazione WebM/VP9; il costruttore lancia `NotSupportedError`. (b) Se non ci
  sono video attivi `mix` è uno stream vuoto → errore. Nessun `MediaRecorder.isTypeSupported`,
  nessun try/catch.
- **Effetto utente:** su Safari la registrazione genera un'eccezione e non parte; su qualunque
  browser, premere "Avvia Rec" senza camere attive rompe la funzione.
- **Fix:** controllare `MediaRecorder.isTypeSupported(...)` con fallback (`video/mp4` su Safari),
  verificare `mix.getTracks().length>0`, avvolgere in try/catch.

### 🟠 BUG-08 — `waitIce()` può non risolvere mai (offerta che non si genera)
- **File/riga:** `app.js:479-486`
- **Causa:** `makeOffer`/`makeAnswerFromOffer` attendono `iceGatheringState==='complete'` senza
  **timeout**. Se lo STUN di Google è irraggiungibile (rete aziendale, firewall, offline), la
  raccolta ICE può restare bloccata e la Promise non si risolve.
- **Effetto utente:** clic su "Genera Offerta" senza che `#sdpBox` venga mai popolato; nessun
  feedback.
- **Fix:** aggiungere un timeout (es. `setTimeout(()=>res(pc.localDescription), 1500)`) e/o usare
  `pc.localDescription` parziale; informare l'utente.

### 🟡 BUG-09 — `applyAnswer()` assume `pc` esistente
- **File/riga:** `app.js:487`
- **Causa:** `await pc.setRemoteDescription(ans)` senza controllo: se si preme "Applica Risposta"
  senza aver prima generato un'offerta, `pc` è `null` → `TypeError`.
- **Effetto utente:** eccezione non gestita.
- **Fix:** `if(!pc){ appendChat('Genera prima un\'offerta','sys'); return; }` + try/catch su
  `JSON.parse`.

### 🟡 BUG-10 — `annoImage` ricevuto ma mai disegnato
- **File/riga:** `app.js:341` (invio) e `app.js:360` (ricezione: `/* opzionale */`)
- **Causa:** "Condividi schema su remoto" invia il PNG, ma il ramo di ricezione è vuoto.
- **Effetto utente:** il pulsante "Condividi schema" mostra "Schema inviato" ma il remoto **non
  vede nulla**.
- **Fix:** sul ricevente disegnare l'immagine sul canvas (`new Image()` → `ctx.drawImage`) o
  mostrarla in un overlay.

### 🟡 BUG-11 — Doppio reload / loop al cambio SW
- **File/riga:** `sw.js:11` (`c.navigate(c.url)`) + `app.js:633-637` (reload su `controllerchange`)
- **Causa:** all'`activate` il SW forza `navigate` di tutti i client **e** l'app ricarica su
  `controllerchange`. La combinazione provoca reload ridondanti (mitigato solo da
  `__reloadedOnce`). Attualmente latente perché il SW non parte (BUG-01), ma diventa un problema
  appena lo si corregge.
- **Effetto utente:** ricaricamenti improvvisi della pagina ad ogni aggiornamento del SW, con
  perdita dello stato della sessione (canale dati, video).
- **Fix:** scegliere **una** strategia (preferibile: solo `controllerchange` lato pagina, senza
  `c.navigate`), e non distruggere sessioni attive.

---

## 3) Robustezza: Service Worker, offline, WebRTC, cross-browser, permessi

### Service worker & offline
- **Stato attuale: rotto** (BUG-01). Anche dopo il fix:
  - Strategia fetch "cache-first con fallback rete" (`sw.js:14`) è ragionevole per asset statici,
    ma **non gestisce gli aggiornamenti** dei file (un asset cambiato non viene mai ri-scaricato
    finché esiste in cache); manca una strategia stale-while-revalidate o un versioning serio.
  - `activate` cancella **tutte** le cache (`caches.keys()...delete`) ad ogni attivazione: di fatto
    il cache versioning (`v1`) è inutile perché si butta via tutto comunque.
  - Le richieste verso CDN esterne (pdf.js viewer di Mozilla, Office Web Viewer, api.github.com)
    non sono cache-abili e **non funzionano offline** per definizione: la feature documenti
    "offline" è quindi parziale.
  - Manca la gestione delle richieste non-GET e dei redirect opachi.

### Comportamento offline reale
- L'app shell (HTML/CSS/JS/icone/sample.pdf) **potrebbe** funzionare offline una volta corretto il
  SW (tutti gli asset esistono, verificato). Ma le funzioni chiave (WebRTC necessita rete/STUN,
  PDF.js e DOCX viewer sono CDN esterne, GitHub signaling è online) **non sono offline**. La
  dicitura "Offline-ready" è quindi sovrastimata anche a SW riparato.

### Flusso WebRTC
- Pattern offer/answer manuale corretto a grandi linee (`createPC`/`makeOffer`/`makeAnswerFromOffer`
  /`applyAnswer`). Punti deboli:
  - **Solo STUN, nessun TURN**: su NAT simmetrici / reti mobili / aziendali la connessione
    **fallisce** in una grossa percentuale di casi reali. Per un prodotto di assistenza remota il
    TURN è praticamente obbligatorio.
  - **Nessun trickle ICE** (per design, signaling manuale) → attesa del gathering completo, che può
    bloccarsi (BUG-08).
  - Le tracce vengono aggiunte solo se i video esistono **al momento** di `createPC` (`app.js:470`);
    `addCam` dopo la connessione fa `pc.addTrack` (`app.js:94`) ma **non rinegozia** (`onnegotiation
    needed` non gestito) → la nuova camera non arriva al remoto.
  - Nessuna gestione di `pc.onconnectionstatechange`/`oniceconnectionstatechange` per rilevare
    disconnessioni o riconnettere.

### Compatibilità browser
| Feature | Chrome desktop/Android | Safari iOS/macOS | Firefox |
|---|---|---|---|
| Service Worker (a fix) | ✅ | ✅ | ✅ |
| `beforeinstallprompt` / pulsante Installa | ✅ | ❌ (mai mostrato; A2HS manuale) | ❌ |
| getUserMedia / WebRTC | ✅ | ✅ (richiede gesto + HTTPS) | ✅ |
| `MediaRecorder` WebM/VP9 (registrazione) | ✅ | ❌ **rotto** (no WebM) | ✅ |
| `setSinkId` (uscita audio) | ✅ | ❌ | ⚠️ dietro flag |
| Web Bluetooth (batteria glasses) | ✅ (Android/desktop) | ❌ | ❌ |
| `applyConstraints` torch | ✅ Android | ❌ | ❌ |
| `<dialog>.showModal` (help) | ✅ | ✅ (recente) | ✅ |

Le incompatibilità di Web Bluetooth e setSinkId **sono gestite** con disable/fallback (buono). La
registrazione e il torch **non** hanno fallback.

### Gestione permessi
- Camera richiesta **all'avvio senza gesto** (BUG-05): pessima pratica, su iOS può anche essere
  bloccata se non innescata da interazione.
- Nessun feedback quando un permesso viene negato (camera, microfono).
- `enumerateDevices` per le uscite audio (`app.js:248`) restituisce etichette vuote finché non c'è
  un permesso microfono/camera: gestito parzialmente con messaggio "(permessi mancanti)".

---

## 4) Sicurezza

### 🔴 SEC-01 — XSS via `docOpen` dal peer remoto (iframe senza sandbox)
- **File/riga:** `app.js:361` — `if(m.t==='docOpen'){ const url=m.url; ... df.src=url; }`
- **Causa:** l'URL arriva dal **peer remoto via data channel** e viene assegnato direttamente a
  `iframe.src` senza alcuna validazione. Un peer malevolo può inviare
  `{"t":"docOpen","url":"javascript:<codice>"}`. Un `iframe` **senza attributo `sandbox`** (vedi
  `index.html:106`) eredita l'origine del documento: un `src="javascript:..."` esegue nello stesso
  origin dell'app → **XSS completo** (furto del token GitHub presente nel DOM, della sessione, ecc.).
- **Effetto:** esecuzione di codice arbitrario nel contesto dell'app indotta dall'altro
  partecipante alla sessione.
- **Fix:** validare lo schema dell'URL (consentire solo `https:`/`http:`/`blob:` propri), rifiutare
  `javascript:`/`data:`; aggiungere `sandbox="allow-scripts allow-same-origin"` *con cautela* (anzi,
  per contenuti remoti meglio `sandbox` restrittivo senza `allow-same-origin`); applicare una CSP.

### 🟠 SEC-02 — Token GitHub in chiaro + SDP pubblica
- **File/riga:** `app.js:493-518`, `index.html:134`
- **Causa:** il Personal Access Token GitHub è inserito in un `<input type=password>` e usato come
  `Authorization: Bearer` verso `api.github.com`. Inoltre l'SDP (offer/answer) viene **postata in un
  commento di issue pubblico**. L'SDP contiene **indirizzi IP locali e pubblici** (ICE candidates).
- **Effetto:** chiunque legga l'issue vede gli IP dei partecipanti (deanonimizzazione/superficie di
  attacco). Il token, se incollato, vive nel DOM ed è esfiltrabile in caso di XSS (vedi SEC-01).
- **Fix:** usare un signaling server proprio o issue **privati**; non loggare l'SDP in chiaro;
  evitare di richiedere PAT con scope ampi (un fine-grained token con solo accesso a un repo);
  avvisare l'utente del leak di IP.

### 🟠 SEC-03 — Nessuna Content-Security-Policy
- **File/riga:** `index.html` (assente)
- **Causa:** nessun header/meta CSP. In combinazione con SEC-01 non c'è alcuna difesa in profondità.
- **Fix:** aggiungere una CSP restrittiva (`default-src 'self'`; whitelisting esplicito di
  `frame-src` per i viewer; vietare `unsafe-inline` dove possibile — nota: lo script inline di
  registrazione SW in `index.html:167` andrebbe spostato in file esterno per consentire una CSP
  stretta).

### 🟢 Nota positiva
- La chat usa `textContent` (`app.js:288`) e non `innerHTML`: **niente XSS** dai messaggi di chat.
  Buono.

---

## 5) Qualità e igiene del progetto

- **File di test/scratch spediti in produzione:** `test_scroll.html`, `test-scroll-cam-grid.html`
  sono nel repo (e quindi pubblicati su GitHub Pages). Vanno rimossi o spostati fuori dal deploy.
- **CSS orfano:** `styles.patch.css` **non è referenziato** da nessun file (verificato): è codice
  morto. Inoltre duplica/sovrascrive regole già presenti in `styles.css` (es. `.tour`, `.cursorDot`,
  `#cursorOverlay`) creando confusione su quale stile sia effettivo. Da consolidare o eliminare.
- **`PATCH-README.txt`:** istruzioni di patch manuali ("sostituisci app.js", "aggiungi id=btnLeave")
  lasciate nel repo — segno di gestione delle modifiche via copia/incolla anziché versionata.
  L'id `btnLeave` è stato aggiunto ma l'handler no (BUG-03): patch applicata a metà.
- **Commit history:** una serie di "Update X" / "Add files via upload" — niente PR, niente review,
  niente messaggi descrittivi.
- **Nessun tooling:** niente `package.json`, linter, formatter, test, CI. Un linter avrebbe
  intercettato BUG-01 immediatamente.
- **Manifest povero:** `manifest.webmanifest` manca di `description`, `orientation`, `scope`,
  `id`, icone `purpose:"maskable"`, screenshot. Le icone (1 KB / 3 KB) sembrano segnaposto a bassa
  qualità.
- **IIFE monolitica:** `app.js` è un unico blocco di ~640 righe senza moduli, con `try{}catch{}`
  vuoti diffusi (`app.js:27,132,...`) che **inghiottono gli errori** rendendo il debug difficile.
- **Stato globale implicito** via `window.__setupDC__` / `window.__reloadedOnce` — fragile.
- **Mix di lingue/encoding:** commenti in italiano con em-dash UTF-8; nessun problema funzionale ma
  attenzione all'encoding nei file (l'em-dash in `sw.js:1` è corretto, l'errore vero è il newline).

---

## 6) È pronta per la produzione? Cosa manca, in ordine di priorità

**No. Non è production-ready.** È un prototipo/demo con un blocco critico (offline non funziona,
modalità intere morte) e una vulnerabilità XSS sfruttabile dal peer.

### Priorità P0 — blockers (da fare prima di qualsiasi rilascio)
1. **Correggere `sw.js` (BUG-01).** Senza questo, "offline" e "auto-refresh" sono falsi.
2. **Chiudere l'XSS `docOpen` (SEC-01)** + aggiungere `sandbox` all'iframe + CSP base (SEC-03).
3. **Implementare o rimuovere le funzioni morte:** Mobile Cam (BUG-02), Entra/Esci (BUG-03),
   selettore signaling (BUG-04). Non spedire pulsanti che non fanno nulla.

### Priorità P1 — funzionalità/robustezza essenziali
4. **TURN server** per WebRTC, altrimenti su rete reale spesso non connette.
5. **Gestione errori e feedback** su getUserMedia/addCam/applyAnswer (BUG-06, BUG-09) e **timeout
   ICE** (BUG-08).
6. **Rinegoziazione WebRTC** quando si aggiunge una camera dopo la connessione.
7. **Registrazione cross-browser** con `isTypeSupported`/fallback e guardia su stream vuoto (BUG-07).
8. **Non chiedere la camera all'avvio** (BUG-05).

### Priorità P2 — sicurezza/qualità del signaling
9. Signaling GitHub: issue privati, niente token a scope ampio, avviso sul leak di IP nell'SDP
   (SEC-02). Idealmente un signaling server dedicato.
10. Completare la ricezione `annoImage` (BUG-10) e risolvere il doppio reload del SW (BUG-11).

### Priorità P3 — igiene
11. Rimuovere `test_scroll.html`, `test-scroll-cam-grid.html`, `styles.patch.css`, `PATCH-README.txt`
    dal deploy.
12. Aggiungere linter/formatter + una pipeline CI minima (un `node --check`/eslint avrebbe
    intercettato BUG-01).
13. Arricchire il manifest (description, scope, maskable icons, screenshot) e sostituire le icone
    segnaposto.
14. Eliminare i `catch{}` vuoti; loggare gli errori in modo diagnosticabile.

---

### Allegato — verifiche eseguite
- `node --check sw.js` → **SyntaxError** confermato (riga 3, token inatteso).
- `node --check app.js` → OK (nessun errore di sintassi).
- `grep` di `btnJoin/btnLeave/btnRearCam/btnTorch/btnFullscreen/btnLock/role/sigMode` in `app.js`
  → **0 occorrenze** (handler/letture assenti).
- `grep styles.patch` in `index.html/app.js/sw.js` → **0 occorrenze** (CSS orfano).
- Verifica esistenza dei 11 asset elencati nella cache del SW → tutti presenti su disco.
