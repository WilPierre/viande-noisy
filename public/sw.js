/* ============================================================
   Viande Noisy — service worker
   À placer dans public/sw.js

   DEUX RÔLES
   1. Rendre la boutique installable sur l'écran d'accueil.
   2. Garder les photos des produits sur l'appareil, une fois
      pour toutes.

   POURQUOI GARDER LES PHOTOS
   Chaque nom de fichier est unique : une photo remplacée reçoit
   une nouvelle adresse. Une photo déjà téléchargée ne changera
   donc JAMAIS, et la revoir ne devrait rien coûter.
   La version précédente de ce fichier relançait chaque requête
   sans rien conserver — les mêmes images repartaient du serveur
   visite après visite. C'est ce qui remplissait le quota.

   CE QUI N'EST PAS GARDÉ
   Tout le reste : prix, stocks, commandes, réglages. Ces données
   doivent être justes à la seconde près. Un cache mal placé
   afficherait la promo de la semaine dernière — bien pire qu'un
   peu de bande passante.
============================================================ */

const CACHE_PHOTOS = 'viande-photos-v1';

// Les photos des produits, servies par le stockage Supabase.
function estUnePhoto(url) {
  return url.pathname.includes('/storage/v1/object/public/viande-photos/');
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // on efface les caches d'anciennes versions, le cas échéant
    const noms = await caches.keys();
    await Promise.all(
      noms.filter((n) => n.startsWith('viande-photos-') && n !== CACHE_PHOTOS)
          .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

async function photoDepuisLeCache(requete) {
  try {
    const cache = await caches.open(CACHE_PHOTOS);
    const connue = await cache.match(requete);
    if (connue) return connue;       // déjà sur l'appareil : rien ne part sur le réseau
    const reponse = await fetch(requete);
    // on ne garde que ce qui a abouti ; « opaque » est le cas normal
    // pour une image d'un autre domaine, et reste parfaitement utilisable
    if (reponse && (reponse.ok || reponse.type === 'opaque')) {
      cache.put(requete, reponse.clone()).catch(() => {});
    }
    return reponse;
  } catch (e) {
    // stockage plein, navigation privée, réseau coupé : on tente le
    // réseau sans filet plutôt que de casser l'affichage
    return fetch(requete);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;  // envoi de commande : on ne touche à rien

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  if (estUnePhoto(url)) {
    e.respondWith(photoDepuisLeCache(req));
    return;
  }

  // Tout le reste passe directement, sans être conservé.
  e.respondWith(fetch(req).catch(() => new Response(
    'Hors connexion — réessaie une fois le réseau revenu.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )));
});
