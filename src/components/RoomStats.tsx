import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

/** 통계용으로 전체 메시지를 긁으면 할당량이 크게 나간다. 최근 N개만 집계. */
const STATS_MESSAGE_LIMIT = 400

interface Props {
  roomId: string
}

interface MemberStat {
  name: string
  count: number
}

export default function RoomStats({ roomId }: Props) {
  const [stats, setStats] = useState<MemberStat[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dDay, setDDay] = useState<number | null>(null)
  const [roomCreatedAt, setRoomCreatedAt] = useState<Date | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      // 방 생성일 가져오기
      const roomSnap = await getDoc(doc(db, 'rooms', roomId))
      if (roomSnap.exists()) {
        const ts = roomSnap.data().createdAt as { seconds: number } | null
        if (ts) {
          const created = new Date(ts.seconds * 1000)
          setRoomCreatedAt(created)
          const diffMs = Date.now() - created.getTime()
          setDDay(Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)
        }
      }

      const q = query(
        collection(db, 'rooms', roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(STATS_MESSAGE_LIMIT),
      )
      const snap = await getDocs(q)
      const countMap: Record<string, { name: string; count: number }> = {}

      snap.forEach((d) => {
        const { authorId, authorName } = d.data() as { authorId: string; authorName: string }
        if (!countMap[authorId]) countMap[authorId] = { name: authorName, count: 0 }
        countMap[authorId].count++
      })

      const sorted = Object.values(countMap).sort((a, b) => b.count - a.count)
      setStats(sorted)
      setTotal(snap.size)
      setLoading(false)
    }
    fetchStats()
  }, [roomId])

  const MEDALS = ['🥇', '🥈', '🥉']

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* D-Day 배너 */}
      {dDay !== null && (
        <div className="bg-gradient-to-r from-violet-500 to-pink-500 rounded-2xl p-5 text-white text-center shadow-lg shadow-violet-200 dark:shadow-none">
          <p className="text-xs font-semibold opacity-80 tracking-widest uppercase mb-1">우리 함께한 지</p>
          <p className="text-5xl font-black tracking-tight">{dDay}<span className="text-2xl font-bold ml-1">일</span></p>
          {roomCreatedAt && (
            <p className="text-xs opacity-70 mt-2">
              {roomCreatedAt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 시작
            </p>
          )}
        </div>
      )}

      {/* 총계 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-violet-50 dark:bg-violet-900/30 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-violet-600 dark:text-violet-400">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">최근 메시지</p>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/30 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-pink-600 dark:text-pink-400">{stats.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">활성 멤버</p>
        </div>
      </div>

      {/* 멤버별 순위 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">💬 메시지 많이 보낸 사람 <span className="font-normal text-gray-400">(최근 기준)</span></h3>
        </div>
        {stats.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-600 py-6 text-sm">아직 메시지가 없어요</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {stats.map((s, i) => {
              const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
              return (
                <div key={s.name} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-xl w-7 text-center">
                    {MEDALS[i] ?? `${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">{s.name}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">{s.count}개 ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-violet-400 to-pink-400 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
