import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

export type RankEventKind =
  | 'mute' | 'salute' | 'reprimand' | 'gubo' | 'promotion'
  | 'rebellion' | 'mvp' | 'group_goal' | 'weekly_champion'

export async function postRankEvent(
  roomId: string,
  author: { uid: string; name: string; photoURL?: string | null },
  event: RankEventKind,
  text: string,
) {
  await addDoc(collection(db, 'rooms', roomId, 'messages'), {
    messageType: 'rank_event',
    event,
    text,
    authorId: author.uid,
    authorName: author.name,
    authorPhotoURL: author.photoURL || '',
    createdAt: serverTimestamp(),
  })
}
