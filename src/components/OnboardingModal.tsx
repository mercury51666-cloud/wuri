import { useState } from 'react'

const SLIDES = [
  {
    emoji: '🏡',
    title: '친한 친구만의 공간',
    desc: '초대 링크로만 들어올 수 있는\n비밀 아지트를 만들어보세요.',
  },
  {
    emoji: '🔑',
    title: '비밀번호로 초대',
    desc: '방마다 비밀번호가 있어요.\n링크 + 비밀번호로 친구만 들어올 수 있어요.',
  },
  {
    emoji: '💬',
    title: '실시간 채팅',
    desc: '답장, 반응, @멘션까지!\n카톡처럼 편하게 대화해요.',
  },
  {
    emoji: '🫧',
    title: '친구 지도 & 기분',
    desc: '젠리처럼 위치 공유하고\n오늘 mood도 남겨보세요.',
  },
  {
    emoji: '🎖️',
    title: '계급 & 미션',
    desc: '채팅하면 포인트 UP!\n사진 미션과 계급으로 더 재밌게.',
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
    <div className="modal-overlay items-end">
      <div className="modal-sheet sheet-enter w-full max-w-md rounded-t-[var(--radius-xl)] p-8 pb-10 flex flex-col items-center gap-6">
        <div className="w-full flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            건너뛰기
          </button>
        </div>

        <div className="w-24 h-24 bg-[var(--brand-soft)] rounded-[var(--radius-xl)] flex items-center justify-center text-5xl">
          {slide.emoji}
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-[var(--text)]">{slide.title}</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{slide.desc}</p>
        </div>

        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === idx
                  ? 'w-6 h-2 bg-[var(--brand)]'
                  : 'w-2 h-2 bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          className="btn btn-primary w-full py-4 text-base"
        >
          {idx < SLIDES.length - 1 ? '다음' : '시작하기 🚀'}
        </button>
      </div>
    </div>
  )
}
