# LifeTracker API

This server provides account authentication, password recovery, and cloud sync for the LifeTracker mobile app.

## Setup
1. Install Node.js 20+.
2. `cd server`
3. `npm install`
4. Copy `.env.example` to `.env`.
5. Set a long random `JWT_SECRET`.
6. Configure SMTP if you want real password-recovery emails.
7. `npm start`

The API listens on port 4000 and creates `lifetracker.db` automatically.

## Password recovery
Without SMTP, reset links are printed to the server console for local testing. With SMTP configured, the link is emailed to the user's registered email address.

## Production
Use HTTPS, a managed database/volume with backups, a strong secret, restricted CORS, and a real domain before public release. Do not expose SQLite directly to the internet.
