# Firebase web setup

The project already uses the official `firebase` JavaScript package (`firebase/app` and `firebase/analytics`). Analytics loads only in the browser after the user has granted analytics consent. No Firebase Authentication, Firestore, Storage, or Messaging feature is used, so those features should not be enabled or added as separate dependencies until the product uses them.

Set these bindings on the `jogomanager-web` Cloudflare Worker:

- `GOOGLE_API_KEY` (or `FIREBASE_API_KEY`): the web API key for Firebase project `sscxz-2ee8d`.
- `GOOGLE_ANALYTICS_MEASUREMENT_ID` (or `VITE_GOOGLE_ANALYTICS_ID`): the matching GA4 measurement ID, in `G-...` format.

The code accepts these existing aliases. The current Worker has an analytics ID binding but no Firebase API key binding, so Firebase initialization remains disabled until the project key is set. The Firebase config is public client configuration; restrict the API key to the app's web origins and only the Google APIs used by Firebase.
