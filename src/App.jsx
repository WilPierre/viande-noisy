import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from './supabase';

const RESTAURANT = 'Noisy en Fête';
const stripePromise = loadStripe('pk_live_51TYLfRCdBcuJvSgRIp89A5ClD2gaO1vyBsuKRlZ5Hm23XzHkRmIyg2rW3EPrtEdkqKbcoXZDc0bnqnogl5ZXR0Kc00Ei1hUxSg');

// ─── CSS ──────────────────────────────────────────────────────────────────────
const VISUAL_THEMES = {
  light: {
    '--bg':        '#FAFAF8',
    '--surface':   '#FFFFFF',
    '--surface2':  '#F0FFF4',
    '--text':      '#0A0A0A',
    '--text2':     '#888888',
    '--accent':    '#0B3D0B',
    '--accent2':   '#00C553',
    '--accent3':   '#E8FFE8',
    '--border':    '#EEEBE3',
    '--success':   '#00C553',
    '--error':     '#DC2626',
    '--info':      '#2563EB',
    '--gold':      '#FFD54F',
  },
  dark: {
    '--bg':        '#0A0A0A',
    '--surface':   '#141414',
    '--surface2':  '#0B3D0B',
    '--text':      '#F5F5F5',
    '--text2':     '#888888',
    '--accent':    '#00C553',
    '--accent2':   '#38FF14',
    '--accent3':   '#0B3D0B',
    '--border':    '#222222',
    '--success':   '#22C55E',
    '--error':     '#EF4444',
    '--info':      '#60A5FA',
    '--gold':      '#FFD54F',
  }
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@300;400;500;600;700;800&display=swap');

  :root {
    --bg: #FAFAF8; --surface: #FFFFFF; --surface2: #F0FFF4;
    --text: #0A0A0A; --text2: #888888;
    --accent: #0B3D0B; --accent2: #00C553; --accent3: #E8FFE8;
    --border: #EEEBE3; --success: #00C553; --error: #DC2626;
    --info: #2563EB; --gold: #FFD54F;
    --r: 10px; --r2: 14px; --r3: 20px;
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Montserrat', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* ── NAV ── */
  .nav {
    background: #0A0A0A;
    height: 56px;
    padding: 0 1.25rem;
    display: flex; align-items: center; gap: 0.5rem;
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .nav-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 1.2rem;
    color: #fff;
    letter-spacing: 0.05em;
    margin-right: auto;
    display: flex; align-items: center; gap: 0.6rem;
  }

  .nav-btn {
    height: 32px; padding: 0 0.8rem;
    border-radius: var(--r); border: none;
    cursor: pointer;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.82rem; font-weight: 600;
    transition: all 0.15s var(--ease);
    display: flex; align-items: center; gap: 0.3rem;
  }

  .nav-btn.active { background: var(--accent2); color: #fff; }
  .nav-btn:not(.active) { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.45); }
  .nav-btn:not(.active):hover { background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.8); }

  .theme-switcher {
    display: flex; background: rgba(255,255,255,0.08);
    border-radius: var(--r); padding: 3px; gap: 2px;
  }
  .theme-switch-btn {
    width: 28px; height: 26px; border-radius: 7px; border: none;
    cursor: pointer; font-size: 0.85rem;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s var(--ease); background: transparent;
  }
  .theme-switch-btn.active { background: rgba(255,255,255,0.15); }

  /* ── CLIENT ── */
  .client-wrap { max-width: 480px; margin: 0 auto; padding: 0 0 6rem; }

  /* Badge emplacement option E */
  .table-badge {
    display: inline-flex; align-items: center; gap: 10px;
    background: var(--surface);
    padding: 10px 18px; border-radius: var(--r2);
    box-shadow: 0 2px 16px rgba(0,0,0,0.08);
    border: 1px solid var(--border);
    margin: 1.25rem 1.5rem 1.5rem;
  }
  .table-badge-icon {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--accent3);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .table-badge-label { font-size: 10px; color: var(--text2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; line-height: 1; }
  .table-badge-num { font-size: 17px; font-weight: 800; color: var(--accent); letter-spacing: -0.5px; line-height: 1.2; margin-top: 1px; }

  /* TABLE SELECTOR */
  .table-select-wrap { max-width: 400px; margin: 0 auto; padding: 1.5rem 1.25rem 2rem; text-align: center; }
  .table-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.45rem; margin-top: 1.25rem; }
  .table-btn {
    padding: 0.65rem 0.25rem;
    border-radius: var(--r); border: 1.5px solid var(--border);
    background: var(--surface); cursor: pointer;
    font-family: 'Montserrat', sans-serif;
    font-size: 1rem; font-weight: 700; color: var(--text);
    transition: all 0.15s var(--ease);
    display: flex; align-items: center; justify-content: center;
  }
  .table-btn:hover {
    background: var(--accent); color: #fff; border-color: var(--accent);
    transform: scale(1.04);
  }
  .table-btn:active { transform: scale(0.97); }

  /* CATEGORIES */
  .category-tabs {
    display: flex; flex-wrap: wrap; gap: 0.4rem;
    padding: 0 1.25rem 1rem;
  }
  .category-tabs::-webkit-scrollbar { display: none; }
  .cat-tab {
    padding: 0.45rem 1rem; border-radius: 100px;
    border: 1.5px solid var(--border); background: var(--surface);
    font-size: 0.78rem; font-weight: 600; cursor: pointer;
    white-space: nowrap; transition: all 0.15s var(--ease);
    font-family: 'Montserrat', sans-serif; color: var(--text2); flex-shrink: 0;
  }
  .cat-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .cat-tab:not(.active):hover { border-color: var(--accent); color: var(--accent); }

  /* SECTION LABEL */
  .menu-section-label {
    font-size: 0.68rem; font-weight: 700; color: var(--text2);
    text-transform: uppercase; letter-spacing: 0.08em;
    padding: 0 1.25rem; margin-bottom: 0.6rem;
  }

  /* MENU ITEMS */
  .menu-grid { display: flex; flex-direction: column; padding: 0 1rem; gap: 0.5rem; }

  .menu-item {
    background: var(--surface);
    border-radius: var(--r2); border: 1px solid var(--border);
    padding: 0.85rem 1rem; display: flex; align-items: center; gap: 0.9rem;
    transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
    position: relative; overflow: hidden;
  }
  .menu-item:hover { border-color: var(--accent2); box-shadow: 0 2px 12px rgba(0,197,83,0.1); }
  .menu-item::before { display: none; }

  .item-emoji {
    width: 52px; height: 52px; border-radius: var(--r);
    background: var(--accent3); display: flex; align-items: center;
    justify-content: center; font-size: 1.6rem; flex-shrink: 0;
    overflow: hidden;
  }
  .item-emoji img { width: 100%; height: 100%; object-fit: cover; }

  .item-info { flex: 1; min-width: 0; }
  .item-name { font-size: 0.9rem; font-weight: 700; color: var(--text); letter-spacing: -0.2px; line-height: 1.3; }
  .item-desc { font-size: 0.72rem; color: var(--text2); margin-top: 0.15rem; line-height: 1.3; }
  .item-price { font-size: 0.92rem; font-weight: 800; color: var(--accent); margin-top: 0.25rem; letter-spacing: -0.3px; }

  /* Article avec photo en carte */
  .menu-item-card {
    background: var(--surface); border-radius: var(--r2);
    border: 1px solid var(--border); overflow: hidden;
    transition: box-shadow 0.15s var(--ease);
  }
  .menu-item-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .menu-item-card-img {
    width: 100%; height: 130px; background: var(--accent3);
    display: flex; align-items: center; justify-content: center;
    font-size: 3.5rem; position: relative; overflow: hidden;
  }
  .menu-item-card-img img { width: 100%; height: 100%; object-fit: cover; }
  .menu-item-card-price {
    position: absolute; top: 8px; right: 8px;
    background: var(--accent); color: #fff;
    border-radius: 100px; padding: 3px 10px;
    font-size: 0.8rem; font-weight: 800; letter-spacing: -0.2px;
    font-family: 'Bebas Neue', sans-serif; font-size: 0.95rem;
  }
  .menu-item-card-body {
    padding: 0.75rem 1rem; display: flex;
    align-items: center; justify-content: space-between; gap: 1rem;
  }

  /* QTY */
  .qty-ctrl { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .qty-btn {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 1.1rem; font-weight: 400;
    transition: all 0.15s var(--ease); line-height: 1;
  }
  .qty-btn-minus { border: 1.5px solid var(--border); background: var(--bg); color: var(--text); }
  .qty-btn-minus:hover { border-color: var(--accent); color: var(--accent); }
  .qty-btn-plus { border: none; background: var(--accent); color: #fff; }
  .qty-btn-plus:hover { background: var(--accent2); transform: scale(1.08); }
  .qty-num { width: 22px; text-align: center; font-weight: 800; font-size: 0.95rem; color: var(--text); letter-spacing: -0.2px; }

  /* ── CART BAR ── */
  .cart-bar {
    position: fixed; bottom: 1.1rem; left: 50%; transform: translateX(-50%);
    background: var(--accent3); border: 1.5px solid var(--accent2);
    border-radius: var(--r2); padding: 0.85rem 1.25rem;
    width: calc(100% - 2rem); max-width: 440px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer; transition: all 0.2s var(--ease); z-index: 50;
    box-shadow: 0 4px 24px rgba(0,197,83,0.2);
  }
  .cart-bar:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 8px 32px rgba(0,197,83,0.3); }
  .cart-count {
    background: var(--accent); color: #fff; border-radius: 50%;
    width: 28px; height: 28px; display: flex; align-items: center;
    justify-content: center; font-weight: 800; font-size: 0.82rem;
  }
  .cart-total { font-size: 1rem; font-weight: 800; color: var(--accent); letter-spacing: -0.3px; }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    backdrop-filter: blur(8px); display: flex; align-items: flex-end;
    z-index: 200; animation: fadeIn 0.2s;
  }
  @keyframes fadeIn { from { opacity: 0; } }
  .modal {
    background: var(--bg); border-radius: var(--r3) var(--r3) 0 0;
    width: 100%; max-width: 480px; margin: 0 auto;
    padding: 1.25rem 1.5rem 2rem; max-height: 88vh; overflow-y: auto;
    animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  @keyframes slideUp { from { transform: translateY(100%); } }
  .modal-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 1.25rem; }
  .modal-title { font-size: 1.1rem; font-weight: 800; margin-bottom: 1rem; color: var(--text); letter-spacing: -0.3px; }
  .cart-line {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.65rem 0; border-bottom: 1px solid var(--border);
    font-size: 0.88rem; color: var(--text); gap: 1rem;
  }
  .cart-total-line {
    display: flex; justify-content: space-between;
    font-weight: 800; font-size: 1rem; padding: 0.85rem 0;
    border-top: 2px solid var(--text); color: var(--text); letter-spacing: -0.2px;
  }

  /* ── PAYMENT ── */
  .payment-section { margin-top: 1.25rem; }
  .payment-title { font-size: 0.72rem; font-weight: 700; color: var(--text2); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .card-element-wrap { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r); padding: 0.9rem 1rem; transition: border-color 0.15s; }
  .card-element-wrap:focus-within { border-color: var(--accent2); }
  .card-icons { display: flex; gap: 0.4rem; margin-bottom: 0.5rem; }
  .card-icon { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.12rem 0.45rem; font-size: 0.68rem; font-weight: 700; color: var(--text2); }
  .pay-btn {
    width: 100%; padding: 1rem; background: var(--accent); color: #fff;
    border: none; border-radius: var(--r); font-size: 0.92rem; font-weight: 700;
    cursor: pointer; margin-top: 1rem; font-family: 'Montserrat', sans-serif;
    transition: all 0.15s var(--ease); letter-spacing: -0.2px;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .pay-btn:hover:not(:disabled) { background: var(--accent2); transform: translateY(-1px); }
  .pay-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .pay-error { font-size: 0.82rem; margin-top: 0.5rem; padding: 0.6rem 0.8rem; background: #FEF2F2; border-radius: var(--r); color: var(--error); border-left: 3px solid var(--error); }
  .secure-badge { display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-size: 0.7rem; color: var(--text2); margin-top: 0.6rem; }

  /* ── SUCCESS ── */
  .success-box { text-align: center; padding: 3rem 1.5rem; }
  .success-icon { font-size: 3rem; margin-bottom: 1rem; animation: bounceIn 0.5s; }
  @keyframes confettiFall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(720deg); opacity: 0.9; } }
  @keyframes mascotDance { 0%,100% { transform: rotate(-8deg) translateY(0); } 50% { transform: rotate(8deg) translateY(-10px); } }
  @keyframes mascotFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
  @keyframes mascotSleep { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes cartBump { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
  @keyframes qtyPop { 0% { transform: scale(1); } 50% { transform: scale(1.5); } 100% { transform: scale(1); } }
  @keyframes flyUp { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-60px) scale(1.4); } }
  @keyframes bounceIn { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
  .success-title { font-size: 1.4rem; font-weight: 800; margin-bottom: 0.4rem; color: var(--text); letter-spacing: -0.3px; }
  .success-sub { color: var(--text2); font-size: 0.88rem; line-height: 1.7; }
  .new-order-btn {
    display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1.25rem;
    padding: 0.75rem 1.5rem; background: var(--accent); color: #fff;
    border: none; border-radius: var(--r); font-size: 0.88rem; font-weight: 700;
    cursor: pointer; font-family: 'Montserrat', sans-serif; transition: all 0.15s; letter-spacing: -0.2px;
  }
  .new-order-btn:hover { background: var(--accent2); transform: translateY(-1px); }

  /* ── KITCHEN ── */
  .kitchen-wrap { padding: 1.5rem; }
  .view-title { font-size: 1.5rem; font-weight: 800; color: var(--text); letter-spacing: -0.4px; line-height: 1; font-family: 'Bebas Neue', sans-serif; font-size: 2rem; letter-spacing: 0.05em; }
  .view-sub { color: var(--text2); font-size: 0.82rem; margin-top: 0.3rem; margin-bottom: 1.5rem; }
  .orders-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .order-card { background: var(--surface); border-radius: var(--r2); padding: 1.1rem; border: 1.5px solid var(--border); transition: box-shadow 0.15s; animation: cardIn 0.4s cubic-bezier(0.32,0.72,0,1); }
  @keyframes cardIn { from { opacity: 0; transform: translateY(10px); } }
  .order-card.attente { border-left: 4px solid #F59E0B; }
  .order-card.preparation { border-left: 4px solid var(--info); }
  .order-card.pret { border-left: 4px solid var(--success); box-shadow: 0 4px 20px rgba(0,197,83,0.15); }
  .order-card.urgent { animation: cardIn 0.4s, urgentPulse 2s ease-in-out infinite 0.4s; }
  @keyframes urgentPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); } 50% { box-shadow: 0 0 0 6px rgba(220,38,38,0.12); } }
  .order-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.7rem; }
  .order-table { font-size: 1rem; font-weight: 800; color: var(--text); letter-spacing: -0.3px; }
  .order-id { color: var(--text2); font-size: 0.7rem; margin-top: 0.1rem; }
  .status-badge { padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .badge-attente { background: #FEF3C7; color: #92400E; }
  .badge-preparation { background: #DBEAFE; color: #1E40AF; }
  .badge-pret { background: #DCFCE7; color: #166534; }
  .paid-badge { background: #DCFCE7; color: #166534; font-size: 0.62rem; padding: 0.12rem 0.45rem; border-radius: 100px; font-weight: 700; }
  .order-items { margin-bottom: 0.85rem; }
  .order-item-line { font-size: 0.83rem; padding: 0.28rem 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; color: var(--text); }
  .order-item-line:last-child { border-bottom: none; }
  .order-time { font-size: 0.7rem; color: var(--text2); margin-bottom: 0.7rem; }
  .status-btns { display: flex; gap: 0.45rem; }
  .status-btn { flex: 1; padding: 0.55rem; border-radius: var(--r); border: 1.5px solid var(--border); cursor: pointer; font-size: 0.76rem; font-weight: 700; transition: all 0.15s; font-family: 'Montserrat', sans-serif; background: var(--bg); color: var(--text); }
  .status-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
  .status-btn.done { background: var(--success); color: #fff; border-color: var(--success); }

  /* ── EMPTY ── */
  .empty-state { text-align: center; padding: 5rem 2rem; color: var(--text2); }
  .empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.4; }
  .pulse { animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

  /* ── ADMIN ── */
  .admin-wrap { padding: 1.5rem; max-width: 760px; }
  .admin-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.7rem; margin-bottom: 1.5rem; }
  .stat-card { background: var(--surface); border-radius: var(--r2); padding: 1.1rem; border: 1.5px solid var(--border); transition: box-shadow 0.15s; }
  .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
  .stat-num { font-family: 'Bebas Neue', sans-serif; font-size: 2.2rem; color: var(--accent2); letter-spacing: 0.02em; line-height: 1; }
  .stat-label { font-size: 0.7rem; color: var(--text2); margin-top: 0.25rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .section-title { font-size: 0.95rem; font-weight: 700; margin: 1.5rem 0 0.7rem; color: var(--text); letter-spacing: -0.2px; }
  .menu-admin-item { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r); padding: 0.8rem 1rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem 0.7rem; margin-bottom: 0.4rem; transition: border-color 0.15s; }
  .menu-admin-item .menu-admin-info { flex: 1 1 120px; min-width: 100px; }
  .menu-admin-item:hover { border-color: var(--accent2); }
  .menu-admin-info { flex: 1; }
  .menu-admin-name { font-weight: 700; font-size: 0.88rem; color: var(--text); letter-spacing: -0.2px; }
  .menu-admin-cat { font-size: 0.68rem; color: var(--text2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.1rem; }
  .menu-admin-price { font-weight: 800; color: var(--accent); font-size: 0.9rem; margin-right: 0.4rem; letter-spacing: -0.2px; }
  .avail-toggle { padding: 0.2rem 0.6rem; border-radius: 100px; border: 1.5px solid var(--border); font-size: 0.68rem; cursor: pointer; font-family: 'Montserrat', sans-serif; font-weight: 700; transition: all 0.15s; background: var(--bg); }
  .avail-toggle.on { background: #DCFCE7; color: #166534; border-color: #BBF7D0; }
  .avail-toggle.off { background: #FEF2F2; color: #991B1B; border-color: #FECACA; }
  .del-btn { padding: 0.28rem 0.55rem; background: transparent; border: 1.5px solid var(--border); border-radius: var(--r); cursor: pointer; font-size: 0.76rem; color: var(--text2); transition: all 0.15s; }
  .del-btn:hover { background: var(--error); color: #fff; border-color: var(--error); }
  .add-item-form { background: var(--surface2); border-radius: var(--r2); padding: 1.1rem; border: 1.5px solid var(--border); margin-top: 1rem; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; margin-bottom: 0.7rem; }
  .form-field { display: flex; flex-direction: column; gap: 0.28rem; }
  .form-field label { font-size: 0.68rem; color: var(--text2); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  .form-field input, .form-field select, .form-field textarea { padding: 0.55rem 0.75rem; border: 1.5px solid var(--border); border-radius: var(--r); font-family: 'Montserrat', sans-serif; font-size: 0.88rem; background: var(--bg); transition: border-color 0.15s; outline: none; color: var(--text); font-weight: 500; }
  .form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: var(--accent2); }
  .add-btn { padding: 0.6rem 1.2rem; background: var(--accent); color: #fff; border: none; border-radius: var(--r); cursor: pointer; font-weight: 700; font-family: 'Montserrat', sans-serif; font-size: 0.85rem; transition: all 0.15s; letter-spacing: -0.2px; }
  .add-btn:hover { background: var(--accent2); transform: translateY(-1px); }
  .qr-section { background: var(--surface); border-radius: var(--r2); padding: 1.5rem; border: 1.5px solid var(--border); margin-top: 1rem; text-align: center; }
  .qr-url { font-size: 0.7rem; color: var(--text2); margin-top: 0.5rem; word-break: break-all; font-family: monospace; }
  .print-btn { padding: 0.6rem 1.4rem; background: var(--accent); color: #fff; border: none; border-radius: var(--r); cursor: pointer; font-weight: 700; font-family: 'Montserrat', sans-serif; margin-top: 1rem; font-size: 0.85rem; transition: all 0.15s; }
  .print-btn:hover { background: var(--accent2); }

  @media print { .nav, .admin-wrap > *:not(.qr-section) { display: none !important; } }
  @media (max-width: 480px) { .admin-grid { grid-template-columns: 1fr 1fr; } .form-row { grid-template-columns: 1fr; } }
`;

// ─── STRIPE PAYMENT FORM ──────────────────────────────────────────────────────
function PaymentForm({ totalPrice, tableNum, cartItems, comment, consigneAmount, consigneLiquide, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState('');

  const [tipNef, setTipNef] = useState(0);
  const [customTipNef, setCustomTipNef] = useState('');
  const paySettings = useSettings();
  const apeActive = paySettings.don_ape_active !== 'false';
  const nefActive = paySettings.don_nef_active === 'true';

  const tipAmount = !apeActive ? 0 : (customTip !== '' ? Math.max(0, parseFloat(customTip) || 0) : tip);
  const tipNefAmount = !nefActive ? 0 : (customTipNef !== '' ? Math.max(0, parseFloat(customTipNef) || 0) : tipNef);
  const consignePayee = consigneAmount > 0 && !consigneLiquide ? consigneAmount : 0;
  const grandTotal = totalPrice + tipAmount + tipNefAmount + consignePayee;

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setError('');
    setPaying(true);
    try {
      const { data: order, error: dbErr } = await supabase
        .from('orders')
        .insert({ table_num: tableNum, items: cartItems, total: totalPrice, tip: tipAmount, ...(tipNefAmount > 0 ? { tip_nef: tipNefAmount } : {}), comment: comment || '', consigne: consigneAmount || 0, consigne_liquide: consigneLiquide || false, paid: false, status: 'en attente paiement' })
        .select().single();
      if (dbErr) throw new Error('Erreur base de données');

      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(grandTotal * 100), orderId: order.id, tableNum }),
      });
      const { clientSecret, error: apiErr } = await res.json();
      if (apiErr) throw new Error(apiErr);

      const { error: stripeErr } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (stripeErr) throw new Error(stripeErr.message);

      await supabase.from('orders').update({ paid: true, status: 'en attente' }).eq('id', order.id);
      onSuccess(order.id);
    } catch (err) {
      setError(err.message);
    }
    setPaying(false);
  };

  const tipOptions = [0, 1, 2, 5];

  const renderDon = (title, subtitle, value, setValue, custom, setCustom, merci) => {
    const amount = custom !== '' ? Math.max(0, parseFloat(custom) || 0) : value;
    return (
      <div style={{ marginBottom: '1rem', background: 'var(--surface)', borderRadius: 12, padding: '0.9rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text2)', marginBottom: '0.6rem', lineHeight: 1.4 }}>{subtitle}</div>
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {tipOptions.map(t => (
            <button key={t} onClick={() => { setValue(t); setCustom(''); }}
              style={{
                flex: 1, minWidth: 48, padding: '0.45rem 0.3rem', borderRadius: 8, cursor: 'pointer',
                border: value === t && custom === '' ? '2px solid var(--gold)' : '1.5px solid var(--border)',
                background: value === t && custom === '' ? '#FFF8EE' : 'white',
                fontWeight: 600, fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s'
              }}>
              {t === 0 ? 'Non' : `${t} €`}
            </button>
          ))}
          <input type="number" placeholder="Autre €" value={custom}
            onChange={e => { setCustom(e.target.value); setValue(0); }}
            style={{
              flex: 1, minWidth: 64, padding: '0.45rem 0.5rem', borderRadius: 8, textAlign: 'center',
              border: custom !== '' ? '2px solid var(--gold)' : '1.5px solid var(--border)',
              background: custom !== '' ? '#FFF8EE' : 'white',
              fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', outline: 'none'
            }} />
        </div>
        {amount > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--green)', fontWeight: 500 }}>
            ❤️ Merci pour votre don de {amount.toFixed(2)} € {merci} !
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="payment-section">
      {/* DONS */}
      {apeActive && renderDon('🎒 Faire un don à l\u2019A.P.E des écoles de Noisy ?', '100% reversé à l\u2019association des parents d\u2019élèves', tip, setTip, customTip, setCustomTip, 'à l\u2019A.P.E')}
      {nefActive && renderDon('🎉 Faire un don à Noisy en Fête ?', 'Pour aider l\u2019association à organiser les prochains événements', tipNef, setTipNef, customTipNef, setCustomTipNef, 'à Noisy en Fête')}

      <div className="payment-title">💳 Paiement sécurisé par carte</div>
      <div className="card-icons">
        <span className="card-icon">VISA</span>
        <span className="card-icon">MC</span>
        <span className="card-icon">CB</span>
      </div>
      <div className="card-element-wrap">
        <CardElement options={{
          style: {
            base: { fontSize: '16px', color: '#1A1208', fontFamily: 'DM Sans, sans-serif', '::placeholder': { color: '#8A7F72' } },
            invalid: { color: '#8B2020' },
          },
          hidePostalCode: true,
        }} />
      </div>
      {error && <div className="pay-error">⚠️ {error}</div>}
      {consigneAmount > 0 && (
        <div style={{ background: '#FFF8EE', border: '1px solid #C8953A', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.75rem', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>🍺 Consigne verre{consigneAmount > 1 ? 's' : ''} : {consigneAmount.toFixed(2)} €</div>
          <div style={{ color: '#666', lineHeight: 1.5 }}>
            {consigneLiquide
              ? '💵 À régler en liquide à la caisse — rendue au retour du verre'
              : '💳 Incluse dans le paiement CB — rendue en liquide au retour du verre'}
          </div>
        </div>
      )}
      <button className="pay-btn" onClick={handlePay} disabled={paying || !stripe}>
        {paying ? '⏳ Traitement...' : `🔒 Payer ${grandTotal.toFixed(2)} €`}
      </button>
      <div className="secure-badge">🔒 Paiement sécurisé par Stripe — vos données sont chiffrées</div>
    </div>
  );
}

// ─── TABLE SELECTOR ───────────────────────────────────────────────────────────
function TableSelector({ onSelect, welcomeMsg, installPrompt, appInstalled, setAppInstalled, isClosed = false }) {
  const tsettings = useSettings();
  const tablesCount = Math.min(200, Math.max(1, parseInt(tsettings.tables_count) || 28));
  let tableNames = {};
  try { tableNames = JSON.parse(tsettings.tables_names || '{}') || {}; } catch (e) { tableNames = {}; }
  return (
    <div className="table-select-wrap" style={{ position: 'relative' }}>
      <img src="/logo.png" alt="Noisy en Fête" style={{ width: '140px', maxWidth: '55vw', margin: '0 auto 1.2rem', display: 'block', filter: 'drop-shadow(0 8px 24px rgba(200,149,58,0.3))' }} />

      {/* Bandeau fermé */}
      {isClosed && (
        <div style={{
          background: 'linear-gradient(135deg, #0B3D0B, #00C553)',
          borderRadius: 14, padding: '1.1rem 1.25rem',
          marginBottom: '1.25rem', textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,197,83,0.25)',
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>🦄</div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', marginBottom: '0.3rem', letterSpacing: '-0.2px' }}>
            Commandes fermées pour le moment
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
            L&apos;app sera disponible lors du prochain événement Noisy en Fête.<br />
            Revenez nous voir bientôt ! 🎉
          </div>
        </div>
      )}

      {!isClosed && welcomeMsg && (
        <div style={{
          background: 'linear-gradient(135deg, var(--gold), var(--accent2))',
          color: '#000', borderRadius: 12,
          padding: '0.75rem 1rem', marginBottom: '1.2rem', fontSize: '0.88rem',
          fontWeight: 600, lineHeight: 1.5, boxShadow: '0 4px 16px rgba(200,149,58,0.3)'
        }}>🎉 {welcomeMsg}</div>
      )}

      <div style={{ fontSize: "1.5rem", color: 'var(--text)', fontWeight: 800, letterSpacing: '-0.03em', opacity: isClosed ? 0.35 : 1 }}>Votre emplacement</div>
      <p style={{ color: "var(--text2)", fontSize: "0.85rem", marginTop: "0.3rem", fontWeight: 400, opacity: isClosed ? 0.35 : 1 }}>
        {isClosed ? 'Disponible lors du prochain événement' : 'Choisissez votre numéro ci-dessous'}
      </p>

      {!isClosed && (
        <>
          <button onClick={() => onSelect('Comptoir')} style={{
            width: '100%', marginTop: '1rem', marginBottom: '0.25rem',
            padding: '0.85rem 1rem', background: 'var(--accent3)',
            border: '2px solid var(--accent2)', borderRadius: 'var(--r2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.95rem',
            color: 'var(--accent)', transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: '1.2rem' }}>🍺</span>
            Je commande au comptoir
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.85rem 0 0.1rem', color: 'var(--text2)', fontSize: '0.75rem', fontWeight: 500 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            ou choisissez votre emplacement
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
        </>
      )}

      <div className="table-grid" style={{ opacity: isClosed ? 0.2 : 1, pointerEvents: isClosed ? 'none' : 'auto', marginTop: isClosed ? '0.75rem' : undefined }}>
        {Array.from({ length: tablesCount }, (_, i) => i + 1).map(n => (
          <button key={n} className="table-btn" onClick={() => onSelect(n)}
            style={tableNames[n] ? { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1, gap: 2 } : undefined}>
            <span>{n}</span>
            {tableNames[n] && <span style={{ fontSize: '0.55rem', fontWeight: 600, opacity: 0.75, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{tableNames[n]}</span>}
          </button>
        ))}
      </div>

      {isClosed && (
        <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text2)', fontWeight: 500 }}>
          🔒 Commandes désactivées
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATION HELPER ──────────────────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

// ─── NOTIFICATION BANNER ──────────────────────────────────────────────────────
function NotificationBanner({ onAccept, onDecline }) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isIOS && !isStandalone) {
    return (
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1rem 1.1rem', margin: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🍎</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.3rem' }}>
              Notifications sur iPhone
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)', lineHeight: 1.5, marginBottom: '0.6rem' }}>
              Ajoutez ce site à votre écran d&apos;accueil pour être alerté quand votre commande est prête :
            </div>
            {[['1','Appuyez sur ⬆️ Partager en bas de Safari'],['2',"Choisissez \"Sur l\'écran d\'accueil\""],['3',"Rouvrez l\'app depuis l\'écran d\'accueil"]].map(([n,t]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.62rem', flexShrink: 0 }}>{n}</div>
                {t}
              </div>
            ))}
            <button onClick={onDecline} style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
              Continuer sans notification
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '0.9rem 1.1rem', margin: '0.75rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ fontSize: '1.3rem' }}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text)' }}>Être notifié quand c&apos;est prêt ?</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.1rem' }}>Alerte dès que votre commande est prête</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <button onClick={onAccept} style={{ padding: '0.4rem 0.85rem', borderRadius: 8, border: 'none', background: 'var(--text)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Activer</button>
          <button onClick={onDecline} style={{ padding: '0.3rem 0.85rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem' }}>Non merci</button>
        </div>
      </div>
    </div>
  );
}

// ─── THEME SYSTEM ────────────────────────────────────────────────────────────
const THEMES = {
  'Classique': {
    '--cream': '#FAF7F2', '--dark': '#1A1208', '--gold': '#C8953A',
    '--gold-light': '#E8B96A', '--green': '#2D5016', '--red': '#8B2020',
    '--warm-gray': '#8A7F72', '--border': '#E8E0D4', '--blue': '#1A4E7A',
  },
  'Nuit': {
    '--cream': '#1A1A2E', '--dark': '#E0E0E0', '--gold': '#F0C040',
    '--gold-light': '#FFD700', '--green': '#4CAF50', '--red': '#EF5350',
    '--warm-gray': '#9E9E9E', '--border': '#333355', '--blue': '#42A5F5',
  },
  'Nature': {
    '--cream': '#F1F8E9', '--dark': '#1B5E20', '--gold': '#558B2F',
    '--gold-light': '#7CB342', '--green': '#2E7D32', '--red': '#C62828',
    '--warm-gray': '#6D8C54', '--border': '#C8E6C9', '--blue': '#0277BD',
  },
  'Océan': {
    '--cream': '#E3F2FD', '--dark': '#0D47A1', '--gold': '#0288D1',
    '--gold-light': '#29B6F6', '--green': '#00695C', '--red': '#D32F2F',
    '--warm-gray': '#546E7A', '--border': '#BBDEFB', '--blue': '#01579B',
  },
  'Fête': {
    '--cream': '#FFF0F5', '--dark': '#880E4F', '--gold': '#E91E63',
    '--gold-light': '#F48FB1', '--green': '#388E3C', '--red': '#B71C1C',
    '--warm-gray': '#AD6988', '--border': '#F8BBD9', '--blue': '#7B1FA2',
  },
  'Automne': {
    '--cream': '#FFF8F0', '--dark': '#3E1F00', '--gold': '#E65100',
    '--gold-light': '#FF8F00', '--green': '#33691E', '--red': '#B71C1C',
    '--warm-gray': '#8D6E63', '--border': '#FFE0B2', '--blue': '#1565C0',
  },
};

function useTheme() {
  const settings = useSettings();

  useEffect(() => {
    const themeName = settings.theme_name || 'Classique';
    const base = THEMES[themeName] || THEMES['Classique'];
    let custom = {};
    try { custom = JSON.parse(settings.theme_custom || '{}'); } catch(e) {}
    const merged = { ...base, ...custom };
    Object.entries(merged).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }, [settings.theme_name, settings.theme_custom]);
}

// ─── SETTINGS STORE (singleton global) ───────────────────────────────────────
const _settingsStore = {
  data: { welcome: '', closing_time: '22:00', closed: 'false', urgent_active: 'false', urgent_msg: '', tracking_active: 'false', fidelite_active: 'false', loyalty_active: 'false', theme_name: 'Classique', theme_custom: '{}', event_name: 'Noisy en Fête' },
  listeners: new Set(),
  channel: null,
  loaded: false,

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  notify() { this.listeners.forEach(fn => fn({ ...this.data })); if (this.data.staff_pin) STAFF_PIN = this.data.staff_pin; },

  async load() {
    const { data } = await supabase.from('settings').select('*');
    if (data) { data.forEach(r => { this.data[r.key] = r.value; }); this.loaded = true; this.notify(); }
  },

  startRealtime() {
    if (this.channel) return;
    this.channel = supabase.channel('settings-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => this.load())
      .subscribe();
  }
};

// Charger au démarrage
_settingsStore.load().then(() => {
  const storedPin = _settingsStore.data.staff_pin;
  if (storedPin && storedPin.length >= 4 && /^\d+$/.test(storedPin)) {
    STAFF_PIN = storedPin;
  }
});
_settingsStore.startRealtime();

function useSettings() {
  const [settings, setSettings] = useState({ ..._settingsStore.data });
  useEffect(() => {
    setSettings({ ..._settingsStore.data });
    return _settingsStore.subscribe(s => setSettings({ ...s }));
  }, []);
  return settings;
}

async function saveSetting(key, value) {
  const { data, error } = await supabase.from('settings').update({ value }).eq('key', key).select();
  if (error || !data || data.length === 0) {
    const { error: e2 } = await supabase.from('settings').insert({ key, value });
    if (e2) { console.error('saveSetting', key, e2); alert('Erreur de sauvegarde (' + key + ') : ' + e2.message); }
  }
}

async function sendUrgentMessage(msg) {
  await saveSetting('urgent_msg', msg);
  await saveSetting('urgent_active', 'true');
}

// ─── CLOSED BANNER ───────────────────────────────────────────────────────────
function ClosedBanner({ closingTime }) {
  return (
    <div style={{
      background: 'var(--text)', color: 'white', textAlign: 'center',
      padding: '3rem 1.5rem', minHeight: '60vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>
        Les commandes sont fermées
      </div>
      <p style={{ color: 'var(--text2)', fontSize: '0.9rem', maxWidth: 300 }}>
        La prise de commande s&apos;est terminée à {closingTime}.<br />Merci pour votre visite !
      </p>
    </div>
  );
}

// ─── PROMO CODE FIELD ────────────────────────────────────────────────────────
function PromoCodeField({ onApply }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState(false);

  const checkCode = async () => {
    if (!code.trim()) return;
    const { data } = await supabase.from('promos')
      .select('*').eq('code', code.toUpperCase().trim()).eq('active', true).single();

    if (!data) { setStatus('❌ Code invalide ou inactif'); return; }
    if (data.uses >= data.max_uses) { setStatus('❌ Ce code a atteint sa limite d\'utilisation'); return; }

    // Incrémenter le compteur d'utilisations
    await supabase.from('promos').update({ uses: data.uses + 1 }).eq('id', data.id);
    onApply(data.discount);
    setApplied(true);
    setStatus(`✅ Code appliqué ! -${data.discount}% sur votre commande`);
  };

  if (applied) return (
    <div style={{ background: '#D4EDDA', border: '1px solid #C3E6CB', borderRadius: 10, padding: '0.6rem 0.9rem', marginTop: '0.75rem', fontSize: '0.82rem', color: '#155724', fontWeight: 600 }}>
      {status}
    </div>
  );

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '0.4rem' }}>🏷 Code promo</div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && checkCode()}
          placeholder="Ex: MERCI10"
          style={{
            flex: 1, padding: '0.55rem 0.75rem', borderRadius: 8,
            border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.9rem', outline: 'none', background: 'var(--surface)',
            textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em'
          }}
        />
        <button onClick={checkCode} style={{
          padding: '0.55rem 1rem', borderRadius: 8, border: 'none',
          background: 'var(--text)', color: 'white', fontWeight: 600,
          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem'
        }}>Appliquer</button>
      </div>
      {status && !applied && (
        <div style={{ fontSize: '0.78rem', color: 'var(--red)', marginTop: '0.4rem' }}>{status}</div>
      )}
    </div>
  );
}

// ─── GRAND ECRAN TV ──────────────────────────────────────────────────────────
function GrandEcran() {
  const [orders, setOrders] = useState([]);
  const [time, setTime] = useState(new Date());
  const settings = useSettings();
  const nightStats = useNightStats();

  const bgColor = settings.ecran_bg || '#1A1208';
  const numColor = settings.ecran_num_color || '#C8953A';
  const textColor = settings.ecran_text_color || '#FFFFFF';
  const bgOpacity = parseFloat(settings.ecran_bg_opacity || '0.15');
  const bgImage = settings.ecran_bg_image || '';
  const eventName = settings.event_name || 'Noisy en Fête';

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('*').eq('paid', true).in('status', ['prêt']).order('created_at', { ascending: true });
    if (data) setOrders(data);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('ecran-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: bgColor, color: textColor, padding: '2rem', fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* Image de fond */}
      {bgImage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: bgOpacity
        }} />
      )}

      {/* Contenu */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: `2px solid ${numColor}40`, paddingBottom: '1rem' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.2rem', color: numColor }}>🎉 {eventName}</div>
            <div style={{ color: `${textColor}99`, fontSize: '0.9rem', marginTop: '0.2rem' }}>Commandes prêtes à récupérer au stand</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.8rem', color: numColor }}>
              {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ color: `${textColor}66`, fontSize: '0.8rem' }}>
              {time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>

        <ChallengeBar big />

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: `${textColor}44` }}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>👨‍🍳</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: `${textColor}66` }}>Les commandes arrivent...</div>
            <div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Aucune commande prête pour le moment</div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div style={{ fontSize: '1.2rem', color: `${textColor}cc` }}>
                🔔 {orders.length} commande{orders.length > 1 ? 's' : ''} prête{orders.length > 1 ? 's' : ''} — Venez récupérer au stand !
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
              {orders.map(order => (
                <div key={order.id} style={{
                  background: numColor, borderRadius: 24, padding: '2.5rem 1.5rem',
                  textAlign: 'center', animation: 'pulse 2s infinite',
                  boxShadow: `0 0 40px ${numColor}66`
                }}>
                  <div style={{ fontSize: '1rem', color: bgColor, marginBottom: '0.3rem', fontWeight: 600, opacity: 0.7 }}>Emplacement</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '5rem', color: bgColor, fontWeight: 900, lineHeight: 1 }}>
                    {order.table_num}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: bgColor, marginTop: '0.5rem', opacity: 0.5 }}>#{order.id}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {settings.ecran_ranking !== 'false' && nightStats.ranking.length > 0 && (
          <div style={{ marginTop: '3rem', paddingBottom: '3rem' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: numColor, marginBottom: '0.8rem' }}>🏆 Classement des tables</div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {nightStats.ranking.map(([t, amt], i) => (
                <div key={t} style={{ background: `${textColor}12`, border: `2px solid ${i === 0 ? numColor : textColor + '22'}`, borderRadius: 16, padding: '0.9rem 1.4rem', minWidth: 140, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem' }}>{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Emplacement {t}</div>
                  <div style={{ color: `${textColor}99`, fontSize: '0.95rem' }}>{Math.round(amt)} € dépensés</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(nightStats.donApe > 0 && settings.don_ape_active !== 'false') || (nightStats.donNef > 0 && settings.don_nef_active === 'true') ? (
          <div style={{ textAlign: 'center', fontSize: '1.3rem', marginBottom: '3rem', color: numColor, fontWeight: 700 }}>
            {nightStats.donApe > 0 && settings.don_ape_active !== 'false' && <span style={{ marginRight: '2rem' }}>🎒 {nightStats.donApe.toFixed(0)} € déjà récoltés pour l'A.P.E !</span>}
            {nightStats.donNef > 0 && settings.don_nef_active === 'true' && <span>🎉 {nightStats.donNef.toFixed(0)} € pour Noisy en Fête !</span>}
          </div>
        ) : null}

        <div style={{ position: 'fixed', bottom: '1rem', left: 0, right: 0, textAlign: 'center', color: `${textColor}22`, fontSize: '0.75rem' }}>
          🔴 Diffusion en direct • noisy-en-fete.vercel.app
        </div>
      </div>
    </div>
  );
}

// ─── FUN : confettis, son, mascotte, messages ────────────────────────────────
function Confetti({ duration = 4500 }) {
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), duration); return () => clearTimeout(t); }, [duration]);
  const pieces = useState(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 1.2, dur: 2.5 + Math.random() * 2,
    size: 7 + Math.random() * 7, color: ['#00C553', '#C8953A', '#FF5E7E', '#3B82F6', '#FACC15', '#A855F7'][i % 6],
    round: Math.random() > 0.5,
  })))[0];
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', top: 0, left: p.left + '%', width: p.size, height: p.size * (p.round ? 1 : 0.5),
          background: p.color, borderRadius: p.round ? '50%' : 2,
          animation: `confettiFall ${p.dur}s ${p.delay}s linear forwards`, opacity: 0,
        }} />
      ))}
    </div>
  );
}

let _audioCtx = null;
function playChime(kind = 'ready') {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!_audioCtx) _audioCtx = new AC();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    if (kind === 'silent') return;
    const notes = kind === 'kitchen' ? [880, 660, 880, 660] : [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.32);
    });
  } catch (e) {}
}
function soundEnabled() { try { return localStorage.getItem('nef_sound') !== 'off'; } catch (e) { return true; } }
function setSoundEnabled(v) { try { localStorage.setItem('nef_sound', v ? 'on' : 'off'); } catch (e) {} }

function Mascot({ mood = 'wait', size = '3.4rem' }) {
  const mset = useSettings();
  const hat = (EVENT_THEMES[mset.event_theme || 'none'] || {}).hat;
  const anim = mood === 'dance' ? 'mascotDance 0.7s ease-in-out infinite'
    : mood === 'sleep' ? 'mascotSleep 3s ease-in-out infinite'
    : 'mascotFloat 2s ease-in-out infinite';
  return (
    <div style={{ position: 'relative', display: 'inline-block', fontSize: size, animation: anim, lineHeight: 1 }}>
      🦄
      {hat && <span style={{ position: 'absolute', top: -14, left: -6, fontSize: '1.4rem' }}>{hat}</span>}
      {mood === 'sleep' && <span style={{ position: 'absolute', top: -6, right: -14, fontSize: '1rem' }}>💤</span>}
      {mood === 'dance' && <span style={{ position: 'absolute', top: -8, right: -18, fontSize: '1.2rem' }}>🎶</span>}
      {mood === 'work' && <span style={{ position: 'absolute', top: -8, right: -16, fontSize: '1.1rem' }}>🍳</span>}
    </div>
  );
}

const FUN_MESSAGES = {
  received: [
    ['Commande reçue !', 'Les bénévoles ont reçu ton message, ils s’y mettent !'],
    ['C’est noté !', 'Ta commande est dans les mains de l’équipe 🙌'],
    ['Top, on a ça !', 'Tiens bon, ça arrive bientôt !'],
  ],
  preparing: [
    ['Ça mijote…', 'Nos bénévoles sont à fond sur ta commande 🔥'],
    ['En cuisine !', 'Les petites mains s’activent pour toi 👨‍🍳'],
    ['Ça chauffe !', 'Encore un peu de patience, ça sent bon !'],
  ],
  ready: [
    ['C’est prêt, fonce !', '🎪 Viens récupérer ta commande au stand'],
    ['Ta commande t’attend !', '🎉 Elle est chaude, elle est belle, viens la chercher'],
    ['À table !', '🍻 Ta commande est prête au stand'],
  ],
  done: [
    ['Bonne dégustation !', 'Merci d’être là, tu fais vivre la fête 💚'],
    ['Régale-toi !', 'Merci et à très vite pour la prochaine !'],
  ],
};
function pickFun(kind, seed) { const a = FUN_MESSAGES[kind]; return a[Math.abs(seed || 0) % a.length]; }

// ─── THÈMES ÉVÉNEMENT ────────────────────────────────────────────────────────
const EVENT_THEMES = {
  none:      { label: 'Aucun (classique)', emoji: '', hat: '', title: '' },
  halloween: { label: '🎃 Halloween', emoji: '🎃', hat: '🎃', title: 'Soirée Halloween',
    light: { '--accent': '#4A1D7A', '--accent2': '#FF7A00', '--accent3': '#FFF1E0', '--surface2': '#FFF1E0', '--gold': '#FF9F1C' },
    dark:  { '--accent': '#FF7A00', '--accent2': '#FFB347', '--accent3': '#2A1245', '--surface2': '#2A1245', '--gold': '#FF9F1C' } },
  noel:      { label: '🎄 Noël', emoji: '🎄', hat: '🎅', title: 'Fête de Noël',
    light: { '--accent': '#8B0000', '--accent2': '#16A34A', '--accent3': '#FDECEC', '--surface2': '#FDECEC', '--gold': '#FACC15' },
    dark:  { '--accent': '#EF4444', '--accent2': '#4ADE80', '--accent3': '#3A0A0A', '--surface2': '#3A0A0A', '--gold': '#FACC15' } },
  ete:       { label: '☀️ Fête d’été', emoji: '🏖️', hat: '😎', title: 'Fête d’été',
    light: { '--accent': '#0369A1', '--accent2': '#F59E0B', '--accent3': '#FEF3C7', '--surface2': '#FEF3C7', '--gold': '#FBBF24' },
    dark:  { '--accent': '#38BDF8', '--accent2': '#FBBF24', '--accent3': '#0C2A3D', '--surface2': '#0C2A3D', '--gold': '#FBBF24' } },
  annees80:  { label: '🕺 Années 80', emoji: '🪩', hat: '🕶️', title: 'Soirée Années 80',
    light: { '--accent': '#6D28D9', '--accent2': '#EC4899', '--accent3': '#FDF2F8', '--surface2': '#FDF2F8', '--gold': '#22D3EE' },
    dark:  { '--accent': '#C084FC', '--accent2': '#F472B6', '--accent3': '#2A0A3D', '--surface2': '#2A0A3D', '--gold': '#22D3EE' } },
};

function EventBanner() {
  const settings = useSettings();
  const t = EVENT_THEMES[settings.event_theme || 'none'];
  if (!t || !t.emoji) return null;
  return (
    <div style={{ textAlign: 'center', padding: '0.45rem 1rem', fontSize: '0.8rem', fontWeight: 700, background: 'var(--accent3)', color: 'var(--accent)', letterSpacing: '0.02em' }}>
      {t.emoji} {t.title} {t.emoji}
    </div>
  );
}

// ─── STATS DE LA SOIRÉE (défi + classement + dons) ───────────────────────────
function useNightStats() {
  const settings = useSettings();
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('orders').select('*').eq('paid', true).order('created_at', { ascending: false }).limit(1000);
      if (alive && data) setOrders(data);
    };
    load();
    const ch = supabase.channel('night-stats-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load).subscribe();
    const poll = setInterval(load, 30000);
    return () => { alive = false; supabase.removeChannel(ch); clearInterval(poll); };
  }, []);
  const todayStr = new Date().toDateString();
  const today = orders.filter(o => new Date(o.created_at).toDateString() === todayStr);
  const start = settings.challenge_start ? new Date(settings.challenge_start) : null;
  const challengeOrders = today.filter(o => !start || new Date(o.created_at) >= start);
  const challengeCount = challengeOrders.reduce((s, o) => s + (o.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0), 0);
  const byTable = {};
  today.forEach(o => { if (o.table_num > 0) byTable[o.table_num] = (byTable[o.table_num] || 0) + Number(o.total || 0); });
  const ranking = Object.entries(byTable).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const donApe = today.reduce((s, o) => s + Number(o.tip || 0), 0);
  const donNef = today.reduce((s, o) => s + Number(o.tip_nef || 0), 0);
  return { challengeCount, ranking, donApe, donNef };
}

function ChallengeBar({ big = false }) {
  const settings = useSettings();
  const { challengeCount } = useNightStats();
  if (settings.challenge_active !== 'true') return null;
  const goal = Math.max(1, parseInt(settings.challenge_goal) || 100);
  const pct = Math.min(100, Math.round((challengeCount / goal) * 100));
  const reached = challengeCount >= goal;
  return (
    <div style={{
      margin: big ? '0 0 1.5rem' : '0.75rem 1.25rem', padding: big ? '1.2rem 1.5rem' : '0.8rem 1rem', borderRadius: 16,
      background: reached ? 'linear-gradient(135deg,#00C553,#FFD54F)' : (big ? 'rgba(255,255,255,0.08)' : 'var(--surface)'),
      border: big ? '2px solid rgba(255,255,255,0.18)' : '1.5px solid var(--border)', color: reached ? '#0A0A0A' : (big ? 'inherit' : 'var(--text)'),
    }}>
      {reached && <Confetti key={settings.challenge_start || 'c'} duration={6000} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: big ? '1.5rem' : '0.88rem' }}>🎯 {settings.challenge_label || 'Défi de la soirée'}</div>
        <div style={{ fontWeight: 800, fontSize: big ? '1.5rem' : '0.88rem' }}>{Math.min(challengeCount, goal)} / {goal}</div>
      </div>
      <div style={{ height: big ? 22 : 12, borderRadius: 20, background: 'rgba(128,128,128,0.25)', margin: '0.5rem 0', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', borderRadius: 20, background: reached ? '#0A0A0A' : 'linear-gradient(90deg,#00C553,#FFD54F)', transition: 'width 1s ease' }} />
      </div>
      <div style={{ fontSize: big ? '1.05rem' : '0.74rem', fontWeight: 600, opacity: 0.9 }}>
        {reached ? `🎉 Objectif atteint ! ${settings.challenge_reward || ''}` : `🎁 ${settings.challenge_reward || 'Une surprise pour tout le monde !'} — plus que ${goal - challengeCount} !`}
      </div>
    </div>
  );
}

// ─── ORDER TRACKING ──────────────────────────────────────────────────────────
function OrderTracking({ orderId, tableNum, onNewOrder }) {
  const [order, setOrder] = useState(null);
  const [soundOn, setSoundOn] = useState(soundEnabled());
  const [confettiKey, setConfettiKey] = useState(1);
  const prevStatusRef = useState({ current: null })[0];
  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current !== null && prevStatusRef.current !== order.status) {
      if (order.status === 'prêt') { setConfettiKey(k => k + 1); if (soundEnabled()) playChime('ready'); }
    }
    prevStatusRef.current = order.status;
  }, [order && order.status]);

  useEffect(() => {
    if (!orderId) return;

    // Chargement initial
    const fetchOrder = async () => {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (data) setOrder(data);
    };
    fetchOrder();

    // Realtime pour mise à jour instantanée
    const channel = supabase.channel('tracking-' + orderId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`
      }, payload => {
        const prev = order;
        setOrder(payload.new);
        // Notification push client quand commande prête
        if (payload.new.status === 'prêt' && (!prev || prev.status !== 'prêt')) {
          sendNotification(
            '🔔 Votre commande est prête !',
            'Venez récupérer votre commande au stand 🎪'
          );
          // Vibration sur mobile
          if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
        }
      }).subscribe();

    // Polling toutes les 5 secondes en backup (si realtime échoue sur mobile)
    const poll = setInterval(fetchOrder, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [orderId]);

  const [connected, setConnected] = useState(true);

  // Vérifier la connexion
  useEffect(() => {
    const check = setInterval(async () => {
      try {
        await supabase.from('orders').select('id').eq('id', orderId).single();
        setConnected(true);
      } catch { setConnected(false); }
    }, 10000);
    return () => clearInterval(check);
  }, [orderId]);

  if (!order) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="pulse" style={{ color: 'var(--text2)' }}>Chargement...</div>
    </div>
  );

  const steps = [
    { key: 'en attente', label: 'Reçue', icon: '📋' },
    { key: 'en préparation', label: 'En préparation', icon: '👨‍🍳' },
    { key: 'prêt', label: 'Prête !', icon: '✅' },
    { key: 'servi', label: 'Récupérée', icon: '🎉' },
  ];
  const currentIdx = steps.findIndex(s => s.key === order.status);
  const isReady = order.status === 'prêt';
  const isDone = order.status === 'servi';

  const funKind = isReady ? 'ready' : isDone ? 'done' : order.status === 'en préparation' ? 'preparing' : 'received';
  const [funTitle, funSub] = pickFun(funKind, Number(orderId));
  const mascotMood = isReady ? 'dance' : isDone ? 'sleep' : order.status === 'en préparation' ? 'work' : 'wait';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <Confetti key={confettiKey} />
      <UrgentBanner />
      <div style={{ background: 'var(--text)', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <img src="/logo.png" alt="Noisy en Fête" style={{ height: 30, width: 'auto' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem', flex: 1 }}>Noisy en Fête</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Emp. {tableNum} · #{orderId}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: connected ? '#4ADE80' : '#F87171' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#4ADE80' : '#F87171', display: 'inline-block' }} />
          {connected ? 'En direct' : 'Reconnexion...'}
        </span>
      </div>
      <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '1.5rem 1.25rem 2rem' }}>
        <div style={{
          borderRadius: 20, padding: '2rem 1.5rem', textAlign: 'center', marginBottom: '1.5rem',
          background: isReady ? '#DCFCE7' : isDone ? 'var(--surface)' : 'var(--text)',
          color: isReady || isDone ? 'var(--text)' : '#fff',
          transition: 'all 0.5s ease'
        }}>
          <div style={{ marginBottom: '0.9rem' }}><Mascot mood={mascotMood} /></div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.4rem' }}>{funTitle}</div>
          <div style={{ fontSize: '0.82rem', opacity: 0.75 }}>{funSub}</div>
          <button onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); if (v) playChime('ready'); }}
            style={{ marginTop: '0.9rem', background: 'rgba(128,128,128,0.18)', border: 'none', borderRadius: 20, padding: '0.35rem 0.8rem', fontSize: '0.72rem', cursor: 'pointer', color: 'inherit', fontWeight: 600 }}>
            {soundOn ? '🔔 Son activé (toucher pour couper)' : '🔕 Son coupé (toucher pour activer)'}
          </button>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', border: '1.5px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 15, left: '12%', right: '12%', height: 2, background: 'var(--border)', borderRadius: 1 }}>
              <div style={{ width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%`, height: '100%', background: 'var(--text)', borderRadius: 1, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              {steps.map((step, i) => (
                <div key={step.key} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i <= currentIdx ? 'var(--text)' : 'var(--bg)', border: `2px solid ${i <= currentIdx ? 'var(--text)' : 'var(--border)'}`, fontSize: '0.85rem', transition: 'all 0.4s ease' }}>
                    {i <= currentIdx ? step.icon : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />}
                  </div>
                  <div style={{ fontSize: '0.62rem', fontWeight: i === currentIdx ? 700 : 400, color: i <= currentIdx ? 'var(--text)' : 'var(--text2)', lineHeight: 1.3 }}>{step.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '1.1rem', marginBottom: '1.25rem', border: '1.5px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>Votre commande</div>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span>{item.emoji} {item.name} ×{item.qty}</span>
              <span style={{ fontWeight: 600 }}>{(item.price * item.qty).toFixed(2)} €</span>
            </div>
          ))}
          {Number(order.consigne) > 0 && !order.consigne_liquide && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span>🍺 Consigne verre(s)</span><span style={{ fontWeight: 600 }}>{Number(order.consigne).toFixed(2)} €</span>
            </div>
          )}
          {Number(order.tip) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span>🎒 Don A.P.E</span><span style={{ fontWeight: 600 }}>{Number(order.tip).toFixed(2)} €</span>
            </div>
          )}
          {Number(order.tip_nef) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span>🎉 Don Noisy en Fête</span><span style={{ fontWeight: 600 }}>{Number(order.tip_nef).toFixed(2)} €</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, paddingTop: '0.6rem', fontSize: '0.9rem', color: 'var(--text)' }}>
            <span>Total payé</span><span>{(Number(order.total) + Number(order.tip || 0) + Number(order.tip_nef || 0) + (Number(order.consigne) > 0 && !order.consigne_liquide ? Number(order.consigne) : 0)).toFixed(2)} €</span>
          </div>
        </div>

        <button onClick={onNewOrder} style={{ width: '100%', padding: '0.85rem', background: 'var(--accent2)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 16px rgba(200,149,58,0.3)' }}>
          ➕ Passer une nouvelle commande
        </button>
      </div>
    </div>
  );
}

// ─── URGENT BANNER ───────────────────────────────────────────────────────────
function UrgentBanner() {
  const settings = useSettings();
  const [dismissed, setDismissed] = useState(false);

  if (!settings.urgent_active || settings.urgent_active !== 'true') return null;
  if (dismissed) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
      background: 'var(--red)', color: 'white',
      padding: '0.9rem 1.2rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      animation: 'slideDown 0.3s ease'
    }}>
      <style>{`@keyframes slideDown { from { transform: translateY(-100%); } }`}</style>
      <span style={{ fontSize: '1.3rem' }}>⚠️</span>
      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{settings.urgent_msg}</span>
      <button onClick={() => setDismissed(true)} style={{
        background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
        borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.8rem'
      }}>✕ OK</button>
    </div>
  );
}

// ─── RECEIPT EMAIL FORM ──────────────────────────────────────────────────────
function ReceiptEmailForm({ orderId }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email || !email.includes('@')) return;
    setSending(true);
    await supabase.from('orders').update({ receipt_email: email }).eq('id', orderId);
    setSent(true);
    setSending(false);
  };

  if (sent) return (
    <div style={{ background: '#D4EDDA', borderRadius: 12, padding: '0.8rem 1rem', margin: '1rem 0', fontSize: '0.85rem', color: '#155724' }}>
      ✅ Votre ticket a été enregistré pour {email}
    </div>
  );

  return (
    <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1rem', margin: '1.2rem 0', textAlign: 'left' }}>
      <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.3rem' }}>🧾 Recevoir votre ticket de caisse ?</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
        Si vous souhaitez votre ticket, ajoutez votre adresse email ci-dessous.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="votre@email.com"
          style={{
            flex: 1, padding: '0.55rem 0.75rem', borderRadius: 8,
            border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.88rem', outline: 'none', background: 'var(--surface)'
          }}
        />
        <button onClick={handleSend} disabled={sending || !email}
          style={{
            padding: '0.55rem 1rem', borderRadius: 8, border: 'none',
            background: 'var(--text)', color: 'white', fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem',
            opacity: !email ? 0.5 : 1
          }}>
          {sending ? '⏳' : 'Envoyer'}
        </button>
      </div>
    </div>
  );
}

// ─── CLIENT VIEW ──────────────────────────────────────────────────────────────
function ClientView({ installPrompt, appInstalled, setAppInstalled }) {
  const [tableNum, setTableNum] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [activeCategory, setActiveCategory] = useState(null); // null = premier onglet disponible
  const [showCart, setShowCart] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderId, setOrderId] = useState(null);
  const [notifState, setNotifState] = useState('ask');
  const [notified, setNotified] = useState(false);
  const [loyaltyOffers, setLoyaltyOffers] = useState([]);
  const [comment, setComment] = useState('');
  const [selectedExtras, setSelectedExtras] = useState({});
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [consigneLiquide, setConsigneLiquide] = useState(false);


  const settings = useSettings();

  // Vérifier si les commandes sont fermées
  const isClosed = (() => {
    if (settings.closed === 'true') return true;
    if (settings.closed === 'false') return false; // forcé ouvert par l'admin
    const now = new Date();
    const [h, m] = (settings.closing_time || '22:00').split(':').map(Number);
    const closing = new Date(); closing.setHours(h, m, 0, 0);
    return now >= closing;
  })();

  useEffect(() => {
    supabase.from('loyalty_offers').select('*').eq('active', true).then(({ data }) => data && setLoyaltyOffers(data));
    supabase.from('menu').select('*').eq('available', true).order('position', { ascending: true, nullsFirst: false }).then(({ data }) => {
      if (data) setMenu(data);
      setLoading(false);
    });
    const ch = supabase.channel('client-menu-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu' }, (p) => {
        const n = p.new;
        setMenu(m => {
          if (!n.available) return m.filter(i => i.id !== n.id);
          return m.some(i => i.id === n.id) ? m.map(i => i.id === n.id ? { ...i, ...n } : i) : [...m, n].sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
        });
        if (!n.available || (n.stock !== null && n.stock !== undefined)) {
          setCart(c => {
            if (!c[n.id]) return c;
            const max = !n.available ? 0 : n.stock;
            return c[n.id] > max ? { ...c, [n.id]: max } : c;
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!orderId || notifState !== 'accepted') return;
    const channel = supabase.channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        if (payload.new.status === 'prêt' && !notified) {
          sendNotification('🎉 Votre commande est prête !', 'Rendez-vous au comptoir pour la récupérer.');
          setNotified(true);
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [orderId, notifState, notified]);

  const handleAcceptNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifState(granted ? 'accepted' : 'declined');
  };

  const CAT_ORDER = ['Boissons sans alcool', 'Boissons alcoolisées', 'Boissons', 'Entrées', 'Plats', 'Desserts'];
  const categories = [
    ...CAT_ORDER.filter(c => menu.some(i => i.category === c)),
    ...menu.map(i => i.category).filter(c => !CAT_ORDER.includes(c)).filter((c, i, a) => a.indexOf(c) === i),
    'Tous'
  ];
  const activeTab = activeCategory || (categories.length > 0 ? categories[0] : 'Tous');
  const filtered = activeTab === 'Tous' ? menu : menu.filter(i => i.category === activeTab);
  const totalItems = Object.values(cart).reduce((s, q) => s + q, 0);
  const basePrice = menu.reduce((s, item) => s + (cart[item.id] || 0) * item.price, 0);
  const setQty = (id, qty) => setCart(c => {
    const it = menu.find(m => m.id === id);
    const max = it && it.stock !== null && it.stock !== undefined ? it.stock : Infinity;
    return { ...c, [id]: Math.min(max, Math.max(0, qty)) };
  });
  let menuBadges = {}; let menuSuggest = {};
  try { menuBadges = JSON.parse(settings.menu_badges || '{}') || {}; } catch (e) {}
  try { menuSuggest = JSON.parse(settings.menu_suggest || '{}') || {}; } catch (e) {}
  const BADGES = { hot: ['🔥 Le plus commandé', '#FEE2E2', '#B91C1C'], fav: ['⭐ Coup de cœur', '#FEF3C7', '#92400E'], new: ['🆕 Nouveau', '#DBEAFE', '#1D4ED8'] };
  let lastCart = null;
  try { lastCart = JSON.parse(localStorage.getItem('nef_last_cart') || 'null'); } catch (e) {}
  const lastCartValid = lastCart ? Object.entries(lastCart).filter(([id, q]) => menu.some(m => String(m.id) === String(id) && (m.stock === null || m.stock === undefined || m.stock > 0)) && q > 0) : [];
  const repeatLast = () => {
    const next = {};
    lastCartValid.forEach(([id, q]) => { const it = menu.find(m => String(m.id) === String(id)); const max = it.stock === null || it.stock === undefined ? Infinity : it.stock; next[it.id] = Math.min(q, max); });
    setCart(next);
  };
  const suggestions = (() => {
    const out = [];
    Object.keys(cart).forEach(id => {
      if (!(cart[id] > 0)) return;
      const sid = menuSuggest[id];
      const sug = sid && menu.find(m => String(m.id) === String(sid));
      if (sug && !(cart[sug.id] > 0) && (sug.stock === null || sug.stock === undefined || sug.stock > 0) && !out.some(o => o.id === sug.id)) out.push(sug);
    });
    return out;
  })();
  const decrementStock = async (cartNow) => {
    for (const it of menu) {
      const q = cartNow[it.id] || 0;
      if (q > 0 && it.stock !== null && it.stock !== undefined) {
        const { data } = await supabase.from('menu').select('stock').eq('id', it.id).single();
        if (data && data.stock !== null && data.stock !== undefined) {
          const ns = Math.max(0, data.stock - q);
          await supabase.from('menu').update({ stock: ns, available: ns > 0 }).eq('id', it.id);
        }
      }
    }
    const { data: fresh } = await supabase.from('menu').select('*').eq('available', true).order('position', { ascending: true, nullsFirst: false });
    if (fresh) setMenu(fresh);
  };
  const extrasTotal = Object.entries(selectedExtras).reduce((sum, [id, exs]) => {
    const qty = cart[parseInt(id)] || 0;
    return sum + qty * exs.reduce((s, e) => s + Number(e.price), 0);
  }, 0);
  const cartItems = (() => {
    const items = menu.filter(i => cart[i.id] > 0).map(i => ({
      name: i.name, qty: cart[i.id], price: i.price, emoji: i.emoji,
      extras: selectedExtras[i.id] || [], free: 0
    }));
    // Appliquer la fidélité
    const ls = settings;
    // Multi-offres fidélité
    if (loyaltyOffers && loyaltyOffers.length > 0) {
      items.forEach(item => {
        const offer = loyaltyOffers.find(o => o.active && o.product_name === item.name);
        if (offer && item.qty >= offer.every_n + 1) {
          item.free = Math.floor(item.qty / (offer.every_n + 1));
        }
      });
    } else if (ls.loyalty_active === 'true' && ls.loyalty_item && ls.loyalty_every) {
      const every = parseInt(ls.loyalty_every);
      items.forEach(item => {
        if (item.name === ls.loyalty_item && item.qty >= every + 1) {
          item.free = Math.floor(item.qty / (every + 1));
        }
      });
    }
    return items;
  })();

  // Config consigne depuis settings
  const CONSIGNE_PRIX = parseFloat(settings.consigne_prix || '1');
  const CONSIGNE_PRODUITS = (settings.consigne_produits || 'Bière pression 30cl').split(',').map(s => s.trim());
  const consigneQty = cartItems.filter(i => CONSIGNE_PRODUITS.some(p => i.name.toLowerCase().includes(p.toLowerCase()))).reduce((s, i) => s + i.qty, 0);
  const consigneAmount = consigneQty * CONSIGNE_PRIX;

  const loyaltyDiscount = cartItems.reduce((s, i) => s + i.free * i.price, 0);
  const promoAmount = promoDiscount > 0 ? Math.round((basePrice + extrasTotal - loyaltyDiscount) * promoDiscount) / 100 : 0;
  const totalPrice = basePrice + extrasTotal - loyaltyDiscount - promoAmount;
  const [payingCounter, setPayingCounter] = useState(false);
  const payAtCounter = async (method) => {
    if (payingCounter || cartItems.length === 0) return;
    if (!window.confirm('Valider la commande et payer ' + (method === 'cb' ? 'par CARTE' : 'en ESPÈCES') + ' au comptoir ?')) return;
    setPayingCounter(true);
    const { data: order, error } = await supabase.from('orders').insert({
      table_num: tableNum, items: cartItems, total: totalPrice, tip: 0,
      comment: '[COMPTOIR ' + (method === 'cb' ? '💳 CB' : '💵 ESPÈCES') + ' - à encaisser] ' + (comment || ''),
      consigne: consigneAmount || 0, consigne_liquide: true, paid: true, status: 'en attente',
    }).select().single();
    setPayingCounter(false);
    if (error || !order) { alert('Erreur : ' + (error ? error.message : 'commande non enregistrée')); return; }
    try { localStorage.setItem('nef_last_cart', JSON.stringify(cart)); } catch (e) {}
    decrementStock(cart);
    setOrderId(order.id); setSuccess(true); setCart({}); setShowCart(false); setComment(''); setPromoDiscount(0); setConsigneLiquide(false);
  };

  if (!tableNum) return <TableSelector onSelect={isClosed ? () => {} : setTableNum} welcomeMsg={settings.welcome} installPrompt={installPrompt} appInstalled={appInstalled} setAppInstalled={setAppInstalled} isClosed={isClosed} />;

  // Si suivi activé et commande passée → afficher le tracking
  if (success && settings.tracking_active === 'true') return (
    <OrderTracking
      orderId={orderId}
      tableNum={tableNum}
      onNewOrder={() => { setSuccess(false); setCart({}); setOrderId(null); setNotifState('ask'); setNotified(false); }}
    />
  );

  if (success) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--text)', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <img src="/logo.png" alt="Noisy en Fête" style={{ height: 30, width: 'auto' }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>{RESTAURANT}</span>
      </div>
      <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', padding: '2rem 1.25rem 3rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', animation: 'bounceIn 0.5s' }}>
            <span style={{ fontSize: '2.2rem' }}>✅</span>
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: '0.4rem' }}>
            Commande confirmée !
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Paiement accepté · Emplacement {tableNum}
          </p>
          {notifState === 'accepted' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#DCFCE7', color: '#166534', borderRadius: 100, padding: '0.3rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.6rem' }}>
              📳 Notification activée
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: '1.1rem', marginBottom: '1rem', border: '1.5px solid var(--border)' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>
            Votre commande
          </div>
          {cartItems.length > 0 ? cartItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: i < cartItems.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem', color: 'var(--text)' }}>
              <span>{item.emoji} {item.name} ×{item.qty}</span>
              <span style={{ fontWeight: 600 }}>{(item.price * item.qty).toFixed(2)} €</span>
            </div>
          )) : <div style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>Commande enregistrée ✓</div>}
        </div>

        <ReceiptEmailForm orderId={orderId} />
        <FideliteClientForm totalPrice={totalPrice} orderId={orderId} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.25rem' }}>
          <button onClick={() => { setSuccess(false); setCart({}); }}
            style={{ width: '100%', padding: '0.85rem', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            ➕ Commander autre chose
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setSuccess(false); setCart({}); setTableNum(null); setOrderId(null); setNotifState('ask'); setNotified(false); }}
              style={{ flex: 1, padding: '0.75rem', background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              🔄 Changer d&apos;emplacement
            </button>
            <button onClick={() => {
              const text = `Je suis à ${RESTAURANT} ce soir ! 🎉 ${window.location.origin}`;
              if (navigator.share) navigator.share({ title: RESTAURANT, text, url: window.location.origin });
              else { navigator.clipboard.writeText(text); alert('Lien copié !'); }
            }}
              style={{ flex: 1, padding: '0.75rem', background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              📲 Partager
            </button>
          </div>
        </div>
      </div>
    </div>
  );


  return (
    <div className="client-wrap">
      <div style={{ padding: '1.25rem 1.25rem 0.5rem', textAlign: 'center' }}>
        <img src="/logo.png" alt="Noisy en Fête" style={{ height: 140, maxWidth: '55vw', width: 'auto', display: 'block', margin: '0 auto 0.75rem' }} />
      {/* Bouton installation PWA */}
      {installPrompt && !appInstalled && (
        <button onClick={async () => {
          installPrompt.prompt();
          const { outcome } = await installPrompt.userChoice;
          if (outcome === 'accepted') setAppInstalled(true);
        }} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          margin: '0 auto 1rem',
          padding: '0.6rem 1.25rem',
          background: 'linear-gradient(135deg, var(--accent2), #E8B96A)',
          color: '#fff',
          border: 'none',
          borderRadius: 100,
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.85rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(200,149,58,0.4)',
          animation: 'pulse 2s ease-in-out infinite',
          letterSpacing: '-0.01em'
        }}>
          <span style={{ fontSize: '1.1rem' }}>📲</span>
          Installer l&apos;app
        </button>
      )}
        <div className="table-badge" style={{ margin: '0 auto', display: 'inline-flex' }}>
          <div className="table-badge-icon">📍</div>
          <div>
            <div className="table-badge-label">Votre emplacement</div>
            <div className="table-badge-num">N° {tableNum}</div>
          </div>
        </div>
      </div>

      {notifState === 'ask' && (
        <NotificationBanner onAccept={handleAcceptNotif} onDecline={() => setNotifState('declined')} />
      )}
      {notifState === 'accepted' && (
        <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--green)', marginBottom: '0.5rem' }}>
          📳 Notifications activées — vous serez alerté quand votre commande est prête
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="pulse">Chargement du menu...</div></div>
      ) : (
        <>
          <div className="category-tabs">
            {categories.map(cat => (
              <button key={cat} className={`cat-tab ${activeTab === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
            ))}
          </div>
          {lastCartValid.length > 0 && totalItems === 0 && (
            <button onClick={repeatLast}
              style={{ display: 'block', width: 'calc(100% - 2.5rem)', margin: '0 1.25rem 0.9rem', padding: '0.75rem', borderRadius: 14, border: '1.5px dashed var(--accent2)', background: 'var(--accent3)', color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" }}>
              🔁 Refaire ma dernière commande ({lastCartValid.reduce((a, [, q]) => a + q, 0)} article{lastCartValid.reduce((a, [, q]) => a + q, 0) > 1 ? 's' : ''})
            </button>
          )}
          <div className="menu-grid">
            {filtered.map(item => (
              <div key={item.id} className="menu-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="item-emoji">{item.emoji}</div>
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    {BADGES[menuBadges[item.id]] && (
                      <div style={{ display: 'inline-block', margin: '0.15rem 0', padding: '0.1rem 0.5rem', borderRadius: 20, fontSize: '0.66rem', fontWeight: 700, background: BADGES[menuBadges[item.id]][1], color: BADGES[menuBadges[item.id]][2] }}>{BADGES[menuBadges[item.id]][0]}</div>
                    )}
                    <div className="item-price">{Number(item.price).toFixed(2)} €</div>
                    {item.ingredients && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                        {item.ingredients}
                      </div>
                    )}
                    {(() => {
                      const offer = loyaltyOffers.find(o => o.product_name === item.name);
                      if (!offer) return null;
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: '#00A847', fontWeight: 600 }}>
                          🎁 1 offerte toutes les {offer.every_n} achetées
                        </div>
                      );
                    })()}
                  </div>
                  {item.stock !== null && item.stock !== undefined && item.stock <= 10 && (
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#C2410C', textAlign: 'right', marginBottom: 2 }}>Plus que {item.stock}</div>
                  )}
                  <div className="qty-ctrl">
                    <button className="qty-btn" onClick={() => setQty(item.id, (cart[item.id] || 0) - 1)}>−</button>
                    <span key={cart[item.id] || 0} className="qty-num" style={{ display: 'inline-block', animation: (cart[item.id] || 0) > 0 ? 'qtyPop 0.3s ease' : 'none' }}>{cart[item.id] || 0}</span>
                    <button className="qty-btn" disabled={item.stock !== null && item.stock !== undefined && (cart[item.id] || 0) >= item.stock} style={item.stock !== null && item.stock !== undefined && (cart[item.id] || 0) >= item.stock ? { opacity: 0.35 } : undefined} onClick={() => setQty(item.id, (cart[item.id] || 0) + 1)}>+</button>
                  </div>
                </div>
                {cart[item.id] > 0 && item.extras && item.extras.length > 0 && (
                  <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.3rem' }}>Suppléments :</div>
                    {item.extras.map((ex, i) => (
                      <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', cursor: 'pointer' }}>
                        <input type="checkbox"
                          checked={!!(selectedExtras[item.id] || []).find(e => e.name === ex.name)}
                          onChange={e => {
                            const cur = selectedExtras[item.id] || [];
                            setSelectedExtras(prev => ({
                              ...prev,
                              [item.id]: e.target.checked ? [...cur, ex] : cur.filter(x => x.name !== ex.name)
                            }));
                          }}
                          style={{ accentColor: 'var(--gold)' }}
                        />
                        <span style={{ fontSize: '0.82rem' }}>{ex.name}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--gold)', fontWeight: 600 }}>+{Number(ex.price).toFixed(2)} €</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {totalItems > 0 && (
        <div className="cart-bar" onClick={() => setShowCart(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div key={totalItems} className="cart-count" style={{ animation: 'cartBump 0.3s ease' }}>{totalItems}</div>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.88rem', letterSpacing: '-0.2px' }}>Voir ma commande</span>
          </div>
          <span className="cart-total">{totalPrice.toFixed(2)} €</span>
        </div>
      )}

      {showCart && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCart(false)}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-title">Ma commande — Table {tableNum}</div>
            {suggestions.length > 0 && (
              <div style={{ background: 'var(--accent3)', borderRadius: 12, padding: '0.7rem 0.8rem', marginBottom: '0.8rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '0.4rem' }}>😋 Avec ça, une petite envie ?</div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {suggestions.map(sg => (
                    <button key={sg.id} onClick={() => setQty(sg.id, 1)}
                      style={{ padding: '0.4rem 0.7rem', borderRadius: 20, border: '1.5px solid var(--accent2)', background: 'var(--surface)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                      {sg.emoji} {sg.name} · {Number(sg.price).toFixed(2)} € <span style={{ color: 'var(--accent2)', fontWeight: 800 }}>＋</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.6rem 0.75rem', marginBottom: '0.8rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text)', marginBottom: '0.4rem' }}>🏪 Je suis au comptoir, je paie sur place :</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[['cb', '💳 CB au comptoir'], ['cash', '💵 Espèces au comptoir']].map(([m, lbl]) => (
                  <button key={m} onClick={() => payAtCounter(m)} disabled={payingCounter}
                    style={{ flex: 1, padding: '0.4rem 0.3rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" }}>
                    {payingCounter ? '⏳' : lbl}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'center', margin: '0 0 1rem', padding: '0.7rem', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontSize: '1rem', fontWeight: 800 }}>
              💳 Sinon, payer par carte en ligne ⬇️
            </div>
            {cartItems.map((item, i) => (
              <div key={i}>
                <div className="cart-line">
                  <span>{item.emoji} {item.name} × {item.qty}</span>
                  <span style={{ fontWeight: 600 }}>{(item.price * item.qty).toFixed(2)} €</span>
                </div>
                {item.extras && item.extras.map((ex, j) => (
                  <div key={j} className="cart-line" style={{ paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text2)' }}>
                    <span>↳ {ex.name} × {item.qty}</span>
                    <span>+{(Number(ex.price) * item.qty).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            ))}
            {loyaltyDiscount > 0 && (
              <div className="cart-line" style={{ color: 'var(--green)', fontWeight: 600 }}>
                <span>🎁 {cartItems.find(i => i.free > 0)?.free}× {settings.loyalty_item} offert(s) !</span>
                <span>-{loyaltyDiscount.toFixed(2)} €</span>
              </div>
            )}
            {promoAmount > 0 && (
              <div className="cart-line" style={{ color: 'var(--green)', fontWeight: 600 }}>
                <span>🏷 Code promo -{promoDiscount}%</span>
                <span>-{promoAmount.toFixed(2)} €</span>
              </div>
            )}
            <div className="cart-total-line">
            {consigneAmount > 0 && (
              <div className="cart-line" style={{ color: '#C8953A', fontWeight: 600 }}>
                <span>🍺 Consigne verre{consigneQty > 1 ? 's' : ''} {consigneLiquide ? '(liquide 💵)' : '(CB 💳)'}</span>
                <span>{consigneLiquide ? '0.00' : consigneAmount.toFixed(2)} €</span>
              </div>
            )}
              <span>Total</span>
              <span style={{ color: 'var(--gold)' }}>{totalPrice.toFixed(2)} €</span>
            </div>
            {/* CODE PROMO */}
            <PromoCodeField onApply={(discount) => setPromoDiscount(discount)} />

            {/* CONSIGNE VERRES */}
            {consigneAmount > 0 && (
              <div style={{ background: '#FFFBF0', border: '1.5px solid #C8953A', borderRadius: 10, padding: '0.9rem', marginTop: '0.75rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🍺 Consigne verre{consigneQty > 1 ? 's' : ''} : {consigneAmount.toFixed(2)} €
                </div>
                <div style={{ fontSize: '0.78rem', color: '#666', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  1€ par verre · Remboursée en liquide au retour du verre au stand
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={consigneLiquide} onChange={e => setConsigneLiquide(e.target.checked)}
                    style={{ accentColor: '#C8953A', width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', color: '#444', lineHeight: 1.4 }}>
                    <strong>Je préfère payer la consigne ({consigneAmount.toFixed(2)} €) en liquide à la caisse</strong>
                    <br />
                    <span style={{ color: '#888' }}>Le montant CB sera réduit d&apos;autant</span>
                  </span>
                </label>
              </div>
            )}

            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '0.4rem' }}>
                💬 Commentaire / demande spéciale
              </div>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Ex: sans oignons, sans frites, allergie aux noix..."
                rows={2}
                style={{
                  width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
                  border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.85rem', outline: 'none', background: 'var(--surface)',
                  resize: 'none', lineHeight: 1.5
                }}
              />
            </div>
            <Elements stripe={stripePromise}>
              <PaymentForm
                totalPrice={totalPrice}
                tableNum={tableNum}
                cartItems={cartItems}
                comment={comment}
                consigneAmount={consigneAmount}
                consigneLiquide={consigneLiquide}
                onSuccess={(id) => { try { localStorage.setItem('nef_last_cart', JSON.stringify(cart)); } catch (e) {} decrementStock(cart); setOrderId(id); setSuccess(true); setCart({}); setShowCart(false); setComment(''); setPromoDiscount(0); setConsigneLiquide(false); }}
              />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KITCHEN VIEW ─────────────────────────────────────────────────────────────
function KitchenView() {
  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevCountRef = useCallback((n) => { prevCountRef.current = n; }, []);
  const orderCountRef = useState(0);

  const playBeep = () => playChime('kitchen');
  const seenIds = useState(() => ({ set: null }))[0];
  // Débloquer l'audio au premier toucher (obligatoire sur mobile)
  useEffect(() => {
    const unlock = () => { try { playChime('silent'); } catch (e) {} window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const [tick, setTick] = useState(0);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders')
      .select('*').eq('paid', true).neq('status', 'servi')
      .order('created_at', { ascending: true });
    if (data) {
      const pendingIds = data.filter(o => o.status === 'en attente').map(o => o.id);
      if (seenIds.set && soundEnabled && pendingIds.some(id => !seenIds.set.has(id))) playBeep();
      seenIds.set = new Set([...(seenIds.set || []), ...pendingIds]);
      setOrders(data);
    }
  }, [soundEnabled]);

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    // Rafraîchir les minuteurs toutes les 30 secondes
    const timer = setInterval(() => setTick(t => t + 1), 15000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, [fetchOrders]);

  const updateStatus = async (id, status) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    if (status === 'prêt') sendNotification('✅ Commande prête !', 'Commande marquée comme prête.');
    fetchOrders();
  };

  const elapsed = (time) => {
    const m = Math.floor((Date.now() - new Date(time)) / 60000);
    return m === 0 ? "À l'instant" : `${m} min`;
  };

  const elapsedColor = (time) => {
    const m = Math.floor((Date.now() - new Date(time)) / 60000);
    if (m < 5) return '#16A34A';
    if (m < 10) return '#F59E0B';
    return '#DC2626';
  };

  const elapsedUrgent = (time) => {
    return Math.floor((Date.now() - new Date(time)) / 60000) >= 10;
  };

  const cardClass = { 'en attente': 'attente', 'en préparation': 'preparation', 'prêt': 'pret' };
  const badgeClass = { 'en attente': 'badge-attente', 'en préparation': 'badge-preparation', 'prêt': 'badge-pret' };

  return (
    <div className="kitchen-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
        <div className="view-title">🍳 Écran Cuisine</div>
        <button onClick={() => { setSoundEnabled(s => !s); }} style={{
          padding: '0.4rem 0.9rem', borderRadius: 100, border: '1.5px solid var(--border)',
          background: soundEnabled ? '#D4EDDA' : 'white', cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600,
          color: soundEnabled ? '#155724' : 'var(--text2)'
        }}>
          {soundEnabled ? '🔔 Son activé' : '🔕 Son désactivé'}
        </button>
      </div>
      <div className="view-sub">{orders.length} commande{orders.length !== 1 ? 's' : ''} payée{orders.length !== 1 ? 's' : ''} en cours</div>
      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍🍳</div>
          <div>Aucune commande en attente</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.5rem' }} className="pulse">En attente de nouvelles commandes...</div>
        </div>
      ) : (
        <div className="orders-grid">
          {orders.map(order => (
            <div key={order.id} className={`order-card ${cardClass[order.status] || ''} ${elapsedUrgent(order.created_at) && order.status !== 'prêt' ? 'urgent' : ''}`}>
              <div className="order-top">
                <div>
                  <div className="order-table">Emplacement {order.table_num}</div>
                  <div className="order-id">#{order.id} &nbsp; <span className="paid-badge">✓ Payé</span></div>
                </div>
                <span className={`status-badge ${badgeClass[order.status]}`}>{order.status}</span>
              </div>
              <div className="order-time" style={{
                color: elapsedColor(order.created_at),
                fontWeight: elapsedUrgent(order.created_at) ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}>
                {elapsedUrgent(order.created_at) ? '🔴' : '⏱'} {elapsed(order.created_at)}
                <span style={{ marginLeft: 'auto', padding: '0.15rem 0.6rem', borderRadius: 100, fontSize: '0.78rem', fontWeight: 800, color: '#fff', background: elapsedColor(order.created_at), animation: elapsedUrgent(order.created_at) && order.status !== 'prêt' ? 'pulse 1s infinite' : 'none' }}>
                  {Math.floor((Date.now() - new Date(order.created_at)) / 60000)} min
                </span>
                {elapsedUrgent(order.created_at) && <span style={{ fontSize: '0.65rem', background: '#FEE2E2', color: '#DC2626', padding: '0.1rem 0.4rem', borderRadius: 100, fontWeight: 700 }}>URGENT</span>}
              </div>
              {order.comment && (
                <div style={{ background: '#FFF8EE', border: '1px solid var(--gold)', borderRadius: 8, padding: '0.4rem 0.7rem', marginBottom: '0.4rem', fontSize: '0.82rem', color: 'var(--text)' }}>
                  💬 {order.comment}
                </div>
              )}
              {order.items.some(i => i.free > 0) && (
                <div style={{ background: '#D4EDDA', border: '1px solid #C3E6CB', borderRadius: 8, padding: '0.4rem 0.7rem', marginBottom: '0.4rem', fontSize: '0.82rem', color: '#155724', fontWeight: 600 }}>
                  🎁 {order.items.filter(i => i.free > 0).map(i => `${i.free}× ${i.name} OFFERT`).join(', ')}
                </div>
              )}
              {order.consigne > 0 && (
                <div style={{ background: order.consigne_liquide ? '#FEF3C7' : '#EFF6FF', border: `1px solid ${order.consigne_liquide ? '#F59E0B' : '#93C5FD'}`, borderRadius: 8, padding: '0.4rem 0.7rem', marginBottom: '0.6rem', fontSize: '0.82rem', fontWeight: 700, color: order.consigne_liquide ? '#92400E' : '#1E40AF' }}>
                  🍺 Consigne : {Number(order.consigne).toFixed(2)} € — {order.consigne_liquide ? '⚠️ À ENCAISSER EN LIQUIDE' : '✅ Payée par CB'}
                </div>
              )}
              <div className="order-items">
                {order.items.map((item, i) => (
                  <div key={i} className="order-item-line">
                    <span>{item.emoji} {item.name}</span>
                    <span style={{ fontWeight: 700 }}>×{item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="status-btns">
                {order.status === 'en attente' && <button className="status-btn" onClick={() => updateStatus(order.id, 'en préparation')}>👨‍🍳 Préparer</button>}
                {order.status === 'en préparation' && <button className="status-btn done" onClick={() => updateStatus(order.id, 'prêt')}>✅ Prêt</button>}
                {order.status === 'prêt' && <button className="status-btn done" onClick={() => updateStatus(order.id, 'servi')}>🍽 Servi</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD TAB ───────────────────────────────────────────────────────────
function DashboardTab() {
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);

  const fetchData = async () => {
    const { data: o } = await supabase.from('orders').select('*').eq('paid', true).order('created_at', { ascending: true });
    const { data: m } = await supabase.from('menu').select('*');
    if (o) setOrders(o);
    if (m) setMenu(m);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const today = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const totalCA = today.reduce((s, o) => s + Number(o.total), 0);
  const totalTips = today.reduce((s, o) => s + Number(o.tip || 0) + Number(o.tip_nef || 0), 0);
  const totalEncaisse = totalCA + totalTips;
  const enCours = today.filter(o => o.status !== 'servi').length;
  const servis = today.filter(o => o.status === 'servi').length;

  // Ventes par article
  const salesByItem = {};
  today.forEach(o => o.items.forEach(it => {
    if (!salesByItem[it.name]) salesByItem[it.name] = { name: it.name, emoji: it.emoji, qty: 0, revenue: 0 };
    salesByItem[it.name].qty += it.qty;
    salesByItem[it.name].revenue += it.qty * Number(it.price);
  }));
  const topItems = Object.entries(salesByItem).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  // Ventes par heure
  const byHour = {};
  today.forEach(o => {
    const h = new Date(o.created_at).getHours();
    if (!byHour[h]) byHour[h] = { count: 0, revenue: 0 };
    byHour[h].count++;
    byHour[h].revenue += Number(o.total);
  });
  const hours = Object.keys(byHour).sort((a, b) => a - b);
  const maxRevenue = Math.max(...Object.values(byHour).map(h => h.revenue), 1);

  // Dernières commandes
  const recent = [...today].reverse().slice(0, 5);

  const statStyle = { background: 'white', borderRadius: 14, padding: '1.1rem', border: '1.5px solid var(--border)', textAlign: 'center' };
  const numStyle = { fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: 'var(--gold)', lineHeight: 1 };
  const lblStyle = { fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.3rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="view-title" style={{ fontSize: '1.4rem' }}>📊 Tableau de bord</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--green)', fontWeight: 600 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
          Temps réel
        </div>
      </div>

      {/* Stats principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.2rem' }}>
        <div style={statStyle}><div style={numStyle}>{today.length}</div><div style={lblStyle}>Commandes</div></div>
        <div style={statStyle}><div style={numStyle}>{enCours}</div><div style={lblStyle}>En cours</div></div>
        <div style={statStyle}><div style={numStyle}>{servis}</div><div style={lblStyle}>Servis</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.2rem' }}>
        <div style={{ ...statStyle, background: 'var(--text)' }}>
          <div style={{ ...numStyle, color: 'var(--gold)' }}>{totalCA.toFixed(2)} €</div>
          <div style={{ ...lblStyle, color: '#aaa' }}>CA commandes</div>
        </div>
        <div style={{ ...statStyle, background: 'var(--text)' }}>
          <div style={{ ...numStyle, color: '#C8953A' }}>{totalEncaisse.toFixed(2)} €</div>
          <div style={{ ...lblStyle, color: '#aaa' }}>Total encaissé</div>
        </div>
      </div>

      {/* Graphique ventes par heure */}
      {hours.length > 0 && (
        <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.1rem', marginBottom: '1.2rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.9rem' }}>📈 Ventes par heure</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', height: 80 }}>
            {hours.map(h => (
              <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--gold)', fontWeight: 600 }}>{byHour[h].revenue.toFixed(0)}€</div>
                <div style={{
                  width: '100%', background: 'var(--gold)', borderRadius: '4px 4px 0 0',
                  height: `${Math.max(8, (byHour[h].revenue / maxRevenue) * 60)}px`,
                  transition: 'height 0.5s'
                }} />
                <div style={{ fontSize: '0.62rem', color: 'var(--text2)' }}>{h}h</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top ventes */}
      {topItems.length > 0 && (
        <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.1rem', marginBottom: '1.2rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.75rem' }}>🏆 Top ventes</div>
          {topItems.map(([name, d], i) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: i < topItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontWeight: 800, color: i === 0 ? 'var(--gold)' : 'var(--text2)', fontSize: '0.9rem', minWidth: 20 }}>#{i + 1}</span>
              <span style={{ fontSize: '1.1rem' }}>{d.emoji}</span>
              <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>{name}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>×{d.qty}</span>
              <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.85rem' }}>{d.revenue.toFixed(2)} €</span>
            </div>
          ))}
        </div>
      )}

      {/* Dernières commandes */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.75rem' }}>🕐 Dernières commandes</div>
        {recent.length === 0
          ? <div style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>Aucune commande pour le moment</div>
          : recent.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: 28 }}>#{o.id}</span>
              <span style={{ color: 'var(--text2)' }}>Emplacement {o.table_num}</span>
              <span style={{ flex: 1, color: 'var(--text2)', fontSize: '0.75rem' }}>
                {new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{Number(o.total).toFixed(2)} €</span>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: 100, fontSize: '0.68rem', fontWeight: 600,
                background: o.status === 'servi' ? '#D4EDDA' : o.status === 'prêt' ? '#D4EDDA' : o.status === 'en préparation' ? '#D1ECF1' : '#FFF3CD',
                color: o.status === 'servi' ? '#155724' : o.status === 'prêt' ? '#155724' : o.status === 'en préparation' ? '#0C5460' : '#856404'
              }}>{o.status}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── CAISSE TAB ───────────────────────────────────────────────────────────────
function CaisseTab() {
  const [orders, setOrders] = useState([]);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    supabase.from('orders').select('*').eq('paid', true)
      .then(({ data }) => data && setOrders(data));
  }, []);

  const today = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const totalCA = today.reduce((s, o) => s + Number(o.total), 0);
  const totalTips = today.reduce((s, o) => s + Number(o.tip || 0) + Number(o.tip_nef || 0), 0);
  const totalRemises = today.reduce((s, o) => {
    const items = o.items || [];
    return s + items.reduce((ss, i) => ss + (i.free || 0) * Number(i.price), 0);
  }, 0);
  const totalEncaisse = totalCA + totalTips;

  const salesByItem = {};
  today.forEach(o => o.items.forEach(it => {
    if (!salesByItem[it.name]) salesByItem[it.name] = { name: it.name, emoji: it.emoji, qty: 0, revenue: 0 };
    salesByItem[it.name].qty += it.qty;
    salesByItem[it.name].revenue += it.qty * Number(it.price);
  }));
  const salesList = Object.values(salesByItem).sort((a, b) => b.qty - a.qty);

  const times = today.map(o => new Date(o.created_at));
  const startTime = times.length > 0 ? new Date(Math.min(...times)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--';
  const endTime = times.length > 0 ? new Date(Math.max(...times)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--';

  const handlePrint = () => window.print();

  const handleExportPDF = () => {
    const date = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const salesRows = salesList.map(i => `<tr><td>${i.emoji} ${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${i.revenue.toFixed(2)} €</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Caisse - Noisy en Fête</title>
    <style>
      body { font-family: -apple-system, sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem; color: #111; }
      h1 { font-size: 1.4rem; text-align: center; margin-bottom: 0.25rem; }
      .sub { text-align: center; color: #888; font-size: 0.85rem; margin-bottom: 1.5rem; }
      .divider { border: none; border-top: 1px solid #eee; margin: 1rem 0; }
      table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
      th { text-align: left; padding: 0.4rem 0; border-bottom: 2px solid #111; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
      td { padding: 0.4rem 0; border-bottom: 1px solid #eee; }
      .total-row { font-weight: 800; font-size: 1.1rem; }
      .info { display: flex; justify-content: space-between; font-size: 0.82rem; padding: 0.2rem 0; }
      .info span:last-child { font-weight: 600; }
      .footer { text-align: center; color: #aaa; font-size: 0.72rem; margin-top: 2rem; }
    </style></head><body>
    <h1>🎉 Noisy en Fête</h1>
    <div class="sub">${date}</div>
    <hr class="divider">
    <div class="info"><span>Première commande</span><span>${startTime}</span></div>
    <div class="info"><span>Dernière commande</span><span>${endTime}</span></div>
    <div class="info"><span>Nombre de commandes</span><span>${today.length}</span></div>
    <hr class="divider">
    <table><thead><tr><th>Article</th><th style="text-align:center">Qté</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${salesRows}</tbody></table>
    <hr class="divider">
    <div class="info"><span>Ventes</span><span>${totalCA.toFixed(2)} €</span></div>
    ${totalTips > 0 ? `<div class="info"><span>Pourboires</span><span>+${totalTips.toFixed(2)} €</span></div>` : ''}
    ${totalRemises > 0 ? `<div class="info"><span>Remises fidélité</span><span>-${totalRemises.toFixed(2)} €</span></div>` : ''}
    <div class="info total-row"><span>TOTAL ENCAISSÉ</span><span>${totalEncaisse.toFixed(2)} €</span></div>
    <div class="footer">Généré le ${new Date().toLocaleString('fr-FR')}</div>
    </body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const handleReset = async () => {
    if (!window.confirm('⚠️ Remettre la caisse à zéro ? Toutes les commandes seront supprimées.')) return;
    setResetting(true);
    await supabase.from('orders').delete().neq('id', 0);
    setOrders([]);
    setResetting(false);
    alert('✅ Caisse remise à zéro !');
  };

  const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.88rem' };
  const totalRowStyle = { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', fontSize: '1rem', fontWeight: 700 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="view-title" style={{ fontSize: '1.4rem' }}>🧾 Caisse fin de soirée</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handlePrint} style={{ padding: '0.5rem 1rem', background: 'var(--text)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
            🖨 Imprimer
          </button>
          <button onClick={handleExportPDF} style={{ padding: '0.5rem 1rem', background: 'var(--accent2)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
            📄 Export PDF
          </button>
        </div>
      </div>

      {/* Rapport */}
      <div id="caisse-print" style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.2rem', borderBottom: '2px solid var(--text)', paddingBottom: '1rem' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem' }}>🎉 Noisy en Fête</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginTop: '0.2rem' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Infos soirée */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={rowStyle}><span>🕐 Première commande</span><span style={{ fontWeight: 600 }}>{startTime}</span></div>
          <div style={rowStyle}><span>🕐 Dernière commande</span><span style={{ fontWeight: 600 }}>{endTime}</span></div>
          <div style={rowStyle}><span>📋 Nombre de commandes</span><span style={{ fontWeight: 600 }}>{today.length}</span></div>
        </div>

        {/* Détail ventes */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Détail des ventes</div>
          {salesList.map((item, i) => (
            <div key={i} style={rowStyle}>
              <span>{item.emoji} {item.name} ×{item.qty}</span>
              <span style={{ fontWeight: 600 }}>{item.revenue.toFixed(2)} €</span>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div style={{ borderTop: '2px solid var(--text)', paddingTop: '0.75rem' }}>
          <div style={rowStyle}><span>Ventes</span><span>{totalCA.toFixed(2)} €</span></div>
          {totalRemises > 0 && <div style={{ ...rowStyle, color: 'var(--green)' }}><span>Remises fidélité</span><span>-{totalRemises.toFixed(2)} €</span></div>}
          {totalTips > 0 && <div style={{ ...rowStyle, color: 'var(--gold)' }}><span>🙏 Dons</span><span>+{totalTips.toFixed(2)} €</span></div>}
          <div style={{ ...totalRowStyle, borderTop: '2px solid var(--text)', marginTop: '0.5rem' }}>
            <span>TOTAL ENCAISSÉ</span>
            <span style={{ color: 'var(--gold)', fontSize: '1.3rem' }}>{totalEncaisse.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      {/* Remise à zéro */}
      <div style={{ background: '#FFF5F5', border: '1.5px solid #F5C6CB', borderRadius: 14, padding: '1.2rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: '0.4rem' }}>🔄 Remise à zéro de la caisse</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '1rem' }}>
          Imprimez d&apos;abord votre rapport, puis effacez toutes les commandes pour la prochaine soirée.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={handlePrint} style={{ padding: '0.65rem 1.2rem', background: 'var(--text)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            🖨 Imprimer avant de continuer
          </button>
          <button onClick={handleReset} disabled={resetting} style={{ padding: '0.65rem 1.2rem', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", opacity: resetting ? 0.6 : 1 }}>
            {resetting ? '⏳ En cours...' : '🗑 Remettre à zéro'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TEST TAB ─────────────────────────────────────────────────────────────────
function TestTab() {
  const [menu, setMenu] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [tableNum, setTableNum] = useState(1);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    supabase.from('menu').select('*').eq('available', true).order('position', { ascending: true, nullsFirst: false })
      .then(({ data }) => data && setMenu(data));
  }, []);

  const total = menu.reduce((s, i) => s + (selectedItems[i.id] || 0) * Number(i.price), 0);
  const totalItems = Object.values(selectedItems).reduce((s, q) => s + q, 0);

  const setQty = (id, qty) => setSelectedItems(prev => ({ ...prev, [id]: Math.max(0, qty) }));

  const sendTestOrder = async () => {
    if (totalItems === 0) { alert('Ajoutez au moins un article !'); return; }
    setSending(true);
    setResult(null);

    const items = menu.filter(i => selectedItems[i.id] > 0).map(i => ({
      name: i.name, qty: selectedItems[i.id], price: Number(i.price), emoji: i.emoji, free: 0
    }));

    const { data, error } = await supabase.from('orders').insert({
      table_num: tableNum,
      items,
      total,
      tip: 0,
      comment: '🧪 COMMANDE TEST',
      paid: true,
      status: 'en attente',
      consigne: 0,
      consigne_liquide: false
    }).select().single();

    setSending(false);
    if (error) {
      setResult({ ok: false, msg: 'Erreur : ' + error.message });
    } else {
      setResult({ ok: true, msg: `Commande test #${data.id} envoyée en cuisine !`, id: data.id });
      setSelectedItems({});
    }
  };

  const deleteTestOrders = async () => {
    if (!window.confirm('Supprimer toutes les commandes TEST ?')) return;
    await supabase.from('orders').delete().like('comment', '%TEST%');
    setResult({ ok: true, msg: 'Commandes test supprimées ✓' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div className="view-title" style={{ fontSize: '1.4rem' }}>🧪 Mode Test</div>
          <div className="view-sub" style={{ marginBottom: 0 }}>Créez une fausse commande sans paiement pour tester le système</div>
        </div>
      </div>

      {/* Avertissement */}
      <div style={{ background: '#FEF9C3', border: '1.5px solid #EAB308', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#713F12' }}>
        ⚠️ Les commandes test sont marquées <strong>🧪 COMMANDE TEST</strong> en cuisine et comptent dans les stats. Supprimez-les après le test.
      </div>

      {/* Sélection table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: '1.5px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>Emplacement</div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[1,2,3,4,5,6,7,8].map(n => (
            <button key={n} onClick={() => setTableNum(n)}
              style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${tableNum === n ? 'var(--text)' : 'var(--border)'}`, background: tableNum === n ? 'var(--text)' : 'var(--bg)', color: tableNum === n ? '#fff' : 'var(--text)', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem', fontFamily: 'Inter, sans-serif' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Sélection articles */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: '1.5px solid var(--border)' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Articles</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {menu.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: i < menu.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '1.3rem', width: 32, textAlign: 'center' }}>{item.emoji}</span>
              <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)' }}>{item.name}</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)', marginRight: '0.5rem' }}>{Number(item.price).toFixed(2)} €</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button onClick={() => setQty(item.id, (selectedItems[item.id] || 0) - 1)}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>−</button>
                <span style={{ width: 20, textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>{selectedItems[item.id] || 0}</span>
                <button onClick={() => setQty(item.id, (selectedItems[item.id] || 0) + 1)}
                  style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total et envoi */}
      {totalItems > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '1rem', marginBottom: '1rem', border: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{totalItems} article{totalItems > 1 ? 's' : ''}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Emplacement {tableNum}</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>{total.toFixed(2)} €</div>
        </div>
      )}

      {result && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ background: result.ok ? '#DCFCE7' : '#FEE2E2', border: `1.5px solid ${result.ok ? '#86EFAC' : '#FCA5A5'}`, borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: result.ok ? '#166534' : '#991B1B', marginBottom: result.ok && result.id ? '0.5rem' : 0 }}>
            {result.ok ? '✅' : '❌'} {result.msg}
          </div>
          {result.ok && result.id && (
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text2)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.4rem' }}>📱 Simuler la vue client</div>
              <div style={{ marginBottom: '0.6rem', lineHeight: 1.5 }}>
                Ouvre ce lien sur ton téléphone pour voir la page de suivi en temps réel :
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', marginBottom: '0.6rem', color: 'var(--text)' }}>
                {window.location.origin}?tracking={result.id}&table={tableNum}
              </div>
              <button onClick={() => {
                const url = `${window.location.origin}?tracking=${result.id}&table=${tableNum}`;
                if (navigator.share) navigator.share({ title: 'Suivi commande test', url });
                else { navigator.clipboard.writeText(url); alert('Lien copié !'); }
              }} style={{ padding: '0.45rem 0.9rem', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
                📋 Copier le lien
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button onClick={sendTestOrder} disabled={sending || totalItems === 0}
          style={{ flex: 1, padding: '0.85rem', background: totalItems > 0 ? 'var(--text)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.88rem', cursor: totalItems > 0 ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif' }}>
          {sending ? '⏳ Envoi...' : '🚀 Envoyer la commande test'}
        </button>
        <button onClick={deleteTestOrders}
          style={{ padding: '0.85rem 1rem', background: 'var(--surface)', color: 'var(--error)', border: `1.5px solid var(--border)`, borderRadius: 12, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
          🗑 Nettoyer
        </button>
      </div>
    </div>
  );
}

// ─── ECRAN TAB ───────────────────────────────────────────────────────────────
function EcranTab() {
  const settings = useSettings();
  const [bgColor, setBgColor] = useState('#1A1208');
  const [numColor, setNumColor] = useState('#C8953A');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [bgOpacity, setBgOpacity] = useState('0.15');
  const [bgImage, setBgImage] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewOrders] = useState([{ table_num: 3, id: 42 }, { table_num: 7, id: 43 }]);

  useEffect(() => {
    setBgColor(settings.ecran_bg || '#1A1208');
    setNumColor(settings.ecran_num_color || '#C8953A');
    setTextColor(settings.ecran_text_color || '#FFFFFF');
    setBgOpacity(settings.ecran_bg_opacity || '0.15');
    setBgImage(settings.ecran_bg_image || '');
  }, [settings.ecran_bg, settings.ecran_num_color, settings.ecran_text_color, settings.ecran_bg_opacity, settings.ecran_bg_image]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      await saveSetting('ecran_bg_image', base64);
      setBgImage(base64);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = async () => {
    await saveSetting('ecran_bg_image', '');
    setBgImage('');
  };

  const save = async () => {
    await saveSetting('ecran_bg', bgColor);
    await saveSetting('ecran_num_color', numColor);
    await saveSetting('ecran_text_color', textColor);
    await saveSetting('ecran_bg_opacity', bgOpacity);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Aperçu mini du grand écran
  const PreviewMini = () => (
    <div style={{
      position: 'relative', borderRadius: 12, overflow: 'hidden',
      background: bgColor, height: 200, marginBottom: '1rem',
      border: '2px solid var(--border)'
    }}>
      {bgImage && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: parseFloat(bgOpacity)
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, padding: '0.75rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: `1px solid ${numColor}40`, paddingBottom: '0.4rem' }}>
          <div style={{ color: numColor, fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', fontWeight: 700 }}>🎉 Noisy en Fête</div>
          <div style={{ color: numColor, fontFamily: "'Playfair Display', serif", fontSize: '0.9rem' }}>21:34</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          {previewOrders.map(o => (
            <div key={o.id} style={{ background: numColor, borderRadius: 10, padding: '0.5rem 0.75rem', textAlign: 'center', minWidth: 60 }}>
              <div style={{ fontSize: '0.55rem', color: bgColor, fontWeight: 600, opacity: 0.7 }}>Emplac.</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: bgColor, fontWeight: 900, lineHeight: 1 }}>{o.table_num}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', color: textColor, fontSize: '0.6rem', opacity: 0.5, marginTop: '0.3rem' }}>
          Venez récupérer votre commande au stand 🎪
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className="view-title" style={{ fontSize: '1.4rem' }}>📺 Grand Écran</div>
        <button onClick={() => window.open(window.location.origin + '?ecran=1', '_blank')}
          style={{ padding: '0.5rem 1rem', background: 'var(--text)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem' }}>
          🚀 Ouvrir l&apos;écran
        </button>
      </div>

      {/* Aperçu */}
      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text2)', marginBottom: '0.5rem' }}>👁 Aperçu en direct</div>
      <PreviewMini />

      {/* Image de fond */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>🖼 Image de fond</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          Taille recommandée : <strong>1920×1080 px minimum</strong> (format 16:9, JPG ou PNG).<br />
          L&apos;image sera affichée en transparence pour ne pas gêner la lisibilité des numéros.
        </div>
        {bgImage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <img src={bgImage} alt="bg" style={{ width: 80, height: 45, objectFit: 'cover', borderRadius: 6, border: '1.5px solid var(--border)' }} />
            <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--green)', fontWeight: 600 }}>✅ Image chargée</div>
            <button onClick={removeImage} className="del-btn">✕ Supprimer</button>
          </div>
        ) : (
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.2rem', background: 'var(--surface)', border: '2px dashed var(--border)',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
          }}>
            {uploading ? '⏳ Chargement...' : '📁 Choisir une image'}
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        )}

        {bgImage && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.3rem' }}>
              Transparence de l&apos;image : <strong>{Math.round(parseFloat(bgOpacity) * 100)}%</strong>
            </div>
            <input type="range" min="0.05" max="0.6" step="0.05" value={bgOpacity}
              onChange={e => setBgOpacity(e.target.value)}
              style={{ width: '100%', accentColor: 'var(--gold)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text2)' }}>
              <span>Très transparente</span><span>Plus visible</span>
            </div>
          </div>
        )}
      </div>

      {/* Couleurs */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>🎨 Couleurs</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          {[
            { label: '🌑 Fond', value: bgColor, setter: setBgColor },
            { label: '⭐ Numéros', value: numColor, setter: setNumColor },
            { label: '✍️ Texte', value: textColor, setter: setTextColor },
          ].map(({ label, value, setter }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <input type="color" value={value} onChange={e => setter(e.target.value)}
                style={{ width: '100%', height: 48, borderRadius: 10, border: '1.5px solid var(--border)', cursor: 'pointer', padding: 3 }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.3rem', fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text2)', fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Thèmes rapides */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>⚡ Thèmes rapides</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { name: 'Nuit doré', bg: '#1A1208', num: '#C8953A', txt: '#FFFFFF' },
            { name: 'Fête', bg: '#1A0A2E', num: '#FF6B9D', txt: '#FFFFFF' },
            { name: 'Nature', bg: '#1B3A1B', num: '#7CB342', txt: '#FFFFFF' },
            { name: 'Océan', bg: '#0D2137', num: '#29B6F6', txt: '#FFFFFF' },
            { name: 'Rouge feu', bg: '#1A0000', num: '#FF5722', txt: '#FFFFFF' },
          ].map(t => (
            <button key={t.name} onClick={() => { setBgColor(t.bg); setNumColor(t.num); setTextColor(t.txt); }}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: 100, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                border: '2px solid', borderColor: bgColor === t.bg ? 'var(--gold)' : 'var(--border)',
                fontFamily: "'DM Sans', sans-serif",
                background: `linear-gradient(135deg, ${t.bg} 50%, ${t.num} 100%)`,
                color: t.txt
              }}>{t.name}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={save} style={{
          flex: 1, padding: '0.75rem', background: saved ? 'var(--green)' : 'var(--text)',
          color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
          fontWeight: 700, fontFamily: "'DM Sans', sans-serif", transition: 'background 0.3s'
        }}>
          {saved ? '✅ Enregistré !' : '💾 Enregistrer'}
        </button>
        <button onClick={() => window.open(window.location.origin + '?ecran=1', '_blank')}
          style={{ flex: 1, padding: '0.75rem', background: 'var(--gold)', color: 'var(--text)', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
          📺 Ouvrir l&apos;écran TV
        </button>
      </div>
    </div>
  );
}

// ─── FIDELITE CLIENT FORM ────────────────────────────────────────────────────
function FideliteClientForm({ totalPrice, orderId }) {
  const [contact, setContact] = useState("");
  const [contactType, setContactType] = useState("email");
  const [membre, setMembre] = useState(null);
  const [saved, setSaved] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(false);
  const settings = useSettings();

  if (settings.fidelite_active !== "true") return null;

  const pointsGagnes = Math.floor(totalPrice);
  const seuil1 = parseInt(settings.fidelite_seuil1_points || "50");
  const seuil2 = parseInt(settings.fidelite_seuil2_points || "100");

  const checkContact = async () => {
    if (!contact.trim()) return;
    setLoading(true);
    const { data } = await supabase.from("fidelite").select("*").eq("contact", contact.trim()).single();
    if (data) setMembre(data);
    setLoading(false);
  };

  const savePoints = async () => {
    setLoading(true);
    const pts = pointsGagnes;
    if (membre) {
      const newPoints = membre.points + pts;
      const newTotal = membre.points_total + pts;
      let generatedCode = "";

      // Vérifier seuil 2
      if (membre.points < seuil2 && newPoints >= seuil2) {
        if (settings.fidelite_seuil2_type === "promo") {
          generatedCode = "FIDELE" + Math.random().toString(36).slice(2,6).toUpperCase();
          await supabase.from("promos").insert({ code: generatedCode, discount: parseFloat(settings.fidelite_seuil2_valeur || "15"), max_uses: 1, uses: 0, active: true });
        } else {
          generatedCode = settings.fidelite_seuil2_valeur + " OFFERT";
        }
        await supabase.from("fidelite").update({ points: newPoints - seuil2, points_total: newTotal, last_order_at: new Date() }).eq("id", membre.id);
      }
      // Vérifier seuil 1
      else if (membre.points < seuil1 && newPoints >= seuil1) {
        if (settings.fidelite_seuil1_type === "promo") {
          generatedCode = "FIDELITE" + Math.random().toString(36).slice(2,6).toUpperCase();
          await supabase.from("promos").insert({ code: generatedCode, discount: parseFloat(settings.fidelite_seuil1_valeur || "10"), max_uses: 1, uses: 0, active: true });
        } else {
          generatedCode = settings.fidelite_seuil1_valeur + " OFFERT";
        }
        await supabase.from("fidelite").update({ points: newPoints - seuil1, points_total: newTotal, last_order_at: new Date() }).eq("id", membre.id);
      }
      else {
        await supabase.from("fidelite").update({ points: newPoints, points_total: newTotal, last_order_at: new Date() }).eq("id", membre.id);
      }

      setMembre(m => ({ ...m, points: newPoints, points_total: newTotal }));
      if (generatedCode) setNewCode(generatedCode);
    } else {
      // Nouveau membre
      const { data } = await supabase.from("fidelite").insert({ contact: contact.trim(), contact_type: contactType, points: pts, points_total: pts }).select().single();
      if (data) setMembre(data);
    }
    setSaved(true);
    setLoading(false);
  };

  const totalAfterSave = membre ? membre.points + pointsGagnes : pointsGagnes;
  const progressSeuil = Math.min(100, (totalAfterSave / seuil1) * 100);

  if (saved && newCode) return (
    <div style={{ background: "#D4EDDA", border: "2px solid var(--green)", borderRadius: 14, padding: "1.2rem", marginTop: "1rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎉</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", color: "var(--green)", marginBottom: "0.4rem" }}>Récompense débloquée !</div>
      {newCode.includes("OFFERT") ? (
        <div style={{ fontSize: "0.88rem" }}>Vous avez gagné : <strong>{newCode}</strong></div>
      ) : (
        <div style={{ fontSize: "0.88rem" }}>Votre code promo : <strong style={{ fontSize: "1.1rem", letterSpacing: "0.05em", fontFamily: "monospace" }}>{newCode}</strong></div>
      )}
      <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: "0.5rem" }}>+{pointsGagnes} points ajoutés à votre compte</div>
    </div>
  );

  if (saved) return (
    <div style={{ background: "#F0FFF4", border: "1.5px solid #C3E6CB", borderRadius: 12, padding: "1rem", marginTop: "1rem" }}>
      <div style={{ fontWeight: 600, color: "var(--green)", marginBottom: "0.4rem" }}>💎 Points ajoutés !</div>
      <div style={{ fontSize: "0.82rem", color: "var(--text)" }}>
        +{pointsGagnes} points • Solde : <strong>{totalAfterSave} pts</strong>
      </div>
      <div style={{ marginTop: "0.6rem", background: "#E8E0D4", borderRadius: 100, height: 8, overflow: "hidden" }}>
        <div style={{ width: progressSeuil + "%", background: "var(--gold)", height: "100%", borderRadius: 100, transition: "width 1s" }} />
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: "0.3rem" }}>
        {totalAfterSave}/{seuil1} points pour votre prochaine récompense
      </div>
    </div>
  );

  return (
    <div style={{ background: "white", border: "1.5px solid var(--border)", borderRadius: 14, padding: "1rem", marginTop: "1rem" }}>
      <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: "0.25rem" }}>💎 Programme fidélité</div>
      <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: "0.75rem" }}>
        Gagnez {pointsGagnes} point{pointsGagnes > 1 ? "s" : ""} avec cette commande !
      </div>
      {!membre ? (
        <>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem" }}>
            <button onClick={() => setContactType("email")} style={{ flex: 1, padding: "0.4rem", borderRadius: 8, border: contactType === "email" ? "2px solid var(--gold)" : "1.5px solid var(--border)", background: contactType === "email" ? "#FFF8EE" : "white", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>📧 Email</button>
            <button onClick={() => setContactType("tel")} style={{ flex: 1, padding: "0.4rem", borderRadius: 8, border: contactType === "tel" ? "2px solid var(--gold)" : "1.5px solid var(--border)", background: contactType === "tel" ? "#FFF8EE" : "white", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>📱 Téléphone</button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type={contactType === "email" ? "email" : "tel"}
              value={contact} onChange={e => setContact(e.target.value)}
              onKeyDown={e => e.key === "Enter" && checkContact()}
              placeholder={contactType === "email" ? "votre@email.com" : "06 12 34 56 78"}
              style={{ flex: 1, padding: "0.55rem 0.75rem", borderRadius: 8, border: "1.5px solid var(--border)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.88rem", outline: "none", background: "var(--surface)" }}
            />
            <button onClick={checkContact} disabled={loading} style={{ padding: "0.55rem 0.9rem", borderRadius: 8, border: "none", background: "var(--text)", color: "white", cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif", fontSize: "0.82rem" }}>
              {loading ? "⏳" : "OK"}
            </button>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.82rem", marginBottom: "0.4rem" }}>
            Bonjour ! Solde actuel : <strong>{membre.points} points</strong>
          </div>
          <div style={{ background: "#E8E0D4", borderRadius: 100, height: 8, overflow: "hidden" }}>
            <div style={{ width: Math.min(100, (membre.points / seuil1) * 100) + "%", background: "var(--gold)", height: "100%", borderRadius: 100 }} />
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: "0.3rem" }}>
            {membre.points}/{seuil1} pts • +{pointsGagnes} pts avec cette commande
          </div>
        </div>
      )}
      {(membre || contact.length > 3) && (
        <button onClick={savePoints} disabled={loading || !contact} style={{ width: "100%", marginTop: "0.5rem", padding: "0.6rem", background: "var(--gold)", color: "var(--text)", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", fontSize: "0.85rem" }}>
          {loading ? "⏳ Enregistrement..." : membre ? `✅ Ajouter ${pointsGagnes} points` : `🎉 Rejoindre & gagner ${pointsGagnes} points`}
        </button>
      )}
    </div>
  );
}

// ─── FIDELITE ADMIN TAB ───────────────────────────────────────────────────────
function FideliteTab() {
  const [membres, setMembres] = useState([]);
  const [form, setForm] = useState({ fidelite_active: "false", fidelite_seuil1_points: "50", fidelite_seuil1_type: "promo", fidelite_seuil1_valeur: "10", fidelite_seuil2_points: "100", fidelite_seuil2_type: "produit", fidelite_seuil2_valeur: "" });
  const [saved, setSaved] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const settings = useSettings();

  useEffect(() => {
    setForm(f => ({ ...f, ...settings }));
    supabase.from("fidelite").select("*").order("points", { ascending: false }).then(({ data }) => data && setMembres(data));
    supabase.from("menu").select("id,name,emoji,price").order("category").then(({ data }) => data && setMenuItems(data));
  }, [settings.fidelite_active]);

  const saveSettings = async () => {
    for (const [key, value] of Object.entries(form)) {
      if (key.startsWith("fidelite_")) await saveSetting(key, String(value));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetMembre = async (id) => {
    if (!window.confirm("Remettre les points de ce membre à zéro ?")) return;
    await supabase.from("fidelite").update({ points: 0 }).eq("id", id);
    setMembres(m => m.map(mb => mb.id === id ? { ...mb, points: 0 } : mb));
  };

  const deleteMembre = async (id) => {
    if (!window.confirm("Supprimer ce membre ?")) return;
    await supabase.from("fidelite").delete().eq("id", id);
    setMembres(m => m.filter(mb => mb.id !== id));
  };

  const isActive = form.fidelite_active === "true";

  return (
    <div>
      <div className="section-title">💎 Programme de fidélité</div>

      {/* Activation */}
      <div style={{ background: isActive ? "#F0FFF4" : "#FFF5F5", border: `1.5px solid ${isActive ? "#C3E6CB" : "#F5C6CB"}`, borderRadius: 14, padding: "1.2rem", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: isActive ? "var(--green)" : "var(--red)" }}>
              {isActive ? "✅ Programme actif" : "⏸ Programme inactif"}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: "0.2rem" }}>
              {isActive ? "Les clients peuvent accumuler des points" : "Activez pour démarrer la fidélité"}
            </div>
          </div>
          <button onClick={() => setForm(f => ({ ...f, fidelite_active: isActive ? "false" : "true" }))} style={{ padding: "0.6rem 1.2rem", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: isActive ? "var(--red)" : "var(--green)", color: "white" }}>
            {isActive ? "Désactiver" : "Activer"}
          </button>
        </div>
      </div>

      {/* Configuration seuils */}
      <div style={{ background: "white", border: "1.5px solid var(--border)", borderRadius: 14, padding: "1.2rem", marginBottom: "1rem" }}>
        <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>🎁 Seuil 1 (premier palier)</div>
        <div className="form-row">
          <div className="form-field">
            <label>Points nécessaires</label>
            <input type="number" value={form.fidelite_seuil1_points} onChange={e => setForm(f => ({ ...f, fidelite_seuil1_points: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Type de récompense</label>
            <select value={form.fidelite_seuil1_type} onChange={e => setForm(f => ({ ...f, fidelite_seuil1_type: e.target.value }))}>
              <option value="promo">Code promo (%)</option>
              <option value="produit">Produit offert</option>
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>{form.fidelite_seuil1_type === "promo" ? "Réduction (%)" : "Produit offert"}</label>
          {form.fidelite_seuil1_type === "promo" ? (
            <input type="number" value={form.fidelite_seuil1_valeur} onChange={e => setForm(f => ({ ...f, fidelite_seuil1_valeur: e.target.value }))} placeholder="Ex: 10" />
          ) : (
            <select value={form.fidelite_seuil1_valeur} onChange={e => setForm(f => ({ ...f, fidelite_seuil1_valeur: e.target.value }))}>
              <option value="">-- Choisir un produit --</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.name}>{item.emoji} {item.name} ({Number(item.price).toFixed(2)} €)</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ background: "white", border: "1.5px solid var(--border)", borderRadius: 14, padding: "1.2rem", marginBottom: "1rem" }}>
        <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>🏆 Seuil 2 (deuxième palier)</div>
        <div className="form-row">
          <div className="form-field">
            <label>Points nécessaires</label>
            <input type="number" value={form.fidelite_seuil2_points} onChange={e => setForm(f => ({ ...f, fidelite_seuil2_points: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Type de récompense</label>
            <select value={form.fidelite_seuil2_type} onChange={e => setForm(f => ({ ...f, fidelite_seuil2_type: e.target.value }))}>
              <option value="promo">Code promo (%)</option>
              <option value="produit">Produit offert</option>
            </select>
          </div>
        </div>
        <div className="form-field">
          <label>{form.fidelite_seuil2_type === "promo" ? "Réduction (%)" : "Produit offert"}</label>
          {form.fidelite_seuil2_type === "promo" ? (
            <input type="number" value={form.fidelite_seuil2_valeur} onChange={e => setForm(f => ({ ...f, fidelite_seuil2_valeur: e.target.value }))} placeholder="Ex: 20" />
          ) : (
            <select value={form.fidelite_seuil2_valeur} onChange={e => setForm(f => ({ ...f, fidelite_seuil2_valeur: e.target.value }))}>
              <option value="">-- Choisir un produit --</option>
              {menuItems.map(item => (
                <option key={item.id} value={item.name}>{item.emoji} {item.name} ({Number(item.price).toFixed(2)} €)</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div style={{ background: "#FFF8EE", border: "1px solid var(--gold)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.82rem", marginBottom: "1rem" }}>
        💡 <strong>Exemple :</strong> Seuil 1 = 50 pts → code -10% / Seuil 2 = 100 pts → Bière offerte<br />
        Un client qui dépense 60€ en une soirée atteint directement le seuil 1.
      </div>

      <button onClick={saveSettings} style={{ padding: "0.75rem 2rem", background: saved ? "var(--green)" : "var(--text)", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginBottom: "1.5rem", transition: "background 0.3s" }}>
        {saved ? "✅ Enregistré !" : "💾 Enregistrer la configuration"}
      </button>

      {/* Liste membres */}
      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text2)", marginBottom: "0.75rem" }}>
        👥 Membres ({membres.length}) — classés par points
      </div>
      {membres.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">💎</div><div>Aucun membre pour le moment</div></div>
      ) : membres.map(m => (
        <div key={m.id} style={{ background: "white", border: "1.5px solid var(--border)", borderRadius: 12, padding: "0.9rem 1rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ fontSize: "1.2rem" }}>{m.contact_type === "email" ? "📧" : "📱"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: "0.88rem" }}>{m.contact}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: "0.1rem" }}>
              Total cumulé : {m.points_total} pts • Depuis {new Date(m.created_at).toLocaleDateString("fr-FR")}
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 60 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", color: "var(--gold)" }}>{m.points}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text2)" }}>points</div>
          </div>
          <div style={{ display: "flex", gap: "0.3rem" }}>
            <button onClick={() => resetMembre(m.id)} style={{ padding: "0.3rem 0.6rem", background: "transparent", border: "1.5px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", color: "var(--text2)" }} title="Remettre à zéro">↩</button>
            <button className="del-btn" onClick={() => deleteMembre(m.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PROMOS TAB ──────────────────────────────────────────────────────────────
function PromosTab() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({ code: '', discount: '10', maxUses: '1', active: true });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const loadPromos = () => {
    supabase.from('promos').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setPromos(data); setLoading(false); });
  };

  useEffect(() => { loadPromos(); }, []);

  const addPromo = async () => {
    if (!form.code || !form.discount) return;
    const code = form.code.toUpperCase().trim();
    const { error } = await supabase.from('promos').insert({
      code, discount: parseFloat(form.discount),
      max_uses: parseInt(form.maxUses), uses: 0, active: form.active
    });
    if (error) { setMsg('❌ Ce code existe déjà !'); setTimeout(() => setMsg(''), 3000); return; }
    setForm({ code: '', discount: '10', maxUses: '1', active: true });
    setMsg('✅ Code promo créé !'); setTimeout(() => setMsg(''), 2000);
    loadPromos();
  };

  const togglePromo = async (id, active) => {
    await supabase.from('promos').update({ active: !active }).eq('id', id);
    loadPromos();
  };

  const deletePromo = async (id) => {
    if (!window.confirm('Supprimer ce code promo ?')) return;
    await supabase.from('promos').delete().eq('id', id);
    loadPromos();
  };

  return (
    <div>
      <div className="section-title">🏷 Codes promotionnels</div>

      {/* Formulaire création */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>+ Créer un code promo</div>
        <div className="form-row">
          <div className="form-field">
            <label>Code promo</label>
            <input
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="Ex: MERCI10"
              style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}
            />
          </div>
          <div className="form-field">
            <label>Réduction (%)</label>
            <input type="number" min="1" max="100" value={form.discount}
              onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
              placeholder="10"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Nombre d&apos;utilisations max</label>
            <input type="number" min="1" value={form.maxUses}
              onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
              placeholder="1"
            />
          </div>
          <div className="form-field" style={{ justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1.2rem' }}>
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                style={{ accentColor: 'var(--gold)', width: 16, height: 16 }}
              />
              <span>Actif immédiatement</span>
            </label>
          </div>
        </div>
        {form.code && form.discount && (
          <div style={{ background: '#FFF8EE', border: '1px solid var(--gold)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
            🏷 Le code <strong>{form.code || '...'}</strong> donnera <strong>{form.discount}% de réduction</strong>, utilisable <strong>{form.maxUses} fois</strong>
          </div>
        )}
        {msg && <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>}
        <button className="add-btn" onClick={addPromo}>Créer le code promo</button>
      </div>

      {/* Liste des promos */}
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text2)' }}>
        Codes actifs et passés ({promos.length})
      </div>
      {loading ? <div className="pulse" style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>Chargement...</div> :
        promos.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🏷</div><div>Aucun code promo créé</div></div>
        ) : promos.map(promo => (
          <div key={promo.id} style={{
            background: 'white', border: `1.5px solid ${promo.active ? 'var(--green)' : 'var(--border)'}`,
            borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'
          }}>
            <div style={{ background: promo.active ? '#D4EDDA' : '#F8F8F8', borderRadius: 8, padding: '0.4rem 0.8rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', color: promo.active ? 'var(--green)' : 'var(--text2)', fontFamily: 'monospace' }}>
                {promo.code}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>−{promo.discount}% de réduction</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: '0.1rem' }}>
                {promo.uses}/{promo.max_uses} utilisation{promo.max_uses > 1 ? 's' : ''}
                {promo.uses >= promo.max_uses && ' — Épuisé'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => togglePromo(promo.id, promo.active)}
                className={`avail-toggle ${promo.active ? 'on' : 'off'}`}>
                {promo.active ? '✓ Actif' : '✗ Inactif'}
              </button>
              <button className="del-btn" onClick={() => deletePromo(promo.id)}>✕</button>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── THEME TAB ───────────────────────────────────────────────────────────────
function ThemeTab() {
  const [selectedTheme, setSelectedTheme] = useState('Classique');
  const [customColors, setCustomColors] = useState({});
  const [saved, setSaved] = useState(false);
  const settings = useSettings();

  useEffect(() => {
    if (settings.theme_name) setSelectedTheme(settings.theme_name);
    if (settings.theme_custom) {
      try { setCustomColors(JSON.parse(settings.theme_custom)); } catch(e) {}
    }
  }, [settings.theme_name, settings.theme_custom]);

  const applyTheme = (name) => {
    setSelectedTheme(name);
    setCustomColors({});
    const vars = THEMES[name];
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  };

  const updateColor = (key, value) => {
    const updated = { ...customColors, [key]: value };
    setCustomColors(updated);
    document.documentElement.style.setProperty(key, value);
  };

  const save = async () => {
    await saveSetting('theme_name', selectedTheme);
    await saveSetting('theme_custom', JSON.stringify(customColors));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const currentVars = { ...THEMES[selectedTheme], ...customColors };

  const colorFields = [
    { key: '--cream', label: '🎨 Fond de page' },
    { key: '--dark', label: '✍️ Texte principal' },
    { key: '--gold', label: '⭐ Couleur principale' },
    { key: '--gold-light', label: '✨ Couleur secondaire' },
    { key: '--border', label: '📐 Bordures' },
    { key: '--warm-gray', label: '💬 Texte secondaire' },
    { key: '--green', label: '✅ Succès / Dispo' },
    { key: '--red', label: '❌ Erreur / Suppression' },
  ];

  return (
    <div>
      <div className="section-title">🎨 Thème de l&apos;interface</div>

      {/* Thèmes prédéfinis */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text2)', fontWeight: 500, marginBottom: '0.75rem' }}>
          Thèmes prédéfinis — cliquez pour prévisualiser
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
          {Object.entries(THEMES).map(([name, vars]) => (
            <button key={name} onClick={() => applyTheme(name)}
              style={{
                borderRadius: 12, border: selectedTheme === name ? '3px solid var(--gold)' : '2px solid var(--border)',
                cursor: 'pointer', overflow: 'hidden', background: 'white',
                boxShadow: selectedTheme === name ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s'
              }}>
              {/* Preview du thème */}
              <div style={{ background: vars['--cream'], padding: '0.75rem 0.5rem' }}>
                <div style={{ background: vars['--dark'], borderRadius: 6, padding: '0.3rem 0.5rem', marginBottom: '0.4rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: vars['--gold'] }} />
                  <div style={{ height: 4, width: '60%', borderRadius: 2, background: vars['--gold'], opacity: 0.7 }} />
                </div>
                <div style={{ background: 'white', borderRadius: 6, padding: '0.3rem 0.5rem', border: `1px solid ${vars['--border']}` }}>
                  <div style={{ height: 4, width: '80%', borderRadius: 2, background: vars['--dark'], opacity: 0.6, marginBottom: '0.25rem' }} />
                  <div style={{ height: 4, width: '50%', borderRadius: 2, background: vars['--gold'] }} />
                </div>
              </div>
              <div style={{ padding: '0.4rem', background: selectedTheme === name ? '#FFF8EE' : 'white', fontSize: '0.78rem', fontWeight: 600, color: selectedTheme === name ? 'var(--gold)' : 'var(--text)', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
                {selectedTheme === name ? '✓ ' : ''}{name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Personnalisation fine */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>🖌 Personnalisation fine</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {colorFields.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input type="color" value={currentVars[key] || '#ffffff'}
                onChange={e => updateColor(key, e.target.value)}
                style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', padding: 2 }}
              />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text2)', fontFamily: 'monospace' }}>{currentVars[key]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aperçu rapide */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.5rem' }}>👁 Aperçu en direct</div>
        <div style={{ background: 'var(--text)', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.85rem' }}>🎉 Noisy en Fête</div>
          <div style={{ marginLeft: 'auto', background: 'var(--gold)', borderRadius: 100, padding: '0.2rem 0.7rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)' }}>Commander</div>
        </div>
        <div style={{ background: 'white', borderRadius: 8, padding: '0.75rem', border: '1.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--text)' }}>🍷 Vin rouge</div>
            <div style={{ color: 'var(--gold)', fontWeight: 600, fontSize: '0.78rem' }}>5.50 €</div>
          </div>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', background: 'white' }}>−</div>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>0</span>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', background: 'white' }}>+</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {/* CHANGEMENT PIN */}
      <ChangePinSection />

      {/* GRAND ECRAN TV */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>📺 Grand écran TV</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          Affichez les numéros d&apos;emplacements prêts sur une TV ou un vidéoprojecteur.
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.82rem', marginBottom: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          🔗 {window.location.origin}?ecran=1
        </div>
        <button onClick={() => window.open(window.location.origin + '?ecran=1', '_blank')} style={{ padding: '0.6rem 1.2rem', background: 'var(--text)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem' }}>
          📺 Ouvrir le grand écran
        </button>
      </div>

      {/* SUIVI DE COMMANDE */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>📍 Suivi de commande en direct</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '0.2rem' }}>
              Après le paiement, le client voit une page avec la progression de sa commande en temps réel.
            </div>
          </div>
          <button onClick={() => saveSetting('tracking_active', settings.tracking_active === 'true' ? 'false' : 'true')}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', background: settings.tracking_active === 'true' ? 'var(--green)' : 'var(--text2)', color: 'white', whiteSpace: 'nowrap' }}>
            {settings.tracking_active === 'true' ? '✅ Activé' : '⏸ Désactivé'}
          </button>
        </div>
      </div>

      {/* MESSAGE D'URGENCE */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>⚠️ Message d&apos;urgence</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          S&apos;affiche en bandeau rouge sur tous les téléphones clients connectés. Idéal pour signaler une rupture de stock ou un changement.
        </div>
        <UrgentMessageAdmin />
      </div>

      <button onClick={save} style={{
          padding: '0.75rem 2rem', background: saved ? 'var(--green)' : 'var(--text)',
          color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
          fontWeight: 700, fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem',
          transition: 'background 0.3s'
        }}>
          {saved ? '✅ Thème enregistré !' : '💾 Enregistrer le thème'}
        </button>
        <button onClick={() => applyTheme('Classique')} style={{
          padding: '0.75rem 1.2rem', background: 'white', color: 'var(--text)',
          border: '1.5px solid var(--border)', borderRadius: 10, cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem'
        }}>
          ↩ Réinitialiser
        </button>
      </div>
    </div>
  );
}

// ─── URGENT MESSAGE ADMIN ────────────────────────────────────────────────────
function UrgentMessageAdmin() {
  const settings = useSettings();
  const [msg, setMsg] = useState('');
  const isActive = settings.urgent_active === 'true';

  useEffect(() => { setMsg(settings.urgent_msg || ''); }, [settings.urgent_msg]);

  return (
    <div>
      <textarea value={msg} onChange={e => setMsg(e.target.value)}
        placeholder="Ex: ⚠️ Rupture de stock bière, remplacée par cidre ce soir !"
        rows={2}
        style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', outline: 'none', background: 'var(--surface)', resize: 'none', marginBottom: '0.75rem' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => sendUrgentMessage(msg)} disabled={!msg.trim()} style={{
          flex: 1, padding: '0.6rem 1rem', background: 'var(--red)', color: 'white',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif", opacity: !msg.trim() ? 0.5 : 1
        }}>📢 Envoyer à tous</button>
        {isActive && (
          <button onClick={() => { saveSetting('urgent_active', 'false'); saveSetting('urgent_msg', ''); setMsg(''); }} style={{
            padding: '0.6rem 1rem', background: 'var(--text)', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif"
          }}>✕ Effacer</button>
        )}
      </div>
      {isActive && (
        <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--red)', fontWeight: 600 }}>
          🔴 Message actif — visible par tous les clients
        </div>
      )}
    </div>
  );
}

// ─── LOYALTY OFFERS SECTION ──────────────────────────────────────────────────
function LoyaltyOffersSection({ loyaltyMenu }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = async () => {
    const { data } = await supabase.from('loyalty_offers').select('*').order('created_at');
    if (data) setOffers(data);
    setLoading(false);
  };

  useEffect(() => { fetchOffers(); }, []);

  const addOffer = async () => {
    const { data } = await supabase.from('loyalty_offers')
      .insert({ product_name: '', every_n: 4, active: true })
      .select().single();
    if (data) setOffers(o => [...o, data]);
  };

  const updateOffer = async (id, field, value) => {
    setOffers(o => o.map(offer => offer.id === id ? { ...offer, [field]: value } : offer));
    await supabase.from('loyalty_offers').update({ [field]: value }).eq('id', id);
  };

  const deleteOffer = async (id) => {
    if (!window.confirm('Supprimer cette offre ?')) return;
    await supabase.from('loyalty_offers').delete().eq('id', id);
    setOffers(o => o.filter(offer => offer.id !== id));
  };

  return (
    <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>🎁 Offres fidélité</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
        Définissez une ou plusieurs offres : achetez N produits, le suivant est offert.
      </div>

      {loading ? (
        <div style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>Chargement...</div>
      ) : offers.length === 0 ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
          Aucune offre configurée.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
          {offers.map(offer => (
            <div key={offer.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: '0.85rem', border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <select value={offer.product_name}
                  onChange={e => updateOffer(offer.id, 'product_name', e.target.value)}
                  style={{ flex: 1, minWidth: 160, padding: '0.45rem 0.6rem', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}>
                  <option value="">-- Choisir un produit --</option>
                  {loyaltyMenu.map(item => (
                    <option key={item.id} value={item.name}>{item.emoji} {item.name} ({Number(item.price).toFixed(2)} €)</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>1 offert tous les</span>
                  <input type="number" min="2" max="20" value={offer.every_n}
                    onChange={e => updateOffer(offer.id, 'every_n', parseInt(e.target.value) || 2)}
                    style={{ width: 55, padding: '0.45rem 0.5rem', borderRadius: 8, border: '1.5px solid var(--border)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', background: 'var(--bg)', color: 'var(--text)', outline: 'none', textAlign: 'center' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>achetés</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={offer.active}
                    onChange={e => updateOffer(offer.id, 'active', e.target.checked)}
                    style={{ accentColor: 'var(--accent2)' }} />
                  {offer.active ? '✅ Offre active' : '⏸ Offre inactive'}
                </label>
                {offer.product_name && offer.active && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--accent2)', fontWeight: 600 }}>
                    🎁 1 {offer.product_name} offert(e) toutes les {offer.every_n} achetées
                  </div>
                )}
                <button onClick={() => deleteOffer(offer.id)} className="del-btn" style={{ marginLeft: '0.5rem' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={addOffer}
        style={{ padding: '0.55rem 1rem', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
        ➕ Ajouter une offre
      </button>
    </div>
  );
}

// ─── CHANGE PIN SECTION ──────────────────────────────────────────────────────
function ChangePinSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);

  const handleChange = async () => {
    setMsg(null);
    if (current !== STAFF_PIN) { setMsg({ ok: false, txt: '❌ Code actuel incorrect' }); return; }
    if (newPin.length < 4) { setMsg({ ok: false, txt: '❌ Le nouveau code doit faire au moins 4 chiffres' }); return; }
    if (newPin !== confirm) { setMsg({ ok: false, txt: '❌ Les deux codes ne correspondent pas' }); return; }
    if (!/^\d+$/.test(newPin)) { setMsg({ ok: false, txt: '❌ Le code doit contenir uniquement des chiffres' }); return; }

    await saveSetting('staff_pin', newPin);
    STAFF_PIN = newPin;
    setMsg({ ok: true, txt: '✅ Code PIN mis à jour !' });
    setCurrent(''); setNewPin(''); setConfirm('');
    setTimeout(() => { setOpen(false); setMsg(null); }, 2000);
  };

  return (
    <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>🔐 Code PIN d&apos;accès</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '0.2rem' }}>
            Protège l&apos;accès à la cuisine et à l&apos;administration
          </div>
        </div>
        <button onClick={() => { setOpen(!open); setMsg(null); }}
          style={{ padding: '0.5rem 1rem', background: open ? 'var(--surface)' : 'var(--text)', color: open ? 'var(--text)' : '#fff', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
          {open ? 'Annuler' : '✏️ Modifier'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[
            { label: 'Code actuel', value: current, setter: setCurrent, placeholder: '······' },
            { label: 'Nouveau code', value: newPin, setter: setNewPin, placeholder: 'Min. 4 chiffres' },
            { label: 'Confirmer le nouveau code', value: confirm, setter: setConfirm, placeholder: 'Répétez le code' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} className="form-field">
              <label>{label}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={value}
                onChange={e => setter(e.target.value.replace(/\D/g, ''))}
                placeholder={placeholder}
                style={{ maxWidth: 200, letterSpacing: '0.2em', fontSize: '1.1rem' }}
              />
            </div>
          ))}

          {msg && (
            <div style={{ padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, background: msg.ok ? '#DCFCE7' : '#FEE2E2', color: msg.ok ? '#166534' : '#991B1B' }}>
              {msg.txt}
            </div>
          )}

          <button onClick={handleChange}
            style={{ alignSelf: 'flex-start', padding: '0.6rem 1.2rem', background: 'var(--text)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
            💾 Enregistrer le nouveau code
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CONFIG TAB ──────────────────────────────────────────────────────────────
function ConfigTab() {
  const settings = useSettings();
  const [welcome, setWelcome] = useState('');
  const [eventName, setEventName] = useState('');
  const [consignePrix, setConsignePrix] = useState('1');
  const [consigneProduits, setConsigneProduits] = useState('Bière pression 30cl');
  const [closingTime, setClosingTime] = useState('22:00');
  const [loyaltyItem, setLoyaltyItem] = useState('');
  const [loyaltyEvery, setLoyaltyEvery] = useState('4');
  const [loyaltyActive, setLoyaltyActive] = useState(false);
  const [loyaltyMenu, setLoyaltyMenu] = useState([]);
  const [saved, setSaved] = useState(false);
  const [tablesCount, setTablesCount] = useState('28');
  const [tablesNames, setTablesNames] = useState({});
  const [showNames, setShowNames] = useState(false);
  const [chLabel, setChLabel] = useState('');
  const [chGoal, setChGoal] = useState('100');
  const [chReward, setChReward] = useState('');
  useEffect(() => {
    setChLabel(settings.challenge_label || '');
    setChGoal(settings.challenge_goal || '100');
    setChReward(settings.challenge_reward || '');
  }, [settings.challenge_label, settings.challenge_goal, settings.challenge_reward]);
  const chOn = settings.challenge_active === 'true';
  const apeOn = settings.don_ape_active !== 'false';
  const nefOn = settings.don_nef_active === 'true';

  useEffect(() => {
    setTablesCount(settings.tables_count || '28');
    try { setTablesNames(JSON.parse(settings.tables_names || '{}') || {}); } catch (e) { setTablesNames({}); }
  }, [settings.tables_count, settings.tables_names]);

  useEffect(() => {
    setWelcome(settings.welcome || '');
    setEventName(settings.event_name || '');
    setConsignePrix(settings.consigne_prix || '1');
    setConsigneProduits(settings.consigne_produits || 'Bière pression 30cl');
    setClosingTime(settings.closing_time || '22:00');
    setLoyaltyItem(settings.loyalty_item || '');
    setLoyaltyEvery(settings.loyalty_every || '4');
    setLoyaltyActive(settings.loyalty_active === 'true');
    supabase.from('menu').select('id,name,emoji,price').order('position', { ascending: true, nullsFirst: false }).then(({ data }) => data && setLoyaltyMenu(data));
  }, [settings.welcome, settings.closing_time, settings.loyalty_item, settings.loyalty_every, settings.loyalty_active]);

  const isClosed = settings.closed === 'true';

  const save = async () => {
    await saveSetting('welcome', welcome);
    await saveSetting('event_name', eventName);
    await saveSetting('consigne_prix', consignePrix);
    await saveSetting('consigne_produits', consigneProduits);
    await saveSetting('closing_time', closingTime);
    const nTables = Math.min(200, Math.max(1, parseInt(tablesCount) || 28));
    const cleanNames = {};
    Object.entries(tablesNames).forEach(([k, v]) => { if (v && v.trim() && Number(k) <= nTables) cleanNames[k] = v.trim(); });
    await saveSetting('challenge_label', chLabel);
    await saveSetting('challenge_goal', String(Math.max(1, parseInt(chGoal) || 100)));
    await saveSetting('challenge_reward', chReward);
    await saveSetting('tables_count', String(nTables));
    await saveSetting('tables_names', JSON.stringify(cleanNames));
    await saveSetting('loyalty_item', loyaltyItem);
    await saveSetting('loyalty_every', loyaltyEvery);
    await saveSetting('loyalty_active', loyaltyActive ? 'true' : 'false');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="section-title">🛠 Configuration de la soirée</div>

      {/* Statut ouvert/fermé - Bouton ON/OFF */}
      <div style={{
        background: isClosed ? '#FFF5F5' : '#F0FFF4',
        border: `2px solid ${isClosed ? '#FECACA' : '#86EFAC'}`,
        borderRadius: 16, padding: '1.25rem', marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: isClosed ? '#DC2626' : '#16A34A', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{isClosed ? '🔒' : '🟢'}</span>
              {isClosed ? 'Commandes fermées' : 'Commandes ouvertes'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.5 }}>
              {isClosed
                ? 'Les clients voient un message de fermeture et ne peuvent pas commander.'
                : 'Les clients peuvent passer commande normalement.'}
            </div>
          </div>

          {/* Toggle ON/OFF */}
          <div
            onClick={() => saveSetting('closed', isClosed ? 'false' : 'true')}
            style={{
              width: 64, height: 34, borderRadius: 100,
              background: isClosed ? '#FCA5A5' : '#4ADE80',
              cursor: 'pointer', position: 'relative',
              transition: 'background 0.3s ease',
              flexShrink: 0,
              boxShadow: isClosed ? '0 2px 8px rgba(220,38,38,0.3)' : '0 2px 8px rgba(74,222,128,0.4)',
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: isClosed ? 3 : 33,
              width: 28, height: 28, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              transition: 'left 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem'
            }}>
              {isClosed ? '🔒' : '✅'}
            </div>
          </div>
        </div>

        {/* Confirmation visuelle */}
        <div style={{
          marginTop: '0.85rem', padding: '0.6rem 0.9rem',
          background: isClosed ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
          borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
          color: isClosed ? '#DC2626' : '#16A34A',
          display: 'flex', alignItems: 'center', gap: '0.4rem'
        }}>
          {isClosed
            ? '⚠️ Appuyez sur le bouton pour rouvrir les commandes'
            : '💡 Appuyez sur le bouton pour fermer les commandes'}
        </div>
      </div>

      {/* Thème événement */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>🎨 Thème de l&apos;événement</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>Change les couleurs de l&apos;appli, affiche un bandeau et habille la licorne (effet immédiat).</div>
        <select value={settings.event_theme || 'none'} onChange={e => saveSetting('event_theme', e.target.value)}
          style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.9rem' }}>
          {Object.entries(EVENT_THEMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Défi de la soirée */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
          <div style={{ fontWeight: 600 }}>🎯 Défi de la soirée</div>
          <button onClick={() => saveSetting('challenge_active', chOn ? 'false' : 'true')}
            style={{ padding: '0.45rem 1rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: chOn ? '#00C553' : '#CCC', color: chOn ? '#fff' : '#555' }}>{chOn ? 'ON' : 'OFF'}</button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>Barre de progression visible sur les téléphones et sur l&apos;écran TV. Elle compte les articles vendus (commandes payées). Pense à « Sauvegarder » en bas.</div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <input value={chLabel} onChange={e => setChLabel(e.target.value)} placeholder="Ex: 100 bières vendues"
            style={{ padding: '0.55rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem' }}>Objectif :</span>
            <input type="number" min="1" value={chGoal} onChange={e => setChGoal(e.target.value)}
              style={{ width: 90, padding: '0.55rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
            <span style={{ fontSize: '0.85rem' }}>articles</span>
          </div>
          <input value={chReward} onChange={e => setChReward(e.target.value)} placeholder="Récompense. Ex: Tournée offerte à tout le monde !"
            style={{ padding: '0.55rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          <button onClick={() => { if (window.confirm('Remettre le compteur du défi à zéro ?')) saveSetting('challenge_start', new Date().toISOString()); }}
            style={{ padding: '0.5rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>🔄 Redémarrer le compteur à zéro</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.9rem', paddingTop: '0.7rem', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.88rem' }}>🏆 Classement des tables sur l&apos;écran TV</span>
          <button onClick={() => saveSetting('ecran_ranking', settings.ecran_ranking === 'false' ? 'true' : 'false')}
            style={{ padding: '0.45rem 1rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: settings.ecran_ranking !== 'false' ? '#00C553' : '#CCC', color: settings.ecran_ranking !== 'false' ? '#fff' : '#555' }}>{settings.ecran_ranking !== 'false' ? 'ON' : 'OFF'}</button>
        </div>
      </div>

      {/* Dons */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>💝 Dons au moment du paiement</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>Active ou désactive chaque proposition de don (effet immédiat).</div>
        {[['🎒 Don à l\u2019A.P.E des écoles', apeOn, 'don_ape_active'], ['🎉 Don à Noisy en Fête', nefOn, 'don_nef_active']].map(([label, on, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.88rem' }}>{label}</span>
            <button onClick={() => saveSetting(key, on ? 'false' : 'true')}
              style={{ padding: '0.45rem 1rem', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', background: on ? '#00C553' : '#CCC', color: on ? '#fff' : '#555' }}>
              {on ? 'ON' : 'OFF'}
            </button>
          </div>
        ))}
      </div>

      {/* Tables */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>🪑 Tables / emplacements</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>Nombre affiché sur la page d'accueil des commandes (1 à 200). Pense à cliquer sur « Sauvegarder » en bas.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem' }}>Nombre de tables :</span>
          <input type="number" min="1" max="200" value={tablesCount} onChange={e => setTablesCount(e.target.value)}
            style={{ width: 80, padding: '0.5rem', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '1rem', background: 'var(--bg)', color: 'var(--text)' }} />
        </div>
        <button onClick={() => setShowNames(v => !v)}
          style={{ padding: '0.45rem 0.8rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
          {showNames ? '▲ Masquer les noms' : '✏️ Donner un nom aux tables (optionnel)'}
        </button>
        {showNames && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
            {Array.from({ length: Math.min(200, Math.max(1, parseInt(tablesCount) || 1)) }, (_, i) => i + 1).map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 26, fontWeight: 700, fontSize: '0.85rem' }}>{n}</span>
                <input type="text" maxLength={14} placeholder="Nom (ex: Terrasse)" value={tablesNames[n] || ''}
                  onChange={e => setTablesNames(p => ({ ...p, [n]: e.target.value }))}
                  style={{ flex: 1, minWidth: 0, padding: '0.4rem', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg)', color: 'var(--text)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Heure de fermeture automatique */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>🕙 Heure de fermeture automatique</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          Les commandes se ferment automatiquement à cette heure sur toutes les pages. Par défaut : 22h00.
        </div>
        <input
          type="time" value={closingTime}
          onChange={e => setClosingTime(e.target.value)}
          style={{
            padding: '0.6rem 0.9rem', borderRadius: 8, border: '1.5px solid var(--border)',
            fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', outline: 'none',
            background: 'var(--surface)', fontWeight: 600
          }}
        />
      </div>

      {/* Message d'accueil */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>🎉 Message d&apos;accueil</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          Affiché aux clients sur la page de sélection de table. Laissez vide pour ne rien afficher.
        </div>
        <textarea
          value={welcome}
          onChange={e => setWelcome(e.target.value)}
          placeholder="Ex: Bienvenue à la soirée du 14 juillet ! Bonne dégustation 🎆"
          rows={3}
          style={{
            width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8,
            border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.88rem', outline: 'none', background: 'var(--surface)',
            resize: 'vertical', lineHeight: 1.5
          }}
        />
      </div>

      {/* Fidélité - multi-offres */}
      <LoyaltyOffersSection loyaltyMenu={loyaltyMenu} />

      {/* CHANGEMENT PIN */}
      <ChangePinSection />

      {/* GRAND ECRAN TV */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>📺 Grand écran TV</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          Affichez les numéros d&apos;emplacements prêts sur une TV ou un vidéoprojecteur.
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.82rem', marginBottom: '0.75rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          🔗 {window.location.origin}?ecran=1
        </div>
        <button onClick={() => window.open(window.location.origin + '?ecran=1', '_blank')} style={{ padding: '0.6rem 1.2rem', background: 'var(--text)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem' }}>
          📺 Ouvrir le grand écran
        </button>
      </div>

      {/* SUIVI DE COMMANDE */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>📍 Suivi de commande en direct</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '0.2rem' }}>
              Après le paiement, le client voit une page avec la progression de sa commande en temps réel.
            </div>
          </div>
          <button onClick={() => saveSetting('tracking_active', settings.tracking_active === 'true' ? 'false' : 'true')}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', background: settings.tracking_active === 'true' ? 'var(--green)' : 'var(--text2)', color: 'white', whiteSpace: 'nowrap' }}>
            {settings.tracking_active === 'true' ? '✅ Activé' : '⏸ Désactivé'}
          </button>
        </div>
      </div>

      {/* MESSAGE D'URGENCE */}
      <div style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.2rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>⚠️ Message d&apos;urgence</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
          S&apos;affiche en bandeau rouge sur tous les téléphones clients connectés. Idéal pour signaler une rupture de stock ou un changement.
        </div>
        <UrgentMessageAdmin />
      </div>

      <button onClick={save} style={{
        padding: '0.75rem 2rem', background: saved ? 'var(--green)' : 'var(--text)',
        color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
        fontWeight: 700, fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem',
        transition: 'background 0.3s'
      }}>
        {saved ? '✅ Enregistré !' : '💾 Enregistrer les paramètres'}
      </button>
    </div>
  );
}

// ─── ARCHIVES TAB ────────────────────────────────────────────────────────────
function ArchivesTab() {
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDate, setOpenDate] = useState(null);

  useEffect(() => {
    supabase.from('orders').select('*').eq('paid', true).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setAllOrders(data); setLoading(false); });
  }, []);

  // Grouper par soirée (par date)
  const byDate = {};
  allOrders.forEach(o => {
    const date = new Date(o.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(o);
  });

  const dates = Object.keys(byDate);

  if (loading) return <div className="empty-state"><div className="pulse">Chargement...</div></div>;
  if (dates.length === 0) return <div className="empty-state"><div className="empty-icon">🗄</div><div>Aucun historique disponible</div></div>;

  return (
    <div>
      {/* Stats globales */}
      {dates.length > 1 && (() => {
        const totaux = dates.map(d => byDate[d].reduce((s,o) => s + Number(o.total), 0));
        const meilleure = Math.max(...totaux);
        const moyenne = totaux.reduce((a,b) => a+b, 0) / totaux.length;
        const allItems = {};
        allOrders.forEach(o => o.items.forEach(it => {
          if (!allItems[it.name]) allItems[it.name] = { emoji: it.emoji, qty: 0 };
          allItems[it.name].qty += it.qty;
        }));
        const topAll = Object.entries(allItems).sort((a,b) => b[1].qty-a[1].qty)[0];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {[['🏆','Meilleure soirée', meilleure.toFixed(0)+' €'],['📊','Moyenne/soirée', moyenne.toFixed(0)+' €'],['⭐','Article star', topAll ? topAll[1].emoji+' '+topAll[0].split(' ')[0] : '-']].map(([icon,label,val]) => (
              <div key={label} style={{ background: 'var(--surface)', borderRadius: 12, padding: '0.9rem', border: '1.5px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', marginBottom: '0.2rem' }}>{icon}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{val}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text2)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
              </div>
            ))}
          </div>
        );
      })()}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
        Historique ({dates.length} soirée{dates.length > 1 ? 's' : ''})
      </div>
      {dates.map((date, idx) => {
        const orders = byDate[date];
        const total = orders.reduce((s, o) => s + Number(o.total), 0);
        const tips = orders.reduce((s, o) => s + Number(o.tip || 0), 0);
        const prevDate = dates[idx + 1];
        const prevTotal = prevDate ? byDate[prevDate].reduce((s,o) => s + Number(o.total), 0) : null;
        const diff = prevTotal ? ((total - prevTotal) / prevTotal * 100).toFixed(0) : null;
        const items = {};
        orders.forEach(o => o.items.forEach(it => {
          if (!items[it.name]) items[it.name] = { emoji: it.emoji, qty: 0 };
          items[it.name].qty += it.qty;
        }));
        const topItems = Object.entries(items).sort((a,b) => b[1].qty - a[1].qty).slice(0, 3);
        return (
          <div key={date} style={{ background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.1rem', marginBottom: '0.6rem' }}>
            <div onClick={() => setOpenDate(openDate === date ? null : date)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', textTransform: 'capitalize' }}>{openDate === date ? '▼' : '▶'} {date}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.1rem' }}>{orders.length} commandes</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{total.toFixed(2)} €</div>
                {diff && <div style={{ fontSize: '0.7rem', color: Number(diff) >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>{Number(diff) >= 0 ? '↑' : '↓'} {Math.abs(Number(diff))}% vs soirée précédente</div>}
                {tips > 0 && <div style={{ fontSize: '0.68rem', color: 'var(--text2)' }}>+{tips.toFixed(2)} € de dons</div>}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>🏆 {topItems.map(([name, d]) => `${d.emoji} ${name} ×${d.qty}`).join(' · ')}</div>
            <button onClick={() => setOpenDate(openDate === date ? null : date)}
              style={{ marginTop: '0.7rem', width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
              {openDate === date ? '▲ Masquer les articles vendus' : '▼ Voir tous les articles vendus'}
            </button>
            {openDate === date && (() => {
              const full = {};
              orders.forEach(o => o.items.forEach(it => {
                if (!full[it.name]) full[it.name] = { emoji: it.emoji, qty: 0, revenue: 0 };
                full[it.name].qty += it.qty; full[it.name].revenue += it.qty * Number(it.price || 0);
              }));
              const list = Object.entries(full).sort((a, b) => b[1].qty - a[1].qty);
              return (
                <div style={{ marginTop: '0.6rem' }}>
                  {list.map(([name, d]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text)' }}>
                      <span style={{ fontSize: '1.2rem', width: 28, textAlign: 'center' }}>{d.emoji}</span>
                      <span style={{ flex: 1 }}>{name}</span>
                      <span style={{ fontWeight: 700 }}>×{d.qty}</span>
                      <span style={{ width: 70, textAlign: 'right', color: 'var(--text2)' }}>{d.revenue.toFixed(2)} €</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)' }}>
                    <span>Total articles</span><span>{list.reduce((s, [, d]) => s + d.qty, 0)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminView() {
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'Plats', price: '', emoji: '🍽' });
  const [activeTab, setActiveTab] = useState('menu');
  const [resetting, setResetting] = useState(false);
  const appUrl = window.location.origin;
  const settings = useSettings();

  const loadOrders = () => supabase.from('orders').select('*').then(({ data }) => data && setOrders(data));

  useEffect(() => {
    const loadMenu = () => supabase.from('menu').select('*').order('position', { ascending: true, nullsFirst: false }).then(({ data }) => data && setMenu(data));
    loadMenu();
    loadOrders();
    const ch = supabase.channel('admin-menu-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu' }, (p) => {
        setMenu(m => m.map(i => i.id === p.new.id ? { ...i, ...p.new } : i));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const paidOrders = orders.filter(o => o.paid);
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
  const todayOrders = paidOrders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length;
  const pending = paidOrders.filter(o => o.status !== 'servi').length;

  const [salesDate, setSalesDate] = useState('all');
  const soireeKey = (o) => new Date(o.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const soireeDates = [...new Set([...paidOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(soireeKey))];
  const salesOrders = salesDate === 'all' ? paidOrders : paidOrders.filter(o => soireeKey(o) === salesDate);
  const salesTotal = salesOrders.reduce((s, o) => s + Number(o.total), 0);
  const salesByItem = {};
  salesOrders.forEach(order => {
    order.items.forEach(item => {
      if (!salesByItem[item.name]) salesByItem[item.name] = { name: item.name, emoji: item.emoji, qty: 0, revenue: 0 };
      salesByItem[item.name].qty += item.qty;
      salesByItem[item.name].revenue += item.qty * item.price;
    });
  });
  const salesList = Object.values(salesByItem).sort((a, b) => b.qty - a.qty);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const addItem = async () => {
    if (!form.name || !form.price) return;
    const { stock: formStock, ...formRest } = form;
    const stockVal = formStock === undefined || formStock === '' ? null : Math.max(0, parseInt(formStock) || 0);
    const { data } = await supabase.from('menu').insert({ ...formRest, price: parseFloat(form.price), available: stockVal !== 0, stock: stockVal }).select();
    if (data) { setMenu(m => [...m, data[0]]); setForm({ name: '', category: 'Plats', price: '', emoji: '🍽', stock: '' }); }
  };

  const delItem = async (id) => {
    await supabase.from('menu').delete().eq('id', id);
    setMenu(m => m.filter(i => i.id !== id));
  };

  const toggleAvail = async (item) => {
    await supabase.from('menu').update({ available: !item.available }).eq('id', item.id);
    setMenu(m => m.map(i => i.id === item.id ? { ...i, available: !i.available } : i));
  };

  const updateStock = async (item, newStock) => {
    if (newStock === null) {
      await supabase.from('menu').update({ stock: null, available: true }).eq('id', item.id);
      setMenu(m => m.map(i => i.id === item.id ? { ...i, stock: null, available: true } : i));
    } else {
      const stock = Math.max(0, newStock);
      await supabase.from('menu').update({ stock, available: stock > 0 }).eq('id', item.id);
      setMenu(m => m.map(i => i.id === item.id ? { ...i, stock, available: stock > 0 } : i));
    }
  };

  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e, id) => { e.preventDefault(); setDragOver(id); };
  const onDragEnd = () => { setDragId(null); setDragOver(null); };

  const onDrop = async (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { onDragEnd(); return; }
    const newMenu = [...menu];
    const fromIdx = newMenu.findIndex(i => i.id === dragId);
    const toIdx = newMenu.findIndex(i => i.id === targetId);
    // Réordonner localement
    const [moved] = newMenu.splice(fromIdx, 1);
    newMenu.splice(toIdx, 0, moved);
    // Sauvegarder les nouvelles positions
    const updates = newMenu.map((item, pos) => ({ id: item.id, position: pos }));
    setMenu(newMenu.map((item, pos) => ({ ...item, position: pos })));
    for (const u of updates) {
      await supabase.from('menu').update({ position: u.position }).eq('id', u.id);
    }
    onDragEnd();
  };

  const moveItem = async (id, direction) => {
    const idx = menu.findIndex(i => i.id === id);
    const newMenu = [...menu];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newMenu.length) return;
    const posA = newMenu[idx].position ?? idx;
    const posB = newMenu[swapIdx].position ?? swapIdx;
    await supabase.from('menu').update({ position: posB }).eq('id', newMenu[idx].id);
    await supabase.from('menu').update({ position: posA }).eq('id', newMenu[swapIdx].id);
    [newMenu[idx], newMenu[swapIdx]] = [newMenu[swapIdx], newMenu[idx]];
    newMenu[idx] = { ...newMenu[idx], position: posA };
    newMenu[swapIdx] = { ...newMenu[swapIdx], position: posB };
    setMenu(newMenu);
  };

  const duplicateItem = async (item) => {
    const { id, created_at, ...rest } = item;
    const maxPos = menu.reduce((m, i) => Math.max(m, i.position ?? 0), 0);
    const { data, error } = await supabase.from('menu').insert({ ...rest, name: item.name + ' (copie)', position: maxPos + 1 }).select();
    if (error || !data) { alert('Impossible de dupliquer : ' + (error?.message || '')); return; }
    setMenu(m => [...m, data[0]]);
    startEdit(data[0]);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      price: String(item.price),
      emoji: item.emoji,
      category: item.category,
      extras: item.extras || [],
      ingredients: item.ingredients || '',
      badge: (() => { try { return (JSON.parse(settings.menu_badges || '{}') || {})[item.id] || ''; } catch (e) { return ''; } })(),
      suggest: (() => { try { return (JSON.parse(settings.menu_suggest || '{}') || {})[item.id] || ''; } catch (e) { return ''; } })(),
    });
  };

  const saveEdit = async (id) => {
    if (!editForm.name || !editForm.price) return;
    const updates = {
      name: editForm.name,
      price: parseFloat(editForm.price),
      emoji: editForm.emoji,
      category: editForm.category,
      extras: (editForm.extras || []).map(e => ({ name: e.name, price: parseFloat(e.price) || 0 })),
      ingredients: editForm.ingredients || ''
    };
    const { error } = await supabase.from('menu').update(updates).eq('id', id);
    if (!error) {
      const upd = async (key, val) => {
        let obj = {};
        try { obj = JSON.parse(settings[key] || '{}') || {}; } catch (e) {}
        if (val) obj[id] = val; else delete obj[id];
        await saveSetting(key, JSON.stringify(obj));
      };
      await upd('menu_badges', editForm.badge || '');
      await upd('menu_suggest', editForm.suggest || '');
    }
    if (error) { console.error('Erreur saveEdit:', error); alert('Erreur lors de la sauvegarde : ' + error.message); return; }
    setMenu(m => m.map(i => i.id === id ? { ...i, ...updates } : i));
    setEditingId(null);
  };

  const handleReset = async () => {
    if (!window.confirm('⚠️ Supprimer TOUTES les commandes de la soirée ? Cette action est irréversible.')) return;
    setResetting(true);
    await supabase.from('orders').delete().neq('id', 0);
    setOrders([]);
    setResetting(false);
    setActiveTab('menu');
    alert('✅ Remise à zéro effectuée ! Prêt pour la prochaine soirée.');
  };

  const tabStyle = (tab) => ({
    padding: '0.5rem 1.2rem', borderRadius: 100, border: '1.5px solid var(--border)',
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.85rem',
    background: activeTab === tab ? 'var(--text)' : 'white',
    color: activeTab === tab ? 'white' : 'var(--text)',
    transition: 'all 0.2s'
  });

  return (
    <div className="admin-wrap">
      <div className="view-title">⚙️ Administration</div>
      <div className="view-sub">Gérez votre restaurant</div>

      <div className="admin-grid">
        <div className="stat-card"><div className="stat-num">{todayOrders}</div><div className="stat-label">Commandes du soir</div></div>
        <div className="stat-card"><div className="stat-num">{pending}</div><div className="stat-label">En cours</div></div>
        <div className="stat-card"><div className="stat-num">{totalRevenue.toFixed(0)} €</div><div className="stat-label">CA total</div></div>
      </div>

      {/* Bouton ON/OFF rapide */}
      {(() => {
        const isClosed = settings.closed === 'true';
        return (
          <div
            onClick={() => saveSetting('closed', isClosed ? 'false' : 'true')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem', borderRadius: 14, marginBottom: '1.25rem', cursor: 'pointer',
              background: isClosed ? '#FFF5F5' : '#F0FFF4',
              border: `2px solid ${isClosed ? '#FECACA' : '#86EFAC'}`,
              transition: 'all 0.2s',
              userSelect: 'none',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isClosed ? '#DC2626' : '#16A34A' }}>
                {isClosed ? '🔒 Commandes fermées' : '🟢 Commandes ouvertes'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.15rem' }}>
                {isClosed ? 'Appuyez pour rouvrir' : 'Appuyez pour fermer'}
              </div>
            </div>
            <div style={{
              width: 52, height: 28, borderRadius: 100,
              background: isClosed ? '#FCA5A5' : '#4ADE80',
              position: 'relative', transition: 'background 0.3s', flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: 2,
                left: isClosed ? 2 : 26,
                width: 24, height: 24, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                transition: 'left 0.3s',
              }} />
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0 1rem', flexWrap: 'wrap' }}>
        <button style={tabStyle('menu')} onClick={() => setActiveTab('menu')}>🍽 Menu</button>
        <button style={tabStyle('historique')} onClick={() => setActiveTab('historique')}>📊 Historique</button>
        <button style={tabStyle('qr')} onClick={() => setActiveTab('qr')}>📱 QR Code</button>
        <button style={tabStyle('archives')} onClick={() => setActiveTab('archives')}>🗄 Archives</button>
        <button style={tabStyle('config')} onClick={() => setActiveTab('config')}>🛠 Config</button>
        <button style={tabStyle('theme')} onClick={() => setActiveTab('theme')}>🎨 Thème</button>
        <button style={tabStyle('promos')} onClick={() => setActiveTab('promos')}>🏷 Promos</button>
        <button style={tabStyle('dashboard')} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button style={tabStyle('caisse')} onClick={() => setActiveTab('caisse')}>🧾 Caisse</button>
        <button style={tabStyle('fidelite')} onClick={() => setActiveTab('fidelite')}>💎 Fidélité</button>
        <button style={tabStyle('ecran')} onClick={() => setActiveTab('ecran')}>📺 Écran</button>
        <button style={tabStyle('test')} onClick={() => setActiveTab('test')}>🧪 Test</button>
      </div>

      {/* TAB MENU */}
      {activeTab === 'menu' && <>
        <div className="section-title">Menu ({menu.length} articles)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1rem', alignItems: 'start' }}>
        {[true, false].map(av => (
          <div key={String(av)} style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderRadius: 8, background: av ? '#E8FFE8' : '#F0F0F0', color: av ? '#0B3D0B' : '#666' }}>
              {av ? '✅ Activés' : '⏸ Désactivés'} ({menu.filter(m => !!m.available === av).length})
            </div>
        {(() => {
          const order = ['Boissons sans alcool', 'Boissons alcoolisées', 'Boissons', 'Entrées', 'Plats', 'Desserts'];
          const cats = [...new Set(menu.filter(m => !!m.available === av).map(m => m.category))]
            .sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
          return cats.map(cat => (
            <div key={cat}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)', margin: '0.9rem 0 0.4rem', paddingBottom: 3, borderBottom: '1.5px solid var(--border)' }}>
                {cat} ({menu.filter(m => !!m.available === av && m.category === cat).length})
              </div>
        {menu.map((item, idx) => (!!item.available !== av || item.category !== cat) ? null : (
          <div key={item.id}>
            {editingId === item.id ? (
              <div style={{ background: '#FFFBF0', border: '2px solid var(--gold)', borderRadius: 12, padding: '1rem', marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--gold)' }}>✏️ Modifier "{item.name}"</div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Catégorie</label>
                    <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                      {['Entrées', 'Plats', 'Desserts', 'Boissons sans alcool', 'Boissons alcoolisées', 'Boissons'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>Nom du plat</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="form-field">
                    <label>Prix (€)</label>
                    <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                  </div>
                </div>
                {/* Sélecteur emoji visuel */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.4rem' }}>
                    Emoji — sélectionné : <span style={{ fontSize: '1.2rem' }}>{editForm.emoji}</span>
                  </label>
                  {[
                    { label: '🥗 Entrées', emojis: ['🥗','🍲','🧅','🫕','🥚','🧀','🍱','🥙','🫙','🥣','🐟','🦐','🥓','🫛','🍄','🥕','🧆','🫔','🥬','🫑','🥒','🍅','🧄','🫘'] },
                    { label: '🍽 Plats', emojis: ['🥩','🍗','🍖','🌮','🍝','🍜','🍛','🥘','🐓','🦞','🦑','🌯','🍔','🌭','🍕','🥫','🍚','🫓','🥪','🌽','🍣','🍤','🦀','🐠'] },
                    { label: '🧇 Snacks', emojis: ['🧇','🥞','🧈','🥐','🥖','🫓','🥨','🧀','🌰','🍿','🥜','🫔','🌮','🌯'] },
                    { label: '🍮 Desserts', emojis: ['🍮','🍫','🧁','🎂','🍰','🍩','🍪','🥧','🍨','🍦','🍬','🍭','🍯','🫐','🍓','🍒','🍑','🥝','🍇','🍉','🍊','🍋','🍌','🍎'] },
                    { label: '🍷 Vins', emojis: ['🍷','🍸','🥂','🍾','🫗'] },
                    { label: '🍺 Bières', emojis: ['🍺','🍻','🫗'] },
                    { label: '🥃 Cocktails', emojis: ['🥃','🍸','🍹','🧉','🍶'] },
                    { label: '☕ Chauds', emojis: ['☕','🍵','🫖','🧋'] },
                    { label: '🥤 Froids', emojis: ['🥤','🧃','💧','🧊','🥛','🍋'] },
                    { label: '➕ Autres', emojis: ['🎉','⭐','🔥','✨','💯','🏆','👌','😋','🤤','❤️','🌿','🫶','🎊','🪄','💎','🌟','🎪','🎭','🎈'] },
                  ].map(group => (
                    <div key={group.label} style={{ marginBottom: '0.4rem' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text2)', marginBottom: '0.2rem', fontWeight: 600 }}>{group.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {group.emojis.map(e => (
                          <button key={e} type="button" onClick={() => setEditForm(f => ({ ...f, emoji: e }))}
                            style={{
                              width: 34, height: 34, fontSize: '1.1rem', borderRadius: 7, cursor: 'pointer',
                              border: editForm.emoji === e ? '2px solid var(--accent2)' : '1.5px solid var(--border)',
                              background: editForm.emoji === e ? '#FFF8EE' : 'var(--bg)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.1s', transform: editForm.emoji === e ? 'scale(1.15)' : 'none'
                            }}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                  <label>Ingrédients (optionnel)</label>
                  <input value={editForm.ingredients || ''} onChange={e => setEditForm(f => ({ ...f, ingredients: e.target.value }))} placeholder="Ex: Tomates, poivrons, ketchup..." />
                </div>
                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <div className="form-field">
                    <label>Badge (optionnel)</label>
                    <select value={editForm.badge || ''} onChange={e => setEditForm(f => ({ ...f, badge: e.target.value }))}>
                      <option value="">Aucun</option>
                      <option value="hot">🔥 Le plus commandé</option>
                      <option value="fav">⭐ Coup de cœur</option>
                      <option value="new">🆕 Nouveau</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Suggérer avec ce produit</label>
                    <select value={editForm.suggest || ''} onChange={e => setEditForm(f => ({ ...f, suggest: e.target.value }))}>
                      <option value="">Aucune suggestion</option>
                      {menu.filter(m => m.id !== editingId).map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                    </select>
                  </div>
                </div>
                {/* Suppléments */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text2)', marginBottom: '0.4rem' }}>➕ Suppléments disponibles</div>
                  {(editForm.extras || []).map((ex, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', alignItems: 'center' }}>
                      <input value={ex.name} onChange={e => {
                        const extras = [...(editForm.extras||[])]; extras[i] = {...extras[i], name: e.target.value};
                        setEditForm(f => ({...f, extras}));
                      }} placeholder="Ex: Chantilly" style={{ flex: 2, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', outline: 'none', background: 'var(--surface)' }} />
                      <input type="number" value={ex.price} onChange={e => {
                        const extras = [...(editForm.extras||[])]; extras[i] = {...extras[i], price: e.target.value};
                        setEditForm(f => ({...f, extras}));
                      }} placeholder="0.50" style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: 6, border: '1.5px solid var(--border)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', outline: 'none', background: 'var(--surface)' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>€</span>
                      <button onClick={() => setEditForm(f => ({...f, extras: f.extras.filter((_,j) => j!==i)}))}
                        style={{ padding: '0.3rem 0.5rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--red)', fontSize: '0.8rem' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setEditForm(f => ({...f, extras: [...(f.extras||[]), {name:'', price:''}]}))}
                    style={{ padding: '0.3rem 0.8rem', background: 'var(--surface)', border: '1.5px dashed var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'DM Sans', sans-serif", color: 'var(--text)' }}>
                    + Ajouter un supplément
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => saveEdit(item.id)} style={{ padding: '0.5rem 1.2rem', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>✅ Enregistrer</button>
                  <button onClick={() => setEditingId(null)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Annuler</button>
                </div>
              </div>
            ) : (
              <div className="menu-admin-item"
                  draggable
                  onDragStart={() => onDragStart(item.id)}
                  onDragOver={(e) => onDragOver(e, item.id)}
                  onDrop={(e) => onDrop(e, item.id)}
                  onDragEnd={onDragEnd}
                  style={{
                    cursor: 'grab',
                    opacity: dragId === item.id ? 0.4 : 1,
                    borderColor: dragOver === item.id ? 'var(--accent2)' : undefined,
                    borderStyle: dragOver === item.id ? 'dashed' : undefined,
                    transform: dragOver === item.id ? 'scale(1.01)' : 'none',
                    transition: 'all 0.15s ease',
                    background: dragOver === item.id ? 'var(--surface)' : undefined,
                  }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0, marginRight: '0.25rem' }}>
                  <button onClick={() => moveItem(item.id, 'up')} disabled={idx === 0}
                    style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text)', padding: 0 }}>▲</button>
                  <button onClick={() => moveItem(item.id, 'down')} disabled={idx === menu.length - 1}
                    style={{ width: 22, height: 22, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', cursor: idx === menu.length - 1 ? 'not-allowed' : 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === menu.length - 1 ? 0.3 : 1, color: 'var(--text)', padding: 0 }}>▼</button>
                </div>
                <div style={{ color: '#CCC', fontSize: '1rem', cursor: 'grab', padding: '0 0.15rem', flexShrink: 0, userSelect: 'none', letterSpacing: '-2px' }} title="Glisser pour réordonner">⠿</div>
                <span style={{ fontSize: '1.3rem' }}>{item.emoji}</span>
                <div className="menu-admin-info">
                  <div className="menu-admin-name">{item.name}</div>
                  <div className="menu-admin-cat">{item.category}</div>
                </div>
                <span className="menu-admin-price">{Number(item.price).toFixed(2)} €</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--surface)', borderRadius: 8, padding: '0.2rem 0.4rem', border: '1.5px solid var(--border)' }}>
                  <button
                    onClick={() => {
                      if (item.stock === null || item.stock === undefined) return;
                      if (item.stock <= 0) updateStock(item, null);
                      else updateStock(item, item.stock - 1);
                    }}
                    title="Réduire le stock (à 0 = illimité)"
                    style={{ width: 20, height: 20, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>−</button>
                  <input type="number" min="0" key={String(item.stock)}
                    defaultValue={item.stock === null || item.stock === undefined ? '' : item.stock}
                    placeholder="∞" title="Quantité disponible (vide = illimité)"
                    onBlur={e => {
                      const v = e.target.value.trim();
                      const nv = v === '' ? null : Math.max(0, parseInt(v) || 0);
                      if (nv !== (item.stock ?? null)) updateStock(item, nv, true);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                    style={{ width: 46, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, border: 'none', background: 'transparent', color: 'var(--text)', outline: 'none' }} />
                  <button onClick={() => updateStock(item, (item.stock ?? 0) + 1)} style={{ width: 20, height: 20, border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>+</button>
                </div>
                <button className={`avail-toggle ${item.available ? 'on' : 'off'}`} onClick={() => toggleAvail(item)}>
                  {item.available ? '✓ Dispo' : '✗ Indispo'}
                </button>
                <button onClick={() => startEdit(item)} style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--blue)', transition: 'all 0.2s' }}>✏️</button>
                <button onClick={() => duplicateItem(item)} title="Dupliquer ce produit" style={{ padding: '0.3rem 0.6rem', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text)' }}>📋</button>
                <button className="del-btn" onClick={() => delItem(item.id)}>✕</button>
              </div>
            )}
          </div>
        ))}
            </div>
          ));
        })()}
          </div>
        ))}
        </div>
        <div className="add-item-form">
          <div style={{ fontWeight: 600, marginBottom: '0.8rem', fontSize: '0.9rem' }}>+ Ajouter un plat</div>

          {/* Sélecteur d'emoji par catégorie */}
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text2)', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>Choisir un emoji</label>
            {[
              { label: '🥗 Entrées & Salades', emojis: ['🥗','🍲','🧅','🫕','🥚','🧀','🍱','🥙','🫙','🥣','🐟','🦐','🥓','🫛','🍄','🥕','🧆','🫔','🥬','🫑','🥒','🍅','🧄','🫘'] },
              { label: '🍽 Plats principaux', emojis: ['🥩','🍗','🍖','🌮','🍝','🍜','🍛','🥘','🐓','🦞','🦑','🌯','🍔','🌭','🍕','🥫','🍚','🫓','🥪','🌽','🫚','🍣','🍤','🦀','🐠','🥩'] },
              { label: '🧇 Snacks & Petite restauration', emojis: ['🧇','🥞','🧈','🥐','🥖','🫓','🥨','🧀','🌰','🍿','🥜','🫙','🫔','🌮','🌯','🥙','🍱'] },
              { label: '🍮 Desserts & Sucreries', emojis: ['🍮','🍫','🧁','🎂','🍰','🍩','🍪','🥧','🍨','🍦','🍬','🍭','🍯','🫐','🍓','🍒','🍑','🥝','🍇','🍉','🍊','🍋','🍌','🍎','🍐','🥭','🍍','🥥','🍔'] },
              { label: '🍷 Vins', emojis: ['🍷','🍸','🥂','🍾','🫗'] },
              { label: '🍺 Bières', emojis: ['🍺','🍻','🫗'] },
              { label: '🥃 Spiritueux & Cocktails', emojis: ['🥃','🍸','🍹','🧉','🫗','🍶'] },
              { label: '☕ Boissons chaudes', emojis: ['☕','🍵','🫖','🧋'] },
              { label: '🥤 Boissons froides & Softs', emojis: ['🥤','🧃','💧','🫗','🧊','🥛','🍋'] },
              { label: '➕ Autres', emojis: ['🎉','⭐','🔥','✨','💯','🏆','👌','😋','🤤','❤️','🌿','🫶','🎊','🪄','💎','🌟','🎪','🎭','🎈'] },
            ].map(group => (
              <div key={group.label} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text2)', marginBottom: '0.3rem' }}>{group.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {group.emojis.map(e => (
                    <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                      style={{
                        width: 36, height: 36, fontSize: '1.2rem', borderRadius: 8, cursor: 'pointer',
                        border: form.emoji === e ? '2px solid var(--gold)' : '1.5px solid var(--border)',
                        background: form.emoji === e ? '#FFF8EE' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s'
                      }}
                    >{e}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--surface)', borderRadius: 8, border: '1.5px solid var(--border)' }}>
            <span style={{ fontSize: '1.4rem' }}>{form.emoji}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>Emoji sélectionné</span>
          </div>

          <div className="form-row">
            <div className="form-field"><label>Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {['Entrées', 'Plats', 'Desserts', 'Boissons sans alcool', 'Boissons alcoolisées', 'Boissons'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field"><label>Prix (€)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" /></div>
            <div className="form-field"><label>Quantité (option)</label><input type="number" min="0" value={form.stock || ''} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="∞ illimité" /></div>
          </div>
          <div className="form-field" style={{ marginBottom: '0.75rem' }}>
            <label>Nom du plat</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Tiramisu" />
          </div>
          <button className="add-btn" onClick={addItem}>Ajouter au menu</button>
        </div>
      </>}

      {/* TAB HISTORIQUE */}
      {activeTab === 'historique' && <>
        <div className="section-title">Articles vendus</div>
        <select value={salesDate} onChange={e => setSalesDate(e.target.value)}
          style={{ width: '100%', padding: '0.65rem', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', textTransform: 'capitalize' }}>
          <option value="all">📅 Toutes les soirées</option>
          {soireeDates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {salesList.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📊</div><div>Aucune vente pour le moment</div></div>
        ) : <>
          {salesList.map((item, i) => (
            <div key={i} className="menu-admin-item">
              <span style={{ fontSize: '1.3rem' }}>{item.emoji}</span>
              <div className="menu-admin-info">
                <div className="menu-admin-name">{item.name}</div>
                <div className="menu-admin-cat">{item.qty} vendus</div>
              </div>
              <span className="menu-admin-price">{item.revenue.toFixed(2)} €</span>
            </div>
          ))}
          {/* Récap financier */}
          <div style={{ background: 'var(--text)', color: 'white', borderRadius: 12, padding: '1rem 1.2rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>Total commandes</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: 'var(--gold)' }}>{salesTotal.toFixed(2)} €</span>
            </div>
            {(() => { const tips = salesOrders.reduce((s,o) => s + Number(o.tip||0), 0); return tips > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderTop: '1px solid #333', paddingTop: '0.5rem' }}>
                <span style={{ color: '#aaa', fontSize: '0.88rem' }}>dont dons A.P.E</span>
                <span style={{ color: '#C8953A', fontWeight: 600 }}>+{tips.toFixed(2)} €</span>
              </div>
            );})()}
            {(() => { const nef = salesOrders.reduce((s,o) => s + Number(o.tip_nef||0), 0); return nef > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderTop: '1px solid #333', paddingTop: '0.5rem' }}>
                <span style={{ color: '#aaa', fontSize: '0.88rem' }}>dont dons Noisy en Fête</span>
                <span style={{ color: '#C8953A', fontWeight: 600 }}>+{nef.toFixed(2)} €</span>
              </div>
            );})()}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #333', paddingTop: '0.5rem' }}>
              <span style={{ fontWeight: 700 }}>Total encaissé</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: 'var(--gold)' }}>
                {(salesTotal + salesOrders.reduce((s,o) => s + Number(o.tip||0) + Number(o.tip_nef||0), 0)).toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Rapport de fin de soirée */}
          {salesOrders.length > 0 && (() => {
            const tips = salesOrders.reduce((s,o) => s + Number(o.tip||0), 0);
            const times = salesOrders.map(o => new Date(o.created_at));
            const start = new Date(Math.min(...times)).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const end = new Date(Math.max(...times)).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const topTable = Object.entries(salesOrders.reduce((acc, o) => {
              acc[o.table_num] = (acc[o.table_num] || 0) + Number(o.total);
              return acc;
            }, {})).sort((a,b) => b[1]-a[1])[0];
            const topItem = salesList[0];
            return (
              <div style={{ background: '#F0F7FF', border: '1.5px solid #BDD0F5', borderRadius: 14, padding: '1.2rem', marginTop: '1rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.8rem', color: 'var(--blue)', fontSize: '0.95rem' }}>📋 Rapport de soirée</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {[
                    ['🕐 Première commande', start],
                    ['🕐 Dernière commande', end],
                    ['🪑 Table top dépense', `Table ${topTable?.[0]} (${Number(topTable?.[1]||0).toFixed(2)} €)`],
                    ['🏆 Plat le + vendu', topItem ? `${topItem.emoji} ${topItem.name} ×${topItem.qty}` : '-'],
                    ['🧾 Nb commandes', salesOrders.length],
                    ['🙏 Pourboires', `${tips.toFixed(2)} €`],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: 'white', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>{label}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.2rem' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="section-title" style={{ marginTop: '1.5rem' }}>Détail des commandes ({salesOrders.length})</div>
          {salesOrders.slice().reverse().map(order => (
            <div key={order.id} style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontWeight: 600 }}>Table {order.table_num} — #{order.id}</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{Number(order.total).toFixed(2)} €</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                {order.items.map((it, i) => `${it.emoji} ${it.name} ×${it.qty}`).join(' · ')}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#ccc', marginTop: '0.3rem' }}>
                {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {order.status}
              </div>
            </div>
          ))}

          {/* Export Excel */}
          <div style={{ marginTop: '1.5rem', padding: '1.2rem', background: '#EEF4FF', border: '1.5px solid #BDD0F5', borderRadius: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--blue)' }}>📥 Export Excel</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '0.75rem' }}>
              Télécharger toutes les commandes de la soirée en fichier Excel.
            </p>
            <button onClick={() => {
              const rows = [['#', 'Table', 'Heure', 'Articles', 'Total €', 'Pourboire €', 'Statut']];
              salesOrders.forEach(o => {
                rows.push([
                  o.id,
                  o.table_num,
                  new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                  o.items.map(i => `${i.name} x${i.qty}`).join(' | '),
                  Number(o.total).toFixed(2),
                  Number(o.tip || 0).toFixed(2),
                  o.status
                ]);
              });
              const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
              const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `noisy-en-fete-${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`;
              a.click(); URL.revokeObjectURL(url);
            }} style={{ padding: '0.6rem 1.2rem', background: 'var(--blue)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              📥 Télécharger le fichier Excel
            </button>
          </div>

          <div style={{ marginTop: '1rem', padding: '1.2rem', background: '#FFF5F5', border: '1.5px solid #F5C6CB', borderRadius: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.4rem', color: 'var(--red)' }}>🔄 Remise à zéro</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginBottom: '1rem' }}>
              Efface toutes les commandes de la soirée. À faire en fin de service, avant la prochaine soirée.
            </p>
            <button onClick={handleReset} disabled={resetting} style={{
              padding: '0.7rem 1.5rem', background: 'var(--red)', color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", opacity: resetting ? 0.6 : 1
            }}>
              {resetting ? '⏳ Remise à zéro...' : '🗑 Effacer toutes les commandes'}
            </button>
          </div>
        </>}
      </>}


      {/* TAB CONFIG */}
      {activeTab === 'config' && <ConfigTab />}

      {/* TAB THEME */}
      {activeTab === 'theme' && <ThemeTab />}

      {/* TAB PROMOS */}
      {activeTab === 'promos' && <PromosTab />}

      {/* TAB DASHBOARD */}
      {activeTab === 'dashboard' && <DashboardTab />}

      {/* TAB CAISSE */}
      {activeTab === 'caisse' && <CaisseTab />}

      {/* TAB FIDELITE */}
      {activeTab === 'fidelite' && <FideliteTab />}

      {/* TAB ECRAN */}
      {activeTab === 'ecran' && <EcranTab />}

      {/* TAB TEST */}
      {activeTab === 'test' && <TestTab />}
      {/* TAB ARCHIVES */}
      {activeTab === 'archives' && <ArchivesTab />}

      {/* TAB QR */}
      {activeTab === 'qr' && <>
        <div className="section-title">QR Code unique</div>
        <div className="qr-section">
          <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginBottom: '0.5rem' }}>
            Un seul QR code pour toutes les tables. Le client choisit son numéro à l'arrivée.
          </p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appUrl)}&bgcolor=ffffff&color=1A1208`}
            alt="QR Code" width={200} height={200}
            style={{ display: 'block', margin: '1rem auto', borderRadius: 8 }}
          />
          <div className="qr-url">{appUrl}</div>
          <button className="print-btn" onClick={() => window.print()}>🖨 Imprimer le QR Code</button>
        </div>
      </>}
    </div>
  );
}

// ─── PIN MODAL ────────────────────────────────────────────────────────────────
let STAFF_PIN = '917764'; // Modifiable via Config

function PinModal({ title, onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const check = () => {
    if (pin === STAFF_PIN) { onSuccess(); }
    else { setError(true); setPin(''); setTimeout(() => setError(false), 1000); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '2rem', width: 280, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🔒</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', marginBottom: '1.2rem' }}>{title}</div>
        <input
          type="password" value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="Code PIN" maxLength={6} autoFocus
          style={{
            width: '100%', padding: '0.75rem', borderRadius: 10, textAlign: 'center',
            border: error ? '2px solid #8B2020' : '2px solid #E8E0D4',
            fontSize: '1.2rem', letterSpacing: '0.3em', outline: 'none',
            background: error ? '#FFF0F0' : '#FAF7F2',
            fontFamily: "'DM Sans', sans-serif", marginBottom: '1rem',
            transition: 'border-color 0.2s, background 0.2s'
          }}
        />
        {error && <div style={{ color: '#8B2020', fontSize: '0.82rem', marginBottom: '0.8rem' }}>Code incorrect</div>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1.5px solid #E8E0D4', background: 'white', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Annuler</button>
          <button onClick={check} style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: 'none', background: '#C8953A', color: 'white', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Entrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('client');
  const [pinTarget, setPinTarget] = useState(null);
  const [visualTheme, setVisualTheme] = useState(() => localStorage.getItem('nef-visual-theme') || 'light');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const appSettings = useSettings();
  useTheme();

  useEffect(() => {
    // Capturer l'événement beforeinstallprompt
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    // Détecter si déjà installée
    window.addEventListener('appinstalled', () => setAppInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setAppInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Grand écran TV accessible via ?ecran=1
  if (new URLSearchParams(window.location.search).get('ecran') === '1') return <GrandEcran />;

  // Suivi de commande direct via ?tracking=ID&table=N
  const trackingId = new URLSearchParams(window.location.search).get('tracking');
  const trackingTable = new URLSearchParams(window.location.search).get('table');
  if (trackingId) return (
    <OrderTracking
      orderId={parseInt(trackingId)}
      tableNum={parseInt(trackingTable) || 1}
      onNewOrder={() => window.location.href = window.location.origin}
    />
  );

  // Appliquer le thème visuel
  useEffect(() => {
    const t = VISUAL_THEMES[visualTheme];
    if (t) Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    const ev = EVENT_THEMES[appSettings.event_theme || 'none'];
    if (ev && ev[visualTheme]) Object.entries(ev[visualTheme]).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    document.body.style.background = t?.['--bg'] || '#FAFAF8';
    localStorage.setItem('nef-visual-theme', visualTheme);
  }, [visualTheme, appSettings.event_theme]);

  const requestView = (target) => {
    if (target === 'client') { setView('client'); return; }
    setPinTarget(target);
  };

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav className="nav">
          <span className="nav-title" onClick={() => { setView('client'); }} style={{ cursor: 'pointer' }}>
            <img src="/icon32.png" alt="" style={{ width: 42, height: 42, verticalAlign: 'middle', marginRight: '0.5rem', borderRadius: '50%' }} />
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, letterSpacing: '-0.01em' }}>{RESTAURANT}</span>
          </span>
          <div className="theme-switcher">
            <button className={`theme-switch-btn ${visualTheme === 'light' ? 'active' : ''}`} onClick={() => setVisualTheme('light')} title="Thème clair">☀️</button>
            <button className={`theme-switch-btn ${visualTheme === 'dark' ? 'active' : ''}`} onClick={() => setVisualTheme('dark')} title="Thème sombre">🌙</button>
          </div>
          <button className={`nav-btn ${view === 'client' ? 'active' : ''}`} onClick={() => requestView('client')}>📱</button>
          <button className={`nav-btn ${view === 'kitchen' ? 'active' : ''}`} onClick={() => requestView('kitchen')}>🍳</button>
          <button className={`nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => requestView('admin')}>⚙️</button>
        </nav>
        {view === 'client' && <><UrgentBanner /><EventBanner /><ChallengeBar /><ClientView installPrompt={installPrompt} appInstalled={appInstalled} setAppInstalled={setAppInstalled} /></>}
        {view === 'kitchen' && <KitchenView />}
        {view === 'admin' && <AdminView />}
        <footer style={{
          padding: '1rem 1.5rem', fontSize: '0.72rem',
          color: 'var(--text2)', borderTop: '1px solid var(--border)',
          marginTop: '2rem', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap'
        }}>
          <a href="https://noisyenfete.fr" target="_blank" rel="noreferrer"
            style={{ color: 'var(--accent2)', fontWeight: 700, textDecoration: 'none' }}>
            noisyenfete.fr
          </a>
          <span style={{ color: 'var(--border)' }}>·</span>
          <a href="mailto:noisyenfete@gmail.com"
            style={{ color: 'var(--accent2)', fontWeight: 600, textDecoration: 'none' }}>
            Prendre contact
          </a>
        </footer>
        {pinTarget && (
          <PinModal
            title={pinTarget === 'kitchen' ? 'Accès Cuisine' : 'Accès Administration'}
            onSuccess={() => { setView(pinTarget); setPinTarget(null); }}
            onClose={() => setPinTarget(null)}
          />
        )}
      </div>
    </>
  );
}
