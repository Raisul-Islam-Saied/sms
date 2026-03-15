const CACHE_NAME = 'nexsms-premium-v6';

// যে ফাইলগুলো অফলাইনে চলার জন্য সেভ থাকবে
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo.png'
];

// ১. Install Event - প্রি-ক্যাশিং এবং সাথে সাথে আপডেট
self.addEventListener('install', (event) => {
    self.skipWaiting(); // নতুন আপডেট আসলে ইউজারকে রিফ্রেশ করতে হবে না
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// ২. Activate Event - পুরনো ক্যাশ ডিলেট করা (যাতে জায়গা নষ্ট না হয়)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// ৩. Fetch Event - স্মার্ট রাউটিং (API এবং Static Files আলাদা করা)
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // 🚨 বিপদ সংকেত: API রিকোয়েস্ট এবং ব্যালেন্স চেক কখনোই ক্যাশ করা যাবে না!
    if (url.pathname.includes('/proxy') || url.pathname.includes('/api') || url.pathname.includes('balance')) {
        event.respondWith(fetch(req)); // সরাসরি সার্ভার থেকে আনবে
        return;
    }

    // বাকি সব কিছুর জন্য "Stale-While-Revalidate" রুল
    // অর্থাৎ, ইউজারকে সাথে সাথে ক্যাশ থেকে অ্যাপ দেখাবে, আর ব্যাকগ্রাউন্ডে নতুন ফাইল আনবে
    event.respondWith(
        caches.match(req).then((cachedRes) => {
            const networkFetch = fetch(req).then((networkRes) => {
                // ফাইল ঠিক থাকলে ক্যাশে সেভ করে রাখবে
                if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return networkRes;
            }).catch(() => {
                // ইন্টারনেট না থাকলে কোনো এরর দেবে না, ক্যাশ করা ডাটাই দেখাবে
            });

            return cachedRes || networkFetch;
        })
    );
});
