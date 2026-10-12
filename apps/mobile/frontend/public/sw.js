const CACHE_PREFIX = "kamara-pwa-shell"

const LEGACY_CACHE_PREFIXES = ["mboi-pwa-shell"]

const CACHE_VERSION = "v7"

const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`

const SHELL_ROUTES = [
  "/",
  "/login",
  "/register",
  "/report",
  "/history",
  "/profile"
]

const PUBLIC_ASSETS = ["/manifest.webmanifest", "/kamara-logo.png"]

function isCacheableResponse(response) {
  return (
    response &&
    response.ok &&
    (response.type === "basic" || response.type === "cors")
  )
}

function extractNextStaticAssets(html) {
  const assets = new Set()

  const expression = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g

  let match

  while ((match = expression.exec(html)) !== null) {
    try {
      const url = new URL(match[1], self.location.origin)

      if (url.origin === self.location.origin) {
        assets.add(url.pathname + url.search)
      }
    } catch {}
  }

  return [...assets]
}

async function cacheStaticAsset(cache, asset) {
  try {
    const request = new Request(asset, {
      cache: "reload"
    })

    const response = await fetch(request)

    if (isCacheableResponse(response)) {
      await cache.put(request, response)
    }
  } catch {}
}

async function cacheRoute(cache, route) {
  try {
    const request = new Request(route, {
      cache: "reload"
    })

    const response = await fetch(request)

    if (!isCacheableResponse(response)) {
      return
    }

    await cache.put(route, response.clone())

    const contentType = response.headers.get("content-type") ?? ""

    if (!contentType.includes("text/html")) {
      return
    }

    const html = await response.text()

    const assets = extractNextStaticAssets(html)

    await Promise.allSettled(
      assets.map((asset) => cacheStaticAsset(cache, asset))
    )
  } catch {}
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME)

  await Promise.allSettled(
    PUBLIC_ASSETS.map((asset) => cacheStaticAsset(cache, asset))
  )

  for (const route of SHELL_ROUTES) {
    await cacheRoute(cache, route)
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell()

      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()

      const obsoleteNames = names.filter((name) => {
        if (name === CACHE_NAME) {
          return false
        }

        if (name.startsWith(CACHE_PREFIX)) {
          return true
        }

        return LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))
      })

      await Promise.all(obsoleteNames.map((name) => caches.delete(name)))

      await self.clients.claim()
    })()
  )
})

async function cacheFirst(request) {
  const cached = await caches.match(request)

  if (cached) {
    return cached
  }

  const response = await fetch(request)

  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME)

    await cache.put(request, response.clone())
  }

  return response
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)

    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME)

      await cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    const cached = await caches.match(request)

    if (cached) {
      return cached
    }

    throw error
  }
}

async function navigationRequest(request) {
  const url = new URL(request.url)

  try {
    const response = await fetch(request)

    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME)

      await cache.put(url.pathname, response.clone())
    }

    return response
  } catch {
    const cache = await caches.open(CACHE_NAME)

    const page = await cache.match(url.pathname)

    if (page) {
      return page
    }

    const home = await cache.match("/")

    if (home) {
      return home
    }

    return new Response("Aplicação indisponível offline.", {
      status: 503,

      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    })
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request

  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.startsWith("/api/")) {
    return
  }

  if (url.pathname === "/sw.js") {
    return
  }

  if (url.pathname === "/kamara-logo.png") {
    event.respondWith(networkFirst(request))

    return
  }

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(navigationRequest(request))

    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(cacheFirst(request))

    return
  }

  event.respondWith(networkFirst(request))
})
