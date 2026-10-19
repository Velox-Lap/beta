# SHORTY.EXE — Retro Couple Web

A responsive vanilla HTML/CSS/JavaScript prototype with a CRT-style terminal entry screen and a couple dashboard.

## Run locally
Open `index.html` in a modern browser. No build tool is required.

## Features
- Terminal-style welcome screen (`help`, `login -u baby`, `execute love.sh`, `run meow_memories.exe`, `load shorty_pics`)
- Couple dashboard, time-together counter, random movie picker and daily messages
- Interactive "Open when..." letters
- Local memory archive
- Local profile name, bio and profile-photo upload
- Demo friends list
- Demo pairing-code UI
- Floating pixel companion

## Important prototype limitations
This is a front-end demo. Login is a playful terminal transition, not real authentication. Profile, memories and friends are saved in the current browser via `localStorage`; they do not sync between devices or users. The pairing screen does not securely connect accounts. Do not use it to store sensitive information.

## Production upgrade plan
Use Supabase (or Firebase) for authentication, database, profile image storage and friend/pairing relationships. Add server-side authorization policies, expiring one-time pairing tokens, validation, rate limiting and account deletion controls. Never store passwords in `localStorage`.

## Files
- `index.html` — structure
- `styles.css` — responsive UI, CRT scanline effect, animations
- `app.js` — terminal commands and demo interactions
