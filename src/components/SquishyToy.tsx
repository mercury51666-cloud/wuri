import { useRef, useState } from 'react'

const SPRING_EASE = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const MAX_DRAG = 46

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 진동 미지원 기기 (iOS Safari 등)는 무시
  }
}

export default function SquishyToy() {
  const blobRef = useRef<HTMLDivElement>(null)
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)
  const [poked, setPoked] = useState(false)

  const applyTransform = (dx: number, dy: number) => {
    const el = blobRef.current
    if (!el) return
    const dist = Math.min(Math.hypot(dx, dy), MAX_DRAG)
    if (dist < 0.5) {
      el.style.transform = ''
      return
    }
    const angle = Math.atan2(dy, dx)
    const ratio = dist / MAX_DRAG
    const stretch = 1 + ratio * 0.55
    const squeeze = 1 - ratio * 0.35
    const tx = Math.cos(angle) * dist * 0.5
    const ty = Math.sin(angle) * dist * 0.5
    const deg = (angle * 180) / Math.PI
    el.style.transform =
      `translate(${tx}px, ${ty}px) rotate(${deg}deg) scale(${stretch}, ${squeeze}) rotate(${-deg}deg)`
  }

  const resetTransform = () => {
    const el = blobRef.current
    if (!el) return
    el.style.transition = `transform 550ms ${SPRING_EASE}`
    el.style.transform = ''
    window.setTimeout(() => {
      if (el) el.style.transition = ''
    }, 560)
  }

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    draggingRef.current = true
    if (blobRef.current) blobRef.current.style.transition = ''
    vibrate(12)
    setPoked(true)
    window.setTimeout(() => setPoked(false), 150)
  }

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current || !originRef.current) return
    const dx = e.clientX - originRef.current.x
    const dy = e.clientY - originRef.current.y
    applyTransform(dx, dy)
  }

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    resetTransform()
    vibrate([10, 30, 10])
  }

  return (
    <div className="squishy-toy-wrap">
      <div
        ref={blobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`squishy-toy-blob ${poked ? 'squishy-toy-blob-poked' : ''}`}
      >
        <span className="squishy-toy-face">˙◡˙</span>
      </div>
      <p className="squishy-toy-hint">손가락으로 눌러서 쭉쭉 늘려보세요 🫶</p>
    </div>
  )
}
