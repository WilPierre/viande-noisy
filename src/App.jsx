import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ============================================================
   CONFIG SUPABASE
   Renseigne ces 2 variables dans Vercel (Settings → Environment Variables) :
     REACT_APP_SUPABASE_URL
     REACT_APP_SUPABASE_ANON_KEY
   (les mêmes que ton projet Noisy en Fête)
============================================================ */
const SB_URL = process.env.REACT_APP_SUPABASE_URL;
const SB_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;

/* ============================================================
   MODES DE VENTE
============================================================ */
const MODES = {
  piece_fixe:  { label: 'À la pièce',         court: 'pièce', prixUnite: '€/pièce', pese: false, decimal: false },
  kg:          { label: 'Au kilo',            court: 'kg',    prixUnite: '€/kg',    pese: true,  decimal: true  },
  piece_pesee: { label: 'À la pièce (pesé)',  court: 'pièce', prixUnite: '€/kg',    pese: true,  decimal: false },
};
const CATEGORIES = ['Viande', 'Charcuterie', 'Crèmerie', 'Autre'];
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
  { groupe: 'Divers',            liste: ['🧺', '🛒', '📦', '🎁', '🏷️', '⭐', '🔥', '💰', '🥘', '🍽️', '❄️', '🇮🇹'] },
];
const TOUS_EMOJIS = EMOJIS.flatMap((g) => g.liste);

/* ============================================================
   HELPERS
============================================================ */
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
// nom affiché d'une ligne de commande, variante comprise
function nomLigne(l) {
  return l.variante_nom ? `${l.produit_nom} — ${l.variante_nom}` : l.produit_nom;
}

function fmtDateCourt(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
  catch { return d; }
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
html,body{overflow-x:hidden;max-width:100%}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;}
.vp-app{max-width:600px;margin:0 auto;padding:0 14px 120px;position:relative}
.vp-app.vp-avec-panier{padding-bottom:140px}
.vp-admin-icon{position:absolute;top:18px;right:14px;width:38px;height:38px;border-radius:11px;
  background:#fff;border:1px solid var(--line);color:var(--muted);display:grid;place-items:center;
  box-shadow:var(--shadow);z-index:10}
.vp-admin-icon:active{transform:scale(.94);color:var(--wine)}
.vp-admin{max-width:760px;}
h1,h2,h3{font-family:'Bricolage Grotesque','Inter',sans-serif;margin:0;letter-spacing:-.01em;}
button{font-family:inherit;cursor:pointer;border:none}
input,select,textarea{font-family:inherit;font-size:16px}

/* header */
.vp-head{padding:22px 4px 14px;text-align:center;display:flex;flex-direction:column;align-items:center}
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
.vp-photo-wrap{position:relative;flex:0 0 auto}
.vp-photo{width:60px;height:60px;border-radius:14px;object-fit:cover;display:block;border:1px solid var(--line)}
.vp-photo-zoom{position:absolute;left:0;top:68px;width:230px;height:230px;border-radius:16px;
  object-fit:cover;border:3px solid #fff;box-shadow:0 14px 34px rgba(36,30,27,.28);
  opacity:0;transform:translateY(-6px);pointer-events:none;
  transition:opacity .15s ease,transform .15s ease;z-index:30}
@media (hover:hover) and (pointer:fine){
  .vp-photo-wrap:hover .vp-photo{transform:scale(1.05);transition:transform .15s ease}
  .vp-photo-wrap:hover .vp-photo-zoom{opacity:1;transform:translateY(0)}
}
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
.vp-cat-nav{position:sticky;top:0;background:var(--paper);z-index:5;padding:10px 0}
.vp-cat-select{width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:12px;
  background:#fff;color:var(--ink);font-size:15px;font-weight:600;font-family:inherit;
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238A7E76' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center}
.vp-cat-select:focus{outline:none;border-color:var(--wine)}
/* pills — visibles partout, défilement horizontal sur petit écran */
.vp-tabs{display:flex;gap:6px;overflow-x:auto;padding:14px 0 10px;justify-content:flex-start;
  -webkit-overflow-scrolling:touch;scrollbar-width:none}
.vp-tabs::-webkit-scrollbar{display:none}
/* …sauf le sélecteur de catégorie client, remplacé par un menu natif sur mobile */
.vp-cat-nav .vp-tabs{display:none}
@media (min-width:520px){
  .vp-cat-nav .vp-cat-select{display:none}
  .vp-cat-nav .vp-tabs{display:flex}
}
/* navigation principale de l'admin : toujours à portée de pouce */
.vp-nav{position:sticky;top:0;z-index:6;background:var(--paper);
  padding-top:12px;margin-bottom:4px;box-shadow:0 6px 10px -8px rgba(36,30,27,.25)}
.vp-tab{white-space:nowrap;padding:9px 14px;border-radius:999px;font-weight:600;font-size:14px;
  background:#fff;border:1px solid var(--line);color:var(--muted)}
.vp-tab.on{background:var(--ink);color:#fff;border-color:var(--ink)}
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
.vp-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:#fff;
  padding:12px 18px;border-radius:12px;font-size:14px;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,.25)}

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
  box-shadow:0 10px 30px rgba(36,30,27,.3)}
.vp-bar:active{background:var(--wine-d)}
.vp-bar-l{display:flex;align-items:center;gap:11px;min-width:0}
.vp-bar-ico{position:relative;font-size:23px;line-height:1;flex:0 0 auto}
.vp-bar-badge{position:absolute;top:-6px;right:-9px;min-width:19px;height:19px;padding:0 5px;
  border-radius:999px;background:#fff;color:var(--wine);font-size:11.5px;font-weight:800;
  display:grid;place-items:center;font-family:'Inter',sans-serif}
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

/* barre de recherche produits */
.vp-search{position:relative;margin-bottom:12px}
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

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2200); };

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
        />
      )}
    </>
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
   CLIENT — interface de commande
============================================================ */
function Client({ settings, produits, now, fermetureAt, ouvertureAt, ouvert, estSemaine, showToast }) {
  const [cart, setCart] = useState({});   // "produitId|varianteId" -> quantite
  const [choix, setChoix] = useState({}); // produitId -> varianteId sélectionnée sur la fiche
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [done, setDone] = useState(null);
  const [filtreCat, setFiltreCat] = useState('Tous');
  const [panierOuvert, setPanierOuvert] = useState(false);

  const dispo = produits.filter((p) => p.disponible);
  const cats = CATEGORIES.filter((c) => dispo.some((p) => p.categorie === c));

  useEffect(() => {
    if (filtreCat !== 'Tous' && !cats.includes(filtreCat)) setFiltreCat('Tous');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.join(',')]);

  const catsAffichees = filtreCat === 'Tous' ? cats : cats.filter((c) => c === filtreCat);

  const cle = (p, v) => `${p.id}|${v ? v.id : ''}`;
  // variante actuellement sélectionnée sur la fiche produit (la 1re par défaut)
  const varianteActive = (p) => {
    const vs = variantesDe(p);
    if (!vs.length) return null;
    return vs.find((v) => String(v.id) === String(choix[p.id])) || vs[0];
  };

  const setQty = (p, v, q) => {
    const k = cle(p, v);
    let val = Math.max(0, Math.round(q));
    setCart((c) => { const n = { ...c }; if (val <= 0) delete n[k]; else n[k] = val; return n; });
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
  const aDuPese = lignes.some(({ p }) => MODES[p.mode_vente].pese);

  const envoyer = async () => {
    if (!nom.trim()) { showToast('Indique ton prénom'); return; }
    if (lignes.length === 0) { showToast('Ton panier est vide'); return; }
    setEnvoi(true);
    try {
      const totalPatrice = lignes.reduce(
        (s, { p, v, q }) => s + sousTotalLigne(p, v, q, 'prix_patrice'), 0);
      const { data: cmd, error } = await supabase.from('viande_commandes').insert({
        nom_client: nom.trim(), telephone: tel.trim() || null, note: note.trim() || null,
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
      setDone({ nom: nom.trim(), total, aDuPese });
      setPanierOuvert(false);
      setCart({}); setNom(''); setTel(''); setNote('');
    } catch (e) {
      showToast('Erreur — réessaie');
    } finally { setEnvoi(false); }
  };

  if (done) {
    return (
      <div className="vp-app">
        <div className="vp-confirm">
          <div className="vp-check">✓</div>
          <h1 style={{ fontSize: 26 }}>Commande envoyée !</h1>
          <p style={{ color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
            Merci {done.nom}. Total estimé : <b>{eur(done.total)}</b>.<br />
            {done.aDuPese && 'Les produits au kilo seront ajustés au poids réel à la livraison.'}
          </p>
          <button className="vp-btn ghost" style={{ marginTop: 22 }} onClick={() => setDone(null)}>
            Passer une autre commande
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`vp-app ${ouvert && lignes.length > 0 ? 'vp-avec-panier' : ''}`}>
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
      </div>

      {!ouvert ? (
        <div className="vp-empty">Les commandes sont fermées pour le moment. Reviens à la prochaine promo&nbsp;!</div>
      ) : dispo.length === 0 ? (
        <div className="vp-empty">Aucun produit pour l'instant.</div>
      ) : (
        <>
          {cats.length > 1 && (
            <div className="vp-cat-nav">
              {/* Mobile : menu déroulant natif */}
              <select
                className="vp-cat-select"
                value={filtreCat}
                onChange={(e) => setFiltreCat(e.target.value)}
              >
                <option value="Tous">Tous les produits</option>
                {cats.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {/* Desktop : pills défilantes */}
              <div className="vp-tabs">
                <button className={`vp-tab ${filtreCat === 'Tous' ? 'on' : ''}`} onClick={() => setFiltreCat('Tous')}>Tous</button>
                {cats.map((cat) => (
                  <button key={cat} className={`vp-tab ${filtreCat === cat ? 'on' : ''}`} onClick={() => setFiltreCat(cat)}>{cat}</button>
                ))}
              </div>
            </div>
          )}
          {catsAffichees.map((cat) => (
          <div key={cat}>
            <div className="vp-cat">{cat}</div>
            {dispo.filter((p) => p.categorie === cat).map((p) => {
              const m = MODES[p.mode_vente];
              const vs = variantesDe(p);
              const v = varianteActive(p);
              const q = cart[cle(p, v)] || 0;
              const prix = prixVariante(p, v, 'prix_william');
              const pm = poidsVariante(p, v);
              return (
                <div className="vp-prod" key={p.id}>
                  {p.photo_url
                    ? <div className="vp-photo-wrap">
                        <img src={p.photo_url} alt={p.nom} className="vp-photo" />
                        <img src={p.photo_url} alt="" className="vp-photo-zoom" />
                      </div>
                    : <div className="vp-emoji">{p.emoji}</div>}
                  <div className="vp-pinfo">
                    <div className="vp-pname">{p.nom}</div>
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
                            {vide0(o.prix_william) ? '' : ` · ${eur(o.prix_william)} ${m.prixUnite}`}
                          </option>
                        ))}
                      </select>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <span className="vp-price">{eur(prix)} {m.prixUnite}</span>
                    </div>
                  </div>
                  <div className="vp-step">
                    {q > 0 && <button onClick={() => setQty(p, v, q - 1)}>−</button>}
                    {q > 0 && <span className="vp-qty">{num(q)}</span>}
                    {q > 0 && <button onClick={() => setQty(p, v, q + 1)}>+</button>}
                    {q <= 0 && <button className="vp-add" onClick={() => setQty(p, v, 1)}>Ajouter</button>}
                  </div>
                </div>
              );
            })}
          </div>
          ))}
        </>
      )}

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
                        {p.emoji} {p.nom}{v ? ` — ${v.nom}` : ''}
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

                <div className="vp-tot"><span>Total estimé</span><span className="r">{eur(total)}</span></div>
                {aDuPese && <div className="vp-mini">≈ Les montants au kilo sont des estimations. Le prix final sera calculé au poids réel.</div>}
                <button className="vp-trash" onClick={() => setCart({})}>Vider le panier</button>

                <div className="vp-field">
                  <label className="vp-label">Ton prénom *</label>
                  <input className="vp-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Marie" />
                </div>
                <div className="vp-field">
                  <label className="vp-label">Téléphone (facultatif)</label>
                  <input className="vp-input" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="06 …" inputMode="tel" />
                </div>
                <div className="vp-field">
                  <label className="vp-label">Un mot pour la commande (facultatif)</label>
                  <textarea className="vp-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : bien cuit svp, je passe vers 18h…" />
                </div>
                <button className="vp-cta" disabled={envoi} onClick={envoyer}>
                  {envoi ? 'Envoi…' : `Envoyer ma commande · ${eur(total)}`}
                </button>
              </div>
            )}

            <button className="vp-bar" onClick={() => setPanierOuvert((o) => !o)}>
              <span className="vp-bar-l">
                <span className="vp-bar-ico">🧺<span className="vp-bar-badge">{lignes.length}</span></span>
                <span className="vp-bar-txt">
                  <b>{lignes.length} article{lignes.length > 1 ? 's' : ''}</b>
                  <small>{panierOuvert ? 'Masquer le panier' : 'Voir et valider'}</small>
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

  const loadCommandes = async () => {
    const { data } = await supabase
      .from('viande_commandes')
      .select('*, lignes:viande_commande_lignes(*)')
      .eq('date_vente', settings.date_vente)
      .order('created_at', { ascending: true });
    if (data) setCommandes(data);
  };
  useEffect(() => {
    if (!unlocked) return;
    loadCommandes();
    const ch = supabase.channel('viande_cmd')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_commandes' }, loadCommandes)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viande_commande_lignes' }, loadCommandes)
      .subscribe();
    const poll = setInterval(loadCommandes, 8000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, settings.date_vente]);

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
    ['export', 'Export Patrice'],
    ['pesees', 'Pesées & notes'],
    ['reglages', 'Réglages'],
  ];

  return (
    <div className="vp-app vp-admin">
      <div className="vp-tabs vp-nav">
        {TABS.map(([k, lbl]) => (
          <button key={k} className={`vp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{lbl}</button>
        ))}
      </div>

      {tab === 'commandes' && <AdminCommandes commandes={commandes} ouvert={ouvert} reload={loadCommandes} showToast={showToast} />}
      {tab === 'produits' && <AdminProduits produits={produits} settings={settings} reload={reload} showToast={showToast} />}
      {tab === 'export' && <AdminExport commandes={commandes} produits={produits} settings={settings} showToast={showToast} />}
      {tab === 'pesees' && <AdminPesees commandes={commandes} settings={settings} reload={loadCommandes} showToast={showToast} />}
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

  const suppr = async (c) => {
    if (!window.confirm(`Supprimer la commande de ${c.nom_client} ?`)) return;
    await supabase.from('viande_commandes').delete().eq('id', c.id);
    showToast('Commande supprimée'); reload();
  };

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
    </>
  );
}

/* ---------- Admin : Produits ---------- */
function AdminProduits({ produits, settings, reload, showToast }) {
  const vide = { nom: '', categorie: 'Viande', mode_vente: 'piece_pesee', prix_patrice: '', prix_william: '', poids_moyen: '', emoji: '🥩', photo_url: '', disponible: true, ordre: produits.length + 1, dlc: '', variante_label: '', variantes: [] };
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filtreCat, setFiltreCat] = useState('Tous');
  const [recherche, setRecherche] = useState('');
  // id du produit vers lequel revenir après fermeture du formulaire
  const [retour, setRetour] = useState(null);

  const catsPresentes = CATEGORIES.filter((c) => produits.some((p) => p.categorie === c));

  const q = normaliser(recherche.trim());
  const produitsAffiches = produits.filter((p) => {
    if (filtreCat !== 'Tous' && p.categorie !== filtreCat) return false;
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
    const base = parseFloat(form.prix_patrice);
    if (isNaN(base)) return;
    const w = Math.round(base * (1 + Number(settings.marge_defaut) / 100) * 100) / 100;
    setForm((f) => ({ ...f, prix_william: String(w) }));
  };

  const enregistrer = async () => {
    if (!form.nom.trim()) { showToast('Nom requis'); return; }
    const vars = (form.variantes || [])
      .filter((v) => v.nom.trim())
      .map((v) => ({
        id: v.id,
        nom: v.nom.trim(),
        prix_patrice: v.prix_patrice === '' ? null : (parseFloat(v.prix_patrice) || 0),
        prix_william: v.prix_william === '' ? null : (parseFloat(v.prix_william) || 0),
        poids_moyen: v.poids_moyen === '' ? null : (parseFloat(v.poids_moyen) || 0),
      }));
    if ((form.variantes || []).some((v) => !v.nom.trim())) {
      showToast('Une option sans nom sera ignorée');
    }
    const payload = {
      nom: form.nom.trim(), categorie: form.categorie, mode_vente: form.mode_vente,
      prix_patrice: parseFloat(form.prix_patrice) || 0, prix_william: parseFloat(form.prix_william) || 0,
      poids_moyen: form.mode_vente === 'piece_pesee' ? (parseFloat(form.poids_moyen) || null) : null,
      emoji: form.emoji, photo_url: form.photo_url || null, disponible: form.disponible, ordre: Number(form.ordre) || 0,
      dlc: form.dlc || null,
      variante_label: vars.length ? (form.variante_label.trim() || 'Option') : null,
      variantes: vars,
    };
    if (form.id) await supabase.from('viande_produits').update(payload).eq('id', form.id);
    else await supabase.from('viande_produits').insert(payload);
    setForm(null); reload(); showToast('Produit enregistré');
  };
  const supprimer = async (p) => {
    if (!window.confirm(`Supprimer « ${p.nom} » ?`)) return;
    await supabase.from('viande_produits').delete().eq('id', p.id);
    setRetour(null); setForm(null); reload(); showToast('Produit supprimé');
  };
  // modification express de la DLC depuis la liste, sans ouvrir le produit
  const majDlc = async (p, val) => {
    await supabase.from('viande_produits').update({ dlc: val || null }).eq('id', p.id);
    reload();
  };
  const toggleDispo = async (p) => {
    await supabase.from('viande_produits').update({ disponible: !p.disponible }).eq('id', p.id);
    setRetour(p.id); // la carte change de colonne : on la suit
    reload();
  };

  const marge = (() => {
    const pa = parseFloat(form?.prix_patrice), wi = parseFloat(form?.prix_william);
    if (isNaN(pa) || isNaN(wi) || pa <= 0) return null;
    return { eur: wi - pa, pct: Math.round((wi / pa - 1) * 100) };
  })();

  if (form) {
    const m = MODES[form.mode_vente];
    return (
      <div className="vp-section">
        <div className="vp-h2" style={{ marginBottom: 12 }}>{form.id ? 'Modifier' : 'Nouveau produit'}</div>

        <label className="vp-label">Nom</label>
        <input className="vp-input" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Côte de bœuf" />

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Catégorie</label>
            <select className="vp-input" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
        <div className="vp-srow" style={{ marginTop: 8 }}>
          <button className="vp-btn ghost sm" onClick={appliquerMarge}>+{settings.marge_defaut}% sur le prix Patrice</button>
          {marge && <span className="vp-marge">marge {eur(marge.eur)} ({marge.pct}%)</span>}
        </div>

        {form.mode_vente === 'piece_pesee' && (
          <div style={{ marginTop: 12 }}>
            <label className="vp-label">Poids moyen par pièce (kg) — pour l'estimation</label>
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
                {p.nom}
                {nbVars > 0 && <span className="vp-pill" style={{ marginLeft: 6 }}>
                  {nbVars} {(p.variante_label || 'option').toLowerCase()}{nbVars > 1 ? 's' : ''}
                </span>}
              </div>
              <div className="vp-sub">
                {m.label} · Patrice {eur(p.prix_patrice)} → toi {eur(p.prix_william)} {m.prixUnite}
                {p.prix_patrice > 0 && <span className="vp-marge"> · +{mg}%</span>}
              </div>
              {dlc && <div style={{ marginTop: 5 }}><span className={`vp-dlc ${dlc.classe}`}>{dlc.texte}</span></div>}
            </div>
          </div>
          <div className={`vp-toggle ${p.disponible ? 'on' : ''}`} onClick={() => toggleDispo(p)} />
        </div>
        <div className="vp-dlc-edit">
          <label htmlFor={`dlc-${p.id}`}>DLC</label>
          <input id={`dlc-${p.id}`} className="vp-dlc-input" type="date"
            value={p.dlc || ''} onChange={(e) => majDlc(p, e.target.value)} />
          {p.dlc && <button className="vp-dlc-x" onClick={() => majDlc(p, '')} aria-label="Effacer la DLC">×</button>}
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
              {cat} ({produits.filter((p) => p.categorie === cat).length})
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
  // agrégation par produit
  const agg = {};
  commandes.forEach((c) => (c.lignes || []).forEach((l) => {
    const k = nomLigne(l);
    if (!agg[k]) agg[k] = { nom: k, emoji: l.emoji, mode: l.mode_vente, qte: 0, cout: 0 };
    agg[k].qte += Number(l.quantite || 0);
    agg[k].cout += sousTotal(l.mode_vente, l.quantite, l.prix_patrice, l.poids_moyen);
  }));
  const lignes = Object.values(agg);
  const coutTotal = lignes.reduce((s, x) => s + x.cout, 0);

  const uniteTxt = (mode, qte) =>
    mode === 'kg' ? `${num(qte)} kg` : `${num(qte)} pièce(s)`;

  const texte = () => {
    let t = `🧺 Commande pour Patrice — ${fmtDateCourt(settings.date_vente)}\n\n`;
    lignes.forEach((x) => { t += `• ${x.nom} : ${uniteTxt(x.mode, x.qte)}\n`; });
    t += `\nCoût total estimé (prix Patrice) : ${eur(coutTotal)}`;
    return t;
  };

  const csv = () => {
    let c = 'Produit;Mode;Quantite;Unite;Prix Patrice;Cout estime\n';
    lignes.forEach((x) => {
      const unite = x.mode === 'kg' ? 'kg' : 'piece';
      c += `${x.nom};${MODES[x.mode].label};${num(x.qte)};${unite};;${(Math.round(x.cout * 100) / 100).toString().replace('.', ',')}\n`;
    });
    const blob = new Blob(['\ufeff' + c], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `commande-patrice-${settings.date_vente}.csv`; a.click();
  };

  return (
    <>
      <div className="vp-section">
        <div className="vp-h2">Récap pour Patrice</div>
        <div className="vp-sub">Quantités cumulées de toutes les commandes. À envoyer après la fermeture.</div>
        {lignes.length === 0 ? (
          <div className="vp-empty">Pas encore de commande à cumuler.</div>
        ) : (
          <>
            <div className="vp-pre" style={{ marginTop: 12 }}>{texte()}</div>
            <div className="vp-grid2" style={{ marginTop: 12 }}>
              <button className="vp-btn green" onClick={async () => { (await copier(texte())) && showToast('Copié — colle dans WhatsApp'); }}>Copier le message</button>
              <button className="vp-btn ghost" onClick={csv}>Télécharger CSV</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Admin : Pesées & notes (recalcul du lendemain) ---------- */
function AdminPesees({ commandes, settings, reload, showToast }) {
  // produits pesés (kg / piece_pesee), regroupés par produit
  const groupes = {};
  commandes.forEach((c) => (c.lignes || []).forEach((l) => {
    if (l.mode_vente === 'piece_fixe') return;
    const k = nomLigne(l);
    if (!groupes[k]) groupes[k] = { nom: k, emoji: l.emoji, lignes: [] };
    groupes[k].lignes.push({ l, client: c.nom_client });
  }));
  const liste = Object.values(groupes);

  // état local des poids saisis : ligneId -> valeur
  const [poids, setPoids] = useState({});

  // signature = id + poids déjà en base, pour réagir aussi à une MAJ de poids
  // (et pas seulement à un changement du nombre de commandes)
  const signature = useMemo(
    () => commandes
      .flatMap((c) => (c.lignes || []).map((l) => `${l.id}:${l.poids_reel ?? ''}`))
      .join('|'),
    [commandes]
  );
  useEffect(() => {
    const init = {};
    commandes.forEach((c) => (c.lignes || []).forEach((l) => {
      if (l.poids_reel != null) init[l.id] = String(l.poids_reel);
    }));
    setPoids((p) => ({ ...init, ...p }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const enregistrer = async () => {
    // 1) maj des lignes pesées
    const updates = [];
    commandes.forEach((c) => (c.lignes || []).forEach((l) => {
      if (l.mode_vente === 'piece_fixe') return;
      const v = poids[l.id];
      if (v === '' || v == null) return;
      const pr = parseFloat(v);
      if (isNaN(pr)) return;
      const st = Math.round(pr * Number(l.prix_william) * 100) / 100;
      updates.push({ id: l.id, poids_reel: pr, sous_total_final: st });
    }));
    for (const u of updates) {
      await supabase.from('viande_commande_lignes')
        .update({ poids_reel: u.poids_reel, sous_total_final: u.sous_total_final }).eq('id', u.id);
    }
    // 2) recalcul total par commande
    for (const c of commandes) {
      const total = (c.lignes || []).reduce((s, l) => {
        const upd = updates.find((u) => u.id === l.id);
        const lcopy = upd ? { ...l, poids_reel: upd.poids_reel } : l;
        return s + sousTotalFinal(lcopy);
      }, 0);
      const tousPeses = (c.lignes || []).every((l) =>
        l.mode_vente === 'piece_fixe' || updates.find((u) => u.id === l.id) || l.poids_reel != null);
      await supabase.from('viande_commandes')
        .update({ total_final: Math.round(total * 100) / 100, statut: tousPeses ? 'finalisee' : 'en_cours' })
        .eq('id', c.id);
    }
    showToast('Poids enregistrés — notes recalculées');
    reload();
  };

  // génération des notes clients
  const noteClient = (c) => {
    let t = `🥩 ${settings.titre} — ${fmtDateCourt(settings.date_vente)}\nNote de ${c.nom_client}\n\n`;
    (c.lignes || []).forEach((l) => {
      const n = nomLigne(l);
      if (l.mode_vente === 'piece_fixe') {
        t += `• ${n} : ${num(l.quantite)} × ${eur(l.prix_william)} = ${eur(l.quantite * l.prix_william)}\n`;
      } else {
        const pr = l.poids_reel;
        if (pr != null) t += `• ${n} : ${num(pr)} kg × ${eur(l.prix_william)} = ${eur(pr * l.prix_william)}\n`;
        else t += `• ${n} : (poids à confirmer)\n`;
      }
    });
    const total = (c.lignes || []).reduce((s, l) => s + sousTotalFinal(l), 0);
    t += `\nTotal : ${eur(total)}\nMerci ! 😊`;
    return t;
  };
  const recapGlobal = () => {
    let t = `🥩 Récap commandes — ${fmtDateCourt(settings.date_vente)}\n\n`;
    let tot = 0;
    commandes.forEach((c) => {
      const v = (c.lignes || []).reduce((s, l) => s + sousTotalFinal(l), 0);
      tot += v; t += `${c.nom_client} : ${eur(v)}\n`;
    });
    t += `\nTotal groupe : ${eur(tot)}`;
    return t;
  };

  return (
    <>
      <div className="vp-section">
        <div className="vp-h2">Pesées du lendemain</div>
        <div className="vp-sub">Saisis le poids réel (kg) de chaque produit pesé d'après la facture de Patrice. Les notes se recalculent automatiquement.</div>
      </div>

      {liste.length === 0 ? (
        <div className="vp-empty">Aucun produit pesé dans les commandes. Tout est à prix fixe.</div>
      ) : (
        <>
          {liste.map((g) => (
            <div className="vp-section" key={g.nom}>
              <div className="vp-h2" style={{ fontSize: 16 }}>{g.emoji} {g.nom}</div>
              {g.lignes.map(({ l, client }) => (
                <div className="vp-wline" key={l.id}>
                  <div className="nm">
                    {client}
                    <small>{l.mode_vente === 'kg' ? `${num(l.quantite)} kg souhaités` : `${num(l.quantite)} pièce(s)`} · {eur(l.prix_william)}/kg</small>
                  </div>
                  <input className="vp-winput" inputMode="decimal" placeholder="kg"
                    value={poids[l.id] ?? ''} onChange={(e) => setPoids((p) => ({ ...p, [l.id]: e.target.value }))} />
                </div>
              ))}
            </div>
          ))}
          <button className="vp-cta" onClick={enregistrer}>Enregistrer les poids & recalculer</button>
        </>
      )}

      {commandes.length > 0 && (
        <div className="vp-section" style={{ marginTop: 14 }}>
          <div className="vp-h2" style={{ fontSize: 16 }}>Notes à envoyer</div>
          <button className="vp-btn green sm" style={{ marginTop: 10 }}
            onClick={async () => { (await copier(recapGlobal())) && showToast('Récap global copié'); }}>
            Copier le récap global
          </button>
          <div style={{ marginTop: 12 }}>
            {commandes.map((c) => (
              <div className="vp-srow" key={c.id} style={{ padding: '8px 0', borderBottom: '1px dotted var(--line)' }}>
                <span>{c.nom_client} <span className="vp-pill">{c.total_final != null ? eur(c.total_final) : `≈ ${eur(c.total_estime)}`}</span></span>
                <button className="vp-btn ghost sm" onClick={async () => { (await copier(noteClient(c))) && showToast(`Note de ${c.nom_client} copiée`); }}>Copier sa note</button>
              </div>
            ))}
          </div>
        </div>
      )}
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
    await supabase.from('viande_settings').update({
      titre: f.titre.trim() || 'Viande Noisy',
      date_vente: todayStr(),
      heure_ouverture: f.heure_ouverture, heure_fermeture: f.heure_fermeture,
      vente_active: f.vente_active, message_accueil: f.message_accueil.trim() || null,
      pin_admin: f.pin_admin.trim() || '0000', marge_defaut: parseFloat(f.marge_defaut) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
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
        <div className="vp-h2" style={{ fontSize: 16 }}>Nouvelle vente</div>
        <div className="vp-sub">Quand la promo est terminée et les notes envoyées, repars sur une base propre.</div>
        <button className="vp-btn ghost" style={{ marginTop: 12 }} onClick={nouvelleVente}>Démarrer une nouvelle vente</button>
      </div>
    </>
  );
}
