# 👁️ Whispr – Anonymous Messaging App

A viral, mobile-first anonymous messaging platform with engagement hooks, share-to-unlock, polls, voice messages, and ratings.

---

## 🚀 Quick Start

### Option A – No Backend (Instant, localStorage only)
1. Open `index.html` in any browser — it works immediately.
2. Messages persist per-browser via `localStorage`.
3. Great for demos and testing.

### Option B – Firebase (Recommended for production)

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (free Spark plan works)
3. Enable **Firestore** (Start in test mode)
4. Go to Project Settings → Add a Web App → copy the config
5. Open `firebase-config.js` and replace the placeholder values:

```js
const FIREBASE_CONFIG = {
  apiKey:            "your-real-key",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc",
};
```

---

## ☁️ Deploy on Netlify (Free)

1. Zip this folder or push to GitHub
2. Go to [https://app.netlify.com](https://app.netlify.com) → New Site → drag & drop folder
3. Done! Your site is live at `https://your-site.netlify.app`
4. Optional: add a custom domain in Netlify settings

---

## 💰 AdSense Integration

Uncomment and fill the AdSense slots in `index.html`:

```html
<!-- In <head> -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX" crossorigin="anonymous"></script>

<!-- In ad slots -->
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXX"
     data-ad-slot="XXXXXXXXXX"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

Ad slots are pre-placed in 3 locations:
- `#ad-top` – above the landing card
- `#ad-send-bottom` – below the send form
- `#ad-inbox-native` – native-style in the inbox feed

---

## 📁 File Structure

```
whispr/
├── index.html        ← Main HTML (all screens)
├── style.css         ← All styles, mobile-first
├── script.js         ← Full app logic
├── firebase-config.js ← Your Firebase credentials (edit this!)
├── netlify.toml      ← Netlify deployment config
└── README.md         ← This file
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| Anonymous text messages | ✅ |
| Unique shareable links | ✅ |
| Inbox with message cards | ✅ |
| Share-to-unlock system | ✅ |
| WhatsApp / Instagram sharing | ✅ |
| Fake starter messages | ✅ |
| Guess Who hints | ✅ |
| Voice message recording | ✅ |
| Polls (Yes/No etc.) | ✅ |
| Star ratings 1–10 | ✅ |
| Notification badges | ✅ |
| Confetti celebrations | ✅ |
| Link view analytics | ✅ |
| Firebase persistence | ✅ |
| localStorage fallback | ✅ |
| AdSense slots | ✅ |
| Netlify deploy | ✅ |

---

## 🔒 Firestore Security Rules

In Firebase Console → Firestore → Rules, set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{username} {
      allow read: if true;
      allow write: if true; // Tighten with auth later
    }
    match /messages/{msgId} {
      allow read: if true;
      allow create: if true;
      allow delete: if true;
      allow update: if false;
    }
  }
}
```

---

## 🛡️ Notes on Anonymity

- No user accounts required to send
- No IP logging in this app
- Messages are stored without sender identity
- For full anonymity, combine with a VPN disclaimer in your ToS

---

Built with ❤️ — Whispr
