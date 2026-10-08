# LifeTracker private cloud + background steps

## What changed

- Cloud LifeTracker content is encrypted on the device with AES-256-GCM before upload.
- The server stores ciphertext and an encrypted wrapper for the data key. The server never receives the plaintext data key or recovery code.
- A new device can restore the private data with the recovery code.
- Password reset still resets the account password, but it cannot bypass the private-data recovery key.
- Android step history uses Health Connect when available, so the phone can accumulate steps while LifeTracker is not open. LifeTracker reads today's total when opened/resumed. Expo's Pedometer watch API itself does not deliver background updates.

## 1. Replace/add files

Replace:
- App.js
- api.js
- sync.js
- StepsScreen.js
- app.json
- package.json
- server/server.js
- server/.env.example

Add:
- cryptoVault.js
- DataRecoveryScreen.js
- RecoveryCodeScreen.js
- healthConnect.js
- healthConnect.android.js

Do not copy the ZIP's .env file. Keep your own local .env.

## 2. Install dependencies

From the LifeTracker project root:

npm install
npx expo install expo-build-properties
npm install react-native-health-connect

If npm reports dependency/version mismatches, run:

npx expo install --fix

## 3. Server environment

The new server no longer needs DATA_ENCRYPTION_KEY for LifeTracker personal data.
Keep:

PORT=4000
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=30d
APP_URL=http://localhost:4000
DB_PATH=./lifetracker.db
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-gmail-app-password
MAIL_FROM=LifeTracker <your-email@example.com>

Never put a real SMTP password in .env.example or source control.

## 4. Important existing database warning

The previous LifeTracker server stored user data using server-side AES encryption. The new server intentionally does not decrypt that old format.

For a clean privacy test, use a new/empty lifetracker.db or export/migrate your old data before switching. Do not claim the old cloud copy is already zero-knowledge until it has been migrated.

## 5. Start the API

cd server
npm start

Expected:
LifeTracker API running on http://0.0.0.0:4000

## 6. Android background steps

The Health Connect package requires a custom native build; it does not work in Expo Go.

Run:

npx expo prebuild --clean
npx expo run:android

or use an EAS development build:

eas build --profile development --platform android

On the phone, allow LifeTracker to read Steps and Background Access in Health Connect.

## 7. Privacy test

1. Create a new LifeTracker account.
2. Save the displayed recovery code somewhere safe.
3. Add an expense, note, event, goal, etc.
4. Sync.
5. Inspect the server database: user_data.data_json should contain an AES-256-GCM ciphertext object, not the expense/note text.
6. On another device, sign in.
7. LifeTracker should ask for the recovery code.
8. Enter it and confirm the records restore.

## 8. Password reset test

Password reset can change the account password. It must not reveal the private encryption key. On a new device, the recovery code remains required to restore encrypted personal data.

## 9. Background step test

1. Install the custom Android build.
2. Grant Health Connect Steps + Background Access permission.
3. Confirm today's step count appears.
4. Close/minimize LifeTracker.
5. Walk for several minutes.
6. Reopen LifeTracker.
7. The Steps screen should read the accumulated Health Connect total for today.

Health Connect availability and device/vendor behavior can vary, so the app keeps the existing Pedometer fallback for active use.
