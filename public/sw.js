S
/* ============================================================
   Viande Noisy — service worker minimal
   À placer dans public/sw.js
 
   Son seul rôle est de rendre la boutique installable : Chrome
   exige un service worker qui intercepte les requêtes pour
   proposer « Ajouter à l'écran d'accueil ».
 
   Volontairement SANS mise en cache : la boutique doit toujours
   afficher les prix et les stocks à jour. Un cache mal réglé
   servirait la promo de la semaine dernière.
============================================================ */
 
self.addEventListener('install', () => {
  self.skipWaiting();
});
 
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
 
self.addEventListener('fetch', (e) => {
  // on laisse passer, sans rien stocker
  e.respondWith(fetch(e.request).catch(() => new Response(
    'Hors connexion — réessaie une fois le réseau revenu.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )));
});
 
