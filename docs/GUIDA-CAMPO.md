# Guida da campo — pezzaliAPP Remote Assist SUITE

*A cura di pezzaliAPP / Alessandro Pezzali — pezzaliAPP.com*

---

## ⚠️ Disclaimer

Questa guida è fornita **"così com'è", senza garanzie** di alcun tipo, esplicite o implicite.

- L'operatore è tenuto a **verificarla nel proprio contesto** prima di farvi affidamento: configurazioni di rete, dispositivi e browser cambiano i risultati.
- Restano **a carico dell'operatore**: il rispetto della **privacy** e delle normative applicabili (es. GDPR), la raccolta del **consenso alla ripresa** delle persone e dei luoghi inquadrati, e la **connettività** necessaria alla sessione.
- Un **TURN di terzi** instrada (relay) il traffico ma **non ne legge i contenuti**: il media WebRTC è cifrato con **DTLS**. Il server TURN, però, **vede gli indirizzi IP** dei partecipanti e i metadati di connessione.
- **Testare sempre** la catena completa (camera, TURN, signaling) **prima** dell'uso sul campo, su una rete equivalente a quella reale.

---

## 1) Perché questa app e non una semplice videochiamata col cliente

Se ti serve **solo parlare e mostrare qualcosa genericamente**, una normale videochiamata (telefono, una qualsiasi app consumer) è più che sufficiente. Non serve altro.

Questa app ha senso quando l'assistenza è **tecnica** e la precisione conta. La differenza pratica:

- **Puntatore laser preciso** sul video o sul documento del cliente: *"quella vite lì"* smette di essere una frase ambigua e diventa **un punto esatto** che il cliente vede sullo schermo, in tempo reale. È la differenza tra descrivere e indicare.
- **Annotazioni su schemi condivisi**: si disegna sopra una foto, un manuale o uno schema elettrico e lo si condivide col remoto. Si cerchia il componente giusto, si traccia il percorso di un cavo.
- **Apertura e sincronizzazione di PDF / manuali**: si apre un documento tecnico e la **vista è sincronizzata** tra tecnico ed esperto — si guarda tutti la stessa pagina, lo stesso dettaglio.
- **POV a mani libere**: camera **posteriore** del telefono, **torch** (luce) per i vani bui, supporto a **smart glasses** UVC. Il tecnico tiene le mani sull'attrezzatura mentre l'esperto guarda dal suo punto di vista.
- **Registrazione della sessione**: per documentare l'intervento, creare prova di quanto fatto o materiale formativo.
- **PWA brandizzata e installabile**: si installa come app sul dispositivo, con il tuo marchio, **invece** di mandare il cliente su un'app consumer generica e di terzi.

Inoltre il **media è P2P, cifrato end-to-end**: il flusso audio/video viaggia **direttamente tra i due dispositivi** (DTLS-SRTP), senza passare per un server che lo registra. Quando serve un TURN, questo fa solo da **relay cifrato** e non vede i contenuti.

**In sintesi:** una videochiamata trasmette una conversazione; questa app trasmette un **intervento guidato con precisione**.

---

## 2) Strumento da campo a basso costo

Su Wi-Fi della stessa rete la connessione P2P si stabilisce quasi sempre da sola. **Sul campo, su rete mobile reale** (4G/5G, NAT degli operatori, firewall aziendali), il P2P diretto **spesso fallisce**: serve un **TURN** che faccia da ponte. È il singolo fattore che rende l'app affidabile fuori dall'ufficio.

### TURN consigliato — Cloudflare Realtime TURN
- **1.000 GB/mese gratis**, poi **0,05 $/GB**.
- Rete **anycast** (latenza bassa, server vicino all'utente).
- Il media WebRTC resta **cifrato (DTLS)**: Cloudflare **fa da relay ma non legge i contenuti**.
- Ottimo rapporto affidabilità/prezzo per un uso professionale.

### Alternativa zero-setup — Metered Open Relay
- **20 GB/mese gratis**, attivabile in pochi minuti.
- Ascolta su **porte 80/443 con TLS**: **passa la maggior parte dei firewall aziendali** (il traffico sembra HTTPS).
- Adatto a test rapidi e a volumi contenuti.

### Self-host — coturn (controllo totale)
- **coturn** su un VPS economico: **Hetzner ~4 €/mese**, oppure **Oracle Cloud Always Free** (di fatto **0 €**).
- Massimo controllo su IP, log, credenziali e residenza dei dati. Richiede un minimo di amministrazione di sistema (apertura porte, certificati).

### Signaling (lo scambio dell'offerta/risposta)
Oggi il signaling è **copia/incolla manuale dell'SDP** tra i due partecipanti: funziona ma è scomodo sul campo. Due modi per migliorarlo:

- **GitHub Issues su repo PRIVATO**: l'app può scambiare OFFER/ANSWER nei commenti di un issue. **Usa un repository privato** e un **token fine-grained** limitato a quel solo repo. ⚠️ L'SDP contiene gli **indirizzi IP** dei partecipanti: su un issue pubblico sarebbero esposti a chiunque.
- **Piccolo server WebSocket** su un host gratuito (es. un free tier qualsiasi): lo scambio dell'SDP diventa automatico e immediato, senza copia/incolla.

### Dove inserire le credenziali TURN
Gli `iceServers` dell'app sono **già configurabili** via `localStorage`, senza ricompilare nulla. Apri la console del browser (sullo stesso dominio dell'app) e imposta la tua lista — ad esempio con un TURN:

```js
localStorage.setItem('iceServers', JSON.stringify([
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:TUO_HOST:3478?transport=udp',
      'turn:TUO_HOST:3478?transport=tcp',
      'turns:TUO_HOST:443?transport=tcp'
    ],
    username: 'UTENTE_TURN',
    credential: 'SEGRETO_TURN'
  }
]));
```

Ricarica la pagina: l'app userà questa lista per stabilire la connessione. Per tornare al solo STUN di default:

```js
localStorage.removeItem('iceServers');
```

> Nota: le credenziali TURN restano sul dispositivo. Per i servizi gestiti (Cloudflare, Metered) usa, se disponibili, **credenziali a tempo (ephemeral / short-lived)** invece di un segreto statico.

### ✅ Checklist minima di go-live
- [ ] **HTTPS attivo** sul dominio dell'app (WebRTC e camera **richiedono** un contesto sicuro).
- [ ] **TURN configurato e testato** (non solo STUN): verifica che si connetta da una rete diversa.
- [ ] **Signaling scelto** e provato (copia/incolla, GitHub Issues *privato*, o WebSocket).
- [ ] **Prova su rete mobile reale** (telefono in 4G/5G, **non** sul Wi-Fi dell'ufficio) end-to-end: camera → connessione → laser/annotazioni → eventuale registrazione.

---

*© Alessandro Pezzali — pezzaliAPP.com · Uso con licenza.*
