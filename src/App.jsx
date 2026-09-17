import React, { useEffect, useMemo, useState } from 'react';
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
const VERSION = '2026-09-17c · prix barré, rappels, relance';

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
    + `&apikey=${encodeURIComponent(cle)}&text=${encodeURIComponent(texte)}`;
  try {
    fetch(url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  } catch (e) { /* alerte non bloquante */ }
}

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

async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = texte; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}

/* ============================================================
   STYLES
============================================================ */
const CSS = `
:root{
  --paper:#FBF7F2; --card:#FFFFFF; --ink:#241E1B; --muted:#8A7E76;
  --line:#EBE2D7; --wine:#8A2E2E; --wine-d:#6E2222; --amber:#E0A23C;
  --green:#3F8A52; --green-s:#EAF3EC; --red-s:#FBEDED;
  --radius:16px; --shadow:0 1px 2px rgba(36,30,27,.06),0 6px 18px rgba(36,30,27,.06);
}
*{box-sizing:border-box}
/* clip et non hidden : « overflow-x:hidden » sur html/body neutralise
   le position:sticky de tous les descendants. */
html,body{overflow-x:clip;max-width:100%}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;}
.vp-app{max-width:600px;margin:0 auto;padding:0 14px 120px;position:relative}
.vp-app.vp-avec-panier{padding-bottom:140px}
/* la pastille WhatsApp flotte au-dessus du contenu : on réserve
   de quoi faire défiler le dernier produit au-dessus d'elle */
.vp-app.vp-avec-wa{padding-bottom:150px}
.vp-app.vp-avec-panier.vp-avec-wa{padding-bottom:172px}
.vp-admin-icon{position:absolute;top:18px;right:14px;width:38px;height:38px;border-radius:11px;
  background:#fff;border:1px solid var(--line);color:var(--muted);display:grid;place-items:center;
  box-shadow:var(--shadow);z-index:10}
.vp-admin-icon:active{transform:scale(.94);color:var(--wine)}
.vp-admin{max-width:760px;}
h1,h2,h3{font-family:'Bricolage Grotesque','Inter',sans-serif;margin:0;letter-spacing:-.01em;}
button{font-family:inherit;cursor:pointer;border:none}
input,select,textarea{font-family:inherit;font-size:16px}

/* header */
.vp-head{padding:66px 4px 14px;text-align:center;display:flex;flex-direction:column;align-items:center}
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
.vp-cat{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--muted);margin:24px 4px 10px}
.vp-prod{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
  padding:14px;display:flex;gap:13px;align-items:center;margin-bottom:10px;box-shadow:var(--shadow)}
.vp-emoji{font-size:34px;line-height:1;width:60px;height:60px;display:grid;place-items:center;
  background:var(--paper);border-radius:14px;flex:0 0 auto}
.vp-photo-wrap{position:relative;flex:0 0 auto;padding:0;background:none;border:none;
  border-radius:14px;line-height:0;cursor:zoom-in}
.vp-photo{width:60px;height:60px;border-radius:14px;object-fit:cover;display:block;border:1px solid var(--line)}
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
.vp-input{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--ink)}
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
.vp-cat-nav{position:sticky;top:0;background:var(--paper);z-index:5;
  padding:2px 0 0;border-bottom:1px solid var(--line)}
.vp-cat-select{width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:12px;
  background:#fff;color:var(--ink);font-size:15px;font-weight:600;font-family:inherit;
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
  background:#fff;border:1px solid var(--line);color:#6F635B;
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
.vp-cmd{border:1px solid var(--line);border-radius:12px;padding:13px;margin-bottom:10px;background:#fff}
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

.vp-ver{text-align:center;color:var(--muted);font-size:11px;opacity:.6;margin-top:28px}

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
.vp-auth-liens{position:absolute;top:18px;left:14px;display:flex;gap:7px;z-index:10}
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
.vp-compte-pill{position:absolute;top:18px;left:14px;height:38px;max-width:46%;
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

/* prix barré */
.vp-prix-barre{margin-right:7px;color:var(--muted);text-decoration:line-through;
  font-size:13.5px;font-weight:600}
.vp-remise{display:inline-block;margin-right:7px;padding:1px 7px;border-radius:6px;
  background:var(--red-s);color:var(--wine);font-size:11.5px;font-weight:800}

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

/* preuve sociale */
.vp-social{display:flex;align-items:center;gap:8px;margin-top:14px;padding:9px 13px;
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
.vp-pl-g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
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
  const loadBase = async () => {
    if (!supabase) return;
    const { data: s } = await supabase.from('viande_settings').select('*').eq('id', 1).single();
    if (s) setSettings(s);
    const { data: p } = await supabase.from('viande_produits').select('*').order('ordre');
    if (p) setProduits(p);
  };
  useEffect(() => {
    loadBase();
    if (!supabase) return;
    const ch = supabase
      .channel('viande_base')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_produits' }, loadBase)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_settings' }, loadBase)
      .subscribe();
    const poll = setInterval(loadBase, 12000); // filet de sécurité mobile
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, []);

  // Jour de la semaine en temps réel (0=dim, 6=sam)
  const jourSemaine = useMemo(() => new Date(now).getDay(), [now]);
  const estSemaine = jourSemaine >= 1 && jourSemaine <= 5;

  // Horaires calculés sur AUJOURD'HUI (pas sur date_vente stockée)
  const { ouvertureAt, fermetureAt } = useMemo(() => {
    if (!settings) return { ouvertureAt: null, fermetureAt: null };
    try {
      const d = new Date(now);
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        ouvertureAt: new Date(`${today}T${settings.heure_ouverture || '09:00'}:00`).getTime(),
        fermetureAt: new Date(`${today}T${settings.heure_fermeture}:00`).getTime(),
      };
    } catch { return { ouvertureAt: null, fermetureAt: null }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, now]);

  // Ouvert si :
  //   - semaine : vente_active=true ET dans les horaires (auto)
  //   - weekend : vente_active=true ET dans les horaires (manuel requis)
  const ouvert = !!settings?.vente_active
    && (!ouvertureAt || now >= ouvertureAt)
    && (!fermetureAt || now < fermetureAt);

  if (!supabase) return <SetupScreen />;
  if (!settings) return <div className="vp-app"><div className="vp-empty">Chargement…</div></div>;

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className="vp-toast">{toast}</div>}
      {view === 'admin' ? (
        <Admin
          settings={settings} produits={produits} ouvert={ouvert}
          estSemaine={estSemaine}
          reload={loadBase} showToast={showToast}
        />
      ) : (
        <Client
          settings={settings} produits={produits} now={now}
          fermetureAt={fermetureAt} ouvertureAt={ouvertureAt} ouvert={ouvert}
          estSemaine={estSemaine} showToast={showToast}
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
function Sondage({ settings, showToast }) {
  const [ouvert, setOuvert] = useState(false);
  const [reponse, setReponse] = useState('');
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(() => aDejaRepondu(settings.date_vente));

  if (!settings.sondage_actif) return null;

  const envoyer = async () => {
    if (reponse.trim().length < 2) { showToast('Écris ta réponse avant d\'envoyer'); return; }
    setEnvoi(true);
    try {
      const { error } = await supabase.from('viande_sondage_reponses').insert({
        nom: nom.trim() || null,
        reponse: reponse.trim(),
        date_vente: settings.date_vente,
      });
      if (error) throw error;
      marquerRepondu(settings.date_vente);
      setFait(true);
      setOuvert(false);
      setReponse(''); setNom('');
    } catch (e) {
      showToast('Envoi impossible — réessaie');
    } finally { setEnvoi(false); }
  };

  if (fait) {
    return (
      <div className="vp-sondage fait">
        <span className="vp-sondage-ico">✓</span>
        <div>{settings.sondage_merci || 'Merci de ta réponse !'}</div>
      </div>
    );
  }

  if (!ouvert) {
    return (
      <button className="vp-sondage" onClick={() => setOuvert(true)}>
        <span className="vp-sondage-ico">💬</span>
        <div>
          <b>{settings.sondage_titre || 'Ton avis nous intéresse'}</b>
          <small>Tu cherches un produit en particulier ?</small>
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
        onChange={(e) => setReponse(e.target.value)}
        placeholder="Écris ici…" />
      <div className="vp-field">
        <label className="vp-label">Ton prénom (facultatif)</label>
        <input className="vp-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Marie" />
      </div>
      <button className="vp-cta" disabled={envoi} onClick={envoyer}>
        {envoi ? 'Envoi…' : 'Envoyer ma réponse'}
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
function Countdown({ fermetureAt, ouvertureAt, now, ouvert, venteActive, estSemaine }) {
  // Fermé manuellement (override)
  if (!venteActive) {
    return <span className="vp-status vp-closed">
      <span className="vp-dot" />
      {estSemaine ? 'Fermé manuellement' : 'Fermé le week-end'}
    </span>;
  }
  // Pas encore ouvert — compte à rebours avant ouverture
  if (ouvertureAt && now < ouvertureAt) {
    const resteAvant = ouvertureAt - now;
    const h = Math.floor(resteAvant / 3600000);
    const m = Math.floor((resteAvant % 3600000) / 60000);
    const hLabel = new Date(ouvertureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const txt = h > 0 ? `Ouverture à ${hLabel} (dans ${h}h${String(m).padStart(2, '0')})` : `Ouverture à ${hLabel} (dans ${m} min)`;
    return <span className="vp-status vp-closed"><span className="vp-dot" />{txt}</span>;
  }
  // Fermé (après l'heure)
  if (!ouvert) {
    const hO = new Date(ouvertureAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const msg = estSemaine ? `Réouverture demain à ${hO}` : 'Fermé';
    return <span className="vp-status vp-closed"><span className="vp-dot" />{msg}</span>;
  }
  // Ouvert — compte à rebours fermeture
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
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [code, setCode] = useState('');
  const [mdp2, setMdp2] = useState('');
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
            <input className="vp-input" value={mdp2} onChange={(e) => setMdp2(e.target.value)}
              type="password" placeholder="6 caractères minimum" autoComplete="new-password"
              onKeyDown={(e) => e.key === 'Enter' && changerMdp()} />
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
        </>
      )}

      <div className="vp-field">
        <label className="vp-label">E-mail *</label>
        <input className="vp-input" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="ton.adresse@exemple.fr" inputMode="email" type="email" autoComplete="email" />
      </div>
      <div className="vp-field">
        <label className="vp-label">Mot de passe *</label>
        <input className="vp-input" value={mdp} onChange={(e) => setMdp(e.target.value)}
          type="password" placeholder="6 caractères minimum"
          autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
          onKeyDown={(e) => e.key === 'Enter' && (mode === 'inscription' ? inscrire() : connecter())} />
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
  const [chargement, setChargement] = useState(true);
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState((profil && profil.nom) || '');
  const [tel, setTel] = useState((profil && profil.telephone) || '');

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
    const { error } = await supabase.from('viande_clients')
      .update({ nom: nom.trim(), telephone: tel.trim() }).eq('id', profil.id);
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

  const imprimerFacture = (c) => {
    const rows = (c.lignes || []).map((l) => {
      const q = l.mode_vente === 'kg' ? `${num(l.quantite)} kg` : `${num(l.quantite)} pièce(s)`;
      const montant = l.sous_total_final != null ? eur(l.sous_total_final)
        : (l.mode_vente === 'piece_fixe' ? '' : '≈ ') + eur(l.sous_total_estime);
      return `<tr>
        <td class="prod">${esc(nomLigne(l))}</td>
        <td class="qte">${esc(q)}</td>
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
        <thead><tr><th>Produit</th><th>Quantité</th><th class="n">Montant</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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

      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">Bonjour {profil && profil.nom}</div>
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
            <div className="vp-grid2" style={{ marginTop: 12 }}>
              <button className="vp-btn ghost" onClick={() => { setEdition(false); setNom(profil.nom); setTel(profil.telephone); }}>Annuler</button>
              <button className="vp-btn" onClick={enregistrer}>Enregistrer</button>
            </div>
          </>
        ) : (
          <div className="vp-sub" style={{ marginTop: 6 }}>{profil && profil.telephone}</div>
        )}
      </div>

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
              <div className="vp-cmd-l" key={l.id}>
                <span>{l.emoji} {nomLigne(l)} <span className="vp-pill">
                  {l.mode_vente === 'kg' ? `${num(l.quantite)} kg` : `${num(l.quantite)} pc`}
                </span></span>
                <span style={{ fontWeight: 700 }}>
                  {l.sous_total_final != null ? eur(l.sous_total_final)
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
            {commandes.map((c) => (
              <div className="vp-liste-l" key={c.id} style={{ border: 'none', borderBottom: '1px dotted var(--line)' }}>
                <span>{new Date(c.created_at).toLocaleDateString('fr-FR')}
                  {' '}<span className="vp-pill">{(c.lignes || []).length} produit(s)</span></span>
                <b>{c.total_final == null ? '≈ ' : ''}{eur(totalDe(c))}</b>
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
function Client({ settings, produits, now, fermetureAt, ouvertureAt, ouvert, estSemaine, showToast,
  session, profil, profilCharge, chargerProfil }) {
  const repris = useMemo(() => lirePanierStocke(settings.date_vente), [settings.date_vente]);
  const [cart, setCart] = useState(() => (repris && repris.cart) || {});   // "produitId|varianteId" -> quantite
  const [choix, setChoix] = useState(() => (repris && repris.choix) || {}); // produitId -> variante choisie
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
  const [vueCompte, setVueCompte] = useState(false);
  const connecte = !!(session && session.user);
  // session valide mais fiche client absente : inscription à terminer
  const profilManquant = connecte && profilCharge && !profil;
  const [maCommande, setMaCommande] = useState(() => lireCommandeStockee(settings.date_vente));
  const [reprise, setReprise] = useState(false);

  const dispo = produits.filter((p) => p.disponible && !p.rupture);

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

  useEffect(() => {
    if (filtreCat !== 'Tous' && filtreCat !== 'PROMOS' && !cats.includes(filtreCat)) setFiltreCat('Tous');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.join(',')]);

  const catsAffichees = (filtreCat === 'Tous' || filtreCat === 'PROMOS')
    ? CATEGORIES.filter((c) => source.some((p) => catDe(p) === c))
    : cats.filter((c) => c === filtreCat);

  // sauvegarde continue : rafraîchir la page ne perd plus rien
  useEffect(() => {
    if (Object.keys(cart).length === 0) { viderPanierStocke(); return; }
    ecrirePanierStocke({ date: settings.date_vente, cart, choix, nom, tel, note });
  }, [cart, choix, nom, tel, note, settings.date_vente]);

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

  const total = lignes.reduce((s, { p, v, q }) => s + sousTotalLigne(p, v, q, 'prix_william'), 0);
  // Nombre d'articles réel : on additionne les quantités.
  // Une ligne « au kilo » compte pour 1 (c'est une demande de poids,
  // pas un nombre de pièces).
  const nbArticles = lignes.reduce((s, { p, q }) =>
    s + (p.mode_vente === 'kg' ? 1 : Math.round(Number(q) || 0)), 0);
  const aDuPese = lignes.some(({ p }) => MODES[p.mode_vente].pese);

  const envoyer = async () => {
    if (!connecte || !profil) { showToast('Connecte-toi pour commander'); setModeAuth('connexion'); setAuthOuvert(true); return; }
    if (profil.bloque) { showToast('Ton compte ne permet pas de commander — contacte-nous'); return; }
    if (lignes.length === 0) { showToast('Ton panier est vide'); return; }
    setEnvoi(true);
    try {
      const totalPatrice = lignes.reduce(
        (s, { p, v, q }) => s + sousTotalLigne(p, v, q, 'prix_patrice'), 0);
      const { data: cmd, error } = await supabase.from('viande_commandes').insert({
        user_id: session.user.id,
        nom_client: profil.nom, telephone: profil.telephone, note: note.trim() || null,
        total_estime: Math.round(total * 100) / 100,
        total_patrice: Math.round(totalPatrice * 100) / 100,
        date_vente: settings.date_vente,
      }).select().single();
      if (error) throw error;
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
      }));
      const { error: e2 } = await supabase.from('viande_commande_lignes').insert(rows);
      if (e2) throw e2;
      // alerte (ne bloque jamais la commande)
      const resume = lignes
        .map(({ p, v, q }) => `• ${p.nom}${v ? ` (${v.nom})` : ''} x${num(q)}`)
        .join('\n');
      envoyerAlerteWhatsApp(settings,
        `🥩 Nouvelle commande\n${profil.nom} — ${profil.telephone}\n\n${resume}\n\n`
        + `Total estimé : ${eur(total)}`
        + (note.trim() ? `\nNote : ${note.trim()}` : ''));

      // mémorisé pour permettre une modification ultérieure
      const memo = {
        date: settings.date_vente, id: cmd.id, nom: profil.nom,
        heure: Date.now(), cart, choix, tel: profil.telephone, note: note.trim(),
      };
      ecrireCommandeStockee(memo);
      setMaCommande(memo);

      setDone({ nom: profil.nom, total, aDuPese });
      setPanierOuvert(false);
      viderPanierStocke();
      setCart({}); setChoix({}); setNom(''); setTel(''); setNote('');
    } catch (e) {
      showToast('Erreur — réessaie');
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
    if (!window.confirm(
      'Reprendre ta commande pour la modifier ?\n\n'
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
    showToast('Commande remise dans ton panier');
  };

  const annulerCommande = async () => {
    if (!maCommande) return;
    if (!window.confirm('Annuler définitivement ta commande ?')) return;
    if (!(await supprimerMaCommande(maCommande.id))) { showToast('Impossible pour le moment'); return; }
    viderCommandeStockee();
    setMaCommande(null);
    setDone(null);
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
  const carteProduit = (p) => {
              const m = MODES[p.mode_vente];
              const vs = variantesDe(p);
              const v = varianteActive(p);
              const q = cart[cle(p, v)] || 0;
              const prix = prixVariante(p, v, 'prix_william');
              const pm = poidsVariante(p, v);
              return (
                <div className="vp-prod" key={p.id}>
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
                        <img src={p.photo_url} alt={p.nom} className="vp-photo" />
                        <span className="vp-photo-loupe">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                          </svg>
                        </span>
                      </button>
                    : <div className="vp-emoji">{p.emoji}</div>}
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
        onFermer={() => setVueCompte(false)} showToast={showToast} />
    );
  }

  return (
    <div className={`vp-app ${ouvert && lignes.length > 0 ? 'vp-avec-panier' : ''} ${settings.whatsapp_url ? 'vp-avec-wa' : ''}`}>
      {connecte && profil ? (
        <button className="vp-compte-pill on" onClick={() => setVueCompte(true)} aria-label="Mon compte">
          <span className="vp-initiale">{(profil.nom || '?').trim().charAt(0).toUpperCase()}</span>
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
        <Countdown fermetureAt={fermetureAt} ouvertureAt={ouvertureAt} now={now} ouvert={ouvert} venteActive={settings.vente_active} estSemaine={estSemaine} />
        {settings.message_accueil && <div className="vp-note">{settings.message_accueil}</div>}
        <Sondage settings={settings} showToast={showToast} />
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

      {reprise && !maCommande && lignes.length > 0 && (
        <div className="vp-rupt-note" style={{ marginTop: 12 }}>
          Ta commande a été retirée de la liste. Modifie ton panier puis <b>renvoie-la</b>,
          sinon elle ne sera pas prise en compte.
        </div>
      )}

      {!ouvert ? (
        <div className="vp-empty">Les commandes sont fermées pour le moment. Reviens à la prochaine promo&nbsp;!</div>
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

          {nbVoisins >= 2 && !q && (
            <div className="vp-social">
              <span className="vp-social-pt" />
              {nbVoisins} voisins ont déjà commandé aujourd'hui
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
              {favorisDispo.map(carteProduit)}
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

          {catsAffichees.map((cat) => (
          <div key={cat}>
            <div className="vp-cat"><span className="vp-cat-ico">{iconeCat(cat)}</span>{libelleCat(cat)}</div>
            {source.filter((p) => catDe(p) === cat).map(carteProduit)}
          </div>
          ))}
        </>
      )}

      {photoZoom && (
        <div className="vp-visionneuse" onClick={() => setPhotoZoom(null)} role="dialog" aria-modal="true">
          <button className="vp-visionneuse-x" onClick={() => setPhotoZoom(null)} aria-label="Fermer">×</button>
          <img src={photoZoom.url} alt={photoZoom.nom} onClick={(e) => e.stopPropagation()} />
          <div className="vp-visionneuse-nom">{photoZoom.nom}</div>
        </div>
      )}

      <PastilleWhatsApp url={settings.whatsapp_url} haut={ouvert && lignes.length > 0} />

      <div className="vp-ver">v{VERSION}</div>

      {ouvert && lignes.length > 0 && (
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

                <div className="vp-tot"><span>Total estimé</span><span className="r">{aDuPese ? '≈ ' : ''}{eur(total)}</span></div>
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
                        onClick={() => { setPanierOuvert(false); setVueCompte(true); }}>
                        Mon compte
                      </button>
                    </div>
                    <div className="vp-field">
                      <label className="vp-label">Un mot pour la commande (facultatif)</label>
                      <textarea className="vp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : bien cuit svp, je passe vers 18h…" />
                    </div>
                    <button className="vp-cta" disabled={envoi} onClick={envoyer}>
                      {envoi ? 'Envoi…' : `Envoyer ma commande · ${eur(total)}`}
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
                      ? `Bonjour ${profil.nom} · ${panierOuvert ? 'masquer' : 'voir et valider'}`
                      : (panierOuvert ? 'Masquer le panier' : 'Connexion requise pour valider')}
                  </small>
                </span>
              </span>
              <span className="vp-bar-r">
                {aDuPese ? '≈ ' : ''}{eur(total)}
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
function Admin({ settings, produits, ouvert, estSemaine, reload, showToast }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('commandes');
  const [commandes, setCommandes] = useState([]);

  // Journée de vente consultée. Par défaut celle en cours, mais on peut
  // revenir sur une journée passée — c'est indispensable pour saisir les
  // poids le lendemain, une fois la date de vente passée au jour suivant.
  const [dateTravail, setDateTravail] = useState(settings.date_vente);
  const [journees, setJournees] = useState([]);
  const [bascule, setBascule] = useState(false);

  const chargerJournees = async () => {
    const { data } = await supabase
      .from('viande_commandes').select('date_vente')
      .order('date_vente', { ascending: false });
    const uniques = [...new Set((data || []).map((r) => r.date_vente).filter(Boolean))];
    setJournees(uniques);
    // Si la journée en cours n'a encore aucune commande alors qu'une
    // journée précédente en a, on s'y place — une seule fois, pour ne
    // jamais écraser un choix manuel.
    if (!bascule && uniques.length && !uniques.includes(settings.date_vente)) {
      setDateTravail(uniques[0]);
      setBascule(true);
    }
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
    const poll = setInterval(loadCommandes, 8000);
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
          <input className="vp-input" value={pin} onChange={(e) => setPin(e.target.value)}
            inputMode="numeric" type="password" placeholder="Code"
            style={{ textAlign: 'center', letterSpacing: 4 }}
            onKeyDown={(e) => e.key === 'Enter' && check()} />
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
    ['sondage', 'Sondage'],
    ['reglages', 'Réglages'],
  ];

  return (
    <div className="vp-app vp-admin">
      <div className="vp-tabs vp-nav">
        {TABS.map(([k, lbl]) => (
          <button key={k} className={`vp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{lbl}</button>
        ))}
      </div>

      {(journees.length > 0 || dateTravail !== settings.date_vente) && (
        <div className={`vp-journee ${dateTravail !== settings.date_vente ? 'passee' : ''}`}>
          <label htmlFor="journee">Journée</label>
          <select id="journee" className="vp-quick-select" value={dateTravail}
            onChange={(e) => { setDateTravail(e.target.value); setBascule(true); }}>
            {!journees.includes(settings.date_vente) && (
              <option value={settings.date_vente}>{fmtJournee(settings.date_vente)} — en cours</option>
            )}
            {journees.map((d) => (
              <option key={d} value={d}>
                {fmtJournee(d)}{d === settings.date_vente ? ' — en cours' : ''}
              </option>
            ))}
          </select>
          {dateTravail !== settings.date_vente && (
            <button className="vp-btn ghost sm" onClick={() => { setDateTravail(settings.date_vente); setBascule(true); }}>
              Revenir à aujourd'hui
            </button>
          )}
        </div>
      )}

      {tab === 'commandes' && <AdminCommandes commandes={commandes} ouvert={ouvert} reload={loadCommandes} showToast={showToast} />}
      {tab === 'produits' && <AdminProduits produits={produits} settings={settingsJour} reload={reload} showToast={showToast} />}
      {tab === 'export' && <AdminExport commandes={commandes} produits={produits} settings={settingsJour} showToast={showToast} />}
      {tab === 'pesees' && <AdminPesees commandes={commandes} produits={produits} settings={settingsJour} reload={loadCommandes} showToast={showToast} />}
      {tab === 'membres' && <AdminMembres showToast={showToast} />}
      {tab === 'sondage' && <AdminSondage settings={settings} reload={reload} showToast={showToast} />}
      {tab === 'reglages' && <AdminReglages settings={settings} commandes={commandes} estSemaine={estSemaine} reload={reload} showToast={showToast} />}

      <div className="vp-foot">
        <button onClick={() => { window.location.hash = ''; }}>← Voir la boutique</button>
      </div>
    </div>
  );
}

/* ---------- Admin : Commandes ---------- */
function AdminCommandes({ commandes, ouvert, reload, showToast }) {
  const total = commandes.reduce((s, c) => s + Number(c.total_estime || 0), 0);
  const marge = commandes.reduce((s, c) => s + (Number(c.total_estime || 0) - Number(c.total_patrice || 0)), 0);

  // Voisins inscrits qui n'ont pas commandé sur cette journée.
  // L'oubli est la première cause de non-commande : un rappel ciblé
  // à 18 h vaut mieux qu'un message de plus dans le groupe.
  const [absents, setAbsents] = useState([]);
  const [voirAbsents, setVoirAbsents] = useState(false);

  useEffect(() => {
    const charger = async () => {
      const { data: clients } = await supabase.from('viande_clients')
        .select('id, nom, telephone, bloque');
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
      t += `${a.nom} — ${a.telephone}`;
      t += a.jours === null ? ' (jamais commandé)\n' : ` (dernière fois il y a ${a.jours} j)\n`;
    });
    return t;
  };

  const suppr = async (c) => {
    if (!window.confirm(`Supprimer la commande de ${c.nom_client} ?`)) return;
    await supabase.from('viande_commandes').delete().eq('id', c.id);
    showToast('Commande supprimée'); reload();
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
                    {a.telephone}
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

      {commandes.length === 0 ? (
        <div className="vp-empty">Aucune commande pour l'instant. Partage le lien dans ton groupe WhatsApp&nbsp;!</div>
      ) : (
        commandes.map((c) => (
          <div className="vp-cmd" key={c.id}>
            <div className="vp-cmd-head">
              <span className="vp-cmd-name">
                {c.nom_client} {c.statut === 'finalisee' && <span className="vp-pill" style={{ color: 'var(--green)' }}>finalisée</span>}
              </span>
              <span className="vp-cmd-time">{new Date(c.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {c.telephone && <div className="vp-sub">{c.telephone}</div>}
            {(c.lignes || []).map((l) => {
              const m = MODES[l.mode_vente];
              const q = l.mode_vente === 'kg' ? `${num(l.quantite)} kg` : `${num(l.quantite)} pc`;
              return (
                <div className="vp-cmd-l" key={l.id}>
                  <span>{l.emoji} {nomLigne(l)} <span className="vp-pill">{q}</span></span>
                  <span style={{ fontWeight: 700 }}>
                    {l.poids_reel != null ? eur(sousTotalFinal(l)) : (m.pese && l.mode_vente !== 'piece_fixe' ? '≈ ' : '') + eur(l.sous_total_estime)}
                  </span>
                </div>
              );
            })}
            {c.note && <div className="vp-sub" style={{ marginTop: 6, fontStyle: 'italic' }}>« {c.note} »</div>}
            <div className="vp-srow" style={{ marginTop: 10 }}>
              <span style={{ fontWeight: 800 }}>{c.total_final != null ? eur(c.total_final) : `≈ ${eur(c.total_estime)}`}</span>
              <button className="vp-btn ghost sm" onClick={() => suppr(c)}>Supprimer</button>
            </div>
          </div>
        ))
      )}

      {blocRelance}
    </>
  );
}

/* ---------- Admin : Produits ---------- */
function AdminProduits({ produits, settings, reload, showToast }) {
  const vide = { nom: '', categorie: 'Viande', mode_vente: 'piece_pesee', prix_patrice: '', prix_william: '', poids_moyen: '', emoji: '🥩', photo_url: '', disponible: true, rupture: false, origine_fr: false, promo: false, prix_barre: '', ordre: produits.length + 1, dlc: '', variante_label: '', variantes: [] };
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filtreCat, setFiltreCat] = useState('Tous');
  const [recherche, setRecherche] = useState('');
  // id du produit vers lequel revenir après fermeture du formulaire
  const [retour, setRetour] = useState(null);

  const catsPresentes = CATEGORIES.filter((c) => produits.some((p) => catDe(p) === c));

  const q = normaliser(recherche.trim());
  const produitsAffiches = produits.filter((p) => {
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
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('viande-photos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('viande-photos').getPublicUrl(path);
      setForm((f) => ({ ...f, photo_url: data.publicUrl }));
      showToast('Photo ajoutée');
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
      emoji: form.emoji, photo_url: form.photo_url || null, disponible: form.disponible, ordre: Number(form.ordre) || 0,
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
              ? <img src={form.photo_url} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--line)' }} />
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
              ? <img src={p.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', flex: '0 0 auto' }} />
              : <span style={{ fontSize: 24 }}>{p.emoji}</span>}
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
              {(dlc || p.rupture || p.promo) && (
                <div style={{ marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.promo && <span className="vp-badge-promo"><span className="vp-eclair">⚡</span>PROMO</span>}
                  {p.rupture && <span className="vp-rupt-pill">EN RUPTURE</span>}
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

  const actifs = produitsAffiches.filter((p) => p.disponible);
  const inactifs = produitsAffiches.filter((p) => !p.disponible);

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
          {produits.length === 0
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
          <div className="vp-col">
            <div className="vp-col-head">
              <span className="vp-col-dot" />En vente
              <span className="vp-col-count">{actifs.length}</span>
            </div>
            {actifs.length === 0
              ? <div className="vp-col-empty">Aucun produit en vente.</div>
              : actifs.map(carte)}
          </div>
          <div className="vp-col off">
            <div className="vp-col-head">
              <span className="vp-col-dot" />Désactivés
              <span className="vp-col-count">{inactifs.length}</span>
            </div>
            {inactifs.length === 0
              ? <div className="vp-col-empty">Rien de désactivé.</div>
              : inactifs.map(carte)}
          </div>
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
        const auKilo = l.mode_vente !== 'piece_fixe';
        const unite = auKilo ? '/kg' : '/pc';
        return `<tr class="${rupt ? 'rupture' : ''}">
          <td class="prod"><span class="nom">${esc(sansPoids(nomLigne(l)))}</span>${rupt ? ' — EN RUPTURE' : ''}</td>
          <td class="qte c">${esc(q)}</td>
          <td class="c">${rupt || !auKilo ? '—' : '<span class="saisie"></span>'}</td>
          <td class="n">${esc(eur(Number(l.prix_patrice)) + unite)}</td>
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

  return (
    <>
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

  const montant = (l, prixTexte) => {
    if (estRupture(l)) return 0;
    const prix = nombre(prixTexte) || 0;
    if (l.mode_vente === 'piece_fixe') return (Number(l.quantite) || 0) * prix;
    return poidsRetenu(l) * prix;
  };
  const stLive = (l) => montant(l, valWil(l));
  const stPatriceLive = (l) => montant(l, valPat(l));

  const totalCmd = (c) => (c.lignes || []).reduce((s, l) => s + stLive(l), 0);
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
          const { error } = await supabase.from('viande_commande_lignes').update({
            poids_reel: rupt ? null : pr,
            prix_patrice: cts(nombre(valPat(l)) || 0),
            prix_william: cts(nombre(valWil(l)) || 0),
            rupture: rupt,
            sous_total_final: cts(stLive(l)),
          }).eq('id', l.id);
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
      return `• ${n} : ${num(l.quantite)} × ${eur(nombre(valWil(l)))} = ${eur(stLive(l))}\n`;
    }
    if (estEstime(l)) return `• ${n} : (poids à confirmer)\n`;
    return `• ${n} : ${num(poidsRetenu(l))} kg × ${eur(nombre(valWil(l)))} = ${eur(stLive(l))}\n`;
  };
  const noteClient = (c) => {
    let t = `🥩 ${settings.titre} — ${fmtDateCourt(settings.date_vente)}\nNote de ${c.nom_client}\n\n`;
    (c.lignes || []).forEach((l) => { t += ligneTxt(l); });
    t += `\nTotal : ${eur(totalCmd(c))}\nMerci ! 😊`;
    return t;
  };
  const recapGlobal = () => {
    let t = `🥩 Récap commandes — ${fmtDateCourt(settings.date_vente)}\n\n`;
    commandes.forEach((c) => { t += `${c.nom_client} : ${eur(totalCmd(c))}\n`; });
    t += `\nTotal groupe : ${eur(totalGroupe)}`;
    return t;
  };

  /* ---- impressions ---- */
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
          : l.mode_vente === 'piece_fixe' ? `${num(l.quantite)} × ${eur(nombre(valWil(l)))}`
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
    const auKilo = l.mode_vente !== 'piece_fixe';
    return (
      <div className={`vp-pl ${rupt ? 'rupt' : ''}`} key={l.id}>
        <div className="vp-pl-h">
          <div className="nm">
            <span className={rupt ? 'vp-barre' : ''}>{sousTitre}</span>
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

        <div className="vp-pl-g">
          <label>
            <span>Poids (kg)</span>
            <input className="vp-winput" inputMode="decimal" placeholder={auKilo ? 'kg' : '—'}
              disabled={rupt || !auKilo} value={auKilo ? valPoids(l) : ''}
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
          <span>coût {eur(stPatriceLive(l))}</span>
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
                <div className="vp-marge">marge {eur(totalCmd(c) - totalPatriceCmd(c))}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              {(c.lignes || []).map((l) => ligneSaisie(l, `${l.emoji} ${nomLigne(l)}`))}
            </div>
            {c.note && <div className="vp-sub" style={{ marginTop: 8, fontStyle: 'italic' }}>« {c.note} »</div>}
            <button className="vp-btn ghost sm" style={{ marginTop: 10 }}
              onClick={async () => { (await copier(noteClient(c))) && showToast(`Note de ${c.nom_client} copiée`); }}>
              Copier sa note
            </button>
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
            <div className="vp-grid2" style={{ marginTop: 12 }}>
              <button className="vp-btn" onClick={imprimer}>Détail par client</button>
              <button className="vp-btn green" onClick={async () => { (await copier(recapGlobal())) && showToast('Récap global copié'); }}>Copier le récap</button>
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
function AdminMembres({ showToast }) {
  const [membres, setMembres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');

  const charger = async () => {
    const { data, error } = await supabase.from('viande_clients')
      .select('*').order('created_at', { ascending: false });
    if (error) showToast(messageErreur(error));
    setMembres(data || []);
    setChargement(false);
  };
  useEffect(() => { charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const basculerBlocage = async (m) => {
    if (!m.bloque && !window.confirm(
      `Bloquer ${m.nom} ?\n\nSon compte restera actif mais il ne pourra plus commander.`
    )) return;
    const { error } = await supabase.from('viande_clients')
      .update({ bloque: !m.bloque }).eq('id', m.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    charger();
    showToast(!m.bloque ? 'Compte bloqué' : 'Blocage levé');
  };

  const q = normaliser(recherche.trim());
  const listeFiltree = !q ? membres : membres.filter((m) =>
    normaliser(m.nom).includes(q) || normaliser(m.email).includes(q)
    || String(m.telephone || '').includes(recherche.trim()));

  const texte = () => membres
    .filter((m) => !m.bloque)
    .map((m) => `${m.nom} : ${m.telephone}`)
    .join('\n');

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
      </div>

      {membres.length > 3 && (
        <div className="vp-search">
          <span className="vp-search-ico">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input className="vp-input" value={recherche} type="search" autoComplete="off"
            onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail ou téléphone…" />
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
                {m.bloque && <span className="vp-rupt-pill" style={{ marginLeft: 6 }}>BLOQUÉ</span>}
              </div>
              <div className="vp-sub">{m.telephone}</div>
              <div className="vp-sub">{m.email}</div>
            </div>
            <span className="vp-cmd-time">
              {new Date(m.created_at).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <button className={`vp-btn ${m.bloque ? '' : 'ghost'} sm`} style={{ marginTop: 10 }}
            onClick={() => basculerBlocage(m)}>
            {m.bloque ? 'Débloquer' : 'Bloquer'}
          </button>
        </div>
      ))}
    </>
  );
}

/* ---------- Admin : Sondage ---------- */
function AdminSondage({ settings, reload, showToast }) {
  const [f, setF] = useState({
    sondage_actif: !!settings.sondage_actif,
    sondage_titre: settings.sondage_titre || 'Ton avis nous intéresse',
    sondage_question: settings.sondage_question || '',
    sondage_merci: settings.sondage_merci || '',
  });
  const [reponses, setReponses] = useState([]);
  const [chargement, setChargement] = useState(true);

  const charger = async () => {
    const { data, error } = await supabase
      .from('viande_sondage_reponses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { showToast(messageErreur(error)); }
    setReponses(data || []);
    setChargement(false);
  };
  useEffect(() => {
    charger();
    const ch = supabase.channel('viande_sondage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_sondage_reponses' }, charger)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!window.confirm('Supprimer cette réponse ?')) return;
    const { error } = await supabase.from('viande_sondage_reponses').delete().eq('id', r.id);
    const err = messageErreur(error);
    if (err) { showToast(err); return; }
    charger(); showToast('Réponse supprimée');
  };

  const texte = () => {
    let t = `💬 Réponses au questionnaire (${reponses.length})\n\n`;
    reponses.forEach((r) => {
      t += `• ${r.nom || 'Anonyme'} : ${r.reponse}\n`;
    });
    return t;
  };

  const imprimer = () => {
    const rows = reponses.map((r) => `
      <tr>
        <td class="prod">${esc(r.nom || 'Anonyme')}</td>
        <td class="qte gris">${esc(new Date(r.created_at).toLocaleDateString('fr-FR'))}</td>
        <td>${esc(r.reponse)}</td>
      </tr>`).join('');
    const corps = `
      <div class="tete">
        <div class="barre"></div>
        <div>
          <h1>Réponses au questionnaire</h1>
          <div class="meta"><b>${esc(settings.titre)}</b> · ${reponses.length} réponse(s)</div>
        </div>
      </div>
      <div class="bloc"><div class="note">${esc(f.sondage_question)}</div></div>
      <table class="liste">
        <colgroup><col class="s-nom"><col class="s-date"><col class="s-rep"></colgroup>
        <thead><tr><th>Qui</th><th>Date</th><th>Réponse</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="pied">Viande Noisy — document généré le ${esc(new Date().toLocaleDateString('fr-FR'))}</div>`;
    if (!imprimerDocument('Questionnaire', corps)) {
      showToast('Autorise les fenêtres pop-up pour imprimer');
    }
  };

  return (
    <>
      <div className="vp-section">
        <div className="vp-srow">
          <div>
            <div className="vp-h2">{f.sondage_actif ? '🟢 Questionnaire visible' : '⚪ Questionnaire masqué'}</div>
            <div className="vp-sub">
              {f.sondage_actif
                ? 'Un encart apparaît sous le message d\'accueil de la boutique.'
                : 'Rien n\'est affiché aux clients pour le moment.'}
            </div>
          </div>
          <div className={`vp-toggle ${f.sondage_actif ? 'on' : ''}`} onClick={basculer} />
        </div>
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
            placeholder="Ex : Quels produits supplémentaires aimerais-tu voir ?" />
        </div>

        <div className="vp-field">
          <label className="vp-label">Message de remerciement</label>
          <textarea className="vp-input" rows={2} value={f.sondage_merci}
            onChange={(e) => setF({ ...f, sondage_merci: e.target.value })}
            placeholder="Ex : Merci de ta réponse !" />
        </div>

        <button className="vp-cta" onClick={sauver}>Enregistrer le questionnaire</button>
      </div>

      <div className="vp-section">
        <div className="vp-srow">
          <div className="vp-h2" style={{ fontSize: 16 }}>Réponses</div>
          <span className="vp-pill">{reponses.length}</span>
        </div>

        {chargement ? (
          <div className="vp-empty">Chargement…</div>
        ) : reponses.length === 0 ? (
          <div className="vp-empty">Aucune réponse pour l'instant.</div>
        ) : (
          <>
            <div style={{ marginTop: 10 }}>
              {reponses.map((r) => (
                <div className="vp-rep" key={r.id}>
                  <div className="vp-srow" style={{ alignItems: 'baseline' }}>
                    <b>{r.nom || 'Anonyme'}</b>
                    <span className="vp-cmd-time">
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                  <p className="vp-rep-t">{r.reponse}</p>
                  <button className="vp-trash" onClick={() => supprimer(r)}>Supprimer</button>
                </div>
              ))}
            </div>
            <div className="vp-grid2" style={{ marginTop: 12 }}>
              <button className="vp-btn green" onClick={async () => { (await copier(texte())) && showToast('Réponses copiées'); }}>Copier</button>
              <button className="vp-btn" onClick={imprimer}>Imprimer / PDF</button>
            </div>
          </>
        )}
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
    whatsapp_url: settings.whatsapp_url || '',
    email_alerte: settings.email_alerte || '',
    alerte_wa_numero: settings.alerte_wa_numero || '',
    alerte_wa_cle: settings.alerte_wa_cle || '',
  });

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  // Mise à jour silencieuse de date_vente si on change de jour
  useEffect(() => {
    const today = todayStr();
    if (settings.date_vente !== today) {
      supabase.from('viande_settings').update({ date_vente: today }).eq('id', 1).then(() => reload());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const nouvelleVente = async () => {
    if (!window.confirm('Démarrer une NOUVELLE vente ? Cela supprime toutes les commandes en cours (les produits sont conservés).')) return;
    const today = todayStr();
    await supabase.from('viande_commandes').delete().eq('date_vente', settings.date_vente);
    await supabase.from('viande_settings').update({ date_vente: today, vente_active: true, updated_at: new Date().toISOString() }).eq('id', 1);
    reload(); showToast('Nouvelle vente prête');
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
              {estSemaine
                ? (f.vente_active
                    ? `${jourActuel} — ouverture auto ${f.heure_ouverture} · fermeture ${f.heure_fermeture}`
                    : `${jourActuel} — fermée manuellement (horaires suspendus)`)
                : (f.vente_active
                    ? `${jourActuel} — ouverte manuellement`
                    : `${jourActuel} — fermée (week-end par défaut)`)}
            </div>
          </div>
          <div className={`vp-toggle ${f.vente_active ? 'on' : ''}`} onClick={toggleVente} />
        </div>
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
          Appliqués automatiquement du lundi au vendredi. Week-end : utilise le bouton on/off.
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
        <div className="vp-h2" style={{ fontSize: 16 }}>Nouvelle vente</div>
        <div className="vp-sub">Quand la promo est terminée et les notes envoyées, repars sur une base propre.</div>
        <button className="vp-btn ghost" style={{ marginTop: 12 }} onClick={nouvelleVente}>Démarrer une nouvelle vente</button>
      </div>
    </>
  );
}
