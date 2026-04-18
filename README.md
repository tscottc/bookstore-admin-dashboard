# Midwest Attic Admin Portal

An internal employee portal for Midwest Attic — a bookstore/retail operation. Built with vanilla HTML/CSS/JavaScript and Firebase, it gives staff a place to coordinate shifts, communicate as a team, and lets admins manage employee access.

---

## Features

- **Shift Marketplace** — Post shifts you can't work; coworkers can claim them in real time
- **The Colophon** — Internal team discussion board with threaded replies and edit/delete support
- **User Approvals** (admin only) — Approve or deny new employee account requests
- **Profile Settings** — Update your display name
- **Book Scanner** — External link to the companion book scanning app

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5 / CSS / Vanilla JavaScript (ES modules) |
| Styling | Tailwind CSS v4 (CDN) |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore (real-time) |
| Backend | Firebase Cloud Functions (Node.js 20) |
| Hosting | Firebase Hosting |

No build step. No framework. The entire frontend lives in `public/index.html` and is served directly.

---

## Project Structure

```
bookstore-admin-dashboard/
├── public/
│   └── index.html          # Entire frontend SPA
├── functions/
│   ├── index.js            # Cloud Functions (user creation trigger)
│   └── package.json
├── firestore.rules         # Firestore security rules
├── firebase.json           # Firebase Hosting config
├── .firebaserc             # Firebase project targets
└── .env.example            # Environment variable template
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
firebase use --add   # select or create your project
```

### 3. Configure Firebase credentials

The Firebase config is embedded in `public/index.html` (lines ~248–256). Replace the placeholder values with your project's config from the Firebase console:

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

You can find these values in **Firebase Console → Project Settings → Your apps**.

### 4. Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

### 5. Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 6. Deploy the frontend

```bash
firebase deploy --only hosting
```

Or deploy everything at once:

```bash
firebase deploy
```

### Local development

Serve the `public/` folder with any static HTTP server:

```bash
npx serve public
# or
python3 -m http.server 8080 --directory public
```

For local Cloud Functions testing:

```bash
firebase emulators:start --only functions
```

---

## How It Works

### Authentication & Access Control

1. New users sign up with email and password.
2. Firebase triggers the `createNewUser` Cloud Function, which creates a Firestore document with `approved: false` and `role: 'employee'`.
3. An admin must approve the account from the **User Approvals** page before the user can access the portal.
4. Denied users see an "access denied" message and cannot log in.

Roles: `employee` (default) or `admin`. Admins can approve/deny users and moderate all posts and shifts.

### Routing

Single-page app with hash-based routing. Pages:

| Hash | Page | Access |
|---|---|---|
| `#/` | Login / Auth modal | Public |
| `#/colophon` | Team discussion board | Approved users |
| `#/shifts` | Shift Marketplace | Approved users |
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
createdAt     timestamp
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

---

## Firestore Security Rules

- **Users:** Any authenticated user can read all profiles. Users can update their own doc but cannot change their `role` or `approved` fields. Admins can update any user doc. Only admins can delete users.
- **Colophon Posts:** Approved users can read and create. Authors or admins can edit/delete.
- **Shifts:** Approved users can read and create. Only the poster or an admin can update or delete a shift.

---

## Deployment Configuration

Defined in `firebase.json` and `.firebaserc`:

- **Firebase Project ID:** `store-directory-3`
- **Hosting Target:** `admin-dashboard-3`
- **Public Directory:** `public/`

To deploy to a different project, update `.firebaserc` and the Firebase config in `public/index.html`.

---

## Scripts (Cloud Functions)

From the `functions/` directory:

```bash
npm run serve    # Start local emulator
npm run deploy   # Deploy functions to Firebase
npm run logs     # Stream live function logs
npm run shell    # Open interactive Functions shell
```

---

## Notes

- Firebase SDK (v10.8.0) and Tailwind CSS (v4) are loaded from CDN — no `npm install` needed for the frontend.
- The companion Book Scanner app lives at `book-scanner-jkk.web.app`.
- There is no offline support or service worker configured.
- Avatar images use initials-based colored circles (no image uploads).
