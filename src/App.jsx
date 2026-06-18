import React, { useEffect, useMemo, useRef, useState } from 'react';
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
const CATEGORIES = ['Viande', 'Charcuterie', 'Fromage', 'Autre'];
const EMOJIS = ['🥩', '🍖', '🍗', '🥓', '🌭', '🧀', '🍳', '🐔', '🐖', '🐄', '🧺', '🛒'];

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
function fmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  } catch { return d; }
}
function fmtDateCourt(d) {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }
  catch { return d; }
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
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;}
.vp-app{max-width:600px;margin:0 auto;padding:0 14px 120px;}
.vp-admin{max-width:760px;}
h1,h2,h3{font-family:'Bricolage Grotesque','Inter',sans-serif;margin:0;letter-spacing:-.01em;}
button{font-family:inherit;cursor:pointer;border:none}
input,select,textarea{font-family:inherit;font-size:16px}

/* header */
.vp-head{padding:22px 4px 14px;}
.vp-kicker{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.vp-title{font-size:30px;font-weight:800;line-height:1.05;margin-top:4px}
.vp-date{color:var(--muted);font-size:14px;margin-top:6px;text-transform:capitalize}
.vp-status{display:inline-flex;align-items:center;gap:7px;margin-top:14px;padding:8px 14px;
  border-radius:999px;font-size:13px;font-weight:600}
.vp-open{background:var(--green-s);color:var(--green)}
.vp-closed{background:var(--red-s);color:var(--wine)}
.vp-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.vp-note{margin-top:14px;background:#FFF8EC;border:1px solid #F1DFBC;color:#7A5A20;
  padding:11px 14px;border-radius:12px;font-size:13.5px;line-height:1.5}

/* catégorie + produit */
.vp-cat{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  color:var(--muted);margin:24px 4px 10px}
.vp-prod{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
  padding:14px;display:flex;gap:13px;align-items:center;margin-bottom:10px;box-shadow:var(--shadow)}
.vp-emoji{font-size:30px;line-height:1;width:46px;height:46px;display:grid;place-items:center;
  background:var(--paper);border-radius:12px;flex:0 0 auto}
.vp-pinfo{flex:1;min-width:0}
.vp-pname{font-weight:700;font-size:16px}
.vp-pmeta{color:var(--muted);font-size:13px;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap}
.vp-tag{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:1px 7px;font-size:11.5px}
.vp-price{font-weight:800;color:var(--wine);white-space:nowrap}

/* stepper */
.vp-step{display:flex;align-items:center;gap:0;flex:0 0 auto}
.vp-step button{width:34px;height:34px;border-radius:9px;background:var(--paper);
  border:1px solid var(--line);font-size:19px;font-weight:700;color:var(--wine);
  display:grid;place-items:center}
.vp-step button:active{transform:scale(.94)}
.vp-qty{min-width:46px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums}
.vp-add{background:var(--wine);color:#fff;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px}
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
.vp-tabs{display:flex;gap:6px;overflow-x:auto;padding:14px 0 10px;position:sticky;top:0;
  background:var(--paper);z-index:5;-webkit-overflow-scrolling:touch}
.vp-tabs::-webkit-scrollbar{display:none}
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

  // état d'ouverture
  const fermetureAt = useMemo(() => {
    if (!settings) return null;
    try { return new Date(`${settings.date_vente}T${settings.heure_fermeture}:00`).getTime(); }
    catch { return null; }
  }, [settings]);
  const ouvert = settings?.vente_active && (!fermetureAt || now < fermetureAt);

  if (!supabase) return <SetupScreen />;
  if (!settings) return <div className="vp-app"><div className="vp-empty">Chargement…</div></div>;

  return (
    <>
      <style>{CSS}</style>
      {toast && <div className="vp-toast">{toast}</div>}
      {view === 'admin' ? (
        <Admin
          settings={settings} produits={produits} now={now}
          fermetureAt={fermetureAt} ouvert={ouvert}
          reload={loadBase} showToast={showToast}
        />
      ) : (
        <Client
          settings={settings} produits={produits} now={now}
          fermetureAt={fermetureAt} ouvert={ouvert} showToast={showToast}
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
function Countdown({ fermetureAt, now, ouvert }) {
  if (!fermetureAt) return null;
  const reste = fermetureAt - now;
  if (!ouvert) return <span className="vp-status vp-closed"><span className="vp-dot" />Commandes fermées</span>;
  const h = Math.floor(reste / 3600000);
  const m = Math.floor((reste % 3600000) / 60000);
  const txt = h > 0 ? `Fermeture dans ${h}h${String(m).padStart(2, '0')}` : `Fermeture dans ${m} min`;
  return <span className="vp-status vp-open"><span className="vp-dot" />{txt}</span>;
}

/* ============================================================
   CLIENT — interface de commande
============================================================ */
function Client({ settings, produits, now, fermetureAt, ouvert, showToast }) {
  const [cart, setCart] = useState({}); // id -> quantite
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [done, setDone] = useState(null);

  const dispo = produits.filter((p) => p.disponible);
  const cats = CATEGORIES.filter((c) => dispo.some((p) => p.categorie === c));

  const setQty = (p, q) => {
    const min = 0;
    const step = MODES[p.mode_vente].decimal ? 0.25 : 1;
    let v = Math.max(min, Math.round(q / step) * step);
    v = Math.round(v * 100) / 100;
    setCart((c) => { const n = { ...c }; if (v <= 0) delete n[p.id]; else n[p.id] = v; return n; });
  };

  const lignes = Object.entries(cart)
    .map(([id, q]) => { const p = produits.find((x) => x.id === id); return p ? { p, q } : null; })
    .filter(Boolean);
  const total = lignes.reduce((s, { p, q }) => s + sousTotal(p.mode_vente, q, p.prix_william, p.poids_moyen), 0);
  const aDuPese = lignes.some(({ p }) => MODES[p.mode_vente].pese);

  const envoyer = async () => {
    if (!nom.trim()) { showToast('Indique ton prénom'); return; }
    if (lignes.length === 0) { showToast('Ton panier est vide'); return; }
    setEnvoi(true);
    try {
      const totalPatrice = lignes.reduce(
        (s, { p, q }) => s + sousTotal(p.mode_vente, q, p.prix_patrice, p.poids_moyen), 0);
      const { data: cmd, error } = await supabase.from('viande_commandes').insert({
        nom_client: nom.trim(), telephone: tel.trim() || null, note: note.trim() || null,
        total_estime: Math.round(total * 100) / 100,
        total_patrice: Math.round(totalPatrice * 100) / 100,
        date_vente: settings.date_vente,
      }).select().single();
      if (error) throw error;
      const rows = lignes.map(({ p, q }) => ({
        commande_id: cmd.id, produit_id: p.id, produit_nom: p.nom, mode_vente: p.mode_vente,
        emoji: p.emoji, prix_patrice: p.prix_patrice, prix_william: p.prix_william,
        poids_moyen: p.poids_moyen, quantite: q,
        sous_total_estime: Math.round(sousTotal(p.mode_vente, q, p.prix_william, p.poids_moyen) * 100) / 100,
      }));
      const { error: e2 } = await supabase.from('viande_commande_lignes').insert(rows);
      if (e2) throw e2;
      setDone({ nom: nom.trim(), total, aDuPese });
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
    <div className="vp-app">
      <div className="vp-head">
        <div className="vp-kicker">Promo du voisin</div>
        <h1 className="vp-title">{settings.titre}</h1>
        <div className="vp-date">{fmtDate(settings.date_vente)}</div>
        <Countdown fermetureAt={fermetureAt} now={now} ouvert={ouvert} />
        {settings.message_accueil && <div className="vp-note">{settings.message_accueil}</div>}
      </div>

      {!ouvert ? (
        <div className="vp-empty">Les commandes sont fermées pour le moment. Reviens à la prochaine promo&nbsp;!</div>
      ) : dispo.length === 0 ? (
        <div className="vp-empty">Aucun produit pour l'instant.</div>
      ) : (
        cats.map((cat) => (
          <div key={cat}>
            <div className="vp-cat">{cat}</div>
            {dispo.filter((p) => p.categorie === cat).map((p) => {
              const m = MODES[p.mode_vente];
              const q = cart[p.id] || 0;
              return (
                <div className="vp-prod" key={p.id}>
                  <div className="vp-emoji">{p.emoji}</div>
                  <div className="vp-pinfo">
                    <div className="vp-pname">{p.nom}</div>
                    <div className="vp-pmeta">
                      <span className="vp-tag">{m.label}</span>
                      {p.mode_vente === 'piece_pesee' && p.poids_moyen
                        ? <span>≈ {num(p.poids_moyen)} kg/pièce</span> : null}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className="vp-price">{eur(p.prix_william)} {m.prixUnite}</span>
                    </div>
                  </div>
                  <div className="vp-step">
                    {q > 0 && <button onClick={() => setQty(p, q - (m.decimal ? 0.25 : 1))}>−</button>}
                    {q > 0 && <span className="vp-qty">{num(q)}{m.decimal ? '' : ''}</span>}
                    {q > 0 && <button onClick={() => setQty(p, q + (m.decimal ? 0.25 : 1))}>+</button>}
                    {q <= 0 && <button className="vp-add" onClick={() => setQty(p, m.decimal ? 0.5 : 1)}>Ajouter</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {ouvert && lignes.length > 0 && (
        <>
          <div className="vp-ticket">
            <div className="vp-th">Ton panier</div>
            {lignes.map(({ p, q }) => {
              const m = MODES[p.mode_vente];
              const st = sousTotal(p.mode_vente, q, p.prix_william, p.poids_moyen);
              const detail =
                p.mode_vente === 'kg' ? `${num(q)} kg × ${eur(p.prix_william)}`
                : p.mode_vente === 'piece_pesee' ? `${num(q)} pièce(s) · prix au poids réel`
                : `${num(q)} × ${eur(p.prix_william)}`;
              return (
                <div className="vp-line" key={p.id}>
                  <span className="l">{p.emoji} {p.nom}<small>{detail}</small></span>
                  <span className="r">{m.pese && p.mode_vente === 'piece_pesee' ? '≈ ' : ''}{eur(st)}</span>
                </div>
              );
            })}
            <div className="vp-tot"><span>Total estimé</span><span className="r">{eur(total)}</span></div>
            {aDuPese && <div className="vp-mini">≈ Les montants au kilo sont des estimations. Le prix final sera calculé au poids réel.</div>}
            <button className="vp-trash" onClick={() => setCart({})}>Vider le panier</button>
          </div>

          <div style={{ marginTop: 4 }}>
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
        </>
      )}

      <div className="vp-foot">
        <button onClick={() => { window.location.hash = 'admin'; }}>Espace organisateur</button>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN
============================================================ */
function Admin({ settings, produits, now, fermetureAt, ouvert, reload, showToast }) {
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
      <div className="vp-tabs">
        {TABS.map(([k, lbl]) => (
          <button key={k} className={`vp-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{lbl}</button>
        ))}
      </div>

      {tab === 'commandes' && <AdminCommandes commandes={commandes} ouvert={ouvert} reload={loadCommandes} showToast={showToast} />}
      {tab === 'produits' && <AdminProduits produits={produits} settings={settings} reload={reload} showToast={showToast} />}
      {tab === 'export' && <AdminExport commandes={commandes} produits={produits} settings={settings} showToast={showToast} />}
      {tab === 'pesees' && <AdminPesees commandes={commandes} settings={settings} reload={loadCommandes} showToast={showToast} />}
      {tab === 'reglages' && <AdminReglages settings={settings} commandes={commandes} reload={reload} showToast={showToast} />}

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
                  <span>{l.emoji} {l.produit_nom} <span className="vp-pill">{q}</span></span>
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
  const vide = { nom: '', categorie: 'Viande', mode_vente: 'piece_fixe', prix_patrice: '', prix_william: '', poids_moyen: '', emoji: '🥩', disponible: true, ordre: produits.length + 1 };
  const [form, setForm] = useState(null);

  const ouvrirNouveau = () => setForm({ ...vide, ordre: produits.length + 1 });
  const ouvrirEdit = (p) => setForm({ ...p, prix_patrice: String(p.prix_patrice ?? ''), prix_william: String(p.prix_william ?? ''), poids_moyen: p.poids_moyen != null ? String(p.poids_moyen) : '' });

  const appliquerMarge = () => {
    const base = parseFloat(form.prix_patrice);
    if (isNaN(base)) return;
    const w = Math.round(base * (1 + Number(settings.marge_defaut) / 100) * 100) / 100;
    setForm((f) => ({ ...f, prix_william: String(w) }));
  };

  const enregistrer = async () => {
    if (!form.nom.trim()) { showToast('Nom requis'); return; }
    const payload = {
      nom: form.nom.trim(), categorie: form.categorie, mode_vente: form.mode_vente,
      prix_patrice: parseFloat(form.prix_patrice) || 0, prix_william: parseFloat(form.prix_william) || 0,
      poids_moyen: form.mode_vente === 'piece_pesee' ? (parseFloat(form.poids_moyen) || null) : null,
      emoji: form.emoji, disponible: form.disponible, ordre: Number(form.ordre) || 0,
    };
    if (form.id) await supabase.from('viande_produits').update(payload).eq('id', form.id);
    else await supabase.from('viande_produits').insert(payload);
    setForm(null); reload(); showToast('Produit enregistré');
  };
  const supprimer = async (p) => {
    if (!window.confirm(`Supprimer « ${p.nom} » ?`)) return;
    await supabase.from('viande_produits').delete().eq('id', p.id);
    reload(); showToast('Produit supprimé');
  };
  const toggleDispo = async (p) => {
    await supabase.from('viande_produits').update({ disponible: !p.disponible }).eq('id', p.id);
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
          <label className="vp-label">Emoji</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setForm({ ...form, emoji: e })}
                style={{ fontSize: 22, padding: 6, borderRadius: 9, background: form.emoji === e ? 'var(--wine)' : 'var(--paper)', border: '1px solid var(--line)' }}>{e}</button>
            ))}
          </div>
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

  return (
    <>
      <div className="vp-section vp-srow">
        <div><div className="vp-h2">Produits</div><div className="vp-sub">{produits.length} au catalogue</div></div>
        <button className="vp-btn" onClick={ouvrirNouveau}>+ Ajouter</button>
      </div>
      {produits.length === 0 ? (
        <div className="vp-empty">Aucun produit. Ajoute les promos de Patrice.</div>
      ) : produits.map((p) => {
        const m = MODES[p.mode_vente];
        const mg = p.prix_patrice > 0 ? Math.round((p.prix_william / p.prix_patrice - 1) * 100) : 0;
        return (
          <div className="vp-cmd" key={p.id}>
            <div className="vp-srow">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                <span style={{ fontSize: 24 }}>{p.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{p.nom}</div>
                  <div className="vp-sub">
                    {m.label} · Patrice {eur(p.prix_patrice)} → toi {eur(p.prix_william)} {m.prixUnite}
                    {p.prix_patrice > 0 && <span className="vp-marge"> · +{mg}%</span>}
                  </div>
                </div>
              </div>
              <div className={`vp-toggle ${p.disponible ? 'on' : ''}`} onClick={() => toggleDispo(p)} />
            </div>
            <div className="vp-grid2" style={{ marginTop: 10 }}>
              <button className="vp-btn ghost sm" onClick={() => ouvrirEdit(p)}>Modifier</button>
              <button className="vp-btn ghost sm" onClick={() => supprimer(p)}>Supprimer</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ---------- Admin : Export Patrice ---------- */
function AdminExport({ commandes, produits, settings, showToast }) {
  // agrégation par produit
  const agg = {};
  commandes.forEach((c) => (c.lignes || []).forEach((l) => {
    if (!agg[l.produit_nom]) agg[l.produit_nom] = { nom: l.produit_nom, emoji: l.emoji, mode: l.mode_vente, qte: 0, cout: 0 };
    agg[l.produit_nom].qte += Number(l.quantite || 0);
    agg[l.produit_nom].cout += sousTotal(l.mode_vente, l.quantite, l.prix_patrice, l.poids_moyen);
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
    if (!groupes[l.produit_nom]) groupes[l.produit_nom] = { nom: l.produit_nom, emoji: l.emoji, lignes: [] };
    groupes[l.produit_nom].lignes.push({ l, client: c.nom_client });
  }));
  const liste = Object.values(groupes);

  // état local des poids saisis : ligneId -> valeur
  const [poids, setPoids] = useState({});
  useEffect(() => {
    const init = {};
    commandes.forEach((c) => (c.lignes || []).forEach((l) => {
      if (l.poids_reel != null) init[l.id] = String(l.poids_reel);
    }));
    setPoids((p) => ({ ...init, ...p }));
  }, [commandes.length]);

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
      if (l.mode_vente === 'piece_fixe') {
        t += `• ${l.produit_nom} : ${num(l.quantite)} × ${eur(l.prix_william)} = ${eur(l.quantite * l.prix_william)}\n`;
      } else {
        const pr = l.poids_reel;
        if (pr != null) t += `• ${l.produit_nom} : ${num(pr)} kg × ${eur(l.prix_william)} = ${eur(pr * l.prix_william)}\n`;
        else t += `• ${l.produit_nom} : (poids à confirmer)\n`;
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
function AdminReglages({ settings, commandes, reload, showToast }) {
  const [f, setF] = useState({
    titre: settings.titre, date_vente: settings.date_vente, heure_fermeture: settings.heure_fermeture,
    vente_active: settings.vente_active, message_accueil: settings.message_accueil || '',
    pin_admin: settings.pin_admin, marge_defaut: String(settings.marge_defaut),
  });

  const sauver = async () => {
    await supabase.from('viande_settings').update({
      titre: f.titre.trim() || 'Promo viande', date_vente: f.date_vente, heure_fermeture: f.heure_fermeture,
      vente_active: f.vente_active, message_accueil: f.message_accueil.trim() || null,
      pin_admin: f.pin_admin.trim() || '0000', marge_defaut: parseFloat(f.marge_defaut) || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    reload(); showToast('Réglages enregistrés');
  };

  const nouvelleVente = async () => {
    if (!window.confirm('Démarrer une NOUVELLE vente ? Cela supprime toutes les commandes en cours (les produits sont conservés).')) return;
    await supabase.from('viande_commandes').delete().eq('date_vente', settings.date_vente);
    await supabase.from('viande_settings').update({
      date_vente: new Date().toISOString().slice(0, 10), vente_active: true,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setF((x) => ({ ...x, date_vente: new Date().toISOString().slice(0, 10), vente_active: true }));
    reload(); showToast('Nouvelle vente prête');
  };

  return (
    <>
      <div className="vp-section">
        <div className="vp-srow">
          <div><div className="vp-h2">Vente en cours</div><div className="vp-sub">Ouvre ou ferme les commandes manuellement.</div></div>
          <div className={`vp-toggle ${f.vente_active ? 'on' : ''}`} onClick={() => setF({ ...f, vente_active: !f.vente_active })} />
        </div>
      </div>

      <div className="vp-section">
        <label className="vp-label">Titre de la vente</label>
        <input className="vp-input" value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder="Ex : Promo du week-end" />

        <div className="vp-grid2" style={{ marginTop: 12 }}>
          <div>
            <label className="vp-label">Date</label>
            <input className="vp-input" type="date" value={f.date_vente} onChange={(e) => setF({ ...f, date_vente: e.target.value })} />
          </div>
          <div>
            <label className="vp-label">Heure de fermeture</label>
            <input className="vp-input" type="time" value={f.heure_fermeture} onChange={(e) => setF({ ...f, heure_fermeture: e.target.value })} />
          </div>
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

