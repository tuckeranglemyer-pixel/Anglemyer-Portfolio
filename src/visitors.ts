import {
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'

export interface Visitor {
  id: string
  color: string
  timestamp: number
}

export async function fetchVisitors(maxCount = 12): Promise<Visitor[]> {
  const q = query(
    collection(db, 'visitors'),
    orderBy('timestamp', 'desc'),
    limit(maxCount),
  )
  const snap = await getDocs(q)
  return snap.docs.map(doc => ({
    id: doc.id,
    color: doc.data().color as string,
    timestamp: doc.data().timestamp as number,
  }))
}

export async function saveVisitor(color: string): Promise<string> {
  const ref = await addDoc(collection(db, 'visitors'), {
    color,
    timestamp: Date.now(),
  })
  return ref.id
}
