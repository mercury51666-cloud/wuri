const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
let lastRequestAt = 0

function formatKoPlace(address: Record<string, string>): string {
  const dong = address.quarter || address.suburb || address.neighbourhood
  const gu = address.borough || address.city_district
  const city = (address.city || address.town || '').replace(/특별시|광역시|특별자치시|특별자치도/g, '')

  if (dong && gu) return `${dong} · ${gu}`
  if (gu && city && gu !== city) return `${gu} · ${city}`
  if (gu) return gu
  if (dong) return dong
  if (city) return city
  return ''
}

async function fetchKoPlace(lat: number, lng: number): Promise<string> {
  const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    'accept-language': 'ko',
    addressdetails: '1',
    zoom: '16',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: {
      'Accept-Language': 'ko',
      'User-Agent': 'WURI/1.0 (https://wuri-iota.vercel.app; friend map)',
    },
  })

  if (!res.ok) throw new Error('geocode failed')

  const data = await res.json()
  return formatKoPlace(data.address ?? {}) || data.display_name?.split(',')[0]?.trim() || '어딘가'
}

export async function reverseGeocodeKo(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const cached = cache.get(key)
  if (cached) return cached

  let promise = pending.get(key)
  if (!promise) {
    promise = fetchKoPlace(lat, lng)
      .then((label) => {
        cache.set(key, label)
        return label
      })
      .catch(() => '어딘가')
      .finally(() => {
        pending.delete(key)
      })
    pending.set(key, promise)
  }

  return promise
}
