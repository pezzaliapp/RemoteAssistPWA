PATCH – Sync, PDF.js e Uscita
---------------------------------
1) Sostituisci `app.js` nella repo.
2) Aggiungi id="btnLeave" al bottone **Esci** in index.html:
   <button id="btnLeave">Esci</button>

Note:
- **Sync vista → remoto** funziona solo con URL web. Se stai visualizzando un file locale (URL che inizia con `blob:`), carica prima il PDF in `/docs` della repo o usa un link pubblico.
- **Apri con PDF.js (CDN)** apre il viewer di Mozilla. Anche questo richiede un URL http(s) (non i blob locali).
