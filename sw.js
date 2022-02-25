const version = 2;
const staticName = `PWA-Static-Movie-APP-${version}`;
const dynamicName = `PWA-Dynamic-Movie-APP-${version}`;
const cacheLimit = 20;
const cacheList = [
    '/',
    '/index.html',
    '/results.html',
    '/suggest.html',
    '/404.html',
    '/css/main.css',
    '/js/app.js',
    '/manifest.json',
    '/favicon.ico',
    '/img/android-chrome-192x192.png',
    '/img/android-chrome-512x512.png',
    '/img/apple-touch-icon.png',
    '/img/favicon-32x32.png',
    '/img/favicon-16x16.png',
    '/img/tmdb-logo.sgv',
    'https://fonts.googleapis.com/css2?family=Montserrat&display=swap',
];

self.addEventListener('install', (ev) => {
    ev.waitUntil(
        caches.open(staticName).then((cache) => {
            cache.addAll(cacheList);
        })
    );
});

self.addEventListener('activate', (ev) => {
    ev.waitUntil(
        caches
            .keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => {
                            if(key === staticName || key === dynamicName) {
                                return false;
                            } else {
                                return true;
                            }
                        })
                        .map((key) => caches.delete(key))
                );
            })
            .catch (console.warn)
    );
});

self.addEventListener('fetch', (ev) => {
    ev.respondWith(
        caches.match(ev.request).then((cacheRes) => {
            return (
                cacheRes ||
                fetch(ev.request)
                    .then((fetchRes) => {
                        if (fetchRes.status > 399) throw new Error(fetchRes.statusText);
                        return caches.open(dynamicName).then((cache) => {
                            let copy = fetchRes.clone();
                            cache.put(ev.request, copy);
                            limitCacheSize(dynamicName, cacheLimit);
                            return fetchRes;
                        });
                    })
                    .catch((err) => {
                        console.log('SW fetch failed.');
                        console.warn(err);
                        if (ev.request.mode == 'navigate') {
                            return caches.match('/404.html').then((page404Response) => {
                                return page404Response;
                            });
                        }
                    })
            );
        })
    );
});

self.addEventListener('message', (ev) => {
    //check ev.data to get the message
    console.log(ev.data);
    if (ev.data.ONLINE) {
        isOnline = ev.data.ONLINE;
        console.log(isOnline);
    }
});

function sendMessage(msg){
    //send a message to the browser from the service worker
    self.clients.matchAll().then(function (clients) {
        if (clients && clients.length) {
            clients[0].postMessage(msg);
        }
    })
};

// function limitCacheSize (name, size) {
//     return caches.open(name).then(cache => {
//         return cache.keys().then(keys => {
//             if(keys.length > size) {
//                 return cache.delete(keys[0]).then(()=>{return limitCacheSize(name,size)});
//             }
//         })
//     })
//     //remove some files from the dynamic cache
// }

function limitCacheSize (name, size) {
    caches.open(name).then(cache => {
        cache.keys().then(keys => {
            if(keys.length > size) {
                return cache.delete(keys[0]).then(limitCacheSize(name, size));
            }
        })
    })
}

function checkForConnection(){
    //try to talk to a server and do a fetch() with HEAD method.
    //to see if we are really online or offline
    //send a message back to the browser
}