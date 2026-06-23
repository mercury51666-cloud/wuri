import { useEffect, useState } from 'react'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

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

  useEffect(() => {
    const fetchStats = async () => {
      const q = query(
        collection(db, 'rooms', roomId, 'messages'),
        orderBy('createdAt', 'asc')
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
      {/* 총계 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-violet-50 dark:bg-violet-900/30 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-violet-600 dark:text-violet-400">{total}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">총 메시지</p>
        </div>
        <div className="bg-pink-50 dark:bg-pink-900/30 rounded-2xl p-4 text-center">
          <p className="text-3xl font-black text-pink-600 dark:text-pink-400">{stats.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">활성 멤버</p>
        </div>
      </div>

      {/* 멤버별 순위 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">💬 메시지 많이 보낸 사람</h3>
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
