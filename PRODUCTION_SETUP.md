# LifeTracker Complete Product Setup

This version keeps the existing LifeTracker screens and adds a real account/cloud layer around them.

## What was added
- Account registration with username + email + password.
- Login with username or email.
- Passwords are hashed with bcrypt on the server; the mobile app never stores the cloud password.
- Authentication token is stored in Expo SecureStore.
- Cloud backup/sync for expenses, notes, events, steps, focus, mood, goals, budgets and the LifeTracker display name.
- Automatic background sync and merge when the app is active.
- Data-at-rest encryption in the server database using AES-256-GCM.
- Forgot-password email flow with expiring one-time reset tokens.
- Account password change.
- Existing local app-lock password and biometric lock remain in place as a second privacy layer.
- Cloud data can be deleted from Privacy & Backup together with local data.
- Security headers and authentication rate limits on the API.

## Important security rule
For public production use, the API must run behind HTTPS. Never expose the development HTTP server directly to the public internet.

## Local testing on Windows
### 1. Install Node.js
Use Node.js 20 LTS or newer LTS.

### 2. Start the API
Open PowerShell in `server`:

```powershell
cd E:\LifeTracker-2.0\server
npm install
```

Copy `.env.example` to `.env` and set:

```text
JWT_SECRET=<long-random-secret>
DATA_ENCRYPTION_KEY=<64 hex characters>
```

For local password-reset testing, SMTP can be left blank. The API prints the reset URL in the server console. For real email, configure SMTP.

Then:

```powershell
npm start
```

Check:

```text
http://localhost:4000/health
```

You should get JSON containing `"ok": true`.

### 3. Connect the mobile app to your PC
Find your PC IPv4 address:

```powershell
ipconfig
```

Look for the Wi-Fi/Ethernet `IPv4 Address`, for example `192.168.1.10`.

Create a root `.env` from `.env.example` and set:

```text
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
```

The phone and PC must be on the same Wi-Fi for this local setup.

### 4. Start Expo
From the project root:

```powershell
cd E:\LifeTracker-2.0
npm install
npx expo start --lan
```

Do not use `--tunnel` for this local test unless you specifically need it; the tunnel service is separate from the LifeTracker API.

### 5. Test the complete account flow
1. Open LifeTracker in Expo Go.
2. Create a new account.
3. Complete the existing local app-lock setup.
4. Add an expense, note, goal, focus item, mood and event.
5. Wait for sync or move the app to background/foreground.
6. Stop/restart the API and confirm the app reconnects.
7. Sign out from Settings.
8. Sign back in with the same username/password.
9. Confirm the data is still present.
10. To simulate a new phone, clear app storage/uninstall the app, reinstall it, sign in to the same account, and confirm cloud data is restored.
11. Test Forgot password. With SMTP disabled, copy the reset URL printed by the server into a browser. With SMTP configured, use the email link.
12. Test Privacy & Backup > Clear all local data. This version also deletes the cloud copy.

## Real email recovery
For Gmail SMTP, use a Google App Password rather than your normal Gmail password. Put the SMTP values in `server/.env`.

Example:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM=LifeTracker <your-email@gmail.com>
```

## Before public release
- Deploy the API to a server with HTTPS and a real domain.
- Move the database to durable managed storage or a production database service.
- Set a unique random JWT secret and AES-256 encryption key.
- Configure automated encrypted database backups and test restores.
- Restrict CORS to your production app/web origins.
- Configure production SMTP.
- Add privacy policy, terms, account deletion wording, store disclosures and data-safety declarations.
- Run Android and iOS release builds and test on real devices.

This ZIP is a development/production-preparation build. The final public-store deployment is a separate step and should not be done until the local account, recovery, sync and security tests pass.
