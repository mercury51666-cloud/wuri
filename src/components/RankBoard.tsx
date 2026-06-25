import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { RANK_TIERS, getNextRank, POINTS, getWeekKey, TIER_PERK_SUMMARY, type RankTier } from '../utils/rankSystem'
import { RANK_FUN_POWERS } from '../utils/rankPowers'
import type { RoomRankData } from '../utils/roomPoints'
import RankInsignia from './RankInsignia'

interface Props {
  roomId: string
}

export default function RankBoard({ roomId }: Props) {
  const { user } = useAuthState()
  const [ranks, setRanks] = useState<RoomRankData[]>([])
  const weekKey = getWeekKey()

  useEffect(() => {
    return onSnapshot(collection(db, 'rooms', roomId, 'ranks'), (snap) => {
      const list = snap.docs.map((d) => d.data() as RoomRankData)
      list.sort((a, b) => b.points - a.points)
      setRanks(list)
    })
  }, [roomId])

  const myRank = ranks.find((r) => r.userId === user?.uid)
  const nextRank = myRank ? getNextRank(myRank.points) : RANK_TIERS[1]
  const progress = myRank && nextRank
    ? Math.min(100, Math.round(((myRank.points - getCurrentTier(myRank.points).min) / (nextRank.min - getCurrentTier(myRank.points).min)) * 100))
    : 0

  const weeklyMissionLeader = [...ranks].sort((a, b) => b.weeklyMissions - a.weeklyMissions)[0]
  const weeklyChatLeader = [...ranks].sort((a, b) => b.weeklyMessages - a.weeklyMessages)[0]

  return (
    <div className="space-y-4">
      {/* 내 계급 */}
      {myRank && (
        <div className="bg-gradient-to-r from-emerald-600 to-green-700 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-xs font-semibold opacity-80 tracking-widest uppercase mb-1">내 계급</p>
          <div className="flex items-center gap-3 mt-1">
            <RankInsignia points={myRank.points} size="lg" />
            <p className="text-3xl font-black">{myRank.rankName}</p>
          </div>
          <p className="text-sm opacity-90 mt-1">{myRank.points}점</p>
          {nextRank && (
            <div className="mt-3">
              <div className="flex justify-between text-xs opacity-80 mb-1">
                <span>{myRank.rankName}</span>
                <span>{nextRank.name}까지 {nextRank.min - myRank.points}점</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 이번 주 1등 후보 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-2xl p-3">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">🎯 이번 주 미션 1등</p>
          <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
            {weeklyMissionLeader?.weeklyMissions
              ? `${weeklyMissionLeader.userName} (${weeklyMissionLeader.weeklyMissions}개)`
              : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">+{POINTS.WEEKLY_MISSION_TOP}점 보너스</p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-2xl p-3">
          <p className="text-xs text-violet-600 dark:text-violet-400 font-semibold mb-1">💬 이번 주 채팅 1등</p>
          <p className="text-sm font-bold text-gray-800 dark:text-white truncate">
            {weeklyChatLeader?.weeklyMessages
              ? `${weeklyChatLeader.userName} (${weeklyChatLeader.weeklyMessages}개)`
              : '-'}
          </p>
          <p className="text-xs text-gray-400 mt-1">+{POINTS.WEEKLY_CHAT_TOP}점 보너스</p>
        </div>
      </div>

      {/* 계급 장난 기능 */}
      <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-violet-100 dark:border-violet-500/20">
          <h3 className="font-bold text-violet-700 dark:text-violet-300 text-sm">🎭 계급 장난 기능</h3>
        </div>
        <div className="divide-y divide-violet-100/80 dark:divide-violet-500/10">
          {RANK_FUN_POWERS.map(({ icon, title, desc }) => (
            <div key={title} className="px-4 py-3 flex gap-3">
              <span className="text-xl shrink-0">{icon}</span>
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-white">{title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 계급표 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">🎖️ 계급표</h3>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-white/5">
          {RANK_TIERS.map((tier) => (
            <div key={tier.name} className="px-4 py-2.5">
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <RankInsignia points={tier.min} size="sm" />
                  {tier.name}
                </span>
                <span className="text-gray-400 shrink-0">{tier.min}점~</span>
              </div>
              {TIER_PERK_SUMMARY[tier.name] && (
                <p className="text-[11px] text-gray-400 mt-1">{TIER_PERK_SUMMARY[tier.name].join(' · ')}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 멤버 순위 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">🏅 멤버 계급 순위</h3>
          <p className="text-xs text-gray-400 mt-0.5">{weekKey} 주간 집계 중</p>
        </div>
        {ranks.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">미션이나 채팅을 하면 계급이 올라가요!</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {ranks.map((r, i) => (
              <div key={r.userId} className="px-4 py-3 flex items-center gap-3">
                <span className="text-lg w-7 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                    {r.userName}
                    {r.userId === user?.uid && <span className="text-xs text-violet-400 ml-1">(나)</span>}
                  </p>
                  <p className="text-xs text-gray-400">이번 주 미션 {r.weeklyMissions} · 채팅 {r.weeklyMessages}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <RankInsignia points={r.points} size="sm" />
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{r.rankName}</p>
                  </div>
                  <p className="text-xs text-gray-400">{r.points}점</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 text-center leading-relaxed">
        미션 +{POINTS.MISSION}점 · 3개 완료 +{POINTS.MISSION_DAILY_BONUS}점 · 채팅 +{POINTS.MESSAGE}점 (하루 {POINTS.MESSAGE_DAILY_CAP}점까지)
      </p>
    </div>
  )
}

function getCurrentTier(points: number): RankTier {
  let tier = RANK_TIERS[0]
  for (const t of RANK_TIERS) {
    if (points >= t.min) tier = t
  }
  return tier
}
