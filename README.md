# Eyes Up – Live AI narration for the camera

A mobile-first web experience that keeps the camera running, sends snapshots to the Grok 4.1 Fast vision model via OpenRouter, and reads out what it sees in English. The layout favors high contrast, large touch targets, and hands-free use for blind or low-vision users.

## Quick start

1. Copy the environment template and add your OpenRouter key:

   ```bash
   cp .env.example .env
   # paste your key
   ```

2. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open the printed local URL in a secure context (`https://` or `http://localhost`) so the camera can start. Grant camera permission when prompted.

## Usage

- The camera starts automatically and a new description is requested every 6 seconds.
- Tap **Describe now** for an immediate refresh, or toggle **Auto describe** / **Speak results aloud** as needed.
- Narration appears on screen and is spoken with the browser Speech Synthesis API. Turn off speech if you only want on-screen text.

## Deployment

- The app is a static Vite build suitable for Vercel or any static host.
- Set the `VITE_OPENROUTER_API_KEY` environment variable in the deployment platform. The key is only read in the browser and is never committed to the repository.
- The OpenRouter model used is `x-ai/grok-4.1-fast:free`. You can change the model string in `src/services/openrouter.ts` if needed.

## Accessibility notes

- High-contrast palette with large typography and padded touch targets for mobile.
- Live regions (`aria-live`) announce status and narration updates for screen readers.
- The camera overlay reminds the user that the feed is active while controls stay within thumb reach.
