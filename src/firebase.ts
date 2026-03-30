import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyC9AwY04eEi59l8PU0bMfLK15-L_1UOhes",
  authDomain: "anglemyer-portfolio.firebaseapp.com",
  projectId: "anglemyer-portfolio",
  storageBucket: "anglemyer-portfolio.firebasestorage.app",
  messagingSenderId: "1064344054280",
  appId: "1:1064344054280:web:b7878cf50da81f881cbfbd",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
