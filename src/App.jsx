import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ============================================================
   CONFIG SUPABASE
   Renseigne ces 2 variables dans Vercel (Settings → Environment Variables) :
     REACT_APP_SUPABASE_URL
     REACT_APP_SUPABASE_ANON_KEY
   (les mêmes que ton projet Noisy en Fête)
============================================================ */
// Marqueur de version — affiché en bas de la boutique.
// Sert à vérifier d'un coup d'œil quelle version est réellement déployée.
const VERSION = '2026-10-29 · poids sur toutes les lignes';

const SB_URL = process.env.REACT_APP_SUPABASE_URL;
const SB_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

/* ============================================================
   MODES DE VENTE
============================================================ */
const MODES = {
  // prixUnite : pour les libellés de champs (« Prix Patrice (€/kg) »)
  // suffixe   : à coller après un montant déjà formaté par eur() → « 13,99 €/kg »
  piece_fixe:  { label: 'À la pièce',         court: 'pièce', prixUnite: '€/pièce', suffixe: '/pièce', pese: false, decimal: false },
  kg:          { label: 'Au kilo',            court: 'kg',    prixUnite: '€/kg',    suffixe: '/kg',    pese: true,  decimal: true  },
  piece_pesee: { label: 'À la pièce (pesé)',  court: 'pièce', prixUnite: '€/kg',    suffixe: '/kg',    pese: true,  decimal: false },
};
const CATEGORIES = ['Bœuf', 'Poulet', 'Porc', 'Viande', 'Charcuterie', 'Crèmerie', 'Épicerie', 'Autre'];
// « Viande » reste pour tout ce qui n'entre pas dans les trois premières
// (veau, canard, agneau…) — d'où un libellé différent à l'affichage.
// Libellés d'affichage : la valeur stockée en base ne change pas,
// seul le mot vu par le client est adapté.
const LIBELLES_CAT = { Viande: 'Autres viandes', Autre: 'Divers' };
const libelleCat = (c) => LIBELLES_CAT[c] || c;
// Une icône par catégorie : on repère la bonne pastille à la forme
// avant même d'avoir lu le mot.
const ICONES_CAT = {
  'Bœuf': '🐄', 'Poulet': '🐔', 'Porc': '🐖', 'Viande': '🥩',
  'Charcuterie': '🌭', 'Crèmerie': '🧀', 'Épicerie': '🫒', 'Autre': '🧺',
};
const iconeCat = (c) => ICONES_CAT[c] || '';

/* Vignette de remplacement pour un produit sans photo.
   Pas de photo piochée sur internet : sur ce catalogue, « merlan de
   bœuf » ramènerait un poisson et « araignée de bœuf » un insecte.
   On dessine donc une tuile, teintée selon la catégorie. */
const TEINTES_CAT = {
  'Bœuf':        ['#8A2E2E', '#C25A4A'],
  'Poulet':      ['#C98A2B', '#E8BB68'],
  'Porc':        ['#B85C6B', '#E0A0A8'],
  'Viande':      ['#7A3A2E', '#B8705A'],
  'Charcuterie': ['#7B2D3C', '#B85C6B'],
  'Crèmerie':    ['#C9A227', '#EBD68A'],
  'Épicerie':    ['#4E6B34', '#9BB06A'],
  'Autre':       ['#6B5B4E', '#A89685'],
};
function teintesDe(p) {
  return TEINTES_CAT[catDe(p)] || TEINTES_CAT.Autre;
}
// un produit ajouté depuis moins de 5 jours porte le badge « Nouveau »
function estNouveau(p) {
  if (!p || !p.created_at) return false;
  const t = new Date(p.created_at).getTime();
  if (isNaN(t)) return false;
  return (Date.now() - t) < 5 * 86400000;
}
// Filet de sécurité : un produit rangé dans une catégorie inconnue
// (ancienne valeur, faute de frappe) reste visible dans « Autre »
// au lieu de disparaître silencieusement de la boutique.
const catDe = (p) => (CATEGORIES.includes(p.categorie) ? p.categorie : 'Autre');
// Emojis proposés dans l'admin, classés par famille.
// Tu peux aussi coller n'importe quel autre emoji dans le champ libre.
const EMOJIS = [
  { groupe: 'Viande & volaille', liste: ['🥩', '🍖', '🍗', '🥩', '🐄', '🐖', '🐑', '🐓', '🐔', '🦆', '🦃', '🐇'] },
  { groupe: 'Charcuterie',       liste: ['🥓', '🌭', '🥪', '🍕', '🧆', '🫓'] },
  { groupe: 'Poisson & mer',     liste: ['🐟', '🐠', '🍣', '🍤', '🦐', '🦀', '🦞', '🦑', '🐙', '🐚'] },
  { groupe: 'Crèmerie & œufs',   liste: ['🧀', '🥚', '🍳', '🥛', '🧈', '🍮'] },
  { groupe: 'Épicerie',          liste: ['🫒', '🧴', '🫗', '🍯', '🧂', '🌶️', '🥫', '🫙', '🍝', '🍚', '🥖', '🥐', '🍞', '🥜'] },
  { groupe: 'Fruits & légumes',  liste: ['🍅', '🥔', '🧅', '🧄', '🥕', '🥬', '🫑', '🍋', '🍎', '🍇', '🍓', '🍄'] },
  { groupe: 'Boissons',          liste: ['🍷', '🍺', '🥂', '🍾', '🧃', '☕'] },
  { groupe: 'Divers',            liste: ['🧺', '🛒', '📦', '🎁', '🏷️', '⭐', '🔥', '💰', '🥘', '🍽️', '❄️', '🧊'] },
];
const TOUS_EMOJIS = EMOJIS.flatMap((g) => g.liste);

/* ============================================================
   HELPERS
============================================================ */
// Convertit une saisie en nombre. Accepte la virgule française, les espaces
// et un éventuel € ou kg collé — parseFloat('12,94') renvoyait 12 et perdait
// les centimes sans le moindre message.
function nombre(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v)
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/[€]/g, '')
    .replace(/kg$/i, '')
    .replace(',', '.');
  if (s === '' || s === '.' || s === '-') return NaN;
  return parseFloat(s);
}
// arrondi monétaire au centime
const cts = (n) => Math.round((Number(n) || 0) * 100) / 100;

const eur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const num = (n) => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

function poidsEstime(mode, quantite, poidsMoyen) {
  if (mode === 'kg') return Number(quantite) || 0;
  if (mode === 'piece_pesee') return (Number(quantite) || 0) * (Number(poidsMoyen) || 0);
  return 0;
}
function sousTotal(mode, quantite, prixUnite, poidsMoyen) {
  if (mode === 'piece_fixe') return (Number(quantite) || 0) * (Number(prixUnite) || 0);
  return poidsEstime(mode, quantite, poidsMoyen) * (Number(prixUnite) || 0);
}
/* Recalcule les totaux d'une commande à partir des lignes réellement
   en base. On ne tient pas les totaux à la main : après un ajout, un
   retrait et deux changements de quantité, une addition entretenue au
   fil de l'eau finit toujours par mentir — et c'est la marge affichée
   qui s'en trouve fausse. */
async function recalculerTotauxCommande(commandeId) {
  const [{ data: lignes, error }, { data: cmd }] = await Promise.all([
    supabase.from('viande_commande_lignes').select('*').eq('commande_id', commandeId),
    supabase.from('viande_commandes').select('remise_pct').eq('id', commandeId).maybeSingle(),
  ]);
  if (error) throw error;
  let est = 0;
  let pat = 0;
  (lignes || []).forEach((l) => {
    est += Number(l.sous_total_estime) || 0;
    const q = l.mode_vente === 'piece_fixe'
      ? (Number(l.quantite) || 0)
      : (l.poids_reel != null
        ? (Number(l.poids_reel) || 0)
        : poidsEstime(l.mode_vente, l.quantite, l.poids_moyen));
    pat += (Number(l.prix_patrice) || 0) * q;
  });
  // la remise d'anniversaire porte sur le total client, jamais sur le
  // coût Patrice : elle se prend intégralement sur la marge
  const { error: e2 } = await supabase.from('viande_commandes').update({
    total_estime: apresRemise(est, cmd || {}),
    total_patrice: cts(pat),
    total_final: null,   // sera refait à la pesée
    statut: 'en_cours',
  }).eq('id', commandeId);
  if (e2) throw e2;
}

/* ---- export CSV ----
   Point de vigilance franco-français : Excel attend le point-virgule
   comme séparateur, et refuse les accents sans marque d'encodage en
   tête de fichier (le « BOM »). Sans ces deux précautions, le fichier
   s'ouvre en une seule colonne illisible pleine de « Ã© ». */
function cellCsv(v) {
  const t = v === null || v === undefined ? '' : String(v);
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
function telecharger(nomFichier, contenu, type) {
  try {
    const blob = new Blob(['\uFEFF', contenu], { type: type || 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomFichier;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (e) { return false; }
}
function versCsv(entetes, lignes) {
  return [entetes, ...lignes].map((r) => r.map(cellCsv).join(';')).join('\r\n');
}

/* ---- détail d'une ligne, côté client ----
   Ce que le voisin doit lire sur sa facture : le poids réellement
   pesé quand il existe, la quantité sinon, et TON prix unitaire.
   Jamais le prix Patrice — cette fonction ne le lit même pas.
   Écrite une seule fois pour que l'écran « Mon compte » et la
   facture imprimée disent exactement la même chose. */
function detailLigneClient(l) {
  if (!l) return '';
  if (l.rupture) return 'non fourni';
  if (l.demande && !(Number(l.sous_total_final) > 0)) return 'prix à confirmer';

  const pu = Number(l.prix_william) || 0;

  /* Un poids enregistré fait foi, quel que soit le mode de vente :
     c'est la même règle que celle du calcul côté pesée. Sans ce
     test en premier, une ligne vendue à la pièce mais pesée
     afficherait « 1 × 12,50 € » pour un montant calculé au kilo —
     le client verrait deux chiffres qui ne se recoupent pas. */
  if (l.poids_reel != null) return `${num(l.poids_reel)} kg × ${eur(pu)}/kg`;

  if (l.mode_vente === 'piece_fixe') {
    const cmd = Number(l.quantite) || 0;
    const livree = l.quantite_livree != null ? Number(l.quantite_livree) : cmd;
    const q = livree !== cmd ? `${num(livree)} sur ${num(cmd)}` : num(cmd);
    return `${q} × ${eur(pu)}`;
  }

  const unite = l.mode_vente === 'kg' ? 'kg' : 'pièce(s)';
  return `${num(l.quantite)} ${unite} × ${eur(pu)}/kg · poids à confirmer`;
}

/* ---- remise portée par une commande ----
   Une seule fonction pour toute l'application : le panier, la note du
   client, la feuille de pesée et la liste d'encaissement doivent
   impérativement donner le même chiffre. Une remise recalculée à
   plusieurs endroits finit toujours par diverger d'un centime, et
   c'est le client qui le remarque. */
function pctRemise(c) {
  const p = Number(c && c.remise_pct) || 0;
  return p > 0 && p < 100 ? p : 0;
}
function montantRemise(brut, c) {
  return cts((Number(brut) || 0) * pctRemise(c) / 100);
}
function apresRemise(brut, c) {
  return cts((Number(brut) || 0) - montantRemise(brut, c));
}

/* ---- anniversaires ----
   Seuls le jour et le mois comptent. L'année est enregistrée mais
   jamais affichée : personne n'a envie de voir son âge s'afficher
   dans une boutique de viande. */
function jourMois(d) {
  if (!d) return null;
  const x = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (isNaN(x.getTime())) return null;
  return { j: x.getDate(), m: x.getMonth() + 1 };
}
function estAnniversaire(d, ref) {
  const a = jourMois(d);
  if (!a) return false;
  const r = ref || new Date();
  return a.j === r.getDate() && a.m === r.getMonth() + 1;
}
/* Jours restants avant le prochain anniversaire : 0 aujourd'hui,
   1 demain, etc. Gère le passage d'une année à l'autre. */
function joursAvantAnniv(d, ref) {
  const a = jourMois(d);
  if (!a) return null;
  const r = ref || new Date();
  const auj = new Date(r.getFullYear(), r.getMonth(), r.getDate());
  let cible = new Date(r.getFullYear(), a.m - 1, a.j);
  if (cible < auj) cible = new Date(r.getFullYear() + 1, a.m - 1, a.j);
  return Math.round((cible - auj) / 86400000);
}
function annivLisible(d) {
  const a = jourMois(d);
  if (!a) return '';
  return `${String(a.j).padStart(2, '0')}/${String(a.m).padStart(2, '0')}`;
}

/* ---- tes repères sur les voisins ----
   Quatre Vincent, six Christophe, trois Amélie : le nom du compte ne
   suffit pas pour envoyer la bonne note à la bonne personne. Ces
   repères sont les tiens, pas les leurs — ils vivent donc dans ta
   propre table (viande_reperes) et non dans la fiche du membre, qui
   est verrouillée par construction et que tu ne peux pas modifier.
   Table absente = aucun repère, et l'application fonctionne comme
   avant : rien ne casse tant que la migration n'est pas lancée. */
async function chargerReperes() {
  const { data, error } = await supabase.from('viande_reperes')
    .select('user_id, repere, telephone, note');
  if (error) return {};
  const m = {};
  (data || []).forEach((r) => { m[String(r.user_id)] = r; });
  return m;
}

async function enregistrerRepere(userId, champs) {
  const { data, error } = await supabase.from('viande_reperes')
    .upsert({ user_id: userId, ...champs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' })
    .select('user_id');
  if (error) {
    const m = messageErreur(error);
    return {
      ok: false,
      message: /viande_reperes|relation|schema/i.test(String(m))
        ? 'Table absente — lance migration-reperes.sql dans Supabase.'
        : m,
    };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: 'Refusé par la base — lance migration-reperes.sql dans Supabase.' };
  }
  return { ok: true };
}

/* ---- écriture dans une fiche membre ----
   Piège de Supabase : quand une règle de sécurité refuse une
   modification, il ne renvoie AUCUNE erreur. Il met simplement zéro
   ligne à jour et répond que tout va bien. L'application annonçait
   donc « enregistré » alors que rien n'était écrit.
   En demandant les lignes modifiées (.select()), on sait si quelque
   chose a réellement changé, et on peut le dire. */
async function majFicheClient(userId, champs) {
  const { data, error } = await supabase.from('viande_clients')
    .update(champs).eq('id', userId).select('id');
  if (error) return { ok: false, message: messageErreur(error) };
  if (!data || data.length === 0) {
    return {
      ok: false,
      message: 'Refusé par la base : ton compte n\'a pas le droit de modifier '
        + 'cette fiche. Lance migration-admin-clients.sql dans Supabase.',
    };
  }
  return { ok: true };
}

function sousTotalFinal(l) {
  if (l.mode_vente === 'piece_fixe') return (Number(l.quantite) || 0) * (Number(l.prix_william) || 0);
  const poids = l.poids_reel != null ? Number(l.poids_reel) : poidsEstime(l.mode_vente, l.quantite, l.poids_moyen);
  return poids * (Number(l.prix_william) || 0);
}
/* ---- messages d'erreur d'enregistrement ----
   Supabase renvoie une erreur explicite quand une colonne manque.
   Sans ce contrôle, l'application affichait « enregistré » alors que
   rien n'était écrit. */
function messageErreur(error) {
  if (!error) return null;
  const m = String(error.message || error.details || '');
  if (/schema cache|column .* does not exist|could not find/i.test(m)) {
    const col = m.match(/'([a-z_]+)'/i);
    return col
      ? `Colonne « ${col[1]} » absente en base — lance le fichier SQL de migration.`
      : 'Colonne absente en base — lance le fichier SQL de migration.';
  }
  if (/row-level security|permission/i.test(m)) return 'Écriture refusée par la base (droits).';
  return m.slice(0, 140) || 'Erreur inconnue';
}

// « Bonsoir » à partir de 17h30, « Bonjour » avant.
function salutation(t) {
  const d = t ? new Date(t) : new Date();
  return (d.getHours() * 60 + d.getMinutes()) >= 1050 ? 'Bonsoir' : 'Bonjour';
}

/* ---- thème clair / sombre ---- */
const CLE_THEME = 'viande-noisy:theme';
function lireTheme() {
  try {
    const t = window.localStorage.getItem(CLE_THEME);
    if (t === 'sombre' || t === 'clair') return t;
  } catch (e) { /* stockage indisponible */ }
  // à défaut, on suit le réglage du téléphone
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'sombre';
  } catch (e) { /* rien */ }
  return 'clair';
}
function ecrireTheme(t) {
  try { window.localStorage.setItem(CLE_THEME, t); } catch (e) { /* rien */ }
}

/* ---- sondage : on ne resollicite pas quelqu'un qui a déjà répondu ---- */
const CLE_SONDAGE = 'viande-noisy:sondage-v1';
function aDejaRepondu(dateVente) {
  try { return window.localStorage.getItem(CLE_SONDAGE) === String(dateVente); }
  catch (e) { return false; }
}
function marquerRepondu(dateVente) {
  try { window.localStorage.setItem(CLE_SONDAGE, String(dateVente)); }
  catch (e) { /* stockage indisponible */ }
}

/* ---- commande envoyée, conservée côté client ----
   Permet au client de revenir modifier ou annuler sa commande
   tant que la boutique est ouverte. */
const CLE_COMMANDE = 'viande-noisy:commande-v1';
function lireCommandeStockee(dateVente) {
  try {
    const c = JSON.parse(window.localStorage.getItem(CLE_COMMANDE) || 'null');
    if (c && c.date === dateVente && c.id) return c;
  } catch (e) { /* stockage indisponible */ }
  return null;
}
function ecrireCommandeStockee(v) {
  try { window.localStorage.setItem(CLE_COMMANDE, JSON.stringify(v)); }
  catch (e) { /* on continue sans */ }
}
function viderCommandeStockee() {
  try { window.localStorage.removeItem(CLE_COMMANDE); }
  catch (e) { /* rien à faire */ }
}

/* ---- alerte WhatsApp à chaque commande ----
   Passe par CallMeBot, un service gratuit qui n'envoie des messages
   qu'au numéro ayant donné son accord. La clé ne permet donc d'écrire
   qu'à toi : rien de sensible n'est exposé.
   Envoi « au mieux » : si ça échoue, la commande passe quand même. */
function envoyerAlerteWhatsApp(settings, texte) {
  const tel = (settings.alerte_wa_numero || '').replace(/[^\d+]/g, '');
  const cle = (settings.alerte_wa_cle || '').trim();
  if (!tel || !cle) return;
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(tel)}`
    + `&apikey=${encodeURIComponent(cle)}&text=${encodeURIComponent(texteSortant(texte))}`;
  try {
    fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  } catch (e) { /* alerte non bloquante */ }
}

/* ---- photos : réduction avant envoi ----
   Une photo de téléphone pèse 2 à 5 Mo. Affichée dans une vignette de
   300 px, c'est du gâchis pur : le visiteur télécharge 5 Mo pour voir
   un timbre-poste, et le quota Supabase part en fumée.
   On redimensionne donc dans le navigateur avant l'envoi : largeur
   maximale LARGEUR_PHOTO, JPEG qualité QUALITE_PHOTO. Résultat typique :
   60 à 90 Ko, soit 30 à 50 fois moins, sans différence visible à l'écran.
   Tout se passe côté client — aucun outil à installer. */
const LARGEUR_PHOTO = 900;
const QUALITE_PHOTO = 0.78;

function chargerImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image illisible'));
    img.src = src;
  });
}

/* Prend un Blob/File image, rend un Blob JPEG réduit.
   Si quoi que ce soit échoue, on rend le fichier d'origine : mieux vaut
   une photo lourde qu'aucune photo. */
async function reduireImage(fichier, largeurMax = LARGEUR_PHOTO, qualite = QUALITE_PHOTO) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await chargerImage(url);
    const l = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!l || !h) return fichier;
    const ratio = Math.min(1, largeurMax / l);
    const nl = Math.max(1, Math.round(l * ratio));
    const nh = Math.max(1, Math.round(h * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = nl; canvas.height = nh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fichier;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, nl, nh); // les PNG transparents deviennent blancs, pas noirs
    ctx.drawImage(img, 0, 0, nl, nh);
    const blob = await new Promise((res) => {
      if (canvas.toBlob) canvas.toBlob((b) => res(b), 'image/jpeg', qualite);
      else res(null);
    });
    if (!blob) return fichier;
    // Une image déjà légère et déjà petite n'a rien à gagner.
    if (blob.size >= fichier.size && ratio === 1) return fichier;
    return blob;
  } catch (e) {
    return fichier;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const poidsLisible = (o) => {
  const n = Number(o) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
};

/* ---- panier conservé entre deux visites ----
   Un rafraîchissement accidentel ne doit pas vider le panier.
   Le contenu est rangé sous la date de vente : il expire de lui-même
   au démarrage de la vente suivante. */
const CLE_PANIER = 'viande-noisy:panier-v1';
function lirePanierStocke(dateVente) {
  try {
    const b = JSON.parse(window.localStorage.getItem(CLE_PANIER) || 'null');
    if (b && b.date === dateVente) return b;
  } catch (e) { /* stockage indisponible */ }
  return null;
}
function ecrirePanierStocke(v) {
  try { window.localStorage.setItem(CLE_PANIER, JSON.stringify(v)); }
  catch (e) { /* navigation privée ou quota : on continue sans sauvegarde */ }
}
function viderPanierStocke() {
  try { window.localStorage.removeItem(CLE_PANIER); }
  catch (e) { /* rien à faire */ }
}

/* ---- variantes (parfums, contenances…) ----
   Stockées en jsonb sur le produit :
   [{ id, nom, prix_patrice, prix_william, poids_moyen }]
   Un champ prix vide = on hérite du prix du produit. */
function variantesDe(p) {
  const v = p && p.variantes;
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; }
  }
  return [];
}
const vide0 = (x) => x === null || x === undefined || x === '';
function prixVariante(p, v, champ) {
  return vide0(v && v[champ]) ? (Number(p[champ]) || 0) : (Number(v[champ]) || 0);
}
function poidsVariante(p, v) {
  return vide0(v && v.poids_moyen) ? (Number(p.poids_moyen) || 0) : (Number(v.poids_moyen) || 0);
}
function sousTotalLigne(p, v, q, champ) {
  return sousTotal(p.mode_vente, q, prixVariante(p, v, champ || 'prix_william'), poidsVariante(p, v));
}
// Retire le poids indicatif en fin de nom — « Ribs de Bœuf (≈2.8kg) »
// devient « Ribs de Bœuf ». Inutile sur la feuille que Patrice remplit,
// puisque c'est justement lui qui pèse.
function sansPoids(nom) {
  return String(nom || '')
    .replace(/\s*\(\s*[≈~]?\s*[\d]+[.,]?[\d]*\s*(kg|g)\s*\)\s*$/i, '')
    .trim();
}

// nom affiché d'une ligne de commande, variante comprise
function nomLigne(l) {
  return l.variante_nom ? `${l.produit_nom} — ${l.variante_nom}` : l.produit_nom;
}

function fmtDateCourt(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
  catch { return d; }
}

// échappement pour injecter du texte dans le HTML d'impression
function esc(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---- impression / PDF ----
   Ouvre une fenêtre propre et déclenche l'impression.
   Le navigateur propose « Enregistrer au format PDF » dans la liste
   des imprimantes — c'est ce qui sert de téléchargement PDF. */
function imprimerDocument(titre, corpsHTML) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const style = `
    @page{size:A4;margin:12mm 13mm}
    *{box-sizing:border-box}
    body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      color:#241E1B;margin:0;font-size:12px;line-height:1.45}

    /* en-tête du document */
    .tete{display:flex;align-items:flex-start;gap:12px;padding-bottom:12px;
      border-bottom:2.5px solid #8A2E2E;margin-bottom:18px}
    .tete .barre{width:5px;align-self:stretch;min-height:38px;background:#8A2E2E;border-radius:3px}
    h1{font-size:20px;margin:0 0 3px;letter-spacing:-.01em}
    .meta{color:#6b625c;font-size:11.5px}
    .meta b{color:#241E1B}

    /* bloc client */
    .bloc{margin-bottom:15px;padding:11px 12px 9px;border:1px solid #E6DED4;
      border-left:4px solid #8A2E2E;border-radius:7px;page-break-inside:avoid;
      background:#FFFDFB}
    .bloc h2{font-size:14.5px;margin:0;color:#8A2E2E;letter-spacing:-.01em}
    .bloc h2.maj{text-transform:uppercase;letter-spacing:.04em;font-size:14px;margin-bottom:8px}
    .bloc .tel{color:#6b625c;font-size:11px;margin:2px 0 8px}

    table{width:100%;border-collapse:collapse}
    /* largeurs déclarées : sans ça, chaque bloc client dimensionne
       ses colonnes d'après son propre contenu et rien ne s'aligne */
    table.pesee,table.totaux,table.liste{table-layout:fixed}
    .l-nom{width:40%}
    .l-tel{width:26%}
    .l-tot{width:20%}
    .l-paye{width:14%}
    .s-nom{width:22%}
    .s-date{width:14%}
    .s-rep{width:64%}
    table.liste td{word-break:break-word}
    table.liste td{padding:8px 7px}
    table.liste .prod{font-size:13px}
    .c-prod{width:47%}
    .c-qte{width:11%}
    .c-poids{width:24%}
    .c-prix{width:18%}
    .n-prod{width:44%}
    .n-det{width:33%}
    .n-tot{width:23%}
    table.notecl{table-layout:fixed}
    .note-client{page-break-inside:avoid;border-left-color:#8A2E2E}
    .t-prod{width:38%}
    .t-det{width:28%}
    .t-moi{width:17%}
    .t-pat{width:17%}
    .prod{word-break:break-word;hyphens:auto}
    .gris{color:#6b625c}
    .ligne-tot td{border-top:1.5px solid #241E1B;border-bottom:none;padding-top:7px}

    /* bilan de tête, première page uniquement */
    .tete.mince{padding-bottom:8px;margin-bottom:12px}
    .tete.mince h1{font-size:16px}
    .tete.mince .barre{min-height:26px;width:4px}
    .tete.mince .meta{font-size:11px}
    .bilan{display:flex;gap:10px;margin-bottom:20px}
    .bilan.final{margin:16px 0 0;page-break-inside:avoid;break-inside:avoid}
    .bilan-c{flex:1;padding:11px 13px;border:1px solid #E6DED4;border-radius:8px;background:#FBF7F2}
    .bilan-c.vert{background:#EAF3EC;border-color:#CFE3D5}
    .bilan-l{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;
      color:#8A7E76;font-weight:700;margin-bottom:3px}
    .bilan-v{display:block;font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}
    .bilan-c.vert .bilan-v{color:#3F8A52}
    th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;
      color:#8A7E76;font-weight:700;border-bottom:1.5px solid #241E1B;padding:0 7px 4px}
    td{padding:6px 7px;border-bottom:1px solid #EDE5DB;vertical-align:middle}
    tbody tr:nth-child(even) td{background:#FBF7F2}
    tbody tr:last-child td{border-bottom:none}
    td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    td.c,th.c{text-align:center}
    .prod{font-weight:600}
    .qte{color:#6b625c;white-space:nowrap}

    /* case à remplir à la main */
    .saisie{display:block;width:100%;max-width:120px;margin:0 auto;height:20px;
      border:1px dashed #B9AB9C;border-radius:4px;background:#fff}

    .tot{font-weight:700}
    .grand{margin-top:14px;padding:10px 12px;border-radius:7px;background:#F6EFE7;
      border:1px solid #E6DED4;display:flex;justify-content:space-between;
      font-size:15px;font-weight:700}
    .rupture td{color:#B3261E}
    .rupture .nom{text-decoration:line-through}
    .note{margin-top:7px;font-style:italic;color:#6b625c;font-size:11px;
      padding-left:9px;border-left:2px solid #E6DED4}
    .pied{margin-top:18px;padding-top:9px;border-top:1px solid #E6DED4;
      color:#8A7E76;font-size:10px;text-align:center}
  `;
  w.document.write(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
     <title>${esc(titre)}</title><style>${style}</style></head>
     <body>${corpsHTML}</body></html>`
  );
  w.document.close();
  // laisse le navigateur peindre la page avant d'ouvrir la boîte d'impression
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* onglet fermé */ } }, 350);
  return true;
}
/* ---- jours fériés français ----
   Calcul local : les fêtes mobiles découlent de Pâques (algorithme de Meeus),
   inutile d'appeler un service extérieur pour ça. */
function paques(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}
function joursFeries(annee) {
  const p = paques(annee);
  const dec = (n) => { const d = new Date(p); d.setDate(p.getDate() + n); return d; };
  const cle = (d) => `${d.getMonth() + 1}-${d.getDate()}`;
  return {
    '1-1': 'Jour de l\'an',
    '5-1': 'Fête du Travail',
    '5-8': 'Victoire 1945',
    '7-14': 'Fête nationale',
    '8-15': 'Assomption',
    '11-1': 'Toussaint',
    '11-11': 'Armistice',
    '12-25': 'Noël',
    [cle(dec(1))]: 'Lundi de Pâques',
    [cle(dec(39))]: 'Ascension',
    [cle(dec(50))]: 'Lundi de Pentecôte',
  };
}
// nom du jour férié, ou null
function nomJourFerie(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  return joursFeries(d.getFullYear())[`${d.getMonth() + 1}-${d.getDate()}`] || null;
}

/* ---- calendrier d'ouverture ----
   Retrait le lendemain de la commande. On n'ouvre donc que les jours
   dont le lendemain est ouvrable : dimanche (retrait lundi) à jeudi
   (retrait vendredi). Vendredi et samedi restent fermés. */
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const HEURE_DIMANCHE = '12:00';

function joursPlusTard(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}
// heure d'ouverture applicable à ce jour-là
function heureOuvertureDu(date, heureDefaut) {
  return date.getDay() === 0 ? HEURE_DIMANCHE : (heureDefaut || '09:00');
}
// peut-on prendre des commandes ce jour-là ?
function jourCommandable(date) {
  const j = date.getDay();
  if (j === 5 || j === 6) return false;              // vendredi, samedi
  if (nomJourFerie(date)) return false;              // férié
  if (nomJourFerie(joursPlusTard(date, 1))) return false; // retrait impossible demain
  return true;
}
function horodatage(date, heure) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const j = String(date.getDate()).padStart(2, '0');
  return new Date(`${a}-${m}-${j}T${heure}:00`).getTime();
}
// prochaine ouverture à partir de maintenant
function prochaineOuverture(now, heureDefaut, heureFermeture) {
  for (let i = 0; i < 14; i += 1) {
    const d = joursPlusTard(new Date(now), i);
    if (!jourCommandable(d)) continue;
    const debut = horodatage(d, heureOuvertureDu(d, heureDefaut));
    const fin = horodatage(d, heureFermeture || '19:30');
    if (i === 0 && now >= fin) continue;   // journée déjà terminée
    if (now < debut) return debut;
    if (now < fin) return now;             // déjà ouvert
  }
  return null;
}
// Une commande passée boutique fermée est rattachée à la prochaine
// journée d'ouverture, jamais à aujourd'hui : sinon elle tomberait dans
// une journée déjà close, voire déjà pesée.
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function infoPrecommande(prochaineAt) {
  if (!prochaineAt) return null;
  const ouv = new Date(prochaineAt);
  const ret = joursPlusTard(ouv, 1); // le retrait suit toujours le jour d'ouverture
  const jour = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const heure = ouv.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  return {
    dateVente: dateStr(ouv),
    ouverture: `${jour(ouv)} à ${heure}`,
    retrait: jour(ret),
  };
}

// « dimanche à 12h00 pour vos commandes du lendemain, lundi »
function texteReouverture(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  const lendemain = JOURS_FR[(d.getDay() + 1) % 7];
  return `Réouverture ${JOURS_FR[d.getDay()]} à ${heure} pour vos commandes du lendemain, ${lendemain}.`;
}

/* ---- DLC ---- */
function aujourdhuiStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// nombre de jours entre aujourd'hui et la DLC (0 = aujourd'hui, négatif = dépassée)
function joursAvantDlc(dlc) {
  if (!dlc) return null;
  const a = new Date(aujourdhuiStr() + 'T00:00:00').getTime();
  const b = new Date(dlc + 'T00:00:00').getTime();
  if (isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
// Le retrait a lieu le lendemain : un produit doit être encore bon
// ce jour-là. Une DLC d'aujourd'hui ne convient donc déjà plus.
function dlcDepassee(p) {
  if (!p || !p.dlc) return false;
  const j = joursAvantDlc(p.dlc);
  return j !== null && j < 1;
}

// Nombre maximum de diapositives. Une seule source de vérité : la
// boutique et le compteur de l'admin lisent la même valeur, donc le
// rang affiché dans l'admin correspond toujours à la réalité.
const MAX_CARROUSEL = 40;

// Un produit n'entre dans le carrousel que s'il est en promo, visible
// en boutique ET pourvu d'une photo — sans image, la diapositive serait
// un rectangle vide. Même règle que côté boutique.
function auCarrousel(p) {
  return !!(p && !p.brouillon && p.promo && p.disponible && !p.rupture && !dlcDepassee(p) && p.photo_url);
}
// remise affichée, pour l'ordre d'apparition
function remiseDe(p) {
  return p && p.prix_barre > 0 ? (1 - p.prix_william / p.prix_barre) : 0;
}

// { classe, texte } pour la pastille DLC, ou null
function infoDlc(dlc) {
  const j = joursAvantDlc(dlc);
  if (j === null) return null;
  if (j < 0) return { classe: 'passe', texte: `DLC dépassée (${fmtDateCourt(dlc)})` };
  if (j === 0) return { classe: 'urgent', texte: `DLC aujourd'hui` };
  if (j === 1) return { classe: 'urgent', texte: `DLC demain (${fmtDateCourt(dlc)})` };
  return { classe: '', texte: `DLC ${fmtDateCourt(dlc)}` };
}
// minuscules sans accents — pour que « boeuf » trouve « bœuf » et « saute » trouve « sauté »
function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* ---- texte qui quitte l'application ----
   Les emoji « modernes » (🥩, 😊, 🎂…) s'écrivent sur quatre octets,
   là où •, ≈, € et les accents en occupent deux ou trois. Certains
   maillons de la chaîne — presse-papier d'un vieux navigateur, passage
   par wa.me, passerelle d'alerte — tronquent ces quatre octets et
   laissent un « ◆ » noir à la place.
   Plutôt que de chercher lequel est fautif, on n'envoie plus que des
   caractères sûrs : les emoji utiles sont remplacés par un équivalent
   ancien qui s'affiche partout, les autres sont simplement retirés.
   L'affichage DANS l'application n'est pas touché — seuls les textes
   copiés ou envoyés passent par ici. */
const EMOJI_SURS = {
  '🥩': '', '🍖': '', '🍗': '', '🥓': '', '🌭': '',
  '😊': '☺', '🙂': '☺',
  '🎂': '', '🎁': '', '🎉': '', '🥂': '',
  '🌙': '☾', '🔥': '', '⚡': '⚡',
  '📝': '✎', '📋': '', '📄': '', '📣': '', '💬': '',
  '🤝': '', '🏷': '', '🛒': '', '💰': '', '📦': '',
  '🥇': '1.', '🥈': '2.', '🥉': '3.',
  '👉': '→', '🔁': '↻', '🕑': '', '🕒': '',
  '🟢': '', '🔴': '', '📷': '', '🇫': '', '🇷': '',
};
function texteSortant(t) {
  let x = String(t === null || t === undefined ? '' : t);
  Object.keys(EMOJI_SURS).forEach((k) => { x = x.split(k).join(EMOJI_SURS[k]); });
  // tout ce qui reste hors du jeu de caractères sûr est retiré,
  // y compris les sélecteurs de variante laissés orphelins
  x = x.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/[\uFE0F\uFE0E]/g, '');
  // les retraits laissent des espaces en trop
  return x.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+/gm, '').trim();
}

async function copier(texte) {
  const t = texteSortant(texte);
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}

/* ============================================================
   STYLES
============================================================ */
const CSS = `
/* Les polices sont chargées par public/index.html. */
:root{
  --paper:#FBF7F2; --card:#FFFFFF; --ink:#241E1B; --muted:#8A7E76;
  --line:#EBE2D7; --wine:#8A2E2E; --wine-d:#6E2222; --amber:#E0A23C;
  --green:#3F8A52; --green-s:#EAF3EC; --red-s:#FBEDED;
  --radius:16px; --shadow:0 1px 2px rgba(36,30,27,.06),0 6px 18px rgba(36,30,27,.06);
  --blanc:#FFFFFF; --voile:rgba(251,247,242,.92);
}
/* Mode sombre : on ne repeint pas la charte, on retourne ses valeurs.
   Le bordeaux est éclairci pour rester lisible sur fond foncé. */
[data-theme="sombre"]{
  --paper:#16130F; --card:#221D18; --ink:#F2EBE3; --muted:#A2958A;
  --line:#352D25; --wine:#D96A6A; --wine-d:#C25A5A; --amber:#E8B45C;
  --green:#6FBF83; --green-s:#1D2A20; --red-s:#2E1D1D;
  --blanc:#221D18; --voile:rgba(22,19,15,.92);
  --shadow:0 1px 2px rgba(0,0,0,.4),0 6px 18px rgba(0,0,0,.34);
}
[data-theme="sombre"] .vp-app{background:var(--paper)}
[data-theme="sombre"] .vp-photo,[data-theme="sombre"] .vp-hero img{filter:brightness(.94)}
[data-theme="sombre"] .vp-add,[data-theme="sombre"] .vp-cta,
[data-theme="sombre"] .vp-btn:not(.ghost),[data-theme="sombre"] .vp-bar{color:#1A1512}
[data-theme="sombre"] .vp-initiale,[data-theme="sombre"] .vp-photo-loupe{color:#1A1512}
[data-theme="sombre"] .vp-note,[data-theme="sombre"] .vp-avert{
  background:#2A2115;border-color:#4A3A22;color:#E8CFA0}
[data-theme="sombre"] .vp-toast{background:#3A322A}
*{box-sizing:border-box}
/* clip et non hidden : « overflow-x:hidden » sur html/body neutralise
   le position:sticky de tous les descendants. */
html,body{overflow-x:clip;max-width:100%}
body{margin:0;background:var(--paper);color:var(--ink);transition:background .2s ease;
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;}
.vp-app{max-width:600px;margin:0 auto;padding:0 14px 120px;position:relative;
  background:radial-gradient(1200px 400px at 50% -80px,#FFF6E9 0%,var(--paper) 62%)}
.vp-app.vp-avec-panier{padding-bottom:140px}
/* la pastille WhatsApp flotte au-dessus du contenu : on réserve
   de quoi faire défiler le dernier produit au-dessus d'elle */
.vp-app.vp-avec-wa{padding-bottom:150px}
.vp-app.vp-avec-panier.vp-avec-wa{padding-bottom:172px}
.vp-admin-icon{position:absolute;top:56px;right:14px;width:38px;height:38px;border-radius:11px;
  background:#fff;border:1px solid var(--line);color:var(--muted);display:grid;place-items:center;
  box-shadow:var(--shadow);z-index:10}
.vp-admin-icon:active{transform:scale(.94);color:var(--wine)}
.vp-admin{max-width:760px;}
h1,h2,h3{font-family:'Bricolage Grotesque','Inter',sans-serif;margin:0;letter-spacing:-.01em;}
button{font-family:inherit;cursor:pointer;border:none}
input,select,textarea{font-family:inherit;font-size:16px}

/* header */
/* mini en-tête collant : le compte à rebours ne quitte jamais l'écran */
.vp-mini{position:sticky;top:0;z-index:20;display:flex;align-items:center;
  justify-content:space-between;gap:12px;margin:0 -14px;padding:11px 16px;
  background:var(--voile);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--line)}
.vp-mini-m{font-family:'Bricolage Grotesque','Inter',sans-serif;font-weight:800;font-size:15px;
  min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vp-mini-c{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;
  font-size:12px;font-weight:700;white-space:nowrap}
.vp-mini-c.ouv{color:var(--green)}
.vp-mini-c.fer{color:var(--wine)}

.vp-head{padding:60px 4px 14px;text-align:center;display:flex;flex-direction:column;align-items:center}
.vp-logo{width:84px;height:auto;margin-bottom:10px}
.vp-title{font-size:30px;font-weight:800;line-height:1.05;margin-top:4px}
.vp-status{display:inline-flex;align-items:center;gap:7px;margin-top:14px;padding:8px 14px;
  border-radius:999px;font-size:13px;font-weight:600}
.vp-open{background:var(--green-s);color:var(--green)}
.vp-closed{background:var(--red-s);color:var(--wine)}
.vp-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.vp-note{margin-top:14px;background:#FFF8EC;border:1px solid #F1DFBC;color:#7A5A20;
  padding:11px 14px;border-radius:12px;font-size:13.5px;line-height:1.5;text-align:center;width:100%}

/* catégorie + produit */
.vp-cat{display:flex;align-items:center;gap:12px;font-size:13px;font-weight:800;
  letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:24px 4px 10px}
.vp-cat::after{content:'';flex:1;height:1px;
  background:linear-gradient(to right,var(--line),transparent)}
.vp-prod{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
  padding:14px;display:flex;gap:13px;align-items:center;margin-bottom:10px;box-shadow:var(--shadow)}
.vp-emoji{font-size:36px;line-height:1;width:72px;height:72px;display:grid;place-items:center;
  background:var(--paper);border-radius:14px;flex:0 0 auto}
.vp-photo-wrap{position:relative;flex:0 0 auto;padding:0;background:none;border:none;
  border-radius:14px;line-height:0;cursor:zoom-in}
.vp-photo{width:72px;height:72px;border-radius:14px;object-fit:cover;display:block;border:1px solid var(--line)}
.vp-photo-loupe{position:absolute;right:-4px;bottom:-4px;width:21px;height:21px;border-radius:50%;
  background:var(--wine);color:#fff;display:grid;place-items:center;
  border:2px solid var(--card);box-shadow:0 1px 4px rgba(36,30,27,.28)}
.vp-photo-wrap:active .vp-photo{transform:scale(.95);transition:transform .1s ease}
@media (hover:hover) and (pointer:fine){
  .vp-photo-wrap:hover .vp-photo{transform:scale(1.06);transition:transform .15s ease}
}

/* visionneuse plein écran, mobile et ordinateur */
.vp-visionneuse{position:fixed;inset:0;z-index:60;background:rgba(20,16,14,.93);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  padding:22px;cursor:zoom-out;animation:vpfade .16s ease}
.vp-visionneuse img{max-width:min(94vw,720px);max-height:78vh;width:auto;height:auto;
  border-radius:14px;object-fit:contain;box-shadow:0 18px 50px rgba(0,0,0,.5);cursor:default}
.vp-visionneuse-nom{color:#fff;font-size:15px;font-weight:700;text-align:center;
  max-width:90vw;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.vp-visionneuse-x{position:absolute;top:16px;right:16px;width:42px;height:42px;border-radius:50%;
  background:rgba(255,255,255,.16);color:#fff;font-size:26px;line-height:1;
  display:grid;place-items:center;backdrop-filter:blur(4px)}
.vp-visionneuse-x:active{background:rgba(255,255,255,.3)}
@media (prefers-reduced-motion:reduce){.vp-visionneuse{animation:none}}

/* ===== ALERTE DOUBLON DE COMMANDE ===== */
.vp-doublon{position:fixed;inset:0;z-index:70;background:rgba(36,30,27,.55);
  display:flex;align-items:center;justify-content:center;padding:18px;
  animation:vpfade .16s ease;overflow-y:auto}
.vp-doublon-boite{background:var(--card);border-radius:18px;max-width:430px;width:100%;
  padding:22px;box-shadow:0 22px 60px rgba(36,30,27,.4);border:1px solid var(--line);
  max-height:calc(100vh - 36px);overflow-y:auto}
.vp-doublon-tete{display:flex;gap:12px;align-items:flex-start}
.vp-doublon-ico{font-size:30px;line-height:1;flex:0 0 auto}
.vp-doublon-boite h3{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:19px;
  line-height:1.25;margin:0}
.vp-doublon-txt{color:var(--muted);font-size:14px;line-height:1.6;margin-top:10px}
.vp-doublon-cmd{margin-top:14px;padding:12px 14px;border-radius:12px;
  background:var(--bg);border:1px solid var(--line);font-size:13.5px;line-height:1.65}
.vp-doublon-cmd b{font-size:14px}
.vp-doublon-cmd ul{margin:6px 0 0;padding-left:18px}
.vp-doublon-cmd .tot{margin-top:7px;font-weight:700}
.vp-doublon-b{display:flex;flex-direction:column;gap:9px;margin-top:18px}
.vp-doublon-b button{width:100%}
@media (prefers-reduced-motion:reduce){.vp-doublon{animation:none}}
.vp-pinfo{flex:1;min-width:0}
.vp-pname{font-weight:700;font-size:16px}
.vp-pmeta{color:var(--muted);font-size:13px;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap}
.vp-tag{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-size:11.5px}
.vp-price{font-weight:800;color:var(--wine);white-space:nowrap}

/* stepper */
.vp-step{display:flex;align-items:center;gap:0;flex:0 0 auto}
.vp-step button:not(.vp-add){width:34px;height:34px;border-radius:9px;background:var(--paper);
  border:1px solid var(--line);font-size:19px;font-weight:700;color:var(--wine);
  display:grid;place-items:center}
.vp-step button:not(.vp-add):active{transform:scale(.94)}
.vp-qty{min-width:46px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums}
.vp-add{background:var(--wine);color:#fff;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px;white-space:nowrap}
.vp-add:active{background:var(--wine-d)}
.vp-unavail{color:var(--muted);font-size:13px;font-style:italic}

/* ticket / panier */
.vp-ticket{position:relative;background:#fffdfa;border:1px solid var(--line);border-radius:var(--radius);
  padding:18px;margin-top:24px;box-shadow:var(--shadow)}
.vp-ticket:before{content:'';position:absolute;left:14px;right:14px;top:0;height:0;
  border-top:2px dashed var(--line)}
.vp-th{font-weight:800;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}
.vp-line{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dotted var(--line);font-size:14.5px}
.vp-line .l{color:var(--ink)}
.vp-line .l small{color:var(--muted);display:block;font-size:12px}
.vp-line .r{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.vp-tot{display:flex;justify-content:space-between;margin-top:14px;font-size:18px;font-weight:800}
.vp-tot .r{color:var(--wine);font-variant-numeric:tabular-nums}
.vp-mini{color:var(--muted);font-size:12px;margin-top:6px;line-height:1.5}
.vp-trash{background:none;color:var(--muted);font-size:13px;text-decoration:underline;padding:0;margin-top:2px}

/* form */
.vp-field{margin-top:12px}
.vp-label{font-size:13px;font-weight:600;color:var(--muted);margin-bottom:5px;display:block}
.vp-input{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:11px;background:var(--blanc);color:var(--ink)}
.vp-input:focus{outline:none;border-color:var(--wine)}
textarea.vp-input{resize:vertical;min-height:64px}
.vp-cta{width:100%;background:var(--wine);color:#fff;font-weight:800;font-size:16px;
  padding:15px;border-radius:13px;margin-top:18px}
.vp-cta:disabled{opacity:.45}
.vp-cta:active:not(:disabled){background:var(--wine-d)}

/* confirmation */
.vp-confirm{text-align:center;padding:50px 16px}
.vp-check{width:66px;height:66px;border-radius:50%;background:var(--green-s);color:var(--green);
  display:grid;place-items:center;font-size:34px;margin:0 auto 18px}

/* footer admin link */
.vp-foot{text-align:center;margin-top:36px}
.vp-foot button{background:none;color:var(--muted);font-size:12px;text-decoration:underline}

/* ===== ADMIN ===== */
/* navigation catégorie — desktop : pills, mobile : select */
.vp-cat-nav{position:sticky;top:44px;background:var(--paper);z-index:5;
  padding:2px 0 0;border-bottom:1px solid var(--line)}
.vp-cat-select{width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:12px;
  background:var(--blanc);color:var(--ink);font-size:15px;font-weight:600;font-family:inherit;
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238A7E76' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center}
.vp-cat-select:focus{outline:none;border-color:var(--wine)}
/* pills — jamais de défilement horizontal : une pastille hors écran
   est introuvable, elles passent donc simplement à la ligne. */
.vp-tabs{display:flex;flex-wrap:wrap;gap:7px;row-gap:7px;
  padding:14px 0 10px;justify-content:flex-start}
/* barre de catégories de la boutique : centrée, les lignes s'équilibrent */
.vp-cat-nav .vp-tabs{justify-content:center;padding:12px 0 11px}
.vp-tab-ico{margin-right:6px;font-size:15px;line-height:1;vertical-align:-0.06em}
.vp-cat-ico{margin-right:7px;font-size:15px;vertical-align:-0.06em}
.vp-tab.tout{font-weight:700}
/* …sauf le sélecteur de catégorie client, remplacé par un menu natif sur mobile */
.vp-cat-nav .vp-tabs{display:none}
@media (min-width:520px){
  .vp-cat-nav .vp-cat-select{display:none}
  .vp-cat-nav .vp-tabs{display:flex}
}
/* navigation principale de l'admin : toujours à portée de pouce */
.vp-nav{position:sticky;top:0;z-index:6;background:var(--paper);
  padding-top:12px;margin-bottom:4px;box-shadow:0 6px 10px -8px rgba(36,30,27,.25)}

/* Sur écran étroit, les onglets s'étirent pour remplir chaque ligne. */
@media (max-width:620px){
  .vp-tabs .vp-tab{flex:1 1 auto;text-align:center;padding:9px 11px;font-size:13.5px}
  .vp-nav{padding-bottom:10px}
}
.vp-tab{white-space:nowrap;padding:8px 14px;border-radius:999px;font-weight:600;font-size:13.5px;
  background:var(--blanc);border:1px solid var(--line);color:#6F635B;
  transition:background .14s ease,color .14s ease,border-color .14s ease}
.vp-tab:hover{border-color:#DCCFC0;color:var(--ink)}
.vp-tab.on{background:var(--wine);color:#fff;border-color:var(--wine);
  box-shadow:0 2px 8px rgba(138,46,46,.22)}
.vp-tab.on .vp-tab-ico{filter:brightness(1.12)}
@media (prefers-reduced-motion:reduce){.vp-tab{transition:none}}
.vp-section{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
  padding:16px;margin-bottom:14px;box-shadow:var(--shadow)}
.vp-srow{display:flex;justify-content:space-between;align-items:center;gap:12px}
.vp-h2{font-size:19px;font-weight:800}
.vp-sub{color:var(--muted);font-size:13px;margin-top:2px}
.vp-btn{background:var(--wine);color:#fff;border-radius:10px;padding:10px 14px;font-weight:700;font-size:14px}
.vp-btn.ghost{background:#fff;border:1px solid var(--line);color:var(--ink)}
.vp-btn.green{background:var(--green)}
.vp-btn.sm{padding:7px 11px;font-size:13px}
.vp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.vp-pill{display:inline-block;background:var(--paper);border:1px solid var(--line);
  border-radius:7px;padding:2px 8px;font-size:12px;color:var(--muted)}
.vp-marge{font-size:13px;color:var(--green);font-weight:700}
.vp-cmd{border:1px solid var(--line);border-radius:12px;padding:13px;margin-bottom:10px;background:var(--blanc)}
.vp-cmd-head{display:flex;justify-content:space-between;align-items:baseline}
.vp-cmd-name{font-weight:800;font-size:15px}
.vp-cmd-time{color:var(--muted);font-size:12px}
.vp-cmd-l{display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;color:var(--ink)}
.vp-toggle{position:relative;width:48px;height:28px;border-radius:999px;background:var(--line);transition:.2s}
.vp-toggle.on{background:var(--green)}
.vp-toggle:after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;
  background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.vp-toggle.on:after{left:23px}
.vp-empty{text-align:center;color:var(--muted);padding:32px 12px;font-size:14px}
.vp-pre{background:var(--paper);border:1px solid var(--line);border-radius:11px;padding:13px;
  font-size:13px;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;line-height:1.55;max-height:340px;overflow:auto}
.vp-wline{display:grid;grid-template-columns:1fr 92px;gap:10px;align-items:center;
  padding:9px 0;border-bottom:1px dotted var(--line)}
.vp-wline .nm{font-size:14px}
.vp-wline .nm small{display:block;color:var(--muted);font-size:12px}
.vp-winput{width:100%;padding:9px;border:1px solid var(--line);border-radius:9px;text-align:right;font-variant-numeric:tabular-nums}
.vp-gate{max-width:340px;margin:80px auto;text-align:center}
.vp-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));
  transform:translateX(-50%);background:var(--ink);color:#fff;max-width:calc(100% - 28px);
  padding:12px 18px;border-radius:12px;font-size:14px;z-index:50;text-align:center;
  box-shadow:0 8px 24px rgba(0,0,0,.25);animation:vptoast .2s ease-out}
@keyframes vptoast{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
@media (prefers-reduced-motion:reduce){.vp-toast{animation:none}}

.vp-col.attente{background:#FFF8EC;border-color:#F0DCBB}
[data-theme="sombre"] .vp-col.attente{background:#2A2318;border-color:#4A3A22}
.vp-col.attente .vp-col-dot{background:var(--amber)}
.vp-col-aide{font-size:12px;color:var(--muted);line-height:1.5;margin:-4px 0 10px}
.vp-attente-pied{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin:-6px 0 12px;padding:7px 11px;border-radius:0 0 11px 11px;
  background:rgba(224,162,60,.12);font-size:12px;color:var(--muted)}
.vp-attente-pied .pret{color:var(--green);font-weight:700}

/* deux colonnes produits : en vente / désactivés */
.vp-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
.vp-col-head{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800;
  letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:6px 2px 10px}
.vp-col-count{background:var(--paper);border:1px solid var(--line);border-radius:999px;
  padding:1px 8px;font-size:11.5px;letter-spacing:0;font-weight:700}
.vp-col-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex:0 0 auto}
.vp-col.off .vp-col-dot{background:var(--line)}
.vp-col.off .vp-cmd{background:#FCFAF7;opacity:.72}
.vp-col.off .vp-cmd:hover{opacity:1}
.vp-col-empty{text-align:center;color:var(--muted);font-size:13px;padding:18px 10px;
  border:1px dashed var(--line);border-radius:12px}
@media (max-width:600px){.vp-cols{grid-template-columns:1fr;gap:6px}}

/* champ masqué avec œil d'affichage */
.vp-mdp{position:relative}
.vp-mdp .vp-input{padding-right:46px}
.vp-oeil{position:absolute;right:6px;top:50%;transform:translateY(-50%);
  width:36px;height:36px;border-radius:9px;background:none;color:var(--muted);
  display:grid;place-items:center}
.vp-oeil:active{color:var(--wine);background:var(--paper)}

/* pied de page */
.vp-pied{margin-top:34px;padding-top:16px;border-top:1px solid var(--line);text-align:center}
.vp-credit{color:var(--muted);font-size:12.5px}
.vp-credit a{color:var(--wine);font-weight:700;text-decoration:none;
  border-bottom:1px solid rgba(138,46,46,.3);padding-bottom:1px}
.vp-credit a:hover{border-bottom-color:var(--wine)}
.vp-ver{text-align:center;color:var(--muted);font-size:11px;opacity:.55;margin-top:7px}

/* ===== PANIER FLOTTANT (client) ===== */
.vp-backdrop{position:fixed;inset:0;background:rgba(36,30,27,.38);z-index:39;
  animation:vpfade .18s ease}
@keyframes vpfade{from{opacity:0}to{opacity:1}}

.vp-dock{position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:40;
  width:100%;max-width:600px;padding:0 14px;
  padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));pointer-events:none}
.vp-dock > *{pointer-events:auto}

.vp-bar{width:100%;background:var(--wine);color:#fff;border-radius:15px;
  padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;
  box-shadow:0 10px 30px rgba(36,30,27,.3);
  animation:vppulse .42s cubic-bezier(.34,1.56,.64,1)}
@keyframes vppulse{
  0%{transform:scale(1)}
  38%{transform:scale(1.05);box-shadow:0 14px 36px rgba(138,46,46,.45)}
  100%{transform:scale(1)}
}
@media (prefers-reduced-motion:reduce){.vp-bar{animation:none}}
.vp-bar:active{background:var(--wine-d)}
.vp-bar-l{display:flex;align-items:center;gap:11px;min-width:0}
.vp-bar-ico{position:relative;font-size:23px;line-height:1;flex:0 0 auto}
.vp-bar-badge{position:absolute;top:-7px;right:-11px;min-width:22px;height:22px;padding:0 6px;
  border-radius:999px;background:#fff;color:var(--wine);font-size:12.5px;font-weight:800;
  display:grid;place-items:center;font-family:'Inter',sans-serif;
  box-shadow:0 1px 4px rgba(36,30,27,.3)}
.vp-bar-txt{display:flex;flex-direction:column;line-height:1.25;text-align:left;min-width:0}
.vp-bar-txt b{font-size:15px;font-weight:800}
.vp-bar-txt small{font-size:12px;opacity:.82}
.vp-bar-r{display:flex;align-items:center;gap:7px;font-size:17px;font-weight:800;
  font-variant-numeric:tabular-nums;white-space:nowrap}
.vp-bar-chev{transition:transform .2s ease;transform:rotate(180deg)}
.vp-bar-chev.on{transform:rotate(0deg)}

.vp-sheet{background:var(--card);border:1px solid var(--line);border-radius:17px;
  padding:16px;margin-bottom:10px;max-height:72vh;overflow-y:auto;
  -webkit-overflow-scrolling:touch;box-shadow:0 -4px 40px rgba(36,30,27,.22);
  animation:vpup .22s cubic-bezier(.22,1,.36,1)}
@keyframes vpup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.vp-sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.vp-sheet-x{width:32px;height:32px;border-radius:10px;background:var(--paper);
  border:1px solid var(--line);color:var(--muted);font-size:19px;line-height:1;
  display:grid;place-items:center;flex:0 0 auto}
.vp-sheet-x:active{background:var(--line)}
.vp-sline{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;
  padding:9px 0;border-bottom:1px dotted var(--line);font-size:14.5px}
.vp-sline .l{min-width:0}
.vp-sline .l small{color:var(--muted);display:block;font-size:12px}
.vp-sline .r{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;min-width:64px;text-align:right}
.vp-sline .vp-step button{width:30px;height:30px;font-size:17px}
.vp-sline .vp-qty{min-width:34px;font-size:14px}
@media (max-width:380px){
  .vp-sline{grid-template-columns:1fr auto;row-gap:6px}
  .vp-sline .r{grid-column:2;text-align:right}
  .vp-sline .vp-step{grid-column:1/-1;justify-content:flex-start}
}
@media (prefers-reduced-motion:reduce){
  .vp-sheet,.vp-backdrop{animation:none}
  .vp-bar-chev{transition:none}
}

/* avertissement estimation (panier client) */
.vp-avert{margin-top:12px;background:#FFF8EC;border:1px solid #F1DFBC;color:#7A5A20;
  border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.55}
.vp-avert b{display:inline}
.vp-avert b:first-child{display:block;margin-bottom:4px;font-size:13.5px}

/* liste d'étapes numérotées (réglages) */
.vp-etapes{margin:12px 0 0;padding-left:20px;font-size:13.5px;line-height:1.6;color:var(--ink)}
.vp-etapes li{margin-bottom:9px}
.vp-etapes li::marker{color:var(--wine);font-weight:800}

/* menu déroulant rapide sur la carte produit (catégorie) */
.vp-quick-select{flex:1;min-width:0;padding:7px 28px 7px 9px;border:1px solid var(--line);
  border-radius:9px;background:#fff;color:var(--ink);font-family:inherit;font-size:14px;
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A7E76' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 9px center}
.vp-quick-select:focus{outline:none;border-color:var(--wine)}

/* bandeau « ta commande est enregistrée » */
.vp-macmd{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  margin-top:16px;background:var(--green-s);border:1px solid #CFE3D5;border-radius:14px;padding:13px 15px}
.vp-macmd.fermee{background:var(--paper);border-color:var(--line)}
.vp-macmd b{display:block;font-size:14.5px;color:var(--ink)}
.vp-macmd small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px;line-height:1.45}
.vp-macmd-b{display:flex;gap:8px;flex:0 0 auto}

/* pastille WhatsApp flottante */
.vp-fab-zone{position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:38;
  width:100%;max-width:600px;padding:0 14px;
  padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));
  display:flex;justify-content:flex-end;pointer-events:none;
  transition:padding-bottom .22s ease}
.vp-fab-zone.haut{padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))}
.vp-wa-fab{pointer-events:auto;width:52px;height:52px;border-radius:50%;background:#25D366;
  color:#fff;display:grid;place-items:center;text-decoration:none;
  box-shadow:0 6px 18px rgba(37,211,102,.4),0 2px 6px rgba(36,30,27,.2)}
.vp-wa-fab:active{background:#1EBE5B;transform:scale(.93)}
@media (prefers-reduced-motion:reduce){.vp-fab-zone{transition:none}}

/* bouton WhatsApp */
.vp-wa{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;
  background:#25D366;color:#fff;border-radius:12px;padding:11px 16px;font-weight:700;
  font-size:14.5px;text-decoration:none;box-shadow:0 2px 8px rgba(37,211,102,.28)}
.vp-wa:active{background:#1EBE5B}
.vp-wa svg{flex:0 0 auto}

/* origine française */
.vp-flag{margin-right:5px;vertical-align:-0.12em;flex:0 0 auto;
  border-radius:2px;display:inline-block}
.vp-fr-btn{flex:0 0 auto;width:36px;height:30px;border-radius:8px;background:var(--paper);
  border:1px solid var(--line);display:grid;place-items:center;
  filter:grayscale(1);opacity:.45}
.vp-fr-btn .vp-flag{margin:0}
.vp-fr-btn.on{filter:none;opacity:1;background:#fff;border-color:var(--wine)}
.vp-fr-btn:active{transform:scale(.94)}
.vp-fr-case{display:flex;gap:11px;align-items:flex-start;margin-top:12px;padding:12px;
  border:1px solid var(--line);border-radius:12px;background:#fff;cursor:pointer}
.vp-fr-case.on{background:#F4F7FC;border-color:#CBD8EC}
.vp-fr-case input{width:20px;height:20px;flex:0 0 auto;margin:1px 0 0;accent-color:var(--wine)}
.vp-fr-case small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px;line-height:1.45}

/* rupture */
.vp-rupt-pill{background:#FBEDED;border:1px solid #F0CFCF;color:#B3261E;border-radius:6px;
  padding:1px 7px;font-size:11px;font-weight:800;letter-spacing:.04em}
.vp-rupt-btn{flex:0 0 auto;padding:6px 10px;border-radius:8px;background:var(--paper);
  border:1px solid var(--line);color:var(--muted);font-size:12px;font-weight:700}
.vp-rupt-btn.on{background:#FBEDED;border-color:#F0CFCF;color:#B3261E}
.vp-rupt-case{display:flex;gap:11px;align-items:flex-start;margin-top:12px;padding:12px;
  border:1px solid var(--line);border-radius:12px;background:#fff;cursor:pointer}
.vp-rupt-case.on{background:#FBEDED;border-color:#F0CFCF}
.vp-rupt-case input{width:20px;height:20px;flex:0 0 auto;margin:1px 0 0;accent-color:#B3261E}
.vp-rupt-case small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px;line-height:1.45}
.vp-rupt-note{margin-top:10px;background:#FBEDED;border:1px solid #F0CFCF;color:#B3261E;
  border-radius:10px;padding:9px 12px;font-size:13px;font-weight:600}
.vp-wline.rupt{opacity:.75}
.vp-wline.rupt .nm small{color:#B3261E;font-weight:700}
.vp-barre{text-decoration:line-through}

/* doublons */
.vp-doublon{margin-top:10px;background:#FFF8EC;border:1px solid #F1DFBC;color:#7A5A20;
  border-radius:12px;padding:11px 13px;font-size:13px}
.vp-doublon-l{display:flex;justify-content:space-between;align-items:center;gap:10px;
  margin-top:8px;padding-top:8px;border-top:1px dotted #F1DFBC}
.vp-doublon-l > span{min-width:0}

/* bouton « copier ≈ » */
.vp-approx{flex:0 0 auto;padding:4px 10px;border-radius:7px;background:var(--paper);
  border:1px solid var(--line);color:var(--muted);font-size:12px;font-weight:700}
.vp-approx:active{background:var(--line);color:var(--wine)}

/* bascule de vue (pesées) */
.vp-vue{display:flex;gap:6px;margin-top:12px}

/* pastille DLC */
.vp-dlc{display:inline-flex;align-items:center;gap:4px;background:#FFF8EC;border:1px solid #F1DFBC;
  color:#7A5A20;border-radius:6px;padding:1px 7px;font-size:11.5px;font-weight:700;white-space:nowrap}
.vp-dlc.urgent{background:var(--red-s);border-color:#F0CFCF;color:var(--wine)}
.vp-dlc.passe{background:var(--paper);border-color:var(--line);color:var(--muted);text-decoration:line-through}
.vp-dlc-edit{display:flex;align-items:center;gap:8px;margin-top:9px;
  padding-top:9px;border-top:1px dotted var(--line)}
.vp-dlc-edit label{font-size:12px;font-weight:700;color:var(--muted);flex:0 0 auto}
.vp-dlc-input{flex:1;min-width:0;padding:7px 9px;border:1px solid var(--line);border-radius:9px;
  background:#fff;color:var(--ink);font-family:inherit;font-size:14px}
.vp-dlc-input:focus{outline:none;border-color:var(--wine)}
.vp-dlc-x{width:28px;height:28px;flex:0 0 auto;border-radius:8px;background:var(--paper);
  border:1px solid var(--line);color:var(--muted);font-size:14px;display:grid;place-items:center}

/* sélecteur d'icône */
.vp-emoji-bar{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.vp-emoji-cur{width:46px;height:46px;flex:0 0 auto;border-radius:12px;background:var(--paper);
  border:1px solid var(--line);display:grid;place-items:center;font-size:26px;line-height:1}
.vp-emoji-box{max-height:230px;overflow-y:auto;border:1px solid var(--line);border-radius:12px;
  padding:10px;background:#fff;-webkit-overflow-scrolling:touch}
.vp-emoji-grp{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--muted);margin:8px 2px 6px}
.vp-emoji-box > div:first-child .vp-emoji-grp{margin-top:0}
.vp-emoji-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:6px}
.vp-emoji-btn{height:42px;border-radius:10px;background:var(--paper);border:1px solid var(--line);
  font-size:22px;line-height:1;display:grid;place-items:center}
.vp-emoji-btn:active{transform:scale(.92)}
.vp-emoji-btn.on{background:#fff;border-color:var(--wine);box-shadow:0 0 0 2px rgba(138,46,46,.25)}

/* variantes — sélecteur client */
.vp-variante{margin-top:6px;width:100%;max-width:230px;padding:7px 30px 7px 10px;
  border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink);
  font-family:inherit;font-size:14px;font-weight:600;appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238A2E2E' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 10px center}
.vp-variante:focus{outline:none;border-color:var(--wine)}

/* variantes — éditeur admin */
.vp-varbox{margin-top:18px;padding:14px;border:1px dashed var(--line);border-radius:13px;background:var(--paper)}
.vp-var{background:#fff;border:1px solid var(--line);border-radius:11px;padding:11px;margin-top:10px}
.vp-var-tools{display:flex;gap:5px;flex:0 0 auto}
.vp-var-btn{width:32px;height:32px;border-radius:8px;background:var(--paper);border:1px solid var(--line);
  color:var(--muted);font-size:15px;font-weight:700;display:grid;place-items:center}
.vp-var-btn:disabled{opacity:.35}
.vp-var-btn.del{color:var(--wine)}
.vp-var-btn:active:not(:disabled){transform:scale(.94)}

/* réponses au questionnaire (admin) */
.vp-rep{border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-bottom:9px;background:#fff}
.vp-rep-t{margin:6px 0 4px;font-size:14px;line-height:1.55;white-space:pre-wrap}

/* saisie d'une commande par l'organisateur */
.vp-saisie-ouvrir{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  margin-bottom:14px;padding:13px;border-radius:13px;background:var(--blanc);
  border:1.5px dashed var(--wine);color:var(--wine);font-weight:800;font-size:14.5px}
.vp-saisie-ouvrir span{font-size:18px;line-height:1}
.vp-saisie-ouvrir:active{background:var(--paper)}
.vp-saisie{border-color:var(--wine);box-shadow:0 0 0 1px var(--wine),var(--shadow)}
.vp-saisie-choix{padding:11px 12px;border-radius:11px;background:var(--paper);
  border:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.vp-saisie-q{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vp-saisie-q .vp-input{width:84px;padding:9px 10px}
.vp-seg button:disabled{opacity:.4}

/* ajout d'une ligne depuis les pesées */
.vp-ajout-b{width:100%;margin-top:10px;padding:11px;border-radius:11px;background:var(--blanc);
  border:1.5px dashed var(--wine);color:var(--wine);font-weight:800;font-size:14px}
.vp-ajout-b:active{background:var(--paper)}
.vp-ajout{margin-top:12px;padding:13px;border-radius:12px;background:var(--paper);
  border:1px solid var(--wine)}
.vp-ajout .vp-pl-g{margin-top:10px}
.vp-ajout .vp-pl-g label span{display:block;font-size:11px;font-weight:700;
  letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}

/* carrousel : filtre et rang */
.vp-tab-car{border-style:dashed;border-color:#E0A23C;color:#B07318}
.vp-tab-car.on{background:linear-gradient(135deg,#E0852C,#C2521A);border-color:#A8440F;
  color:#fff;border-style:solid}
.vp-badge-car{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;
  background:#FFF4E0;border:1px solid #E8C98A;color:#8A5A12;font-size:10px;font-weight:800;
  letter-spacing:.04em;vertical-align:0.08em}
.vp-badge-hors{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;
  background:var(--paper);border:1px dashed var(--line);color:var(--muted);font-size:10px;
  font-weight:800;letter-spacing:.04em;vertical-align:0.08em}
[data-theme="sombre"] .vp-badge-car{background:#2A2115;border-color:#4A3A22;color:#E8CFA0}

/* filtre des DLC échues */
.vp-tab-dlc{border-style:dashed;border-color:#F0CFCF;color:#B3261E}
.vp-tab-dlc.on{background:#B3261E;border-color:#B3261E;color:#fff;border-style:solid}

/* quantité partiellement livrée */
.vp-partiel{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;
  background:#FFF4E0;border:1px solid #F0D9AE;color:#8A5A12;font-size:11.5px;font-weight:800}
[data-theme="sombre"] .vp-partiel{background:#2A2115;border-color:#4A3A22;color:#E8CFA0}

/* champs quantité / poids de la saisie */
.vp-saisie-c{display:flex;flex-direction:column;gap:3px}
.vp-saisie-c span{font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
.vp-saisie-c em{font-style:normal;font-size:12px;color:var(--muted)}
.vp-saisie-c .vp-input{width:96px}

/* nom WhatsApp (admin) */
.vp-alias{display:inline-flex;align-items:center;gap:5px;margin:3px 0 1px;padding:1px 8px;
  border-radius:6px;background:#E7F7EE;color:#1E7A45;font-size:12px;font-weight:700}
[data-theme="sombre"] .vp-alias{background:#18301F;color:#7FD39C}

/* alerte messages (admin) */
.vp-alerte-msg{width:100%;display:flex;align-items:center;gap:12px;text-align:left;
  margin-bottom:14px;padding:13px 15px;border-radius:14px;
  background:#F2F6FB;border:1px solid #C9D8EC;color:var(--ink);
  box-shadow:0 2px 10px rgba(60,100,160,.12)}
.vp-alerte-msg b{display:block;font-size:14.5px}
.vp-alerte-msg small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.vp-alerte-ico{font-size:21px;line-height:1;flex:0 0 auto}
[data-theme="sombre"] .vp-alerte-msg{background:#1B2330;border-color:#2C3A50}

/* réponse de l'organisateur (admin) */
.vp-rep.attente{border-left:3px solid #E0A23C}
.vp-rep-admin{margin:8px 0 4px;padding:9px 11px;border-radius:10px;
  background:var(--green-s);border:1px solid #CFE3D5}
.vp-rep-admin-l{display:block;font-size:11.5px;font-weight:700;color:var(--green);margin-bottom:3px}
.vp-rep-admin p{margin:0 0 4px;font-size:14px;line-height:1.5;white-space:pre-wrap}
.vp-rep-form{display:flex;flex-direction:column;gap:7px;margin:8px 0 4px}
.vp-rep-form .vp-btn{align-self:flex-end}

/* fil d'échanges (profil client) */
.vp-fil{margin-top:12px;display:flex;flex-direction:column;gap:6px}
.vp-fil-moi,.vp-fil-lui{max-width:88%;padding:9px 12px;border-radius:14px;font-size:14px;
  line-height:1.5;white-space:pre-wrap}
.vp-fil-moi{align-self:flex-end;background:var(--paper);border:1px solid var(--line);
  border-bottom-right-radius:4px}
.vp-fil-lui{align-self:flex-start;background:var(--green-s);border:1px solid #CFE3D5;
  border-bottom-left-radius:4px}
.vp-fil-d{display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:2px}
.vp-fil-neuf{margin-left:6px;padding:1px 7px;border-radius:999px;background:var(--wine);
  color:#fff;font-size:10px;letter-spacing:.03em}
.vp-fil-attente{align-self:flex-start;font-size:12.5px;color:var(--muted);font-style:italic}

/* pastille de nouvelle réponse sur le bouton de compte */
.vp-initiale{position:relative}
.vp-pastille-neuf{position:absolute;top:-6px;right:-7px;min-width:17px;height:17px;padding:0 4px;
  border-radius:999px;background:#E0852C;color:#fff;font-size:10.5px;font-weight:800;
  display:grid;place-items:center;border:2px solid var(--green-s)}

/* questionnaire client */
.vp-sondage{width:100%;display:flex;align-items:center;gap:12px;text-align:left;
  margin-top:14px;padding:13px 15px;border-radius:14px;
  background:#F2F6FB;border:1px solid #D4E0EF;color:var(--ink)}
.vp-sondage b{display:block;font-size:14.5px}
.vp-sondage small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.vp-sondage-ico{flex:0 0 auto;font-size:20px;line-height:1}
.vp-sondage-fl{margin-left:auto;color:var(--muted);font-size:22px;line-height:1}
.vp-sondage.fait{background:var(--green-s);border-color:#CFE3D5;font-size:13.5px;line-height:1.5}
.vp-sondage.fait .vp-sondage-ico{color:var(--green);font-weight:800}
.vp-sondage.ouvert{display:block;background:#fff;border-color:var(--line);box-shadow:var(--shadow)}
.vp-sondage-q{margin:10px 0;font-size:14px;line-height:1.55;color:var(--ink)}

/* sélecteur de journée de vente (admin) */
.vp-journee{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 13px;
  border:1px solid var(--line);border-radius:12px;background:#fff}
.vp-journee label{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
  color:var(--muted);flex:0 0 auto}
.vp-journee.passee{background:#FFF8EC;border-color:#F1DFBC}
.vp-journee.passee label{color:#7A5A20}

/* promo — commandes admin */
.vp-promo-btn{flex:0 0 auto;width:34px;height:30px;border-radius:8px;background:var(--paper);
  border:1px solid var(--line);font-size:14px;line-height:1;display:grid;place-items:center;
  filter:grayscale(1);opacity:.45}
.vp-promo-btn.on{filter:none;opacity:1;background:#FFF4E0;border-color:#E0A23C}
.vp-promo-btn:active{transform:scale(.94)}
.vp-promo-case{display:flex;gap:11px;align-items:flex-start;margin-top:12px;padding:12px;
  border:1px solid var(--line);border-radius:12px;background:#fff;cursor:pointer}
.vp-promo-case.on{background:#FFF4E0;border-color:#F0D9AE}
.vp-promo-case input{width:20px;height:20px;flex:0 0 auto;margin:1px 0 0;accent-color:#E0852C}
.vp-promo-case small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px;line-height:1.45}

/* liens connexion / inscription */
.vp-auth-liens{position:absolute;top:56px;left:14px;display:flex;gap:7px;z-index:10}
.vp-lien-auth{padding:9px 13px;border-radius:999px;font-size:13px;font-weight:700;
  background:#fff;border:1px solid var(--line);color:var(--ink);box-shadow:var(--shadow);
  white-space:nowrap}
.vp-lien-auth.plein{background:var(--wine);border-color:var(--wine);color:#fff}
.vp-lien-auth:active{transform:scale(.95)}
@media (max-width:380px){.vp-lien-auth{padding:9px 11px;font-size:12.5px}}

/* bascule connexion / inscription */
.vp-seg{display:flex;gap:4px;padding:4px;margin-bottom:6px;border-radius:12px;
  background:var(--paper);border:1px solid var(--line)}
.vp-seg button{flex:1;padding:9px 8px;border-radius:9px;background:transparent;
  color:var(--muted);font-size:13.5px;font-weight:700}
.vp-seg button.on{background:#fff;color:var(--wine);box-shadow:0 1px 3px rgba(36,30,27,.12)}

/* compte client */
.vp-compte-pill{position:absolute;top:56px;left:14px;height:38px;max-width:46%;
  display:flex;align-items:center;gap:8px;padding:0 13px 0 6px;border-radius:999px;
  background:#fff;border:1px solid var(--line);color:var(--muted);
  box-shadow:var(--shadow);z-index:10;font-size:13.5px;font-weight:700}
.vp-compte-pill svg{margin-left:6px;flex:0 0 auto}
.vp-compte-pill.on{border-color:#CFE3D5;background:var(--green-s);color:var(--ink)}
.vp-compte-pill:active{transform:scale(.96)}
.vp-compte-nom{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vp-initiale{width:28px;height:28px;flex:0 0 auto;border-radius:50%;background:var(--wine);color:#fff;
  display:grid;place-items:center;font-size:13.5px;font-weight:800}
.vp-compte-tete{display:flex;justify-content:space-between;gap:10px;padding:18px 0 14px}
.vp-auth{max-height:82vh}
.vp-identite{display:flex;align-items:center;justify-content:space-between;gap:12px;
  margin-top:14px;padding:11px 13px;border-radius:12px;background:var(--paper);border:1px solid var(--line)}
.vp-identite b{display:block;font-size:14.5px}
.vp-identite small{display:block;color:var(--muted);font-size:12.5px;margin-top:1px}

/* vignette générée, pour les produits sans photo */
.vp-tuile-sm{width:36px;height:36px;border-radius:9px}
.vp-tuile-sm .vp-tuile-e{font-size:18px}
.vp-tab-photo{border-style:dashed}
.vp-tab-photo.on{background:var(--ink);color:#fff;border-color:var(--ink);border-style:solid}
.vp-tuile{position:relative;width:72px;height:72px;flex:0 0 auto;border-radius:14px;
  overflow:hidden;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.vp-tuile-f{position:absolute;inset:0;
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.14) 0 9px,transparent 9px 20px)}
.vp-tuile-e{position:relative;font-size:34px;line-height:1;
  filter:drop-shadow(0 1px 3px rgba(0,0,0,.28))}

/* bascule clair / sombre — l'icône seule ne se comprenait pas,
   le mot visé accompagne donc toujours le pictogramme */
.vp-theme{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:30px;
  padding:0 11px 0 9px;border-radius:999px;background:var(--blanc);
  border:1px solid var(--line);color:var(--muted)}
.vp-theme-ico{font-size:13px;line-height:1}
.vp-theme-txt{font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.vp-theme:active{transform:scale(.94)}
@media (max-width:340px){.vp-theme-txt{display:none}.vp-theme{padding:0 9px}}

/* boutique fermée */
.vp-ferme{text-align:center;margin-top:22px;padding:30px 20px;border-radius:16px;
  background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow)}
.vp-ferme-ico{font-size:32px;line-height:1}
.vp-ferme b{display:block;margin-top:10px;font-size:17px}
.vp-ferme small{display:block;margin-top:7px;color:var(--muted);font-size:13.5px;line-height:1.7}
.vp-reouv{display:inline-block;margin-top:8px;color:var(--wine);font-size:14px}
.vp-masque{display:none}

/* dernière ligne droite */
.vp-urgence{display:flex;align-items:center;gap:10px;margin-top:14px;padding:11px 14px;
  border-radius:12px;background:var(--red-s);border:1px solid #F0CFCF;color:var(--wine);
  font-size:14px}
.vp-urgence b{font-weight:800}
.vp-urgence-ico{font-size:18px;line-height:1;animation:vpbat 1.6s ease-in-out infinite}
.vp-mini-c.presse{color:var(--wine)}
@media (prefers-reduced-motion:reduce){.vp-urgence-ico{animation:none}}

/* ajout direct depuis le carrousel */
.vp-car-bas{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:6px}
.vp-car-bas .lp{margin-top:0}
.vp-car-ajout{flex:0 0 auto;padding:10px 16px;border-radius:11px;background:#fff;color:#8A2E2E;
  font-weight:800;font-size:14px;white-space:nowrap;box-shadow:0 3px 12px rgba(0,0,0,.28)}
.vp-car-ajout:active{transform:scale(.95)}
.vp-car-diapo{cursor:pointer}
.vp-car-diapo:focus-visible{outline:3px solid #E0A23C;outline-offset:-3px}

/* fiche désignée depuis le carrousel */
.vp-prod.vp-repere{animation:vprepere 1.8s ease-out}
@keyframes vprepere{
  0%{box-shadow:0 0 0 3px #E0A23C,var(--shadow);border-color:#E0A23C}
  100%{box-shadow:0 0 0 0 rgba(224,162,60,0),var(--shadow);border-color:var(--line)}
}
@media (prefers-reduced-motion:reduce){.vp-prod.vp-repere{animation:none;border-color:#E0A23C}}

/* au-delà de dix promos, un compteur remplace les points */
.vp-car-cpt{margin-top:10px;text-align:center;font-size:12.5px;font-weight:800;
  color:var(--muted);font-variant-numeric:tabular-nums}

/* titre du carrousel */
.vp-car-titre{display:flex;align-items:center;gap:7px;margin:4px 2px 10px;
  font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:22px;font-weight:800;
  letter-spacing:-.02em;line-height:1}
.vp-car-eclair{font-size:20px;animation:vpeclair 2.4s ease-in-out infinite}
.vp-car-mot{background:linear-gradient(135deg,#E0852C 0%,#C2521A 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
[data-theme="sombre"] .vp-car-mot{background:linear-gradient(135deg,#F0B429 0%,#E0852C 100%);
  -webkit-background-clip:text;background-clip:text}
@keyframes vpeclair{0%,86%,100%{opacity:1;transform:scale(1)}90%{opacity:.35;transform:scale(1.18)}}
@media (prefers-reduced-motion:reduce){.vp-car-eclair{animation:none}}

/* carrousel des promos — flèches et points rendent visible ce qui est hors écran */
/* ===== RAYONS PAR CATÉGORIE =====
   Un défilement horizontal de petites cartes, un par catégorie.
   Donne un aperçu de chaque rayon sans noyer la page : avec 500
   produits, une liste verticale complète est inutilisable. */
.vp-rayon{margin-top:26px}
.vp-rayon-sep{margin:30px 2px 4px;padding-top:16px;border-top:1px solid var(--line);
  font-size:12.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  color:var(--muted);text-align:center}
.vp-rayon-t{display:flex;align-items:center;gap:9px;margin:0 2px 11px}
.vp-rayon-ico{font-size:22px;line-height:1;flex:0 0 auto}
.vp-rayon-nom{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:18px;
  font-weight:700;letter-spacing:-.01em;min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.vp-rayon-nb{font-size:12px;font-weight:800;color:var(--muted);flex:0 0 auto}
.vp-rayon-voir{margin-left:auto;flex:0 0 auto;padding:6px 12px;border-radius:999px;
  background:var(--blanc);border:1px solid var(--line);color:var(--wine);
  font-size:12.5px;font-weight:800;white-space:nowrap}
.vp-rayon-voir:active{background:var(--paper);transform:scale(.96)}

.vp-rail{display:flex;gap:11px;overflow-x:auto;scroll-snap-type:x proximity;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px 2px 6px}
.vp-rail::-webkit-scrollbar{display:none}

.vp-rail-c{flex:0 0 150px;scroll-snap-align:start;background:var(--card);
  border:1px solid var(--line);border-radius:14px;overflow:hidden;
  display:flex;flex-direction:column;text-align:left;position:relative}
.vp-rail-c:active{transform:scale(.98)}
.vp-rail-img{width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--paper);
  display:block}
.vp-rail-vide{width:100%;aspect-ratio:1/1;display:grid;place-items:center;
  position:relative;overflow:hidden}
.vp-rail-emoji{font-size:40px;line-height:1;position:relative;z-index:1;
  filter:drop-shadow(0 2px 4px rgba(36,30,27,.18))}
.vp-rail-b{padding:9px 10px 10px;display:flex;flex-direction:column;gap:5px;flex:1}
.vp-rail-nom{font-size:13px;font-weight:700;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vp-rail-prix{font-size:14px;font-weight:800;color:var(--wine);margin-top:auto}
.vp-rail-unite{font-size:11px;font-weight:600;color:var(--muted)}
.vp-rail-plus{position:absolute;top:7px;right:7px;width:31px;height:31px;border-radius:50%;
  background:var(--wine);color:#fff;font-size:19px;line-height:1;display:grid;
  place-items:center;box-shadow:0 2px 8px rgba(36,30,27,.28)}
.vp-rail-plus:active{transform:scale(.9)}
.vp-rail-eti{position:absolute;top:7px;left:7px;padding:2px 7px;border-radius:999px;
  background:var(--wine);color:#fff;font-size:10px;font-weight:800;letter-spacing:.03em}
.vp-rail-eti.neuf{background:var(--green)}

.vp-car{position:relative;margin-top:20px}
.vp-car-piste{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;
  border-radius:20px;box-shadow:0 10px 30px rgba(36,30,27,.16);
  scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.vp-car-piste::-webkit-scrollbar{display:none}
.vp-car-diapo{flex:0 0 100%;scroll-snap-align:start;scroll-snap-stop:always;
  border-radius:0;box-shadow:none}
.vp-car-fl{position:absolute;top:calc(50% + 2px);transform:translateY(-50%);
  width:38px;height:38px;border-radius:50%;z-index:3;
  background:rgba(255,255,255,.9);color:#241E1B;display:grid;place-items:center;
  box-shadow:0 2px 10px rgba(0,0,0,.22);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.vp-car-fl.g{left:10px}
.vp-car-fl.d{right:10px}
.vp-car-fl:active{transform:translateY(-50%) scale(.9)}
/* au-delà d'une dizaine de promos, les points ne suffisent plus à
   se repérer : on affiche aussi le rang en clair */
.vp-car-rang{position:absolute;top:10px;right:10px;z-index:3;padding:3px 10px;
  border-radius:999px;background:rgba(20,16,14,.55);color:#fff;
  font-size:11.5px;font-weight:800;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.vp-car-pts{display:flex;justify-content:center;gap:6px;margin-top:10px;flex-wrap:wrap}
.vp-car-pts button{width:7px;height:7px;padding:0;border-radius:999px;background:var(--line);
  transition:width .2s ease,background .2s ease}
.vp-car-pts button.on{width:20px;background:var(--wine)}
@media (prefers-reduced-motion:reduce){.vp-car-pts button{transition:none}}

/* vitrine des promos : une grande en tête, les suivantes côte à côte */
.vp-vitrine{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
.vp-vitrine .grand{grid-column:1 / -1}
.vp-vitrine.n2 .petit{grid-column:1 / -1}

.vp-hero{position:relative;display:block;width:100%;padding:0;margin:0;
  border:none;border-radius:20px;overflow:hidden;aspect-ratio:2.15/1;
  box-shadow:0 10px 30px rgba(36,30,27,.16);cursor:pointer}
.vp-hero.petit{aspect-ratio:1.15/1;border-radius:16px;box-shadow:0 6px 18px rgba(36,30,27,.14)}
.vp-vitrine.n2 .vp-hero.petit{aspect-ratio:2.15/1}
.vp-hero.petit .txt{padding:11px 12px}
.vp-hero.petit .eti{font-size:9.5px;padding:3px 8px}
.vp-hero.petit h2{font-size:14.5px;margin-top:6px;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.vp-hero.petit .lp{gap:6px;margin-top:4px;flex-wrap:wrap}
.vp-hero.petit .lp .ba{font-size:11.5px}
.vp-hero.petit .lp .ac{font-size:15px}
.vp-hero:active{transform:scale(.99)}
.vp-hero img{width:100%;height:100%;object-fit:cover;display:block}
.vp-hero .voile{position:absolute;inset:0;
  background:linear-gradient(to top,rgba(20,14,12,.88) 0%,rgba(20,14,12,.25) 52%,transparent 78%)}
.vp-hero .txt{position:absolute;left:0;right:0;bottom:0;padding:15px 18px;color:#fff;text-align:left}
.vp-hero .eti{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:999px;
  background:linear-gradient(135deg,#F0B429,#E0852C);font-size:11px;font-weight:800;letter-spacing:.06em}
.vp-hero h2{font-family:'Bricolage Grotesque','Inter',sans-serif;font-size:23px;margin-top:9px;
  text-shadow:0 2px 12px rgba(0,0,0,.4);line-height:1.15}
.vp-hero .lp{display:flex;align-items:baseline;gap:9px;margin-top:6px}
.vp-hero .lp .ba{text-decoration:line-through;opacity:.7;font-size:15px}
.vp-hero .lp .ac{font-size:21px;font-weight:800}
@media (max-width:380px){.vp-hero h2{font-size:20px}}

/* prix barré */
.vp-prix-barre{margin-right:7px;color:var(--muted);text-decoration:line-through;
  font-size:13.5px;font-weight:600}
.vp-remise{display:inline-block;margin-right:7px;padding:1px 7px;border-radius:6px;
  background:var(--red-s);color:var(--wine);font-size:11.5px;font-weight:800}

/* demandes de produits hors catalogue */
.vp-demande-lien{width:100%;display:flex;align-items:center;gap:12px;text-align:left;
  margin-top:20px;padding:13px 15px;border-radius:14px;background:var(--card);
  border:1px dashed var(--line);color:var(--ink)}
.vp-demande-lien b{display:block;font-size:14.5px}
.vp-demande-lien small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.vp-badge-dem{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;
  background:#3B5B8C;color:#fff;font-size:10px;font-weight:800;letter-spacing:.05em;
  vertical-align:0.08em}
.vp-demandes{margin-top:14px;padding:12px 13px;border-radius:12px;
  background:#F2F6FB;border:1px dashed #C9D8EC}
[data-theme="sombre"] .vp-demandes{background:#1B2330;border-color:#2C3A50}
.vp-demandes > b{display:block;font-size:13.5px}
.vp-demandes > small{display:block;color:var(--muted);font-size:12px;margin-top:2px;line-height:1.45}
.vp-demande-l{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:8px 0;border-bottom:1px dotted var(--line);font-size:14px}
.vp-demande-l .l{min-width:0}
.vp-demande-l .l small{display:block;color:var(--muted);font-size:12px;margin-top:1px}
.vp-demande-x{width:28px;height:28px;flex:0 0 auto;border-radius:8px;background:var(--blanc);
  border:1px solid var(--line);color:var(--muted);font-size:16px;display:grid;place-items:center}
.vp-demande-f{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.vp-demande-q{display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:center}
.vp-demande-q .vp-input{padding:9px 10px;font-size:15px}

/* suggestions de produits déjà proposés */
.vp-sugg{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.vp-sugg-t{width:100%;font-size:11.5px;font-weight:700;color:var(--muted)}
.vp-sugg-b{padding:6px 11px;border-radius:999px;background:var(--blanc);
  border:1px solid var(--line);color:var(--ink);font-size:13px;font-weight:600}
.vp-sugg-b:active{background:var(--paper);transform:scale(.96)}

/* reformulation d'une demande (pesées) */
.vp-reform{margin-top:10px;padding:10px 11px;border-radius:10px;
  background:#F2F6FB;border:1px solid #C9D8EC}
[data-theme="sombre"] .vp-reform{background:#1B2330;border-color:#2C3A50}
.vp-reform-o{display:block;font-size:12.5px;color:var(--muted);margin-bottom:8px;line-height:1.45}
.vp-reform-o i{color:var(--ink);font-style:italic}
.vp-reform label{display:block}
.vp-reform label span{display:block;font-size:11px;font-weight:700;letter-spacing:.03em;
  text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.vp-reform .vp-input{padding:9px 11px;font-size:15px}

/* rappel des produits habituels */
.vp-oublis{margin-top:14px;padding:12px 13px;border-radius:12px;
  background:var(--paper);border:1px dashed var(--line)}
.vp-oublis > b{display:block;font-size:13px;margin-bottom:8px;color:var(--ink)}
.vp-oubli-l{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:7px 0;border-top:1px dotted var(--line);font-size:14px}
.vp-oubli-l .l{min-width:0}
.vp-oubli-l .l small{display:block;color:var(--muted);font-size:12px;margin-top:1px}
.vp-oubli-l .vp-add{padding:7px 12px;font-size:13px}

/* étoile favori */
.vp-etoile{position:absolute;top:8px;right:9px;width:30px;height:30px;border-radius:50%;
  background:rgba(255,255,255,.92);border:1px solid var(--line);color:#C9BCAE;
  font-size:17px;line-height:1;display:grid;place-items:center;z-index:4}
.vp-etoile.on{color:#E0A23C;border-color:#F0D9AE;background:#FFF8EC}
.vp-etoile:active{transform:scale(.9)}
.vp-prod{position:relative}
.vp-prod .vp-pinfo{padding-right:26px}

/* badge nouveauté */
.vp-badge-neuf{display:inline-block;margin-left:7px;padding:1px 8px;border-radius:999px;
  font-size:10.5px;font-weight:800;letter-spacing:.05em;color:#fff;background:var(--green);
  vertical-align:0.08em}

/* commandes hors horaires */
.vp-badge-pre{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;
  background:#EEEBFA;border:1px solid #D7D1EE;color:#4F3F8F;font-size:10px;font-weight:800;
  letter-spacing:.04em;vertical-align:0.08em}
[data-theme="sombre"] .vp-badge-pre{background:#241F38;border-color:#3B3356;color:#B9AEE8}

.vp-badge-dbl{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;
  background:#FFF1E6;border:1px solid #FBD4B4;color:#9A4A12;font-size:10px;font-weight:800;
  letter-spacing:.04em;vertical-align:0.08em}
[data-theme="sombre"] .vp-badge-dbl{background:#36220F;border-color:#5A3A19;color:#F0B183}

.vp-prec{display:flex;align-items:flex-start;gap:12px;margin-top:14px;padding:13px 15px;
  border-radius:13px;background:#F2F0FB;border:1px solid #D7D1EE;color:var(--ink)}
.vp-prec b{display:block;font-size:14.5px}
.vp-prec small{display:block;color:var(--muted);font-size:13px;margin-top:3px;line-height:1.55}
.vp-prec small b{display:inline;color:var(--ink)}
.vp-prec-ico{font-size:21px;line-height:1;flex:0 0 auto}
[data-theme="sombre"] .vp-prec{background:#1E1B2B;border-color:#342E48}
.vp-prec-panier{margin-top:12px;padding:12px 14px;border-radius:12px;
  background:#F2F0FB;border:1px solid #D7D1EE;font-size:13px;line-height:1.6;color:var(--muted)}
.vp-prec-panier > b{display:block;margin-bottom:3px;font-size:13.5px;color:var(--ink)}
.vp-prec-panier b{color:var(--ink)}
[data-theme="sombre"] .vp-prec-panier{background:#1E1B2B;border-color:#342E48}

/* rubriques dépliables */
.vp-rub{margin-top:8px}
.vp-rub-t{width:100%;display:flex;align-items:center;gap:11px;padding:14px 4px;
  background:none;color:var(--muted);text-align:left}
.vp-rub-ico{font-size:23px;line-height:1;flex:0 0 auto}
.vp-rub-nom{font-size:13.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  white-space:nowrap}
.vp-rub-nb{flex:0 0 auto;min-width:22px;padding:1px 8px;border-radius:999px;
  background:var(--paper);border:1px solid var(--line);color:var(--muted);
  font-size:11.5px;font-weight:700;letter-spacing:0}
.vp-rub-trait{flex:1;height:1px;background:linear-gradient(to right,var(--line),transparent)}
.vp-rub-ch{flex:0 0 auto;transition:transform .2s ease}
.vp-rub-t.on{color:var(--ink)}
.vp-rub-t.on .vp-rub-nb{background:var(--wine);border-color:var(--wine);color:#fff}
.vp-rub-t.on .vp-rub-ch{transform:rotate(180deg)}
.vp-rub-t:active{opacity:.6}
.vp-rub-c{animation:vpdeplie .18s ease-out}
@keyframes vpdeplie{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.vp-rub-tout{text-align:right;margin-top:14px}
@media (prefers-reduced-motion:reduce){
  .vp-rub-ch{transition:none}
  .vp-rub-c{animation:none}
}

/* compteur de visiteurs (admin) */
.vp-live{display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:9px 13px;
  border-radius:10px;background:var(--blanc);border:1px solid var(--line);
  color:var(--muted);font-size:13px;font-weight:600}
.vp-live.on{background:var(--green-s);border-color:#CFE3D5;color:var(--green)}
.vp-live-pt{width:8px;height:8px;border-radius:50%;background:var(--line);flex:0 0 auto}
.vp-live.on .vp-live-pt{background:var(--green);animation:vpbat 2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.vp-live.on .vp-live-pt{animation:none}}
.vp-social-sep{opacity:.5}

/* preuve sociale */
.vp-social{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:14px;padding:9px 13px;
  border-radius:10px;background:var(--green-s);border:1px solid #CFE3D5;
  color:var(--green);font-size:13px;font-weight:600}
.vp-social-pt{width:8px;height:8px;border-radius:50%;background:var(--green);
  animation:vpbat 2s ease-in-out infinite}
@keyframes vpbat{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.vp-social-pt{animation:none}}

/* rappel de la dernière commande */
.vp-rappel{width:100%;display:flex;align-items:center;gap:12px;text-align:left;
  margin-top:14px;padding:13px 15px;border-radius:14px;background:#fff;
  border:1px solid var(--line);box-shadow:var(--shadow);color:var(--ink)}
.vp-rappel b{display:block;font-size:14.5px}
.vp-rappel small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px}
.vp-rappel-ico{flex:0 0 auto;font-size:21px;line-height:1}
.vp-rappel:active{transform:scale(.99);background:var(--paper)}

/* rubrique promos vide */
.vp-promo-vide{text-align:center;margin-top:20px;padding:26px 18px;border-radius:14px;
  background:#FFF8EC;border:1px dashed #F0D9AE}
.vp-promo-vide b{display:block;margin-top:8px;font-size:15px;color:#7A5A20}
.vp-promo-vide small{display:block;margin-top:4px;color:var(--muted);font-size:13px}

/* onglet et badge PROMOS */
.vp-tab-promo{background:linear-gradient(135deg,#F0B429,#E0852C);border-color:#D3791F;
  color:#fff;font-weight:800;letter-spacing:.02em;
  box-shadow:0 2px 8px rgba(224,133,44,.32)}
.vp-tab-promo:hover{border-color:#C26C18;color:#fff}
.vp-tab-promo.on{background:linear-gradient(135deg,#E0852C,#C2521A);border-color:#A8440F;
  box-shadow:0 3px 12px rgba(194,82,26,.45)}
.vp-tab-nb{margin-left:6px;background:rgba(255,255,255,.28);border-radius:999px;
  padding:1px 7px;font-size:11.5px;font-weight:800}
.vp-eclair{margin-right:5px;font-size:13px;vertical-align:-0.05em}
.vp-badge-promo{display:inline-flex;align-items:center;margin-left:7px;padding:1px 8px;
  border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.05em;color:#fff;
  background:linear-gradient(135deg,#F0B429,#E0852C);vertical-align:0.08em}
.vp-badge-promo .vp-eclair{margin-right:3px;font-size:11px}

/* ligne de saisie des pesées */
.vp-pl{border:1px solid var(--line);border-radius:12px;padding:11px 12px;margin-bottom:10px;background:#fff}
.vp-pl.rupt{background:#FDF6F6;border-color:#F0CFCF}
.vp-pl-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.vp-pl-h .nm{min-width:0;font-size:14.5px;font-weight:600}
.vp-pl-h .nm small{display:block;color:var(--muted);font-size:12px;font-weight:400;margin-top:2px}
.vp-pl-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px;margin-top:10px}
.vp-pl-g label{display:block;min-width:0}
.vp-pl-g label span{display:block;font-size:11px;font-weight:700;letter-spacing:.03em;
  text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.vp-pl-g input:disabled{background:var(--paper);color:var(--muted)}
.vp-pl-f{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  margin-top:9px;padding-top:8px;border-top:1px dotted var(--line);font-size:13px;color:var(--muted)}
.vp-pl-f b{font-size:15.5px;color:var(--wine);font-variant-numeric:tabular-nums}
.vp-groupe-prix{display:grid;grid-template-columns:1fr 92px 92px;gap:8px;align-items:center;
  margin:10px 0 12px;padding:9px 11px;border-radius:10px;background:var(--paper);
  border:1px solid var(--line);font-size:12.5px;font-weight:600;color:var(--muted)}
@media (max-width:430px){
  .vp-groupe-prix{grid-template-columns:1fr 1fr;row-gap:6px}
  .vp-groupe-prix > span{grid-column:1/-1}
}

/* liste d'encaissement (pesées) */
.vp-liste{margin-top:12px;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.vp-liste-l{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:10px 13px;font-size:14.5px;border-bottom:1px solid var(--line);background:#fff}
.vp-liste-l:nth-child(even){background:var(--paper)}
.vp-liste-l b{font-variant-numeric:tabular-nums;white-space:nowrap}
.vp-liste-l.tot{border-bottom:none;border-top:2px solid var(--ink);background:#fff;font-weight:800}
.vp-liste-l.tot b{color:var(--wine)}

/* ligne de résultats de recherche (boutique) */
.vp-resultats{display:flex;align-items:center;flex-wrap:wrap;gap:2px;
  margin-top:14px;color:var(--muted);font-size:13.5px}

/* barre de recherche produits */
.vp-search{position:relative;margin-bottom:12px}
.vp-cat-nav .vp-search{margin:10px 0 0}
.vp-cat-nav .vp-search + .vp-cat-select{margin-top:10px}
.vp-search .vp-input{padding-left:40px;padding-right:38px}
.vp-search-ico{position:absolute;left:13px;top:50%;transform:translateY(-50%);
  color:var(--muted);pointer-events:none;display:grid;place-items:center}
.vp-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);
  width:26px;height:26px;border-radius:50%;background:var(--paper);border:1px solid var(--line);
  color:var(--muted);font-size:15px;line-height:1;display:grid;place-items:center}
.vp-search-clear:active{background:var(--line)}

/* repérage du produit qu'on vient de modifier */
.vp-cmd.vp-flash{animation:vpflash 1.5s ease-out}
@keyframes vpflash{
  0%{box-shadow:0 0 0 3px rgba(138,46,46,.4);border-color:var(--wine)}
  100%{box-shadow:0 0 0 0 rgba(138,46,46,0);border-color:var(--line)}
}
@media (prefers-reduced-motion:reduce){
  .vp-cmd.vp-flash{animation:none;border-color:var(--wine)}
}

@media (max-width:430px){.vp-grid2{grid-template-columns:1fr}}
`;

/* ============================================================
   APP
============================================================ */
export default function App() {
  const [view, setView] = useState(
    typeof window !== 'undefined' && window.location.hash.includes('admin') ? 'admin' : 'client'
  );
  const [settings, setSettings] = useState(null);
  const [produits, setProduits] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState('');
  // Visiteurs connectés, via Realtime Presence : rien n'est écrit en base,
  // chaque navigateur s'annonce et disparaît de lui-même à la fermeture.
  const [enLigne, setEnLigne] = useState(0);
  const [session, setSession] = useState(null);
  const [profil, setProfil] = useState(null);
  const [profilCharge, setProfilCharge] = useState(false);

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2200); };

  // session du client + sa fiche
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const chargerProfil = async () => {
    const uid = session && session.user && session.user.id;
    if (!uid) { setProfil(null); setProfilCharge(true); return; }
    setProfilCharge(false);
    // maybeSingle : l'absence de fiche est un cas normal (inscription
    // interrompue), pas une erreur à remonter
    const { data } = await supabase.from('viande_clients').select('*').eq('id', uid).maybeSingle();
    setProfil(data || null);
    setProfilCharge(true);
  };
  useEffect(() => { chargerProfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // compteur de présence — l'organisateur ne se compte pas comme visiteur
  useEffect(() => {
    if (!supabase) return;
    const moi = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase.channel('viande_presence', { config: { presence: { key: moi } } });
    const compter = () => {
      try {
        const etat = ch.presenceState();
        const n = Object.values(etat)
          .flat()
          .filter((p) => p && p.role === 'client').length;
        setEnLigne(n);
      } catch (e) { /* canal fermé */ }
    };
    ch.on('presence', { event: 'sync' }, compter)
      .on('presence', { event: 'join' }, compter)
      .on('presence', { event: 'leave' }, compter)
      .subscribe((statut) => {
        if (statut === 'SUBSCRIBED') {
          ch.track({ role: view === 'admin' ? 'admin' : 'client', depuis: Date.now() });
        }
      });
    return () => { supabase.removeChannel(ch); };
  }, [view]);

  // horloge (countdown)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // routing par hash
  useEffect(() => {
    const onHash = () => setView(window.location.hash.includes('admin') ? 'admin' : 'client');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // chargement initial + realtime produits/settings
  /* La boutique ne télécharge QUE les produits publiés. Sans ce
     filtre, chaque visiteur recevrait aussi les centaines de produits
     en attente de préparation — à chaque visite et à chaque
     rafraîchissement — pour un catalogue qu'il ne verra jamais.
     L'admin, lui, a besoin de tout voir. */
  const vueRef = useRef(view);
  const loadBase = async () => {
    if (!supabase) return;
    const { data: s } = await supabase.from('viande_settings').select('*').eq('id', 1).single();
    if (s) setSettings(s);
    const pourAdmin = vueRef.current === 'admin';
    let req = supabase.from('viande_produits').select('*').order('ordre');
    if (!pourAdmin) req = req.eq('brouillon', false);
    let { data: p, error } = await req;
    // colonne absente (migration pas encore passée) : on reprend tout
    // plutôt que de laisser la boutique vide
    if (error && !pourAdmin) {
      const retour = await supabase.from('viande_produits').select('*').order('ordre');
      p = retour.data;
    }
    if (p) setProduits(p);
  };
  // changer de vue change ce qu'il faut charger
  useEffect(() => {
    vueRef.current = view;
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => {
    loadBase();
    if (!supabase) return;
    const ch = supabase
      .channel('viande_base')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_produits' }, loadBase)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_settings' }, loadBase)
      .subscribe();
    // Le temps réel (postgres_changes) fait déjà le travail. Ce rechargement
    // n'est qu'un filet de sécurité pour les mobiles qui coupent la
    // connexion en arrière-plan : une fois par minute suffit largement,
    // et ça divise par cinq la bande passante consommée par visiteur.
    const poll = setInterval(loadBase, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  // La journée de vente doit toujours désigner aujourd'hui. Jusqu'ici la
  // mise à jour n'avait lieu qu'à l'ouverture de l'onglet Réglages : si on
  // n'y passait pas, la date restait bloquée sur un jour passé et l'admin
  // comme les nouvelles commandes se rattachaient au mauvais jour.
  useEffect(() => {
    if (!supabase || !settings) return;
    const auj = aujourdhuiStr();
    if (settings.date_vente === auj) return;
    supabase.from('viande_settings').update({ date_vente: auj }).eq('id', 1)
      .then(() => loadBase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings && settings.date_vente]);

  // Jour de la semaine en temps réel (0=dim, 6=sam)
  const jourSemaine = useMemo(() => new Date(now).getDay(), [now]);
  const estSemaine = jourSemaine >= 1 && jourSemaine <= 5;
  const ferie = useMemo(() => nomJourFerie(new Date(now)), [now]);

  // Horaires calculés sur AUJOURD'HUI (pas sur date_vente stockée)
  const { ouvertureAt, fermetureAt } = useMemo(() => {
    if (!settings) return { ouvertureAt: null, fermetureAt: null };
    try {
      const d = new Date(now);
      return {
        // le dimanche, l'ouverture est fixée à midi
        ouvertureAt: horodatage(d, heureOuvertureDu(d, settings.heure_ouverture)),
        fermetureAt: horodatage(d, settings.heure_fermeture || '19:30'),
      };
    } catch (e) { return { ouvertureAt: null, fermetureAt: null }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, now]);

  // jour ouvrable au sens du retrait du lendemain
  const jourOuvert = useMemo(() => jourCommandable(new Date(now)), [now]);
  // ouverture exceptionnelle, valable pour la seule journée choisie
  const forcee = !!settings
    && settings.ouverture_forcee_le === aujourdhuiStr();
  const prochaineAt = useMemo(
    () => (settings ? prochaineOuverture(now, settings.heure_ouverture, settings.heure_fermeture) : null),
    [now, settings],
  );

  // Ouvert si :
  //   - semaine : vente_active=true ET dans les horaires (auto)
  //   - weekend : vente_active=true ET dans les horaires (manuel requis)
  const ouvert = !!settings?.vente_active
    && (forcee || (
      jourOuvert
      && (!ouvertureAt || now >= ouvertureAt)
      && (!fermetureAt || now < fermetureAt)
    ));

  if (!supabase) return <SetupScreen />;
  if (!settings) return <div className="vp-app"><div className="vp-empty">Chargement…</div></div>;

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className="vp-toast">{toast}</div>}
      {view === 'admin' ? (
        <Admin
          settings={settings} produits={produits} ouvert={ouvert}
          estSemaine={estSemaine} enLigne={enLigne}
          reload={loadBase} showToast={showToast}
        />
      ) : (
        <Client
          settings={settings} produits={produits} now={now}
          fermetureAt={fermetureAt} ouvertureAt={ouvertureAt} ouvert={ouvert}
          estSemaine={estSemaine} ferie={ferie} jourOuvert={jourOuvert} prochaineAt={prochaineAt}
          forcee={forcee} showToast={showToast}
          enLigne={enLigne}
          session={session} profil={profil} profilCharge={profilCharge} chargerProfil={chargerProfil}
        />
      )}
    </>
  );
}

/* ============================================================
   QUESTIONNAIRE CLIENT
   Affiché sur la boutique quand il est activé dans l'admin.
============================================================ */
function Sondage({ settings, showToast, session, profil, onConnexion }) {
  const [ouvert, setOuvert] = useState(false);
  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(() => aDejaRepondu(settings.date_vente));

  if (!settings.sondage_actif) return null;
  const connecte = !!(session && session.user && profil);

  const envoyer = async () => {
    if (!connecte) { onConnexion(); return; }
    if (reponse.trim().length < 2) { showToast('Écris ton message avant d\'envoyer'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.from('viande_sondage_reponses').insert({
        user_id: session.user.id,
        nom: profil.nom,
        reponse: reponse.trim(),
        date_vente: settings.date_vente,
      });
      if (error) throw error;
      marquerRepondu(settings.date_vente);
      setFait(true);
      setOuvert(false);
      setReponse('');
    } catch (e) {
      showToast(messageErreur(e) || 'Envoi impossible — réessaie');
    } finally { setEnvoi(false); }
  };

  if (fait) {
    return (
      <div className="vp-sondage fait">
        <span className="vp-sondage-ico">✓</span>
        <div>
          {settings.sondage_merci || 'Merci de ta réponse !'}
          <small style={{ marginTop: 4 }}>
            Tu retrouveras la réponse de l'organisateur dans ton profil.{' '}
            <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => setFait(false)}>
              Écrire autre chose
            </button>
          </small>
        </div>
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button className="vp-sondage" onClick={() => (connecte ? setOuvert(true) : onConnexion())}>
        <span className="vp-sondage-ico">💬</span>
        <div>
          <b>{settings.sondage_titre || 'Ton avis nous intéresse'}</b>
          <small>
            {connecte ? 'Tu cherches un produit en particulier ?'
              : 'Connecte-toi pour nous écrire — on te répond dans ton profil'}
          </small>
        </div>
        <span className="vp-sondage-fl">›</span>
      </button>
    );
  }

  return (
    <div className="vp-sondage ouvert">
      <div className="vp-srow" style={{ alignItems: 'flex-start' }}>
        <b style={{ fontSize: 15 }}>{settings.sondage_titre || 'Ton avis nous intéresse'}</b>
        <button className="vp-sheet-x" onClick={() => setOuvert(false)} aria-label="Fermer">×</button>
      </div>
      <p className="vp-sondage-q">{settings.sondage_question}</p>
      <textarea className="vp-input" value={reponse} rows={4}
        onChange={(e) => setReponse(e.target.value)} placeholder="Écris ici…" />
      <div className="vp-sub" style={{ marginTop: 6 }}>
        Envoyé au nom de <b>{profil.nom}</b>. La réponse apparaîtra dans ton profil.
      </div>
      <button className="vp-cta" disabled={envoi} onClick={envoyer}>
        {envoi ? 'Envoi…' : 'Envoyer'}
      </button>
    </div>
  );
}

/* ============================================================
   BOUTON WHATSAPP
   Affiché seulement si un lien de groupe est renseigné
   dans l'onglet Réglages.
============================================================ */
const CHEMIN_WA = 'M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.38c0-4.54 3.69-8.23 8.23-8.23 2.2 0 4.26.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07s.89 2.4 1.02 2.56c.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29z';

// Pastille flottante en bas de l'écran, icône seule.
// « haut » la remonte au-dessus de la barre du panier.
function PastilleWhatsApp({ url, haut }) {
  if (!url) return null;
  return (
    <div className={`vp-fab-zone ${haut ? 'haut' : ''}`}>
      <a className="vp-wa-fab" href={url} target="_blank" rel="noreferrer noopener"
        aria-label="Rejoindre le groupe WhatsApp" title="Rejoindre le groupe WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={CHEMIN_WA} />
        </svg>
      </a>
    </div>
  );
}

function BoutonWhatsApp({ url, libelle }) {
  if (!url) return null;
  return (
    <a className="vp-wa" href={url} target="_blank" rel="noreferrer noopener">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={CHEMIN_WA} />
      </svg>
      {libelle}
    </a>
  );
}

/* ============================================================
   ŒIL D'AFFICHAGE
   Rend lisible un champ masqué. Défini ici et non dans un
   composant : un composant créé à chaque rendu ferait perdre
   le focus du champ à chaque caractère tapé.
============================================================ */
function BoutonOeil({ visible, onClick }) {
  return (
    <button className="vp-oeil" onClick={onClick} tabIndex={-1}
      aria-label={visible ? 'Masquer' : 'Afficher'}
      title={visible ? 'Masquer' : 'Afficher'}>
      {visible ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7c1.6 0 3 .44 4.2 1.1M22 12s-3.6 7-10 7c-1.6 0-3-.44-4.2-1.1" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="M3 3l18 18" />
        </svg>
      )}
    </button>
  );
}

/* ============================================================
   DRAPEAU FRANÇAIS
   Dessiné en SVG : l'emoji 🇫🇷 s'affiche « FR » sur Windows,
   qui ne rend pas les indicateurs régionaux.
============================================================ */
function DrapeauFR({ taille = 13 }) {
  const w = Math.round(taille * 1.45);
  return (
    <svg className="vp-flag" width={w} height={taille} viewBox="0 0 18 12"
      role="img" aria-label="Produit français">
      <title>Produit français</title>
      <rect width="18" height="12" rx="1.6" fill="#FFFFFF" />
      <path d="M1.6 0H6v12H1.6A1.6 1.6 0 0 1 0 10.4V1.6A1.6 1.6 0 0 1 1.6 0z" fill="#0055A4" />
      <path d="M12 0h4.4A1.6 1.6 0 0 1 18 1.6v8.8a1.6 1.6 0 0 1-1.6 1.6H12z" fill="#EF4135" />
      <rect x=".4" y=".4" width="17.2" height="11.2" rx="1.3" fill="none"
        stroke="rgba(36,30,27,.22)" strokeWidth=".8" />
    </svg>
  );
}

/* ============================================================
   ÉCRAN CONFIG (si env manquantes)
============================================================ */
function SetupScreen() {
  return (
    <div style={{ maxWidth: 460, margin: '80px auto', padding: 24, fontFamily: 'system-ui' }}>
      <h2>Configuration requise</h2>
      <p style={{ color: '#666', lineHeight: 1.6 }}>
        Ajoute les variables <code>REACT_APP_SUPABASE_URL</code> et{' '}
        <code>REACT_APP_SUPABASE_ANON_KEY</code> dans Vercel (Settings → Environment Variables),
        puis redéploie.
      </p>
    </div>
  );
}

/* ============================================================
   COUNTDOWN
============================================================ */
function Countdown({ fermetureAt, now, ouvert, venteActive, prochaineAt, forcee }) {
  if (forcee && ouvert) {
    return (
      <span className="vp-status vp-open">
        <span className="vp-dot" />Ouvert exceptionnellement aujourd'hui
      </span>
    );
  }
  if (!venteActive) {
    return (
      <span className="vp-status vp-closed">
        <span className="vp-dot" />Fermé
      </span>
    );
  }

  if (!ouvert) {
    if (!prochaineAt) {
      return <span className="vp-status vp-closed"><span className="vp-dot" />Fermé</span>;
    }
    const d = new Date(prochaineAt);
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const memeJour = d.toDateString() === new Date(now).toDateString();
    const txt = memeJour
      ? `Ouverture à ${heure}`
      : `Ouverture ${JOURS_FR[d.getDay()]} à ${heure}`;
    return <span className="vp-status vp-closed"><span className="vp-dot" />{txt}</span>;
  }

  const reste = fermetureAt - now;
  const h = Math.floor(reste / 3600000);
  const m = Math.floor((reste % 3600000) / 60000);
  const txt = h > 0 ? `Fermeture dans ${h}h${String(m).padStart(2, '0')}` : `Fermeture dans ${m} min`;
  return <span className="vp-status vp-open"><span className="vp-dot" />{txt}</span>;
}

/* ============================================================
   COMPTE CLIENT — inscription, connexion, espace personnel
============================================================ */
function messageAuth(e) {
  const m = String((e && e.message) || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Cette adresse a déjà un compte — utilise « J\'ai déjà un compte ».';
  }
  if (m.includes('password')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('email')) return 'Adresse e-mail invalide.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives — réessaie dans un moment.';
  if (m.includes('token') || m.includes('otp') || m.includes('expired')) return 'Code incorrect ou expiré — demande un nouveau code.';
  return 'Impossible pour le moment — réessaie.';
}

function EcranAuth({ onFait, onFermer, showToast, modeInitial }) {
  const [mode, setMode] = useState(modeInitial || 'inscription');
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [alias, setAlias] = useState('');
  const [parrain, setParrain] = useState('');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [code, setCode] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [mdpVisible, setMdpVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  // Mot de passe oublié : Supabase envoie un code, on le vérifie,
  // puis on change le mot de passe de la session ainsi ouverte.
  const demanderCode = async () => {
    if (!email.includes('@')) { showToast('Saisis ton adresse e-mail'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setMode('oubli-code');
      showToast('Code envoyé par mail');
    } catch (e) {
      showToast(messageAuth(e));
    } finally { setEnvoi(false); }
  };

  const changerMdp = async () => {
    if (code.trim().length < 6) { showToast('Saisis le code à 6 chiffres'); return; }
    if (mdp2.length < 6) { showToast('Nouveau mot de passe : 6 caractères minimum'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(), token: code.trim(), type: 'recovery',
      });
      if (error) throw error;
      const { error: e2 } = await supabase.auth.updateUser({ password: mdp2 });
      if (e2) throw e2;
      showToast('Mot de passe modifié');
      onFait();
    } catch (e) {
      showToast(messageAuth(e));
    } finally { setEnvoi(false); }
  };

  // Crée la fiche client une fois la session ouverte (les règles d'accès
  // exigent d'être authentifié pour écrire sa propre fiche).
  const creerFiche = async (uid) => {
    const { error } = await supabase.from('viande_clients').upsert({
      id: uid, nom: nom.trim(), telephone: tel.trim(), email: email.trim(),
      alias_whatsapp: alias.trim() || null,
      parrain: parrain.trim() || null,
    });
    if (error) showToast(messageErreur(error));
  };

  const verifierCode = async () => {
    if (code.trim().length < 6) { showToast('Saisis le code à 6 chiffres reçu par mail'); return; }
    setEnvoi(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(), token: code.trim(), type: 'signup',
      });
      if (error) throw error;
      const uid = data.user && data.user.id;
      if (uid) await creerFiche(uid);
      showToast('Compte confirmé — bienvenue !');
      onFait();
    } catch (e) {
      showToast(messageAuth(e));
    } finally { setEnvoi(false); }
  };

  const renvoyerCode = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw error;
      showToast('Nouveau code envoyé');
    } catch (e) { showToast(messageAuth(e)); }
  };

  const inscrire = async () => {
    if (!nom.trim()) { showToast('Indique ton prénom'); return; }
    if (tel.replace(/\D/g, '').length < 10) { showToast('Numéro de téléphone obligatoire'); return; }
    if (parrain.trim().length < 2) {
      showToast('Indique qui t\'a donné le lien'); return;
    }
    if (!email.includes('@')) { showToast('Adresse e-mail invalide'); return; }
    if (mdp.length < 6) { showToast('Mot de passe : 6 caractères minimum'); return; }
    setEnvoi(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: mdp });
      if (error) throw error;
      // Si la confirmation par mail est activée dans Supabase, aucune session
      // n'est ouverte : on demande le code reçu. Sinon, on entre directement.
      if (!data.session) {
        setMode('code');
        showToast('Code envoyé par mail');
        return;
      }
      const uid = data.user && data.user.id;
      if (uid) await creerFiche(uid);
      showToast('Compte créé — bienvenue !');
      onFait();
    } catch (e) {
      showToast(messageAuth(e));
    } finally { setEnvoi(false); }
  };

  const connecter = async () => {
    if (!email.includes('@') || !mdp) { showToast('Renseigne ton e-mail et ton mot de passe'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
      if (error) throw error;
      showToast('Te voilà connecté');
      onFait();
    } catch (e) {
      showToast(messageAuth(e));
    } finally { setEnvoi(false); }
  };

  return (
    <div className="vp-sheet vp-auth">
      <div className="vp-sheet-head">
        <span className="vp-th" style={{ marginBottom: 0 }}>
          {mode === 'code' ? 'Confirmer mon adresse'
            : mode === 'oubli' ? 'Mot de passe oublié'
            : mode === 'oubli-code' ? 'Nouveau mot de passe'
            : mode === 'inscription' ? 'Créer mon compte' : 'Me connecter'}
        </span>
        <button className="vp-sheet-x" onClick={onFermer} aria-label="Fermer">×</button>
      </div>

      {(mode === 'inscription' || mode === 'connexion') && (
        <div className="vp-seg">
          <button className={mode === 'connexion' ? 'on' : ''} onClick={() => setMode('connexion')}>
            Se connecter
          </button>
          <button className={mode === 'inscription' ? 'on' : ''} onClick={() => setMode('inscription')}>
            Créer un compte
          </button>
        </div>
      )}

      {mode === 'oubli' ? (
        <>
          <p className="vp-sondage-q">
            Saisis l'adresse de ton compte. Tu recevras un code à 6 chiffres
            pour choisir un nouveau mot de passe.
          </p>
          <div className="vp-field">
            <label className="vp-label">E-mail</label>
            <input className="vp-input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ton.adresse@exemple.fr" inputMode="email" type="email"
              onKeyDown={(e) => e.key === 'Enter' && demanderCode()} />
          </div>
          <button className="vp-cta" disabled={envoi} onClick={demanderCode}>
            {envoi ? 'Envoi…' : 'Recevoir un code'}
          </button>
          <button className="vp-trash" style={{ display: 'block', margin: '14px auto 0' }}
            onClick={() => setMode('connexion')}>Retour à la connexion</button>
        </>
      ) : mode === 'oubli-code' ? (
        <>
          <p className="vp-sondage-q">
            Code envoyé à <b>{email.trim()}</b>. Saisis-le puis choisis ton nouveau
            mot de passe. Pense à regarder tes indésirables.
          </p>
          <div className="vp-field">
            <label className="vp-label">Code reçu</label>
            <input className="vp-input" value={code} inputMode="numeric" maxLength={6}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456" style={{ textAlign: 'center', letterSpacing: 6, fontSize: 20 }} />
          </div>
          <div className="vp-field">
            <label className="vp-label">Nouveau mot de passe</label>
            <div className="vp-mdp">
              <input className="vp-input" value={mdp2} onChange={(e) => setMdp2(e.target.value)}
                type={mdpVisible ? 'text' : 'password'} placeholder="6 caractères minimum"
                autoComplete="new-password"
                onKeyDown={(e) => e.key === 'Enter' && changerMdp()} />
              <BoutonOeil visible={mdpVisible} onClick={() => setMdpVisible(!mdpVisible)} />
            </div>
          </div>
          <button className="vp-cta" disabled={envoi} onClick={changerMdp}>
            {envoi ? 'Un instant…' : 'Changer mon mot de passe'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button className="vp-trash" style={{ marginTop: 0 }} onClick={demanderCode}>Renvoyer le code</button>
            <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => setMode('connexion')}>Annuler</button>
          </div>
        </>
      ) : mode === 'code' ? (
        <>
          <p className="vp-sondage-q">
            Un code à 6 chiffres vient d'être envoyé à <b>{email.trim()}</b>.
            Saisis-le pour activer ton compte. Pense à regarder tes indésirables.
          </p>
          <input className="vp-input" value={code} inputMode="numeric" maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456" style={{ textAlign: 'center', letterSpacing: 6, fontSize: 20 }}
            onKeyDown={(e) => e.key === 'Enter' && verifierCode()} />
          <button className="vp-cta" disabled={envoi} onClick={verifierCode}>
            {envoi ? 'Vérification…' : 'Activer mon compte'}
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            <button className="vp-trash" style={{ marginTop: 0 }} onClick={renvoyerCode}>Renvoyer le code</button>
            <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => setMode('inscription')}>Corriger mon adresse</button>
          </div>
        </>
      ) : (
      <>
      {mode === 'inscription' && (
        <>
          <div className="vp-field">
            <label className="vp-label">Ton prénom *</label>
            <input className="vp-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Marie" />
          </div>
          <div className="vp-field">
            <label className="vp-label">Téléphone *</label>
            <input className="vp-input" value={tel} onChange={(e) => setTel(e.target.value)}
              placeholder="06 12 34 56 78" inputMode="tel" />
            <div className="vp-sub" style={{ marginTop: 4 }}>
              Indispensable pour te joindre en cas de rupture ou d'ajustement de poids.
            </div>
          </div>
          <div className="vp-field">
            <label className="vp-label">Ton nom sur WhatsApp (facultatif)</label>
            <input className="vp-input" value={alias} onChange={(e) => setAlias(e.target.value)}
              placeholder="Ex : Marie D., Mimi 🌸…" />
            <div className="vp-sub" style={{ marginTop: 4 }}>
              Celui qui s'affiche dans le groupe, pour qu'on te reconnaisse.
            </div>
          </div>
          <div className="vp-field">
            <label className="vp-label">Qui t'a donné le lien ? *</label>
            <input className="vp-input" value={parrain}
              onChange={(e) => setParrain(e.target.value)}
              placeholder="Prénom et nom de la personne" />
            <div className="vp-sub" style={{ marginTop: 4 }}>
              On aime savoir qui fait vivre le groupe — et le remercier à l'occasion.
            </div>
          </div>
        </>
      )}

      <div className="vp-field">
        <label className="vp-label">E-mail *</label>
        <input className="vp-input" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="ton.adresse@exemple.fr" inputMode="email" type="email" autoComplete="email" />
      </div>
      <div className="vp-field">
        <label className="vp-label">Mot de passe *</label>
        <div className="vp-mdp">
          <input className="vp-input" value={mdp} onChange={(e) => setMdp(e.target.value)}
            type={mdpVisible ? 'text' : 'password'} placeholder="6 caractères minimum"
            autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'inscription' ? inscrire() : connecter())} />
          <BoutonOeil visible={mdpVisible} onClick={() => setMdpVisible(!mdpVisible)} />
        </div>
      </div>

      {mode === 'connexion' && (
        <button className="vp-trash" style={{ display: 'block', marginTop: 2 }}
          onClick={() => setMode('oubli')}>Mot de passe oublié ?</button>
      )}

      <button className="vp-cta" disabled={envoi} onClick={mode === 'inscription' ? inscrire : connecter}>
        {envoi ? 'Un instant…' : (mode === 'inscription' ? 'Créer mon compte' : 'Me connecter')}
      </button>

      <div className="vp-sub" style={{ textAlign: 'center', marginTop: 14 }}>
        {mode === 'inscription'
          ? <>Déjà inscrit ? <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => setMode('connexion')}>Se connecter</button></>
          : <>Pas encore de compte ? <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => setMode('inscription')}>En créer un</button></>}
      </div>
      </>
      )}
    </div>
  );
}

/* Session ouverte mais aucune fiche client : cas d'une inscription
   interrompue (confirmation par mail, fermeture de l'onglet…).
   On récupère prénom et téléphone plutôt que de traiter la personne
   comme un visiteur non connecté. */
function EcranProfilManquant({ session, chargerProfil, showToast }) {
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [alias, setAlias] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const valider = async () => {
    if (!nom.trim()) { showToast('Indique ton prénom'); return; }
    if (tel.replace(/\D/g, '').length < 10) { showToast('Numéro de téléphone obligatoire'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.from('viande_clients').upsert({
        id: session.user.id,
        nom: nom.trim(),
        telephone: tel.trim(),
        email: session.user.email || null,
        alias_whatsapp: alias.trim() || null,
      });
      const err = messageErreur(error);
      if (err) { showToast(err); return; }
      await chargerProfil();
      showToast('Compte finalisé — bienvenue !');
    } finally { setEnvoi(false); }
  };

  return (
    <div className="vp-sheet">
      <div className="vp-sheet-head">
        <span className="vp-th" style={{ marginBottom: 0 }}>Terminer mon inscription</span>
      </div>
      <p className="vp-sondage-q">
        Ton compte <b>{session.user.email}</b> est bien actif. Il manque juste
        deux informations pour pouvoir commander.
      </p>
      <div className="vp-field">
        <label className="vp-label">Ton prénom *</label>
        <input className="vp-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Marie" />
      </div>
      <div className="vp-field">
        <label className="vp-label">Téléphone *</label>
        <input className="vp-input" value={tel} onChange={(e) => setTel(e.target.value)}
          placeholder="06 12 34 56 78" inputMode="tel"
          onKeyDown={(e) => e.key === 'Enter' && valider()} />
      </div>
      <div className="vp-field">
        <label className="vp-label">Ton nom sur WhatsApp (facultatif)</label>
        <input className="vp-input" value={alias} onChange={(e) => setAlias(e.target.value)}
          placeholder="Ex : Marie D., Mimi 🌸…" />
      </div>
      <button className="vp-cta" disabled={envoi} onClick={valider}>
        {envoi ? 'Un instant…' : 'Valider'}
      </button>
      <button className="vp-trash" style={{ display: 'block', margin: '14px auto 0' }}
        onClick={() => supabase.auth.signOut()}>
        Me déconnecter
      </button>
    </div>
  );
}

function MonCompte({ settings, profil, chargerProfil, onFermer, showToast }) {
  const [commandes, setCommandes] = useState([]);
  const [messages, setMessages] = useState([]);

  // mes messages au questionnaire, et les réponses reçues
  useEffect(() => {
    const charger = async () => {
      if (!profil) return;
      const { data } = await supabase.from('viande_sondage_reponses')
        .select('*').eq('user_id', profil.id)
        .order('created_at', { ascending: false });
      setMessages(data || []);
      // les réponses affichées ici sont considérées comme lues
      const aMarquer = (data || []).filter((m) => m.reponse_admin && !m.reponse_vue).map((m) => m.id);
      if (aMarquer.length) {
        await supabase.from('viande_sondage_reponses').update({ reponse_vue: true }).in('id', aMarquer);
      }
    };
    charger();
  }, [profil]);
  const [chargement, setChargement] = useState(true);
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState((profil && profil.nom) || '');
  const [tel, setTel] = useState((profil && profil.telephone) || '');
  const [alias, setAlias] = useState((profil && profil.alias_whatsapp) || '');
  const [anniv, setAnniv] = useState((profil && profil.date_naissance) || '');
  // Le code d'anniversaire, tel que la base le connaît. C'est ici que
  // la personne le découvre : « notification » à l'ouverture du compte.
  const [code, setCode] = useState(null);
  useEffect(() => {
    const lire = async () => {
      const { data, error } = await supabase.rpc('generer_code_anniversaire');
      if (error || !data || !data.length) { setCode(null); return; }
      const c = data[0];
      if (c.refus) { setCode({ refus: c.refus, utilisable: false }); return; }
      if (!c.code) { setCode(null); return; }
      setCode({
        ...c,
        jours: Math.ceil((new Date(c.expire_le) - new Date()) / 86400000),
        utilisable: !c.deja_utilise && new Date(c.expire_le) > new Date(),
      });
    };
    lire();
  }, [profil]);
  const [ville, setVille] = useState((profil && profil.ville) || '');
  const [cp, setCp] = useState((profil && profil.code_postal) || '');
  const [news, setNews] = useState(!profil || profil.newsletter !== false);
  // facture dépliée dans l'historique : seules les lignes de celle-ci
  // sont dessinées, inutile de construire tout l'historique d'un coup
  const [detailOuvert, setDetailOuvert] = useState(null);

  useEffect(() => {
    const charger = async () => {
      if (!profil) { setChargement(false); return; }
      const { data } = await supabase
        .from('viande_commandes')
        .select('*, lignes:viande_commande_lignes(*)')
        .eq('user_id', profil.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setCommandes(data || []);
      setChargement(false);
    };
    charger();
  }, [profil]);

  const enregistrer = async () => {
    if (!nom.trim()) { showToast('Le prénom ne peut pas être vide'); return; }
    if (tel.replace(/\D/g, '').length < 10) { showToast('Numéro de téléphone invalide'); return; }
    if (cp.trim() && !/^\d{5}$/.test(cp.trim())) { showToast('Code postal : 5 chiffres'); return; }
    if (anniv) {
      const d = new Date(`${anniv}T00:00:00`);
      const an = d.getFullYear();
      if (isNaN(d.getTime()) || an < 1900 || d > new Date()) {
        showToast('Date de naissance invalide'); return;
      }
    }
    const { error } = await supabase.from('viande_clients')
      .update({
        nom: nom.trim(), telephone: tel.trim(), alias_whatsapp: alias.trim() || null,
        date_naissance: anniv || null,
        ville: ville.trim() || null,
        code_postal: cp.trim() || null,
        newsletter: news,
        newsletter_maj_le: new Date().toISOString(),
      })
      .eq('id', profil.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    await chargerProfil();
    setEdition(false);
    showToast('Coordonnées mises à jour');
  };

  const deconnecter = async () => {
    await supabase.auth.signOut();
    onFermer();
  };

  // produits favoris : les plus souvent commandés
  const favoris = (() => {
    const c = {};
    commandes.forEach((cmd) => (cmd.lignes || []).forEach((l) => {
      const k = nomLigne(l);
      if (!c[k]) c[k] = { nom: k, emoji: l.emoji, fois: 0 };
      c[k].fois += 1;
    }));
    return Object.values(c).sort((a, b) => b.fois - a.fois).slice(0, 5);
  })();

  const derniere = commandes[0];
  const totalDe = (c) => (c.total_final != null ? Number(c.total_final) : Number(c.total_estime || 0));
  // somme des lignes avant remise : sert uniquement à afficher le
  // montant retiré, le total enregistré étant déjà net
  const totalLignes = (c) => (c.lignes || []).reduce((s2, l) =>
    s2 + Number(l.sous_total_final != null ? l.sous_total_final : l.sous_total_estime || 0), 0);

  const imprimerFacture = (c) => {
    const rows = (c.lignes || []).map((l) => {
      const detail = detailLigneClient(l);
      const montant = l.rupture ? '—'
        : l.demande && !(Number(l.sous_total_final) > 0) ? 'à confirmer'
        : l.sous_total_final != null ? eur(l.sous_total_final)
        : (l.mode_vente === 'piece_fixe' ? '' : '≈ ') + eur(l.sous_total_estime);
      return `<tr class="${l.rupture ? 'rupture' : ''}">
        <td class="prod"><span class="nom">${esc(nomLigne(l))}</span></td>
        <td class="qte">${esc(detail)}</td>
        <td class="n">${esc(montant)}</td>
      </tr>`;
    }).join('');
    const corps = `
      <div class="tete mince"><div class="barre"></div><div>
        <h1>Ma commande</h1>
        <div class="meta"><b>${esc(settings.titre)}</b> —
          ${esc(new Date(c.created_at).toLocaleDateString('fr-FR'))} · ${esc(c.nom_client)}</div>
      </div></div>
      <table class="liste">
        <colgroup><col class="s-nom"><col class="s-date"><col class="l-tot"></colgroup>
        <thead><tr><th>Produit</th><th>Détail</th><th class="n">Montant</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${pctRemise(c) > 0 ? `<div class="grand" style="opacity:.75"><span>🎂 Remise anniversaire −${esc(num(pctRemise(c)))} %</span><span>−${esc(eur(montantRemise(totalLignes(c), c)))}</span></div>` : ''}
      <div class="grand"><span>Total</span><span>${esc(eur(totalDe(c)))}</span></div>
      ${c.total_final == null ? '<div class="pied">Montant estimé — les produits au kilo seront ajustés après pesée.</div>' : ''}`;
    if (!imprimerDocument('Ma commande', corps)) showToast('Autorise les fenêtres pop-up');
  };

  return (
    <div className="vp-app">
      <div className="vp-compte-tete">
        <button className="vp-btn ghost sm" onClick={onFermer}>← Boutique</button>
        <button className="vp-btn ghost sm" onClick={deconnecter}>Se déconnecter</button>
      </div>

      {profil && estAnniversaire(profil.date_naissance) && (
        <div className="vp-prec-panier" style={{ marginBottom: 14 }}>
          <b>🎂 Joyeux anniversaire {profil.nom} !</b>
          Toute l'équipe de {settings.titre} vous souhaite une très belle journée.
        </div>
      )}

      {code && (
        <div className={code.utilisable ? 'vp-prec-panier' : 'vp-note'} style={{ marginBottom: 14 }}>
          {code.refus ? (
            <>🎂 {code.refus}</>
          ) : code.utilisable ? (
            <>
              <b>🎁 Votre cadeau d'anniversaire : {code.code}</b>
              <b>−{num(code.pct)} %</b> sur une commande, appliqué tout seul au moment
              de valider votre panier : rien à saisir.{' '}
              {code.jours > 0
                ? `Valable encore ${code.jours} jour${code.jours > 1 ? 's' : ''}, puis il disparaît.`
                : "C'est le dernier jour !"}
              {' '}Une seule utilisation.
            </>
          ) : code.deja_utilise ? (
            <>🎁 Votre remise d'anniversaire a bien été utilisée cette année. À l'année prochaine&nbsp;!</>
          ) : (
            <>🎁 Votre remise d'anniversaire a expiré — elle n'était valable que 7 jours. On y repense l'an prochain.</>
          )}
        </div>
      )}

      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">{salutation()} {profil && profil.nom}</div>
            <div className="vp-sub">{profil && profil.email}</div>
          </div>
          {!edition && <button className="vp-btn ghost sm" onClick={() => setEdition(true)}>Modifier</button>}
        </div>

        {edition ? (
          <>
            <div className="vp-field">
              <label className="vp-label">Prénom</label>
              <input className="vp-input" value={nom} onChange={(e) => setNom(e.target.value)} />
            </div>
            <div className="vp-field">
              <label className="vp-label">Téléphone</label>
              <input className="vp-input" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" />
            </div>
            <div className="vp-field">
              <label className="vp-label">Nom sur WhatsApp (facultatif)</label>
              <input className="vp-input" value={alias} onChange={(e) => setAlias(e.target.value)}
                placeholder="Ex : Marie D., Mimi 🌸…" />
            </div>
            <div className="vp-field">
              <label className="vp-label">Date d'anniversaire (facultatif)</label>
              <input className="vp-input" type="date" value={anniv ? String(anniv).slice(0, 10) : ''}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setAnniv(e.target.value)} />
              <div className="vp-sub" style={{ marginTop: 5 }}>
                Uniquement pour vous souhaiter un bon anniversaire. Votre âge n'est
                affiché nulle part, et rien n'est transmis à qui que ce soit.
              </div>
            </div>
            <div className="vp-grid2">
              <div className="vp-field">
                <label className="vp-label">Commune (facultatif)</label>
                <input className="vp-input" value={ville} onChange={(e) => setVille(e.target.value)}
                  placeholder="Noisy-sur-École" autoComplete="address-level2" />
              </div>
              <div className="vp-field">
                <label className="vp-label">Code postal</label>
                <input className="vp-input" value={cp} onChange={(e) => setCp(e.target.value)}
                  placeholder="77123" inputMode="numeric" maxLength={5} autoComplete="postal-code" />
              </div>
            </div>
            <div className="vp-srow" style={{ marginTop: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Recevoir nos annonces</div>
                <div className="vp-sub">
                  Les arrivages, les promos et les nouveautés, par e-mail. Vous pouvez
                  vous désinscrire ici à tout moment — ça ne change rien à vos commandes.
                </div>
              </div>
              <div className={`vp-toggle ${news ? 'on' : ''}`} onClick={() => setNews(!news)} />
            </div>

            <div className="vp-grid2" style={{ marginTop: 12 }}>
              <button className="vp-btn ghost" onClick={() => {
                setEdition(false); setNom(profil.nom); setTel(profil.telephone);
                setAlias(profil.alias_whatsapp || '');
                setAnniv(profil.date_naissance || '');
                setVille(profil.ville || ''); setCp(profil.code_postal || '');
                setNews(profil.newsletter !== false);
              }}>Annuler</button>
              <button className="vp-btn" onClick={enregistrer}>Enregistrer</button>
            </div>
          </>
        ) : (
          <>
            <div className="vp-sub" style={{ marginTop: 6 }}>
              {profil && profil.telephone}
              {profil && profil.alias_whatsapp && <> · WhatsApp : {profil.alias_whatsapp}</>}
              {profil && profil.ville && <> · {profil.ville}{profil.code_postal ? ` (${profil.code_postal})` : ''}</>}
              {profil && profil.date_naissance && <> · 🎂 {annivLisible(profil.date_naissance)}</>}
            </div>
            {profil && !profil.date_naissance && (
              <div className="vp-note" style={{ marginTop: 10 }}>
                🎂 Vous n'avez pas indiqué votre date d'anniversaire. C'est facultatif,
                et ça nous permet simplement de penser à vous le jour venu — appuyez
                sur <b>Modifier</b>.
              </div>
            )}
          </>
        )}
      </div>

      {messages.length > 0 && (
        <div className="vp-section">
          <div className="vp-h2" style={{ fontSize: 16 }}>Mes messages</div>
          <div className="vp-sub">Tes messages et les réponses de l'organisateur.</div>
          {messages.map((m) => (
            <div className="vp-fil" key={m.id}>
              <div className="vp-fil-moi">
                <span className="vp-fil-d">
                  {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                </span>
                {m.reponse}
              </div>
              {m.reponse_admin ? (
                <div className="vp-fil-lui">
                  <span className="vp-fil-d">
                    Réponse{m.reponse_admin_at ? ` · ${new Date(m.reponse_admin_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}` : ''}
                    {!m.reponse_vue && <span className="vp-fil-neuf">nouveau</span>}
                  </span>
                  {m.reponse_admin}
                </div>
              ) : (
                <div className="vp-fil-attente">En attente de réponse…</div>
              )}
            </div>
          ))}
        </div>
      )}

      {chargement ? (
        <div className="vp-empty">Chargement…</div>
      ) : commandes.length === 0 ? (
        <div className="vp-empty">Tu n'as pas encore passé de commande.</div>
      ) : (
        <>
          <div className="vp-section">
            <div className="vp-srow">
              <div className="vp-h2" style={{ fontSize: 16 }}>Ma dernière commande</div>
              <span className="vp-cmd-time">{new Date(derniere.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            {(derniere.lignes || []).map((l) => (
              <div className="vp-cmd-l" key={l.id}
                style={l.rupture ? { opacity: 0.55 } : undefined}>
                <span style={{ minWidth: 0 }}>
                  {l.emoji} {nomLigne(l)}
                  <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                    {detailLigneClient(l)}
                  </small>
                </span>
                <span style={{ fontWeight: 700, flex: '0 0 auto' }}>
                  {l.rupture ? '—'
                    : l.demande && !(Number(l.sous_total_final) > 0) ? 'à confirmer'
                    : l.sous_total_final != null ? eur(l.sous_total_final)
                    : (l.mode_vente === 'piece_fixe' ? '' : '≈ ') + eur(l.sous_total_estime)}
                </span>
              </div>
            ))}
            <div className="vp-tot" style={{ fontSize: 16 }}>
              <span>Total</span>
              <span className="r">{derniere.total_final == null ? '≈ ' : ''}{eur(totalDe(derniere))}</span>
            </div>
            {derniere.total_final == null && (
              <div className="vp-mini">Montant estimé — il sera ajusté après la pesée.</div>
            )}
            <button className="vp-btn ghost sm" style={{ marginTop: 10 }} onClick={() => imprimerFacture(derniere)}>
              Imprimer / PDF
            </button>
          </div>

          {favoris.length > 0 && (
            <div className="vp-section">
              <div className="vp-h2" style={{ fontSize: 16 }}>Mes produits préférés</div>
              <div className="vp-sub">Ce que tu commandes le plus souvent.</div>
              <div className="vp-liste" style={{ marginTop: 10 }}>
                {favoris.map((f) => (
                  <div className="vp-liste-l" key={f.nom}>
                    <span>{f.emoji} {f.nom}</span>
                    <b>{f.fois}×</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="vp-section">
            <div className="vp-h2" style={{ fontSize: 16 }}>Mes commandes</div>
            <div className="vp-sub">Appuie sur une ligne pour voir le détail et l'imprimer.</div>
            {commandes.map((c) => (
              <div key={c.id}>
                <button
                  className="vp-liste-l"
                  style={{
                    border: 'none', borderBottom: '1px dotted var(--line)',
                    width: '100%', textAlign: 'left', background: 'none',
                  }}
                  onClick={() => setDetailOuvert(detailOuvert === c.id ? null : c.id)}
                  aria-expanded={detailOuvert === c.id}>
                  <span>
                    {detailOuvert === c.id ? '▾ ' : '▸ '}
                    {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    {' '}<span className="vp-pill">{(c.lignes || []).length} produit(s)</span>
                    {pctRemise(c) > 0 && <span className="vp-pill">−{num(pctRemise(c))} %</span>}
                  </span>
                  <b>{c.total_final == null ? '≈ ' : ''}{eur(totalDe(c))}</b>
                </button>

                {detailOuvert === c.id && (
                  <div style={{ padding: '10px 0 14px' }}>
                    {(c.lignes || []).map((l) => (
                      <div className="vp-cmd-l" key={l.id}
                        style={l.rupture ? { opacity: 0.55 } : undefined}>
                        <span style={{ minWidth: 0 }}>
                          {l.emoji} {nomLigne(l)}
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                            {detailLigneClient(l)}
                          </small>
                        </span>
                        <span style={{ fontWeight: 700, flex: '0 0 auto' }}>
                          {l.rupture ? '—'
                            : l.demande && !(Number(l.sous_total_final) > 0) ? 'à confirmer'
                            : l.sous_total_final != null ? eur(l.sous_total_final)
                            : (l.mode_vente === 'piece_fixe' ? '' : '≈ ') + eur(l.sous_total_estime)}
                        </span>
                      </div>
                    ))}
                    {pctRemise(c) > 0 && (
                      <div className="vp-cmd-l" style={{ color: 'var(--green)' }}>
                        <span>Remise anniversaire −{num(pctRemise(c))} %</span>
                        <span style={{ fontWeight: 700 }}>
                          −{eur(montantRemise(totalLignes(c), c))}
                        </span>
                      </div>
                    )}
                    <div className="vp-tot" style={{ fontSize: 15 }}>
                      <span>Total</span>
                      <span className="r">{c.total_final == null ? '≈ ' : ''}{eur(totalDe(c))}</span>
                    </div>
                    {c.total_final == null && (
                      <div className="vp-mini">Montant estimé — il sera ajusté après la pesée.</div>
                    )}
                    <button className="vp-btn ghost sm" style={{ marginTop: 10 }}
                      onClick={() => imprimerFacture(c)}>Imprimer / PDF</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   CLIENT — interface de commande
============================================================ */
function Client({ settings, produits, now, fermetureAt, ouvertureAt, ouvert, estSemaine, ferie,
  jourOuvert, prochaineAt, forcee, enLigne, showToast,
  session, profil, profilCharge, chargerProfil }) {
  const repris = useMemo(() => lirePanierStocke(settings.date_vente), [settings.date_vente]);
  const [cart, setCart] = useState(() => (repris && repris.cart) || {});   // "produitId|varianteId" -> quantite
  const [choix, setChoix] = useState(() => (repris && repris.choix) || {}); // produitId -> variante choisie
  // produits demandés hors catalogue : [{ id, nom, quantite, unite, produit_id, emoji }]
  const [demandes, setDemandes] = useState(() => (repris && repris.demandes) || []);
  const [demNom, setDemNom] = useState('');
  const [demQte, setDemQte] = useState('1');
  const [demUnite, setDemUnite] = useState('piece');
  const [nom, setNom] = useState(() => (repris && repris.nom) || '');
  const [tel, setTel] = useState(() => (repris && repris.tel) || '');
  const [note, setNote] = useState(() => (repris && repris.note) || '');
  const [envoi, setEnvoi] = useState(false);
  const [done, setDone] = useState(null);
  const [filtreCat, setFiltreCat] = useState('Tous');
  const [panierOuvert, setPanierOuvert] = useState(false);
  const [authOuvert, setAuthOuvert] = useState(false);
  const [modeAuth, setModeAuth] = useState('inscription');
  const [favoris, setFavoris] = useState([]);      // ids de produits
  const [derniere, setDerniere] = useState(null);  // dernière commande du client
  const [nbVoisins, setNbVoisins] = useState(0);   // commandes du jour
  const [photoZoom, setPhotoZoom] = useState(null); // { url, nom } affiché en grand
  const [ouvertes, setOuvertes] = useState([]); // rubriques dépliées
  const basculerRubrique = (cat) => setOuvertes((o) =>
    (o.includes(cat) ? o.filter((x) => x !== cat) : [...o, cat]));
  const [reponsesNonVues, setReponsesNonVues] = useState(0);
  const [theme, setTheme] = useState(lireTheme);
  const sombre = theme === 'sombre';
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme]);
  const basculerTheme = () => {
    const t = sombre ? 'clair' : 'sombre';
    setTheme(t);
    ecrireTheme(t);
  };
  /* « Mon compte » répond à l'adresse …/#compte : on peut donc en
     donner le lien direct dans un message WhatsApp. Si la personne
     n'est pas connectée, l'écran de connexion s'ouvre et elle arrive
     sur son compte juste après. */
  const [vueCompte, setVueCompte] = useState(
    typeof window !== 'undefined' && window.location.hash.includes('compte')
  );
  const ouvrirCompte = (v) => {
    setVueCompte(v);
    try {
      if (v) window.location.hash = 'compte';
      else if (window.location.hash.includes('compte')) window.location.hash = '';
    } catch (e) { /* adresse non modifiable : sans effet */ }
  };
  useEffect(() => {
    const onHash = () => setVueCompte(window.location.hash.includes('compte'));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const connecte = !!(session && session.user);
  // boutique fermée mais commandes acceptées pour la prochaine journée
  const infoPre = infoPrecommande(prochaineAt);
  const precommande = !ouvert && !!settings.precommande_active && !!infoPre;
  const peutCommander = ouvert || precommande;
  // session valide mais fiche client absente : inscription à terminer
  const profilManquant = connecte && profilCharge && !profil;

  // Arrivée sur …/#compte sans être connecté : on ouvre la connexion,
  // et le compte s'affiche juste après.
  useEffect(() => {
    if (vueCompte && !connecte) { setModeAuth('connexion'); setAuthOuvert(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vueCompte, connecte]);

  /* ---- code d'anniversaire ----
     C'est la base qui décide s'il y a un code et lequel : la fonction
     le crée au premier passage de la semaine d'anniversaire, et se
     contente de le relire ensuite. Le navigateur ne fait que
     l'afficher — il ne peut pas s'en inventer un. */
  const [codeAnniv, setCodeAnniv] = useState(null);
  const chargerCodeAnniv = async () => {
    if (!connecte) { setCodeAnniv(null); return; }
    const { data, error } = await supabase.rpc('generer_code_anniversaire');
    if (error || !data || !data.length) { setCodeAnniv(null); return; }
    const c = data[0];
    if (c.refus) { setCodeAnniv({ refus: c.refus, utilisable: false }); return; }
    if (!c.code) { setCodeAnniv(null); return; }
    const reste = Math.ceil((new Date(c.expire_le) - new Date()) / 86400000);
    setCodeAnniv({
      ...c,
      jours: reste,
      utilisable: !c.deja_utilise && new Date(c.expire_le) > new Date(),
    });
  };
  useEffect(() => { chargerCodeAnniv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte, profil && profil.date_naissance]);

  const [maCommande, setMaCommande] = useState(() => lireCommandeStockee(settings.date_vente));
  const [reprise, setReprise] = useState(false);

  /* ---- doublons de commande ----
     Le souvenir rangé dans le navigateur ne suffit pas : quelqu'un qui
     commande depuis son téléphone puis depuis son ordinateur, ou qui a
     vidé son cache, ne voit plus sa première commande et la refait en
     croyant qu'elle n'est pas passée. On interroge donc la base, qui
     seule connaît la vérité pour toute la personne et tous ses appareils. */
  const dateCible = precommande && infoPre ? infoPre.dateVente : settings.date_vente;
  const [dejaCommande, setDejaCommande] = useState([]);
  const [alerteDoublon, setAlerteDoublon] = useState(false);

  const chargerDeja = async () => {
    if (!connecte || !session || !session.user || !dateCible) { setDejaCommande([]); return; }
    const { data } = await supabase.from('viande_commandes')
      .select('id, created_at, total_estime, note, lignes:viande_commande_lignes(produit_nom, variante_nom, quantite, mode_vente, emoji)')
      .eq('user_id', session.user.id)
      .eq('date_vente', dateCible)
      .order('created_at', { ascending: true });
    setDejaCommande(data || []);
  };
  useEffect(() => {
    chargerDeja();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte, session ? session.user && session.user.id : null, dateCible]);

  // un produit en attente de préparation n'existe pas pour les voisins
  const dispo = produits.filter((p) => !p.brouillon && p.disponible && !p.rupture && !dlcDepassee(p));

  // recherche : insensible à la casse et aux accents, sur le nom,
  // la catégorie et les options (parfums, contenances)
  const [recherche, setRecherche] = useState('');
  const q = normaliser(recherche.trim());
  const visibles = !q ? dispo : dispo.filter((p) =>
    normaliser(p.nom).includes(q)
    || normaliser(libelleCat(catDe(p))).includes(q)
    || variantesDe(p).some((v) => normaliser(v.nom).includes(q)));

  const cats = CATEGORIES.filter((c) => visibles.some((p) => catDe(p) === c));
  const enPromo = visibles.filter((p) => p.promo);
  const source = filtreCat === 'PROMOS' ? enPromo : visibles;
  const favorisDispo = visibles.filter((p) => favoris.includes(String(p.id)));
  // produit mis en avant : une promo avec photo, en privilégiant
  // celle qui affiche une vraie remise
  // carrousel des promos
  const pisteRef = useRef(null);
  const [diapo, setDiapo] = useState(0);
  const mouvementDoux = () => {
    try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return true; }
  };
  const allerA = (i) => {
    const el = pisteRef.current;
    if (!el || !vedettes.length) return;
    const n = vedettes.length;
    const cible = ((i % n) + n) % n; // on boucle aux deux extrémités
    el.scrollTo({ left: cible * el.clientWidth, behavior: mouvementDoux() ? 'smooth' : 'auto' });
    setDiapo(cible);
  };
  // Descend jusqu'à la fiche du produit et la fait clignoter, sans
  // changer de rubrique : le carrousel reste en place au-dessus.
  const allerAuProduit = (p) => {
    const el = document.getElementById(`carte-liste-${p.id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: mouvementDoux() ? 'smooth' : 'auto' });
    el.classList.remove('vp-repere');
    // relance l'animation même si on retape sur la même promo
    requestAnimationFrame(() => el.classList.add('vp-repere'));
    setTimeout(() => el.classList.remove('vp-repere'), 1900);
  };
  // Ajout direct depuis le carrousel. Un produit à options exige de choisir
  // l'option : on emmène alors le client sur la fiche plutôt que d'ajouter
  // une option au hasard.
  const ajouterDepuisCarrousel = (e, p) => {
    e.stopPropagation();
    if (variantesDe(p).length > 0) { allerAuProduit(p); showToast('Choisis ton option'); return; }
    ajouter(p, null);
  };

  /* ---- rayons de la page d'accueil ----
     Un défilement horizontal par catégorie. Écrit comme une fonction
     et non comme un composant : un composant déclaré ici serait
     recréé à chaque frappe dans la recherche, et ferait sauter le
     défilement en cours. */
  const MAX_RAYON = 12;

  // Ce qu'on met en avant dans un rayon, dans l'ordre : les promos
  // (remise la plus forte d'abord), puis les nouveautés, puis le
  // reste dans l'ordre du catalogue.
  const produitsDuRayon = (cat) => {
    const liste = dispo.filter((p) => catDe(p) === cat);
    const score = (p) => (p.promo ? 0 : estNouveau(p) ? 1 : 2);
    return [...liste].sort((a2, b2) => {
      const d = score(a2) - score(b2);
      if (d !== 0) return d;
      if (a2.promo && b2.promo) return remiseDe(b2) - remiseDe(a2);
      return (Number(a2.ordre) || 0) - (Number(b2.ordre) || 0);
    }).slice(0, MAX_RAYON);
  };

  const ouvrirRayon = (cat) => {
    setFiltreCat(cat);
    if (!ouvertes.includes(cat)) basculerRubrique(cat);
    try { window.scrollTo({ top: 0, behavior: mouvementDoux() ? 'smooth' : 'auto' }); }
    catch (e) { /* sans effet */ }
  };

  const carteRail = (p) => {
    const v = varianteActive(p);
    const prix = prixVariante(p, v, 'prix_william');
    const auKilo = p.mode_vente !== 'piece_fixe';
    return (
      <div className="vp-rail-c" key={`rail-${p.id}`} role="button" tabIndex={0}
        onClick={() => allerAuProduit(p)}
        onKeyDown={(e) => { if (e.key === 'Enter') allerAuProduit(p); }}
        aria-label={`${p.nom}, voir la fiche`}>
        {p.photo_url
          ? <img className="vp-rail-img" src={p.photo_url} alt="" loading="lazy" decoding="async" />
          : (
            // même tuile dégradée que dans la liste : un produit sans
            // photo doit avoir l'air voulu, pas inachevé
            <div className="vp-rail-vide" style={{
              background: `linear-gradient(135deg, ${teintesDe(p)[0]} 0%, ${teintesDe(p)[1]} 100%)`,
            }}>
              <span className="vp-tuile-f" />
              <span className="vp-rail-emoji">{p.emoji || '🧺'}</span>
            </div>
          )}
        {p.promo
          ? <span className="vp-rail-eti">PROMO</span>
          : estNouveau(p) ? <span className="vp-rail-eti neuf">NOUVEAU</span> : null}
        <button className="vp-rail-plus" onClick={(e) => ajouterDepuisCarrousel(e, p)}
          aria-label={`Ajouter ${p.nom} au panier`}>+</button>
        <div className="vp-rail-b">
          <span className="vp-rail-nom">{p.nom}</span>
          <span className="vp-rail-prix">
            {eur(prix)}<span className="vp-rail-unite">{auKilo ? ' /kg' : ''}</span>
          </span>
        </div>
      </div>
    );
  };

  const rayon = (cat) => {
    const prods = produitsDuRayon(cat);
    if (prods.length < 3) return null;   // un rayon de deux articles ne vaut pas la place
    const total = dispo.filter((p) => catDe(p) === cat).length;
    return (
      <div className="vp-rayon" key={`rayon-${cat}`}>
        <div className="vp-rayon-t">
          <span className="vp-rayon-ico">{iconeCat(cat)}</span>
          <span className="vp-rayon-nom">{libelleCat(cat)}</span>
          <span className="vp-rayon-nb">{total}</span>
          <button className="vp-rayon-voir" onClick={() => ouvrirRayon(cat)}>
            Tout voir →
          </button>
        </div>
        <div className="vp-rail">{prods.map(carteRail)}</div>
      </div>
    );
  };

  const surDefilement = () => {
    const el = pisteRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== diapo) setDiapo(i);
  };

  // moins d'une heure avant la fermeture : on le dit clairement
  const resteMin = ouvert && !forcee && fermetureAt ? Math.floor((fermetureAt - now) / 60000) : null;
  const presse = resteMin != null && resteMin <= 60;

  // Vitrine : les promos avec photo, la plus forte remise en tête.
  const vedettes = enPromo.filter((p) => p.photo_url)
    .sort((a, b) => remiseDe(b) - remiseDe(a))
    .slice(0, MAX_CARROUSEL);

  useEffect(() => {
    if (filtreCat !== 'Tous' && filtreCat !== 'PROMOS' && !cats.includes(filtreCat)) setFiltreCat('Tous');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.join(',')]);

  // pendant une recherche ou sur une catégorie choisie, tout reste ouvert :
  // replier masquerait précisément ce qu'on vient de demander
  const toutDeplie = !!q || filtreCat !== 'Tous';

  const catsAffichees = (filtreCat === 'Tous' || filtreCat === 'PROMOS')
    ? CATEGORIES.filter((c) => source.some((p) => catDe(p) === c))
    : cats.filter((c) => c === filtreCat);

  // sauvegarde continue : rafraîchir la page ne perd plus rien
  useEffect(() => {
    if (Object.keys(cart).length === 0 && demandes.length === 0) { viderPanierStocke(); return; }
    ecrirePanierStocke({ date: settings.date_vente, cart, choix, nom, tel, note, demandes });
  }, [cart, choix, nom, tel, note, demandes, settings.date_vente]);

  // prévient une seule fois que le panier a été retrouvé
  const [reprisSignale, setReprisSignale] = useState(false);
  useEffect(() => {
    if (reprisSignale) return;
    if (repris && Object.keys(repris.cart || {}).length > 0) {
      setReprisSignale(true);
      showToast('Panier retrouvé');
    }
  }, [repris, reprisSignale, showToast]);

  // favoris du client
  useEffect(() => {
    const charger = async () => {
      if (!connecte) { setFavoris([]); return; }
      const { data } = await supabase.from('viande_favoris')
        .select('produit_id').eq('user_id', session.user.id);
      setFavoris((data || []).map((r) => String(r.produit_id)));
    };
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte, session]);

  useEffect(() => {
    if (!photoZoom) return;
    const onTouche = (e) => { if (e.key === 'Escape') setPhotoZoom(null); };
    window.addEventListener('keydown', onTouche);
    return () => window.removeEventListener('keydown', onTouche);
  }, [photoZoom]);

  const estFavori = (p) => favoris.includes(String(p.id));
  const basculerFavori = async (p) => {
    if (!connecte) { setModeAuth('connexion'); setAuthOuvert(true); return; }
    const id = String(p.id);
    if (estFavori(p)) {
      setFavoris((f) => f.filter((x) => x !== id));
      await supabase.from('viande_favoris').delete()
        .eq('user_id', session.user.id).eq('produit_id', p.id);
    } else {
      setFavoris((f) => [...f, id]);
      const { error } = await supabase.from('viande_favoris')
        .insert({ user_id: session.user.id, produit_id: p.id });
      if (error) { setFavoris((f) => f.filter((x) => x !== id)); showToast(messageErreur(error)); }
      else showToast('Ajouté à tes favoris');
    }
  };

  // historique du client : dernière commande + habitudes d'achat
  const [habitudes, setHabitudes] = useState([]); // [{produit_id, fois}]
  useEffect(() => {
    const charger = async () => {
      if (!connecte) { setDerniere(null); setHabitudes([]); return; }
      const { data } = await supabase.from('viande_commandes')
        .select('*, lignes:viande_commande_lignes(*)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }).limit(10);
      const liste = data || [];
      setDerniere(liste[0] || null);
      const compte = {};
      liste.forEach((c) => (c.lignes || []).forEach((l) => {
        const k = String(l.produit_id);
        compte[k] = (compte[k] || 0) + 1;
      }));
      setHabitudes(Object.entries(compte)
        .map(([produit_id, fois]) => ({ produit_id, fois }))
        .sort((a, b) => b.fois - a.fois));
    };
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte, session, done]);

  // réponses de l'organisateur pas encore vues par ce client
  useEffect(() => {
    const charger = async () => {
      if (!connecte) { setReponsesNonVues(0); return; }
      const { count } = await supabase.from('viande_sondage_reponses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .not('reponse_admin', 'is', null)
        .eq('reponse_vue', false);
      setReponsesNonVues(count || 0);
    };
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecte, session, vueCompte]);

  // combien de voisins ont déjà commandé aujourd'hui
  useEffect(() => {
    const charger = async () => {
      const { count } = await supabase.from('viande_commandes')
        .select('id', { count: 'exact', head: true })
        .eq('date_vente', settings.date_vente);
      setNbVoisins(count || 0);
    };
    charger();
    const t = setInterval(charger, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.date_vente, done]);

  const cle = (p, v) => `${p.id}|${v ? v.id : ''}`;
  // variante actuellement sélectionnée sur la fiche produit (la 1re par défaut)
  const varianteActive = (p) => {
    const vs = variantesDe(p);
    if (!vs.length) return null;
    return vs.find((v) => String(v.id) === String(choix[p.id])) || vs[0];
  };

  // produits commandés au moins deux fois et absents du panier du jour
  const oublis = habitudes
    .filter((h) => h.fois >= 2)
    .map((h) => dispo.find((p) => String(p.id) === h.produit_id))
    .filter((p) => p && !Object.keys(cart).some((k) => k.startsWith(`${p.id}|`)))
    .slice(0, 3);

  // remet au panier les produits de la dernière commande encore disponibles
  const reprendreDerniere = () => {
    if (!derniere) return;
    const n = {};
    let ignores = 0;
    (derniere.lignes || []).forEach((l) => {
      const p = dispo.find((x) => String(x.id) === String(l.produit_id));
      if (!p) { ignores += 1; return; }
      const vs = variantesDe(p);
      const v = l.variante_id ? vs.find((x) => String(x.id) === String(l.variante_id)) : null;
      if (vs.length && !v) { ignores += 1; return; }
      n[`${p.id}|${v ? v.id : ''}`] = Math.max(1, Math.round(Number(l.quantite) || 1));
    });
    if (Object.keys(n).length === 0) {
      showToast('Aucun produit de cette commande n\'est disponible');
      return;
    }
    setCart(n);
    setPanierOuvert(true);
    showToast(ignores > 0
      ? `Panier rempli — ${ignores} produit(s) indisponible(s) écarté(s)`
      : 'Ta dernière commande est dans le panier');
  };

  const setQty = (p, v, q) => {
    const k = cle(p, v);
    const val = Math.max(0, Math.round(q));
    setCart((c) => { const n = { ...c }; if (val <= 0) delete n[k]; else n[k] = val; return n; });
  };

  // Chaque ajout doit se voir : au 2e produit et aux suivants, la barre du
  // panier existe déjà et seul un chiffre changeait — trop discret,
  // surtout sur grand écran où la barre est loin du regard.
  const [pulse, setPulse] = useState(0);
  const ajouter = (p, v) => {
    setQty(p, v, (cart[cle(p, v)] || 0) + 1);
    setPulse((x) => x + 1);
    showToast(`${p.nom}${v ? ` — ${v.nom}` : ''} ajouté au panier`);
  };

  const lignes = Object.entries(cart).map(([k, q]) => {
    const sep = k.indexOf('|');
    const pid = k.slice(0, sep), vid = k.slice(sep + 1);
    const p = produits.find((x) => String(x.id) === pid);
    if (!p) return null;
    const vs = variantesDe(p);
    const v = vid ? vs.find((x) => String(x.id) === vid) : null;
    if (vs.length && !v) return null; // variante supprimée entre-temps
    return { k, p, v, q };
  }).filter(Boolean);

  const totalBrut = lignes.reduce((s, { p, v, q }) => s + sousTotalLigne(p, v, q, 'prix_william'), 0);
  // La remise d'anniversaire s'applique d'elle-même : rien à taper,
  // donc rien à mal taper.
  const remise = codeAnniv && codeAnniv.utilisable
    ? cts(totalBrut * Number(codeAnniv.pct) / 100) : 0;
  const total = cts(totalBrut - remise);
  // Nombre d'articles réel : on additionne les quantités.
  // Une ligne « au kilo » compte pour 1 (c'est une demande de poids,
  // pas un nombre de pièces).
  // le panier existe dès qu'il y a un produit ou une demande
  const panierPlein = lignes.length > 0 || demandes.length > 0;

  const nbArticles = lignes.reduce((s, { p, q }) =>
    s + (p.mode_vente === 'kg' ? 1 : Math.round(Number(q) || 0)), 0)
    + demandes.reduce((s, d) => s + (d.unite === 'kg' ? 1 : Math.round(Number(d.quantite) || 0)), 0);
  const aDuPese = lignes.some(({ p }) => MODES[p.mode_vente].pese);

  // Produits qu'on ne vend pas en ce moment : ils servent de suggestions,
  // un voisin qui les a déjà achetés les reconnaîtra.
  const horsVente = produits.filter((p) => !p.brouillon && (!p.disponible || p.rupture));

  const suggestions = (() => {
    const q2 = normaliser(demNom.trim());
    const base = q2
      ? horsVente.filter((p) => normaliser(p.nom).includes(q2) && normaliser(p.nom) !== q2)
      : horsVente;
    return base.slice(0, 6);
  })();

  const ajouterDemande = () => {
    const n = demNom.trim();
    if (n.length < 2) { showToast('Indique le produit souhaité'); return; }
    const qte = nombre(demQte);
    if (isNaN(qte) || qte <= 0) { showToast('Indique une quantité'); return; }
    // si le nom correspond à un produit connu, on le rattache
    const connu = horsVente.find((p) => normaliser(p.nom) === normaliser(n));
    setDemandes((d) => [...d, {
      id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      nom: connu ? connu.nom : n,
      quantite: qte,
      unite: demUnite,
      produit_id: connu ? connu.id : null,
      emoji: connu ? connu.emoji : '📝',
    }]);
    setDemNom(''); setDemQte('1'); setDemUnite('piece');
    showToast('Demande ajoutée — le prix te sera confirmé');
  };
  const retirerDemande = (id) => setDemandes((d) => d.filter((x) => x.id !== id));

  /* mode : undefined = envoi normal (on contrôle les doublons),
     'supplement' = commande en plus de la précédente,
     'remplacer'  = la précédente est supprimée puis remplacée. */
  const envoyer = async (mode) => {
    if (!connecte || !profil) { showToast('Connecte-toi pour commander'); setModeAuth('connexion'); setAuthOuvert(true); return; }
    if (profil.bloque) { showToast('Ton compte ne permet pas de commander — contacte-nous'); return; }
    if (lignes.length === 0 && demandes.length === 0) { showToast('Ton panier est vide'); return; }
    // une commande existe déjà pour cette journée : on demande ce qu'il faut en faire
    if (!mode && dejaCommande.length > 0) { setAlerteDoublon(true); return; }
    setEnvoi(true);
    try {
      if (mode === 'remplacer') {
        // on efface d'abord : si la suite échoue, la personne garde son
        // panier et peut renvoyer, plutôt que de se retrouver avec deux
        // commandes sans l'avoir voulu.
        for (const c of dejaCommande) {
          const { error: eSup } = await supabase.from('viande_commande_lignes').delete().eq('commande_id', c.id);
          if (eSup) throw eSup;
          const { error: eSup2 } = await supabase.from('viande_commandes').delete().eq('id', c.id);
          if (eSup2) throw eSup2;
        }
        viderCommandeStockee();
        setMaCommande(null);
      }
      const totalPatrice = lignes.reduce(
        (s, { p, v, q }) => s + sousTotalLigne(p, v, q, 'prix_patrice'), 0);

      /* Le code est consommé AVANT la commande, et c'est la base qui
         renvoie le pourcentage réellement accordé — pas le navigateur.
         Si la commande échoue ensuite, on rend le code. */
      let pctAccorde = 0;
      let codeUtilise = null;
      if (codeAnniv && codeAnniv.utilisable && lignes.length > 0) {
        const { data: p } = await supabase.rpc('utiliser_code_promo', { p_code: codeAnniv.code });
        pctAccorde = Number(p) || 0;
        if (pctAccorde > 0) codeUtilise = codeAnniv.code;
      }
      const brut = Math.round(totalBrut * 100) / 100;
      const net = Math.round((brut - brut * pctAccorde / 100) * 100) / 100;

      const { data: cmd, error } = await supabase.from('viande_commandes').insert({
        user_id: session.user.id,
        nom_client: profil.nom, telephone: profil.telephone, note: note.trim() || null,
        precommande,
        total_estime: net,
        total_patrice: Math.round(totalPatrice * 100) / 100,
        code_promo: codeUtilise,
        remise_pct: pctAccorde,
        // hors horaires, la commande rejoint la prochaine journée d'ouverture
        date_vente: precommande ? infoPre.dateVente : settings.date_vente,
      }).select().single();
      if (error) {
        // la commande n'existe pas : le code doit redevenir utilisable
        if (codeUtilise) await supabase.rpc('liberer_code_promo', { p_code: codeUtilise });
        throw error;
      }
      // on fige les valeurs effectives de la variante dans la ligne :
      // l'admin, l'export et les pesées n'ont ensuite rien à recalculer
      const rows = lignes.map(({ p, v, q }) => ({
        commande_id: cmd.id, produit_id: p.id, produit_nom: p.nom, mode_vente: p.mode_vente,
        emoji: p.emoji,
        variante_id: v ? String(v.id) : null,
        variante_nom: v ? v.nom : null,
        prix_patrice: prixVariante(p, v, 'prix_patrice'),
        prix_william: prixVariante(p, v, 'prix_william'),
        poids_moyen: p.mode_vente === 'piece_pesee' ? poidsVariante(p, v) : null,
        quantite: q,
        sous_total_estime: Math.round(sousTotalLigne(p, v, q, 'prix_william') * 100) / 100,
        // Champs des demandes, renseignés ici aussi : dans un envoi groupé,
        // Supabase remplit par du vide ce qu'une ligne ne précise pas, et
        // « demande » refuse le vide. Toutes les lignes doivent être identiques.
        demande: false,
        demande_origine: null,
      }));
      // demandes hors catalogue : lignes sans prix, à fixer dans l'onglet Pesées
      demandes.forEach((d) => rows.push({
        commande_id: cmd.id,
        produit_id: d.produit_id || null,
        produit_nom: d.nom,
        mode_vente: d.unite === 'kg' ? 'kg' : 'piece_fixe',
        emoji: d.emoji || '📝',
        variante_id: null,
        variante_nom: null,
        prix_patrice: 0,
        prix_william: 0,
        poids_moyen: null,
        quantite: d.quantite,
        sous_total_estime: 0,
        demande: true,
        demande_origine: d.nom,
      }));
      const { error: e2 } = await supabase.from('viande_commande_lignes').insert(rows);
      if (e2) {
        // L'en-tête est déjà enregistré : sans ses lignes, il deviendrait une
        // commande vide dans l'admin. On le retire avant de signaler l'erreur.
        await supabase.from('viande_commandes').delete().eq('id', cmd.id);
        if (codeUtilise) await supabase.rpc('liberer_code_promo', { p_code: codeUtilise });
        throw e2;
      }
      // alerte (ne bloque jamais la commande)
      const resume = [
        ...lignes.map(({ p, v, q }) => `• ${p.nom}${v ? ` (${v.nom})` : ''} x${num(q)}`),
        ...demandes.map((d) => `• 📝 DEMANDE : ${d.nom} ${d.unite === 'kg' ? `${num(d.quantite)} kg` : `x${num(d.quantite)}`}`),
      ].join('\n');
      const entete = mode === 'supplement'
        ? `⚠️ COMMANDE EN SUPPLÉMENT (${dejaCommande.length + 1}ᵉ du jour)`
        : mode === 'remplacer'
          ? '♻️ COMMANDE REMPLACÉE (la précédente est supprimée)'
          : (precommande ? '🌙 PRÉCOMMANDE (hors horaires)' : '🥩 Nouvelle commande');
      envoyerAlerteWhatsApp(settings,
        entete
        + `\n${profil.nom} — ${profil.telephone}`
        + `${precommande ? `\nPour le ${infoPre.ouverture}` : ''}\n\n${resume}\n\n`
        + (pctAccorde > 0 ? `Sous-total : ${eur(brut)}\n🎂 Remise anniversaire −${num(pctAccorde)} % : −${eur(brut - net)}\n` : '')
        + `Total estimé : ${eur(net)}`
        + (note.trim() ? `\nNote : ${note.trim()}` : ''));

      // mémorisé pour permettre une modification ultérieure
      const memo = {
        date: precommande ? infoPre.dateVente : settings.date_vente, id: cmd.id, nom: profil.nom,
        heure: Date.now(), cart, choix, tel: profil.telephone, note: note.trim(),
        // total au moment de l'envoi : sert à détecter une retouche faite
        // depuis l'admin avant que la personne ne reprenne sa commande
        total: net,
      };
      ecrireCommandeStockee(memo);
      setMaCommande(memo);

      setDone({
        nom: profil.nom, total: net, aDuPese, pre: precommande ? infoPre : null,
        mode: mode || null, rang: dejaCommande.length + 1,
        remise: pctAccorde > 0 ? { pct: pctAccorde, montant: cts(brut - net) } : null,
      });
      if (codeUtilise) chargerCodeAnniv(); // le code vient d'être consommé
      setAlerteDoublon(false);
      setPanierOuvert(false);
      viderPanierStocke();
      setCart({}); setChoix({}); setDemandes([]); setNom(''); setTel(''); setNote('');
      chargerDeja(); // la liste des commandes du jour est à relire
    } catch (e) {
      // le détail part dans la console pour le diagnostic ; le client garde
      // son panier intact et peut renvoyer
      console.error('Envoi de commande impossible :', e);
      showToast(`Commande non envoyée — ${messageErreur(e) || 'réessaie dans un instant'}. Ton panier est conservé.`);
      setAlerteDoublon(false);
      chargerDeja(); // l'état réel a peut-être changé entre-temps
    } finally { setEnvoi(false); }
  };

  // supprime la commande en base (lignes puis en-tête)
  const supprimerMaCommande = async (id) => {
    await supabase.from('viande_commande_lignes').delete().eq('commande_id', id);
    const { error } = await supabase.from('viande_commandes').delete().eq('id', id);
    return !error;
  };

  const reprendreCommande = async () => {
    if (!maCommande) return;

    /* La commande a-t-elle été retouchée entre-temps ? Un voisin envoie
       souvent un SMS (« rajoute-moi deux saucissons ») et la commande est
       corrigée côté organisateur. Remettre l'ancien panier effacerait
       cette correction sans que personne ne s'en aperçoive. */
    let retouchee = false;
    if (maCommande.total != null) {
      const { data: actuelle } = await supabase.from('viande_commandes')
        .select('total_estime').eq('id', maCommande.id).maybeSingle();
      if (actuelle && Math.abs((Number(actuelle.total_estime) || 0) - Number(maCommande.total)) > 0.01) {
        retouchee = true;
      }
    }

    if (!window.confirm(retouchee
      ? 'Attention : ta commande a été ajustée depuis que tu l\'as envoyée '
        + '(un ajout ou un retrait demandé par message, par exemple).\n\n'
        + 'Si tu la reprends maintenant, tu repartiras de ce que TU avais commandé '
        + 'au départ, et cet ajustement sera perdu.\n\n'
        + 'Continuer quand même ?'
      : 'Reprendre ta commande pour la modifier ?\n\n'
        + 'Elle est retirée de la liste et remise dans ton panier. '
        + 'Pense à la renvoyer une fois tes changements faits.'
    )) return;
    if (!(await supprimerMaCommande(maCommande.id))) { showToast('Impossible pour le moment'); return; }
    setCart(maCommande.cart || {});
    setChoix(maCommande.choix || {});
    setNom(maCommande.nom || '');
    setTel(maCommande.tel || '');
    setNote(maCommande.note || '');
    viderCommandeStockee();
    setMaCommande(null);
    setDone(null);
    setReprise(true);
    setPanierOuvert(true);
    chargerDeja();
    showToast('Commande remise dans ton panier');
  };

  const annulerCommande = async () => {
    if (!maCommande) return;
    if (!window.confirm('Annuler définitivement ta commande ?')) return;
    if (!(await supprimerMaCommande(maCommande.id))) { showToast('Impossible pour le moment'); return; }
    viderCommandeStockee();
    setMaCommande(null);
    setDone(null);
    chargerDeja();
    showToast('Commande annulée');
  };

  /* Annule une commande connue de la base mais pas du navigateur : le cas
     de celle passée depuis un autre appareil. On ne peut pas la remettre
     dans le panier (son contenu n'est pas mémorisé ici), mais on doit au
     moins permettre de la supprimer. */
  const annulerCommandeDistante = async (c) => {
    if (!window.confirm(
      `Annuler définitivement la commande de ${new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} `
      + `(${eur(c.total_estime)}) ?`
    )) return;
    if (!(await supprimerMaCommande(c.id))) { showToast('Impossible pour le moment'); return; }
    if (maCommande && maCommande.id === c.id) { viderCommandeStockee(); setMaCommande(null); }
    chargerDeja();
    showToast('Commande annulée');
  };

  if (done) {
    return (
      <div className="vp-app">
        <div className="vp-confirm">
          <div className="vp-check">✓</div>
          <h1 style={{ fontSize: 26 }}>Commande envoyée !</h1>
          <p style={{ color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
            Merci {done.nom}. Total estimé : <b>{done.aDuPese ? '≈ ' : ''}{eur(done.total)}</b>.<br />
            {done.aDuPese && (
              <><br /><b>Ce total est une estimation</b> : les produits au kilo seront recalculés
              au poids réel à la livraison. Tu recevras ta note définitive.</>
            )}
          </p>
          {done.remise && (
            <div className="vp-prec-panier" style={{ marginTop: 18, textAlign: 'left' }}>
              <b>🎂 Remise anniversaire appliquée</b>
              −{num(done.remise.pct)} % sur ta commande, soit {eur(done.remise.montant)} en moins.
              Joyeux anniversaire&nbsp;!
            </div>
          )}
          {done.mode === 'remplacer' && (
            <div className="vp-rupt-note" style={{ marginTop: 18, textAlign: 'left' }}>
              ♻️ Ta commande précédente a été <b>supprimée</b> : seule celle-ci compte.
            </div>
          )}
          {done.mode === 'supplement' && (
            <div className="vp-rupt-note" style={{ marginTop: 18, textAlign: 'left' }}>
              ⚠️ Enregistrée <b>en supplément</b> : c'est ta {done.rang}ᵉ commande.
              Tu auras donc tout à récupérer et à régler.
            </div>
          )}
          {done.pre && (
            <div className="vp-prec-panier" style={{ marginTop: 18, textAlign: 'left' }}>
              <b>🌙 Enregistrée pour la réouverture</b>
              Elle sera traitée <b>{done.pre.ouverture}</b>, pour un retrait
              le <b>{done.pre.retrait}</b>.
            </div>
          )}

          <div className="vp-note" style={{ marginTop: 20, textAlign: 'left' }}>
            Besoin de changer quelque chose ? Reviens sur la boutique&nbsp;:
            tu pourras modifier ou annuler ta commande tant qu'elle est ouverte.
          </div>
          <button className="vp-btn ghost" style={{ marginTop: 16 }} onClick={() => setDone(null)}>
            Retour à la boutique
          </button>
          <div><BoutonWhatsApp url={settings.whatsapp_url} libelle="Rejoindre le groupe WhatsApp" /></div>
        </div>
      </div>
    );
  }

  // Carte produit, écrite comme une fonction et non un composant :
  // un composant défini ici serait remonté à chaque frappe et ferait
  // sauter le focus des champs de la page.
  // « ou » distingue les deux endroits où un produit peut apparaître
  // (liste de sa catégorie, rubrique favoris) pour cibler le bon.
  const carteProduit = (p, ou = 'liste') => {
              const m = MODES[p.mode_vente];
              const vs = variantesDe(p);
              const v = varianteActive(p);
              const q = cart[cle(p, v)] || 0;
              const prix = prixVariante(p, v, 'prix_william');
              const pm = poidsVariante(p, v);
              return (
                <div className="vp-prod" key={p.id} id={`carte-${ou}-${p.id}`}>
                  <button className={`vp-etoile ${estFavori(p) ? 'on' : ''}`}
                    onClick={() => basculerFavori(p)}
                    aria-label={estFavori(p) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    title={estFavori(p) ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                    {estFavori(p) ? '★' : '☆'}
                  </button>
                  {p.photo_url
                    ? <button className="vp-photo-wrap"
                        onClick={() => setPhotoZoom({ url: p.photo_url, nom: p.nom })}
                        aria-label={`Agrandir la photo de ${p.nom}`}>
                        <img src={p.photo_url} alt={p.nom} className="vp-photo"
                          loading="lazy" decoding="async" />
                        <span className="vp-photo-loupe">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                          </svg>
                        </span>
                      </button>
                    : <div className="vp-tuile" style={{
                        background: `linear-gradient(135deg, ${teintesDe(p)[0]} 0%, ${teintesDe(p)[1]} 100%)`,
                      }}>
                        <span className="vp-tuile-f" />
                        <span className="vp-tuile-e">{p.emoji}</span>
                      </div>}
                  <div className="vp-pinfo">
                    <div className="vp-pname">
                      {p.origine_fr && <DrapeauFR taille={14} />}
                      {p.nom}
                      {p.promo && <span className="vp-badge-promo"><span className="vp-eclair">⚡</span>PROMO</span>}
                      {estNouveau(p) && <span className="vp-badge-neuf">NOUVEAU</span>}
                    </div>
                    <div className="vp-pmeta">
                      <span className="vp-tag">{m.label}</span>
                      {p.mode_vente === 'piece_pesee' && pm
                        ? <span>≈ {num(pm)} kg/pièce</span> : null}
                      {infoDlc(p.dlc) && (
                        <span className={`vp-dlc ${infoDlc(p.dlc).classe}`}>{infoDlc(p.dlc).texte}</span>
                      )}
                    </div>
                    {vs.length > 0 && (
                      <select
                        className="vp-variante"
                        value={v ? v.id : ''}
                        onChange={(e) => setChoix((c) => ({ ...c, [p.id]: e.target.value }))}
                        aria-label={p.variante_label || 'Option'}
                      >
                        {vs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nom}
                            {vide0(o.prix_william) ? '' : ` · ${eur(o.prix_william)}${m.suffixe}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <div style={{ marginTop: 4 }}>
                      {p.prix_barre > 0 && p.prix_barre > prix && (
                        <>
                          <span className="vp-prix-barre">{eur(p.prix_barre)}</span>
                          <span className="vp-remise">
                            −{Math.round((1 - prix / Number(p.prix_barre)) * 100)}%
                          </span>
                        </>
                      )}
                      <span className="vp-price">{eur(prix)}{m.suffixe}</span>
                    </div>
                  </div>
                  <div className="vp-step">
                    {q > 0 && <button onClick={() => setQty(p, v, q - 1)}>−</button>}
                    {q > 0 && <span className="vp-qty">{num(q)}</span>}
                    {q > 0 && <button onClick={() => ajouter(p, v)}>+</button>}
                    {q <= 0 && <button className="vp-add" onClick={() => ajouter(p, v)}>Ajouter</button>}
                  </div>
                </div>
              );  };

  if (vueCompte && connecte && profil) {
    return (
      <MonCompte settings={settings} profil={profil} chargerProfil={chargerProfil}
        onFermer={() => ouvrirCompte(false)} showToast={showToast} />
    );
  }

  return (
    <div className={`vp-app ${peutCommander && (panierPlein || panierOuvert) ? 'vp-avec-panier' : ''} ${settings.whatsapp_url ? 'vp-avec-wa' : ''}`}>
      <div className="vp-mini">
        <span className="vp-mini-m">{settings.titre}</span>
        <button className="vp-theme" onClick={basculerTheme}
          aria-label={sombre ? 'Passer en mode jour' : 'Passer en mode nuit'}
          title={sombre ? 'Passer en mode jour' : 'Passer en mode nuit'}>
          <span className="vp-theme-ico">{sombre ? '☀️' : '🌙'}</span>
          <span className="vp-theme-txt">{sombre ? 'Jour' : 'Nuit'}</span>
        </button>
        <span className={`vp-mini-c ${!ouvert ? 'fer' : presse ? 'presse' : 'ouv'}`}>
          <span className="vp-dot" />
          {ouvert
            ? (fermetureAt && fermetureAt > now
                ? `Fermeture ${new Date(fermetureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Ouvert')
            : 'Fermé'}
        </span>
      </div>

      {connecte && profil ? (
        <button className="vp-compte-pill on" onClick={() => ouvrirCompte(true)}
          aria-label={reponsesNonVues > 0 ? `Mon compte — ${reponsesNonVues} nouvelle(s) réponse(s)` : 'Mon compte'}>
          <span className="vp-initiale">
            {(profil.nom || '?').trim().charAt(0).toUpperCase()}
            {reponsesNonVues > 0 && <span className="vp-pastille-neuf">{reponsesNonVues}</span>}
          </span>
          <span className="vp-compte-nom">{profil.nom}</span>
        </button>
      ) : (
        <div className="vp-auth-liens">
          <button className="vp-lien-auth" onClick={() => { setModeAuth('connexion'); setAuthOuvert(true); }}>
            Se connecter
          </button>
          <button className="vp-lien-auth plein" onClick={() => { setModeAuth('inscription'); setAuthOuvert(true); }}>
            S'inscrire
          </button>
        </div>
      )}
      <button className="vp-admin-icon" onClick={() => { window.location.hash = 'admin'; }} aria-label="Espace organisateur" title="Espace organisateur">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <div className="vp-head">
        <img src="/logo-mouton.png" alt="" className="vp-logo" />
        <h1 className="vp-title">{settings.titre}</h1>
        <Countdown fermetureAt={fermetureAt} now={now} ouvert={ouvert}
          venteActive={settings.vente_active} prochaineAt={prochaineAt} forcee={forcee} />
        {settings.message_accueil && <div className="vp-note">{settings.message_accueil}</div>}
        <Sondage settings={settings} showToast={showToast} session={session} profil={profil}
          onConnexion={() => { setModeAuth('connexion'); setAuthOuvert(true); }} />
      </div>

      {profilManquant && (
        <>
          <div className="vp-backdrop" />
          <div className="vp-dock">
            <EcranProfilManquant session={session} chargerProfil={chargerProfil} showToast={showToast} />
          </div>
        </>
      )}

      {authOuvert && !profilManquant && (
        <>
          <div className="vp-backdrop" onClick={() => setAuthOuvert(false)} />
          <div className="vp-dock">
            <EcranAuth showToast={showToast} modeInitial={modeAuth}
              onFermer={() => setAuthOuvert(false)}
              onFait={() => { setAuthOuvert(false); setPanierOuvert(true); }} />
          </div>
        </>
      )}

      {codeAnniv && codeAnniv.refus && (
        <div className="vp-rupt-note" style={{ marginTop: 14 }}>🎂 {codeAnniv.refus}</div>
      )}

      {codeAnniv && codeAnniv.utilisable && (
        <div className="vp-prec-panier" style={{ marginTop: 14 }}>
          <b>🎂 Joyeux anniversaire {profil ? profil.nom : ''} !</b>
          Ton code <b>{codeAnniv.code}</b> t'offre <b>−{num(codeAnniv.pct)} %</b> sur
          une commande. Il s'applique tout seul au moment de valider — rien à saisir.
          {codeAnniv.jours > 0
            ? ` Valable encore ${codeAnniv.jours} jour${codeAnniv.jours > 1 ? 's' : ''}.`
            : " Dernier jour !"}
        </div>
      )}

      {maCommande && (
        <div className={`vp-macmd ${ouvert ? '' : 'fermee'}`}>
          <div>
            <b>Ta commande est enregistrée</b>
            <small>
              Envoyée à {new Date(maCommande.heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {ouvert
                ? ' · modifiable tant que la boutique est ouverte'
                : ' · les commandes sont closes, contacte-nous sur WhatsApp pour un changement'}
            </small>
          </div>
          {ouvert && (
            <div className="vp-macmd-b">
              <button className="vp-btn sm" onClick={reprendreCommande}>Modifier</button>
              <button className="vp-btn ghost sm" onClick={annulerCommande}>Annuler</button>
            </div>
          )}
        </div>
      )}

      {/* Commandes connues de la base mais pas de ce navigateur : passées
          depuis un autre appareil, ou après un vidage du cache. Sans ce
          rappel, la personne les croit perdues et recommande. */}
      {dejaCommande
        .filter((c) => !maCommande || maCommande.id !== c.id)
        .map((c) => (
          <div className={`vp-macmd ${ouvert ? '' : 'fermee'}`} key={c.id}>
            <div>
              <b>Commande enregistrée de {new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b>
              <small>
                {(c.lignes || []).length} article(s) · {eur(c.total_estime)}
                {ouvert ? ' · passée depuis un autre appareil' : ' · les commandes sont closes'}
              </small>
            </div>
            {ouvert && (
              <div className="vp-macmd-b">
                <button className="vp-btn ghost sm" onClick={() => annulerCommandeDistante(c)}>Annuler</button>
              </div>
            )}
          </div>
        ))}

      {reprise && !maCommande && lignes.length > 0 && (
        <div className="vp-rupt-note" style={{ marginTop: 12 }}>
          Ta commande a été retirée de la liste. Modifie ton panier puis <b>renvoie-la</b>,
          sinon elle ne sera pas prise en compte.
        </div>
      )}

      {!peutCommander ? (
        <div className="vp-ferme">
          <span className="vp-ferme-ico">🕑</span>
          <b>
            {ferie ? `Fermé — ${ferie}`
              : !jourOuvert ? 'Fermé ce jour'
              : 'Commandes fermées pour le moment'}
          </b>
          <small>
            Pas de livraisons ni de retrait les week-ends et jours fériés.
            {prochaineAt && <><br /><b className="vp-reouv">{texteReouverture(prochaineAt)}</b></>}
          </small>
          <span className="vp-masque"> Reviens à la prochaine promo&nbsp;!</span>
        </div>
      ) : dispo.length === 0 ? (
        <div className="vp-empty">Aucun produit pour l'instant.</div>
      ) : (
        <>
          <div className="vp-cat-nav">
            <div className="vp-search">
              <span className="vp-search-ico">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                className="vp-input"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un produit…"
                type="search"
                autoComplete="off"
                aria-label="Rechercher un produit"
              />
              {recherche && (
                <button className="vp-search-clear" onClick={() => setRecherche('')} aria-label="Effacer la recherche">×</button>
              )}
            </div>

            {/* Mobile : menu déroulant natif.
                PROMOS y figure toujours, même vide — c'est une rubrique
                de la boutique, pas un filtre qui va et vient. */}
            <select
              className="vp-cat-select"
              value={filtreCat}
              onChange={(e) => setFiltreCat(e.target.value)}
            >
              <option value="Tous">Tous les produits</option>
              <option value="PROMOS">⚡ PROMOS{enPromo.length > 0 ? ` (${enPromo.length})` : ''}</option>
              {cats.map((cat) => (
                <option key={cat} value={cat}>{iconeCat(cat)} {libelleCat(cat)}</option>
              ))}
            </select>

            {/* Ordinateur : pastilles */}
            <div className="vp-tabs">
              <button className={`vp-tab tout ${filtreCat === 'Tous' ? 'on' : ''}`}
                onClick={() => setFiltreCat('Tous')}>Tout</button>
              <button className={`vp-tab vp-tab-promo ${filtreCat === 'PROMOS' ? 'on' : ''}`}
                onClick={() => setFiltreCat('PROMOS')}>
                <span className="vp-eclair">⚡</span>PROMOS
                {enPromo.length > 0 && <span className="vp-tab-nb">{enPromo.length}</span>}
              </button>
              {cats.map((cat) => (
                <button key={cat} className={`vp-tab ${filtreCat === cat ? 'on' : ''}`} onClick={() => setFiltreCat(cat)}>
                  <span className="vp-tab-ico">{iconeCat(cat)}</span>{libelleCat(cat)}
                </button>
              ))}
            </div>
          </div>

          {q && (
            <div className="vp-resultats">
              {visibles.length === 0
                ? <>Aucun produit ne correspond à « {recherche.trim()} ».</>
                : <>{visibles.length} produit{visibles.length > 1 ? 's' : ''} trouvé{visibles.length > 1 ? 's' : ''}</>}
              <button className="vp-trash" style={{ marginTop: 0, marginLeft: 8 }}
                onClick={() => { setRecherche(''); setFiltreCat('Tous'); }}>
                Tout afficher
              </button>
            </div>
          )}

          {vedettes.length > 0 && !q && filtreCat === 'Tous' && (
            <div className="vp-car" aria-roledescription="carrousel" aria-label="Promos du moment">
              <h2 className="vp-car-titre">
                <span className="vp-car-eclair">⚡</span>
                <span className="vp-car-mot">Promo{vedettes.length > 1 ? 's' : ''} flash</span>
              </h2>
              <div className="vp-car-piste" ref={pisteRef} onScroll={surDefilement}>
                {vedettes.map((p, i) => {
                  const dejaQte = Object.keys(cart)
                    .filter((k) => k.startsWith(`${p.id}|`))
                    .reduce((t, k) => t + (cart[k] || 0), 0);
                  return (
                    <div key={p.id} className="vp-hero vp-car-diapo" role="button" tabIndex={0}
                      onClick={() => allerAuProduit(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter') allerAuProduit(p); }}
                      aria-label={`Promo ${i + 1} sur ${vedettes.length} — ${p.nom}, voir la fiche`}>
                      <img src={p.photo_url} alt=""
                        loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                      <span className="voile" />
                      <span className="txt">
                        <span className="eti">
                          <span className="vp-eclair">⚡</span>{i === 0 ? 'LA PROMO DU JOUR' : 'PROMO'}
                        </span>
                        <h2>{p.nom}</h2>
                        <span className="vp-car-bas">
                          <span className="lp">
                            {p.prix_barre > 0 && p.prix_barre > p.prix_william && (
                              <span className="ba">{eur(p.prix_barre)}</span>
                            )}
                            <span className="ac">{eur(p.prix_william)}{MODES[p.mode_vente].suffixe}</span>
                          </span>
                          <button className="vp-car-ajout" onClick={(e) => ajouterDepuisCarrousel(e, p)}>
                            {dejaQte > 0 ? `+1 · ${num(dejaQte)} au panier` : 'Ajouter'}
                          </button>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {vedettes.length > 1 && (
                <>
                  <button className="vp-car-fl g" onClick={() => allerA(Math.min(diapo, vedettes.length - 1) - 1)} aria-label="Promo précédente">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                  </button>
                  <button className="vp-car-fl d" onClick={() => allerA(Math.min(diapo, vedettes.length - 1) + 1)} aria-label="Promo suivante">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                  <div className="vp-car-rang">
                    {Math.min(diapo, vedettes.length - 1) + 1} / {vedettes.length}
                  </div>
                  {vedettes.length <= 10 ? (
                    <div className="vp-car-pts">
                      {vedettes.map((p, i) => (
                        <button key={p.id} className={i === Math.min(diapo, vedettes.length - 1) ? 'on' : ''}
                          onClick={() => allerA(i)} aria-label={`Aller à la promo ${i + 1}`} />
                      ))}
                    </div>
                  ) : (
                    <div className="vp-car-cpt">
                      {Math.min(diapo, vedettes.length - 1) + 1} / {vedettes.length}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {precommande && (
            <div className="vp-prec">
              <span className="vp-prec-ico">🌙</span>
              <div>
                <b>La boutique est fermée, mais tu peux commander</b>
                <small>
                  Ta commande sera prise en compte <b>{infoPre.ouverture}</b>,
                  à la réouverture, pour un retrait le <b>{infoPre.retrait}</b>.
                </small>
              </div>
            </div>
          )}

          {presse && (
            <div className="vp-urgence">
              <span className="vp-urgence-ico">⏳</span>
              <b>
                {resteMin <= 1 ? 'Dernière minute pour commander'
                  : `Plus que ${resteMin} minutes pour commander`}
              </b>
            </div>
          )}

          {(nbVoisins >= 2 || enLigne >= 2) && !q && (
            <div className="vp-social">
              <span className="vp-social-pt" />
              {enLigne >= 2 && (
                <span>{enLigne} personnes regardent la boutique en ce moment</span>
              )}
              {enLigne >= 2 && nbVoisins >= 2 && <span className="vp-social-sep">·</span>}
              {nbVoisins >= 2 && (
                <span>{nbVoisins} ont déjà commandé aujourd'hui</span>
              )}
            </div>
          )}

          {derniere && !q && filtreCat === 'Tous' && lignes.length === 0 && (
            <button className="vp-rappel" onClick={reprendreDerniere}>
              <span className="vp-rappel-ico">🔁</span>
              <span>
                <b>Reprendre ma dernière commande</b>
                <small>
                  {(derniere.lignes || []).length} produit(s) ·
                  {' '}{new Date(derniere.created_at).toLocaleDateString('fr-FR')}
                </small>
              </span>
              <span className="vp-sondage-fl">›</span>
            </button>
          )}

          {favorisDispo.length > 0 && !q && filtreCat === 'Tous' && (
            <div>
              <div className="vp-cat"><span className="vp-cat-ico">⭐</span>Mes favoris</div>
              {favorisDispo.map((p) => carteProduit(p, 'fav'))}
            </div>
          )}

          {filtreCat === 'PROMOS' && source.length === 0 && (
            <div className="vp-promo-vide">
              <span className="vp-eclair" style={{ fontSize: 24 }}>⚡</span>
              <b>Oups, il n'y a rien à voir pour le moment</b>
              <button className="vp-btn ghost sm" style={{ marginTop: 12 }} onClick={() => setFiltreCat('Tous')}>
                Voir tous les produits
              </button>
            </div>
          )}

          {catsAffichees.length > 1 && !toutDeplie && (
            <div className="vp-rub-tout">
              <button className="vp-trash" style={{ marginTop: 0 }}
                onClick={() => setOuvertes(
                  ouvertes.length >= catsAffichees.length ? [] : catsAffichees)}>
                {ouvertes.length >= catsAffichees.length ? 'Tout replier' : 'Tout déplier'}
              </button>
            </div>
          )}

          {/* Les rayons ne s'affichent que sur l'accueil : pendant une
              recherche ou dans une catégorie, on veut la liste, pas
              une vitrine. */}
          {!q && filtreCat === 'Tous' && (
            <>
              {CATEGORIES.filter((c) => dispo.some((p) => catDe(p) === c)).map(rayon)}
              <div className="vp-rayon-sep">
                Tout le catalogue, rubrique par rubrique
              </div>
            </>
          )}

          {catsAffichees.map((cat) => {
            const prods = source.filter((p) => catDe(p) === cat);
            if (prods.length === 0) return null;
            const ouverte = toutDeplie || ouvertes.includes(cat);
            return (
              <div className="vp-rub" key={cat}>
                <button className={`vp-rub-t ${ouverte ? 'on' : ''}`}
                  onClick={() => basculerRubrique(cat)}
                  aria-expanded={ouverte}>
                  <span className="vp-rub-ico">{iconeCat(cat)}</span>
                  <span className="vp-rub-nom">{libelleCat(cat)}</span>
                  <span className="vp-rub-nb">{prods.length}</span>
                  <span className="vp-rub-trait" />
                  <svg className="vp-rub-ch" width="17" height="17" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {ouverte && (
                  <div className="vp-rub-c">
                    {prods.map((p) => carteProduit(p, 'liste'))}
                  </div>
                )}
              </div>
            );
          })}

          {!q && (
            <button className="vp-demande-lien"
              onClick={() => { setPanierOuvert(true); }}>
              <span className="vp-rappel-ico">📝</span>
              <span>
                <b>Un produit manque à la liste ?</b>
                <small>Demande un produit déjà proposé, on te confirme le prix</small>
              </span>
              <span className="vp-sondage-fl">›</span>
            </button>
          )}
        </>
      )}

      {photoZoom && (
        <div className="vp-visionneuse" onClick={() => setPhotoZoom(null)} role="dialog" aria-modal="true">
          <button className="vp-visionneuse-x" onClick={() => setPhotoZoom(null)} aria-label="Fermer">×</button>
          <img src={photoZoom.url} alt={photoZoom.nom} onClick={(e) => e.stopPropagation()} />
          <div className="vp-visionneuse-nom">{photoZoom.nom}</div>
        </div>
      )}

      {alerteDoublon && dejaCommande.length > 0 && (
        <div className="vp-doublon" role="dialog" aria-modal="true" aria-label="Commande déjà enregistrée">
          <div className="vp-doublon-boite">
            <div className="vp-doublon-tete">
              <span className="vp-doublon-ico">⚠️</span>
              <h3>
                Tu as déjà {dejaCommande.length > 1 ? `${dejaCommande.length} commandes` : 'une commande'} enregistrée
                {precommande ? ' pour la réouverture' : " aujourd'hui"}
              </h3>
            </div>

            <div className="vp-doublon-txt">
              Si tu valides maintenant, ce panier viendra <b>s'ajouter</b> à
              {dejaCommande.length > 1 ? ' ces commandes' : ' cette commande'} : tu auras
              tout à récupérer et à payer.
            </div>

            {dejaCommande.map((c) => (
              <div className="vp-doublon-cmd" key={c.id}>
                <b>
                  Commande de {new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </b>
                <ul>
                  {(c.lignes || []).map((l, i) => (
                    <li key={i}>
                      {l.emoji ? `${l.emoji} ` : ''}{nomLigne(l)}
                      {' · '}
                      {l.mode_vente === 'kg' ? `${num(l.quantite)} kg` : `x${num(l.quantite)}`}
                    </li>
                  ))}
                  {(c.lignes || []).length === 0 && <li>détail indisponible</li>}
                </ul>
                <div className="tot">Total estimé : {eur(c.total_estime)}</div>
              </div>
            ))}

            <div className="vp-doublon-b">
              <button className="vp-cta" disabled={envoi} onClick={() => envoyer('remplacer')}>
                {envoi ? 'Envoi…' : dejaCommande.length > 1
                  ? 'Remplacer — ne garder que ce panier'
                  : "Remplacer — c'était une erreur"}
              </button>
              <button className="vp-btn" disabled={envoi} onClick={() => envoyer('supplement')}>
                Ajouter en supplément — je veux les deux
              </button>
              <button className="vp-btn ghost" disabled={envoi} onClick={() => setAlerteDoublon(false)}>
                Revenir à mon panier
              </button>
            </div>

            <div className="vp-doublon-txt" style={{ marginTop: 14, fontSize: 13 }}>
              « Remplacer » supprime définitivement
              {dejaCommande.length > 1 ? ' les commandes ci-dessus' : ' la commande ci-dessus'} et
              ne garde que le panier en cours.
            </div>
          </div>
        </div>
      )}

      <PastilleWhatsApp url={settings.whatsapp_url} haut={peutCommander && (panierPlein || panierOuvert)} />

      <div className="vp-pied">
        <div className="vp-credit">
          <a href="https://enkraj.fr" target="_blank" rel="noreferrer noopener">Enkraj.fr</a>
        </div>
        <div className="vp-ver">v{VERSION}</div>
      </div>

      {peutCommander && (panierPlein || panierOuvert) && (
        <>
          {panierOuvert && <div className="vp-backdrop" onClick={() => setPanierOuvert(false)} />}

          <div className="vp-dock">
            {panierOuvert && (
              <div className="vp-sheet">
                <div className="vp-sheet-head">
                  <span className="vp-th" style={{ marginBottom: 0 }}>Ton panier</span>
                  <button className="vp-sheet-x" onClick={() => setPanierOuvert(false)} aria-label="Fermer le panier">×</button>
                </div>

                {lignes.map(({ k, p, v, q }) => {
                  const m = MODES[p.mode_vente];
                  const prix = prixVariante(p, v, 'prix_william');
                  const st = sousTotalLigne(p, v, q, 'prix_william');
                  const detail =
                    p.mode_vente === 'kg' ? `${num(q)} kg × ${eur(prix)}`
                    : p.mode_vente === 'piece_pesee' ? `${num(q)} pièce(s) · prix au poids réel`
                    : `${num(q)} × ${eur(prix)}`;
                  return (
                    <div className="vp-sline" key={k}>
                      <span className="l">
                        {p.emoji} {p.origine_fr && <DrapeauFR taille={12} />}{p.nom}{v ? ` — ${v.nom}` : ''}
                        <small>{detail}</small>
                      </span>
                      <span className="vp-step">
                        <button onClick={() => setQty(p, v, q - 1)} aria-label="Retirer un">−</button>
                        <span className="vp-qty">{num(q)}</span>
                        <button onClick={() => setQty(p, v, q + 1)} aria-label="Ajouter un">+</button>
                      </span>
                      <span className="r">{m.pese && p.mode_vente === 'piece_pesee' ? '≈ ' : ''}{eur(st)}</span>
                    </div>
                  );
                })}

                <div className="vp-demandes">
                  <b>Un produit qui n'est pas dans la liste ?</b>
                  <small>Un produit déjà proposé et que tu aimerais retrouver. Le prix te sera confirmé.</small>

                  {demandes.map((d) => (
                    <div className="vp-demande-l" key={d.id}>
                      <span className="l">
                        {d.emoji} {d.nom}
                        <small>{d.unite === 'kg' ? `${num(d.quantite)} kg` : `${num(d.quantite)} pièce(s)`} · prix à confirmer</small>
                      </span>
                      <button className="vp-demande-x" onClick={() => retirerDemande(d.id)} aria-label={`Retirer ${d.nom}`}>×</button>
                    </div>
                  ))}

                  <div className="vp-demande-f">
                    <label className="vp-label" style={{ margin: 0 }}>Écris le produit comme tu veux</label>
                    <input className="vp-input" value={demNom}
                      onChange={(e) => setDemNom(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && ajouterDemande()}
                      placeholder="Ex : une belle côte de bœuf pour 4" autoComplete="off" />

                    {suggestions.length > 0 && (
                      <div className="vp-sugg">
                        <span className="vp-sugg-t">
                          {demNom.trim() ? 'Tu penses peut-être à :' : 'Déjà proposés par le passé :'}
                        </span>
                        {suggestions.map((p) => (
                          <button key={p.id} className="vp-sugg-b" onClick={() => setDemNom(p.nom)}>
                            {p.emoji} {p.nom}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="vp-demande-q">
                      <input className="vp-input" value={demQte} inputMode="decimal"
                        onChange={(e) => setDemQte(e.target.value)} aria-label="Quantité" />
                      <select className="vp-input" value={demUnite} onChange={(e) => setDemUnite(e.target.value)} aria-label="Unité">
                        <option value="piece">pièce(s)</option>
                        <option value="kg">kg</option>
                      </select>
                      <button className="vp-btn ghost sm" onClick={ajouterDemande}>+ Ajouter</button>
                    </div>
                  </div>
                </div>

                {oublis.length > 0 && (
                  <div className="vp-oublis">
                    <b>Tu prends ça d'habitude</b>
                    {oublis.map((p) => {
                      const vs = variantesDe(p);
                      const v = vs.length ? vs[0] : null;
                      const m = MODES[p.mode_vente];
                      return (
                        <div className="vp-oubli-l" key={p.id}>
                          <span className="l">
                            {p.emoji} {p.nom}{v ? ` — ${v.nom}` : ''}
                            <small>{eur(prixVariante(p, v, 'prix_william'))}{m.suffixe}</small>
                          </span>
                          <button className="vp-add" onClick={() => ajouter(p, v)}>Ajouter</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {precommande && (
                  <div className="vp-prec-panier">
                    <b>🌙 Commande pour la réouverture</b>
                    Elle sera traitée <b>{infoPre.ouverture}</b>, avec les autres commandes
                    de la journée, pour un retrait le <b>{infoPre.retrait}</b>.
                    Les prix et les produits disponibles peuvent évoluer d'ici là.
                  </div>
                )}

                <div className="vp-tot"><span>Total estimé</span><span className="r">{lignes.length === 0 ? 'à confirmer' : `${aDuPese ? '≈ ' : ''}${eur(total)}`}</span></div>
                {demandes.length > 0 && lignes.length > 0 && (
                  <div className="vp-mini">+ {demandes.length} demande(s) dont le prix te sera confirmé.</div>
                )}
                {aDuPese && (
                  <div className="vp-avert">
                    <b>⚠️ Ce montant n'est qu'une estimation.</b>
                    Les produits au kilo sont calculés sur un <b>poids moyen</b>. Les pièces étant toutes
                    différentes, le poids réel — et donc le prix — <b>sera différent</b>. Le montant définitif
                    te sera communiqué après la pesée chez le fournisseur.
                  </div>
                )}
                <button className="vp-trash" onClick={() => setCart({})}>Vider le panier</button>

                {connecte && profil ? (
                  <>
                    <div className="vp-identite">
                      <div>
                        <b>{profil.nom}</b>
                        <small>{profil.telephone}</small>
                      </div>
                      <button className="vp-trash" style={{ marginTop: 0 }}
                        onClick={() => { setPanierOuvert(false); ouvrirCompte(true); }}>
                        Mon compte
                      </button>
                    </div>
                    {remise > 0 && (
                      <div className="vp-prec-panier" style={{ marginTop: 10 }}>
                        <b>🎂 Remise anniversaire −{num(codeAnniv.pct)} %</b>
                        Sous-total {eur(totalBrut)} · remise −{eur(remise)} ·
                        <b> à payer {eur(total)}</b>.
                        Appliquée automatiquement, rien à saisir.
                      </div>
                    )}
                    <div className="vp-field">
                      <label className="vp-label">Un mot pour la commande (facultatif)</label>
                      <textarea className="vp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : je passe vers 18h…" />
                    </div>
                    {dejaCommande.length > 0 && (
                      <div className="vp-rupt-note" style={{ marginBottom: 12 }}>
                        ⚠️ Tu as déjà {dejaCommande.length > 1 ? `${dejaCommande.length} commandes` : 'une commande'} enregistrée
                        {precommande ? ' pour la réouverture' : " aujourd'hui"}
                        {' '}({eur(dejaCommande.reduce((s, c) => s + (Number(c.total_estime) || 0), 0))}).
                        Au moment de valider, on te demandera si ce panier s'ajoute à
                        {dejaCommande.length > 1 ? ' ces commandes' : ' cette commande'} ou s'il
                        la remplace.
                      </div>
                    )}
                    <button className="vp-cta" disabled={envoi} onClick={() => envoyer()}>
                      {envoi ? 'Envoi…'
                        : lignes.length === 0 ? 'Envoyer ma demande'
                        : precommande ? `Commander pour la réouverture · ${aDuPese ? '≈ ' : ''}${eur(total)}`
                        : `Envoyer ma commande · ${aDuPese ? '≈ ' : ''}${eur(total)}`}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="vp-note" style={{ textAlign: 'left' }}>
                      Un compte est nécessaire pour commander. Il te permet de retrouver
                      tes commandes et tes produits habituels.
                    </div>
                    <div className="vp-grid2" style={{ marginTop: 14 }}>
                      <button className="vp-btn ghost" onClick={() => { setPanierOuvert(false); setModeAuth('connexion'); setAuthOuvert(true); }}>
                        Se connecter
                      </button>
                      <button className="vp-btn" onClick={() => { setPanierOuvert(false); setModeAuth('inscription'); setAuthOuvert(true); }}>
                        S'inscrire
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <button className="vp-bar" key={`bar-${pulse}`} onClick={() => setPanierOuvert((o) => !o)}>
              <span className="vp-bar-l">
                <span className="vp-bar-ico">🧺<span className="vp-bar-badge">{nbArticles}</span></span>
                <span className="vp-bar-txt">
                  <b>{nbArticles} article{nbArticles > 1 ? 's' : ''}</b>
                  <small>
                    {connecte && profil
                      ? `${salutation(now)} ${profil.nom} · ${panierOuvert ? 'masquer' : 'voir et valider'}`
                      : (panierOuvert ? 'Masquer le panier' : 'Connexion requise pour valider')}
                  </small>
                </span>
              </span>
              <span className="vp-bar-r">
                {lignes.length === 0 ? 'à confirmer' : `${aDuPese ? '≈ ' : ''}${eur(total)}`}
                <svg className={`vp-bar-chev ${panierOuvert ? 'on' : ''}`} width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   ADMIN
============================================================ */
function Admin({ settings, produits, ouvert, estSemaine, enLigne, reload, showToast }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinVisible, setPinVisible] = useState(false);
  const [tab, setTab] = useState('commandes');
  const [commandes, setCommandes] = useState([]);
  const [nonLus, setNonLus] = useState(0);

  // messages du questionnaire pas encore lus
  const compterNonLus = async () => {
    const { count } = await supabase.from('viande_sondage_reponses')
      .select('id', { count: 'exact', head: true }).eq('lu', false);
    setNonLus(count || 0);
  };
  useEffect(() => {
    if (!unlocked) return;
    compterNonLus();
    const t = setInterval(compterNonLus, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  // Journée de vente consultée. Par défaut celle en cours, mais on peut
  // revenir sur une journée passée — c'est indispensable pour saisir les
  // poids le lendemain, une fois la date de vente passée au jour suivant.
  const [dateTravail, setDateTravail] = useState(aujourdhuiStr());
  const [journees, setJournees] = useState([]);

  const chargerJournees = async () => {
    const { data } = await supabase
      .from('viande_commandes').select('date_vente')
      .order('date_vente', { ascending: false });
    const uniques = [...new Set((data || []).map((r) => r.date_vente).filter(Boolean))];
    setJournees(uniques);
  };

  const loadCommandes = async () => {
    const { data } = await supabase
      .from('viande_commandes')
      .select('*, lignes:viande_commande_lignes(*)')
      .eq('date_vente', dateTravail)
      .order('created_at', { ascending: true });
    if (data) setCommandes(data);
  };
  useEffect(() => {
    if (!unlocked) return;
    chargerJournees();
    loadCommandes();
    const ch = supabase.channel('viande_cmd')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_commandes' }, () => { loadCommandes(); chargerJournees(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_commande_lignes' }, loadCommandes)
      .subscribe();
    const poll = setInterval(loadCommandes, 30000); // le temps réel fait le reste
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, dateTravail, settings.date_vente]);

  // Les onglets travaillent sur la journée choisie, pas sur celle en cours.
  const settingsJour = useMemo(
    () => ({ ...settings, date_vente: dateTravail }),
    [settings, dateTravail]
  );
  const fmtJournee = (d) => {
    try {
      return new Date(d + 'T00:00:00')
        .toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    } catch (e) { return d; }
  };

  const check = () => {
    if (pin === String(settings.pin_admin)) setUnlocked(true);
    else { showToast('Code incorrect'); setPin(''); }
  };

  if (!unlocked) {
    return (
      <div className="vp-app vp-admin">
        <style>{CSS}</style>
        <div className="vp-gate">
          <h2 style={{ fontSize: 22 }}>Espace organisateur</h2>
          <p style={{ color: 'var(--muted)', margin: '8px 0 18px' }}>Saisis ton code.</p>
          <div className="vp-mdp">
            <input className="vp-input" value={pin} onChange={(e) => setPin(e.target.value)}
              inputMode="numeric" type={pinVisible ? 'text' : 'password'} placeholder="Code"
              style={{ textAlign: 'center', letterSpacing: 4 }}
              onKeyDown={(e) => e.key === 'Enter' && check()} />
            <BoutonOeil visible={pinVisible} onClick={() => setPinVisible(!pinVisible)} />
          </div>
          <button className="vp-cta" style={{ marginTop: 14 }} onClick={check}>Entrer</button>
          <button className="vp-foot" style={{ background: 'none', color: 'var(--muted)', marginTop: 18, textDecoration: 'underline' }}
            onClick={() => { window.location.hash = ''; }}>← Retour à la boutique</button>
        </div>
      </div>
    );
  }

  const TABS = [
    ['commandes', `Commandes (${commandes.length})`],
    ['produits', 'Produits'],
    ['export', 'Export'],
    ['pesees', 'Pesées'],
    ['membres', 'Membres'],
    ['sondage', nonLus > 0 ? `Sondage (${nonLus})` : 'Sondage'],
    ['reglages', 'Réglages'],
  ];

  return (
    <div className="vp-app vp-admin">
      <div className="vp-tabs vp-nav">
        {TABS.map(([k, lbl]) => (
          <button key={k} className={`vp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{lbl}</button>
        ))}
      </div>

      <div className={`vp-live ${enLigne > 0 ? 'on' : ''}`}>
        <span className="vp-live-pt" />
        {enLigne === 0
          ? 'Personne sur la boutique en ce moment'
          : `${enLigne} visiteur${enLigne > 1 ? 's' : ''} sur la boutique en ce moment`}
      </div>

      {nonLus > 0 && tab !== 'sondage' && (
        <button className="vp-alerte-msg" onClick={() => setTab('sondage')}>
          <span className="vp-alerte-ico">💬</span>
          <span>
            <b>{nonLus} nouveau{nonLus > 1 ? 'x' : ''} message{nonLus > 1 ? 's' : ''}</b>
            <small>dans le questionnaire — appuie pour lire et répondre</small>
          </span>
          <span className="vp-sondage-fl">›</span>
        </button>
      )}

      {(journees.length > 0 || dateTravail !== settings.date_vente) && (
        <div className={`vp-journee ${dateTravail !== aujourdhuiStr() ? 'passee' : ''}`}>
          <label htmlFor="journee">Journée</label>
          <select id="journee" className="vp-quick-select" value={dateTravail}
            onChange={(e) => setDateTravail(e.target.value)}>
            {!journees.includes(aujourdhuiStr()) && (
              <option value={aujourdhuiStr()}>{fmtJournee(aujourdhuiStr())} — aujourd'hui</option>
            )}
            {journees.map((d) => (
              <option key={d} value={d}>
                {fmtJournee(d)}{d === aujourdhuiStr() ? " — aujourd'hui" : ''}
              </option>
            ))}
          </select>
          {dateTravail !== aujourdhuiStr() && (
            <button className="vp-btn ghost sm" onClick={() => setDateTravail(aujourdhuiStr())}>
              Revenir à aujourd'hui
            </button>
          )}
        </div>
      )}

      {commandes.length === 0 && dateTravail === aujourdhuiStr() && journees.length > 0 && (
        <div className="vp-rupt-note" style={{ marginBottom: 14, background: '#FFF8EC', borderColor: '#F1DFBC', color: '#7A5A20' }}>
          Aucune commande aujourd'hui.{' '}
          <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => setDateTravail(journees[0])}>
            Voir le {fmtJournee(journees[0])}
          </button>
        </div>
      )}

      {tab === 'commandes' && <AdminCommandes commandes={commandes} ouvert={ouvert} reload={loadCommandes} showToast={showToast}
        produits={produits} settings={settingsJour} />}
      {tab === 'produits' && <AdminProduits produits={produits} settings={settingsJour} reload={reload} showToast={showToast} />}
      {tab === 'export' && <AdminExport commandes={commandes} produits={produits} settings={settingsJour} showToast={showToast} />}
      {tab === 'pesees' && <AdminPesees commandes={commandes} produits={produits} settings={settingsJour} reload={loadCommandes} showToast={showToast} />}
      {tab === 'membres' && <AdminMembres showToast={showToast} settings={settingsJour} />}
      {tab === 'sondage' && <AdminSondage settings={settings} reload={reload} showToast={showToast} onLu={() => setNonLus(0)} />}
      {tab === 'reglages' && <AdminReglages settings={settings} commandes={commandes} estSemaine={estSemaine} reload={reload} showToast={showToast} />}

      <div className="vp-foot">
        <button onClick={() => { window.location.hash = ''; }}>← Voir la boutique</button>
      </div>
    </div>
  );
}

/* ---------- Admin : saisie d'une commande pour un tiers ----------
   Deux usages : compléter la commande de quelqu'un après un oubli,
   ou créer une commande pour une personne qui n'est pas passée par
   la boutique. La saisie ignore le calendrier et les horaires. */
function AdminSaisie({ commandes, produits, settings, onFait, onFermer, showToast }) {
  const [mode, setMode] = useState(commandes.length > 0 ? 'ajout' : 'nouvelle');
  const [cibleId, setCibleId] = useState(commandes[0] ? commandes[0].id : '');
  const [membres, setMembres] = useState([]);
  const [membreId, setMembreId] = useState('');
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState('');
  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState(null);
  const [varId, setVarId] = useState('');
  const [qte, setQte] = useState('1');
  const [poidsReel, setPoidsReel] = useState('');
  const [lignes, setLignes] = useState([]); // { cle, p, v, q, pr }

  // montant d'une ligne : sur le poids réel s'il est connu, sinon estimé
  const montantLigne = (p, v, q2, pr, champ) => (
    pr != null ? pr * prixVariante(p, v, champ) : sousTotalLigne(p, v, q2, champ)
  );
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    supabase.from('viande_clients').select('id, nom, telephone, alias_whatsapp')
      .order('nom').then(({ data }) => setMembres(data || []));
  }, []);

  const choisirMembre = (id) => {
    setMembreId(id);
    const m = membres.find((x) => String(x.id) === String(id));
    if (m) { setNom(m.nom); setTel(m.telephone || ''); }
  };

  const q = normaliser(recherche.trim());
  const trouves = q
    ? produits.filter((p) => normaliser(p.nom).includes(q)).slice(0, 8)
    : [];

  const prendre = (p) => {
    setChoisi(p);
    const vs = variantesDe(p);
    setVarId(vs.length ? String(vs[0].id) : '');
    setQte(p.mode_vente === 'kg' ? '1' : '1');
    setRecherche('');
  };

  const ajouterLigne = () => {
    if (!choisi) return;
    const n = nombre(qte);
    if (isNaN(n) || n <= 0) { showToast('Quantité invalide'); return; }
    const vs = variantesDe(choisi);
    const v = vs.length ? vs.find((x) => String(x.id) === String(varId)) || vs[0] : null;
    const q2 = choisi.mode_vente === 'kg' ? n : Math.round(n);
    let pr = null;
    if (choisi.mode_vente !== 'piece_fixe' && poidsReel.trim() !== '') {
      pr = nombre(poidsReel);
      if (isNaN(pr) || pr <= 0) { showToast('Poids invalide'); return; }
    }
    setLignes((l) => [...l, { cle: `${choisi.id}|${v ? v.id : ''}|${Date.now()}`, p: choisi, v, q: q2, pr }]);
    setChoisi(null); setQte('1'); setPoidsReel('');
  };

  const total = lignes.reduce((t, { p, v, q: q2, pr }) => t + montantLigne(p, v, q2, pr, 'prix_william'), 0);
  const totalPat = lignes.reduce((t, { p, v, q: q2, pr }) => t + montantLigne(p, v, q2, pr, 'prix_patrice'), 0);

  const valider = async () => {
    if (lignes.length === 0) { showToast('Ajoute au moins un produit'); return; }
    if (mode === 'nouvelle' && !nom.trim()) { showToast('Indique le prénom'); return; }
    if (mode === 'ajout' && !cibleId) { showToast('Choisis la commande à compléter'); return; }
    setEnvoi(true);
    try {
      let commandeId = cibleId;
      if (mode === 'nouvelle') {
        const { data: cmd, error } = await supabase.from('viande_commandes').insert({
          user_id: membreId || null,
          nom_client: nom.trim(),
          telephone: tel.trim() || null,
          note: note.trim() || null,
          total_estime: cts(total),
          total_patrice: cts(totalPat),
          date_vente: settings.date_vente,
        }).select().single();
        if (error) throw error;
        commandeId = cmd.id;
      }

      const rows = lignes.map(({ p, v, q: q2, pr }) => ({
        commande_id: commandeId,
        produit_id: p.id,
        produit_nom: p.nom,
        mode_vente: p.mode_vente,
        emoji: p.emoji,
        variante_id: v ? String(v.id) : null,
        variante_nom: v ? v.nom : null,
        prix_patrice: prixVariante(p, v, 'prix_patrice'),
        prix_william: prixVariante(p, v, 'prix_william'),
        poids_moyen: p.mode_vente === 'piece_pesee' ? poidsVariante(p, v) : null,
        quantite: q2,
        sous_total_estime: cts(sousTotalLigne(p, v, q2, 'prix_william')),
        // poids déjà connu : la ligne arrive pesée, rien à ressaisir aux pesées
        poids_reel: pr,
        sous_total_final: pr != null ? cts(pr * prixVariante(p, v, 'prix_william')) : null,
        demande: false,
        demande_origine: null,
      }));
      const { error: e2 } = await supabase.from('viande_commande_lignes').insert(rows);
      if (e2) {
        if (mode === 'nouvelle') await supabase.from('viande_commandes').delete().eq('id', commandeId);
        throw e2;
      }

      if (mode === 'ajout') {
        // on cumule avec l'existant ; le total définitif sera recalculé aux pesées
        const cible = commandes.find((c) => String(c.id) === String(cibleId));
        await supabase.from('viande_commandes').update({
          total_estime: cts(Number(cible ? cible.total_estime : 0) + total),
          total_patrice: cts(Number(cible ? cible.total_patrice : 0) + totalPat),
          total_final: null,
          statut: 'en_cours',
        }).eq('id', commandeId);
      }

      showToast(mode === 'ajout' ? 'Produits ajoutés à la commande' : 'Commande créée');
      onFait();
    } catch (e) {
      showToast(messageErreur(e) || 'Enregistrement impossible');
    } finally { setEnvoi(false); }
  };

  const vsChoisi = choisi ? variantesDe(choisi) : [];

  return (
    <div className="vp-section vp-saisie">
      <div className="vp-srow">
        <div className="vp-h2" style={{ fontSize: 17 }}>Saisir pour quelqu'un</div>
        <button className="vp-sheet-x" onClick={onFermer} aria-label="Fermer">×</button>
      </div>

      <div className="vp-seg" style={{ marginTop: 12 }}>
        <button className={mode === 'ajout' ? 'on' : ''} disabled={commandes.length === 0}
          onClick={() => setMode('ajout')}>Compléter une commande</button>
        <button className={mode === 'nouvelle' ? 'on' : ''} onClick={() => setMode('nouvelle')}>
          Nouvelle commande
        </button>
      </div>

      {mode === 'ajout' ? (
        <div className="vp-field">
          <label className="vp-label">Commande à compléter</label>
          <select className="vp-input" value={cibleId} onChange={(e) => setCibleId(e.target.value)}>
            {commandes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom_client} · {new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {eur(c.total_estime)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          {membres.length > 0 && (
            <div className="vp-field">
              <label className="vp-label">Membre inscrit (facultatif)</label>
              <select className="vp-input" value={membreId} onChange={(e) => choisirMembre(e.target.value)}>
                <option value="">— Personne sans compte —</option>
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}{m.alias_whatsapp ? ` (${m.alias_whatsapp})` : ''}
                  </option>
                ))}
              </select>
              <div className="vp-sub" style={{ marginTop: 4 }}>
                Choisir un membre rattache la commande à son compte : il la verra dans son profil.
              </div>
            </div>
          )}
          <div className="vp-grid2" style={{ marginTop: 12 }}>
            <div>
              <label className="vp-label">Prénom *</label>
              <input className="vp-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Marie" />
            </div>
            <div>
              <label className="vp-label">Téléphone (facultatif)</label>
              <input className="vp-input" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" />
            </div>
          </div>
        </>
      )}

      <div className="vp-field">
        <label className="vp-label">Ajouter un produit</label>
        {choisi ? (
          <div className="vp-saisie-choix">
            <b>{choisi.emoji} {choisi.nom}</b>
            {vsChoisi.length > 0 && (
              <select className="vp-input" value={varId} onChange={(e) => setVarId(e.target.value)}>
                {vsChoisi.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
              </select>
            )}
            <div className="vp-saisie-q">
              <label className="vp-saisie-c">
                <span>Quantité</span>
                <input className="vp-input" value={qte} inputMode="decimal"
                  onChange={(e) => setQte(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ajouterLigne()} />
                <em>{choisi.mode_vente === 'kg' ? 'kg' : 'pièce(s)'}</em>
              </label>
              {choisi.mode_vente !== 'piece_fixe' && (
                <label className="vp-saisie-c">
                  <span>Poids réel</span>
                  <input className="vp-input" value={poidsReel} inputMode="decimal"
                    onChange={(e) => setPoidsReel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ajouterLigne()}
                    placeholder="facultatif" />
                  <em>kg</em>
                </label>
              )}
            </div>
            <div className="vp-saisie-q">
              <button className="vp-btn sm" onClick={ajouterLigne}>Ajouter la ligne</button>
              <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => { setChoisi(null); setPoidsReel(''); }}>Annuler</button>
            </div>
          </div>
        ) : (
          <>
            <input className="vp-input" value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Tape le nom d'un produit…" autoComplete="off" />
            {trouves.length > 0 && (
              <div className="vp-sugg" style={{ marginTop: 8 }}>
                {trouves.map((p) => (
                  <button key={p.id} className="vp-sugg-b" onClick={() => prendre(p)}>
                    {p.emoji} {p.nom}{!p.disponible || p.rupture ? ' · hors vente' : ''}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="vp-liste" style={{ marginTop: 12 }}>
          {lignes.map(({ cle, p, v, q: q2, pr }) => (
            <div className="vp-liste-l" key={cle}>
              <span>
                {p.emoji} {p.nom}{v ? ` — ${v.nom}` : ''}
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                  {p.mode_vente === 'kg' ? `${num(q2)} kg` : `${num(q2)} pièce(s)`}
                  {pr != null && <> · pesé {num(pr)} kg</>}
                </small>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b>{p.mode_vente === 'piece_fixe' || pr != null ? '' : '≈ '}{eur(montantLigne(p, v, q2, pr, 'prix_william'))}</b>
                <button className="vp-demande-x" onClick={() => setLignes((l) => l.filter((x) => x.cle !== cle))}
                  aria-label="Retirer">×</button>
              </span>
            </div>
          ))}
          <div className="vp-liste-l tot"><span>Total estimé</span><b>{eur(total)}</b></div>
        </div>
      )}

      {mode === 'nouvelle' && (
        <div className="vp-field">
          <label className="vp-label">Note (facultatif)</label>
          <input className="vp-input" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Ex : oubli de la commande de mardi" />
        </div>
      )}

      <button className="vp-cta" disabled={envoi || lignes.length === 0} onClick={valider}>
        {envoi ? 'Enregistrement…'
          : mode === 'ajout' ? 'Ajouter à cette commande' : 'Créer la commande'}
      </button>
      <div className="vp-sub" style={{ marginTop: 8, textAlign: 'center' }}>
        Journée : {fmtDateCourt(settings.date_vente)}. Les poids et prix se corrigent ensuite dans Pesées.
      </div>
    </div>
  );
}

/* ---------- Admin : Commandes ---------- */
function AdminCommandes({ commandes, ouvert, reload, showToast, produits, settings }) {
  const [saisie, setSaisie] = useState(false);
  const total = commandes.reduce((s, c) => s + Number(c.total_estime || 0), 0);
  const marge = commandes.reduce((s, c) => s + (Number(c.total_estime || 0) - Number(c.total_patrice || 0)), 0);

  // Voisins inscrits qui n'ont pas commandé sur cette journée.
  // L'oubli est la première cause de non-commande : un rappel ciblé
  // à 18 h vaut mieux qu'un message de plus dans le groupe.
  const [absents, setAbsents] = useState([]);
  const [voirAbsents, setVoirAbsents] = useState(false);
  const [alias, setAlias] = useState({}); // user_id -> nom WhatsApp

  useEffect(() => {
    const charger = async () => {
      const [{ data: clients }, reps] = await Promise.all([
        supabase.from('viande_clients').select('id, nom, telephone, bloque, alias_whatsapp'),
        chargerReperes(),
      ]);
      const a = {};
      (clients || []).forEach((c) => { if (c.alias_whatsapp) a[String(c.id)] = c.alias_whatsapp; });
      Object.keys(reps).forEach((k) => { if (reps[k].repere) a[k] = reps[k].repere; });
      setAlias(a);
      const { data: histo } = await supabase.from('viande_commandes')
        .select('user_id, created_at');
      const dejaLa = new Set(commandes.map((c) => String(c.user_id)));
      const derniereFois = {};
      (histo || []).forEach((h) => {
        if (!h.user_id) return;
        const k = String(h.user_id);
        const t = new Date(h.created_at).getTime();
        if (!derniereFois[k] || t > derniereFois[k]) derniereFois[k] = t;
      });
      const liste = (clients || [])
        .filter((c) => !c.bloque && !dejaLa.has(String(c.id)))
        .map((c) => {
          const t = derniereFois[String(c.id)];
          return {
            ...c,
            dernier: t || null,
            jours: t ? Math.floor((Date.now() - t) / 86400000) : null,
          };
        })
        .sort((a, b) => {
          if (a.dernier && b.dernier) return a.dernier - b.dernier; // les plus anciens d'abord
          if (a.dernier) return -1;
          return b.dernier ? 1 : 0;
        });
      setAbsents(liste);
    };
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandes]);

  const texteRelance = () => {
    let t = '📣 À relancer\n\n';
    absents.forEach((a) => {
      t += `${a.nom}${a.alias_whatsapp ? ` (${a.alias_whatsapp})` : ''} — ${a.telephone}`;
      t += a.jours === null ? ' (jamais commandé)\n' : ` (dernière fois il y a ${a.jours} j)\n`;
    });
    return t;
  };

  /* ---- repérage des doublons ----
     Une même personne qui apparaît deux fois sur la journée. C'est
     parfois voulu (un ajout de dernière minute), souvent une erreur :
     on le signale sans trancher, c'est à toi de vérifier avant de
     donner la liste à Patrice. */
  const cleClient = (c) => String(c.user_id || c.telephone || c.nom_client || '');
  const cmdDuClient = (c) => commandes.filter((x) => cleClient(x) === cleClient(c));
  const rangClient = (c) => cmdDuClient(c).findIndex((x) => x.id === c.id) + 1;
  const clientsEnDouble = [...new Set(commandes.map(cleClient))]
    .map((k) => commandes.filter((c) => cleClient(c) === k))
    .filter((g) => g.length > 1);

  const suppr = async (c) => {
    if (!window.confirm(`Supprimer la commande de ${c.nom_client} ?`)) return;
    await supabase.from('viande_commandes').delete().eq('id', c.id);
    showToast('Commande supprimée'); reload();
  };

  /* ============================================================
     MODIFICATION D'UNE COMMANDE DÉJÀ PASSÉE
     « Rajoute-moi deux saucissons, enlève le poulet » : ça arrive par
     SMS tous les jours. Jusqu'ici il fallait tout supprimer et ressaisir.
     Les changements sont préparés en brouillon puis enregistrés d'un
     coup, comme dans l'onglet Pesées — rien ne part en base tant que
     tu n'as pas appuyé sur Enregistrer.
  ============================================================ */
  const [editId, setEditId] = useState(null);     // commande en cours de modification
  const [modifs, setModifs] = useState({});       // id de ligne -> { qte, suppr }
  const [ajouts, setAjouts] = useState([]);       // lignes à créer
  const [majEnCours, setMajEnCours] = useState(false);

  // formulaire d'ajout de ligne
  const [aNom, setANom] = useState('');
  const [aProduit, setAProduit] = useState(null);
  const [aVar, setAVar] = useState('');
  const [aQte, setAQte] = useState('1');
  // produit hors catalogue : le nom est libre, les prix doivent être saisis
  const [aPat, setAPat] = useState('');
  const [aWil, setAWil] = useState('');
  const [aKilo, setAKilo] = useState(false);

  const videAjout = () => {
    setANom(''); setAProduit(null); setAVar(''); setAQte('1');
    setAPat(''); setAWil(''); setAKilo(false);
  };

  const fermerEdition = () => {
    setEditId(null); setModifs({}); setAjouts([]);
    videAjout();
  };
  const ouvrirEdition = (c) => { fermerEdition(); setEditId(c.id); };

  const qAjout = normaliser(aNom.trim());
  const suggestionsAjout = qAjout.length >= 1
    ? (produits || []).filter((p) => normaliser(p.nom).includes(qAjout)).slice(0, 8)
    : [];
  const prendreProduit = (p) => {
    setAProduit(p); setANom(p.nom);
    const vs = variantesDe(p);
    const v = vs.length ? vs[0] : null;
    setAVar(v ? String(v.id) : '');
    setAKilo(p.mode_vente !== 'piece_fixe');
    setAPat(String(prixVariante(p, v, 'prix_patrice') ?? ''));
    setAWil(String(prixVariante(p, v, 'prix_william') ?? ''));
  };
  // changer de variante change les prix affichés
  const choisirVariante = (idv) => {
    setAVar(idv);
    if (!aProduit) return;
    const v = variantesDe(aProduit).find((x) => String(x.id) === String(idv)) || null;
    setAPat(String(prixVariante(aProduit, v, 'prix_patrice') ?? ''));
    setAWil(String(prixVariante(aProduit, v, 'prix_william') ?? ''));
  };

  const litQte = (l) => {
    const m = modifs[l.id];
    return m && m.qte !== undefined ? m.qte : String(l.quantite ?? '');
  };
  const estSupprimee = (l) => !!(modifs[l.id] && modifs[l.id].suppr);
  const ecrireQte = (l, v) =>
    setModifs((x) => ({ ...x, [l.id]: { ...(x[l.id] || {}), qte: v } }));
  const basculerSuppr = (l) =>
    setModifs((x) => ({ ...x, [l.id]: { ...(x[l.id] || {}), suppr: !estSupprimee(l) } }));

  // quantité changée par rapport à la base, en tolérant « 1,5 » et « 1.5 »
  const qteChangee = (l) => {
    const m = modifs[l.id];
    if (!m || m.qte === undefined) return false;
    const n = nombre(m.qte);
    if (isNaN(n)) return false;
    return cts(n) !== cts(Number(l.quantite) || 0);
  };

  const ajouterAuBrouillon = () => {
    if (aNom.trim().length < 2) { showToast('Indique le produit'); return; }
    const n = nombre(aQte);
    if (isNaN(n) || n <= 0) { showToast('Quantité invalide'); return; }
    /* Les prix sont FACULTATIFS. Un voisin demande un produit par SMS
       bien avant que tu saches ce que Patrice le facture : t'obliger à
       inventer un chiffre maintenant, c'est garantir une erreur.
       Sans prix, la ligne devient une « demande » — le mécanisme qui
       existe déjà pour les produits hors catalogue. Elle s'affiche
       « prix à confirmer » chez le voisin, et t'attend dans l'onglet
       Pesées avec ses champs de prix. */
    const aucunPrix = aWil.trim() === '' && aPat.trim() === '';
    const wil = aWil.trim() === '' ? 0 : nombre(aWil);
    if (isNaN(wil) || wil < 0) { showToast('Ton prix est illisible'); return; }
    const pat = aPat.trim() === '' ? 0 : nombre(aPat);
    if (isNaN(pat) || pat < 0) { showToast('Prix Patrice illisible'); return; }

    const vs = aProduit ? variantesDe(aProduit) : [];
    const v = vs.length ? vs.find((x) => String(x.id) === String(aVar)) || vs[0] : null;
    setAjouts((a) => [...a, {
      cle: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      produit: aProduit,                 // null si hors catalogue
      nom: aProduit ? aProduit.nom : aNom.trim(),
      variante: v,
      quantite: n,
      kilo: aKilo,
      prixPat: cts(pat),
      prixWil: cts(wil),
      libre: !aProduit,
      aChiffrer: aucunPrix,              // à tarifer dans l'onglet Pesées
    }]);
    videAjout();
  };
  const retirerAjout = (cle) => setAjouts((a) => a.filter((x) => x.cle !== cle));

  const cmdEnEdition = commandes.find((c) => c.id === editId) || null;
  const nbModifs = !cmdEnEdition ? 0 : (
    (cmdEnEdition.lignes || []).filter((l) => estSupprimee(l) || qteChangee(l)).length
    + ajouts.length
  );

  const enregistrerModifs = async () => {
    const c = cmdEnEdition;
    if (!c || nbModifs === 0) return;
    const aSupprimer = (c.lignes || []).filter(estSupprimee);
    const resteApres = (c.lignes || []).length - aSupprimer.length + ajouts.length;
    if (resteApres === 0) {
      showToast('Une commande ne peut pas être vide — supprime-la entièrement');
      return;
    }
    if (!window.confirm(
      `Enregistrer ${nbModifs} modification(s) sur la commande de ${c.nom_client} ?\n\n`
      + 'Le total sera recalculé.'
    )) return;

    setMajEnCours(true);
    try {
      // 1) suppressions
      if (aSupprimer.length) {
        const { error } = await supabase.from('viande_commande_lignes')
          .delete().in('id', aSupprimer.map((l) => l.id));
        if (error) throw error;
      }
      // 2) quantités modifiées
      for (const l of (c.lignes || [])) {
        if (estSupprimee(l) || !qteChangee(l)) continue;
        const q = l.mode_vente === 'piece_fixe' ? Math.round(nombre(litQte(l))) : cts(nombre(litQte(l)));
        if (!q || q <= 0) continue;
        const { error } = await supabase.from('viande_commande_lignes').update({
          quantite: q,
          // le sous-total suit la nouvelle quantité ; une pesée déjà
          // saisie reste prioritaire et sera reprise dans l'onglet Pesées
          sous_total_estime: cts(sousTotal(l.mode_vente, q, Number(l.prix_william) || 0, l.poids_moyen)),
          sous_total_final: l.poids_reel != null ? cts((Number(l.poids_reel) || 0) * (Number(l.prix_william) || 0)) : null,
          quantite_livree: null,
        }).eq('id', l.id);
        if (error) throw error;
      }
      // 3) lignes ajoutées
      if (ajouts.length) {
        const rows = ajouts.map((aj) => {
          const p = aj.produit;
          const v = aj.variante;
          // hors catalogue : « au poids » devient un prix au kilo, sinon
          // un prix à la pièce. Le poids réel sera saisi à la pesée.
          const mode = p ? p.mode_vente : (aj.kilo ? 'kg' : 'piece_fixe');
          const q = mode === 'piece_fixe' ? Math.round(aj.quantite) : cts(aj.quantite);
          const poidsM = p && p.mode_vente === 'piece_pesee' ? poidsVariante(p, v) : null;
          return {
            commande_id: c.id,
            produit_id: p ? p.id : null,
            produit_nom: aj.nom,
            mode_vente: mode,
            emoji: p ? p.emoji : '➕',
            variante_id: v ? String(v.id) : null,
            variante_nom: v ? v.nom : null,
            prix_patrice: aj.prixPat,
            prix_william: aj.prixWil,
            poids_moyen: poidsM,
            quantite: q,
            quantite_livree: null,
            poids_reel: null,
            sous_total_estime: aj.aChiffrer ? 0 : cts(sousTotal(mode, q, aj.prixWil, poidsM)),
            sous_total_final: null,
            // une ligne sans prix emprunte le circuit des demandes :
            // elle apparaît « prix à confirmer » et attend la pesée
            demande: !!aj.aChiffrer,
            demande_origine: aj.aChiffrer ? aj.nom : null,
          };
        });
        const { error } = await supabase.from('viande_commande_lignes').insert(rows);
        if (error) throw error;
      }
      // 4) totaux, relus depuis la base
      await recalculerTotauxCommande(c.id);
      fermerEdition();
      showToast('Commande modifiée');
      reload();
    } catch (e) {
      console.error('Modification impossible :', e);
      showToast(messageErreur(e) || 'Modification impossible — rien n\'a été perdu');
      reload();
    } finally { setMajEnCours(false); }
  };

  const blocRelance = absents.length === 0 ? null : (
    <div className="vp-section" style={{ marginTop: 14 }}>
      <div className="vp-srow">
        <div>
          <div className="vp-h2" style={{ fontSize: 16 }}>
            {absents.length} voisin(s) sans commande
          </div>
          <div className="vp-sub">Inscrits qui n'ont rien commandé sur cette journée.</div>
        </div>
        <button className="vp-btn ghost sm" onClick={() => setVoirAbsents(!voirAbsents)}>
          {voirAbsents ? 'Masquer' : 'Voir'}
        </button>
      </div>

      {voirAbsents && (
        <>
          <div className="vp-liste" style={{ marginTop: 12 }}>
            {absents.map((a) => (
              <div className="vp-liste-l" key={a.id}>
                <span>
                  {a.nom}
                  <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                    {a.alias_whatsapp ? `${a.alias_whatsapp} · ` : ''}{a.telephone}
                  </small>
                </span>
                <b style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
                  {a.jours === null ? 'jamais commandé'
                    : a.jours === 0 ? "dernière fois aujourd'hui"
                    : `il y a ${a.jours} j`}
                </b>
              </div>
            ))}
          </div>
          <button className="vp-btn green" style={{ width: '100%', marginTop: 12 }}
            onClick={async () => { (await copier(texteRelance())) && showToast('Liste copiée'); }}>
            Copier la liste pour WhatsApp
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      {saisie ? (
        <AdminSaisie commandes={commandes} produits={produits} settings={settings}
          showToast={showToast} onFermer={() => setSaisie(false)}
          onFait={() => { setSaisie(false); reload(); }} />
      ) : (
        <button className="vp-saisie-ouvrir" onClick={() => setSaisie(true)}>
          <span>＋</span> Saisir une commande pour quelqu'un
        </button>
      )}

      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">{commandes.length} commande(s)</div>
            <div className="vp-sub">{ouvert ? 'Commandes ouvertes' : 'Commandes fermées'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="vp-h2" style={{ color: 'var(--wine)' }}>{eur(total)}</div>
            <div className="vp-marge">marge ≈ {eur(marge)}</div>
          </div>
        </div>
      </div>

      {clientsEnDouble.length > 0 && (
        <div className="vp-rupt-note" style={{ marginTop: 14 }}>
          <b>
            ⚠️ {clientsEnDouble.length} personne(s) ont plusieurs commandes sur cette journée
          </b>
          <div style={{ marginTop: 6, lineHeight: 1.7 }}>
            {clientsEnDouble.map((g) => (
              <div key={g[0].id}>
                {g[0].nom_client} — {g.length} commandes ·{' '}
                {g.map((c) => new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })).join(' puis ')}
                {' · '}{eur(g.reduce((s, c) => s + Number(c.total_estime || 0), 0))} au total
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            Vérifie avant d'envoyer la liste à Patrice : si c'est une erreur, supprime la
            commande en trop ci-dessous.
          </div>
        </div>
      )}

      {commandes.length === 0 ? (
        <div className="vp-empty">Aucune commande pour l'instant. Partage le lien dans ton groupe WhatsApp&nbsp;!</div>
      ) : (
        commandes.map((c) => (
          <div className="vp-cmd" key={c.id}>
            <div className="vp-cmd-head">
              <span className="vp-cmd-name">
                {c.nom_client}
                {cmdDuClient(c).length > 1 && (
                  <span className="vp-badge-dbl">
                    {rangClient(c)}ᵉ / {cmdDuClient(c).length} — DOUBLON&nbsp;?
                  </span>
                )}
                {pctRemise(c) > 0 && (
                  <span className="vp-badge-pre">🎂 −{num(pctRemise(c))} %</span>
                )}
                {c.precommande && <span className="vp-badge-pre">🌙 HORS HORAIRES</span>}
                {c.statut === 'finalisee' && <span className="vp-pill" style={{ color: 'var(--green)' }}>finalisée</span>}
              </span>
              <span className="vp-cmd-time">{new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {alias[String(c.user_id)] && <div className="vp-alias">🏷️ {alias[String(c.user_id)]}</div>}
            {c.telephone && <div className="vp-sub">{c.telephone}</div>}
            {(c.lignes || []).map((l) => {
              const m = MODES[l.mode_vente];
              const q = l.mode_vente === 'kg' ? `${num(l.quantite)} kg` : `${num(l.quantite)} pc`;
              const enEdit = editId === c.id;
              const barree = enEdit && estSupprimee(l);
              return (
                <div className="vp-cmd-l" key={l.id}
                  style={barree ? { opacity: 0.45, textDecoration: 'line-through' } : undefined}>
                  <span>
                    {l.emoji} {nomLigne(l)}
                    {enEdit ? (
                      <input className="vp-winput" style={{ width: 74, marginLeft: 8 }}
                        inputMode="decimal" value={litQte(l)} disabled={barree}
                        onChange={(e) => ecrireQte(l, e.target.value)}
                        aria-label={`Quantité de ${nomLigne(l)}`} />
                    ) : <span className="vp-pill">{q}</span>}
                    {enEdit && <span className="vp-pill" style={{ marginLeft: 6 }}>{l.mode_vente === 'piece_fixe' ? 'pc' : (l.mode_vente === 'kg' ? 'kg' : 'pc à peser')}</span>}
                    {l.demande && <span className="vp-badge-dem">DEMANDE</span>}
                    {enEdit && qteChangee(l) && !barree && (
                      <span className="vp-badge-dbl">MODIFIÉE</span>
                    )}
                  </span>
                  {enEdit ? (
                    <button className={`vp-btn sm ${barree ? '' : 'ghost'}`} style={{ flex: '0 0 auto' }}
                      onClick={() => basculerSuppr(l)}>
                      {barree ? 'Rétablir' : 'Retirer'}
                    </button>
                  ) : (
                    <span style={{ fontWeight: 700 }}>
                      {l.poids_reel != null ? eur(sousTotalFinal(l)) : (m.pese && l.mode_vente !== 'piece_fixe' ? '≈ ' : '') + eur(l.sous_total_estime)}
                    </span>
                  )}
                </div>
              );
            })}

            {editId === c.id && (
              <>
                {ajouts.map((a) => (
                  <div className="vp-cmd-l" key={a.cle} style={{ color: 'var(--green)' }}>
                    <span>
                      {a.produit ? a.produit.emoji : '➕'} {a.nom}
                      {a.variante ? ` — ${a.variante.nom}` : ''}
                      <span className="vp-pill" style={{ marginLeft: 6 }}>
                        {num(a.quantite)} {(a.produit ? a.produit.mode_vente === 'kg' : a.kilo) ? 'kg' : 'pc'}
                      </span>
                      <span className="vp-badge-dbl">
                        {a.aChiffrer ? 'PRIX À FIXER' : a.libre ? 'HORS CATALOGUE' : 'À AJOUTER'}
                      </span>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                        {a.aChiffrer
                          ? 'à chiffrer dans l\'onglet Pesées'
                          : `${eur(a.prixWil)}${(a.produit ? a.produit.mode_vente !== 'piece_fixe' : a.kilo) ? '/kg' : ' pièce'}`}
                      </small>
                    </span>
                    <button className="vp-btn ghost sm" style={{ flex: '0 0 auto' }}
                      onClick={() => retirerAjout(a.cle)}>Annuler</button>
                  </div>
                ))}

                <div className="vp-ajout" style={{ marginTop: 10 }}>
                  <div className="vp-srow">
                    <b style={{ fontSize: 14.5 }}>Ajouter un produit</b>
                    <button className="vp-sheet-x" onClick={fermerEdition} aria-label="Fermer">×</button>
                  </div>

                  <div className="vp-field">
                    <label className="vp-label">Produit</label>
                    <input className="vp-input" value={aNom} autoComplete="off"
                      onChange={(e) => { setANom(e.target.value); setAProduit(null); }}
                      placeholder="Tape un nom du catalogue, ou écris-le librement" />
                    {!aProduit && suggestionsAjout.length > 0 && (
                      <div className="vp-sugg" style={{ marginTop: 8 }}>
                        <span className="vp-sugg-t">Au catalogue :</span>
                        {suggestionsAjout.map((p) => (
                          <button key={p.id} className="vp-sugg-b" onClick={() => prendreProduit(p)}>
                            {p.emoji} {p.nom}
                          </button>
                        ))}
                      </div>
                    )}
                    {!aProduit && aNom.trim().length >= 2 && (
                      <div className="vp-sub" style={{ marginTop: 6 }}>
                        ➕ <b>Hors catalogue</b> — indique les prix ci-dessous. La ligne
                        n'ajoute rien au catalogue, elle ne vaut que pour cette commande.
                      </div>
                    )}
                    {aProduit && variantesDe(aProduit).length > 0 && (
                      <select className="vp-input" style={{ marginTop: 8 }} value={aVar}
                        onChange={(e) => choisirVariante(e.target.value)}>
                        {variantesDe(aProduit).map((v) => (
                          <option key={v.id} value={v.id}>{v.nom}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {!aProduit && (
                    <div className="vp-seg" style={{ marginTop: 10 }}>
                      <button className={!aKilo ? 'on' : ''} onClick={() => setAKilo(false)}>À la pièce</button>
                      <button className={aKilo ? 'on' : ''} onClick={() => setAKilo(true)}>Au kilo</button>
                    </div>
                  )}

                  <div className="vp-pl-g">
                    <label>
                      <span>Quantité {(aProduit ? aProduit.mode_vente === 'kg' : aKilo) ? '(kg)' : '(pièces)'}</span>
                      <input className="vp-winput" inputMode="decimal" value={aQte}
                        onChange={(e) => setAQte(e.target.value)} />
                    </label>
                    <label>
                      <span>Prix Patrice</span>
                      <input className="vp-winput" inputMode="decimal" value={aPat}
                        onChange={(e) => setAPat(e.target.value)} placeholder="—" />
                    </label>
                    <label>
                      <span>Ton prix {(aProduit ? aProduit.mode_vente !== 'piece_fixe' : aKilo) ? '/kg' : ''}</span>
                      <input className="vp-winput" inputMode="decimal" value={aWil}
                        onChange={(e) => setAWil(e.target.value)} placeholder="—" />
                    </label>
                  </div>

                  {aWil.trim() === '' && aPat.trim() === '' && (
                    <div className="vp-rupt-note" style={{ marginTop: 8 }}>
                      Prix inconnus&nbsp;? <b>Laisse les deux cases vides.</b> La ligne
                      partira en « prix à confirmer » et t'attendra dans l'onglet
                      <b> Pesées</b>, où tu la chiffreras une fois Patrice passé.
                      Le voisin verra que le montant reste à fixer.
                    </div>
                  )}

                  {!aProduit && aPat.trim() !== '' && !isNaN(nombre(aPat)) && (
                    <button className="vp-approx" style={{ marginTop: 8 }}
                      onClick={() => setAWil(String(cts(nombre(aPat) + 2)))}>
                      Appliquer ta marge habituelle (+2,00 €)
                    </button>
                  )}

                  <button className="vp-btn" style={{ width: '100%', marginTop: 10 }}
                    onClick={ajouterAuBrouillon}>
                    Mettre dans la liste
                  </button>
                  <div className="vp-sub" style={{ marginTop: 6 }}>
                    Un produit du catalogue arrive avec ses prix déjà remplis — tu peux
                    les corriger pour cette commande seulement. Pour un produit que tu
                    ne sais pas encore tarifer, laisse les prix vides.
                  </div>
                </div>
              </>
            )}

            {c.note && <div className="vp-sub" style={{ marginTop: 6, fontStyle: 'italic' }}>« {c.note} »</div>}

            {editId === c.id ? (
              <>
                <button className="vp-cta" style={{ marginTop: 12 }}
                  disabled={majEnCours || nbModifs === 0} onClick={enregistrerModifs}>
                  {majEnCours ? 'Enregistrement…'
                    : nbModifs === 0 ? 'Aucune modification'
                    : `Enregistrer ${nbModifs} modification${nbModifs > 1 ? 's' : ''}`}
                </button>
                <div className="vp-grid2" style={{ marginTop: 8 }}>
                  <button className="vp-btn ghost sm" onClick={fermerEdition}>Abandonner</button>
                  <button className="vp-btn ghost sm" onClick={() => suppr(c)}>Supprimer la commande</button>
                </div>
                <div className="vp-sub" style={{ marginTop: 8 }}>
                  Rien n'est enregistré avant que tu appuies sur le bouton. Le total et
                  la note du voisin seront recalculés.
                </div>
              </>
            ) : (
              <div className="vp-srow" style={{ marginTop: 10 }}>
                <span style={{ fontWeight: 800 }}>{c.total_final != null ? eur(c.total_final) : `≈ ${eur(c.total_estime)}`}</span>
                <div className="vp-macmd-b">
                  <button className="vp-btn sm" onClick={() => ouvrirEdition(c)}>Modifier</button>
                  <button className="vp-btn ghost sm" onClick={() => suppr(c)}>Supprimer</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {blocRelance}
    </>
  );
}

/* ---------- Admin : Produits ---------- */
function AdminProduits({ produits, settings, reload, showToast }) {
  const vide = { nom: '', categorie: 'Viande', mode_vente: 'piece_pesee', prix_patrice: '', prix_william: '', poids_moyen: '', emoji: '🥩', photo_url: '', disponible: true, brouillon: false, rupture: false, origine_fr: false, promo: false, prix_barre: '', ordre: produits.length + 1, dlc: '', variante_label: '', variantes: [] };
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filtreCat, setFiltreCat] = useState('Tous');
  const [recherche, setRecherche] = useState('');
  // id du produit vers lequel revenir après fermeture du formulaire
  const [retour, setRetour] = useState(null);

  const catsPresentes = CATEGORIES.filter((c) => produits.some((p) => catDe(p) === c));

  const [sansPhoto, setSansPhoto] = useState(false);
  const [filtreDlc, setFiltreDlc] = useState(false);
  const [filtreCar, setFiltreCar] = useState(false);

  // ordre exact du carrousel, pour afficher le rang de chaque produit
  const ordreCarrousel = produits.filter(auCarrousel)
    .sort((a, b) => remiseDe(b) - remiseDe(a))
    .slice(0, MAX_CARROUSEL);
  const rangCarrousel = (p) => ordreCarrousel.findIndex((x) => x.id === p.id) + 1;
  const nbCarrousel = ordreCarrousel.length;
  const [voirAttente, setVoirAttente] = useState(false);

  /* ---- affichage par tranches ----
     À plusieurs centaines de produits, dessiner toutes les fiches
     d'un coup fige le téléphone plusieurs secondes. On n'en montre
     donc qu'une partie, avec un bouton pour la suite. Chaque colonne
     a son propre compteur : charger la suite de l'une ne touche pas
     aux autres.
     Ces deux crochets sont déclarés ICI, avant le retour anticipé du
     formulaire plus bas : React exige que les crochets soient
     toujours appelés dans le même ordre, à chaque rendu. */
  const PAS_LISTE = 50;
  const [limites, setLimites] = useState({});
  // une recherche ou un filtre rebat les cartes : on repart du début
  useEffect(() => { setLimites({}); },
    [recherche, filtreCat, sansPhoto, filtreDlc, filtreCar, voirAttente]);
  // promos qui n'y entrent pas faute de photo
  const promosSansPhoto = produits.filter(
    (p) => p.promo && p.disponible && !p.rupture && !dlcDepassee(p) && !p.photo_url);
  const nbSansPhoto = produits.filter((p) => !p.photo_url).length;
  const nbDlc = produits.filter((p) => p.disponible && dlcDepassee(p)).length;

  const q = normaliser(recherche.trim());
  const produitsAffiches = produits.filter((p) => {
    if (sansPhoto && p.photo_url) return false;
    if (filtreDlc && !dlcDepassee(p)) return false;
    if (filtreCar && rangCarrousel(p) === 0) return false;
    if (filtreCat !== 'Tous' && catDe(p) !== filtreCat) return false;
    if (!q) return true;
    if (normaliser(p.nom).includes(q) || normaliser(p.categorie).includes(q)) return true;
    return variantesDe(p).some((v) => normaliser(v.nom).includes(q));
  });

  // Replace la carte du produit modifié sous les yeux, une fois la liste
  // réaffichée. La liste revient de Supabase en asynchrone, d'où les essais
  // répétés jusqu'à ce que la carte existe dans le DOM.
  useEffect(() => {
    if (form || !retour) return;
    let essais = 0;
    const t = setInterval(() => {
      const el = document.getElementById(`prod-${retour}`);
      if (el) {
        clearInterval(t);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('vp-flash');
        setTimeout(() => el.classList.remove('vp-flash'), 1600);
        setRetour(null);
      } else if (++essais > 30) {
        clearInterval(t);
        setRetour(null);
      }
    }, 50);
    return () => clearInterval(t);
  }, [form, retour]);

  const ouvrirNouveau = () => {
    setRetour(null);
    setForm({ ...vide, ordre: produits.length + 1 });
    window.scrollTo({ top: 0 });
  };
  const ouvrirEdit = (p) => {
    setRetour(p.id);
    setForm({
      ...p,
      prix_patrice: String(p.prix_patrice ?? ''),
      prix_william: String(p.prix_william ?? ''),
      poids_moyen: p.poids_moyen != null ? String(p.poids_moyen) : '',
      photo_url: p.photo_url || '',
      dlc: p.dlc || '',
      rupture: !!p.rupture,
      origine_fr: !!p.origine_fr,
      promo: !!p.promo,
      prix_barre: p.prix_barre != null ? String(p.prix_barre) : '',
      variante_label: p.variante_label || '',
      variantes: variantesDe(p).map((v) => ({
        id: v.id, nom: v.nom || '',
        prix_patrice: v.prix_patrice != null ? String(v.prix_patrice) : '',
        prix_william: v.prix_william != null ? String(v.prix_william) : '',
        poids_moyen: v.poids_moyen != null ? String(v.poids_moyen) : '',
      })),
    });
    window.scrollTo({ top: 0 });
  };

  /* --- édition des variantes --- */
  const nouvelId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ajouterVariante = () => setForm((f) => ({
    ...f,
    variante_label: f.variante_label || 'Option',
    variantes: [...(f.variantes || []), { id: nouvelId(), nom: '', prix_patrice: '', prix_william: '', poids_moyen: '' }],
  }));
  const majVariante = (id, champ, val) => setForm((f) => ({
    ...f,
    variantes: f.variantes.map((v) => (v.id === id ? { ...v, [champ]: val } : v)),
  }));
  const retirerVariante = (id) => setForm((f) => ({
    ...f, variantes: f.variantes.filter((v) => v.id !== id),
  }));
  const deplacerVariante = (id, sens) => setForm((f) => {
    const arr = [...f.variantes];
    const i = arr.findIndex((v) => v.id === id);
    const j = i + sens;
    if (i < 0 || j < 0 || j >= arr.length) return f;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...f, variantes: arr };
  });

  const choisirPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      // On réduit AVANT l'envoi : la photo part en ~70 Ko au lieu de 3 Mo.
      const reduit = await reduireImage(file);
      const estJpeg = reduit !== file || /jpe?g$/i.test(file.name);
      const ext = estJpeg ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('viande-photos')
        .upload(path, reduit, { upsert: true, contentType: reduit.type || 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      const { data } = supabase.storage.from('viande-photos').getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
      showToast(reduit.size < file.size
        ? `Photo ajoutée · ${poidsLisible(file.size)} → ${poidsLisible(reduit.size)}`
        : 'Photo ajoutée');
    } catch (err) {
      showToast("Échec de l'envoi de la photo");
    } finally { setUploading(false); }
  };

  const appliquerMarge = () => {
    const base = nombre(form.prix_patrice);
    if (isNaN(base)) return;
    const w = cts(base * (1 + Number(settings.marge_defaut) / 100));
    setForm((f) => ({ ...f, prix_william: String(w) }));
  };

  // doublons : même nom, ou un nom contenu dans l'autre (≥ 4 caractères)
  const doublons = (() => {
    if (!form) return [];
    const n = normaliser(form.nom.trim());
    if (n.length < 4) return [];
    return produits.filter((p) => {
      if (form.id && p.id === form.id) return false;
      const a = normaliser(p.nom);
      return a === n || a.includes(n) || n.includes(a);
    });
  })();
  const doublonExact = doublons.some((p) => normaliser(p.nom) === normaliser(form ? form.nom.trim() : ''));

  const enregistrer = async () => {
    if (!form.nom.trim()) { showToast('Nom requis'); return; }
    if (form.prix_patrice !== '' && isNaN(nombre(form.prix_patrice))) { showToast('Prix Patrice illisible'); return; }
    if (form.prix_william !== '' && isNaN(nombre(form.prix_william))) { showToast('Ton prix est illisible'); return; }
    if (doublonExact && !window.confirm(
      `« ${form.nom.trim()} » existe déjà au catalogue.\n\nCréer quand même un second produit portant ce nom ?`
    )) return;
    const vars = (form.variantes || [])
      .filter((v) => v.nom.trim())
      .map((v) => ({
        id: v.id,
        nom: v.nom.trim(),
        prix_patrice: v.prix_patrice === '' ? null : cts(nombre(v.prix_patrice) || 0),
        prix_william: v.prix_william === '' ? null : cts(nombre(v.prix_william) || 0),
        poids_moyen: v.poids_moyen === '' ? null : (nombre(v.poids_moyen) || 0),
      }));
    if ((form.variantes || []).some((v) => !v.nom.trim())) {
      showToast('Une option sans nom sera ignorée');
    }
    const payload = {
      nom: form.nom.trim(), categorie: form.categorie, mode_vente: form.mode_vente,
      prix_patrice: cts(nombre(form.prix_patrice) || 0), prix_william: cts(nombre(form.prix_william) || 0),
      poids_moyen: form.mode_vente === 'piece_pesee' ? (nombre(form.poids_moyen) || null) : null,
      emoji: form.emoji, photo_url: form.photo_url || null, disponible: form.disponible,
      brouillon: !!form.brouillon, ordre: Number(form.ordre) || 0,
      dlc: form.dlc || null,
      rupture: !!form.rupture,
      origine_fr: !!form.origine_fr,
      promo: !!form.promo,
      prix_barre: form.prix_barre === '' ? null : cts(nombre(form.prix_barre) || 0),
      variante_label: vars.length ? (form.variante_label.trim() || 'Option') : null,
      variantes: vars,
    };
    const { error } = form.id
      ? await supabase.from('viande_produits').update(payload).eq('id', form.id)
      : await supabase.from('viande_produits').insert(payload);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    setForm(null); reload(); showToast('Produit enregistré');
  };
  const supprimer = async (p) => {
    if (!window.confirm(`Supprimer « ${p.nom} » ?`)) return;
    await supabase.from('viande_produits').delete().eq('id', p.id);
    setRetour(null); setForm(null); reload(); showToast('Produit supprimé');
  };
  // modification express de la DLC depuis la liste, sans ouvrir le produit
  const majCategorie = async (p, val) => {
    const { error } = await supabase.from('viande_produits').update({ categorie: val }).eq('id', p.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    setRetour(p.id);
    reload();
  };
  const majDlc = async (p, val) => {
    const { error } = await supabase.from('viande_produits').update({ dlc: val || null }).eq('id', p.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    reload();
  };
  const togglePromo = async (p) => {
    const { error } = await supabase.from('viande_produits').update({ promo: !p.promo }).eq('id', p.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    setRetour(p.id);
    reload();
  };
  const toggleFr = async (p) => {
    const { error } = await supabase.from('viande_produits').update({ origine_fr: !p.origine_fr }).eq('id', p.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    setRetour(p.id);
    reload();
  };
  const toggleRupture = async (p) => {
    const { error } = await supabase.from('viande_produits').update({ rupture: !p.rupture }).eq('id', p.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    setRetour(p.id);
    reload();
    showToast(!p.rupture ? 'Marqué en rupture' : 'Rupture levée');
  };
  const toggleDispo = async (p) => {
    await supabase.from('viande_produits').update({ disponible: !p.disponible }).eq('id', p.id);
    setRetour(p.id); // la carte change de colonne : on la suit
    reload();
  };

  const marge = (() => {
    const pa = nombre(form?.prix_patrice), wi = nombre(form?.prix_william);
    if (isNaN(pa) || isNaN(wi) || pa <= 0) return null;
    return { eur: wi - pa, pct: Math.round((wi / pa - 1) * 100) };
  })();

  if (form) {
    const m = MODES[form.mode_vente];
    return (
      <div className="vp-section">
        <div className="vp-h2" style={{ marginBottom: 12 }}>{form.id ? 'Modifier' : 'Nouveau produit'}</div>

        <div className="vp-srow" style={{ marginBottom: 5 }}>
          <label className="vp-label" style={{ margin: 0 }}>Nom</label>
          <button className="vp-approx" onClick={async () => { (await copier('≈')) && showToast('≈ copié'); }}
            title="Copier le signe ≈">≈ copier</button>
        </div>
        <input className="vp-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Côte de bœuf" />

        {doublons.length > 0 && (
          <div className="vp-doublon">
            <b>{doublonExact ? '⚠️ Ce produit existe déjà' : '⚠️ Produit ressemblant déjà au catalogue'}</b>
            {doublons.slice(0, 4).map((p) => (
              <div className="vp-doublon-l" key={p.id}>
                <span>{p.emoji} {p.nom} <span className="vp-pill">{eur(p.prix_william)}</span></span>
                <button className="vp-btn ghost sm" onClick={() => ouvrirEdit(p)}>Ouvrir celui-ci</button>
              </div>
            ))}
          </div>
        )}

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Catégorie</label>
            <select className="vp-input" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{libelleCat(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="vp-label">Mode de vente</label>
            <select className="vp-input" value={form.mode_vente} onChange={(e) => setForm({ ...form, mode_vente: e.target.value })}>
              <option value="piece_fixe">À la pièce — prix fixe</option>
              <option value="kg">Au kilo — poids souhaité</option>
              <option value="piece_pesee">À la pièce — pesé au kilo</option>
            </select>
          </div>
        </div>
        <div className="vp-sub" style={{ marginTop: 6 }}>
          {form.mode_vente === 'piece_fixe' && 'Le client choisit un nombre de pièces, prix fixe. Aucun poids à saisir.'}
          {form.mode_vente === 'kg' && 'Le client indique un poids souhaité (kg). Prix au kilo, ajusté au poids réel le lendemain.'}
          {form.mode_vente === 'piece_pesee' && 'Le client choisit un nombre de pièces. Prix au kilo, calculé au poids réel le lendemain.'}
        </div>

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Prix Patrice ({m.prixUnite})</label>
            <input className="vp-input" value={form.prix_patrice} inputMode="decimal"
              onChange={(e) => setForm({ ...form, prix_patrice: e.target.value })} placeholder="0.00" />
          </div>
          <div>
            <label className="vp-label">Ton prix ({m.prixUnite})</label>
            <input className="vp-input" value={form.prix_william} inputMode="decimal"
              onChange={(e) => setForm({ ...form, prix_william: e.target.value })} placeholder="0.00" />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="vp-label">Prix barré (facultatif)</label>
          <input className="vp-input" value={form.prix_barre} inputMode="decimal"
            onChange={(e) => setForm({ ...form, prix_barre: e.target.value })} placeholder="Ex : 19.99" />
          <div className="vp-sub" style={{ marginTop: 4 }}>
            Ancien prix, affiché barré à côté du prix actuel. Laisse vide pour ne rien afficher.
          </div>
        </div>

        <div className="vp-srow" style={{ marginTop: 8 }}>
          <button className="vp-btn ghost sm" onClick={appliquerMarge}>+{settings.marge_defaut}% sur le prix Patrice</button>
          {marge && <span className="vp-marge">marge {eur(marge.eur)} ({marge.pct}%)</span>}
        </div>

        {form.mode_vente === 'piece_pesee' && (
          <div style={{ marginTop: 12 }}>
            <div className="vp-srow" style={{ marginBottom: 5 }}>
              <label className="vp-label" style={{ margin: 0 }}>Poids moyen par pièce (kg) — pour l'estimation</label>
              <button className="vp-approx" onClick={async () => { (await copier('≈')) && showToast('≈ copié'); }}
                title="Copier le signe ≈">≈ copier</button>
            </div>
            <input className="vp-input" value={form.poids_moyen} inputMode="decimal"
              onChange={(e) => setForm({ ...form, poids_moyen: e.target.value })} placeholder="Ex : 1.4" />
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <label className="vp-label">DLC (facultatif)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="vp-input" type="date" value={form.dlc || ''}
              onChange={(e) => setForm({ ...form, dlc: e.target.value })} />
            {form.dlc && (
              <button className="vp-btn ghost sm" onClick={() => setForm({ ...form, dlc: '' })}>Effacer</button>
            )}
          </div>
          {form.dlc && infoDlc(form.dlc) && (
            <div style={{ marginTop: 6 }}>
              <span className={`vp-dlc ${infoDlc(form.dlc).classe}`}>{infoDlc(form.dlc).texte}</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="vp-label">Photo (facultatif — sinon l'emoji est utilisé)</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {form.photo_url
              ? <img src={form.photo_url} alt="" loading="lazy" decoding="async" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--line)' }} />
              : <div style={{ width: 64, height: 64, borderRadius: 12, background: 'var(--paper)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 28 }}>{form.emoji}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="vp-btn ghost sm" style={{ display: 'inline-block', cursor: 'pointer', textAlign: 'center' }}>
                {uploading ? 'Envoi…' : (form.photo_url ? 'Changer la photo' : 'Ajouter une photo')}
                <input type="file" accept="image/*" onChange={choisirPhoto} disabled={uploading} style={{ display: 'none' }} />
              </label>
              {form.photo_url && (
                <button className="vp-trash" onClick={() => setForm({ ...form, photo_url: '' })}>Retirer la photo</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="vp-label">
            Icône {form.photo_url && <span style={{ fontWeight: 400 }}>(utilisée seulement si pas de photo)</span>}
          </label>

          <div className="vp-emoji-bar">
            <span className="vp-emoji-cur">{form.emoji || '🥩'}</span>
            <input
              className="vp-input"
              value={TOUS_EMOJIS.includes(form.emoji) ? '' : (form.emoji || '')}
              onChange={(e) => {
                const c = Array.from(e.target.value.trim())[0] || '';
                setForm({ ...form, emoji: c });
              }}
              placeholder="Ou colle un emoji ici"
              maxLength={8}
            />
          </div>

          <div className="vp-emoji-box">
            {EMOJIS.map((g) => (
              <div key={g.groupe}>
                <div className="vp-emoji-grp">{g.groupe}</div>
                <div className="vp-emoji-grid">
                  {Array.from(new Set(g.liste)).map((e) => (
                    <button
                      key={g.groupe + e}
                      className={`vp-emoji-btn ${form.emoji === e ? 'on' : ''}`}
                      onClick={() => setForm({ ...form, emoji: e })}
                      aria-label={e}
                    >{e}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>


        <div className="vp-varbox">
          <div className="vp-srow">
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Options</div>
              <div className="vp-sub">Parfums, contenances… Laisse vide si le produit n'en a pas.</div>
            </div>
            <button className="vp-btn ghost sm" onClick={ajouterVariante}>+ Option</button>
          </div>

          {(form.variantes || []).length > 0 && (
            <>
              <div style={{ marginTop: 12 }}>
                <label className="vp-label">Intitulé du choix (vu par le client)</label>
                <input className="vp-input" value={form.variante_label}
                  onChange={(e) => setForm({ ...form, variante_label: e.target.value })}
                  placeholder="Ex : Parfum, Contenance" />
              </div>

              <div className="vp-sub" style={{ marginTop: 12 }}>
                Prix laissé vide = le prix du produit ci-dessus s'applique.
              </div>

              {form.variantes.map((v, i) => (
                <div className="vp-var" key={v.id}>
                  <div className="vp-srow" style={{ alignItems: 'flex-start' }}>
                    <input className="vp-input" value={v.nom}
                      onChange={(e) => majVariante(v.id, 'nom', e.target.value)}
                      placeholder={`Option ${i + 1} — ex : Herbes, 5 L`} />
                    <div className="vp-var-tools">
                      <button className="vp-var-btn" onClick={() => deplacerVariante(v.id, -1)} disabled={i === 0} aria-label="Monter">↑</button>
                      <button className="vp-var-btn" onClick={() => deplacerVariante(v.id, 1)} disabled={i === form.variantes.length - 1} aria-label="Descendre">↓</button>
                      <button className="vp-var-btn del" onClick={() => retirerVariante(v.id)} aria-label="Retirer">×</button>
                    </div>
                  </div>
                  <div className="vp-grid2" style={{ marginTop: 8 }}>
                    <div>
                      <label className="vp-label">Prix Patrice</label>
                      <input className="vp-input" value={v.prix_patrice} inputMode="decimal"
                        onChange={(e) => majVariante(v.id, 'prix_patrice', e.target.value)}
                        placeholder={form.prix_patrice || 'hérité'} />
                    </div>
                    <div>
                      <label className="vp-label">Ton prix</label>
                      <input className="vp-input" value={v.prix_william} inputMode="decimal"
                        onChange={(e) => majVariante(v.id, 'prix_william', e.target.value)}
                        placeholder={form.prix_william || 'hérité'} />
                    </div>
                  </div>
                  {form.mode_vente === 'piece_pesee' && (
                    <div style={{ marginTop: 8 }}>
                      <label className="vp-label">Poids moyen (kg)</label>
                      <input className="vp-input" value={v.poids_moyen} inputMode="decimal"
                        onChange={(e) => majVariante(v.id, 'poids_moyen', e.target.value)}
                        placeholder={form.poids_moyen || 'hérité'} />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="vp-srow" style={{ marginTop: 14 }}>
          <span className="vp-label" style={{ margin: 0 }}>Disponible</span>
          <div className={`vp-toggle ${form.disponible ? 'on' : ''}`} onClick={() => setForm({ ...form, disponible: !form.disponible })} />
        </div>

        <div className="vp-srow" style={{ marginTop: 10 }}>
          <div>
            <span className="vp-label" style={{ margin: 0 }}>En attente de préparation</span>
            <div className="vp-sub">
              {form.brouillon
                ? 'Invisible sur la boutique, quel que soit l\'état ci-dessus.'
                : 'Le produit suit l\'état « Disponible ».'}
            </div>
          </div>
          <div className={`vp-toggle ${form.brouillon ? 'on' : ''}`}
            onClick={() => setForm({ ...form, brouillon: !form.brouillon })} />
        </div>

        <label className={`vp-promo-case ${form.promo ? 'on' : ''}`}>
          <input type="checkbox" checked={!!form.promo}
            onChange={(e) => setForm({ ...form, promo: e.target.checked })} />
          <span>
            <b>⚡ Mettre en avant dans PROMOS</b>
            <small>Le produit apparaît dans l'onglet PROMOS de la boutique, avec un badge sur sa fiche.</small>
          </span>
        </label>

        <label className={`vp-fr-case ${form.origine_fr ? 'on' : ''}`}>
          <input type="checkbox" checked={!!form.origine_fr}
            onChange={(e) => setForm({ ...form, origine_fr: e.target.checked })} />
          <span>
            <b><DrapeauFR taille={14} /> Produit français</b>
            <small>Affiche un petit drapeau devant le nom, dans la boutique et au panier.</small>
          </span>
        </label>

        <label className={`vp-rupt-case ${form.rupture ? 'on' : ''}`}>
          <input type="checkbox" checked={!!form.rupture}
            onChange={(e) => setForm({ ...form, rupture: e.target.checked })} />
          <span>
            <b>Produit en rupture</b>
            <small>Retiré de la boutique et signalé en rouge sur les récaps, pour penser à prévenir les clients.</small>
          </span>
        </label>

        <div className="vp-grid2" style={{ marginTop: 18 }}>
          <button className="vp-btn ghost" onClick={() => setForm(null)}>Annuler</button>
          <button className="vp-btn" onClick={enregistrer}>Enregistrer</button>
        </div>
      </div>
    );
  }

  const carte = (p) => {
    const m = MODES[p.mode_vente];
    const mg = p.prix_patrice > 0 ? Math.round((p.prix_william / p.prix_patrice - 1) * 100) : 0;
    const nbVars = variantesDe(p).length;
    const dlc = infoDlc(p.dlc);
    return (
      <div className="vp-cmd" id={`prod-${p.id}`} key={p.id}>
        <div className="vp-srow">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
            {p.photo_url
              ? <img src={p.photo_url} alt="" loading="lazy" decoding="async" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', flex: '0 0 auto' }} />
              : <span className="vp-tuile vp-tuile-sm" style={{
                  background: `linear-gradient(135deg, ${teintesDe(p)[0]} 0%, ${teintesDe(p)[1]} 100%)`,
                }}>
                  <span className="vp-tuile-e">{p.emoji}</span>
                </span>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {p.origine_fr && <DrapeauFR />}
                {p.nom}
                {nbVars > 0 && <span className="vp-pill" style={{ marginLeft: 6 }}>
                  {nbVars} {(p.variante_label || 'option').toLowerCase()}{nbVars > 1 ? 's' : ''}
                </span>}
              </div>
              <div className="vp-sub">
                {m.label} · Patrice {eur(p.prix_patrice)} → toi {eur(p.prix_william)}{m.suffixe}
                {p.prix_patrice > 0 && <span className="vp-marge"> · +{mg}%</span>}
              </div>
              {(dlc || p.rupture || p.promo || dlcDepassee(p) || rangCarrousel(p) > 0) && (
                <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.promo && <span className="vp-badge-promo"><span className="vp-eclair">⚡</span>PROMO</span>}
                  {rangCarrousel(p) > 0 && (
                    <span className="vp-badge-car">CARROUSEL N°{rangCarrousel(p)}</span>
                  )}
                  {p.promo && p.disponible && !p.rupture && !dlcDepassee(p) && !p.photo_url && (
                    <span className="vp-badge-hors">PAS AU CARROUSEL · SANS PHOTO</span>
                  )}
                  {p.rupture && <span className="vp-rupt-pill">EN RUPTURE</span>}
                  {dlcDepassee(p) && <span className="vp-rupt-pill">RETIRÉ · DLC</span>}
                  {dlc && <span className={`vp-dlc ${dlc.classe}`}>{dlc.texte}</span>}
                </div>
              )}
            </div>
          </div>
          <div className={`vp-toggle ${p.disponible ? 'on' : ''}`} onClick={() => toggleDispo(p)} />
        </div>
        <div className="vp-dlc-edit">
          <label htmlFor={`cat-${p.id}`}>Catégorie</label>
          <select id={`cat-${p.id}`} className="vp-quick-select"
            value={catDe(p)} onChange={(e) => majCategorie(p, e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{iconeCat(c)} {libelleCat(c)}</option>
            ))}
          </select>
        </div>

        <div className="vp-dlc-edit">
          <label htmlFor={`dlc-${p.id}`}>DLC</label>
          <input id={`dlc-${p.id}`} className="vp-dlc-input" type="date"
            value={p.dlc || ''} onChange={(e) => majDlc(p, e.target.value)} />
          {p.dlc && <button className="vp-dlc-x" onClick={() => majDlc(p, '')} aria-label="Effacer la DLC">×</button>}
          <button className={`vp-promo-btn ${p.promo ? 'on' : ''}`} onClick={() => togglePromo(p)}
            title={p.promo ? 'Retirer des promos' : 'Mettre en promo'}>⚡</button>
          <button className={`vp-fr-btn ${p.origine_fr ? 'on' : ''}`} onClick={() => toggleFr(p)}
            title={p.origine_fr ? 'Retirer l\'origine française' : 'Marquer comme produit français'}>
            <DrapeauFR taille={13} />
          </button>
          <button className={`vp-rupt-btn ${p.rupture ? 'on' : ''}`} onClick={() => toggleRupture(p)}>
            {p.rupture ? 'En rupture' : 'Rupture'}
          </button>
        </div>
        <div className="vp-grid2" style={{ marginTop: 10 }}>
          <button className="vp-btn ghost sm" onClick={() => ouvrirEdit(p)}>Modifier</button>
          <button className="vp-btn ghost sm" onClick={() => supprimer(p)}>Supprimer</button>
        </div>
      </div>
    );
  };

  if (filtreDlc) {
    produitsAffiches.sort((a, b) => String(a.dlc || '').localeCompare(String(b.dlc || '')));
  }
  if (filtreCar) {
    // même ordre que sur la boutique
    produitsAffiches.sort((a, b) => rangCarrousel(a) - rangCarrousel(b));
  }

  // « voirAttente » masque les deux autres colonnes pour se concentrer
  // sur ce qu'il reste à préparer
  /* ---- affichage par tranches ----
     À plusieurs centaines de produits, dessiner toutes les fiches
     d'un coup fige le téléphone plusieurs secondes. On n'en montre
     donc qu'une partie, avec un bouton pour la suite. Chaque colonne
     a son propre compteur : charger la suite de l'une ne touche pas
     aux autres. */
  // bouton de suite, affiché seulement s'il reste quelque chose
  const boutonSuite = (cle, total) => {
    const reste = total - limiteDe(cle);
    if (reste <= 0) return null;
    return (
      <button className="vp-btn ghost" style={{ width: '100%', marginTop: 4 }}
        onClick={() => voirPlus(cle)}>
        Voir les {Math.min(reste, PAS_LISTE)} produits suivants
        <span style={{ opacity: 0.6 }}> · {reste} restant{reste > 1 ? 's' : ''}</span>
      </button>
    );
  };

  const limiteDe = (cle) => limites[cle] || PAS_LISTE;
  const voirPlus = (cle) =>
    setLimites((l) => ({ ...l, [cle]: limiteDe(cle) + PAS_LISTE }));

  const enAttente = produitsAffiches.filter((p) => p.brouillon);
  const actifs = voirAttente ? [] : produitsAffiches.filter((p) => !p.brouillon && p.disponible);
  const inactifs = voirAttente ? [] : produitsAffiches.filter((p) => !p.brouillon && !p.disponible);
  const nbAttente = produits.filter((p) => p.brouillon).length;

  // Ce qui manque encore pour qu'un produit soit présentable
  const manqueProduit = (p) => [
    !(Number(p.prix_william) > 0) && 'ton prix',
    !p.photo_url && 'une photo',
    p.mode_vente === 'piece_pesee' && !(Number(p.poids_moyen) > 0) && 'le poids moyen',
  ].filter(Boolean);

  const publier = async (p) => {
    const m = manqueProduit(p);
    if (m.length && !window.confirm(
      `Publier « ${p.nom} » ?\n\nIl manque encore : ${m.join(', ')}.\n`
      + 'Sans ton prix, il s\'affichera à 0 € dans la boutique.'
    )) return;
    const { error } = await supabase.from('viande_produits')
      .update({ brouillon: false, disponible: true }).eq('id', p.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    reload(); showToast(`« ${p.nom} » est en vente`);
  };

  const publierTout = async () => {
    const prets = produits.filter((p) => p.brouillon && manqueProduit(p).length === 0);
    if (!prets.length) { showToast('Aucun produit prêt à publier'); return; }
    if (!window.confirm(`Mettre en vente ${prets.length} produit(s) prêt(s) ?`)) return;
    const { error } = await supabase.from('viande_produits')
      .update({ brouillon: false, disponible: true })
      .in('id', prets.map((p) => p.id));
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    reload(); showToast(`${prets.length} produit(s) en vente`);
  };


  return (
    <>
      <div className="vp-section vp-srow">
        <div>
          <div className="vp-h2">Produits</div>
          <div className="vp-sub">
            {q || filtreCat !== 'Tous'
              ? `${produitsAffiches.length} résultat${produitsAffiches.length > 1 ? 's' : ''} sur ${produits.length}`
              : `${produits.length} au catalogue · ${produits.filter((p) => p.disponible).length} en vente`}
          </div>
        </div>
        <button className="vp-btn" onClick={ouvrirNouveau}>+ Ajouter</button>
      </div>

      <div className="vp-search">
        <span className="vp-search-ico">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
        </span>
        <input
          className="vp-input"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un produit…"
          type="search"
          autoComplete="off"
        />
        {recherche && (
          <button className="vp-search-clear" onClick={() => setRecherche('')} aria-label="Effacer la recherche">×</button>
        )}
      </div>

      {promosSansPhoto.length > 0 && (
        <button className="vp-rupt-note" style={{
          marginBottom: 12, width: '100%', textAlign: 'left',
          background: '#FFF8EC', borderColor: '#F1DFBC', color: '#7A5A20',
        }} onClick={() => { setSansPhoto(true); setFiltreCar(false); setFiltreDlc(false); setFiltreCat('Tous'); }}>
          <b>{promosSansPhoto.length} promo(s) absente(s) du carrousel</b> — il leur manque une photo.
          Appuie pour les compléter.
        </button>
      )}

      {nbDlc > 0 && !filtreDlc && (
        <button className="vp-rupt-note" style={{ marginBottom: 12, width: '100%', textAlign: 'left' }}
          onClick={() => { setFiltreDlc(true); setSansPhoto(false); setFiltreCat('Tous'); }}>
          <b>{nbDlc} produit(s) retiré(s) de la boutique</b> — leur DLC ne couvre plus le retrait
          du lendemain. Appuie pour les afficher.
        </button>
      )}

      {nbAttente > 0 && (
        <div className="vp-section" style={{ marginTop: 0 }}>
          <div className="vp-srow">
            <div>
              <div className="vp-h2" style={{ fontSize: 16 }}>
                📦 {nbAttente} produit(s) en attente
              </div>
              <div className="vp-sub">
                Importés, mais invisibles sur la boutique tant qu'ils ne sont pas publiés.
                {produits.filter((p) => p.brouillon && manqueProduit(p).length === 0).length > 0
                  && ` ${produits.filter((p) => p.brouillon && manqueProduit(p).length === 0).length} sont prêts.`}
              </div>
            </div>
            <button className={`vp-btn ${voirAttente ? '' : 'ghost'} sm`}
              onClick={() => setVoirAttente(!voirAttente)}>
              {voirAttente ? 'Tout revoir' : 'Les voir'}
            </button>
          </div>
          {produits.filter((p) => p.brouillon && manqueProduit(p).length === 0).length > 0 && (
            <button className="vp-btn green" style={{ width: '100%', marginTop: 10 }}
              onClick={publierTout}>
              Mettre en vente les{' '}
              {produits.filter((p) => p.brouillon && manqueProduit(p).length === 0).length} produit(s) prêt(s)
            </button>
          )}
        </div>
      )}

      {(nbSansPhoto > 0 || nbDlc > 0 || nbCarrousel > 0) && (
        <div className="vp-tabs" style={{ paddingTop: 0, paddingBottom: 4 }}>
          {nbCarrousel > 0 && (
            <button className={`vp-tab vp-tab-car ${filtreCar ? 'on' : ''}`}
              onClick={() => { setFiltreCar(!filtreCar); setFiltreDlc(false); setSansPhoto(false); }}>
              ⚡ Au carrousel ({nbCarrousel})
            </button>
          )}
          {nbDlc > 0 && (
            <button className={`vp-tab vp-tab-dlc ${filtreDlc ? 'on' : ''}`}
              onClick={() => { setFiltreDlc(!filtreDlc); setSansPhoto(false); setFiltreCar(false); }}>
              ⏱ DLC échue ({nbDlc})
            </button>
          )}
          {nbSansPhoto > 0 && (
            <button className={`vp-tab vp-tab-photo ${sansPhoto ? 'on' : ''}`}
              onClick={() => { setSansPhoto(!sansPhoto); setFiltreDlc(false); setFiltreCar(false); }}>
              📷 Sans photo ({nbSansPhoto})
            </button>
          )}
        </div>
      )}

      {catsPresentes.length > 1 && (
        <div className="vp-tabs" style={{ paddingTop: 0 }}>
          <button className={`vp-tab ${filtreCat === 'Tous' ? 'on' : ''}`} onClick={() => setFiltreCat('Tous')}>
            Tous ({produits.length})
          </button>
          {catsPresentes.map((cat) => (
            <button key={cat} className={`vp-tab ${filtreCat === cat ? 'on' : ''}`} onClick={() => setFiltreCat(cat)}>
              <span className="vp-tab-ico">{iconeCat(cat)}</span>{libelleCat(cat)} ({produits.filter((p) => catDe(p) === cat).length})
            </button>
          ))}
        </div>
      )}

      {produitsAffiches.length === 0 ? (
        <div className="vp-empty">
          {filtreCar
            ? 'Aucun produit au carrousel. Marque une promo ⚡ et donne-lui une photo.'
            : filtreDlc
            ? 'Aucun produit avec une DLC échue.'
            : produits.length === 0
            ? 'Aucun produit. Ajoute les promos de Patrice.'
            : q
              ? <>Aucun produit ne correspond à « {recherche.trim()} ».{' '}
                  <button className="vp-trash" style={{ marginTop: 0 }} onClick={() => { setRecherche(''); setFiltreCat('Tous'); }}>
                    Réinitialiser
                  </button>
                </>
              : 'Aucun produit dans cette catégorie.'}
        </div>
      ) : (
        <div className="vp-cols">
          {enAttente.length > 0 && (
            <div className="vp-col attente">
              <div className="vp-col-head">
                <span className="vp-col-dot" />En attente
                <span className="vp-col-count">{enAttente.length}</span>
              </div>
              <div className="vp-col-aide">
                Importés mais pas encore prêts. Invisibles sur la boutique tant que
                tu ne les publies pas.
              </div>
              {enAttente.slice(0, limiteDe('attente')).map((p) => (
                <div key={`att-${p.id}`}>
                  {carte(p)}
                  <div className="vp-attente-pied">
                    {manqueProduit(p).length > 0
                      ? <span>Manque : {manqueProduit(p).join(', ')}</span>
                      : <span className="pret">Prêt à publier</span>}
                    <button className={`vp-btn sm ${manqueProduit(p).length ? 'ghost' : 'green'}`}
                      onClick={() => publier(p)}>Publier</button>
                  </div>
                </div>
              ))}
              {boutonSuite('attente', enAttente.length)}
            </div>
          )}
          {!voirAttente && (
            <>
              <div className="vp-col">
                <div className="vp-col-head">
                  <span className="vp-col-dot" />En vente
                  <span className="vp-col-count">{actifs.length}</span>
                </div>
                {actifs.length === 0
                  ? <div className="vp-col-empty">Aucun produit en vente.</div>
                  : actifs.slice(0, limiteDe('actifs')).map(carte)}
                {boutonSuite('actifs', actifs.length)}
              </div>
              <div className="vp-col off">
                <div className="vp-col-head">
                  <span className="vp-col-dot" />Désactivés
                  <span className="vp-col-count">{inactifs.length}</span>
                </div>
                {inactifs.length === 0
                  ? <div className="vp-col-empty">Rien de désactivé.</div>
                  : inactifs.slice(0, limiteDe('inactifs')).map(carte)}
                {boutonSuite('inactifs', inactifs.length)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- Admin : Export Patrice ---------- */
function AdminExport({ commandes, produits, settings, showToast }) {
  const enRupture = new Set(produits.filter((p) => p.rupture).map((p) => String(p.id)));

  // agrégation par produit + variante
  const agg = {};
  commandes.forEach((c) => (c.lignes || []).forEach((l) => {
    const k = nomLigne(l);
    if (!agg[k]) agg[k] = {
      nom: k, emoji: l.emoji, mode: l.mode_vente, qte: 0, cout: 0,
      rupture: enRupture.has(String(l.produit_id)),
    };
    agg[k].qte += Number(l.quantite || 0);
    agg[k].cout += sousTotal(l.mode_vente, l.quantite, l.prix_patrice, l.poids_moyen);
  }));
  const lignes = Object.values(agg);
  const coutTotal = lignes.reduce((s, x) => s + (x.rupture ? 0 : x.cout), 0);
  const nbRupture = lignes.filter((x) => x.rupture).length;

  const uniteTxt = (mode, qte) =>
    mode === 'kg' ? `${num(qte)} kg` : `${num(qte)} pièce(s)`;

  const texte = () => {
    let t = `🧺 Commande pour Patrice — ${fmtDateCourt(settings.date_vente)}\n\n`;
    lignes.filter((x) => !x.rupture).forEach((x) => { t += `• ${sansPoids(x.nom)} : ${uniteTxt(x.mode, x.qte)}\n`; });
    const r = lignes.filter((x) => x.rupture);
    if (r.length) {
      t += `\n❌ En rupture (non commandé) :\n`;
      r.forEach((x) => { t += `• ${sansPoids(x.nom)}\n`; });
    }
    t += `\nCoût total estimé (prix Patrice) : ${eur(coutTotal)}`;
    return t;
  };

  const csv = () => {
    let c = 'Produit;Mode;Quantite;Unite;Rupture;Cout estime\n';
    lignes.forEach((x) => {
      const unite = x.mode === 'kg' ? 'kg' : 'piece';
      c += `${x.nom};${MODES[x.mode].label};${num(x.qte)};${unite};${x.rupture ? 'OUI' : ''};${(Math.round(x.cout * 100) / 100).toString().replace('.', ',')}\n`;
    });
    const blob = new Blob(['\ufeff' + c], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `commande-patrice-${settings.date_vente}.csv`; a.click();
  };

  // Feuille de préparation : une section par client, dans l'ordre d'arrivée.
  // C'est ce qu'on a en main au moment de répartir les commandes.
  const imprimerParClient = () => {
    const blocs = commandes.map((c) => {
      const rows = (c.lignes || []).map((l) => {
        const rupt = enRupture.has(String(l.produit_id));
        const q = l.mode_vente === 'kg' ? `${num(l.quantite)} kg` : `${num(l.quantite)} pc`;
        const auKilo = l.mode_vente !== 'piece_fixe' || !!l.demande;
        const unite = auKilo ? '/kg' : '/pc';
        return `<tr class="${rupt ? 'rupture' : ''}">
          <td class="prod"><span class="nom">${esc(sansPoids(nomLigne(l)))}</span>${rupt ? ' — EN RUPTURE' : ''}</td>
          <td class="qte c">${esc(q)}</td>
          <td class="c">${rupt || !auKilo ? '—' : '<span class="saisie"></span>'}</td>
          <td class="n">${l.demande && !(Number(l.prix_patrice) > 0) ? 'à fixer' : esc(eur(Number(l.prix_patrice)) + unite)}</td>
        </tr>`;
      }).join('');
      return `<div class="bloc">
        <h2 class="maj">${esc(c.nom_client)}</h2>
        <table class="pesee">
          <colgroup>
            <col class="c-prod"><col class="c-qte"><col class="c-poids"><col class="c-prix">
          </colgroup>
          <thead><tr>
            <th>Produit</th>
            <th class="c">Qté</th>
            <th class="c">Poids réel (kg)</th>
            <th class="n">Prix Patrice</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');
    const corps = `
      <div class="tete">
        <div class="barre"></div>
        <div>
          <h1>Feuille de pesée</h1>
          <div class="meta"><b>${esc(settings.titre)}</b> — ${esc(fmtDateCourt(settings.date_vente))}
            · ${commandes.length} client(s) · à remplir par Patrice</div>
        </div>
      </div>
      ${blocs}
      <div class="pied">
        Colonne « Poids réel » à compléter à la pesée. Les lignes à la pièce n'ont pas de poids à saisir.
      </div>`;
    if (!imprimerDocument(`Feuille de pesee ${settings.date_vente}`, corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  const imprimer = () => {
    const rows = lignes.map((x) => `
      <tr class="${x.rupture ? 'rupture' : ''}">
        <td><span class="nom">${esc(sansPoids(x.nom))}</span>${x.rupture ? ' — EN RUPTURE' : ''}</td>
        <td class="n">${esc(uniteTxt(x.mode, x.qte))}</td>
        <td class="n">${x.rupture ? '—' : esc(eur(x.cout))}</td>
      </tr>`).join('');
    const corps = `
      <div class="tete">
        <div class="barre"></div>
        <div>
          <h1>Commande groupée</h1>
          <div class="meta"><b>${esc(settings.titre)}</b> — ${esc(fmtDateCourt(settings.date_vente))}
            · quantités cumulées de ${commandes.length} commande(s)</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Produit</th><th style="text-align:right">Quantité</th>
          <th style="text-align:right">Coût estimé</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="grand"><span>Coût total estimé</span><span>${esc(eur(coutTotal))}</span></div>
      <div class="pied">Viande Noisy — document généré le ${esc(new Date().toLocaleDateString('fr-FR'))}</div>`;
    if (!imprimerDocument(`Commande Patrice ${settings.date_vente}`, corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  // Message prêt à coller dans le groupe WhatsApp : promos du jour,
  // heure de fermeture, lien de la boutique.
  const annonce = () => {
    const promos = produits.filter((p) => p.disponible && !p.rupture && p.promo);
    const lien = typeof window !== 'undefined' ? window.location.origin : '';
    let t = `🥩 ${settings.titre}\n\n`;
    if (promos.length) {
      t += `⚡ Les promos du jour :\n`;
      promos.forEach((p) => {
        const m = MODES[p.mode_vente];
        t += `• ${p.nom} — ${eur(p.prix_william)}${m.suffixe}`;
        if (p.prix_barre > 0 && p.prix_barre > p.prix_william) {
          t += ` (au lieu de ${eur(p.prix_barre)})`;
        }
        t += `\n`;
      });
      t += `\n`;
    }
    t += `🕒 Commandes jusqu'à ${settings.heure_fermeture}\n`;
    t += `👉 ${lien}\n\n`;
    t += `Retrait le lendemain. Commandes du dimanche 12h au jeudi soir.\n`;
    t += `Pas de livraisons ni de retrait les week-ends et jours fériés.`;
    return t;
  };

  return (
    <>
      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2" style={{ fontSize: 16 }}>Annonce du jour</div>
            <div className="vp-sub">Message prêt à coller dans le groupe WhatsApp.</div>
          </div>
        </div>
        <div className="vp-pre" style={{ marginTop: 12 }}>{annonce()}</div>
        <button className="vp-btn green" style={{ width: '100%', marginTop: 12 }}
          onClick={async () => { (await copier(annonce())) && showToast('Annonce copiée'); }}>
          Copier l'annonce
        </button>
      </div>

      <div className="vp-section">
        <div className="vp-h2">Récap pour Patrice</div>
        <div className="vp-sub">Quantités cumulées de toutes les commandes. À envoyer après la fermeture.</div>
        {nbRupture > 0 && (
          <div className="vp-rupt-note">
            {nbRupture} produit(s) en rupture — exclus du total et signalés en rouge sur l'impression.
          </div>
        )}
        {lignes.length === 0 ? (
          <div className="vp-empty">Pas encore de commande à cumuler.</div>
        ) : (
          <>
            <div className="vp-pre" style={{ marginTop: 12 }}>{texte()}</div>
            <button className="vp-cta" style={{ marginTop: 14 }} onClick={imprimerParClient}>
              Imprimer / PDF — feuille de pesée
            </button>
            <div className="vp-sub" style={{ marginTop: 6 }}>
              Une section par client, avec une case vide par ligne au kilo pour que Patrice
              y note le poids réel. Tu recopies ensuite ces poids dans l'onglet Pesées.
            </div>

            <div className="vp-grid2" style={{ marginTop: 16 }}>
              <button className="vp-btn green" onClick={async () => { (await copier(texte())) && showToast('Copié — colle dans WhatsApp'); }}>Copier pour Patrice</button>
              <button className="vp-btn ghost" onClick={imprimer}>Imprimer par produit</button>
            </div>
            <button className="vp-btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={csv}>Télécharger CSV</button>
            <div className="vp-sub" style={{ marginTop: 8 }}>
              Les quantités cumulées ci-dessus servent à passer commande chez Patrice.
              Pour obtenir un PDF, choisis « Enregistrer au format PDF » dans la liste des imprimantes.
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Admin : Pesées & notes (recalcul du lendemain) ---------- */
function AdminPesees({ commandes, produits, settings, reload, showToast }) {
  const [vue, setVue] = useState('client');

  /* ---- envoi des notes sur WhatsApp ----
     Les noms WhatsApp servent à écrire « @Jeannot » plutôt que « Jean
     Dupont » dans le récap du groupe. Attention : coller « @Jeannot »
     n'crée PAS une vraie mention WhatsApp (voir plus bas dans l'écran),
     c'est seulement plus lisible pour le groupe. */
  const [alias, setAlias] = useState({});   // user_id -> repère affiché
  const [repTel, setRepTel] = useState({}); // user_id -> numéro corrigé
  const chargerAlias = async () => {
    const [{ data }, reps] = await Promise.all([
      supabase.from('viande_clients').select('id, alias_whatsapp'),
      chargerReperes(),
    ]);
    const a = {};
    (data || []).forEach((c) => { if (c.alias_whatsapp) a[String(c.id)] = c.alias_whatsapp; });
    const t = {};
    Object.keys(reps).forEach((k) => {
      if (reps[k].repere) a[k] = reps[k].repere;   // ton repère l'emporte
      if (reps[k].telephone) t[k] = reps[k].telephone;
    });
    setAlias(a); setRepTel(t);
  };
  useEffect(() => { chargerAlias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nomWa = (c) => alias[String(c.user_id)] || c.nom_client;
  // numéro de la commande, à défaut celui que tu as corrigé une fois pour toutes
  const telDe = (c) => c.telephone || repTel[String(c.user_id)] || '';

  // numéro au format international sans « + », tel que l'attend wa.me
  const telWa = (c) => {
    const d = String(telDe(c) || '').replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('33')) return d;
    if (d.startsWith('0')) return `33${d.slice(1)}`;
    return d;
  };

  // envois déjà faits : avec quinze voisins, on perd vite le fil
  const [envoyes, setEnvoyes] = useState([]);
  const dejaEnvoye = (c) => envoyes.includes(c.id);
  const marquerEnvoye = (c) => setEnvoyes((e) => (e.includes(c.id) ? e : [...e, c.id]));

  /* ---- numéro corrigé sur place ----
     Une commande saisie à la main n'a pas toujours de numéro, et il
     arrive qu'un voisin en change. Plutôt que d'aller le chercher dans
     l'onglet Membres, on le règle ici, au moment où ça bloque. */
  const [telEdit, setTelEdit] = useState(null);  // { id, tel, pseudo }
  const [telEnvoi, setTelEnvoi] = useState(false);

  const ouvrirTel = (c) => setTelEdit({
    id: c.id,
    tel: telDe(c),
    pseudo: alias[String(c.user_id)] || '',
  });

  const enregistrerTel = async (c) => {
    const v = (telEdit && telEdit.tel ? telEdit.tel : '').trim();
    const ps = (telEdit && telEdit.pseudo ? telEdit.pseudo : '').trim();
    const chiffres = v.replace(/\D/g, '');
    if (v && (chiffres.length < 9 || chiffres.length > 15)) {
      showToast('Numéro invalide — 10 chiffres, ou +33…');
      return;
    }
    setTelEnvoi(true);
    try {
      const { error } = await supabase.from('viande_commandes')
        .update({ telephone: v || null }).eq('id', c.id);
      const err = messageErreur(error);
      if (err) { showToast(err); return; }
      // Membre identifié : le repère et le numéro sont rangés dans ta
      // table à toi, pour ne pas les ressaisir à chaque commande.
      let rep = null;
      if (c.user_id) {
        rep = await enregistrerRepere(c.user_id, { repere: ps || null, telephone: v || null });
        if (rep.ok) {
          setAlias((a) => {
            const n = { ...a };
            if (ps) n[String(c.user_id)] = ps; else delete n[String(c.user_id)];
            return n;
          });
          setRepTel((t) => {
            const n = { ...t };
            if (v) n[String(c.user_id)] = v; else delete n[String(c.user_id)];
            return n;
          });
        }
      }
      setTelEdit(null);
      reload();
      if (rep && !rep.ok) { showToast(`Commande à jour, mais le repère : ${rep.message}`); return; }
      showToast(rep ? 'Enregistré — et retenu pour les prochaines fois' : 'Enregistré');
    } finally { setTelEnvoi(false); }
  };
  // ajout d'une ligne à la volée, pendant la pesée : il arrive que des
  // produits soient demandés par SMS après la clôture des commandes
  const [ajoutPour, setAjoutPour] = useState(null); // id de commande
  const [aNom, setANom] = useState('');
  const [aProduit, setAProduit] = useState(null);
  const [aVar, setAVar] = useState('');
  const [aQte, setAQte] = useState('1');
  const [aPoids, setAPoids] = useState('');
  const [aPat, setAPat] = useState('');
  const [aWil, setAWil] = useState('');
  const [aKilo, setAKilo] = useState(false);
  const [aEnvoi, setAEnvoi] = useState(false);

  const reinitAjout = () => {
    setANom(''); setAProduit(null); setAVar(''); setAQte('1');
    setAPoids(''); setAPat(''); setAWil(''); setAKilo(false);
  };
  const ouvrirAjout = (c) => { reinitAjout(); setAjoutPour(c.id); };

  const qAjout = normaliser(aNom.trim());
  const suggestionsAjout = qAjout.length >= 1
    ? (produits || []).filter((p) => normaliser(p.nom).includes(qAjout)).slice(0, 6)
    : [];

  const prendreProduit = (p) => {
    setAProduit(p);
    setANom(p.nom);
    const vs = variantesDe(p);
    setAVar(vs.length ? String(vs[0].id) : '');
    setAKilo(p.mode_vente !== 'piece_fixe');
    setAPat(String(p.prix_patrice ?? ''));
    setAWil(String(p.prix_william ?? ''));
  };

  const enregistrerAjout = async (c) => {
    if (aNom.trim().length < 2) { showToast('Indique le produit'); return; }
    const qn = nombre(aQte);
    if (isNaN(qn) || qn <= 0) { showToast('Quantité invalide'); return; }
    const pr = aPoids.trim() === '' ? null : nombre(aPoids);
    if (pr !== null && (isNaN(pr) || pr <= 0)) { showToast('Poids invalide'); return; }
    const wil = cts(nombre(aWil) || 0);
    const pat = cts(nombre(aPat) || 0);
    const vs = aProduit ? variantesDe(aProduit) : [];
    const v = vs.length ? vs.find((x) => String(x.id) === String(aVar)) || vs[0] : null;
    const modeV = aKilo ? (aProduit && aProduit.mode_vente === 'kg' ? 'kg' : 'piece_pesee') : 'piece_fixe';
    const base = pr != null ? pr * wil : (aKilo ? 0 : qn * wil);

    setAEnvoi(true);
    try {
      const { error } = await supabase.from('viande_commande_lignes').insert({
        commande_id: c.id,
        produit_id: aProduit ? aProduit.id : null,
        produit_nom: aProduit ? aProduit.nom : aNom.trim(),
        mode_vente: modeV,
        emoji: aProduit ? aProduit.emoji : '➕',
        variante_id: v ? String(v.id) : null,
        variante_nom: v ? v.nom : null,
        prix_patrice: pat,
        prix_william: wil,
        poids_moyen: null,
        quantite: aKilo && aProduit && aProduit.mode_vente === 'kg' ? qn : Math.round(qn),
        quantite_livree: null,
        poids_reel: pr,
        sous_total_estime: cts(base),
        sous_total_final: pr != null || !aKilo ? cts(base) : null,
        demande: false,
        demande_origine: null,
      });
      const err = messageErreur(error);
      if (err) { showToast(err); return; }
      // les totaux figés en base ne valent plus rien : on les refait depuis
      // les lignes, sinon le profil du client afficherait l'ancien montant
      // et la marge resterait calculée sans ce produit.
      await recalculerTotauxCommande(c.id);
      setAjoutPour(null);
      reinitAjout();
      showToast('Produit ajouté — pense à enregistrer les pesées');
      reload();
    } finally { setAEnvoi(false); }
  };
  // Corrections saisies : id de ligne -> { poids, pat, wil, rupture }
  // Ce qui n'est pas saisi retombe sur la valeur enregistrée en base.
  const [edits, setEdits] = useState({});
  const [enCours, setEnCours] = useState(false);

  const ruptProduit = new Set((produits || []).filter((p) => p.rupture).map((p) => String(p.id)));

  const lire = (l, champ, defaut) => {
    const e = edits[l.id];
    return e && e[champ] !== undefined ? e[champ] : defaut;
  };
  const ecrire = (l, champ, val) =>
    setEdits((x) => ({ ...x, [l.id]: { ...(x[l.id] || {}), [champ]: val } }));

  const valPoids = (l) => lire(l, 'poids', l.poids_reel != null ? String(l.poids_reel) : '');
  // quantité réellement servie ; à défaut, celle commandée
  const valQte = (l) => lire(l, 'qte',
    l.quantite_livree != null ? String(l.quantite_livree) : String(l.quantite ?? ''));
  const qteLivree = (l) => {
    const n = nombre(valQte(l));
    return isNaN(n) || n < 0 ? (Number(l.quantite) || 0) : n;
  };
  const partiel = (l) => qteLivree(l) !== (Number(l.quantite) || 0);
  const valPat = (l) => lire(l, 'pat', l.prix_patrice != null ? String(l.prix_patrice) : '');
  const valWil = (l) => lire(l, 'wil', l.prix_william != null ? String(l.prix_william) : '');
  const estRupture = (l) =>
    lire(l, 'rupture', l.rupture != null ? l.rupture : ruptProduit.has(String(l.produit_id)));

  const basculerRupture = (l) => ecrire(l, 'rupture', !estRupture(l));

  // poids retenu : saisi, sinon enregistré, sinon estimé sur le poids moyen
  const poidsRetenu = (l) => {
    const v = valPoids(l);
    const n = nombre(v);
    if (v !== '' && !isNaN(n)) return n;
    if (l.poids_reel != null) return Number(l.poids_reel);
    return poidsEstime(l.mode_vente, l.quantite, l.poids_moyen);
  };
  const estEstime = (l) => {
    if (estRupture(l) || l.mode_vente === 'piece_fixe') return false;
    const v = valPoids(l);
    return (v === '' || isNaN(nombre(v))) && l.poids_reel == null;
  };

  /* Une seule règle, pour toutes les lignes : un poids saisi fait
     foi et la ligne est facturée au kilo ; sans poids, elle est
     facturée à la pièce si elle se vend ainsi, sinon au poids estimé.
     Avant, ce traitement était réservé aux demandes — d'où
     l'impossibilité de peser un produit ajouté à la main. */
  const montant = (l, prixTexte) => {
    if (estRupture(l)) return 0;
    const prix = nombre(prixTexte) || 0;
    const v = valPoids(l);
    const n = nombre(v);
    if (v !== '' && !isNaN(n) && n > 0) return n * prix;
    if (l.mode_vente === 'piece_fixe') return qteLivree(l) * prix;
    return poidsRetenu(l) * prix;
  };
  const stLive = (l) => montant(l, valWil(l));
  const stPatriceLive = (l) => montant(l, valPat(l));

  // brut = somme des lignes ; net = après la remise d'anniversaire.
  // Tout ce qui est montré au client passe par totalCmd.
  const totalBrutCmd = (c) => (c.lignes || []).reduce((s, l) => s + stLive(l), 0);
  const totalCmd = (c) => apresRemise(totalBrutCmd(c), c);
  const totalPatriceCmd = (c) => (c.lignes || []).reduce((s, l) => s + stPatriceLive(l), 0);
  const totalGroupe = commandes.reduce((s, c) => s + totalCmd(c), 0);
  const totalPatriceGroupe = commandes.reduce((s, c) => s + totalPatriceCmd(c), 0);

  const nbModifs = Object.keys(edits).length;

  // regroupement par produit
  const groupes = {};
  commandes.forEach((c) => (c.lignes || []).forEach((l) => {
    const k = nomLigne(l);
    if (!groupes[k]) groupes[k] = { nom: k, emoji: l.emoji, lignes: [] };
    groupes[k].lignes.push({ l, client: c.nom_client });
  }));
  const liste = Object.values(groupes);

  // applique un prix à toutes les lignes d'un même produit
  const [prixGroupe, setPrixGroupe] = useState({}); // "nom|champ" -> valeur saisie
  const appliquerAuGroupe = (g, champ, val) => {
    setPrixGroupe((x) => ({ ...x, [`${g.nom}|${champ}`]: val }));
    setEdits((x) => {
      const n = { ...x };
      g.lignes.forEach(({ l }) => { n[l.id] = { ...(n[l.id] || {}), [champ]: val }; });
      return n;
    });
  };

  const enregistrer = async () => {
    setEnCours(true);
    try {
      for (const c of commandes) {
        for (const l of (c.lignes || [])) {
          if (!edits[l.id]) continue;
          const rupt = estRupture(l);
          const v = valPoids(l);
          const pr = (v !== '' && !isNaN(nombre(v))) ? nombre(v) : null;
          const maj = {
            quantite_livree: rupt ? 0 : qteLivree(l),
            poids_reel: rupt ? null : pr,
            prix_patrice: cts(nombre(valPat(l)) || 0),
            prix_william: cts(nombre(valWil(l)) || 0),
            rupture: rupt,
            sous_total_final: cts(stLive(l)),
          };
          // libellé reformulé d'une demande, pour la feuille de Patrice
          if (l.demande && edits[l.id].nom !== undefined && edits[l.id].nom.trim()) {
            maj.produit_nom = edits[l.id].nom.trim();
          }
          const { error } = await supabase.from('viande_commande_lignes').update(maj).eq('id', l.id);
          const err = messageErreur(error);
          if (err) { showToast(err); setEnCours(false); return; }
        }
        const tousTraites = (c.lignes || []).every((l) =>
          l.mode_vente === 'piece_fixe' || estRupture(l) || valPoids(l) !== '');
        await supabase.from('viande_commandes').update({
          total_final: cts(totalCmd(c)),
          total_patrice: cts(totalPatriceCmd(c)),
          statut: tousTraites ? 'finalisee' : 'en_cours',
        }).eq('id', c.id);
      }
      setEdits({});
      showToast('Enregistré — totaux recalculés');
      reload();
    } finally { setEnCours(false); }
  };

  /* ---- sorties texte ---- */
  const ligneTxt = (l) => {
    const n = nomLigne(l);
    if (estRupture(l)) return `• ${n} : ❌ EN RUPTURE — non fourni\n`;
    if (l.mode_vente === 'piece_fixe') {
      const q2 = partiel(l) ? `${num(qteLivree(l))} (sur ${num(l.quantite)} commandé(s))` : num(l.quantite);
      return `• ${n} : ${q2} × ${eur(nombre(valWil(l)))} = ${eur(stLive(l))}\n`;
    }
    if (estEstime(l)) return `• ${n} : (poids à confirmer)\n`;
    return `• ${n} : ${num(poidsRetenu(l))} kg × ${eur(nombre(valWil(l)))} = ${eur(stLive(l))}\n`;
  };
  const noteClient = (c) => {
    let t = `🥩 ${settings.titre} — ${fmtDateCourt(settings.date_vente)}\nNote de ${c.nom_client}\n\n`;
    (c.lignes || []).forEach((l) => { t += ligneTxt(l); });
    if (pctRemise(c) > 0) {
      t += `\nSous-total : ${eur(totalBrutCmd(c))}`;
      t += `\n🎂 Remise anniversaire −${num(pctRemise(c))} % : −${eur(montantRemise(totalBrutCmd(c), c))}`;
    }
    t += `\nTotal : ${eur(totalCmd(c))}\nMerci ! 😊`;
    return t;
  };
  const recapGlobal = () => {
    let t = `🥩 Récap commandes — ${fmtDateCourt(settings.date_vente)}\n\n`;
    commandes.forEach((c) => { t += `${c.nom_client} : ${eur(totalCmd(c))}\n`; });
    t += `\nTotal groupe : ${eur(totalGroupe)}`;
    return t;
  };

  /* Même récap, mais avec les noms WhatsApp précédés d'un @ : chacun
     retrouve sa ligne d'un coup d'œil. Ce n'est pas une vraie mention
     WhatsApp (impossible par collage), seulement un repère visuel. */
  const recapArobase = () => {
    let t = `🥩 ${settings.titre} — notes du ${fmtDateCourt(settings.date_vente)}\n\n`;
    commandes.forEach((c) => { t += `@${nomWa(c)} — ${eur(totalCmd(c))}\n`; });
    t += `\nTotal du groupe : ${eur(totalGroupe)}`;
    t += `\n\nLe détail de ta note est dans ton compte sur la boutique 🙂`;
    return t;
  };

  /* Annonce sans aucun montant : chacun consulte sa note dans son compte.
     C'est la version à privilégier — personne n'a à savoir ce que
     dépensent les autres. */
  const annonceNotes = () => (
    `🥩 ${settings.titre}\n\n`
    + `Vos notes du ${fmtDateCourt(settings.date_vente)} sont en ligne ✅\n\n`
    + `Connectez-vous sur la boutique et ouvrez « Mon compte » : `
    + `vous y trouverez le détail de votre commande et le montant à régler.\n\n`
    + `À tout de suite pour la distribution !`
  );

  // Ouvre WhatsApp sur la conversation du voisin, message déjà écrit.
  const ouvrirWa = (c) => {
    const tel = telWa(c);
    if (!tel) { showToast(`Pas de numéro pour ${c.nom_client}`); return; }
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(texteSortant(noteClient(c)))}`;
    marquerEnvoye(c);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /* ---- impressions ---- */
  // Note destinée au client : uniquement TES prix, jamais le coût Patrice.
  // C'est le document qu'on peut lui mettre entre les mains.
  const blocNote = (c) => {
    const rows = (c.lignes || []).map((l) => {
      const rupt = estRupture(l);
      // même ordre de priorité que le calcul : un poids saisi fait foi
      const pSaisi = valPoids(l) !== '' && !isNaN(nombre(valPoids(l)));
      const detail = rupt ? 'non fourni'
        : pSaisi
          ? `${num(nombre(valPoids(l)))} kg × ${eur(nombre(valWil(l)))}/kg`
        : l.mode_vente === 'piece_fixe'
          ? `${partiel(l) ? `${num(qteLivree(l))} sur ${num(l.quantite)}` : num(l.quantite)} × ${eur(nombre(valWil(l)))}`
          : estEstime(l) ? `${num(l.quantite)} ${l.mode_vente === 'kg' ? 'kg' : 'pc'} · poids à confirmer`
          : `${num(poidsRetenu(l))} kg × ${eur(nombre(valWil(l)))}/kg`;
      return `<tr class="${rupt ? 'rupture' : ''}">
        <td class="prod"><span class="nom">${esc(nomLigne(l))}</span></td>
        <td class="qte">${esc(detail)}</td>
        <td class="n">${rupt ? '—' : (estEstime(l) ? '≈ ' : '') + esc(eur(stLive(l)))}</td>
      </tr>`;
    }).join('');
    return `<div class="bloc note-client">
      <h2>${esc(c.nom_client)}</h2>
      <div class="tel">${esc(settings.titre)} — ${esc(fmtDateCourt(settings.date_vente))}</div>
      <table class="notecl">
        <colgroup><col class="n-prod"><col class="n-det"><col class="n-tot"></colgroup>
        <thead><tr><th>Produit</th><th>Détail</th><th class="n">Montant</th></tr></thead>
        <tbody>${rows}
          ${pctRemise(c) > 0 ? `<tr>
            <td class="prod"><span class="nom">🎂 Remise anniversaire −${esc(num(pctRemise(c)))} %</span></td>
            <td class="qte">sur ${esc(eur(totalBrutCmd(c)))}</td>
            <td class="n">−${esc(eur(montantRemise(totalBrutCmd(c), c)))}</td>
          </tr>` : ''}
          <tr class="ligne-tot">
            <td class="tot">Total à régler</td><td></td>
            <td class="n tot">${esc(eur(totalCmd(c)))}</td>
          </tr>
        </tbody>
      </table>
      <div class="pied" style="margin-top:10px;text-align:left">
        Les produits au kilo sont facturés au poids réel constaté à la pesée. Merci !
      </div>
    </div>`;
  };

  const imprimerNote = (c) => {
    const corps = `
      <div class="tete mince"><div class="barre"></div><div>
        <h1>Détail de ta commande</h1>
        <div class="meta"><b>${esc(settings.titre)}</b> — ${esc(fmtDateCourt(settings.date_vente))}</div>
      </div></div>
      ${blocNote(c)}`;
    if (!imprimerDocument(`Note ${c.nom_client}`, corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  const imprimerToutesNotes = () => {
    const corps = `
      <div class="tete mince"><div class="barre"></div><div>
        <h1>Notes des clients</h1>
        <div class="meta"><b>${esc(settings.titre)}</b> — ${esc(fmtDateCourt(settings.date_vente))}
          · ${commandes.length} note(s) · à distribuer</div>
      </div></div>
      ${commandes.map(blocNote).join('')}`;
    if (!imprimerDocument(`Notes ${settings.date_vente}`, corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  const imprimerListe = () => {
    const rows = commandes.map((c) => `
      <tr>
        <td class="prod">${esc(c.nom_client)}</td>
        <td class="qte gris">${esc(c.telephone || '')}</td>
        <td class="n tot">${esc(eur(totalCmd(c)))}</td>
        <td class="c"><span class="saisie"></span></td>
      </tr>`).join('');
    const corps = `
      <div class="tete"><div class="barre"></div><div>
        <h1>Liste d'encaissement</h1>
        <div class="meta"><b>${esc(settings.titre)}</b> — ${esc(fmtDateCourt(settings.date_vente))}
          · ${commandes.length} client(s)</div>
      </div></div>
      <table class="liste">
        <colgroup><col class="l-nom"><col class="l-tel"><col class="l-tot"><col class="l-paye"></colgroup>
        <thead><tr><th>Client</th><th>Téléphone</th><th class="n">À encaisser</th><th class="c">Réglé</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="grand"><span>Total groupe</span><span>${esc(eur(totalGroupe))}</span></div>
      <div class="pied">Viande Noisy — document généré le ${esc(new Date().toLocaleDateString('fr-FR'))}</div>`;
    if (!imprimerDocument(`Liste ${settings.date_vente}`, corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  const imprimer = () => {
    const blocs = commandes.map((c) => {
      const rows = (c.lignes || []).map((l) => {
        const rupt = estRupture(l);
        const detail = rupt ? 'EN RUPTURE — non fourni'
          : l.mode_vente === 'piece_fixe'
            ? `${partiel(l) ? `${num(qteLivree(l))} sur ${num(l.quantite)}` : num(l.quantite)} × ${eur(nombre(valWil(l)))}`
          : estEstime(l) ? `${num(l.quantite)} ${l.mode_vente === 'kg' ? 'kg' : 'pc'} · poids à confirmer`
          : `${num(poidsRetenu(l))} kg × ${eur(nombre(valWil(l)))}/kg`;
        const approx = estEstime(l) ? '≈ ' : '';
        return `<tr class="${rupt ? 'rupture' : ''}">
          <td class="prod"><span class="nom">${esc(nomLigne(l))}</span></td>
          <td class="qte">${esc(detail)}</td>
          <td class="n gris">${rupt ? '—' : approx + esc(eur(stPatriceLive(l)))}</td>
          <td class="n">${rupt ? '—' : approx + esc(eur(stLive(l)))}</td>
        </tr>`;
      }).join('');
      return `<div class="bloc">
        <h2>${esc(c.nom_client)}</h2>
        <div class="tel">${esc(c.telephone || '')}</div>
        <table class="totaux">
          <colgroup><col class="t-prod"><col class="t-det"><col class="t-pat"><col class="t-moi"></colgroup>
          <thead><tr><th>Produit</th><th>Détail</th><th class="n">Coût Patrice</th><th class="n">À encaisser</th></tr></thead>
          <tbody>${rows}
            <tr class="ligne-tot">
              <td class="tot">Total</td><td></td>
              <td class="n tot gris">${esc(eur(totalPatriceCmd(c)))}</td>
              <td class="n tot">${esc(eur(totalCmd(c)))}</td>
            </tr>
          </tbody>
        </table>
        ${c.note ? `<div class="note">« ${esc(c.note)} »</div>` : ''}
      </div>`;
    }).join('');
    const corps = `
      <div class="tete mince"><div class="barre"></div><div>
        <h1>Totaux à encaisser</h1>
        <div class="meta"><b>${esc(settings.titre)}</b> — ${esc(fmtDateCourt(settings.date_vente))}
          · ${commandes.length} client(s)</div>
      </div></div>
      ${blocs}
      <div class="bilan final">
        <div class="bilan-c"><span class="bilan-l">Total à payer à Patrice</span><span class="bilan-v">${esc(eur(totalPatriceGroupe))}</span></div>
        <div class="bilan-c"><span class="bilan-l">Total à encaisser</span><span class="bilan-v">${esc(eur(totalGroupe))}</span></div>
        <div class="bilan-c vert"><span class="bilan-l">Marge</span><span class="bilan-v">${esc(eur(totalGroupe - totalPatriceGroupe))}</span></div>
      </div>
      <div class="pied">Viande Noisy — document généré le ${esc(new Date().toLocaleDateString('fr-FR'))}</div>`;
    if (!imprimerDocument(`Totaux ${settings.date_vente}`, corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  /* ---- bloc de saisie d'une ligne ----
     Volontairement une fonction qui renvoie du JSX, et NON un composant
     défini ici : React verrait un nouveau type de composant à chaque
     rendu, démonterait les champs et le curseur sauterait à chaque
     caractère tapé. */
  const ligneSaisie = (l, sousTitre) => {
    const rupt = estRupture(l);
    /* Le poids est saisissable sur TOUTE ligne. Un produit ajouté à la
       main « à la pièce » se révèle souvent vendu au kilo une fois
       Patrice passé ; verrouiller le champ obligeait à supprimer la
       ligne et à la refaire. Poids saisi = facturé au poids, sinon à
       la pièce. Une ligne de catalogue vendue à la pièce n'a rien à y
       mettre : le champ reste vide et sans effet. */
    const auPoids = l.mode_vente !== 'piece_fixe';
    const poidsSaisi = valPoids(l) !== '' && !isNaN(nombre(valPoids(l)));
    return (
      <div className={`vp-pl ${rupt ? 'rupt' : ''}`} key={l.id}>
        <div className="vp-pl-h">
          <div className="nm">
            <span className={rupt ? 'vp-barre' : ''}>{sousTitre}</span>
            {l.demande && <span className="vp-badge-dem">DEMANDE</span>}
            {l.demande && !(nombre(valWil(l)) > 0) && (
              <small style={{ color: '#B3261E', fontWeight: 700 }}>Prix à fixer ci-dessous</small>
            )}
            <small>
              {l.mode_vente === 'kg' ? `${num(l.quantite)} kg souhaités`
                : `${num(l.quantite)} pièce(s)`}
              {rupt ? ' · non fourni' : ''}
            </small>
          </div>
          <button className={`vp-rupt-btn ${rupt ? 'on' : ''}`} onClick={() => basculerRupture(l)}>
            {rupt ? 'En rupture' : 'Rupture'}
          </button>
        </div>

        {l.demande && (
          <div className="vp-reform">
            <span className="vp-reform-o">
              Le client a écrit : <i>« {l.demande_origine || l.produit_nom} »</i>
            </span>
            <label>
              <span>Libellé pour Patrice</span>
              <input className="vp-input" value={lire(l, 'nom', l.produit_nom || '')}
                onChange={(e) => ecrire(l, 'nom', e.target.value)}
                placeholder="Reformule pour que Patrice comprenne" />
            </label>
          </div>
        )}

        <div className="vp-pl-g">
          <label>
            <span>Livré</span>
            <input className="vp-winput" inputMode="decimal" disabled={rupt}
              value={valQte(l)} onChange={(e) => ecrire(l, 'qte', e.target.value)} />
          </label>
          <label>
            <span>Poids (kg){!auPoids && !poidsSaisi ? ' · facultatif' : ''}</span>
            <input className="vp-winput" inputMode="decimal"
              placeholder={auPoids ? 'kg' : 'à la pièce'}
              disabled={rupt} value={valPoids(l)}
              onChange={(e) => ecrire(l, 'poids', e.target.value)} />
          </label>
          <label>
            <span>Prix Patrice</span>
            <input className="vp-winput" inputMode="decimal" disabled={rupt}
              value={valPat(l)} onChange={(e) => ecrire(l, 'pat', e.target.value)} />
          </label>
          <label>
            <span>Ton prix</span>
            <input className="vp-winput" inputMode="decimal" disabled={rupt}
              value={valWil(l)} onChange={(e) => ecrire(l, 'wil', e.target.value)} />
          </label>
        </div>

        <div className="vp-pl-f">
          <span>
            coût {eur(stPatriceLive(l))}
            {!rupt && partiel(l) && (
              <b className="vp-partiel">{num(qteLivree(l))} livré(s) sur {num(l.quantite)}</b>
            )}
          </span>
          <b>{estEstime(l) ? '≈ ' : ''}{eur(stLive(l))}</b>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="vp-section">
        <div className="vp-h2">Pesées &amp; ajustements</div>
        <div className="vp-sub">
          Saisis les poids réels et corrige les prix si Patrice a changé ses tarifs.
          Tout se recalcule en direct, y compris les impressions.
        </div>
        <div className="vp-vue">
          <button className={`vp-tab ${vue === 'client' ? 'on' : ''}`} onClick={() => setVue('client')}>Par client</button>
          <button className={`vp-tab ${vue === 'produit' ? 'on' : ''}`} onClick={() => setVue('produit')}>Par produit</button>
        </div>
      </div>

      {commandes.length === 0 ? (
        <div className="vp-empty">Aucune commande pour cette journée.</div>
      ) : vue === 'client' ? (
        commandes.map((c) => (
          <div className="vp-section" key={c.id}>
            <div className="vp-srow">
              <div>
                <div className="vp-h2" style={{ fontSize: 17 }}>{c.nom_client}</div>
                {c.telephone && <div className="vp-sub">{c.telephone}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="vp-h2" style={{ fontSize: 17, color: 'var(--wine)' }}>{eur(totalCmd(c))}</div>
                {pctRemise(c) > 0 && (
                  <div className="vp-marge" style={{ color: 'var(--wine)' }}>
                    🎂 −{num(pctRemise(c))} % ({eur(montantRemise(totalBrutCmd(c), c))})
                  </div>
                )}
                <div className="vp-marge">marge {eur(totalCmd(c) - totalPatriceCmd(c))}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {(c.lignes || []).map((l) => ligneSaisie(l, `${l.emoji} ${nomLigne(l)}`))}
            </div>
            {ajoutPour === c.id ? (
              <div className="vp-ajout">
                <div className="vp-srow">
                  <b style={{ fontSize: 14.5 }}>Ajouter un produit à {c.nom_client}</b>
                  <button className="vp-sheet-x" onClick={() => { setAjoutPour(null); reinitAjout(); }}
                    aria-label="Annuler">×</button>
                </div>

                <div className="vp-field">
                  <label className="vp-label">Produit</label>
                  <input className="vp-input" value={aNom} autoComplete="off"
                    onChange={(e) => { setANom(e.target.value); setAProduit(null); }}
                    placeholder="Tape un nom, ou écris-le librement" />
                  {!aProduit && suggestionsAjout.length > 0 && (
                    <div className="vp-sugg" style={{ marginTop: 8 }}>
                      {suggestionsAjout.map((p) => (
                        <button key={p.id} className="vp-sugg-b" onClick={() => prendreProduit(p)}>
                          {p.emoji} {p.nom}
                        </button>
                      ))}
                    </div>
                  )}
                  {aProduit && variantesDe(aProduit).length > 0 && (
                    <select className="vp-input" style={{ marginTop: 8 }} value={aVar}
                      onChange={(e) => setAVar(e.target.value)}>
                      {variantesDe(aProduit).map((v) => (
                        <option key={v.id} value={v.id}>{v.nom}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="vp-seg" style={{ marginTop: 10 }}>
                  <button className={!aKilo ? 'on' : ''} onClick={() => setAKilo(false)}>À la pièce</button>
                  <button className={aKilo ? 'on' : ''} onClick={() => setAKilo(true)}>Au poids</button>
                </div>

                <div className="vp-pl-g">
                  <label>
                    <span>Quantité</span>
                    <input className="vp-winput" inputMode="decimal" value={aQte}
                      onChange={(e) => setAQte(e.target.value)} />
                  </label>
                  <label>
                    <span>Poids (kg)</span>
                    <input className="vp-winput" inputMode="decimal" value={aPoids} disabled={!aKilo}
                      onChange={(e) => setAPoids(e.target.value)} placeholder={aKilo ? 'kg' : '—'} />
                  </label>
                  <label>
                    <span>Prix Patrice</span>
                    <input className="vp-winput" inputMode="decimal" value={aPat}
                      onChange={(e) => setAPat(e.target.value)} />
                  </label>
                  <label>
                    <span>Ton prix</span>
                    <input className="vp-winput" inputMode="decimal" value={aWil}
                      onChange={(e) => setAWil(e.target.value)} />
                  </label>
                </div>

                <div className="vp-pl-f">
                  <span>
                    coût {eur(aPoids.trim() !== '' && !isNaN(nombre(aPoids))
                      ? nombre(aPoids) * (nombre(aPat) || 0)
                      : (aKilo ? 0 : (nombre(aQte) || 0) * (nombre(aPat) || 0)))}
                  </span>
                  <b>
                    {eur(aPoids.trim() !== '' && !isNaN(nombre(aPoids))
                      ? nombre(aPoids) * (nombre(aWil) || 0)
                      : (aKilo ? 0 : (nombre(aQte) || 0) * (nombre(aWil) || 0)))}
                  </b>
                </div>

                <button className="vp-btn" style={{ width: '100%', marginTop: 10 }}
                  disabled={aEnvoi} onClick={() => enregistrerAjout(c)}>
                  {aEnvoi ? 'Ajout…' : 'Ajouter cette ligne'}
                </button>
                <div className="vp-sub" style={{ marginTop: 6 }}>
                  Au poids sans pesée saisie, la ligne arrive à 0 € : tu la complètes juste au-dessus.
                </div>
              </div>
            ) : (
              <button className="vp-ajout-b" onClick={() => ouvrirAjout(c)}>
                ＋ Ajouter un produit à cette commande
              </button>
            )}

            {c.note && <div className="vp-sub" style={{ marginTop: 8, fontStyle: 'italic' }}>« {c.note} »</div>}
            <div className="vp-grid2" style={{ marginTop: 10 }}>
              <button className="vp-btn ghost sm"
                onClick={async () => { (await copier(noteClient(c))) && showToast(`Note de ${c.nom_client} copiée`); }}>
                Copier sa note
              </button>
              <button className="vp-btn ghost sm" onClick={() => imprimerNote(c)}>
                Imprimer sa note
              </button>
            </div>
          </div>
        ))
      ) : (
        liste.map((g) => (
          <div className="vp-section" key={g.nom}>
            <div className="vp-h2" style={{ fontSize: 16 }}>{g.emoji} {g.nom}</div>
            <div className="vp-groupe-prix">
              <span>Appliquer à tout le produit</span>
              <input className="vp-winput" inputMode="decimal" placeholder="Patrice"
                value={prixGroupe[`${g.nom}|pat`] ?? ''}
                onChange={(e) => appliquerAuGroupe(g, 'pat', e.target.value)} />
              <input className="vp-winput" inputMode="decimal" placeholder="Ton prix"
                value={prixGroupe[`${g.nom}|wil`] ?? ''}
                onChange={(e) => appliquerAuGroupe(g, 'wil', e.target.value)} />
            </div>
            {g.lignes.map(({ l, client }) => ligneSaisie(l, client))}
          </div>
        ))
      )}

      {commandes.length > 0 && (
        <>
          <button className="vp-cta" disabled={enCours || nbModifs === 0} onClick={enregistrer}>
            {enCours ? 'Enregistrement…'
              : nbModifs === 0 ? 'Aucune modification à enregistrer'
              : `Enregistrer ${nbModifs} ligne${nbModifs > 1 ? 's' : ''} & recalculer`}
          </button>

          <div className="vp-section" style={{ marginTop: 14 }}>
            <div className="vp-srow">
              <div className="vp-h2" style={{ fontSize: 16 }}>Feuille de totaux</div>
              <div style={{ textAlign: 'right' }}>
                <div className="vp-h2" style={{ fontSize: 16, color: 'var(--wine)' }}>{eur(totalGroupe)}</div>
                <div className="vp-marge">marge {eur(totalGroupe - totalPatriceGroupe)}</div>
              </div>
            </div>
            <div className="vp-sub">
              À payer à Patrice : <b>{eur(totalPatriceGroupe)}</b>.
            </div>
            <button className="vp-cta" style={{ marginTop: 12 }} onClick={imprimerToutesNotes}>
              Imprimer les notes des clients
            </button>
            <div className="vp-sub" style={{ marginTop: 6 }}>
              Une note par voisin, avec <b>tes prix uniquement</b> — aucun coût Patrice.
              C'est le document à leur remettre.
            </div>

            <div className="vp-grid2" style={{ marginTop: 16 }}>
              <button className="vp-btn ghost" onClick={imprimer}>Détail + coûts (pour toi)</button>
              <button className="vp-btn green" onClick={async () => { (await copier(recapGlobal())) && showToast('Récap global copié'); }}>Copier le récap</button>
            </div>
          </div>

          <div className="vp-section">
            <div className="vp-srow">
              <div>
                <div className="vp-h2" style={{ fontSize: 16 }}>Envoyer les notes sur WhatsApp</div>
                <div className="vp-sub">
                  Un message privé par voisin, sa note déjà écrite. C'est la seule façon
                  d'être réellement notifié — et personne ne voit ce que dépensent les autres.
                </div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div className="vp-h2" style={{ fontSize: 16, color: 'var(--green)' }}>
                  {envoyes.length}/{commandes.length}
                </div>
                <div className="vp-marge">envoyés</div>
              </div>
            </div>

            <div className="vp-liste" style={{ marginTop: 12 }}>
              {commandes.map((c) => (
                telEdit && telEdit.id === c.id ? (
                  <div className="vp-liste-l" key={c.id} style={{ display: 'block' }}>
                    <div style={{ fontWeight: 700 }}>{c.nom_client}</div>
                    <div className="vp-sub" style={{ marginTop: 2 }}>
                      {c.user_id
                        ? 'Enregistré sur la commande et dans sa fiche membre.'
                        : "Commande saisie à la main : ça ne vaut que pour cette commande."}
                    </div>
                    <label className="vp-label" style={{ marginTop: 8 }}>Téléphone</label>
                    <input className="vp-input" autoFocus
                      inputMode="tel" type="tel" placeholder="06 12 34 56 78"
                      value={telEdit.tel}
                      onChange={(e) => setTelEdit({ ...telEdit, tel: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') enregistrerTel(c); }} />
                    {c.user_id && (
                      <>
                        <label className="vp-label" style={{ marginTop: 10 }}>Ton repère pour cette personne</label>
                        <input className="vp-input" value={telEdit.pseudo}
                          placeholder="Ex : Amélie Mouranchon, Vincent le grand…"
                          onChange={(e) => setTelEdit({ ...telEdit, pseudo: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') enregistrerTel(c); }} />
                        <div className="vp-sub" style={{ marginTop: 5 }}>
                          Remplace le nom du compte partout dans l'admin, et dans le
                          récap du groupe. Retenu pour les prochaines commandes.
                        </div>
                      </>
                    )}
                    <div className="vp-grid2" style={{ marginTop: 10 }}>
                      <button className="vp-btn ghost sm" onClick={() => setTelEdit(null)}>Annuler</button>
                      <button className="vp-btn green sm" disabled={telEnvoi}
                        onClick={() => enregistrerTel(c)}>
                        {telEnvoi ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="vp-liste-l" key={c.id}>
                    <span style={{ minWidth: 0 }}>
                      {dejaEnvoye(c) ? '✅ ' : ''}
                      {alias[String(c.user_id)] || c.nom_client}
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                        {alias[String(c.user_id)]
                          ? `compte : ${c.nom_client} · `
                          : (c.user_id ? '🏷️ sans repère · ' : '')}
                        {telDe(c)
                          ? telDe(c)
                          : <span style={{ color: 'var(--wine)', fontWeight: 700 }}>sans numéro</span>}
                        {' · '}{eur(totalCmd(c))}
                      </small>
                    </span>
                    <div className="vp-macmd-b">
                      <button className="vp-btn ghost sm" onClick={() => ouvrirTel(c)}
                        aria-label={`Modifier le numéro et le nom WhatsApp de ${c.nom_client}`}>
                        {c.telephone ? '✎' : '＋ numéro'}
                      </button>
                      <button className={`vp-btn sm ${dejaEnvoye(c) ? 'ghost' : 'green'}`}
                        disabled={!telWa(c)} onClick={() => ouvrirWa(c)}>
                        {dejaEnvoye(c) ? 'Renvoyer' : 'Envoyer'}
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>

            {envoyes.length > 0 && (
              <button className="vp-btn ghost sm" style={{ marginTop: 10 }}
                onClick={() => setEnvoyes([])}>
                Remettre les coches à zéro
              </button>
            )}

            <div className="vp-sub" style={{ marginTop: 12 }}>
              Chaque bouton ouvre la conversation du voisin avec le message prêt&nbsp;:
              il te reste à appuyer sur envoyer. Les coches ✅ te servent à ne pas
              perdre le fil — elles disparaissent si tu recharges la page.
              <br />
              <b>＋ numéro</b> ou <b>✎</b> pour corriger sur place le téléphone et le
              nom WhatsApp. Pour un membre, la correction va aussi dans sa fiche&nbsp;:
              tu ne la refais pas à la commande suivante. L'onglet <b>Membres</b> permet
              de compléter tous les noms WhatsApp d'un coup.
            </div>
          </div>

          <div className="vp-section">
            <div className="vp-h2" style={{ fontSize: 16 }}>Un seul message dans le groupe</div>
            <div className="vp-sub">
              Si tu préfères tout annoncer d'un coup, deux formulations à coller
              dans le groupe WhatsApp.
            </div>

            <button className="vp-btn green" style={{ width: '100%', marginTop: 12 }}
              onClick={async () => { (await copier(annonceNotes())) && showToast('Annonce copiée'); }}>
              Copier « vos notes sont en ligne » (sans montants)
            </button>
            <div className="vp-sub" style={{ marginTop: 6 }}>
              Recommandé : chacun ouvre « Mon compte » et voit sa note détaillée.
              Aucun montant n'est étalé dans le groupe.
            </div>

            <button className="vp-btn" style={{ width: '100%', marginTop: 14 }}
              onClick={async () => { (await copier(recapArobase())) && showToast('Récap avec @ copié'); }}>
              Copier le récap avec les @noms
            </button>
            <div className="vp-rupt-note" style={{ marginTop: 8 }}>
              <b>À savoir :</b> un «&nbsp;@nom&nbsp;» collé dans WhatsApp reste du
              texte simple — il ne déclenche <b>aucune notification</b> et n'apparaît
              pas en bleu. WhatsApp ne crée une vraie mention que si tu tapes le
              «&nbsp;@&nbsp;» toi-même dans la zone de saisie et que tu choisis le
              contact dans la liste qui s'ouvre. Ce récap sert donc juste à ce que
              chacun repère sa ligne. Pour être sûr que les gens voient leur montant,
              utilise les envois individuels juste au-dessus.
            </div>
          </div>

          <div className="vp-section">
            <div className="vp-h2" style={{ fontSize: 16 }}>Liste d'encaissement</div>
            <div className="vp-sub">Un nom, un montant. À imprimer pour faire le tour des voisins.</div>
            <div className="vp-liste">
              {commandes.map((c) => (
                <div className="vp-liste-l" key={c.id}>
                  <span>{c.nom_client}</span>
                  <b>{eur(totalCmd(c))}</b>
                </div>
              ))}
              <div className="vp-liste-l tot"><span>Total groupe</span><b>{eur(totalGroupe)}</b></div>
            </div>
            <button className="vp-btn" style={{ width: '100%', marginTop: 12 }} onClick={imprimerListe}>
              Imprimer / PDF — liste d'encaissement
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Admin : Membres ---------- */
function AdminMembres({ showToast, settings }) {
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');

  const [reperes, setReperes] = useState({});

  const charger = async () => {
    const [{ data, error }, reps] = await Promise.all([
      supabase.from('viande_clients').select('*').order('created_at', { ascending: false }),
      chargerReperes(),
    ]);
    if (error) showToast(messageErreur(error));
    setMembres(data || []);
    setReperes(reps);
    setChargement(false);
  };
  useEffect(() => { charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ton repère d'abord, le nom qu'il a donné à l'inscription ensuite
  const repereDe = (m) => {
    const r = reperes[String(m.id)];
    return (r && r.repere) || m.alias_whatsapp || '';
  };

  /* ---- pseudo WhatsApp ----
     Le champ est facultatif à l'inscription et beaucoup le laissent
     vide, ou s'inscrivent sous un nom qui n'est pas celui affiché sur
     WhatsApp. Sans ce repère, impossible de retrouver la bonne
     conversation au moment d'envoyer les notes. */
  const [aliasEdit, setAliasEdit] = useState(null); // { id, valeur }
  const [aliasEnvoi, setAliasEnvoi] = useState(false);
  // 'tous' | 'repere' | 'anniv' | 'incomplet'
  const [filtre, setFiltre] = useState('tous');

  /* ---- codes promo ----
     Tu peux en créer un à la main (dépannage, geste commercial) et
     voir tous ceux qui circulent. Les fonctions sont protégées par
     ton code PIN, vérifié côté base. */
  const PIN = (settings && settings.pin_admin) || '';
  const [codes, setCodes] = useState([]);
  const [codesOuvert, setCodesOuvert] = useState(false);
  const [changements, setChangements] = useState([]);
  const [codeEnCours, setCodeEnCours] = useState(false);

  const chargerCodes = async () => {
    const [{ data: cs }, { data: ch }] = await Promise.all([
      supabase.rpc('admin_lister_codes', { p_pin: PIN }),
      supabase.rpc('admin_changements_naissance', { p_pin: PIN }),
    ]);
    setCodes(cs || []);
    setChangements(ch || []);
  };
  useEffect(() => { if (PIN) chargerCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [PIN]);

  const etatCode = (c) => {
    if (c.utilise_le) return { txt: 'utilisé', coul: 'var(--muted)' };
    if (new Date(c.expire_le) <= new Date()) return { txt: 'expiré', coul: 'var(--muted)' };
    const j = Math.ceil((new Date(c.expire_le) - new Date()) / 86400000);
    return { txt: `actif · ${j} j`, coul: 'var(--green)' };
  };

  const creerCodePour = async (m) => {
    const pct = window.prompt(`Remise pour ${m.nom} — pourcentage ?`, '5');
    if (pct === null) return;
    const n = nombre(pct);
    if (isNaN(n) || n <= 0 || n >= 100) { showToast('Pourcentage invalide'); return; }
    const jours = window.prompt('Valable combien de jours ?', '7');
    if (jours === null) return;
    const j = Math.round(nombre(jours));
    if (isNaN(j) || j < 1) { showToast('Durée invalide'); return; }
    setCodeEnCours(true);
    try {
      const { data, error } = await supabase.rpc('admin_creer_code', {
        p_pin: PIN, p_user: m.id, p_pct: n, p_jours: j, p_motif: 'geste',
      });
      if (error) { showToast(messageErreur(error)); return; }
      if (!data) { showToast('Refusé — vérifie ton code PIN dans Réglages'); return; }
      await chargerCodes();
      setCodesOuvert(true);
      showToast(`Code ${data} créé pour ${m.nom} — ${n} % pendant ${j} j`);
    } finally { setCodeEnCours(false); }
  };

  const supprimerCode = async (c) => {
    if (!window.confirm(`Supprimer le code ${c.code} de ${c.nom} ?`)) return;
    const { error } = await supabase.rpc('admin_supprimer_code', { p_pin: PIN, p_code: c.code });
    if (error) { showToast(messageErreur(error)); return; }
    chargerCodes(); showToast('Code supprimé');
  };

  const reactiverCode = async (c) => {
    if (!window.confirm(`Rendre le code ${c.code} à nouveau utilisable pendant 7 jours ?`)) return;
    const { error } = await supabase.rpc('admin_reactiver_code', { p_pin: PIN, p_code: c.code, p_jours: 7 });
    if (error) { showToast(messageErreur(error)); return; }
    chargerCodes(); showToast('Code réactivé');
  };

  const enregistrerAlias = async (m) => {
    const v = (aliasEdit && aliasEdit.valeur ? aliasEdit.valeur : '').trim();
    setAliasEnvoi(true);
    try {
      const r = await enregistrerRepere(m.id, { repere: v || null });
      if (!r.ok) { showToast(r.message); return; }
      setAliasEdit(null);
      charger();
      showToast(v ? `Repère enregistré : ${v}` : 'Repère effacé');
    } finally { setAliasEnvoi(false); }
  };

  const basculerBlocage = async (m) => {
    if (!m.bloque && !window.confirm(
      `Bloquer ${m.nom} ?\n\nSon compte restera actif mais il ne pourra plus commander.`
    )) return;
    const r = await majFicheClient(m.id, { bloque: !m.bloque });
    if (!r.ok) { showToast(r.message); return; }
    charger();
    showToast(!m.bloque ? 'Compte bloqué' : 'Blocage levé');
  };

  const q = normaliser(recherche.trim());
  const parRecherche = !q ? membres : membres.filter((m) =>
    normaliser(m.nom).includes(q) || normaliser(m.email).includes(q)
    || normaliser(repereDe(m)).includes(q)
    || String(m.telephone || '').includes(recherche.trim()));
  const nbSansAlias = membres.filter((m) => !m.bloque && !repereDe(m)).length;
  // Un profil « complet » a de quoi envoyer une facture et penser à la
  // personne le jour venu.
  const profilComplet = (m) => !!(m.nom && m.telephone && m.date_naissance && m.ville);
  const manques = (m) => [
    !repereDe(m) && 'repère',
    !m.date_naissance && 'anniversaire',
    !m.ville && 'commune',
    !m.telephone && 'téléphone',
  ].filter(Boolean);

  const listeFiltree =
      filtre === 'repere'    ? parRecherche.filter((m) => !repereDe(m))
    : filtre === 'anniv'     ? parRecherche.filter((m) => !m.date_naissance)
    : filtre === 'incomplet' ? parRecherche.filter((m) => !profilComplet(m))
    : parRecherche;

  const nbSansAnniv = membres.filter((m) => !m.bloque && !m.date_naissance).length;
  const nbIncomplets = membres.filter((m) => !m.bloque && !profilComplet(m)).length;
  const nbAnnivAuj = membres.filter((m) => estAnniversaire(m.date_naissance)).length;

  // Homonymes : c'est là que le repère devient indispensable.
  const prenomsEnDouble = new Set(
    Object.entries(
      membres.reduce((acc, m) => {
        const k = normaliser(String(m.nom || '').trim().split(/\s+/)[0]);
        if (k) acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    ).filter(([, n]) => n > 1).map(([k]) => k)
  );
  const estHomonyme = (m) =>
    prenomsEnDouble.has(normaliser(String(m.nom || '').trim().split(/\s+/)[0]));

  const texte = () => membres
    .filter((m) => !m.bloque)
    .map((m) => `${m.nom}${repereDe(m) ? ` (${repereDe(m)})` : ''} : ${m.telephone}`)
    .join('\n');

  /* ---- parrainages ----
     Qui fait réellement grandir le groupe. Les noms sont regroupés
     sans tenir compte de la casse ni des accents, sinon « Jean-Luc »
     et « jean luc » comptent pour deux. */
  const [parrainsOuvert, setParrainsOuvert] = useState(false);
  const classementParrains = Object.values(
    membres.reduce((acc, m) => {
      const nomP = String(m.parrain || '').trim();
      if (!nomP) return acc;
      const k = normaliser(nomP);
      if (!acc[k]) acc[k] = { nom: nomP, cle: k, filleuls: [] };
      acc[k].filleuls.push(m);
      return acc;
    }, {})
  ).sort((a, b) => b.filleuls.length - a.filleuls.length);

  /* Le nom saisi correspond-il à un compte ? On compare le texte libre
     au prénom du compte et au repère, sans casse ni accents, et on
     accepte qu'il soit contenu dans l'autre (« Jean » ↔ « Jean Dupont »).
     Trouvé, le parrain est récompensable en un clic. */
  const compteDuParrain = (p2) => membres.find((m) => {
    const a2 = normaliser(m.nom);
    const b2 = normaliser(repereDe(m));
    return a2 === p2.cle || b2 === p2.cle
      || (p2.cle.length >= 4 && (a2.includes(p2.cle) || p2.cle.includes(a2)))
      || (b2 && p2.cle.length >= 4 && (b2.includes(p2.cle) || p2.cle.includes(b2)));
  }) || null;

  /* ---- export de la base ----
     Un seul fichier, lisible par Excel comme par les outils d'envoi
     (Brevo, Mailchimp, Sendinblue…). La colonne « Newsletter » est
     la première chose à filtrer avant d'écrire à qui que ce soit. */
  const nbNews = membres.filter((m) => !m.bloque && m.newsletter !== false).length;
  const nbRefus = membres.filter((m) => !m.bloque && m.newsletter === false).length;

  const exporter = (seulementAbonnes) => {
    const liste = membres
      .filter((m) => !m.bloque)
      .filter((m) => (seulementAbonnes ? m.newsletter !== false : true))
      .filter((m) => (seulementAbonnes ? String(m.email || '').includes('@') : true));
    if (!liste.length) { showToast('Personne à exporter'); return; }

    const entetes = [
      'Nom', 'Repere', 'Email', 'Telephone', 'Nom WhatsApp',
      'Commune', 'Code postal', 'Anniversaire', 'Date de naissance',
      'Newsletter', 'Parraine par', 'Inscrit le',
    ];
    const lignes = liste.map((m) => [
      m.nom || '',
      repereDe(m),
      m.email || '',
      m.telephone || '',
      m.alias_whatsapp || '',
      m.ville || '',
      m.code_postal || '',
      m.date_naissance ? annivLisible(m.date_naissance) : '',
      m.date_naissance ? String(m.date_naissance).slice(0, 10) : '',
      m.newsletter === false ? 'non' : 'oui',
      m.parrain || '',
      m.created_at ? new Date(m.created_at).toLocaleDateString('fr-FR') : '',
    ]);

    const jour = new Date().toISOString().slice(0, 10);
    const nomFichier = seulementAbonnes
      ? `viande-noisy-newsletter-${jour}.csv`
      : `viande-noisy-membres-${jour}.csv`;
    if (telecharger(nomFichier, versCsv(entetes, lignes))) {
      showToast(`${liste.length} contact(s) exporté(s)`);
    } else {
      showToast('Téléchargement impossible sur cet appareil');
    }
  };

  /* ---- anniversaires ----
     Pas d'envoi automatique possible : WhatsApp n'autorise l'écriture
     qu'aux numéros qui ont donné leur accord, et ce n'est le cas que
     du tien. L'app te prévient donc, et tu envoies d'un clic — ce qui
     vaut mieux qu'un message robot, pour ce genre d'attention. */
  const [annivOuvert, setAnnivOuvert] = useState(false);

  const aFeter = membres
    .filter((m) => !m.bloque && m.date_naissance)
    .map((m) => ({ m, dans: joursAvantAnniv(m.date_naissance) }))
    .filter((x) => x.dans !== null && x.dans <= 30)
    .sort((a, b) => a.dans - b.dans);
  const aujourdhui = aFeter.filter((x) => x.dans === 0);

  const messageAnniv = (m) => (
    `🎂 Joyeux anniversaire ${m.nom} !\n\n`
    + `Une très belle journée à toi, de la part de ${(settings && settings.titre) || 'Viande Noisy'}. 🥩\n`
    + `Profite bien, et à bientôt pour la prochaine commande !`
  );

  const envoyerAnniv = (m) => {
    const d = String(m.telephone || '').replace(/\D/g, '');
    if (!d) { showToast(`Pas de numéro pour ${m.nom}`); return; }
    const tel = d.startsWith('33') ? d : d.startsWith('0') ? `33${d.slice(1)}` : d;
    window.open(
      `https://wa.me/${tel}?text=${encodeURIComponent(texteSortant(messageAnniv(m)))}`,
      '_blank', 'noopener,noreferrer'
    );
  };

  const quand = (n) => (n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`);

  return (
    <>
      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">{membres.length} membre(s)</div>
            <div className="vp-sub">
              Inscription libre et immédiate. Tu peux bloquer un compte ici si besoin.
            </div>
          </div>
          <button className="vp-btn ghost sm"
            onClick={async () => { (await copier(texte())) && showToast('Liste copiée'); }}>
            Copier
          </button>
        </div>

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <button className="vp-btn green sm" onClick={() => exporter(true)}>
            ✉️ Export newsletter ({nbNews})
          </button>
          <button className="vp-btn ghost sm" onClick={() => exporter(false)}>
            📄 Export complet
          </button>
        </div>
        <div className="vp-sub" style={{ marginTop: 6 }}>
          Fichier CSV, ouvrable dans Excel et importable dans Brevo ou Mailchimp.
          L'export newsletter ne contient que les personnes ayant une adresse e-mail
          et <b>n'ayant pas refusé</b> de recevoir tes annonces
          {nbRefus > 0 ? ` (${nbRefus} refus à ce jour)` : ''}.
          Pense à inclure un lien de désinscription dans tes envois.
        </div>

        <div className="vp-tabs" style={{ marginTop: 12 }}>
          <button className={filtre === 'tous' ? 'on' : ''} onClick={() => setFiltre('tous')}>
            Tous ({membres.length})
          </button>
          {nbIncomplets > 0 && (
            <button className={filtre === 'incomplet' ? 'on' : ''} onClick={() => setFiltre('incomplet')}>
              📋 Profil à compléter ({nbIncomplets})
            </button>
          )}
          {nbSansAnniv > 0 && (
            <button className={filtre === 'anniv' ? 'on' : ''} onClick={() => setFiltre('anniv')}>
              🎂 Sans date ({nbSansAnniv})
            </button>
          )}
          {nbSansAlias > 0 && (
            <button className={filtre === 'repere' ? 'on' : ''} onClick={() => setFiltre('repere')}>
              🏷️ Sans repère ({nbSansAlias})
            </button>
          )}
        </div>

        <div className="vp-sub" style={{ marginTop: 8 }}>
          {filtre === 'repere' ? (
            <>Un repère, c'est <b>ta</b> façon de reconnaître quelqu'un : nom de famille,
            surnom, lieu-dit. Il remplace le nom du compte partout dans l'admin —
            indispensable quand quatre Vincent commandent le même jour.</>
          ) : filtre === 'anniv' ? (
            <>Ceux qui n'ont pas renseigné leur date de naissance. Elle est facultative,
            mais sans elle pas de remise d'anniversaire — un petit rappel dans le groupe
            suffit souvent.</>
          ) : filtre === 'incomplet' ? (
            <>Il manque à ces comptes au moins un élément parmi : repère, date
            d'anniversaire, commune, téléphone. Le détail est indiqué sur chaque fiche.</>
          ) : (
            <>
              {membres.filter((m) => profilComplet(m)).length} profil(s) complet(s)
              sur {membres.length}.
              {nbAnnivAuj > 0 && <> · <b style={{ color: 'var(--wine)' }}>
                🎉 {nbAnnivAuj} anniversaire{nbAnnivAuj > 1 ? 's' : ''} aujourd'hui
              </b></>}
            </>
          )}
        </div>
      </div>

      {aFeter.length > 0 && (
        <div className="vp-section" style={{ marginTop: 14 }}>
          <div className="vp-srow">
            <div>
              <div className="vp-h2" style={{ fontSize: 16 }}>
                🎂 {aujourdhui.length > 0
                  ? `${aujourdhui.length} anniversaire${aujourdhui.length > 1 ? 's' : ''} aujourd'hui`
                  : `Prochain anniversaire ${quand(aFeter[0].dans)}`}
              </div>
              <div className="vp-sub">{aFeter.length} dans les 30 jours qui viennent.</div>
            </div>
            <button className="vp-btn ghost sm" onClick={() => setAnnivOuvert(!annivOuvert)}>
              {annivOuvert ? 'Masquer' : 'Voir'}
            </button>
          </div>

          {(annivOuvert || aujourdhui.length > 0) && (
            <div className="vp-liste" style={{ marginTop: 12 }}>
              {(annivOuvert ? aFeter : aujourdhui).map(({ m, dans }) => (
                <div className="vp-liste-l" key={m.id}>
                  <span style={{ minWidth: 0 }}>
                    {dans === 0 ? '🎉 ' : ''}{repereDe(m) || m.nom}
                    <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                      {annivLisible(m.date_naissance)} · {quand(dans)}
                      {m.telephone ? '' : ' · sans numéro'}
                    </small>
                  </span>
                  <button className={`vp-btn sm ${dans === 0 ? 'green' : 'ghost'}`}
                    style={{ flex: '0 0 auto' }}
                    disabled={!m.telephone} onClick={() => envoyerAnniv(m)}>
                    Souhaiter
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="vp-sub" style={{ marginTop: 10 }}>
            Le bouton ouvre la conversation WhatsApp avec le message déjà écrit —
            tu peux le retoucher avant d'envoyer. Pas d'envoi automatique&nbsp;:
            WhatsApp n'autorise l'écriture qu'aux numéros qui l'ont accepté, et
            un mot de ta main vaut mieux qu'un message de robot.
          </div>
        </div>
      )}

      {classementParrains.length > 0 && (
        <div className="vp-section" style={{ marginTop: 14 }}>
          <div className="vp-srow">
            <div>
              <div className="vp-h2" style={{ fontSize: 16 }}>
                🤝 {classementParrains.length} parrain(s)
              </div>
              <div className="vp-sub">
                {classementParrains.reduce((n, p2) => n + p2.filleuls.length, 0)} inscriptions
                amenées par un voisin.
              </div>
            </div>
            <button className="vp-btn ghost sm" onClick={() => setParrainsOuvert(!parrainsOuvert)}>
              {parrainsOuvert ? 'Masquer' : 'Voir'}
            </button>
          </div>

          {parrainsOuvert && (
            <>
              <div className="vp-liste" style={{ marginTop: 12 }}>
                {classementParrains.map((p2, i) => {
                  const compte = compteDuParrain(p2);
                  return (
                    <div className="vp-liste-l" key={p2.nom + i}>
                      <span style={{ minWidth: 0 }}>
                        {i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}
                        <b>{p2.nom}</b>
                        {!compte && <span className="vp-badge-dbl">PAS DE COMPTE</span>}
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                          {p2.filleuls.length} filleul(s) : {p2.filleuls.map((f) => f.nom).join(', ')}
                        </small>
                      </span>
                      <div className="vp-macmd-b">
                        {compte && (
                          <button className="vp-btn ghost sm" disabled={codeEnCours}
                            onClick={() => creerCodePour(compte)}>🎁 Merci</button>
                        )}
                        <b style={{ alignSelf: 'center' }}>{p2.filleuls.length}</b>
                      </div>
                    </div>
                  );
                })}
              </div>

            </>
          )}
        </div>
      )}

      {(codes.length > 0 || changements.length > 0) && (
        <div className="vp-section" style={{ marginTop: 14 }}>
          <div className="vp-srow">
            <div>
              <div className="vp-h2" style={{ fontSize: 16 }}>
                🎁 {codes.filter((c) => !c.utilise_le && new Date(c.expire_le) > new Date()).length} code(s) actif(s)
              </div>
              <div className="vp-sub">
                {codes.length} au total · {codes.filter((c) => c.utilise_le).length} utilisé(s)
                {changements.length > 0 && ` · ${changements.length} changement(s) de date`}
              </div>
            </div>
            <button className="vp-btn ghost sm" onClick={() => setCodesOuvert(!codesOuvert)}>
              {codesOuvert ? 'Masquer' : 'Voir'}
            </button>
          </div>

          {codesOuvert && (
            <>
              <div className="vp-liste" style={{ marginTop: 12 }}>
                {codes.map((c) => {
                  const e = etatCode(c);
                  return (
                    <div className="vp-liste-l" key={c.code}>
                      <span style={{ minWidth: 0 }}>
                        <b>{c.code}</b> · {num(c.pct)} %
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                          {c.nom} · <span style={{ color: e.coul, fontWeight: 700 }}>{e.txt}</span>
                          {c.motif !== 'anniversaire' ? ` · ${c.motif}` : ' · anniversaire'}
                        </small>
                      </span>
                      <div className="vp-macmd-b">
                        {c.utilise_le && (
                          <button className="vp-btn ghost sm" onClick={() => reactiverCode(c)}>Rendre</button>
                        )}
                        <button className="vp-btn ghost sm" onClick={() => supprimerCode(c)}>Suppr.</button>
                      </div>
                    </div>
                  );
                })}
                {codes.length === 0 && <div className="vp-liste-l"><span>Aucun code émis.</span></div>}
              </div>

              {changements.length > 0 && (
                <>
                  <div className="vp-h2" style={{ fontSize: 15, marginTop: 16 }}>
                    Dates de naissance modifiées
                  </div>
                  <div className="vp-sub">
                    Un code par personne et par an, quoi qu'il arrive — mais une date
                    qui bouge souvent mérite un coup d'œil.
                  </div>
                  <div className="vp-liste" style={{ marginTop: 10 }}>
                    {changements.map((h, i) => (
                      <div className="vp-liste-l" key={i}>
                        <span style={{ minWidth: 0 }}>
                          {h.nom}
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>
                            {h.ancienne ? annivLisible(h.ancienne) : '(vide)'} → {h.nouvelle ? annivLisible(h.nouvelle) : '(vide)'}
                            {' · '}{new Date(h.change_le).toLocaleDateString('fr-FR')}
                          </small>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {membres.length > 3 && (
        <div className="vp-search">
          <span className="vp-search-ico">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input className="vp-input" value={recherche} type="search" autoComplete="off"
            onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, nom WhatsApp, e-mail ou téléphone…" />
          {recherche && (
            <button className="vp-search-clear" onClick={() => setRecherche('')} aria-label="Effacer">×</button>
          )}
        </div>
      )}

      {chargement ? (
        <div className="vp-empty">Chargement…</div>
      ) : listeFiltree.length === 0 ? (
        <div className="vp-empty">
          {membres.length === 0 ? 'Aucun compte pour l\'instant.' : 'Aucun membre ne correspond.'}
        </div>
      ) : listeFiltree.map((m) => (
        <div className="vp-cmd" key={m.id}>
          <div className="vp-srow">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>
                {m.nom}
                {estAnniversaire(m.date_naissance) && (
                  <span className="vp-badge-dbl">🎉 ANNIVERSAIRE AUJOURD'HUI</span>
                )}
                {m.bloque && <span className="vp-rupt-pill" style={{ marginLeft: 6 }}>BLOQUÉ</span>}
              </div>
              {repereDe(m)
                ? <div className="vp-alias">🏷️ {repereDe(m)}</div>
                : (
                  <div className="vp-alias" style={{
                    opacity: estHomonyme(m) ? 1 : 0.6,
                    color: estHomonyme(m) ? 'var(--wine)' : undefined,
                  }}>
                    {estHomonyme(m) ? '⚠️ homonyme — pas encore de repère' : 'pas de repère'}
                  </div>
                )}
              <div className="vp-sub">
                {m.telephone || <span style={{ color: 'var(--wine)', fontWeight: 700 }}>sans téléphone</span>}
                {m.ville && <> · {m.ville}{m.code_postal ? ` (${m.code_postal})` : ''}</>}
              </div>
              <div className="vp-sub">
                {m.date_naissance ? (
                  <b style={estAnniversaire(m.date_naissance)
                    ? { color: 'var(--wine)' } : undefined}>
                    🎂 {annivLisible(m.date_naissance)}
                    {!estAnniversaire(m.date_naissance) && joursAvantAnniv(m.date_naissance) <= 30
                      && ` · dans ${joursAvantAnniv(m.date_naissance)} j`}
                  </b>
                ) : (
                  <span style={{ opacity: 0.6 }}>🎂 date non renseignée</span>
                )}
                {m.date_naissance_changements > 0 && (
                  <> · <span style={{ color: 'var(--wine)', fontWeight: 700 }}>
                    modifiée {m.date_naissance_changements}×
                  </span></>
                )}
                {m.newsletter === false && <> · ✉️ <b>désabonné</b></>}
              </div>
              <div className="vp-sub">{m.email}</div>
              {m.parrain && (
                <div className="vp-sub" style={{ marginTop: 3 }}>
                  🤝 lien donné par <b>{m.parrain}</b>
                </div>
              )}
              {manques(m).length > 0 && (
                <div className="vp-sub" style={{ marginTop: 3, opacity: 0.75 }}>
                  📋 manque : {manques(m).join(', ')}
                </div>
              )}
            </div>
            <span className="vp-cmd-time">
              {new Date(m.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>

          {aliasEdit && aliasEdit.id === m.id ? (
            <div style={{ marginTop: 10 }}>
              <label className="vp-label">Ton repère pour cette personne</label>
              <input className="vp-input" autoFocus value={aliasEdit.valeur}
                placeholder="Ex : Amélie Mouranchon, Vincent le grand, Christophe du moulin…"
                onChange={(e) => setAliasEdit({ id: m.id, valeur: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') enregistrerAlias(m); }} />
              <div className="vp-grid2" style={{ marginTop: 8 }}>
                <button className="vp-btn ghost sm" onClick={() => setAliasEdit(null)}>Annuler</button>
                <button className="vp-btn green sm" disabled={aliasEnvoi}
                  onClick={() => enregistrerAlias(m)}>
                  {aliasEnvoi ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          ) : (
            <div className="vp-grid2" style={{ marginTop: 10 }}>
              <button className={`vp-btn ${!repereDe(m) && estHomonyme(m) ? '' : 'ghost'} sm`}
                onClick={() => setAliasEdit({ id: m.id, valeur: repereDe(m) })}>
                {repereDe(m) ? '✎ Repère' : '🏷️ Repère'}
              </button>
              <button className={`vp-btn ${m.bloque ? '' : 'ghost'} sm`}
                onClick={() => basculerBlocage(m)}>
                {m.bloque ? 'Débloquer' : 'Bloquer'}
              </button>
            </div>
          )}

          {!aliasEdit || aliasEdit.id !== m.id ? (
            <button className="vp-btn ghost sm" style={{ width: '100%', marginTop: 8 }}
              disabled={codeEnCours} onClick={() => creerCodePour(m)}>
              🎁 Lui offrir un code promo
            </button>
          ) : null}
        </div>
      ))}
    </>
  );
}

/* ---------- Admin : Sondage ---------- */
function AdminSondage({ settings, reload, showToast, onLu }) {
  const [f, setF] = useState({
    sondage_actif: !!settings.sondage_actif,
    sondage_titre: settings.sondage_titre || 'Ton avis nous intéresse',
    sondage_question: settings.sondage_question || '',
    sondage_merci: settings.sondage_merci || '',
  });
  const [reponses, setReponses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [brouillons, setBrouillons] = useState({}); // id -> texte de réponse en cours
  const [envoiId, setEnvoiId] = useState(null);

  const charger = async () => {
    const { data, error } = await supabase
      .from('viande_sondage_reponses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) showToast(messageErreur(error));
    setReponses(data || []);
    setChargement(false);
  };

  // Ouvrir l'onglet vaut lecture : on marque les nouvelles réponses comme lues.
  useEffect(() => {
    const init = async () => {
      await charger();
      await supabase.from('viande_sondage_reponses').update({ lu: true }).eq('lu', false);
      if (onLu) onLu();
    };
    init();
    const ch = supabase.channel('viande_sondage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_sondage_reponses' }, charger)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repondre = async (r) => {
    const texte = (brouillons[r.id] ?? r.reponse_admin ?? '').trim();
    if (!texte) { showToast('Écris ta réponse'); return; }
    setEnvoiId(r.id);
    const { error } = await supabase.from('viande_sondage_reponses').update({
      reponse_admin: texte,
      reponse_admin_at: new Date().toISOString(),
      reponse_vue: false, // la personne verra une pastille jusqu'à lecture
    }).eq('id', r.id);
    setEnvoiId(null);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    setBrouillons((b) => { const n = { ...b }; delete n[r.id]; return n; });
    charger();
    showToast(r.user_id ? 'Réponse envoyée — visible dans son profil' : 'Réponse enregistrée');
  };

  const basculer = async () => {
    const nouveau = !f.sondage_actif;
    setF((x) => ({ ...x, sondage_actif: nouveau }));
    const { error } = await supabase.from('viande_settings')
      .update({ sondage_actif: nouveau }).eq('id', 1);
    const err = messageErreur(error);
    if (err) { showToast(err); setF((x) => ({ ...x, sondage_actif: !nouveau })); return; }
    reload();
    showToast(nouveau ? 'Questionnaire visible sur la boutique' : 'Questionnaire masqué');
  };

  const sauver = async () => {
    const { error } = await supabase.from('viande_settings').update({
      sondage_titre: f.sondage_titre.trim() || 'Ton avis nous intéresse',
      sondage_question: f.sondage_question.trim() || null,
      sondage_merci: f.sondage_merci.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    reload(); showToast('Questionnaire enregistré');
  };

  const supprimer = async (r) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    const { error } = await supabase.from('viande_sondage_reponses').delete().eq('id', r.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    charger(); showToast('Message supprimé');
  };

  const texte = () => {
    let t = `💬 Messages reçus (${reponses.length})\n\n`;
    reponses.forEach((r) => { t += `• ${r.nom || 'Anonyme'} : ${r.reponse}\n`; });
    return t;
  };

  const imprimer = () => {
    const rows = reponses.map((r) => `
      <tr>
        <td class="prod">${esc(r.nom || 'Anonyme')}</td>
        <td class="qte gris">${esc(new Date(r.created_at).toLocaleDateString('fr-FR'))}</td>
        <td>${esc(r.reponse)}${r.reponse_admin ? `<div class="note">↳ ${esc(r.reponse_admin)}</div>` : ''}</td>
      </tr>`).join('');
    const corps = `
      <div class="tete mince"><div class="barre"></div><div>
        <h1>Messages du questionnaire</h1>
        <div class="meta"><b>${esc(settings.titre)}</b> · ${reponses.length} message(s)</div>
      </div></div>
      <table class="liste">
        <colgroup><col class="s-nom"><col class="s-date"><col class="s-rep"></colgroup>
        <thead><tr><th>Qui</th><th>Date</th><th>Message</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    if (!imprimerDocument('Questionnaire', corps)) showToast('Autorise les fenêtres pop-up pour imprimer');
  };

  const nbSansReponse = reponses.filter((r) => !r.reponse_admin).length;

  return (
    <>
      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">{f.sondage_actif ? '🟢 Questionnaire visible' : '⚪ Questionnaire masqué'}</div>
            <div className="vp-sub">
              Réservé aux membres connectés : tu sais qui écrit, et tu peux répondre.
            </div>
          </div>
          <div className={`vp-toggle ${f.sondage_actif ? 'on' : ''}`} onClick={basculer} />
        </div>
      </div>

      <div className="vp-section">
        <div className="vp-srow">
          <div className="vp-h2" style={{ fontSize: 16 }}>Messages</div>
          <span className="vp-pill">{nbSansReponse} sans réponse · {reponses.length} au total</span>
        </div>

        {chargement ? (
          <div className="vp-empty">Chargement…</div>
        ) : reponses.length === 0 ? (
          <div className="vp-empty">Aucun message pour l'instant.</div>
        ) : (
          <>
            <div style={{ marginTop: 10 }}>
              {reponses.map((r) => (
                <div className={`vp-rep ${r.reponse_admin ? '' : 'attente'}`} key={r.id}>
                  <div className="vp-srow" style={{ alignItems: 'baseline' }}>
                    <b>{r.nom || 'Anonyme'}{!r.user_id && <span className="vp-pill" style={{ marginLeft: 6 }}>ancien, sans compte</span>}</b>
                    <span className="vp-cmd-time">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <p className="vp-rep-t">{r.reponse}</p>

                  {r.reponse_admin && brouillons[r.id] === undefined ? (
                    <div className="vp-rep-admin">
                      <span className="vp-rep-admin-l">
                        Ta réponse{r.reponse_vue ? ' · lue ✓' : ' · pas encore lue'}
                      </span>
                      <p>{r.reponse_admin}</p>
                      <button className="vp-trash" style={{ marginTop: 0 }}
                        onClick={() => setBrouillons((b) => ({ ...b, [r.id]: r.reponse_admin }))}>
                        Modifier
                      </button>
                    </div>
                  ) : r.user_id ? (
                    <div className="vp-rep-form">
                      <textarea className="vp-input" rows={2}
                        value={brouillons[r.id] ?? ''}
                        onChange={(e) => setBrouillons((b) => ({ ...b, [r.id]: e.target.value }))}
                        placeholder={`Répondre à ${r.nom}…`} />
                      <button className="vp-btn sm" disabled={envoiId === r.id} onClick={() => repondre(r)}>
                        {envoiId === r.id ? 'Envoi…' : 'Envoyer la réponse'}
                      </button>
                    </div>
                  ) : (
                    <div className="vp-sub" style={{ marginTop: 6 }}>
                      Message laissé avant les comptes : impossible de répondre dans l'application.
                    </div>
                  )}

                  <button className="vp-trash" onClick={() => supprimer(r)}>Supprimer</button>
                </div>
              ))}
            </div>
            <div className="vp-grid2" style={{ marginTop: 12 }}>
              <button className="vp-btn green" onClick={async () => { (await copier(texte())) && showToast('Messages copiés'); }}>Copier</button>
              <button className="vp-btn" onClick={imprimer}>Imprimer / PDF</button>
            </div>
          </>
        )}
      </div>

      <div className="vp-section">
        <label className="vp-label">Titre de l'encart</label>
        <input className="vp-input" value={f.sondage_titre}
          onChange={(e) => setF({ ...f, sondage_titre: e.target.value })}
          placeholder="Ex : Ton avis nous intéresse" />
        <div className="vp-field">
          <label className="vp-label">Question posée</label>
          <textarea className="vp-input" rows={3} value={f.sondage_question}
            onChange={(e) => setF({ ...f, sondage_question: e.target.value })}
            placeholder="Ex : Quels produits aimerais-tu voir ?" />
        </div>
        <div className="vp-field">
          <label className="vp-label">Message de remerciement</label>
          <textarea className="vp-input" rows={2} value={f.sondage_merci}
            onChange={(e) => setF({ ...f, sondage_merci: e.target.value })}
            placeholder="Ex : Merci de ta réponse !" />
        </div>
        <button className="vp-cta" onClick={sauver}>Enregistrer le questionnaire</button>
      </div>
    </>
  );
}

/* ---------- Admin : Réglages ---------- */
function AdminReglages({ settings, commandes, estSemaine, reload, showToast }) {
  const [f, setF] = useState({
    titre: settings.titre,
    heure_ouverture: settings.heure_ouverture || '09:00',
    heure_fermeture: settings.heure_fermeture,
    vente_active: settings.vente_active,
    message_accueil: settings.message_accueil || '',
    pin_admin: settings.pin_admin,
    marge_defaut: String(settings.marge_defaut),
    precommande_active: settings.precommande_active !== false,
    whatsapp_url: settings.whatsapp_url || '',
    email_alerte: settings.email_alerte || '',
    alerte_wa_numero: settings.alerte_wa_numero || '',
    alerte_wa_cle: settings.alerte_wa_cle || '',
  });

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  /* ---- Allègement des photos déjà en ligne ----
     Les photos envoyées avant cette version sont restées en pleine
     résolution. On les retélécharge une fois, on les réduit dans le
     navigateur, on les renvoie allégées et on efface les originales.
     C'est une opération à faire UNE fois, depuis un ordinateur ou un
     téléphone en wifi. Rien n'est perdu si on l'interrompt : chaque
     photo est traitée indépendamment. */
  const [opti, setOpti] = useState(null); // { total, faits, ignores, echecs, avant, apres, encours }
  const [optiJournal, setOptiJournal] = useState([]);
  const optiStop = useRef(false);

  const cheminStockage = (url) => {
    const m = String(url || '').match(/\/viande-photos\/(.+)$/);
    return m ? decodeURIComponent(m[1].split('?')[0]) : null;
  };

  const optimiserPhotos = async () => {
    if (!window.confirm(
      "Alléger toutes les photos du catalogue ?\n\n"
      + "Chaque photo est retéléchargée, réduite, puis remplacée par sa version légère. "
      + "L'opération peut prendre quelques minutes. Reste sur cette page, de préférence en wifi."
    )) return;

    optiStop.current = false;
    setOptiJournal([]);
    const { data: liste, error } = await supabase
      .from('viande_produits').select('id, nom, photo_url')
      .not('photo_url', 'is', null).order('ordre');
    const err = messageErreur(error);
    if (err) { showToast(err); return; }

    const cibles = (liste || []).filter((p) => cheminStockage(p.photo_url));
    if (!cibles.length) { showToast('Aucune photo à alléger'); return; }

    const st = { total: cibles.length, faits: 0, ignores: 0, echecs: 0, avant: 0, apres: 0, encours: true };
    setOpti({ ...st });
    const ajouterAuJournal = (ligne) => setOptiJournal((j) => [ligne, ...j].slice(0, 40));

    for (const p of cibles) {
      if (optiStop.current) break;
      setOpti({ ...st, nomEnCours: p.nom });
      try {
        const rep = await fetch(p.photo_url, { cache: 'reload' });
        if (!rep.ok) throw new Error('téléchargement refusé');
        const original = await rep.blob();
        st.avant += original.size;

        // Deuxième gain, invisible mais énorme : la durée de cache. Par
        // défaut Supabase annonce 1 heure, donc un visiteur qui revient
        // retélécharge tout. On repasse les photos avec un cache d'un an.
        const cacheCourt = !/max-age=\s*(\d{6,})/.test(rep.headers.get('cache-control') || '');

        let aEnvoyer = original.size > 120 * 1024 ? await reduireImage(original) : null;
        if (aEnvoyer && aEnvoyer.size >= original.size * 0.9) aEnvoyer = null;

        if (!aEnvoyer && !cacheCourt) {
          st.apres += original.size; st.ignores += 1;
          ajouterAuJournal(`• ${p.nom} — déjà optimale (${poidsLisible(original.size)})`);
          setOpti({ ...st }); continue;
        }
        const nouveauBlob = aEnvoyer || original;
        const typeBlob = aEnvoyer ? 'image/jpeg' : (original.type || 'image/jpeg');
        const extBlob = aEnvoyer ? 'jpg' : (/png$/i.test(original.type || '') ? 'png' : 'jpg');

        const chemin = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extBlob}`;
        const { error: eUp } = await supabase.storage.from('viande-photos')
          .upload(chemin, nouveauBlob, { upsert: true, contentType: typeBlob, cacheControl: '31536000' });
        if (eUp) throw eUp;

        const { data: pub } = supabase.storage.from('viande-photos').getPublicUrl(chemin);
        const { error: eMaj } = await supabase.from('viande_produits')
          .update({ photo_url: pub.publicUrl }).eq('id', p.id);
        if (eMaj) {
          await supabase.storage.from('viande-photos').remove([chemin]); // on ne laisse pas d'orphelin
          throw eMaj;
        }

        const ancien = cheminStockage(p.photo_url);
        if (ancien && ancien !== chemin) {
          await supabase.storage.from('viande-photos').remove([ancien]);
        }

        st.apres += nouveauBlob.size; st.faits += 1;
        ajouterAuJournal(aEnvoyer
          ? `✓ ${p.nom} — ${poidsLisible(original.size)} → ${poidsLisible(nouveauBlob.size)}`
          : `✓ ${p.nom} — cache rallongé (${poidsLisible(original.size)})`);
        setOpti({ ...st });
      } catch (e) {
        st.echecs += 1;
        ajouterAuJournal(`✗ ${p.nom} — ${e && e.message ? e.message : 'échec'}`);
        setOpti({ ...st });
      }
    }

    st.encours = false;
    setOpti({ ...st });
    reload();
    showToast(optiStop.current
      ? `Arrêté — ${st.faits} photo(s) allégée(s)`
      : `Terminé — ${st.faits} photo(s) allégée(s)`);
  };

  const basculerPrecommande = async () => {
    const nouveau = !f.precommande_active;
    setF((x) => ({ ...x, precommande_active: nouveau }));
    const { error } = await supabase.from('viande_settings')
      .update({ precommande_active: nouveau, updated_at: new Date().toISOString() }).eq('id', 1);
    const err = messageErreur(error);
    if (err) { showToast(err); setF((x) => ({ ...x, precommande_active: !nouveau })); return; }
    reload();
    showToast(nouveau ? 'Commandes hors horaires acceptées' : 'Commandes hors horaires refusées');
  };

  const forceeAuj = settings.ouverture_forcee_le === todayStr();
  const basculerForcage = async () => {
    const valeur = forceeAuj ? null : todayStr();
    const { error } = await supabase.from('viande_settings')
      .update({ ouverture_forcee_le: valeur, updated_at: new Date().toISOString() }).eq('id', 1);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    reload();
    showToast(valeur ? "Boutique ouverte pour aujourd'hui" : 'Ouverture exceptionnelle levée');
  };

  const toggleVente = async () => {
    const nouveau = !f.vente_active;
    setF((x) => ({ ...x, vente_active: nouveau }));
    await supabase.from('viande_settings').update({ vente_active: nouveau, updated_at: new Date().toISOString() }).eq('id', 1);
    reload();
    showToast(nouveau
      ? (estSemaine ? 'Horaires automatiques réactivés' : 'Boutique ouverte manuellement')
      : (estSemaine ? 'Boutique fermée manuellement' : 'Boutique fermée'));
  };

  const sauver = async () => {
    const { error } = await supabase.from('viande_settings').update({
      titre: f.titre.trim() || 'Viande Noisy',
      date_vente: todayStr(),
      heure_ouverture: f.heure_ouverture, heure_fermeture: f.heure_fermeture,
      vente_active: f.vente_active, message_accueil: f.message_accueil.trim() || null,
      pin_admin: f.pin_admin.trim() || '0000', marge_defaut: nombre(f.marge_defaut) || 0,
      whatsapp_url: f.whatsapp_url.trim() || null,
      email_alerte: f.email_alerte.trim() || null,
      alerte_wa_numero: f.alerte_wa_numero.trim() || null,
      alerte_wa_cle: f.alerte_wa_cle.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    reload(); showToast('Réglages enregistrés');
  };

  /* ---- suppression des commandes d'une journée ----
     Ce bouton s'appelait « Démarrer une nouvelle vente », ce qui
     laissait croire à une remise à zéro inoffensive. Il ne fait
     pourtant qu'une chose : EFFACER les commandes d'une journée.
     Depuis que les voisins retrouvent leurs factures dans leur
     compte, les effacer leur fait perdre leur historique. Le bouton
     reste — il sert après une série d'essais — mais il dit
     maintenant ce qu'il fait, et demande une confirmation écrite. */
  const [purgeEnCours, setPurgeEnCours] = useState(false);

  const supprimerJournee = async () => {
    const jour = settings.date_vente;
    setPurgeEnCours(true);
    try {
      const { data: cmds, error } = await supabase.from('viande_commandes')
        .select('id, nom_client, total_estime').eq('date_vente', jour);
      const err = messageErreur(error);
      if (err) { showToast(err); return; }
      const liste = cmds || [];
      if (liste.length === 0) { showToast('Aucune commande sur cette journée'); return; }

      const noms = [...new Set(liste.map((c) => c.nom_client))].slice(0, 8).join(', ');
      const total = liste.reduce((t, c) => t + (Number(c.total_estime) || 0), 0);
      const reponse = window.prompt(
        `⚠️ SUPPRESSION DÉFINITIVE\n\n`
        + `${liste.length} commande(s) du ${fmtDateCourt(jour)}, soit ${eur(total)}.\n`
        + `${noms}${liste.length > 8 ? '…' : ''}\n\n`
        + `Ces personnes perdront la facture correspondante dans leur compte.\n`
        + `Cette action est irréversible.\n\n`
        + `Tape SUPPRIMER pour confirmer :`
      );
      if ((reponse || '').trim().toUpperCase() !== 'SUPPRIMER') {
        showToast('Annulé — rien n\'a été supprimé');
        return;
      }

      const ids = liste.map((c) => c.id);
      await supabase.from('viande_commande_lignes').delete().in('commande_id', ids);
      const { error: e2 } = await supabase.from('viande_commandes').delete().in('id', ids);
      const err2 = messageErreur(e2);
      if (err2) { showToast(err2); return; }
      reload();
      showToast(`${liste.length} commande(s) supprimée(s)`);
    } finally { setPurgeEnCours(false); }
  };

  const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const jourActuel = JOURS[new Date().getDay()];

  return (
    <>
      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">{f.vente_active ? '🟢 Activée' : '🔴 Désactivée'}</div>
            <div className="vp-sub">
              {f.vente_active
                ? `${jourActuel} — la boutique suit le calendrier : dimanche 12h à jeudi ${f.heure_fermeture}`
                : `${jourActuel} — boutique coupée, rien n'est visible`}
            </div>
          </div>
          <div className={`vp-toggle ${f.vente_active ? 'on' : ''}`} onClick={toggleVente} />
        </div>
      </div>

      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2" style={{ fontSize: 16 }}>
              {f.precommande_active ? '🌙 Commandes hors horaires acceptées' : 'Commandes hors horaires refusées'}
            </div>
            <div className="vp-sub">
              {f.precommande_active
                ? "Boutique fermée, les voisins peuvent quand même commander. Leur commande rejoint la prochaine journée d'ouverture, et ils en sont prévenus."
                : 'Boutique fermée, la commande est impossible : les voisins ne voient que les horaires de réouverture.'}
            </div>
          </div>
          <div className={`vp-toggle ${f.precommande_active ? 'on' : ''}`} onClick={basculerPrecommande} />
        </div>
      </div>

      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2" style={{ fontSize: 16 }}>
              {forceeAuj ? '⚡ Ouverture exceptionnelle active' : 'Ouverture exceptionnelle'}
            </div>
            <div className="vp-sub">
              {forceeAuj
                ? "La boutique est ouverte aujourd'hui malgré le calendrier et les horaires. Elle se referme seule à minuit."
                : "Force l'ouverture pour aujourd'hui, même un vendredi, un jour férié ou en dehors des horaires."}
            </div>
          </div>
          <div className={`vp-toggle ${forceeAuj ? 'on' : ''}`} onClick={basculerForcage} />
        </div>
        {forceeAuj && (
          <div className="vp-rupt-note" style={{ marginTop: 10 }}>
            Pense au retrait : une commande passée aujourd'hui se retire demain.
          </div>
        )}
      </div>

      {!estSemaine && !f.vente_active && (
        <div className="vp-note" style={{ marginBottom: 14 }}>
          Week-end : boutique fermée par défaut. Active le bouton si tu as une promo exceptionnelle.
        </div>
      )}

      <div className="vp-section">
        <label className="vp-label">Titre de la vente</label>
        <input className="vp-input" value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder="Ex : Promo du week-end" />

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Ouverture auto (lun-ven)</label>
            <input className="vp-input" type="time" value={f.heure_ouverture} onChange={(e) => setF({ ...f, heure_ouverture: e.target.value })} />
          </div>
          <div>
            <label className="vp-label">Fermeture auto</label>
            <input className="vp-input" type="time" value={f.heure_fermeture} onChange={(e) => setF({ ...f, heure_fermeture: e.target.value })} />
          </div>
        </div>
        <div className="vp-sub" style={{ marginTop: 8 }}>
          Commandes ouvertes du <b>dimanche 12h</b> au <b>jeudi soir</b>, retrait le lendemain.
          Vendredi et samedi fermés, ainsi que les jours fériés et la veille d'un jour férié
          (le retrait serait impossible). L'heure d'ouverture ci-dessus s'applique du lundi au
          jeudi ; le dimanche, c'est toujours 12h.
        </div>

        <div className="vp-field">
          <label className="vp-label">Message d'accueil</label>
          <textarea className="vp-input" value={f.message_accueil} onChange={(e) => setF({ ...f, message_accueil: e.target.value })} />
        </div>

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Marge par défaut (%)</label>
            <input className="vp-input" value={f.marge_defaut} inputMode="decimal" onChange={(e) => setF({ ...f, marge_defaut: e.target.value })} />
          </div>
          <div>
            <label className="vp-label">Code organisateur</label>
            <input className="vp-input" value={f.pin_admin} onChange={(e) => setF({ ...f, pin_admin: e.target.value })} />
          </div>
        </div>

        <button className="vp-cta" onClick={sauver}>Enregistrer les réglages</button>
      </div>

      <div className="vp-section">
        <div className="vp-h2" style={{ fontSize: 16 }}>Groupe WhatsApp</div>
        <div className="vp-sub">Lien d'invitation du groupe. Un bouton apparaît alors sur la boutique et après chaque commande.</div>
        <input className="vp-input" style={{ marginTop: 10 }} value={f.whatsapp_url}
          onChange={(e) => setF({ ...f, whatsapp_url: e.target.value })}
          placeholder="https://chat.whatsapp.com/…" inputMode="url" />
        {f.whatsapp_url && !/^https:\/\/(chat\.whatsapp\.com|wa\.me)\//.test(f.whatsapp_url.trim()) && (
          <div className="vp-rupt-note" style={{ marginTop: 8 }}>
            Lien inhabituel : attendu sous la forme https://chat.whatsapp.com/… (WhatsApp → groupe → Inviter via un lien).
          </div>
        )}
        {f.whatsapp_url && (
          <a className="vp-wa" href={f.whatsapp_url} target="_blank" rel="noreferrer noopener">Tester le lien</a>
        )}
      </div>

      <div className="vp-section">
        <div className="vp-h2" style={{ fontSize: 16 }}>Alerte WhatsApp à chaque commande</div>
        <div className="vp-sub">Reçois un message WhatsApp dès qu'un voisin commande. Réglage en 3 étapes, une seule fois.</div>

        <ol className="vp-etapes">
          <li>Enregistre le numéro <b>+34 644 51 95 23</b> dans tes contacts (nom au choix, « Alerte Viande » par exemple).</li>
          <li>Envoie-lui sur WhatsApp le message exact :<br />
            <button className="vp-approx" style={{ marginTop: 5 }}
              onClick={async () => { (await copier('I allow callmebot to send me messages')) && showToast('Message copié'); }}>
              Copier « I allow callmebot to send me messages »
            </button>
          </li>
          <li>Il répond avec une clé (« your apikey is 123456 »). Recopie ton numéro et cette clé ci-dessous.</li>
        </ol>

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Ton numéro (avec +33)</label>
            <input className="vp-input" value={f.alerte_wa_numero}
              onChange={(e) => setF({ ...f, alerte_wa_numero: e.target.value })}
              placeholder="+33612345678" inputMode="tel" />
          </div>
          <div>
            <label className="vp-label">Clé reçue</label>
            <input className="vp-input" value={f.alerte_wa_cle}
              onChange={(e) => setF({ ...f, alerte_wa_cle: e.target.value })}
              placeholder="123456" inputMode="numeric" />
          </div>
        </div>

        <button className="vp-btn green" style={{ width: '100%', marginTop: 12 }}
          onClick={() => {
            if (!f.alerte_wa_numero.trim() || !f.alerte_wa_cle.trim()) { showToast('Renseigne le numéro et la clé'); return; }
            envoyerAlerteWhatsApp(
              { alerte_wa_numero: f.alerte_wa_numero, alerte_wa_cle: f.alerte_wa_cle },
              '🥩 Test Viande Noisy — si tu lis ce message, les alertes fonctionnent.');
            showToast('Test envoyé — pense à Enregistrer les réglages');
          }}>
          Envoyer un message de test
        </button>
        <div className="vp-sub" style={{ marginTop: 8 }}>
          Pense à <b>Enregistrer les réglages</b> ensuite. Laisse les deux champs vides pour couper les alertes.
        </div>
      </div>

      <div className="vp-section">
        <div className="vp-h2" style={{ fontSize: 16 }}>Alerte par mail <span className="vp-pill">optionnel</span></div>
        <div className="vp-sub">Demande une installation à part (fichier alerte-mail-installation.md). Inutile si les alertes WhatsApp te suffisent.</div>
        <input className="vp-input" style={{ marginTop: 10 }} value={f.email_alerte}
          onChange={(e) => setF({ ...f, email_alerte: e.target.value })}
          placeholder="ton.adresse@exemple.fr" inputMode="email" type="email" />
      </div>

      <div className="vp-section">
        <div className="vp-h2" style={{ fontSize: 16 }}>Alléger les photos <span className="vp-pill">à faire une fois</span></div>
        <div className="vp-sub">
          Les photos envoyées depuis un téléphone pèsent plusieurs mégaoctets chacune, alors
          qu'elles s'affichent dans une vignette. Cet outil les réduit une bonne fois : le site
          s'ouvre beaucoup plus vite et la consommation de l'hébergement s'effondre.
          Les nouvelles photos sont désormais réduites automatiquement à l'envoi.
        </div>

        {opti && (
          <div className="vp-rupt-note" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>
              {opti.encours
                ? `En cours — ${opti.faits + opti.ignores + opti.echecs} / ${opti.total}`
                : `Terminé — ${opti.total} photo(s) examinée(s)`}
            </div>
            <div style={{ marginTop: 4 }}>
              {opti.faits} allégée(s) · {opti.ignores} déjà bonne(s) · {opti.echecs} échec(s)
            </div>
            {opti.avant > 0 && (
              <div style={{ marginTop: 4 }}>
                Poids du catalogue : <b>{poidsLisible(opti.avant)}</b> → <b>{poidsLisible(opti.apres)}</b>
                {opti.apres < opti.avant && (
                  <> · soit {Math.round((1 - opti.apres / opti.avant) * 100)} % de moins</>
                )}
              </div>
            )}
            {opti.encours && opti.nomEnCours && (
              <div style={{ marginTop: 4, opacity: 0.75 }}>Traitement : {opti.nomEnCours}</div>
            )}
          </div>
        )}

        {optiJournal.length > 0 && (
          <div style={{
            marginTop: 10, maxHeight: 180, overflowY: 'auto', fontSize: 13,
            lineHeight: 1.6, padding: '8px 10px', borderRadius: 10,
            border: '1px solid var(--line)',
          }}>
            {optiJournal.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {opti && opti.encours ? (
          <button className="vp-btn ghost" style={{ marginTop: 12 }}
            onClick={() => { optiStop.current = true; showToast('Arrêt après la photo en cours'); }}>
            Arrêter
          </button>
        ) : (
          <button className="vp-btn green" style={{ marginTop: 12 }} onClick={optimiserPhotos}>
            Alléger les photos du catalogue
          </button>
        )}
      </div>

      <div className="vp-section">
        <div className="vp-h2" style={{ fontSize: 16 }}>Effacer les commandes du jour</div>
        <div className="vp-sub">
          Supprime définitivement toutes les commandes du <b>{fmtDateCourt(settings.date_vente)}</b>.
          Les produits et les comptes ne sont pas touchés.
        </div>
        <div className="vp-rupt-note" style={{ marginTop: 10 }}>
          <b>À n'utiliser qu'après une série d'essais.</b> Les voisins concernés
          perdront la facture correspondante dans leur compte, et tu perdras la
          trace de ce qu'ils doivent. Une nouvelle journée de vente démarre toute
          seule chaque jour : tu n'as rien à faire pour repartir à zéro.
        </div>
        <button className="vp-btn ghost" style={{ marginTop: 12 }}
          disabled={purgeEnCours} onClick={supprimerJournee}>
          {purgeEnCours ? 'Un instant…' : 'Effacer les commandes du jour'}
        </button>
      </div>
    </>
  );
}
