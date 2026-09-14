/* Q.T.S Scheduler PWA Service Worker
 * Ver.6.8.33.6.45
 * 目的: オンライン時は最新版を優先し、オフライン時は最後に保存したQ.T.S本体を起動する。
 */

const QTS_SW_VERSION = "6.8.33.6.45";
const QTS_CACHE_PREFIX = "qts-scheduler-pwa-";
const QTS_CACHE_NAME = `${QTS_CACHE_PREFIX}${QTS_SW_VERSION}`;

const QTS_SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png"
];

// Q.T.Sの起動や図面赤入れで使う外部ライブラリ。
// 取得できないものが1つあってもService Worker全体の導入は止めない。
const QTS_EXTERNAL_STATIC = [
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
  "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js"
];

const QTS_STATIC_HOSTS = new Set([
  "www.gstatic.com",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com"
]);

function qtsScopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function qtsCacheOne(cache, url) {
  try {
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      await cache.put(request, response.clone());
      return true;
    }
  } catch (error) {
    console.warn("QTS SW precache skipped", url, error);
  }
  return false;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(QTS_CACHE_NAME);
    // 同一オリジンのアプリ本体を先に保存。
    await Promise.all(QTS_SHELL.map(path => qtsCacheOne(cache, qtsScopedUrl(path))));
    // CDN資産はbest-effort。1件失敗してもPWA導入は継続する。
    await Promise.allSettled(QTS_EXTERNAL_STATIC.map(url => qtsCacheOne(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(QTS_CACHE_PREFIX) && key !== QTS_CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function qtsNetworkFirstNavigation(request) {
  const cache = await caches.open(QTS_CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // 常に最新のindexをオフライン用へ更新する。
      await cache.put(qtsScopedUrl("./index.html"), response.clone());
    }
    return response;
  } catch (_) {
    return (await cache.match(qtsScopedUrl("./index.html"), { ignoreSearch: true })) || Response.error();
  }
}

async function qtsCacheFirst(request) {
  const cache = await caches.open(QTS_CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: request.url.startsWith(self.registration.scope) });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Q.T.S画面自体はオンライン時に最新版を取り、通信不可時だけキャッシュへ戻す。
  if (request.mode === "navigate") {
    event.respondWith(qtsNetworkFirstNavigation(request));
    return;
  }

  // GitHub Pages上のmanifest・アイコン類。
  if (url.origin === self.location.origin) {
    const path = url.pathname;
    if (/\.(?:png|ico|webmanifest)$/i.test(path)) {
      event.respondWith(qtsCacheFirst(request));
    }
    return;
  }

  // Firebase SDK / PDF.js等の静的CDNだけをキャッシュ。Firestore通信そのものは触らない。
  if (QTS_STATIC_HOSTS.has(url.hostname)) {
    event.respondWith(qtsCacheFirst(request));
  }
});
