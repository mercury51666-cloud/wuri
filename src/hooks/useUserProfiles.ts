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
  const data = snap.exists() ? (snap.data() as Partial<UserProfile>) : {}
  // 문서가 fcmTokens 등 다른 필드만으로 먼저 생성돼서 displayName/photoURL이
  // 아예 없는 경우가 있다 — 항상 완전한 형태로 채워서 돌려줘야 이걸 쓰는
  // 쪽(예: @멘션 파싱)에서 undefined로 인한 예외가 나지 않는다.
  const profile: UserProfile = {
    displayName: data.displayName || '친구',
    photoURL: data.photoURL || '',
  }
  cache[uid] = profile
  return profile
}

export async function saveUserProfile(uid: string, profile: UserProfile) {
  await setDoc(doc(db, 'users', uid), profile, { merge: true })
  cache[uid] = profile
}

/** 로그인 직후 한 번, 구글 계정의 이름/사진을 유저 문서에 채워 넣는다 — 이게 없으면
 * 프로필 화면을 한 번도 안 연 사람은 방 멤버 목록 등에서 계속 '친구'로만 보인다.
 * 이미 값이 있으면(직접 닉네임을 바꿨을 수도 있으니) 절대 덮어쓰지 않는다. */
export async function ensureProfileSeeded(
  uid: string,
  authName: string | null | undefined,
  authPhotoURL: string | null | undefined,
): Promise<void> {
  if (!authName && !authPhotoURL) return
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? (snap.data() as Partial<UserProfile>) : {}
  const updates: Partial<UserProfile> = {}
  if (!data.displayName && authName) updates.displayName = authName
  if (!data.photoURL && authPhotoURL) updates.photoURL = authPhotoURL
  if (Object.keys(updates).length === 0) return
  await setDoc(ref, updates, { merge: true })
  cache[uid] = {
    displayName: updates.displayName ?? data.displayName ?? '친구',
    photoURL: updates.photoURL ?? data.photoURL ?? '',
  }
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
