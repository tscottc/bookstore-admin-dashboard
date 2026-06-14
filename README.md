# John K. King Books — Staff Hub

Internal employee portal for John K. King Used & Rare Books. Built with vanilla HTML/CSS/JavaScript and Firebase, it gives staff a place to coordinate shifts, communicate as a team, and track hours. Admins manage employee access and approvals.

---

## Features

- **Shift Marketplace** — Post shifts you can't work; coworkers can claim them in real time
- **The Colophon** — Internal team discussion board with threaded replies and edit/delete support
- **Hour Tracker** — Log hours and calculate pay based on your hourly rate
- **Staff Roster** — View team contact info for opted-in employees
- **User Approvals** (admin only) — Approve or deny new employee account requests
- **Profile Settings** — Update your display name and roster preferences
- **Resources** — Links to companion tools including Book Junior (book scanner), the public directory, and external references

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 / CSS / Vanilla JavaScript (ES modules) |
| Auth | Firebase Authentication (Google sign-in) |
| Database | Cloud Firestore (real-time) |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Hosting | Firebase Hosting |

No build step. No framework. The entire frontend is served directly from `public/`.

---

## Project Structure

```
bookstore-admin-dashboard/
├── public/
│   ├── index.html                  # App shell and auth overlay
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js                  # Auth state, routing, page mounting
│       ├── firebase.js             # Firebase init and all DB/auth helpers
│       ├── components/
│       │   ├── auth.js             # Google sign-in UI
│       │   └── nav.js              # Sidebar navigation
│       └── pages/
│           ├── home.js
│           ├── shifts.js
│           ├── hours.js
│           ├── resources.js
│           ├── roster.js
│           ├── profile.js
│           └── approvals.js
├── functions/
│   ├── index.js                    # Cloud Functions
│   └── package.json
├── firestore.rules                 # Firestore security rules
├── firebase.json                   # Firebase Hosting config
└── .firebaserc                     # Firebase project targets
```

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A Firebase project with **Authentication** and **Firestore** enabled

### 1. Clone the repo

```bash
git clone https://github.com/tscottc/bookstore-admin-dashboard.git
cd bookstore-admin-dashboard
```

### 2. Connect your Firebase project

```bash
firebase login
firebase use --add
```

### 3. Configure Firebase credentials

The Firebase config is in `public/js/firebase.js`. Replace the values with your project's config from the Firebase console:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 4. Enable Google sign-in in Firebase Console

Go to **Authentication → Sign-in method → Google** and enable it. Under **Authorized domains**, add your hosting domain (e.g. `admin.johnkingbooksdetroit.com`).

### 5. Deploy

```bash
# Firestore rules only
firebase deploy --only firestore:rules

# Cloud Functions only
cd functions && npm install && cd ..
firebase deploy --only functions

# Frontend only
firebase deploy --only hosting

# Everything at once
firebase deploy
```

### Local development

```bash
npx serve public
# or
python3 -m http.server 8080 --directory public
```

---

## How It Works

### Authentication & Access Control

1. A new user clicks **Sign in with Google** and authenticates via their Google account.
2. If no Firestore document exists for that UID, one is created with `approved: false` and the user sees a "pending approval" screen.
3. An admin approves the account from the **User Approvals** page.
4. On next sign-in, the approved user gains full access. Denied users see an "access denied" message.

Roles: `employee` (default) or `admin`. Admins can approve/deny users and moderate all posts and shifts.

### Routing

Single-page app with hash-based routing.

| Hash | Page | Access |
|---|---|---|
| `#/home` | Home / Colophon feed | Approved users |
| `#/shifts` | Shift Marketplace | Approved users |
| `#/hours` | Hour Tracker | Approved users |
| `#/resources` | Tools & links | Approved users |
| `#/roster` | Staff Roster | Approved users |
| `#/profile` | Profile settings | Approved users |
| `#/approvals` | User approvals | Admins only |

### Real-Time Updates

Firestore `onSnapshot()` listeners keep the Colophon, Shifts, and Approvals pages live — no refresh needed.

---

## Data Models

### `users`
```
uid           string     Firebase Auth UID
email         string
displayName   string
role          'employee' | 'admin'
approved      boolean
denied        boolean
rosterOptIn   boolean
hourlyRate    number
timestamp     timestamp
```

### `colophonPosts`
```
content       string
authorId      string
timestamp     timestamp
replyTo       string | null   (null = top-level post)
edited        boolean
```

### `shifts`
```
date          string           YYYY-MM-DD
start         string           HH:MM
end           string           HH:MM
posterId      string
posterName    string
status        'open' | 'claimed'
claimerId     string | null
claimerName   string | null
timestamp     timestamp
```

### `hourEntries`
```
uid           string
date          string     YYYY-MM-DD
hours         number
note          string
timestamp     timestamp
```

---

## Firestore Security Rules

- **Users:** Any authenticated user can read all profiles. Users can update their own doc but cannot change their `role` or `approved` fields. Admins can update any user doc.
- **Colophon Posts:** Approved users can read and create. Authors or admins can edit/delete.
- **Shifts:** Approved users can read and create. Only the poster or an admin can update or delete a shift.
- **Hour Entries:** Users can only read and write their own entries. Admins can read all.

---

## Deployment Configuration

Defined in `firebase.json` and `.firebaserc`:

- **Firebase Project ID:** `store-directory-3`
- **Hosting Target:** `admin`
- **Live URL:** `admin.johnkingbooksdetroit.com`
- **Public Directory:** `public/`

---

## Scripts (Cloud Functions)

From the `functions/` directory:

```bash
npm run serve    # Start local emulator
npm run deploy   # Deploy functions to Firebase
npm run logs     # Stream live function logs
```

---

## Notes

- Firebase SDK (v10.8.0) is loaded from CDN — no `npm install` needed for the frontend.
- Authentication uses Google sign-in only. First-time sign-ins are held for admin approval before access is granted.
- The companion Book Scanner app (Book Junior) lives at `book-scanner-jkk.web.app` and is linked from the Resources page.
- There is no offline support or service worker configured.
