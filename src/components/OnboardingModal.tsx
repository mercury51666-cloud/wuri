import { useState } from 'react'

const SLIDES = [
  {
    emoji: '🏡',
    title: '친한 친구만의 공간',
    desc: '초대 링크로만 들어올 수 있는\n비밀 아지트를 만들어보세요.',
  },
  {
    emoji: '💬',
    title: '실시간 채팅',
    desc: '친구들과 자유롭게 대화하고\n서로의 일상을 공유해요.',
  },
  {
    emoji: '📸',
    title: '오늘의 미션',
    desc: '매일 주어지는 사진 미션!\n사물을 찍어서 서로 공유해봐요.',
  },
  {
    emoji: '🫧',
    title: '친구 지도',
    desc: '젠리처럼 친구들이 지금 어디에\n있는지 귀엽게 실시간 확인!',
  },
]

interface Props {
  onDone: () => void
}

export default function OnboardingModal({ onDone }: Props) {
  const [idx, setIdx] = useState(0)

  const next = () => {
    if (idx < SLIDES.length - 1) {
      setIdx(idx + 1)
    } else {
      onDone()
    }
  }

  const slide = SLIDES[idx]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="page-enter w-full max-w-md bg-white dark:bg-[#111] rounded-t-3xl p-8 pb-10 flex flex-col items-center gap-6">
        <div className="w-full flex justify-end">
          <button
            onClick={onDone}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            건너뛰기
          </button>
        </div>

        <div className="w-24 h-24 bg-violet-100 dark:bg-violet-500/10 rounded-3xl flex items-center justify-center text-5xl">
          {slide.emoji}
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-gray-900 dark:text-white">{slide.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{slide.desc}</p>
        </div>

        {/* 점 표시 */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === idx
                  ? 'w-6 h-2 bg-violet-500'
                  : 'w-2 h-2 bg-gray-200 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full bg-violet-500 hover:bg-violet-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition-all"
        >
          {idx < SLIDES.length - 1 ? '다음' : '시작하기 🚀'}
        </button>
      </div>
    </div>
  )
}
