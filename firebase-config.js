/* ============================================================================
   QUEENBEE — FIREBASE CONFIGURATION  (the whole "Firebase console" lives here)
   ----------------------------------------------------------------------------
   1. Go to https://console.firebase.google.com  ->  Add project.
   2. Build -> Authentication -> Get started -> enable:  Email/Password,  Google  and  Phone.
      (Phone sign-in sends real SMS codes. Free plan: add test numbers under Authentication -> Sign-in method -> Phone ->
       "Phone numbers for testing". Real SMS to everyone needs the Blaze plan. Also add your domain under Authorized domains.)
   3. Build -> Firestore Database -> Create database (start in production mode),
      then paste the RULES below into the "Rules" tab and Publish.
   4. Project settings -> General -> "Your apps" -> Web app (</>) -> copy the config
      values and paste them into FIREBASE_CONFIG below.
   5. Authentication -> Settings -> Authorized domains: add the domain you host on
      (localhost is already allowed). Google sign-in needs http(s), not file://.
   6. FILES / VIDEOS / DOCUMENTS
        - Default (free, no setup): files up to 10 MB are stored in Firestore in chunks.
        - Bigger files (up to 100 MB): enable Firebase Storage (needs the Blaze plan),
          then set USE_FIREBASE_STORAGE = true below and publish Storage rules:
              rules_version = '2';
              service firebase.storage {
                match /b/{bucket}/o {
                  match /media/{uid}/{file} {
                    allow read: if request.auth != null;
                    allow write: if request.auth != null && request.auth.uid == uid && request.resource.size < 100 * 1024 * 1024;
                  }
                }
              }

   Until you replace the placeholder values, the app runs in LOCAL MODE
   (everything stored in your browser, so you can try it with two tabs).

   ---------------------------- FIRESTORE RULES -------------------------------
   (copy everything between the lines — no indentation needed)

rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {
match /users/{uid} {
allow read: if request.auth != null;
allow write: if request.auth != null && request.auth.uid == uid;
}
match /chats/{chatId} {
allow read, create, update: if request.auth != null;
allow delete: if false;
match /messages/{mid} {
allow read, create, update: if request.auth != null;
allow delete: if request.auth != null;
}
}
match /statuses/{id} {
allow read, create, update: if request.auth != null;
allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
}
match /calls/{id} {
allow read, create, update: if request.auth != null;
}
match /files/{fid} {
allow read, create: if request.auth != null;
match /chunks/{cid} {
allow read, create: if request.auth != null;
}
}
}
}
   ========================================================================== */

window.FIREBASE_CONFIG = {
apiKey: "AIzaSyCmAu7GDoq7rECwwnFL8dqhXutTZuIzs4I",
 authDomain: "chat-app-95fb1.firebaseapp.com",
 projectId: "chat-app-95fb1",
 storageBucket: "chat-app-95fb1.firebasestorage.app",
 messagingSenderId: "454749787692",
 appId: "1:454749787692:web:34b2b3ceb0fb73a54d6389",
 measurementId: "G-H08N283M28"
};


// ---- Voice / video calls (WebRTC) ----
// STUN lets two devices find each other. Most home/mobile networks work with STUN only.
// If calls connect but stay silent on some networks (strict firewalls / office Wi-Fi), add a TURN server:
//   { urls: 'turn:YOUR_TURN_HOST:3478', username: 'USER', credential: 'PASSWORD' }   (free tiers: metered.ca, xirsys.com, or run coturn)
window.ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

// ---- AI assistant (optional) ----
// Leave empty to use the built-in offline assistant. To use your own AI service (any OpenAI-compatible endpoint), fill these in
// — or let each person enter them in Settings -> AI assistant. NOTE: a key placed here is visible to anyone who opens the site.
window.AI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/';  
window.AI_KEY = 'AQ.Ab8RN6I6Sc52raH29MCPIe4NaD3JO8NlJm7NfgCFDWUb415tPA';
window.AI_MODEL = 'gemini-1.5-flash';


window.USE_FIREBASE_STORAGE = false; // true only if Storage is enabled in your project (see step 6)
window.FORCE_DEMO = false;           // true = always use Local mode, even with a valid config

// true  = every browser TAB has its own login (reloading keeps you signed in; closing the tab signs you out).
//         Lets you be two different people in two tabs of the same browser.
// false = one login shared by all tabs, remembered even after closing the browser.
window.SESSION_PER_TAB = true;

/* Optional: search a huge online GIF library inside the chat picker.
   Leave empty to use the built-in animated GIFs. provider: 'tenor' or 'giphy' (free keys from their developer sites). */
window.GIF_API = { provider: 'giphy', key: 'BNXCvXwKoP2dDcIUMalGDEKIFmz9NKF7' };
