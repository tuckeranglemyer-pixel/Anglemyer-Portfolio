import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// ⚠️  REPLACE THESE with your actual Firebase project credentials.
// Get them from https://console.firebase.google.com → Project Settings → Your apps
const firebaseConfig = {
  apiKey:            'REPLACE_ME',
  authDomain:        'REPLACE_ME',
  projectId:         'REPLACE_ME',
  storageBucket:     'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId:             'REPLACE_ME',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
