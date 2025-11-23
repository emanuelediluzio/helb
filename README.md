# helb

Visione assistita con descrizione vocale locale.

## Supertonic on-device
- La sintesi vocale usa il runtime Supertonic JS/ONNX senza chiavi API.
- Fornisci il modello locale in `public/supertonic/model.onnx` (un placeholder è già presente).
- Non è più necessario configurare `VITE_ELEVENLABS_API_KEY` o ID voce esterni.

## Sviluppo
1. Installa le dipendenze: `npm install`.
2. Avvia in sviluppo: `npm run dev`.
3. Compila per la produzione: `npm run build`.
