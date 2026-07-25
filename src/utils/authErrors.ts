export function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/unauthorized-domain':
      return `이 사이트(${window.location.hostname})가 Firebase에 등록되지 않았어요. Firebase 콘솔 → Authentication → Settings → Authorized domains에 추가해주세요.`
    case 'auth/operation-not-allowed':
      return 'Google 로그인이 Firebase에서 꺼져 있어요. Authentication → Sign-in method에서 Google을 켜주세요.'
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return 'Firebase 설정(API Key)이 잘못됐어요. Vercel 환경 변수를 확인해주세요.'
    case 'auth/network-request-failed':
      return '네트워크 오류예요. Wi-Fi 연결 후 다시 시도해주세요.'
    case 'auth/web-storage-unsupported':
      return 'Safari에서 저장소가 차단됐어요. 시크릿 모드를 끄거나 Safari 설정 → 개인정보 보호에서 추적 방지를 확인해주세요.'
    default:
      if (code) return `로그인 오류 (${code}). 잠시 후 다시 시도해주세요.`
      return '로그인에 실패했어요. 다시 시도해주세요.'
  }
}

export function parseAuthUrlError(): string | null {
  try {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const code = search.get('error') || hash.get('error')
    if (!code) return null
    return formatAuthError({ code: `auth/${code.replace(/-/g, '-')}` })
  } catch {
    return null
  }
}
