# LifeTracker 2.0

This build upgrades the original LifeTracker into a private life dashboard while keeping the existing Expenses, Steps, Calendar, Notes, Quick Add, themes, password lock and biometric unlock features.

## Added
- Redesigned 5-tab navigation: Today, Money, Timeline, Review, More
- Smart Daily Brief on Today
- Daily Balance card
- Daily Focus: up to 3 priorities per day
- Life Timeline combining events, expenses, notes, completed focus, steps and mood
- Mood + Energy daily check-in
- Weekly Review dashboard
- Goals without streak pressure
- Expanded Insights screen
- More hub for secondary modules
- Privacy & Backup controls
- Configurable auto-lock choices
- JSON backup sharing
- Expenses CSV sharing
- Weekly summary sharing

## Data
The new modules use AsyncStorage and are local-first. New keys include:
- `dailyFocus`
- `dailyMood`
- `lifeGoals`
- `privacySettings`

## Run
```bash
npm install
npx expo start
```

If dependencies are already installed:
```bash
npm start
```

## LifeTracker Complete Product Layer

This build adds account authentication and cloud storage without replacing the existing LifeTracker screens.

- Sign up with username, email and password
- Sign in with username or email
- Passwords hashed server-side with bcrypt
- SecureStore token storage on the phone
- Cloud sync so data can be restored after changing phones
- Encrypted cloud data at rest (AES-256-GCM)
- Forgot-password email flow with expiring reset links
- Account password change
- Existing local app-lock + biometric protection retained
- Cloud/local deletion from Privacy & Backup

See `PRODUCTION_SETUP.md` for exact Windows setup and testing steps. The server is in `server/`.
