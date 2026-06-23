import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

export interface UserProfile {
  displayName: string
  photoURL: string
}

const cache: Record<string, UserProfile> = {}

export async function getUserProfile(uid: string): Promise<UserProfile> {
  if (cache[uid]) return cache[uid]
  const snap = await getDoc(doc(db, 'users', uid))
  const profile: UserProfile = snap.exists()
    ? (snap.data() as UserProfile)
    : { displayName: '친구', photoURL: '' }
  cache[uid] = profile
  return profile
}

export async function saveUserProfile(uid: string, profile: UserProfile) {
  await setDoc(doc(db, 'users', uid), profile, { merge: true })
  cache[uid] = profile
}

export function useUserProfiles(uids: string[]) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})

  useEffect(() => {
    if (uids.length === 0) return
    Promise.all(uids.map((uid) => getUserProfile(uid).then((p) => ({ uid, p })))).then((results) => {
      const map: Record<string, UserProfile> = {}
      results.forEach(({ uid, p }) => { map[uid] = p })
      setProfiles(map)
    })
  }, [uids.join(',')])

  return profiles
}
