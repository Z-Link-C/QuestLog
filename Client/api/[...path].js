export default async function handler(req, res) {
  const backendBase = process.env.BACKEND_URL || process.env.VITE_API_URL

  if (!backendBase) {
    return res.status(500).json({
      error: 'BACKEND_URL/VITE_API_URL is not configured for this Vercel deployment.'
    })
  }

  const requestUrl = new URL(req.url, 'https://localhost')
  const targetPath = requestUrl.pathname.replace(/^\/api/, '') || '/'
  const target = new URL(`${backendBase}${targetPath}${requestUrl.search}`)

  const headers = new Headers(req.headers)
  headers.set('host', target.host)
  headers.set('x-forwarded-host', requestUrl.host)
  headers.set('x-forwarded-proto', requestUrl.protocol.replace(':', ''))

  const response = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
    redirect: 'manual',
  })

  res.status(response.status)
  response.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
      res.setHeader(key, value)
    }
  })
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

  if (req.method === 'OPTIONS') {
    return res.end()
  }

  const text = await response.text()
  return res.send(text)
}
