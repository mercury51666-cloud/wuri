export function formatAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/unauthorized-domain':
      return `이 사이트(${window.location.hostname})가 Firebase에 등록되지 않았어요. Firebase 콘솔 → Authentication → Settings → Authorized domains에 "${window.location.hostname}" 추가 후 저장해주세요.`
    case 'auth/operation-not-allowed':
      return 'Google 로그인이 Firebase에서 꺼져 있어요. Authentication → Sign-in method에서 Google을 켜주세요.'
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return 'Firebase 설정(API Key)이 잘못됐어요. Vercel 환경 변수(VITE_FIREBASE_*)를 확인해주세요.'
    case 'auth/network-request-failed':
      return '네트워크 오류예요. Wi-Fi 연결 후 다시 시도해주세요.'
    case 'auth/web-storage-unsupported':
      return 'Safari에서 저장소가 차단됐어요. 시크릿 모드를 끄거나 Safari 설정 → 개인정보 보호 → "다른 추적 방지"를 꺼보세요.'
    case 'auth/missing-initial-state':
      return [
        'Safari가 로그인 진행 정보를 저장하지 못했어요 (개인정보 보호 기능 때문).',
        '',
        '아래 순서로 다시 시도해주세요:',
        '1) 설정 앱 → Safari → "다른 사이트 간 추적 방지" 끄기',
        '2) 시크릿 모드(비공개 브라우징)라면 끄고 일반 탭에서 열기',
        '3) 앱을 완전히 종료한 뒤 다시 Google로 시작하기를 눌러보기',
      ].join('\n')
    default:
      if (code) return `로그인 오류 (${code}). 잠시 후 다시 시도해주세요.`
      return '로그인에 실패했어요. 다시 시도해주세요.'
  }
}

export function isOAuthReturnUrl() {
  const href = window.location.href
  return /[?&#](apiKey|authType|authUser|code|state|error)=/.test(href)
}

export function oauthReturnFailureMessage() {
  return [
    'Google 로그인 후 연결이 끊겼어요.',
    `Firebase 콘솔 → Authentication → Settings → Authorized domains에`,
    `"${window.location.hostname}" 이 있는지 확인해주세요.`,
    '(없으면 Add domain으로 추가 후 저장)',
  ].join('\n')
}

export function parseAuthUrlError(): string | null {
  try {
    const search = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const code = search.get('error') || hash.get('error')
    if (!code) return null
    return formatAuthError({ code: `auth/${code}` })
  } catch {
    return null
  }
}
