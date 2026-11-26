import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowDownWideNarrow,
  Award,
  BookOpen,
  Check,
  ArrowUpCircle,
  Combine,
  Cpu,
  Factory,
  Gift,
  Image as ImageIcon,
  Lock,
  LogIn,
  Map as MapIcon,
  MousePointerClick,
  Package,
  RefreshCw,
  Settings,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  Zap
} from 'lucide-react';

// ==========================================
// CONFIGURATION FIREBASE (cnc-tycoon-gmp)
// ==========================================
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdGM5WTpuxrz7VNkRXqPPXz9LxDsPQia0",
  authDomain: "cnc-tycoon-gmp.firebaseapp.com",
  projectId: "cnc-tycoon-gmp",
  storageBucket: "cnc-tycoon-gmp.firebasestorage.app",
  messagingSenderId: "907776837224",
  appId: "1:907776837224:web:95ffba314b7a28ecc59ddd",
  measurementId: "G-4NW1GH3ERT"
};

let app = null;
let auth = null;
let db = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cnc-empire-v1';

try {
  const firebaseConfig =
    typeof __firebase_config !== 'undefined' && __firebase_config
      ? JSON.parse(__firebase_config)
      : DEFAULT_FIREBASE_CONFIG;
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn("Mode local activé :", err);
}

// ==========================================
// CATALOGUES & ÉQUILIBRAGE DU JEU
// ==========================================
const MACHINES_CATALOG = [
  { id: 'drill_saw', name: 'Scie & Perceuse', baseCost: 150, baseProd: 0.8, color: '#475569' },
  { id: 'lathe_conv', name: 'Tour Conventionnel', baseCost: 1800, baseProd: 6, color: '#047857' },
  { id: 'mill_3axis', name: 'Fraiseuse 3 Axes', baseCost: 22000, baseProd: 55, color: '#2563eb' },
  { id: 'lathe_sub', name: 'Tour CN', baseCost: 280000, baseProd: 560, color: '#4f46e5' },
  { id: 'mill_5axis', name: 'Centre 5 Axes', baseCost: 3800000, baseProd: 6300, color: '#9333ea' },
  { id: 'edm_wire', name: 'Électroérosion', baseCost: 55000000, baseProd: 82000, color: '#d97706' },
  { id: 'aero_cell', name: 'Cellule Robotisée', baseCost: 850000000, baseProd: 1180000, color: '#e11d48' },
  { id: 'slm_laser', name: 'Fonderie Laser 3D', baseCost: 15000000000, baseProd: 18500000, color: '#0891b2' },
  { id: 'quantum_cnc', name: 'Ligne Spatiale', baseCost: 280000000000, baseProd: 310000000, color: '#059669' }
];

const RARITY_STYLES = {
  MALUS: {
    label: 'Malus',
    rank: 0,
    gradient: 'from-lime-700 via-stone-700 to-zinc-950',
    border: 'border-lime-600',
    text: 'text-lime-400',
    bg: 'bg-stone-950',
    glow: '#65a30d',
    foil: false,
    isMalus: true
  },
  COMMON: {
    label: 'Commun',
    rank: 1,
    gradient: 'from-slate-500 via-slate-600 to-slate-800',
    border: 'border-slate-400',
    text: 'text-slate-300',
    bg: 'bg-slate-800',
    glow: '#94a3b8',
    foil: false
  },
  RARE: {
    label: 'Rare',
    rank: 2,
    gradient: 'from-cyan-400 via-blue-600 to-indigo-900',
    border: 'border-cyan-400',
    text: 'text-cyan-300',
    bg: 'bg-blue-950',
    glow: '#22d3ee',
    foil: false
  },
  EPIC: {
    label: 'Épique',
    rank: 3,
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-950',
    border: 'border-purple-400',
    text: 'text-purple-300',
    bg: 'bg-purple-950',
    glow: '#c084fc',
    foil: true
  },
  LEGENDARY: {
    label: 'Légendaire',
    rank: 4,
    gradient: 'from-yellow-300 via-amber-500 to-orange-700',
    border: 'border-amber-300',
    text: 'text-amber-300',
    bg: 'bg-amber-950',
    glow: '#fbbf24',
    foil: true
  },
  MYTHIC: {
    label: 'Mythique',
    rank: 5,
    gradient: 'from-rose-400 via-red-600 to-slate-950',
    border: 'border-rose-400',
    text: 'text-rose-400',
    bg: 'bg-rose-950',
    glow: '#f43f5e',
    foil: true
  },
  SECRET: {
    label: 'Secret',
    rank: 6,
    gradient: 'from-emerald-300 via-teal-400 to-amber-400',
    border: 'border-emerald-300',
    text: 'text-emerald-300',
    bg: 'bg-emerald-950',
    glow: '#34d399',
    foil: true
  }
};

const EMPLOYEES_CATALOG = [
  // SECRET (0.1%)
  { id: 'emp_klepacz', name: 'Mr Klepacz', rarity: 'SECRET', specialty: 'ALL', specName: 'Toutes Machines', baseMult: 35, title: 'Légende Secrète GMP' },

  // MYTHIQUE (1.9%)
  { id: 'emp_cedric', name: 'Cedric Castagnetti', rarity: 'MYTHIC', specialty: 'ALL', specName: 'Toutes Machines', baseMult: 15, title: 'Grand Maître Usinage' },
  { id: 'emp_mst', name: 'Ms T', rarity: 'MYTHIC', specialty: 'ALL', specName: 'Toutes Machines', baseMult: 14, title: 'Directrice Métrologie ISO' },

  // LÉGENDAIRE (6%)
  { id: 'emp_pompidou', name: 'Pompidou', rarity: 'LEGENDARY', specialty: 'mill_3axis', specName: 'Fraiseuse 3 Axes', baseMult: 7.8, title: 'Virtuose Fraiseur CN' },
  { id: 'emp_lorriot', name: 'Mr Lorriot', rarity: 'LEGENDARY', specialty: 'edm_wire', specName: 'Électroérosion', baseMult: 7.6, title: 'Maître Conception & FAO' },
  { id: 'emp_marty', name: 'Mme Marty', rarity: 'LEGENDARY', specialty: 'mill_5axis', specName: 'Centre 5 Axes', baseMult: 7.5, title: 'Experte UGV 5 Axes' },
  { id: 'emp_blanchard', name: 'Mr Blanchard', rarity: 'LEGENDARY', specialty: 'aero_cell', specName: 'Cellule Robotisée', baseMult: 7.5, title: 'Architecte Robotique' },
  { id: 'emp_graya', name: 'Mr Graya', rarity: 'LEGENDARY', specialty: 'edm_wire', specName: 'Électroérosion', baseMult: 6.5, title: 'Maître Électroérosion' },

  // ÉPIQUE (13%)
  { id: 'emp_jeulin', name: 'Mr Jeulin', rarity: 'EPIC', specialty: 'mill_5axis', specName: 'Centre 5 Axes', baseMult: 4.0, title: 'Spécialiste Usinage Complexe' },
  { id: 'emp_jellad', name: 'Mme Jellad', rarity: 'EPIC', specialty: 'aero_cell', specName: 'Cellule Robotisée', baseMult: 3.9, title: 'Ingénieure Production & Qualité' },
  { id: 'emp_renaud', name: 'Mme Renaud', rarity: 'EPIC', specialty: 'mill_3axis', specName: 'Fraiseuse 3 Axes', baseMult: 3.8, title: 'Ingénieure FAO 3 Axes' },
  { id: 'emp_pietri', name: 'Mr Pietri', rarity: 'EPIC', specialty: 'lathe_sub', specName: 'Tour CN', baseMult: 3.8, title: 'Spécialiste Bi-Broche' },

  // RARE (28%)
  { id: 'emp_julien', name: 'Julien', rarity: 'RARE', specialty: 'mill_3axis', specName: 'Fraiseuse 3 Axes', baseMult: 2.3, title: 'Fraiseur Régleur CN' },
  { id: 'emp_brun', name: 'Mr Brun', rarity: 'RARE', specialty: 'lathe_conv', specName: 'Tour Conventionnel', baseMult: 2.3, title: 'Technicien Mécanique' },
  { id: 'emp_lauris', name: 'Lauris Rigal', rarity: 'RARE', specialty: 'lathe_conv', specName: 'Tour Conventionnel', baseMult: 2.2, title: 'Tourneur Précision' },
  { id: 'emp_pierre', name: 'Pierre Montant', rarity: 'RARE', specialty: 'drill_saw', specName: 'Scie & Perceuse', baseMult: 2.2, title: 'Chef Débit & Ajustage' },
  { id: 'emp_sebastien', name: 'Sebastien', rarity: 'RARE', specialty: 'lathe_sub', specName: 'Tour CN', baseMult: 2.2, title: 'Opérateur Programmateur' },

  // COMMUN (45%)
  { id: 'emp_hugo', name: 'Hugo', rarity: 'COMMON', specialty: 'drill_saw', specName: 'Scie & Perceuse', baseMult: 1.45, title: 'Opérateur Débit' },
  { id: 'emp_marylou', name: 'Marylou', rarity: 'COMMON', specialty: 'mill_3axis', specName: 'Fraiseuse 3 Axes', baseMult: 1.45, title: 'Opératrice Atelier' },
  { id: 'emp_elliot', name: 'Elliot', rarity: 'COMMON', specialty: 'lathe_conv', specName: 'Tour Conventionnel', baseMult: 1.4, title: 'Apprenti Usineur' },

  // MALUS (6%) - Débooste la machine !
  { id: 'emp_werda', name: 'Mme Werda', rarity: 'MALUS', specialty: 'ALL', specName: 'Sabotage Cadence', baseMult: 0.65, title: 'Malus : Ralentit la machine (-35%)' },
  { id: 'emp_benhenni', name: 'Mr Ben Henni', rarity: 'MALUS', specialty: 'ALL', specName: 'Panne & Réglages', baseMult: 0.70, title: 'Malus : Dérègle la broche (-30%)' }
];

const ATELIER_UPGRADES = {
  sizes: [
    { level: 1, name: "Garage d'Usinage", slots: 4, cost: 0 },
    { level: 2, name: 'Atelier PME', slots: 8, cost: 45000 },
    { level: 3, name: 'Usine Aéronautique', slots: 12, cost: 2500000 },
    { level: 4, name: 'Gigafactory 4.0', slots: 16, cost: 180000000 },
    { level: 5, name: 'Complexe Orbital', slots: 20, cost: 14000000000 },
    { level: 6, name: 'Pôle Spatial GMP', slots: 24, cost: 250000000000 }
  ],
  floors: [
    { id: 'beton', name: 'Dalle Béton Brut', cost: 0, bonus: 0, color: '#1e293b' },
    { id: 'resine', name: 'Résine Époxy Bleue (+10% Prod)', cost: 85000, bonus: 0.1, color: '#0c4a6e' },
    { id: 'carbone', name: 'Dalle Carbone ISO (+25% Prod)', cost: 12000000, bonus: 0.25, color: '#090d16' },
    { id: 'salle_blanche', name: 'Salle Blanche ISO-5 (+45% Prod)', cost: 950000000, bonus: 0.45, color: '#064e3b' },
    { id: 'supra', name: 'Dalle Supra-Magnétique (+70% Prod)', cost: 65000000000, bonus: 0.7, color: '#1e1b4b' }
  ],
  equipments: [
    { id: 'crane', name: 'Pont Roulant 10T (+15% Prod)', cost: 650000, bonus: 0.15 },
    { id: 'agv', name: 'Robots AGV Logistique (+30% Prod)', cost: 95000000, bonus: 0.3 },
    { id: 'cobots', name: 'Bras Cobots Palettisation (+45% Prod)', cost: 4500000000, bonus: 0.45 },
    { id: 'twin_ai', name: 'Jumeau Numérique IA (+65% Prod)', cost: 120000000000, bonus: 0.65 }
  ]
};

const MAX_SLOTS_COUNT = 24;

const CHALLENGES_CATALOG = [
  {
    id: 'ch_first_machine',
    title: 'Premier Pas Industriel',
    desc: 'Installer au moins 1 machine CNC dans votre atelier.',
    target: 1,
    getProgress: (st) => st.machineCount,
    rewardType: 'cash',
    rewardValue: 450,
    rewardLabel: '+450 $'
  },
  {
    id: 'ch_carbide_5',
    title: 'Affûtage de Précision',
    desc: "Monter l'outillage manuel Carbure au niveau 5.",
    target: 5,
    getProgress: (st) => st.clickLevel,
    rewardType: 'crate',
    rewardValue: 1,
    rewardLabel: '1 Caisse Gratuite'
  },
  {
    id: 'ch_four_machines',
    title: 'Ligne de Production',
    desc: 'Posséder 4 machines CNC en fonctionnement.',
    target: 4,
    getProgress: (st) => st.machineCount,
    rewardType: 'cash',
    rewardValue: 6500,
    rewardLabel: '+6 500 $'
  },
  {
    id: 'ch_first_assign',
    title: 'Chef d’Équipe',
    desc: 'Affecter une carte opérateur sur un îlot CNC.',
    target: 1,
    getProgress: (st) => st.assignedCount,
    rewardType: 'crate',
    rewardValue: 1,
    rewardLabel: '1 Caisse Gratuite'
  },
  {
    id: 'ch_income_100',
    title: 'Cadence Soutenue',
    desc: 'Atteindre une production de 100 $/s.',
    target: 100,
    getProgress: (st) => st.income,
    rewardType: 'cash',
    rewardValue: 25000,
    rewardLabel: '+25 000 $'
  },
  {
    id: 'ch_expand_pme',
    title: 'Pousser les Murs',
    desc: "Agrandir l'atelier jusqu'à 8 îlots (Atelier PME).",
    target: 8,
    getProgress: (st) => st.unlockedSlots,
    rewardType: 'crate',
    rewardValue: 2,
    rewardLabel: '2 Caisses Gratuites'
  },
  {
    id: 'ch_first_star',
    title: 'Formation Élite ★',
    desc: 'Posséder une carte améliorée à 2 étoiles ou plus.',
    target: 2,
    getProgress: (st) => st.maxStars,
    rewardType: 'crate',
    rewardValue: 2,
    rewardLabel: '2 Caisses Gratuites'
  },
  {
    id: 'ch_dex_10',
    title: 'Recruteur GMP',
    desc: 'Découvrir 10 personnages différents dans le GMP-Dex.',
    target: 10,
    getProgress: (st) => st.discoveredCount,
    rewardType: 'cash',
    rewardValue: 750000,
    rewardLabel: '+750 000 $'
  },
  {
    id: 'ch_income_50k',
    title: 'Usine Haute Cadence',
    desc: 'Atteindre une production de 50 000 $/s.',
    target: 50000,
    getProgress: (st) => st.income,
    rewardType: 'crate',
    rewardValue: 3,
    rewardLabel: '3 Caisses Gratuites'
  },
  {
    id: 'ch_twelve_machines',
    title: 'Parc Aéronautique',
    desc: 'Posséder 12 machines CNC installées.',
    target: 12,
    getProgress: (st) => st.machineCount,
    rewardType: 'cash',
    rewardValue: 45000000,
    rewardLabel: '+45 M$'
  },
  {
    id: 'ch_dex_18',
    title: 'Collectionneur Légendaire',
    desc: 'Découvrir 18 personnages différents dans le GMP-Dex.',
    target: 18,
    getProgress: (st) => st.discoveredCount,
    rewardType: 'crate',
    rewardValue: 5,
    rewardLabel: '5 Caisses Gratuites'
  },
  {
    id: 'ch_slm_laser',
    title: 'Fabrication Additive 3D',
    desc: 'Installer une Fonderie Laser 3D ou une Ligne Spatiale.',
    target: 1,
    getProgress: (st) => st.endgameMachineCount,
    rewardType: 'crate',
    rewardValue: 10,
    rewardLabel: 'Pack 10 Caisses !'
  }
];

const normalizeSlotsArray = (rawSlots) => {
  const arr = Array(MAX_SLOTS_COUNT).fill(null);
  if (Array.isArray(rawSlots)) {
    for (let i = 0; i < Math.min(rawSlots.length, MAX_SLOTS_COUNT); i++) {
      arr[i] = rawSlots[i] || null;
    }
  }
  return arr;
};

const CRATE_BASE_COST = 1200;
const CRATE_COST_MULT = 1.18;
const STAR_BONUS_STEP = 0.35;
const SYNERGY_MULT = 2;
const DROP_RATES = {
  MALUS: 6,
  COMMON: 45,
  RARE: 28,
  EPIC: 13,
  LEGENDARY: 6,
  MYTHIC: 1.9,
  SECRET: 0.1
};

// Calcul centralisé du multiplicateur réel d'une carte sur une machine
const getCardMachineMultiplier = (emp, stars, machineId) => {
  if (!emp) return 1;
  const s = stars || 1;
  if (emp.rarity === 'MALUS') {
    return Math.min(0.9, emp.baseMult * (1 + (s - 1) * 0.08));
  }
  const starMult = 1 + (s - 1) * STAR_BONUS_STEP;
  const totalMult = emp.baseMult * starMult;
  const hasSynergy = machineId && (emp.specialty === machineId || emp.specialty === 'ALL');
  return hasSynergy ? totalMult * SYNERGY_MULT : totalMult;
};

// Calcul du coût cumulé pour ouvrir N caisses d'affilée
const getMultiCrateCost = (currentInvCount, qty) => {
  let total = 0;
  for (let i = 0; i < qty; i++) {
    total += Math.floor(CRATE_BASE_COST * Math.pow(CRATE_COST_MULT, currentInvCount + i));
  }
  return total;
};

// Tirage d'un personnage selon les taux de drop
const rollSingleEmployee = () => {
  const roll = Math.random() * 100;
  let acc = 0;
  let chosenRarity = 'COMMON';
  for (const [rarity, rate] of Object.entries(DROP_RATES)) {
    acc += rate;
    if (roll <= acc) {
      chosenRarity = rarity;
      break;
    }
  }
  const pool = EMPLOYEES_CATALOG.filter((e) => e.rarity === chosenRarity);
  return pool[Math.floor(Math.random() * pool.length)];
};

// Formate les montants en $ lisibles (k, M, Md, T)
const formatMoney = (val) => {
  if (val == null || isNaN(val) || val <= 0) return '0 $';
  if (val < 10) return `${val.toFixed(2)} $`;
  if (val < 100) return `${val.toFixed(1)} $`;
  if (val < 1000) return `${Math.floor(val)} $`;
  const units = ['', 'k', 'M', 'Md', 'T'];
  const tier = Math.floor(Math.log10(Math.abs(val)) / 3);
  if (tier <= 0) return `${Math.floor(val)} $`;
  const safeTier = Math.min(tier, 4);
  return `${(val / Math.pow(10, safeTier * 3)).toFixed(2)} ${units[safeTier]}$`;
};

const cleanId = (str) => (str || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

// ==========================================
// SÉCURITÉ ANTI-TRICHE & INTÉGRITÉ SAUVEGARDE
// ==========================================
const INTEGRITY_SALT = 'GMP_CNC_2026_S2_X9#K7!vL';
const SIGNED_SAVE_KEY = 'cnc_save_signed_v1';
const MAX_CLICKS_PER_SEC = 14;

const computeIntegrityHash = (payload) => {
  const canonical = JSON.stringify({
    m: Math.round((Number(payload.money) || 0) * 100),
    c: Number(payload.clickLevel) || 1,
    s: payload.slots || [],
    i: payload.inventory || [],
    a: payload.atelier || {},
    ch: payload.claimedChallenges || []
  });
  let hash = 0x811c9dc5;
  const fullStr = `${INTEGRITY_SALT}|${canonical}|${INTEGRITY_SALT.length}`;
  for (let i = 0; i < fullStr.length; i++) {
    hash ^= fullStr.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const loadVerifiedLocalSave = () => {
  try {
    const raw = localStorage.getItem(SIGNED_SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && parsed.sig === computeIntegrityHash(parsed.data)) {
        return { data: parsed.data, tampered: false };
      }
      return { data: null, tampered: true };
    }
    const legacyMoney = Number(localStorage.getItem('cnc_money'));
    const legacyClick = Number(localStorage.getItem('cnc_clickLevel'));
    const legacySlots = JSON.parse(localStorage.getItem('cnc_slots') || 'null');
    const legacyInv = JSON.parse(localStorage.getItem('cnc_inventory') || 'null');
    const legacyAtelier = JSON.parse(localStorage.getItem('cnc_atelier') || 'null');
    if (legacyMoney > 0 || legacyClick > 1 || Array.isArray(legacyInv)) {
      return {
        data: {
          money: Math.min(Math.max(0, legacyMoney || 0), 1e15),
          clickLevel: Math.min(Math.max(1, legacyClick || 1), 150),
          slots: normalizeSlotsArray(legacySlots),
          inventory: Array.isArray(legacyInv) ? legacyInv : [],
          atelier: legacyAtelier || { sizeLevel: 1, floor: 'beton', crane: false, agv: false, cobots: false, twin_ai: false },
          claimedChallenges: []
        },
        tampered: false
      };
    }
  } catch {
    return { data: null, tampered: true };
  }
  return { data: null, tampered: false };
};

const computeVerifiedIncome = (slots, inventory, atelier) => {
  const sizeObj = ATELIER_UPGRADES.sizes.find((s) => s.level === (atelier?.sizeLevel || 1)) || ATELIER_UPGRADES.sizes[0];
  const bonus =
    (ATELIER_UPGRADES.floors.find((f) => f.id === atelier?.floor)?.bonus || 0) +
    (atelier?.crane ? 0.15 : 0) +
    (atelier?.agv ? 0.3 : 0) +
    (atelier?.cobots ? 0.45 : 0) +
    (atelier?.twin_ai ? 0.65 : 0);

  const usedUids = new Set();
  let sum = 0;
  for (let idx = 0; idx < sizeObj.slots; idx++) {
    const slot = slots?.[idx];
    if (!slot || !slot.machineId) continue;
    const machine = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
    if (!machine) continue;
    let prod = machine.baseProd;
    if (slot.employeeId && !usedUids.has(slot.employeeId)) {
      const card = inventory?.find((c) => c.uid === slot.employeeId);
      if (card) {
        usedUids.add(slot.employeeId);
        const emp = EMPLOYEES_CATALOG.find((e) => e.id === card.templateId);
        if (emp) {
          const safeStars = Math.min(Math.max(1, Number(card.stars) || 1), 10);
          prod *= getCardMachineMultiplier(emp, safeStars, machine.id);
        }
      }
    }
    sum += prod;
  }
  return sum * (1 + bonus);
};

// ==========================================
// ILLUSTRATIONS SVG DES 9 MACHINES CNC
// ==========================================
const MachineIllustration = ({ id, animated = true, className = 'w-full h-full' }) => {
  switch (id) {
    case 'drill_saw':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <defs>
            <linearGradient id="metalGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>
          <rect x="12" y="64" width="96" height="16" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <rect x="18" y="68" width="38" height="8" rx="1" fill="#0f172a" />
          <rect x="64" y="68" width="38" height="8" rx="1" fill="#0f172a" />
          <path
            d="M 22 64 L 22 24 Q 22 16 32 16 L 52 16 Q 58 16 58 24 L 58 34 L 34 34 L 34 52 L 58 52 L 58 64 Z"
            fill="url(#metalGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <line
            x1="48"
            y1="34"
            x2="48"
            y2="56"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeDasharray="3 2"
            className={animated ? 'animate-pulse' : ''}
          />
          <rect x="38" y="48" width="18" height="6" rx="1" fill="#38bdf8" />
          <rect x="84" y="14" width="7" height="50" fill="#64748b" />
          <rect x="70" y="14" width="26" height="16" rx="3" fill="#0284c7" stroke="#7dd3fc" strokeWidth="1.5" />
          <circle cx="96" cy="22" r="5" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1.5" />
          <g className={animated ? 'animate-tool-head' : ''}>
            <rect x="76" y="30" width="8" height="7" fill="#334155" />
            <path d="M 78 37 L 82 37 L 80 54 Z" fill="#f59e0b" />
          </g>
          <rect x="70" y="54" width="20" height="4" rx="1" fill="#94a3b8" />
          {animated && <circle cx="80" cy="52" r="2.5" fill="#fde047" className="animate-ping" />}
        </svg>
      );

    case 'lathe_conv':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="10" y="56" width="100" height="24" rx="3" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
          <rect x="16" y="46" width="88" height="10" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          <rect x="10" y="22" width="28" height="34" rx="2" fill="#047857" stroke="#34d399" strokeWidth="1.5" />
          <circle cx="24" cy="36" r="7" fill="#0f172a" stroke="#6ee7b7" strokeWidth="1.5" />
          <g className={animated ? 'origin-[42px_38px] animate-spin' : ''} style={{ animationDuration: '1.2s' }}>
            <rect x="38" y="28" width="8" height="20" rx="1" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1" />
            <line x1="38" y1="33" x2="46" y2="33" stroke="#1e293b" strokeWidth="2" />
            <line x1="38" y1="43" x2="46" y2="43" stroke="#1e293b" strokeWidth="2" />
          </g>
          <rect x="46" y="34" width="44" height="8" fill="#cbd5e1" />
          <rect x="46" y="35" width="26" height="6" fill="#38bdf8" />
          <path d="M 90 38 L 98 33 L 108 33 L 108 46 L 98 46 Z" fill="#047857" stroke="#34d399" strokeWidth="1.5" />
          <g className={animated ? 'animate-carriage' : ''}>
            <rect x="58" y="42" width="16" height="18" rx="2" fill="#334155" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M 64 42 L 66 37 L 69 42 Z" fill="#fbbf24" />
            <circle cx="63" cy="51" r="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="1" />
            {animated && <circle cx="66" cy="37" r="2.5" fill="#fbbf24" className="animate-ping" />}
          </g>
        </svg>
      );

    case 'mill_3axis':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="12" y="10" width="96" height="70" rx="5" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2" />
          <rect x="22" y="18" width="58" height="44" rx="3" fill="#090d16" stroke="#38bdf8" strokeWidth="1.5" />
          <rect x="28" y="52" width="46" height="6" rx="1" fill="#64748b" />
          <rect x="38" y="45" width="26" height="7" rx="1" fill="#38bdf8" opacity="0.85" />
          <g className={animated ? 'animate-tool-head' : ''}>
            <rect x="44" y="20" width="14" height="16" rx="2" fill="#e2e8f0" stroke="#3b82f6" strokeWidth="1.5" />
            <rect x="48" y="36" width="6" height="6" fill="#475569" />
            <path d="M 49 42 L 53 42 L 52 47 L 50 47 Z" fill="#fbbf24" />
            {animated && (
              <>
                <line x1="44" y1="36" x2="50" y2="46" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 1" />
                <circle cx="51" cy="46" r="3" fill="#fde047" className="animate-ping" />
              </>
            )}
          </g>
          <rect x="85" y="22" width="18" height="40" rx="2" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="88" y="26" width="12" height="10" rx="1" fill="#0284c7" />
          <circle cx="91" cy="43" r="2" fill="#22c55e" />
          <circle cx="97" cy="43" r="2" fill="#ef4444" />
          <circle cx="94" cy="52" r="4" fill="#334155" stroke="#cbd5e1" strokeWidth="1" />
        </svg>
      );

    case 'lathe_sub':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <path d="M 10 76 L 16 14 L 104 14 L 110 76 Z" fill="#312e81" stroke="#818cf8" strokeWidth="2" />
          <polygon points="24,22 80,22 76,58 20,58" fill="#090d16" stroke="#6366f1" strokeWidth="1.5" />
          <rect x="21" y="34" width="12" height="14" fill="#94a3b8" />
          <rect x="63" y="35" width="10" height="12" fill="#94a3b8" />
          <rect x="33" y="38" width="30" height="6" fill="#38bdf8" />
          <g className={animated ? 'animate-carriage' : ''}>
            <polygon points="44,23 54,23 57,31 49,37 41,31" fill="#e2e8f0" stroke="#4f46e5" strokeWidth="1.5" />
            <circle cx="49" cy="29" r="3" fill="#1e1b4b" />
            <rect x="48" y="35" width="2" height="4" fill="#fbbf24" />
            {animated && <circle cx="49" cy="39" r="2.5" fill="#fbbf24" className="animate-ping" />}
          </g>
          <rect x="84" y="24" width="18" height="36" rx="2" fill="#0f172a" stroke="#a5b4fc" strokeWidth="1.5" />
          <rect x="87" y="28" width="12" height="12" fill="#38bdf8" opacity="0.8" />
          <rect x="18" y="64" width="84" height="6" rx="2" fill="#1e1b4b" />
        </svg>
      );

    case 'mill_5axis':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="10" y="8" width="100" height="74" rx="7" fill="#3b0764" stroke="#c084fc" strokeWidth="2" />
          <rect x="20" y="16" width="64" height="54" rx="6" fill="#090d16" stroke="#a855f7" strokeWidth="1.5" />
          <g className={animated ? 'origin-[52px_52px] animate-cradle' : ''}>
            <path d="M 32 46 A 20 14 0 0 0 72 46" fill="none" stroke="#94a3b8" strokeWidth="5" />
            <rect x="42" y="48" width="20" height="5" rx="1" fill="#e2e8f0" />
            <path d="M 45 48 L 49 38 L 55 38 L 59 48 Z" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1" />
          </g>
          <g className={animated ? 'animate-tool-head' : ''}>
            <path d="M 46 16 L 58 16 L 55 32 L 49 32 Z" fill="#f8fafc" stroke="#c084fc" strokeWidth="1.5" />
            <line x1="52" y1="32" x2="52" y2="40" stroke="#f43f5e" strokeWidth="2" />
            {animated && <circle cx="52" cy="40" r="3.5" fill="#e879f9" className="animate-ping" />}
          </g>
          <rect x="88" y="20" width="16" height="44" rx="3" fill="#0f172a" stroke="#d8b4fe" strokeWidth="1.5" />
          <rect x="91" y="24" width="10" height="16" rx="1" fill="#a855f7" />
          <circle cx="96" cy="50" r="4" fill="#22c55e" className={animated ? 'animate-pulse' : ''} />
        </svg>
      );

    case 'edm_wire':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="12" y="10" width="96" height="70" rx="5" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
          <circle
            cx="30"
            cy="24"
            r="7"
            fill="#fbbf24"
            stroke="#fef08a"
            strokeWidth="1.5"
            className={animated ? 'origin-[30px_24px] animate-spin' : ''}
          />
          <circle cx="30" cy="24" r="2.5" fill="#451a03" />
          <rect x="22" y="36" width="60" height="34" rx="3" fill="#083344" stroke="#22d3ee" strokeWidth="2" />
          <rect x="24" y="42" width="56" height="26" rx="2" fill="#06b6d4" opacity="0.35" />
          <rect x="36" y="50" width="32" height="10" rx="1" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1" />
          <line x1="52" y1="24" x2="52" y2="68" stroke="#fde047" strokeWidth="1.5" />
          {animated && (
            <>
              <circle cx="52" cy="55" r="5" fill="#22d3ee" opacity="0.7" className="animate-ping" />
              <circle cx="52" cy="55" r="2.5" fill="#ffffff" />
            </>
          )}
          <rect x="86" y="20" width="16" height="50" rx="2" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" />
          <rect x="89" y="25" width="10" height="12" fill="#22d3ee" />
          <line x1="89" y1="45" x2="99" y2="45" stroke="#f59e0b" strokeWidth="2" />
          <line x1="89" y1="51" x2="99" y2="51" stroke="#f59e0b" strokeWidth="2" />
        </svg>
      );

    case 'slm_laser':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="10" y="10" width="100" height="70" rx="6" fill="#083344" stroke="#22d3ee" strokeWidth="2" />
          <rect x="20" y="18" width="62" height="52" rx="4" fill="#090d16" stroke="#06b6d4" strokeWidth="1.5" />
          <rect x="26" y="54" width="50" height="12" rx="1" fill="#334155" />
          <polygon points="38,54 46,40 56,40 64,54" fill="#38bdf8" opacity="0.85" />
          <g className={animated ? 'animate-carriage' : ''}>
            <rect x="44" y="20" width="14" height="8" rx="2" fill="#e2e8f0" stroke="#22d3ee" strokeWidth="1" />
            <line x1="51" y1="28" x2="51" y2="42" stroke="#22d3ee" strokeWidth="2.5" />
            {animated && <circle cx="51" cy="42" r="4" fill="#67e8f9" className="animate-ping" />}
          </g>
          <rect x="86" y="20" width="18" height="48" rx="2" fill="#0f172a" stroke="#67e8f9" strokeWidth="1.5" />
          <rect x="89" y="24" width="12" height="14" rx="1" fill="#0891b2" />
          <circle cx="95" cy="48" r="4" fill="#22d3ee" className={animated ? 'animate-pulse' : ''} />
        </svg>
      );

    case 'quantum_cnc':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="8" y="8" width="104" height="74" rx="8" fill="#022c22" stroke="#34d399" strokeWidth="2" />
          <rect x="18" y="16" width="66" height="56" rx="6" fill="#090d16" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="51" cy="44" r="18" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="6 4" className={animated ? 'origin-[51px_44px] animate-spin' : ''} />
          <polygon points="51,32 61,44 51,56 41,44" fill="#10b981" stroke="#a7f3d0" strokeWidth="1.5" />
          {animated && <circle cx="51" cy="44" r="4.5" fill="#fef08a" className="animate-ping" />}
          <rect x="88" y="20" width="16" height="48" rx="3" fill="#0f172a" stroke="#6ee7b7" strokeWidth="1.5" />
          <rect x="91" y="25" width="10" height="16" rx="1" fill="#10b981" />
          <circle cx="96" cy="52" r="4" fill="#fde047" className={animated ? 'animate-pulse' : ''} />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="8" y="8" width="104" height="74" rx="6" fill="#4c0519" stroke="#fb7185" strokeWidth="2" />
          <rect x="16" y="18" width="34" height="48" rx="3" fill="#090d16" stroke="#f43f5e" strokeWidth="1.5" />
          <rect x="70" y="18" width="34" height="48" rx="3" fill="#090d16" stroke="#f43f5e" strokeWidth="1.5" />
          <circle cx="33" cy="46" r="8" fill="#38bdf8" opacity="0.8" />
          <circle cx="87" cy="46" r="8" fill="#38bdf8" opacity="0.8" />
          <rect x="48" y="64" width="24" height="10" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
          <g className={animated ? 'origin-[60px_64px] animate-robot-arm' : ''}>
            <circle cx="60" cy="62" r="6" fill="#f97316" stroke="#fed7aa" strokeWidth="1.5" />
            <line x1="60" y1="62" x2="48" y2="38" stroke="#f97316" strokeWidth="6" strokeLinecap="round" />
            <circle cx="48" cy="38" r="4.5" fill="#1e293b" stroke="#fb923c" strokeWidth="1.5" />
            <line x1="48" y1="38" x2="66" y2="28" stroke="#fb923c" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M 66 24 L 73 24 L 73 32 L 66 32" fill="none" stroke="#fde047" strokeWidth="2" />
            {animated && <circle cx="71" cy="28" r="3" fill="#38bdf8" className="animate-ping" />}
          </g>
        </svg>
      );
  }
};

// ==========================================
// PORTRAITS PERSONNAGES (SVG + PLANCHE 5x2 IMPORTÉE)
// ==========================================
const AVATAR_SPRITE_POSITIONS = {
  emp_cedric: { x: '0%', y: '0%' },
  emp_marty: { x: '25%', y: '0%' },
  emp_lauris: { x: '50%', y: '0%' },
  emp_elliot: { x: '75%', y: '0%' },
  emp_blanchard: { x: '100%', y: '0%' },
  emp_pompidou: { x: '0%', y: '100%' },
  emp_renaud: { x: '25%', y: '100%' },
  emp_pietri: { x: '50%', y: '100%' },
  emp_mst: { x: '75%', y: '100%' },
  emp_pierre: { x: '100%', y: '100%' }
};

const CharacterPortrait = ({ id, spriteSheetUrl, className = 'w-full h-full' }) => {
  const [imgError, setImgError] = useState(false);
  const spritePos = AVATAR_SPRITE_POSITIONS[id];

  useEffect(() => {
    setImgError(false);
  }, [spriteSheetUrl]);

  const themes = {
    emp_klepacz: { bg1: '#065f46', bg2: '#090d16', hair: '#fde047', skin: '#fde68a', suit: '#10b981', visor: 'secret', prop: 'star' },
    emp_cedric: { bg1: '#881337', bg2: '#090d16', hair: '#fbbf24', skin: '#fed7aa', suit: '#e11d48', visor: 'crown', prop: 'caliper' },
    emp_mst: { bg1: '#881337', bg2: '#090d16', hair: '#fde047', skin: '#fde68a', suit: '#e11d48', visor: 'crown', prop: 'caliper' },
    emp_pompidou: { bg1: '#78350f', bg2: '#090d16', hair: '#38bdf8', skin: '#fcd34d', suit: '#d97706', visor: 'holo', prop: 'endmill' },
    emp_lorriot: { bg1: '#78350f', bg2: '#090d16', hair: '#94a3b8', skin: '#fed7aa', suit: '#b45309', visor: 'glasses', prop: 'cad' },
    emp_marty: { bg1: '#78350f', bg2: '#090d16', hair: '#f97316', skin: '#fed7aa', suit: '#d97706', visor: 'holo', prop: 'turbine' },
    emp_blanchard: { bg1: '#1e3a8a', bg2: '#090d16', hair: '#cbd5e1', skin: '#fdba74', suit: '#2563eb', visor: 'cyber', prop: 'servo' },
    emp_graya: { bg1: '#7c2d12', bg2: '#090d16', hair: '#1e293b', skin: '#fcd34d', suit: '#ea580c', visor: 'weld', prop: 'spark' },
    emp_jeulin: { bg1: '#4c1d95', bg2: '#090d16', hair: '#64748b', skin: '#fde68a', suit: '#6d28d9', visor: 'goggles', prop: 'turbine' },
    emp_jellad: { bg1: '#581c87', bg2: '#090d16', hair: '#1e293b', skin: '#fed7aa', suit: '#9333ea', visor: 'glasses', prop: 'caliper' },
    emp_renaud: { bg1: '#4c1d95', bg2: '#090d16', hair: '#a855f7', skin: '#fde68a', suit: '#7c3aed', visor: 'glasses', prop: 'cad' },
    emp_pietri: { bg1: '#312e81', bg2: '#090d16', hair: '#475569', skin: '#fed7aa', suit: '#4f46e5', visor: 'goggles', prop: 'chuck' },
    emp_julien: { bg1: '#0c4a6e', bg2: '#090d16', hair: '#78350f', skin: '#fde68a', suit: '#0284c7', visor: 'cap', prop: 'endmill' },
    emp_brun: { bg1: '#064e3b', bg2: '#090d16', hair: '#451a03', skin: '#fed7aa', suit: '#047857', visor: 'glasses', prop: 'micrometer' },
    emp_lauris: { bg1: '#064e3b', bg2: '#090d16', hair: '#78350f', skin: '#fed7aa', suit: '#059669', visor: 'glasses', prop: 'micrometer' },
    emp_pierre: { bg1: '#1e293b', bg2: '#090d16', hair: '#94a3b8', skin: '#fdba74', suit: '#475569', visor: 'helmet', prop: 'saw' },
    emp_sebastien: { bg1: '#164e63', bg2: '#090d16', hair: '#0f172a', skin: '#fde68a', suit: '#0891b2', visor: 'holo', prop: 'gcode' },
    emp_hugo: { bg1: '#334155', bg2: '#090d16', hair: '#b45309', skin: '#fde68a', suit: '#475569', visor: 'cap', prop: 'saw' },
    emp_marylou: { bg1: '#334155', bg2: '#090d16', hair: '#d97706', skin: '#fed7aa', suit: '#0284c7', visor: 'glasses', prop: 'wrench' },
    emp_elliot: { bg1: '#1e293b', bg2: '#090d16', hair: '#a16207', skin: '#fde68a', suit: '#3b82f6', visor: 'cap', prop: 'wrench' },
    emp_werda: { bg1: '#365314', bg2: '#090d16', hair: '#1e293b', skin: '#fed7aa', suit: '#4d7c0f', visor: 'malus', prop: 'warning' },
    emp_benhenni: { bg1: '#3f6212', bg2: '#090d16', hair: '#0f172a', skin: '#fdba74', suit: '#3f6212', visor: 'malus', prop: 'warning' }
  };

  const c = themes[id] || themes.emp_cedric;

  if (spritePos && spriteSheetUrl && !imgError) {
    return (
      <div
        className={`${className} relative overflow-hidden select-none`}
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage: `url("${spriteSheetUrl}")`,
          backgroundSize: '500% 200%',
          backgroundPosition: `${spritePos.x} ${spritePos.y}`,
          backgroundRepeat: 'no-repeat'
        }}
      >
        <img src={spriteSheetUrl} alt="" className="hidden" onError={() => setImgError(true)} />
      </div>
    );
  }

  const isLongHair =
    id === 'emp_mst' ||
    id === 'emp_marty' ||
    id === 'emp_renaud' ||
    id === 'emp_marylou' ||
    id === 'emp_jellad' ||
    id === 'emp_werda';

  const isMalus = id === 'emp_werda' || id === 'emp_benhenni';

  return (
    <svg viewBox="0 0 100 100" className={className}>
      <defs>
        <radialGradient id={`grad_${id}`} cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor={c.bg1} />
          <stop offset="100%" stopColor={c.bg2} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill={`url(#grad_${id})`} />
      <circle cx="50" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 3" />
      {isLongHair && <path d="M 28 38 Q 22 65 30 78 L 70 78 Q 78 65 72 38 Z" fill={c.hair} />}
      <path d="M 18 96 Q 20 66 50 66 Q 80 66 82 96 Z" fill={c.suit} stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.4" />
      <path d="M 40 66 L 50 82 L 60 66 Z" fill="#0f172a" />
      <rect x="58" y="76" width="12" height="7" rx="1.5" fill={isMalus ? '#a3e635' : '#38bdf8'} stroke="#fff" strokeWidth="0.8" />
      <rect x="44" y="54" width="12" height="16" rx="4" fill={c.skin} />
      <circle cx="50" cy="42" r="18" fill={c.skin} />
      <circle cx="43" cy="42" r="2.2" fill="#0f172a" />
      <circle cx="57" cy="42" r="2.2" fill="#0f172a" />

      {isMalus ? (
        <>
          <line x1="39" y1="37" x2="46" y2="39" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <line x1="61" y1="37" x2="54" y2="39" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
          <path d="M 43 52 Q 50 47 57 52" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <path d="M 44 50 Q 50 54 56 50" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      )}

      {c.visor === 'helmet' ? (
        <path d="M 29 36 Q 50 14 71 36 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
      ) : c.visor === 'cap' ? (
        <>
          <path d="M 31 35 Q 50 17 69 35 Z" fill="#2563eb" />
          <path d="M 31 34 L 76 34 L 72 38 L 31 36 Z" fill="#1d4ed8" />
        </>
      ) : (
        <path d="M 31 38 Q 34 18 52 20 Q 68 20 69 38 Q 58 28 48 31 Q 36 29 31 38 Z" fill={c.hair} />
      )}

      {(c.visor === 'crown' || c.visor === 'secret') && (
        <polygon
          points="33,24 41,12 50,21 59,12 67,24"
          fill={c.visor === 'secret' ? '#34d399' : '#fde047'}
          stroke={c.visor === 'secret' ? '#fef08a' : '#f59e0b'}
          strokeWidth="1.5"
        />
      )}
      {c.visor === 'holo' && (
        <rect x="35" y="36" width="30" height="9" rx="3" fill="#22d3ee" fillOpacity="0.55" stroke="#67e8f9" strokeWidth="1.5" />
      )}
      {c.visor === 'cyber' && (
        <>
          <rect x="35" y="36" width="14" height="9" rx="2" fill="#38bdf8" fillOpacity="0.8" stroke="#fff" strokeWidth="1" />
          <circle cx="42" cy="40.5" r="2" fill="#ef4444" />
        </>
      )}
      {c.visor === 'weld' && (
        <rect x="34" y="35" width="32" height="10" rx="2" fill="#f97316" fillOpacity="0.7" stroke="#fed7aa" strokeWidth="1.5" />
      )}
      {(c.visor === 'glasses' || c.visor === 'goggles') && (
        <g stroke="#e2e8f0" strokeWidth="1.8" fill="rgba(56,189,248,0.25)">
          <rect x="36" y="37" width="12" height="8" rx="2" />
          <rect x="52" y="37" width="12" height="8" rx="2" />
          <line x1="48" y1="41" x2="52" y2="41" />
        </g>
      )}

      <g transform="translate(68, 68)">
        <circle cx="14" cy="14" r="13" fill="#090d16" stroke={isMalus ? '#a3e635' : '#38bdf8'} strokeWidth="1.5" />
        {c.prop === 'warning' && <polygon points="14,6 22,20 6,20" fill="#a3e635" />}
        {c.prop === 'star' && <polygon points="14,5 16.5,11 23,11.5 18,16 19.5,22 14,18.5 8.5,22 10,16 5,11.5 11.5,11" fill="#34d399" />}
        {c.prop === 'caliper' && <path d="M 8 8 L 20 8 L 20 12 L 12 12 L 12 20 L 8 20 Z" fill="#fde047" />}
        {c.prop === 'turbine' && <circle cx="14" cy="14" r="6" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="3 2" />}
        {c.prop === 'servo' && <rect x="8" y="8" width="12" height="12" rx="2" fill="#38bdf8" />}
        {c.prop === 'spark' && <polygon points="15,6 9,15 14,15 12,22 20,13 15,13" fill="#fb923c" />}
        {!['warning', 'star', 'caliper', 'turbine', 'servo', 'spark'].includes(c.prop) && (
          <circle cx="14" cy="14" r="5" fill="#22d3ee" />
        )}
      </g>
    </svg>
  );
};

// ==========================================
// CAISSE DE RECRUTEMENT & CARTE COLLECTOR
// ==========================================
const SupplyCrateSVG = ({ shaking = false }) => (
  <svg
    viewBox="0 0 160 140"
    className={`w-36 h-32 mx-auto drop-shadow-[0_15px_25px_rgba(245,158,11,0.35)] ${
      shaking ? 'animate-crate-shake' : 'hover:scale-105 transition-transform'
    }`}
  >
    <defs>
      <linearGradient id="crateBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#090d16" />
      </linearGradient>
      <linearGradient id="crateGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
    </defs>
    <ellipse cx="80" cy="120" rx="58" ry="12" fill="#f59e0b" opacity="0.25" />
    <rect x="20" y="36" width="120" height="80" rx="10" fill="url(#crateBody)" stroke="url(#crateGold)" strokeWidth="4" />
    <path d="M 16 40 L 28 20 L 132 20 L 144 40 Z" fill="#334155" stroke="url(#crateGold)" strokeWidth="3.5" />
    <rect x="34" y="42" width="14" height="68" rx="2" fill="url(#crateGold)" opacity="0.85" />
    <rect x="112" y="42" width="14" height="68" rx="2" fill="url(#crateGold)" opacity="0.85" />
    <rect x="56" y="54" width="48" height="38" rx="6" fill="#090d16" stroke="#38bdf8" strokeWidth="2.5" />
    <circle cx="80" cy="73" r="11" fill="#22d3ee" className="animate-pulse" />
    <circle cx="80" cy="73" r="5" fill="#ffffff" />
  </svg>
);

const TradingCard = ({
  employee,
  count = 1,
  onMerge,
  minimal = false,
  dexIndex = null,
  locked = false,
  dropRate = null,
  machineMatchMult = null,
  spriteSheetUrl
}) => {
  const style = RARITY_STYLES[employee.rarity] || RARITY_STYLES.COMMON;
  const stars = employee.stars || 1;
  const isMalus = employee.rarity === 'MALUS';
  const effectiveMult = getCardMachineMultiplier(employee, stars, null);
  const progressCount = Math.min(count, 3);

  if (locked) {
    return (
      <div className="relative rounded-2xl p-[2px] bg-slate-800 w-full min-h-[250px] flex-shrink-0 overflow-hidden opacity-80">
        <div className="relative h-full w-full bg-slate-950 rounded-[14px] p-2.5 flex flex-col justify-between border border-slate-800 text-center">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-800">
            <span className="font-mono text-slate-500">#{String(dexIndex).padStart(2, '0')}</span>
            <span className={style.text}>{style.label}</span>
          </div>

          <div className="my-2 flex flex-col items-center justify-center flex-1">
            <div className="w-20 h-20 rounded-2xl bg-slate-900/90 border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600">
              <Lock className="w-8 h-8" />
            </div>
            <div className="text-sm font-black text-slate-500 mt-2 tracking-widest">???</div>
            <div className="text-[10px] text-slate-600">Non découvert</div>
          </div>

          <div className="bg-slate-900/70 rounded-xl p-1.5 border border-slate-800 text-[10px] font-mono text-slate-400">
            Taux caisse : <span className={`font-bold ${style.text}`}>{dropRate}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl p-[3px] bg-gradient-to-br ${style.gradient} ${
        minimal ? 'w-28 aspect-[2.5/3.7]' : 'w-full min-h-[255px] sm:min-h-[280px]'
      } flex-shrink-0 group overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02]`}
      style={{ boxShadow: `0 10px 25px -5px ${style.glow}44` }}
    >
      {style.foil && (
        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-foil-shimmer" />
      )}
      <div className="relative h-full w-full bg-slate-950/95 rounded-[13px] p-2.5 flex flex-col justify-between border border-white/15 text-center overflow-hidden">
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 w-28 h-28 rounded-full bg-gradient-to-br ${style.gradient} opacity-35 blur-xl pointer-events-none`}
        />

        {/* En-tête de la carte */}
        <div className="relative z-10 shrink-0">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-900/90 border border-white/10">
            <span className={style.text}>
              {dexIndex !== null ? `#${String(dexIndex).padStart(2, '0')} ` : ''}
              {style.label}
            </span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: stars }).map((_, idx) => (
                <svg
                  key={idx}
                  viewBox="0 0 20 20"
                  className={`w-3 h-3 ${
                    isMalus ? 'fill-lime-400' : 'fill-yellow-400 drop-shadow-[0_0_4px_#facc15]'
                  }`}
                >
                  <polygon points="10,1 13,7 19,7.5 14.5,12 16,18.5 10,15 4,18.5 5.5,12 1,7.5 7,7" />
                </svg>
              ))}
            </div>
          </div>
          <h3 className={`${minimal ? 'text-[10px]' : 'text-sm'} font-black text-white leading-tight mt-1.5 truncate drop-shadow`}>
            {employee.name}
          </h3>
          {!minimal && (
            <div className="text-[9px] text-slate-400 font-medium truncate">
              {employee.title || 'Spécialiste Usinage'}
            </div>
          )}
        </div>

        {/* Portrait */}
        <div className="relative z-10 my-1.5 flex items-center justify-center shrink-0">
          <div
            className={`${
              minimal ? 'w-14 h-14' : 'w-20 h-20 sm:w-22 sm:h-22'
            } rounded-2xl bg-gradient-to-br ${style.gradient} p-[2px] shadow-lg transition-transform group-hover:scale-105 overflow-hidden`}
          >
            <div className="w-full h-full bg-slate-900 rounded-[14px] overflow-hidden">
              <CharacterPortrait id={employee.id || employee.templateId} spriteSheetUrl={spriteSheetUrl} />
            </div>
          </div>
        </div>

        {/* Pied de carte : Spécialité & Multiplicateurs */}
        <div className="relative z-10 shrink-0 bg-slate-900/95 rounded-xl p-1.5 border border-white/10 shadow-inner">
          <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">
            {isMalus ? 'Effet Atelier' : 'Spécialité'}
          </div>
          <div className={`${minimal ? 'text-[9px]' : 'text-[11px]'} font-black ${isMalus ? 'text-lime-400' : 'text-cyan-300'} truncate`}>
            {employee.specName}
          </div>

          {machineMatchMult !== null ? (
            <div className="mt-1 flex items-center justify-center px-1 text-[10px] font-mono border-t border-slate-800 pt-1">
              <span className={isMalus ? 'text-lime-400 font-black' : 'text-emerald-300 font-black'}>
                Sur cette CNC : x{machineMatchMult.toFixed(2)}
              </span>
            </div>
          ) : isMalus ? (
            <div className="mt-1 flex items-center justify-center px-1 text-[10px] font-mono border-t border-slate-800 pt-1">
              <span className="text-lime-400 font-black">
                ⚠️ Malus x{effectiveMult.toFixed(2)} (-{Math.round((1 - effectiveMult) * 100)}%)
              </span>
            </div>
          ) : (
            <div
              className={`mt-1 flex items-center justify-between px-1 ${
                minimal ? 'text-[8px]' : 'text-[10px]'
              } font-mono border-t border-slate-800 pt-1`}
            >
              <span className="text-amber-300 font-bold">Base x{effectiveMult.toFixed(2)}</span>
              <span className="text-rose-400 font-black flex items-center gap-0.5">
                <Zap className="w-3 h-3 fill-rose-400" /> x{(effectiveMult * SYNERGY_MULT).toFixed(2)}
              </span>
            </div>
          )}

          {!minimal && dexIndex === null && machineMatchMult === null && (
            <div className="mt-1.5 flex items-center gap-1 px-1">
              <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all ${count >= 3 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${(progressCount / 3) * 100}%` }}
                />
              </div>
              <span className="text-[8px] font-mono font-bold text-slate-400">{count}/3</span>
            </div>
          )}

          {dexIndex !== null && (
            <div className="mt-1 text-[9px] font-mono font-bold text-emerald-400 border-t border-slate-800 pt-1">
              Obtenu : {count} ex. • Max {stars}★
            </div>
          )}
        </div>

        {count > 1 && dexIndex === null && machineMatchMult === null && (
          <div className="absolute top-9 right-2 bg-slate-950/90 border border-white/30 text-white text-[10px] font-black px-2 py-0.5 rounded-full z-20 shadow-lg">
            x{count}
          </div>
        )}

        {count >= 3 && onMerge && dexIndex === null && machineMatchMult === null && (
          <button
            onClick={() => onMerge(employee)}
            className="absolute inset-x-2 bottom-2 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-400 text-slate-950 text-xs font-black py-2 rounded-xl shadow-[0_0_20px_#10b981] z-30 animate-bounce border-2 border-white flex items-center justify-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" /> FUSIONNER (3)
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// APPLICATION PRINCIPALE : CNC EMPIRE GMP
// ==========================================
export default function App() {
  const initialSave = useMemo(() => loadVerifiedLocalSave(), []);

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('production');
  const [toast, setToast] = useState(null);
  const [cloudStatus, setCloudStatus] = useState('connecting');

  // Authentification / Compte joueur
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('cnc_pseudo') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('cnc_password') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('cnc_pseudo'));
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Progression principale
  const [money, setMoney] = useState(() => initialSave.data?.money ?? 0);
  const [clickLevel, setClickLevel] = useState(() => initialSave.data?.clickLevel ?? 1);
  const [slots, setSlots] = useState(() => normalizeSlotsArray(initialSave.data?.slots));
  const [inventory, setInventory] = useState(() => initialSave.data?.inventory ?? []);
  const [atelier, setAtelier] = useState(
    () => ({
      sizeLevel: 1,
      floor: 'beton',
      crane: false,
      agv: false,
      cobots: false,
      twin_ai: false,
      ...(initialSave.data?.atelier || {})
    })
  );
  const [claimedChallenges, setClaimedChallenges] = useState(() =>
    Array.isArray(initialSave.data?.claimedChallenges) ? initialSave.data.claimedChallenges : []
  );

  // États UI secondaires & Tris de cartes
  const [leaderboard, setLeaderboard] = useState([]);
  const [isOpeningCrate, setIsOpeningCrate] = useState(false);
  const [crateDrops, setCrateDrops] = useState([]);
  const [gachaSubTab, setGachaSubTab] = useState('gallery'); // 'gallery' | 'gmpdex'
  const [gallerySort, setGallerySort] = useState('best'); // 'best' | 'rarity' | 'stars' | 'count' | 'name'
  const [galleryRarityFilter, setGalleryRarityFilter] = useState('ALL');
  const [assignSort, setAssignSort] = useState('best_machine'); // 'best_machine' | 'base' | 'rarity' | 'stars'
  const [assignSynergyOnly, setAssignSynergyOnly] = useState(false);
  const [floatingGains, setFloatingGains] = useState([]);
  const [spindleRpm, setSpindleRpm] = useState(0);
  const [assigningSlot, setAssigningSlot] = useState(null);
  const [spriteSheetUrl, setSpriteSheetUrl] = useState(() => localStorage.getItem('cnc_avatar_sheet') || '');
  const clickTimestampsRef = useRef([]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (initialSave.tampered) {
      showToast('🛡️ Modification locale détectée : sauvegarde réinitialisée par sécurité.');
    }
  }, [initialSave.tampered]);

  // Chargement manuel d'une planche d'avatars personnalisée + sauvegarde Cloud partagée
  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1000 / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        setSpriteSheetUrl(dataUrl);
        try {
          localStorage.setItem('cnc_avatar_sheet', dataUrl);
        } catch (err) {
          console.warn('Stockage local image :', err);
        }
        if (db && dataUrl.length < 900000) {
          try {
            await setDoc(
              doc(db, 'artifacts', appId, 'public', 'data', 'config', 'avatars'),
              { sheetUrl: dataUrl, updatedAt: Date.now() },
              { merge: true }
            );
          } catch (err) {
            console.warn('Sync Cloud avatars :', err);
          }
        }
        showToast("🎨 Planche des avatars appliquée aux cartes !");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Récupération automatique de la planche d'avatars partagée sur Firebase
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'avatars'))
      .then((snap) => {
        if (snap.exists() && snap.data().sheetUrl && !localStorage.getItem('cnc_avatar_sheet')) {
          setSpriteSheetUrl(snap.data().sheetUrl);
          try {
            localStorage.setItem('cnc_avatar_sheet', snap.data().sheetUrl);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Décélération progressive du régime broche
  useEffect(() => {
    const timer = setInterval(() => {
      setSpindleRpm((prev) => Math.max(0, prev - 6));
    }, 150);
    return () => clearInterval(timer);
  }, []);

  // Calculs économiques dérivés
  const currentSize = ATELIER_UPGRADES.sizes.find((s) => s.level === atelier.sizeLevel) || ATELIER_UPGRADES.sizes[0];
  const clickValue = 1 * Math.pow(1.35, clickLevel - 1);
  const clickUpgradeCost = Math.floor(50 * Math.pow(1.85, clickLevel - 1));
  const crateCost1 = getMultiCrateCost(inventory.length, 1);
  const crateCost10 = getMultiCrateCost(inventory.length, 10);
  const atelierBonus =
    (ATELIER_UPGRADES.floors.find((f) => f.id === atelier.floor)?.bonus || 0) +
    (atelier.crane ? 0.15 : 0) +
    (atelier.agv ? 0.3 : 0) +
    (atelier.cobots ? 0.45 : 0) +
    (atelier.twin_ai ? 0.65 : 0);

  // Sauvegarde locale signée et protégée
  useEffect(() => {
    const safeMoney = Number.isFinite(money) && money >= 0 ? money : 0;
    const payload = {
      money: safeMoney,
      clickLevel,
      slots,
      inventory,
      atelier,
      claimedChallenges
    };
    const signedPacket = {
      data: payload,
      sig: computeIntegrityHash(payload),
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(SIGNED_SAVE_KEY, JSON.stringify(signedPacket));
      localStorage.removeItem('cnc_money');
      localStorage.removeItem('cnc_clickLevel');
      localStorage.removeItem('cnc_slots');
      localStorage.removeItem('cnc_inventory');
      localStorage.removeItem('cnc_atelier');
    } catch (err) {
      console.warn('Erreur écriture sauvegarde signée :', err);
    }
  }, [money, clickLevel, slots, inventory, atelier, claimedChallenges]);

  // Authentification Firebase anonyme + restauration automatique de la session enregistrée
  useEffect(() => {
    if (!auth) {
      setCloudStatus('offline');
      return;
    }
    (async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        setCloudStatus('online');
      } catch (err) {
        console.warn('Auth anonyme non activée sur Firebase :', err);
        setCloudStatus('online');
      }

      const savedPseudo = localStorage.getItem('cnc_pseudo');
      const savedPass = localStorage.getItem('cnc_password');
      if (db && savedPseudo && savedPass) {
        try {
          const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'accounts', cleanId(savedPseudo)));
          if (snap.exists()) {
            const data = snap.data();
            if (!data.password || data.password === savedPass) {
              const candidate = {
                money: data.money !== undefined ? Math.max(0, Number(data.money) || 0) : 0,
                clickLevel: Math.max(1, Number(data.clickLevel) || 1),
                slots: normalizeSlotsArray(data.slots),
                inventory: Array.isArray(data.inventory) ? data.inventory : [],
                atelier: {
                  sizeLevel: 1,
                  floor: 'beton',
                  crane: false,
                  agv: false,
                  cobots: false,
                  twin_ai: false,
                  ...(data.atelier || {})
                },
                claimedChallenges: Array.isArray(data.claimedChallenges) ? data.claimedChallenges : []
              };
              if (!data.sig || data.sig === computeIntegrityHash(candidate)) {
                setMoney(candidate.money);
                setClickLevel(candidate.clickLevel);
                setSlots(candidate.slots);
                setInventory(candidate.inventory);
                setAtelier(candidate.atelier);
                setClaimedChallenges(candidate.claimedChallenges);
              }
              setIsLoggedIn(true);
            }
          }
        } catch (err) {
          console.warn('Restauration auto Cloud :', err);
        }
      }
    })();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsub && unsub();
  }, []);

  // Écoute temps réel du classement Firestore
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard'),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push(d.data()));
        list.sort((a, b) => (b.income || 0) - (a.income || 0));
        setLeaderboard(list.slice(0, 50));
        setCloudStatus('online');
      },
      (err) => {
        console.warn('Erreur lecture classement Firestore :', err);
        if (err.code === 'permission-denied') setCloudStatus('permission_error');
      }
    );
    return () => unsub();
  }, []);

  // Calcul de la production ($/s) par machine et totale
  const prodStats = useMemo(() => {
    const breakdown = slots.map((slot, idx) => {
      if (idx >= currentSize.slots || !slot || !slot.machineId) return 0;
      const machine = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
      if (!machine) return 0;
      let prod = machine.baseProd;
      if (slot.employeeId) {
        const card = inventory.find((c) => c.uid === slot.employeeId);
        if (card) {
          const emp = EMPLOYEES_CATALOG.find((e) => e.id === card.templateId);
          if (emp) {
            prod *= getCardMachineMultiplier(emp, card.stars || 1, machine.id);
          }
        }
      }
      return prod;
    });

    return {
      total: breakdown.reduce((sum, val) => sum + val, 0) * (1 + atelierBonus),
      breakdown
    };
  }, [slots, inventory, atelierBonus, currentSize.slots]);

  const incomeRef = useRef(prodStats.total);
  useEffect(() => {
    incomeRef.current = prodStats.total;
  }, [prodStats.total]);

  // Boucle de revenus passifs (4 ticks/sec)
  useEffect(() => {
    const timer = setInterval(() => {
      const gain = incomeRef.current / 4;
      if (gain > 0) setMoney((prev) => prev + gain);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Référence d'état live pour sauvegarde fiable
  const latestStateRef = useRef({
    pseudo,
    password,
    money,
    clickLevel,
    slots,
    inventory,
    atelier,
    claimedChallenges,
    currentSize,
    isLoggedIn
  });
  useEffect(() => {
    latestStateRef.current = {
      pseudo,
      password,
      money,
      clickLevel,
      slots,
      inventory,
      atelier,
      claimedChallenges,
      currentSize,
      isLoggedIn
    };
  }, [pseudo, password, money, clickLevel, slots, inventory, atelier, claimedChallenges, currentSize, isLoggedIn]);

  // Synchronisation Cloud (compte + classement)
  const syncCloudData = async (silent = true, overrideState = null) => {
    if (!db) return;
    const st = overrideState || latestStateRef.current;
    const pid = cleanId(st.pseudo);
    if (!pid || !st.isLoggedIn) {
      if (!silent) showToast('⚠️ Connectez-vous avec un pseudo pour enregistrer votre score !');
      return;
    }
    const verifiedIncome = computeVerifiedIncome(st.slots, st.inventory, st.atelier);
    const savePayload = {
      money: Math.max(0, Number(st.money) || 0),
      clickLevel: Math.max(1, Number(st.clickLevel) || 1),
      slots: st.slots,
      inventory: st.inventory,
      atelier: st.atelier,
      claimedChallenges: st.claimedChallenges || []
    };
    const sig = computeIntegrityHash(savePayload);

    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'accounts', pid),
        {
          pseudo: st.pseudo.trim(),
          password: st.password,
          ...savePayload,
          sig,
          income: verifiedIncome,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', pid),
        {
          pseudo: st.pseudo.trim(),
          atelierName: st.currentSize.name,
          income: verifiedIncome,
          timestamp: Date.now()
        },
        { merge: true }
      );
      setCloudStatus('online');
      if (!silent) showToast('✅ Sauvegarde Cloud & Classement mis à jour !');
    } catch (err) {
      console.warn('Erreur sauvegarde Cloud :', err);
      if (err.code === 'permission-denied') setCloudStatus('permission_error');
      if (!silent) showToast("⚠️ Serveur Firebase bloqué (voir l'aide dans Classement)");
    }
  };

  // Connexion / Chargement ou Création de compte
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const pid = cleanId(pseudo);
    const trimmedPseudo = pseudo.trim();
    if (!pid || !password.trim()) {
      showToast('⚠️ Veuillez remplir un Pseudo et un Mot de passe');
      return;
    }

    if (!db) {
      localStorage.setItem('cnc_pseudo', trimmedPseudo);
      localStorage.setItem('cnc_password', password);
      setIsLoggedIn(true);
      setShowAuthModal(false);
      showToast('✅ Connecté en mode local !');
      return;
    }

    try {
      const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', pid);
      const snap = await getDoc(accountRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.password && data.password !== password) {
          showToast('❌ Mot de passe incorrect pour ce pseudo !');
          return;
        }
        const loadedMoney = data.money !== undefined ? Math.max(0, Number(data.money) || 0) : 0;
        const loadedClick = Math.max(1, Number(data.clickLevel) || 1);
        const loadedSlots = normalizeSlotsArray(data.slots);
        const loadedInv = Array.isArray(data.inventory) ? data.inventory : [];
        const loadedAtelier = {
          sizeLevel: 1,
          floor: 'beton',
          crane: false,
          agv: false,
          cobots: false,
          twin_ai: false,
          ...(data.atelier || {})
        };
        const loadedChallenges = Array.isArray(data.claimedChallenges) ? data.claimedChallenges : [];

        const candidate = {
          money: loadedMoney,
          clickLevel: loadedClick,
          slots: loadedSlots,
          inventory: loadedInv,
          atelier: loadedAtelier,
          claimedChallenges: loadedChallenges
        };
        if (data.sig && data.sig !== computeIntegrityHash(candidate)) {
          showToast('🛡️ Sauvegarde Cloud corrompue ou falsifiée.');
          return;
        }

        setMoney(loadedMoney);
        setClickLevel(loadedClick);
        setSlots(loadedSlots);
        setInventory(loadedInv);
        setAtelier(loadedAtelier);
        setClaimedChallenges(loadedChallenges);

        localStorage.setItem('cnc_pseudo', trimmedPseudo);
        localStorage.setItem('cnc_password', password);
        localStorage.setItem(
          SIGNED_SAVE_KEY,
          JSON.stringify({ data: candidate, sig: computeIntegrityHash(candidate), savedAt: Date.now() })
        );

        setIsLoggedIn(true);
        setShowAuthModal(false);
        showToast(`🎉 Partie chargée ! Bon retour, ${trimmedPseudo} !`);
      } else {
        localStorage.setItem('cnc_pseudo', trimmedPseudo);
        localStorage.setItem('cnc_password', password);
        setIsLoggedIn(true);
        setShowAuthModal(false);
        await syncCloudData(true, {
          pseudo: trimmedPseudo,
          password,
          money,
          clickLevel,
          slots,
          inventory,
          atelier,
          claimedChallenges,
          currentSize,
          isLoggedIn: true
        });
        showToast(`🚀 Nouvel atelier enregistré pour ${trimmedPseudo} !`);
      }
    } catch (err) {
      console.warn('Erreur login Firebase :', err);
      if (err.code === 'permission-denied') setCloudStatus('permission_error');
      localStorage.setItem('cnc_pseudo', trimmedPseudo);
      localStorage.setItem('cnc_password', password);
      setIsLoggedIn(true);
      setShowAuthModal(false);
      showToast('💾 Compte activé en sauvegarde locale');
    }
  };

  // Auto-sync Cloud toutes les 8 secondes uniquement quand connecté et modale fermée
  useEffect(() => {
    if (!isLoggedIn || showAuthModal || !pseudo.trim()) return;
    const timer = setInterval(() => {
      syncCloudData(true);
    }, 8000);
    return () => clearInterval(timer);
  }, [isLoggedIn, showAuthModal, pseudo]);

  // Actions Usinage & Atelier
  const handleManualClick = (e) => {
    if (!e || e.isTrusted === false || e.detail === 0) {
      return;
    }
    const now = performance.now();
    const recent = clickTimestampsRef.current.filter((t) => now - t < 1000);
    if (recent.length >= MAX_CLICKS_PER_SEC) {
      return;
    }
    recent.push(now);
    clickTimestampsRef.current = recent;

    setMoney((prev) => prev + clickValue);
    setSpindleRpm((prev) => Math.min(100, prev + 18));
    const rect = e?.currentTarget?.getBoundingClientRect();
    const x = e?.clientX && rect ? e.clientX - rect.left : 110 + (Math.random() * 50 - 25);
    const y = e?.clientY && rect ? e.clientY - rect.top : 90 + (Math.random() * 40 - 20);
    const id = Date.now() + Math.random();
    setFloatingGains((prev) => [...prev.slice(-10), { id, x, y, val: formatMoney(clickValue) }]);
    setTimeout(() => {
      setFloatingGains((prev) => prev.filter((item) => item.id !== id));
    }, 850);
  };

  const handleUpgradeClick = () => {
    if (money < clickUpgradeCost) return;
    setMoney((prev) => prev - clickUpgradeCost);
    setClickLevel((prev) => prev + 1);
    showToast(`🔧 Outils manuels améliorés au niveau ${clickLevel + 1} !`);
  };

  const getMachineCost = (machineId) => {
    const machine = MACHINES_CATALOG.find((m) => m.id === machineId);
    const ownedCount = slots.filter((s) => s && s.machineId === machineId).length;
    return Math.floor(machine.baseCost * Math.pow(1.28, ownedCount));
  };

  const handleBuyMachine = (machineId, slotIdx) => {
    const cost = getMachineCost(machineId);
    if (money < cost) return;
    setMoney((prev) => prev - cost);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { machineId, employeeId: null };
      return next;
    });
    showToast("🏭 Machine installée dans l'atelier !");
  };

  const handleSellMachine = (slotIdx) => {
    const slot = slots[slotIdx];
    if (!slot) return;
    const machine = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
    const refund = machine ? Math.floor(machine.baseCost * 0.4) : 0;
    setMoney((prev) => prev + refund);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    showToast(`♻️ Machine revendue (+${formatMoney(refund)})`);
  };

  const handleResetGame = () => {
    setMoney(0);
    setClickLevel(1);
    setSlots(Array(MAX_SLOTS_COUNT).fill(null));
    setInventory([]);
    setAtelier({ sizeLevel: 1, floor: 'beton', crane: false, agv: false, cobots: false, twin_ai: false });
    setClaimedChallenges([]);
    localStorage.removeItem(SIGNED_SAVE_KEY);
    localStorage.removeItem('cnc_money');
    localStorage.removeItem('cnc_clickLevel');
    localStorage.removeItem('cnc_slots');
    localStorage.removeItem('cnc_inventory');
    localStorage.removeItem('cnc_atelier');
    setShowAuthModal(false);
    showToast('🔄 Partie réinitialisée à 0 $ avec le nouvel équilibrage !');
  };

  // Statistiques suivies pour les Défis
  const challengeStats = useMemo(() => {
    const activeSlots = slots.slice(0, currentSize.slots);
    const machineCount = activeSlots.filter((s) => s && s.machineId).length;
    const assignedCount = activeSlots.filter((s) => s && s.machineId && s.employeeId).length;
    const endgameMachineCount = activeSlots.filter(
      (s) => s && (s.machineId === 'slm_laser' || s.machineId === 'quantum_cnc')
    ).length;
    const maxStars = inventory.reduce((max, c) => Math.max(max, c.stars || 1), 1);
    const discoveredCount = new Set(inventory.map((c) => c.templateId)).size;
    return {
      machineCount,
      assignedCount,
      endgameMachineCount,
      clickLevel,
      income: prodStats.total,
      unlockedSlots: currentSize.slots,
      maxStars,
      discoveredCount
    };
  }, [slots, currentSize.slots, inventory, clickLevel, prodStats.total]);

  const readyChallengesCount = useMemo(
    () =>
      CHALLENGES_CATALOG.filter(
        (ch) => !claimedChallenges.includes(ch.id) && ch.getProgress(challengeStats) >= ch.target
      ).length,
    [claimedChallenges, challengeStats]
  );

  // Réclamation de récompense d'un défi
  const handleClaimChallenge = (ch) => {
    if (claimedChallenges.includes(ch.id)) return;
    if (ch.getProgress(challengeStats) < ch.target) return;

    setClaimedChallenges((prev) => [...prev, ch.id]);

    if (ch.rewardType === 'cash') {
      setMoney((prev) => prev + ch.rewardValue);
      showToast(`🏆 Défi validé ! +${formatMoney(ch.rewardValue)} crédités !`);
    } else if (ch.rewardType === 'crate') {
      const qty = ch.rewardValue;
      const pulled = [];
      for (let i = 0; i < qty; i++) {
        const picked = rollSingleEmployee();
        const newCard = {
          uid: `emp_ch_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
          templateId: picked.id,
          stars: 1
        };
        pulled.push({ ...picked, ...newCard });
      }
      setInventory((prev) => [
        ...prev,
        ...pulled.map(({ uid, templateId, stars }) => ({ uid, templateId, stars }))
      ]);
      setCrateDrops(pulled);
      setActiveTab('gacha');
      showToast(`🎁 Défi validé ! ${qty} Caisse${qty > 1 ? 's' : ''} ouverte${qty > 1 ? 's' : ''} !`);
    }
  };

  const handleAssignEmployee = (slotIdx, empUid) => {
    setSlots((prev) => {
      const next = prev.map((s) => (s && s.employeeId === empUid ? { ...s, employeeId: null } : s));
      if (next[slotIdx]) {
        next[slotIdx] = { ...next[slotIdx], employeeId: empUid || null };
      }
      return next;
    });
  };

  // Ouverture de 1 ou 10 caisses
  const handleOpenCrates = (qty = 1) => {
    const totalCost = getMultiCrateCost(inventory.length, qty);
    if (money < totalCost || isOpeningCrate) return;
    setMoney((prev) => prev - totalCost);
    setIsOpeningCrate(true);
    setCrateDrops([]);
    setTimeout(() => {
      const pulled = [];
      for (let i = 0; i < qty; i++) {
        const picked = rollSingleEmployee();
        const newCard = {
          uid: `emp_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
          templateId: picked.id,
          stars: 1
        };
        pulled.push({ ...picked, ...newCard });
      }
      setInventory((prev) => [
        ...prev,
        ...pulled.map(({ uid, templateId, stars }) => ({ uid, templateId, stars }))
      ]);
      setIsOpeningCrate(false);
      setCrateDrops(pulled);
    }, 1050);
  };

  const handleMerge = (emp) => {
    const stars = emp.stars || 1;
    const freeCopies = inventory.filter(
      (c) => c.templateId === emp.id && (c.stars || 1) === stars && !slots.some((s) => s && s.employeeId === c.uid)
    );
    if (freeCopies.length >= 3) {
      const toConsume = freeCopies.slice(0, 3).map((c) => c.uid);
      setInventory((prev) => {
        const remaining = prev.filter((c) => !toConsume.includes(c.uid));
        remaining.push({ uid: `emp_${Date.now()}_m`, templateId: emp.id, stars: stars + 1 });
        return remaining;
      });
      showToast(`⭐ Fusion Réussie ! ${emp.name} passe ${stars + 1} étoiles !`);
    }
  };

  // Groupement et tri des cartes dans Ma Galerie (du meilleur au moins bon par défaut)
  const getGroupedInventory = () => {
    const groups = {};
    inventory.forEach((card) => {
      const emp = EMPLOYEES_CATALOG.find((e) => e.id === card.templateId);
      if (!emp) return;
      if (galleryRarityFilter !== 'ALL' && emp.rarity !== galleryRarityFilter) return;
      const stars = card.stars || 1;
      const key = `${emp.id}_${stars}`;
      if (!groups[key]) {
        groups[key] = {
          template: { ...emp, ...card, stars },
          count: 0,
          items: [],
          effectiveMult: getCardMachineMultiplier(emp, stars, null),
          rarityRank: RARITY_STYLES[emp.rarity]?.rank ?? 0
        };
      }
      groups[key].count++;
      groups[key].items.push(card);
    });

    const list = Object.values(groups);
    list.sort((a, b) => {
      switch (gallerySort) {
        case 'rarity':
          return b.rarityRank - a.rarityRank || b.effectiveMult - a.effectiveMult;
        case 'stars':
          return (b.template.stars || 1) - (a.template.stars || 1) || b.effectiveMult - a.effectiveMult;
        case 'count':
          return b.count - a.count || b.effectiveMult - a.effectiveMult;
        case 'name':
          return a.template.name.localeCompare(b.template.name);
        case 'best':
        default:
          return b.effectiveMult - a.effectiveMult || b.rarityRank - a.rarityRank;
      }
    });
    return list;
  };

  // ==========================================
  // RENDU DES 7 ONGLETS DU JEU
  // ==========================================
  const renderProduction = () => {
    const nextClickValue = 1 * Math.pow(1.35, clickLevel);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-center h-full">
        {/* Centre en premier sur téléphone */}
        <div className="order-1 lg:order-2 lg:col-span-4 flex flex-col items-center justify-center py-2">
          <button
            type="button"
            onClick={handleManualClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}
            className="relative group active:scale-95 transition-transform focus:outline-none select-none touch-manipulation"
          >
            <div
              className="absolute -inset-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 rounded-full blur-2xl transition-opacity duration-200"
              style={{ opacity: 0.25 + spindleRpm / 200 }}
            />
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 rounded-full border-4 border-emerald-500/70 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col items-center justify-center overflow-hidden">
              <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none">
                <circle cx="100" cy="100" r="90" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="6"
                  strokeDasharray="18 12"
                  className="origin-center animate-spin"
                  style={{ animationDuration: spindleRpm > 20 ? '2s' : '10s' }}
                />
                <g transform="translate(0, -12)">
                  <rect x="86" y="34" width="28" height="22" rx="3" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
                  <path d="M 92 56 L 108 56 L 104 78 L 96 78 Z" fill="#fbbf24" />
                  <rect x="70" y="78" width="60" height="10" rx="2" fill="#38bdf8" stroke="#bae6fd" strokeWidth="1" />
                </g>
              </svg>
              <div className="relative z-10 mt-16 flex flex-col items-center">
                <div className="text-xl sm:text-2xl font-black text-white tracking-widest drop-shadow">USINER</div>
                <div className="mt-1 text-xs sm:text-sm font-mono font-black text-emerald-300 bg-emerald-950/90 px-3.5 py-1 rounded-full border border-emerald-400/40 shadow-lg">
                  +{formatMoney(clickValue)} / clic
                </div>
              </div>

              {floatingGains.map((g) => (
                <div
                  key={g.id}
                  style={{ left: g.x, top: g.y }}
                  className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 animate-float-gain"
                >
                  <div className="text-base font-black font-mono text-amber-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" /> +{g.val}
                  </div>
                </div>
              ))}
            </div>
          </button>
        </div>

        {/* Panneau Gauche : Télémétrie Cockpit */}
        <div className="order-2 lg:order-1 lg:col-span-4 bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5" /> Cockpit CNC Manuel
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1.5">Usinage &amp; Prototypage</h2>
          <p className="text-slate-400 text-xs leading-relaxed mb-3.5">
            Actionnez la broche d&apos;usinage pour fabriquer vos premières séries de pièces mécaniques et débloquer votre première machine CNC automatique dès{' '}
            <span className="text-amber-400 font-bold">150 $</span>.
          </p>
          <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-bold uppercase">Régime Broche (RPM)</span>
              <span className="text-cyan-400 font-black">{Math.round(spindleRpm * 180)} tr/min</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-rose-500 transition-all duration-150"
                style={{ width: `${spindleRpm}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase font-black">Gain / Pièce</div>
                <div className="text-sm font-mono font-black text-emerald-400">+{formatMoney(clickValue)}</div>
              </div>
              <div className="bg-slate-900/90 rounded-xl p-2 border border-slate-800">
                <div className="text-[9px] text-slate-500 uppercase font-black">Outil Actuel</div>
                <div className="text-sm font-mono font-black text-amber-400">Carbure Niv.{clickLevel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau Droit : Amélioration Outillage */}
        <div className="order-3 lg:col-span-4 bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Outillage Coupant
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">Niveau {clickLevel}</span>
            </div>
            <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 flex items-center gap-3.5 mb-3.5">
              <svg viewBox="0 0 80 80" className="w-14 h-14 flex-shrink-0">
                <polygon points="40,8 72,64 8,64" fill="#f59e0b" stroke="#fde047" strokeWidth="3" strokeLinejoin="round" />
                <circle cx="40" cy="45" r="9" fill="#090d16" stroke="#fcd34d" strokeWidth="2" />
              </svg>
              <div>
                <h3 className="text-base font-black text-white">Plaquettes Carbure TiAlN</h3>
                <p className="text-[11px] text-slate-400">
                  Augmente la vitesse de coupe manuelle de +35% par niveau (Coût +85%/niv).
                </p>
                <div className="mt-1 text-xs font-mono text-emerald-400 font-bold">
                  Prochain : +{formatMoney(nextClickValue)} / clic
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleUpgradeClick}
            disabled={money < clickUpgradeCost}
            className={`w-full py-3.5 px-5 rounded-2xl font-black flex items-center justify-between transition-all touch-manipulation ${
              money >= clickUpgradeCost
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_6px_0_#1e3a8a] active:translate-y-1 active:shadow-none'
                : 'bg-slate-950 text-slate-600 border border-slate-800 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-2 text-sm">
              <ArrowUpCircle className="w-5 h-5" /> Monter Niveau {clickLevel + 1}
            </span>
            <span className="font-mono text-sm bg-black/30 px-3 py-1 rounded-lg">{formatMoney(clickUpgradeCost)}</span>
          </button>
        </div>
      </div>
    );
  };

  const renderPlan = () => {
    const floorObj = ATELIER_UPGRADES.floors.find((f) => f.id === atelier.floor) || ATELIER_UPGRADES.floors[0];
    return (
      <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 border-2 border-slate-800 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <MapIcon className="text-cyan-400 w-5 h-5" /> Plan 2D : {currentSize.name}
            </h2>
            <p className="text-xs text-slate-400">
              Revêtement : <span className="text-white font-bold">{floorObj.name}</span> • Îlots :{' '}
              <span className="text-cyan-400 font-bold">
                {currentSize.slots} / {MAX_SLOTS_COUNT}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span
              className={`px-2.5 py-1 rounded-xl font-black border flex items-center gap-1.5 ${
                atelier.crane
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${atelier.crane ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`} />
              Pont 10T
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl font-black border flex items-center gap-1.5 ${
                atelier.agv
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${atelier.agv ? 'bg-cyan-400 animate-ping' : 'bg-slate-700'}`} />
              AGV
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl font-black border flex items-center gap-1.5 ${
                atelier.cobots
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${atelier.cobots ? 'bg-emerald-400 animate-ping' : 'bg-slate-700'}`} />
              Cobots
            </span>
            <span
              className={`px-2.5 py-1 rounded-xl font-black border flex items-center gap-1.5 ${
                atelier.twin_ai
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-slate-950 border-slate-800 text-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${atelier.twin_ai ? 'bg-purple-400 animate-ping' : 'bg-slate-700'}`} />
              IA Jumeau
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 overflow-x-auto no-scrollbar rounded-2xl">
            <div
              className={`${
                currentSize.slots > 16 ? 'min-w-[540px] sm:min-w-0' : 'min-w-0'
              } aspect-[4/3] sm:aspect-[16/10] rounded-2xl relative border-4 border-slate-700 overflow-hidden shadow-inner p-2.5 sm:p-4`}
              style={{ backgroundColor: floorObj.color }}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                  backgroundSize: '36px 36px'
                }}
              />
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-4 border-y-2 border-dashed border-yellow-400/30 bg-yellow-500/5 pointer-events-none" />

              <div
                className={`relative z-10 h-full grid ${
                  currentSize.slots > 16 ? 'grid-cols-6 grid-rows-4 gap-2' : 'grid-cols-4 grid-rows-4 gap-2 sm:gap-3'
                }`}
              >
                {slots.slice(0, currentSize.slots > 16 ? 24 : 16).map((slot, idx) => {
                  if (idx >= currentSize.slots) {
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950/80 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600"
                      >
                        <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mb-0.5" />
                        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider">Murs Niv.+</span>
                      </div>
                    );
                  }

                  if (!slot || !slot.machineId) {
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveTab('machines')}
                        className="bg-slate-950/45 hover:bg-slate-900/80 border-2 border-dashed border-yellow-500/40 hover:border-yellow-400 rounded-xl flex flex-col items-center justify-center transition group touch-manipulation"
                      >
                        <span className="text-[8px] sm:text-[9px] font-mono text-yellow-400 font-black group-hover:scale-105 transition">
                          ÎLOT #{idx + 1}
                        </span>
                        <span className="text-[7px] sm:text-[8px] text-slate-300 bg-slate-900/80 px-1.5 py-0.5 rounded mt-0.5 border border-white/10">
                          + CNC
                        </span>
                      </button>
                    );
                  }

                  const machine = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
                  const card = slot.employeeId ? inventory.find((c) => c.uid === slot.employeeId) : null;
                  const emp = card ? EMPLOYEES_CATALOG.find((e) => e.id === card.templateId) : null;
                  const isMalus = emp?.rarity === 'MALUS';
                  const hasSynergy = emp && !isMalus && (emp.specialty === machine.id || emp.specialty === 'ALL');

                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveTab('machines')}
                      className={`cursor-pointer rounded-xl p-1 sm:p-1.5 flex flex-col justify-between border-2 shadow-xl relative overflow-hidden group transition-transform hover:scale-[1.03] touch-manipulation ${
                        isMalus
                          ? 'border-lime-500 shadow-[0_0_15px_rgba(132,204,22,0.35)]'
                          : hasSynergy
                          ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.35)]'
                          : 'border-white/25'
                      }`}
                      style={{ background: `linear-gradient(160deg, ${machine.color} 0%, #090d16 95%)` }}
                    >
                      <div className="flex items-center justify-between text-[7px] sm:text-[8px] font-mono text-white font-black z-10 px-0.5">
                        <span className="bg-black/60 px-1 py-0.5 rounded">#{idx + 1}</span>
                        <span className="flex items-center gap-1 bg-black/60 px-1 py-0.5 rounded">
                          <span
                            className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                              isMalus
                                ? 'bg-lime-400 animate-ping'
                                : hasSynergy
                                ? 'bg-amber-400 animate-ping'
                                : 'bg-emerald-400 animate-pulse'
                            }`}
                          />
                          <span className={`hidden sm:inline ${isMalus ? 'text-lime-400' : 'text-emerald-300'}`}>
                            {formatMoney(prodStats.breakdown[idx])}/s
                          </span>
                        </span>
                      </div>

                      <div className="w-full h-9 sm:h-14 my-auto flex items-center justify-center">
                        <MachineIllustration id={machine.id} animated={true} className="w-full h-full" />
                      </div>

                      <div className="bg-slate-950/90 rounded-lg px-1 py-0.5 flex items-center justify-between border border-white/10 z-10">
                        <div className="min-w-0 flex-1">
                          <div className="text-[7px] sm:text-[8px] font-black text-white truncate">{machine.name}</div>
                          <div
                            className={`text-[6px] sm:text-[7px] font-bold truncate ${
                              isMalus ? 'text-lime-400' : emp ? 'text-cyan-300' : 'text-slate-500'
                            }`}
                          >
                            {emp ? emp.name : 'Libre'}
                          </div>
                        </div>
                        {emp && (
                          <div
                            className={`w-4 h-4 sm:w-6 sm:h-6 rounded-full overflow-hidden border ${
                              isMalus ? 'border-lime-400' : 'border-amber-400'
                            } flex-shrink-0 ml-1`}
                          >
                            <CharacterPortrait id={emp.id} spriteSheetUrl={spriteSheetUrl} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {atelier.crane && (
                <>
                  <div className="absolute top-1 inset-x-0 h-2 bg-yellow-500/40 z-20 border-y border-yellow-400" />
                  <div className="absolute bottom-1 inset-x-0 h-2 bg-yellow-500/40 z-20 border-y border-yellow-400" />
                  <div className="absolute top-1 bottom-1 w-9 z-20 animate-crane pointer-events-none flex flex-col items-center justify-between">
                    <div className="w-full h-full bg-yellow-500/75 border-x-2 border-slate-950 shadow-2xl flex items-center justify-center">
                      <div className="w-6 h-10 rounded bg-slate-950 border-2 border-yellow-300 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {atelier.agv && (
                <div className="absolute inset-0 z-20 pointer-events-none">
                  <div className="absolute w-10 h-6 bg-slate-950 border-2 border-cyan-400 rounded-lg shadow-[0_0_15px_#22d3ee] animate-agv-h top-1/2 -translate-y-1/2 flex items-center justify-between px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[7px] font-black text-cyan-300 font-mono">AGV</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Colonne Droite : Labo Métrologie & Bureau d'Études */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            <div className="bg-slate-950 border-2 border-cyan-500/30 rounded-2xl p-4 flex-1 flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono uppercase text-cyan-400 font-black px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30">
                    Climatisé 20.0°C
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">ISO 9001</span>
                </div>
                <h4 className="text-sm font-black text-white mt-2">Labo Métrologie MMT</h4>
                <svg viewBox="0 0 140 65" className="w-full h-14 my-2 bg-slate-900/90 rounded-xl border border-slate-800 p-1">
                  <rect x="20" y="48" width="100" height="10" rx="2" fill="#334155" />
                  <path d="M 35 48 L 35 12 L 105 12 L 105 48" fill="none" stroke="#38bdf8" strokeWidth="3.5" />
                  <g className="animate-carriage">
                    <rect x="64" y="10" width="12" height="22" rx="2" fill="#e2e8f0" />
                    <line x1="70" y1="32" x2="70" y2="42" stroke="#94a3b8" strokeWidth="2" />
                    <circle cx="70" cy="42" r="2.5" fill="#f43f5e" className="animate-ping" />
                  </g>
                  <rect x="55" y="42" width="30" height="6" rx="1" fill="#22d3ee" opacity="0.7" />
                </svg>
              </div>
              <div className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-2 text-center">
                Bonus Usine : +{Math.round(atelierBonus * 100)}% Prod.
              </div>
            </div>

            <div className="bg-slate-950 border-2 border-amber-500/30 rounded-2xl p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-mono uppercase text-amber-400 font-black px-2 py-0.5 rounded bg-amber-950 border border-amber-500/30 inline-block">
                  Bureau d&apos;Études
                </div>
                <h4 className="text-sm font-black text-white mt-2">FAO &amp; Équipe Technique</h4>
                <svg viewBox="0 0 140 60" className="w-full h-12 my-2 bg-slate-900/90 rounded-xl border border-slate-800 p-1">
                  <rect x="18" y="10" width="46" height="30" rx="3" fill="#090d16" stroke="#38bdf8" strokeWidth="1.5" />
                  <path d="M 26 30 L 38 18 L 54 26 L 42 34 Z" fill="none" stroke="#22d3ee" strokeWidth="1.5" />
                  <rect x="76" y="10" width="46" height="30" rx="3" fill="#090d16" stroke="#f59e0b" strokeWidth="1.5" />
                  <line x1="82" y1="18" x2="114" y2="18" stroke="#fbbf24" strokeWidth="2" />
                  <line x1="82" y1="25" x2="106" y2="25" stroke="#34d399" strokeWidth="2" />
                  <rect x="12" y="44" width="116" height="6" rx="2" fill="#334155" />
                </svg>
                <p className="text-[11px] text-slate-400">
                  Cartes en collection : <span className="text-white font-black">{inventory.length}</span>
                </p>
              </div>
              <button
                onClick={() => setActiveTab('gacha')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition shadow-lg touch-manipulation"
              >
                Recruter (Coffres) →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMachines = () => {
    const availableCards = inventory.filter((c) => !slots.some((s) => s && s.employeeId === c.uid));
    const firstEmptySlot = slots.findIndex((s, idx) => idx < currentSize.slots && (!s || !s.machineId));

    return (
      <div className="space-y-5">
        {/* Bandeau Catalogue Permanent des Machines */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Catalogue &amp; Tarifs Actuels
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {firstEmptySlot !== -1
                ? `Touchez une machine → Îlot #${firstEmptySlot + 1}`
                : `Parc plein (${currentSize.slots}/${currentSize.slots} îlots)`}
            </span>
          </div>
          <div className="flex overflow-x-auto no-scrollbar lg:grid lg:grid-cols-9 gap-2 pb-1">
            {MACHINES_CATALOG.map((machine) => {
              const cost = getMachineCost(machine.id);
              const ownedCount = slots.filter((s, i) => i < currentSize.slots && s && s.machineId === machine.id).length;
              const canInstall = firstEmptySlot !== -1 && money >= cost;
              return (
                <button
                  key={machine.id}
                  onClick={() => firstEmptySlot !== -1 && handleBuyMachine(machine.id, firstEmptySlot)}
                  disabled={!canInstall}
                  className={`min-w-[125px] lg:min-w-0 p-2 rounded-xl border text-left transition flex flex-col justify-between shrink-0 touch-manipulation ${
                    canInstall
                      ? 'bg-slate-800/90 hover:bg-slate-700 border-cyan-500/40 hover:border-cyan-400 cursor-pointer'
                      : 'bg-slate-950/90 border-slate-800/90 opacity-85 cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="w-9 h-7 rounded bg-slate-900 p-0.5 flex-shrink-0">
                      <MachineIllustration id={machine.id} animated={false} />
                    </div>
                    <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-white/10">
                      x{ownedCount}
                    </span>
                  </div>
                  <div className="text-[11px] font-black text-white truncate">{machine.name}</div>
                  <div className="text-[10px] font-mono text-emerald-400 font-bold">+{formatMoney(machine.baseProd)}/s</div>
                  <div className={`text-[11px] font-mono font-black ${money >= cost ? 'text-amber-400' : 'text-slate-400'}`}>
                    {formatMoney(cost)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grille des Îlots de l'atelier */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map((slot, idx) => {
            if (idx >= currentSize.slots) return null;

            if (!slot || !slot.machineId) {
              return (
                <div
                  key={idx}
                  className="h-[24rem] sm:h-[25rem] bg-slate-900/95 border-2 border-dashed border-slate-700 rounded-3xl p-3.5 overflow-y-auto custom-scrollbar flex flex-col gap-2 shadow-xl"
                >
                  <div className="text-xs text-cyan-400 text-center font-black sticky top-0 bg-slate-900 py-1.5 border-b border-slate-800 z-10 tracking-wider">
                    ÎLOT #{idx + 1} — INSTALLER UNE CNC
                  </div>
                  {MACHINES_CATALOG.map((machine) => {
                    const cost = getMachineCost(machine.id);
                    const canAfford = money >= cost;
                    return (
                      <button
                        key={machine.id}
                        onClick={() => handleBuyMachine(machine.id, idx)}
                        disabled={!canAfford}
                        className={`p-2 rounded-2xl text-left border-2 flex items-center gap-2.5 transition-all touch-manipulation ${
                          canAfford
                            ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-600 hover:border-cyan-400 shadow-md'
                            : 'bg-slate-950/70 border-slate-900 opacity-45 cursor-not-allowed'
                        }`}
                      >
                        <div className="w-12 h-10 rounded-xl bg-slate-950 p-1 border border-white/10 flex-shrink-0">
                          <MachineIllustration id={machine.id} animated={false} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-white truncate">{machine.name}</div>
                          <div className="text-[10px] font-mono text-emerald-400 font-bold">+{formatMoney(machine.baseProd)}/s</div>
                          <div className="text-[11px] font-mono text-amber-400 font-black">{formatMoney(cost)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            }

            const machine = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
            const card = slot.employeeId ? inventory.find((c) => c.uid === slot.employeeId) : null;
            const emp = card ? EMPLOYEES_CATALOG.find((e) => e.id === card.templateId) : null;
            const slotProd = prodStats.breakdown[idx];
            const isMalus = emp?.rarity === 'MALUS';
            const hasSynergy = emp && !isMalus && (emp.specialty === machine.id || emp.specialty === 'ALL');
            const appliedMult = emp ? getCardMachineMultiplier(emp, card.stars || 1, machine.id) : 1;

            return (
              <div
                key={idx}
                className={`h-[24rem] sm:h-[25rem] rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden shadow-2xl border-2 transition-all ${
                  isMalus
                    ? 'border-lime-500 shadow-[0_0_25px_rgba(132,204,22,0.3)]'
                    : hasSynergy
                    ? 'border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
                    : 'border-white/15'
                }`}
                style={{ background: `linear-gradient(155deg, ${machine.color} 0%, #090d16 92%)` }}
              >
                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black bg-slate-950/80 border border-white/15 px-3 py-1 rounded-full text-slate-200 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isMalus ? 'bg-lime-400' : 'bg-emerald-400'} animate-ping`} /> ÎLOT #{idx + 1}
                  </span>
                  <button
                    onClick={() => handleSellMachine(idx)}
                    className="text-[10px] font-bold text-rose-300 hover:text-white bg-rose-950/80 hover:bg-rose-600 border border-rose-500/30 px-2.5 py-1 rounded-full transition touch-manipulation"
                  >
                    Revendre
                  </button>
                </div>

                <div className="relative z-10 my-1 bg-slate-950/60 rounded-2xl p-2 border border-white/10 h-28 flex items-center justify-center shadow-inner">
                  <MachineIllustration id={machine.id} animated={true} className="w-full h-full" />
                  {isMalus ? (
                    <div className="absolute -bottom-2.5 inset-x-4 bg-gradient-to-r from-lime-600 via-stone-700 to-lime-600 text-white text-[9px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full text-center shadow-lg border border-lime-400/50">
                      ⚠️ MALUS ACTIF (-{Math.round((1 - appliedMult) * 100)}%)
                    </div>
                  ) : (
                    hasSynergy && (
                      <div className="absolute -bottom-2.5 inset-x-4 bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider py-0.5 px-2 rounded-full text-center shadow-lg">
                        ⚡ SYNERGIE PARFAITE x2 ACTIVE
                      </div>
                    )
                  )}
                </div>

                <div className="relative z-10 text-center">
                  <h3 className="text-base font-black text-white leading-tight truncate">{machine.name}</h3>
                  <div className={`text-lg font-mono font-black ${isMalus ? 'text-lime-400' : 'text-emerald-400'}`}>
                    +{formatMoney(slotProd)}/s
                  </div>
                </div>

                <div className="relative z-10 bg-slate-950/90 p-2.5 rounded-2xl border border-white/15">
                  {card && emp ? (
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-11 h-11 rounded-xl overflow-hidden border-2 ${
                          isMalus ? 'border-lime-400' : 'border-amber-400'
                        } flex-shrink-0`}
                      >
                        <CharacterPortrait id={emp.id} spriteSheetUrl={spriteSheetUrl} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-white truncate">
                          {emp.name}{' '}
                          <span className={isMalus ? 'text-lime-400' : 'text-yellow-400'}>
                            {'★'.repeat(card.stars || 1)}
                          </span>
                        </div>
                        <div className={`text-[10px] font-mono font-bold ${isMalus ? 'text-lime-400' : 'text-amber-300'}`}>
                          {isMalus ? `Malus : x${appliedMult.toFixed(2)}` : `Boost : x${appliedMult.toFixed(2)}`}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssignEmployee(idx, null)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-black transition touch-manipulation"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAssigningSlot(idx)}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-dashed border-cyan-400/50 text-cyan-300 text-xs font-black flex items-center justify-center gap-2 transition touch-manipulation"
                    >
                      <UserCheck className="w-4 h-4" /> Affecter une Carte ({availableCards.length} dispo)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modale de sélection de carte opérateur avec Trieur */}
        {assigningSlot !== null && (() => {
          const targetSlot = slots[assigningSlot];
          const targetMachine = targetSlot ? MACHINES_CATALOG.find((m) => m.id === targetSlot.machineId) : null;

          const enrichedCards = availableCards
            .map((card) => {
              const emp = EMPLOYEES_CATALOG.find((e) => e.id === card.templateId);
              if (!emp) return null;
              const isMalus = emp.rarity === 'MALUS';
              const isSynergy = !isMalus && targetMachine && (emp.specialty === targetMachine.id || emp.specialty === 'ALL');
              const machineMult = getCardMachineMultiplier(emp, card.stars || 1, targetMachine?.id);
              const baseMult = getCardMachineMultiplier(emp, card.stars || 1, null);
              const rarityRank = RARITY_STYLES[emp.rarity]?.rank ?? 0;
              return { card, emp, isMalus, isSynergy, machineMult, baseMult, rarityRank };
            })
            .filter(Boolean)
            .filter((item) => (!assignSynergyOnly ? true : item.isSynergy))
            .sort((a, b) => {
              switch (assignSort) {
                case 'base':
                  return b.baseMult - a.baseMult || b.machineMult - a.machineMult;
                case 'rarity':
                  return b.rarityRank - a.rarityRank || b.machineMult - a.machineMult;
                case 'stars':
                  return (b.card.stars || 1) - (a.card.stars || 1) || b.machineMult - a.machineMult;
                case 'best_machine':
                default:
                  return b.machineMult - a.machineMult || b.rarityRank - a.rarityRank;
              }
            });

          return (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
              <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-4 sm:p-6 max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Opérateur — Îlot #{assigningSlot + 1} ({targetMachine?.name})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Trié par rendement réel sur cette machine (<span className="text-amber-400 font-bold">Synergie x2</span> incluse)
                    </p>
                  </div>
                  <button
                    onClick={() => setAssigningSlot(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold touch-manipulation shrink-0"
                  >
                    Fermer ✕
                  </button>
                </div>

                {/* Barre de tri & filtre dans la modale d'affectation */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <ArrowDownWideNarrow className="w-3.5 h-3.5 text-cyan-400" /> Trier :
                    </span>
                    {[
                      { id: 'best_machine', label: 'Meilleur sur cette CNC' },
                      { id: 'base', label: 'Boost Base' },
                      { id: 'rarity', label: 'Rareté' },
                      { id: 'stars', label: 'Étoiles ★' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setAssignSort(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition touch-manipulation ${
                          assignSort === opt.id
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setAssignSynergyOnly((prev) => !prev)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-black border transition touch-manipulation flex items-center gap-1 ${
                      assignSynergyOnly
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-950 text-amber-300 border-amber-500/30 hover:bg-slate-800'
                    }`}
                  >
                    <Zap className="w-3 h-3" /> Synergies x2 uniquement
                  </button>
                </div>

                {enrichedCards.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    {availableCards.length === 0
                      ? "Aucune carte disponible en réserve. Ouvrez un coffre dans l'onglet Coffres !"
                      : 'Aucune carte disponible ne correspond à ce filtre.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar py-3 pr-1">
                    {enrichedCards.map(({ card, emp, isMalus, isSynergy, machineMult }) => (
                      <div
                        key={card.uid}
                        onClick={() => {
                          handleAssignEmployee(assigningSlot, card.uid);
                          setAssigningSlot(null);
                        }}
                        className="cursor-pointer relative group touch-manipulation"
                      >
                        {isMalus ? (
                          <div className="absolute -top-2 inset-x-3 z-30 bg-lime-700 text-white text-[9px] font-black uppercase text-center py-0.5 rounded-full shadow-lg">
                            ⚠️ MALUS
                          </div>
                        ) : (
                          isSynergy && (
                            <div className="absolute -top-2 inset-x-3 z-30 bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 text-[9px] font-black uppercase text-center py-0.5 rounded-full shadow-lg">
                              ⚡ SYNERGIE x2
                            </div>
                          )
                        )}
                        <TradingCard
                          employee={{ ...emp, ...card }}
                          machineMatchMult={machineMult}
                          spriteSheetUrl={spriteSheetUrl}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderGacha = () => {
    const discoveredSet = new Set(inventory.map((c) => c.templateId));
    const discoveredCount = discoveredSet.size;
    const totalRoster = EMPLOYEES_CATALOG.length;

    return (
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Zone Ouverture de Caisse (x1 et x10) */}
        <div className="lg:w-1/3 bg-slate-900 border-2 border-slate-800 p-4 rounded-3xl text-center shadow-2xl flex flex-col items-center justify-center min-h-[380px] relative overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {isOpeningCrate ? (
            <div className="py-12 flex flex-col items-center relative z-10">
              <SupplyCrateSVG shaking={true} />
              <div className="mt-4 text-lg font-black text-amber-300 uppercase tracking-widest animate-pulse">
                Déverrouillage Holographique...
              </div>
            </div>
          ) : crateDrops.length === 1 ? (
            <div className="flex flex-col items-center w-full relative z-10 animate-card-reveal">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Nouvelle Carte Recrutée !
              </div>
              <div className="w-48 my-1">
                <TradingCard employee={crateDrops[0]} spriteSheetUrl={spriteSheetUrl} />
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                <button
                  onClick={() => setCrateDrops([])}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 border border-slate-700 touch-manipulation"
                >
                  Fermer
                </button>
                {money >= crateCost1 && (
                  <button
                    onClick={() => handleOpenCrates(1)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-black hover:scale-105 transition shadow-lg touch-manipulation"
                  >
                    x1 ({formatMoney(crateCost1)})
                  </button>
                )}
                {money >= crateCost10 && (
                  <button
                    onClick={() => handleOpenCrates(10)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-xs font-black hover:scale-105 transition shadow-lg touch-manipulation"
                  >
                    x10 ({formatMoney(crateCost10)})
                  </button>
                )}
              </div>
            </div>
          ) : crateDrops.length > 1 ? (
            <div className="flex flex-col items-center w-full relative z-10 animate-card-reveal">
              <div className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> Pack x10 Ouvert !
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-2 gap-2 w-full max-h-[260px] overflow-y-auto custom-scrollbar p-1">
                {[...crateDrops]
                  .sort((a, b) => (RARITY_STYLES[b.rarity]?.rank ?? 0) - (RARITY_STYLES[a.rarity]?.rank ?? 0))
                  .map((drop) => {
                    const st = RARITY_STYLES[drop.rarity] || RARITY_STYLES.COMMON;
                    return (
                      <div
                        key={drop.uid}
                        className={`p-1.5 rounded-xl bg-gradient-to-br ${st.gradient} border ${st.border} flex items-center gap-2 text-left`}
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-950 shrink-0">
                          <CharacterPortrait id={drop.id} spriteSheetUrl={spriteSheetUrl} />
                        </div>
                        <div className="min-w-0 flex-1 bg-slate-950/90 rounded-lg px-2 py-1">
                          <div className="text-[10px] font-black text-white truncate">{drop.name}</div>
                          <div className={`text-[8px] font-black uppercase ${st.text}`}>{st.label}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setCrateDrops([])}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 border border-slate-700 touch-manipulation"
                >
                  Valider
                </button>
                {money >= crateCost10 && (
                  <button
                    onClick={() => handleOpenCrates(10)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-xs font-black hover:scale-105 transition shadow-lg touch-manipulation"
                  >
                    Rouvrir x10 ({formatMoney(crateCost10)})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-center w-full">
              <SupplyCrateSVG shaking={false} />
              <h2 className="text-xl font-black text-white mt-1 mb-1">Caisse de Recrutement</h2>
              <p className="text-[11px] text-slate-400 mb-2.5 max-w-xs">
                Recrutez parmi les <span className="text-white font-bold">{totalRoster} personnages GMP</span> dont{' '}
                <span className="text-emerald-300 font-black">Mr Klepacz (0,1%)</span>,{' '}
                <span className="text-rose-400 font-bold">Castagnetti &amp; Ms T</span> !
              </p>
              <div className="text-[10px] font-mono text-amber-300/90 bg-amber-950/40 border border-amber-500/30 px-2.5 py-1 rounded-lg mb-3">
                Coût évolutif : +18% par carte recrutée
              </div>

              <div className="w-full space-y-2">
                <button
                  onClick={() => handleOpenCrates(1)}
                  disabled={money < crateCost1}
                  className={`w-full py-3 rounded-2xl font-black text-sm transition-all touch-manipulation ${
                    money >= crateCost1
                      ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 shadow-[0_5px_0_#92400e] hover:brightness-110 active:translate-y-1 active:shadow-none'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  Ouvrir x1 ({formatMoney(crateCost1)})
                </button>

                <button
                  onClick={() => handleOpenCrates(10)}
                  disabled={money < crateCost10}
                  className={`w-full py-3 rounded-2xl font-black text-sm transition-all touch-manipulation ${
                    money >= crateCost10
                      ? 'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-slate-950 shadow-[0_5px_0_#1e3a8a] hover:brightness-110 active:translate-y-1 active:shadow-none'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  Ouvrir x10 ({formatMoney(crateCost10)})
                </button>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-1 text-[9px] font-mono font-bold">
                {Object.entries(DROP_RATES).map(([rarity, rate]) => (
                  <span key={rarity} className={`${RARITY_STYLES[rarity].text} bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800`}>
                    {RARITY_STYLES[rarity].label} {rate}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne Droite : Bascule Galerie (avec Trieur) / GMP-Dex */}
        <div className="lg:w-2/3 bg-slate-900 border-2 border-slate-800 p-4 sm:p-5 rounded-3xl shadow-2xl flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setGachaSubTab('gallery')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition touch-manipulation ${
                  gachaSubTab === 'gallery'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Ma Galerie ({inventory.length})
              </button>
              <button
                onClick={() => setGachaSubTab('gmpdex')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition touch-manipulation ${
                  gachaSubTab === 'gmpdex'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> GMP-Dex ({discoveredCount}/{totalRoster})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer text-xs text-cyan-300 hover:text-white font-black bg-cyan-500/15 hover:bg-cyan-600 border border-cyan-500/40 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition shadow">
                <ImageIcon className="w-3.5 h-3.5" /> {spriteSheetUrl ? 'Changer la planche' : 'Importer la planche'}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
              <span className="text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                ⚡ 3 doublons = Fusion ★ (+35%)
              </span>
            </div>
          </div>

          {gachaSubTab === 'gmpdex' ? (
            <>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 mb-4">
                <div className="flex items-center justify-between text-xs font-black mb-1.5">
                  <span className="text-cyan-300 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Encyclopédie Officielle GMP-Dex
                  </span>
                  <span className="font-mono text-emerald-400">
                    {discoveredCount} / {totalRoster} découverts ({Math.round((discoveredCount / totalRoster) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 transition-all duration-500"
                    style={{ width: `${(discoveredCount / totalRoster) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {EMPLOYEES_CATALOG.map((emp, idx) => {
                  const ownedCards = inventory.filter((c) => c.templateId === emp.id);
                  const isUnlocked = ownedCards.length > 0;
                  const maxStars = isUnlocked ? Math.max(...ownedCards.map((c) => c.stars || 1)) : 1;
                  return (
                    <TradingCard
                      key={emp.id}
                      employee={{ ...emp, stars: maxStars }}
                      count={ownedCards.length}
                      dexIndex={idx + 1}
                      locked={!isUnlocked}
                      dropRate={DROP_RATES[emp.rarity]}
                      spriteSheetUrl={spriteSheetUrl}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Barre de Tri & Filtre de Ma Galerie */}
              {inventory.length > 0 && (
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <ArrowDownWideNarrow className="w-3.5 h-3.5 text-emerald-400" /> Trier :
                    </span>
                    {[
                      { id: 'best', label: 'Meilleur Boost' },
                      { id: 'rarity', label: 'Rareté' },
                      { id: 'stars', label: 'Étoiles ★' },
                      { id: 'count', label: 'Doublons' },
                      { id: 'name', label: 'Nom' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setGallerySort(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-black transition touch-manipulation ${
                          gallerySort === opt.id
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
                    {['ALL', 'SECRET', 'MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'MALUS'].map((rar) => (
                      <button
                        key={rar}
                        onClick={() => setGalleryRarityFilter(rar)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black transition whitespace-nowrap touch-manipulation ${
                          galleryRarityFilter === rar
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {rar === 'ALL' ? 'Toutes' : RARITY_STYLES[rar].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {inventory.length === 0 ? (
                <div className="text-center py-16 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                  Aucune carte pour l&apos;instant. Ouvrez une Caisse dès 1 200 $ pour recruter votre premier talent !
                </div>
              ) : getGroupedInventory().length === 0 ? (
                <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl text-xs">
                  Aucune carte dans cette catégorie de rareté.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {getGroupedInventory().map((group) => {
                    const freeCount = group.items.filter(
                      (item) => !slots.some((s) => s && s.employeeId === item.uid)
                    ).length;
                    return (
                      <TradingCard
                        key={`${group.template.id}_${group.template.stars}`}
                        employee={group.template}
                        count={group.count}
                        onMerge={freeCount >= 3 ? () => handleMerge(group.template) : null}
                        spriteSheetUrl={spriteSheetUrl}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderAtelier = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Agrandir les Murs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
          <Factory className="w-5 h-5 text-cyan-400" /> Agrandir les Murs
        </h3>
        <p className="text-xs text-slate-400 mb-4">Débloquez jusqu&apos;à 24 îlots pour vos machines CNC.</p>
        <div className="space-y-2.5">
          {ATELIER_UPGRADES.sizes.map((sz) => {
            const isCurrent = sz.level === atelier.sizeLevel;
            const isNext = sz.level === atelier.sizeLevel + 1;
            const canAfford = money >= sz.cost;

            if (sz.level < atelier.sizeLevel) {
              return (
                <div key={sz.level} className="text-xs text-emerald-400 font-bold p-3 bg-emerald-500/10 rounded-xl flex justify-between">
                  <span>
                    {sz.name} ({sz.slots} postes)
                  </span>{' '}
                  <Check className="w-4 h-4" />
                </div>
              );
            }
            if (isCurrent) {
              return (
                <div key={sz.level} className="text-xs text-white font-bold p-3 bg-slate-800 rounded-xl border border-cyan-500/40 flex justify-between">
                  <span>
                    {sz.name} ({sz.slots} postes)
                  </span>{' '}
                  <span className="text-cyan-400">Actuel</span>
                </div>
              );
            }
            if (isNext) {
              return (
                <button
                  key={sz.level}
                  onClick={() => {
                    if (!canAfford) return;
                    setMoney((prev) => prev - sz.cost);
                    setAtelier((prev) => ({ ...prev, sizeLevel: sz.level }));
                    showToast(`🏗️ Atelier agrandi : ${sz.name} !`);
                  }}
                  disabled={!canAfford}
                  className={`w-full text-left text-xs font-bold p-3 rounded-xl flex justify-between items-center transition touch-manipulation ${
                    canAfford
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg'
                      : 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <span>
                    Agrandir : {sz.name} ({sz.slots} postes)
                  </span>
                  <span className="font-mono">{formatMoney(sz.cost)}</span>
                </button>
              );
            }
            return (
              <div key={sz.level} className="text-xs text-slate-600 font-bold p-3 bg-slate-950/50 rounded-xl flex justify-between items-center">
                <span>
                  {sz.name} ({sz.slots} postes)
                </span>{' '}
                <Lock className="w-3.5 h-3.5" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sols & Esthétique */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
          <Combine className="w-5 h-5 text-emerald-400" /> Sols &amp; Esthétique
        </h3>
        <p className="text-xs text-slate-400 mb-4">Change l&apos;apparence du Plan 2D et booste le rendement.</p>
        <div className="space-y-2.5">
          {ATELIER_UPGRADES.floors.map((fl, idx) => {
            const currentIdx = ATELIER_UPGRADES.floors.findIndex((f) => f.id === atelier.floor);
            const isCurrent = fl.id === atelier.floor;
            const isNext = idx === currentIdx + 1;
            const canAfford = money >= fl.cost;

            if (idx < currentIdx) {
              return (
                <div key={fl.id} className="text-xs text-emerald-400 font-bold p-3 bg-emerald-500/10 rounded-xl flex justify-between">
                  <span>{fl.name}</span> <Check className="w-4 h-4" />
                </div>
              );
            }
            if (isCurrent) {
              return (
                <div key={fl.id} className="text-xs text-white font-bold p-3 bg-slate-800 rounded-xl border border-emerald-500/40 flex justify-between">
                  <span>{fl.name}</span> <span className="text-emerald-400">Installé</span>
                </div>
              );
            }
            if (isNext) {
              return (
                <button
                  key={fl.id}
                  onClick={() => {
                    if (!canAfford) return;
                    setMoney((prev) => prev - fl.cost);
                    setAtelier((prev) => ({ ...prev, floor: fl.id }));
                    showToast(`✨ Nouveau sol posé : ${fl.name} !`);
                  }}
                  disabled={!canAfford}
                  className={`w-full text-left text-xs font-bold p-3 rounded-xl flex justify-between items-center transition touch-manipulation ${
                    canAfford
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'
                      : 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <span>Poser : {fl.name}</span>
                  <span className="font-mono">{formatMoney(fl.cost)}</span>
                </button>
              );
            }
            return (
              <div key={fl.id} className="text-xs text-slate-600 font-bold p-3 bg-slate-950/50 rounded-xl flex justify-between items-center">
                <span>{fl.name}</span> <Lock className="w-3.5 h-3.5" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Automatisation Usine */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> Automatisation Usine
        </h3>
        <p className="text-xs text-slate-400 mb-4">Visibles en mouvement dans l&apos;onglet Plan 2D.</p>
        <div className="space-y-2.5">
          {ATELIER_UPGRADES.equipments.map((eq) => {
            const owned = atelier[eq.id];
            const canAfford = money >= eq.cost;

            if (owned) {
              return (
                <div key={eq.id} className="text-xs text-emerald-400 font-bold p-3 bg-emerald-500/10 rounded-xl flex justify-between">
                  <span>{eq.name}</span> <Check className="w-4 h-4" />
                </div>
              );
            }
            return (
              <button
                key={eq.id}
                onClick={() => {
                  if (!canAfford) return;
                  setMoney((prev) => prev - eq.cost);
                  setAtelier((prev) => ({ ...prev, [eq.id]: true }));
                  showToast(`🤖 Équipement installé : ${eq.name} !`);
                }}
                disabled={!canAfford}
                className={`w-full text-left text-xs font-bold p-3 rounded-xl flex justify-between items-center transition touch-manipulation ${
                  canAfford
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg'
                    : 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'
                }`}
              >
                <span>{eq.name}</span>
                <span className="font-mono">{formatMoney(eq.cost)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDefis = () => (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400 border border-amber-500/30">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Défis &amp; Objectifs de Carrière</h2>
            <p className="text-xs text-slate-400">
              Remplissez les objectifs industriels pour gagner du <span className="text-emerald-400 font-bold">cash</span> ou des{' '}
              <span className="text-amber-400 font-bold">Caisses de Recrutement gratuites</span> !
            </p>
          </div>
        </div>
        <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-right">
          <div className="text-[10px] font-black uppercase text-slate-500">Progression Défis</div>
          <div className="text-base font-mono font-black text-cyan-400">
            {claimedChallenges.length} / {CHALLENGES_CATALOG.length} complétés
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHALLENGES_CATALOG.map((ch) => {
          const isClaimed = claimedChallenges.includes(ch.id);
          const rawProg = ch.getProgress(challengeStats);
          const pct = Math.min(100, Math.round((rawProg / ch.target) * 100));
          const isReady = !isClaimed && rawProg >= ch.target;

          return (
            <div
              key={ch.id}
              className={`rounded-2xl p-4 border-2 flex flex-col justify-between transition-all ${
                isClaimed
                  ? 'bg-slate-900/50 border-emerald-500/30 opacity-75'
                  : isReady
                  ? 'bg-slate-900 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.2)]'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                      ch.rewardType === 'crate'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {ch.rewardType === 'crate' ? '🎁 ' : '💵 '}
                    {ch.rewardLabel}
                  </span>
                  {isClaimed && (
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Validé
                    </span>
                  )}
                </div>

                <h3 className="text-base font-black text-white">{ch.title}</h3>
                <p className="text-xs text-slate-400 mt-1 mb-3">{ch.desc}</p>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400">Avancement</span>
                  <span className={isReady || isClaimed ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                    {ch.target >= 100 ? formatMoney(Math.min(rawProg, ch.target)).replace(' $', '') : Math.min(Math.floor(rawProg), ch.target)} /{' '}
                    {ch.target >= 100 ? formatMoney(ch.target).replace(' $', '') : ch.target}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mb-3">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isClaimed || isReady ? 'bg-emerald-400' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {isClaimed ? (
                  <div className="w-full py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-black text-center">
                    Récompense récupérée ✓
                  </div>
                ) : isReady ? (
                  <button
                    onClick={() => handleClaimChallenge(ch)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5 animate-pulse touch-manipulation"
                  >
                    <Gift className="w-4 h-4" /> Récupérer {ch.rewardLabel}
                  </button>
                ) : (
                  <div className="w-full py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-xs font-bold text-center">
                    En cours ({pct}%)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderClassement = () => (
    <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
            <Trophy className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Classement Général</h2>
            <p className="text-xs text-slate-400">Classé par argent généré par seconde ($/s)</p>
          </div>
        </div>
        <button
          onClick={() => syncCloudData(false)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center gap-2 shadow-lg transition touch-manipulation"
        >
          <RefreshCw className="w-4 h-4" /> Sauvegarder &amp; Actualiser
        </button>
      </div>

      {cloudStatus === 'permission_error' && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs space-y-2">
          <div className="font-black text-amber-400 text-sm">
            ⚠️ Action requise sur votre console Firebase (cnc-tycoon-gmp) :
          </div>
          <p>Votre base Firebase bloque actuellement les sauvegardes publiques. Pour activer le classement entre joueurs :</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-300">
            <li>
              Allez sur <b>console.firebase.google.com</b> dans votre projet <b>cnc-tycoon-gmp</b>.
            </li>
            <li>
              Cliquez sur <b>Firestore Database</b> à gauche, puis sur l&apos;onglet <b>Règles (Rules)</b> en haut.
            </li>
            <li>
              Remplacez <code className="bg-black/50 px-1.5 py-0.5 rounded text-rose-300">allow read, write: if false;</code> par{' '}
              <code className="bg-black/50 px-1.5 py-0.5 rounded text-emerald-300">allow read, write: if true;</code> puis cliquez sur{' '}
              <b>Publier</b>.
            </li>
          </ol>
        </div>
      )}

      <div className="space-y-2">
        {leaderboard.length === 0 ? (
          <div className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-800 rounded-2xl">
            {pseudo ? (
              <div>
                <p className="font-bold text-white mb-1">
                  1. {pseudo} (Vous) — {formatMoney(prodStats.total)}/s
                </p>
                <p className="text-xs text-slate-500">
                  Cliquez sur &quot;Sauvegarder &amp; Actualiser&quot; pour publier votre record !
                </p>
              </div>
            ) : (
              'Connectez-vous avec votre Pseudo en haut à droite pour apparaître dans le classement !'
            )}
          </div>
        ) : (
          leaderboard.map((entry, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-3.5 rounded-xl border ${
                cleanId(entry.pseudo) === cleanId(pseudo)
                  ? 'bg-cyan-950/60 border-cyan-500/60'
                  : 'bg-slate-800/70 border-slate-700/50'
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <span
                  className={`font-black w-7 text-center ${
                    idx === 0
                      ? 'text-amber-400 text-lg'
                      : idx === 1
                      ? 'text-slate-300 text-lg'
                      : idx === 2
                      ? 'text-amber-600 text-lg'
                      : 'text-slate-500'
                  }`}
                >
                  #{idx + 1}
                </span>
                <div>
                  <div className="font-black text-white">{entry.pseudo || 'Anonyme'}</div>
                  <div className="text-[10px] text-slate-400">{entry.atelierName || "Chef d'Atelier"}</div>
                </div>
              </div>
              <div className="font-mono font-black text-emerald-400 text-sm sm:text-base">+{formatMoney(entry.income)}/s</div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const navTabs = [
    { id: 'production', label: 'Usinage Manuel', mobileLabel: 'Usiner', icon: MousePointerClick },
    { id: 'plan', label: 'Plan 2D Atelier', mobileLabel: 'Plan', icon: MapIcon },
    { id: 'machines', label: 'Parc Machines', mobileLabel: 'CNC', icon: Settings },
    { id: 'gacha', label: 'Coffres & Cartes', mobileLabel: 'Coffres', icon: Package },
    { id: 'defis', label: 'Défis', mobileLabel: 'Défis', icon: Award, badge: readyChallengesCount },
    { id: 'atelier', label: 'Locaux & Sols', mobileLabel: 'Locaux', icon: Factory },
    { id: 'classement', label: 'Classement', mobileLabel: 'Top', icon: Trophy }
  ];

  return (
    <div className="min-h-screen lg:h-screen bg-slate-950 text-slate-100 font-sans flex items-center justify-center lg:p-3 overflow-x-hidden">
      {/* Conteneur Overlay verrouillé en 16:9 strict sur PC */}
      <div className="cnc-pc-16-9 w-full min-h-screen lg:min-h-0 bg-slate-950 lg:border-2 lg:border-slate-800 lg:rounded-3xl lg:shadow-[0_0_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden relative">
        {toast && (
          <div className="fixed top-16 lg:top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 border-2 border-cyan-400 text-white text-xs sm:text-sm font-bold shadow-2xl max-w-[92vw] text-center">
            {toast}
          </div>
        )}

        {/* Modale Compte / Sauvegarde */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={handleAuthSubmit}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-cyan-400" /> Compte Chef d&apos;Atelier
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="text-slate-400 hover:text-white text-sm font-bold"
                >
                  Fermer ✕
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Entrez votre <b>Pseudo</b> et un <b>Mot de passe</b> pour sauvegarder votre progression dans le Cloud et apparaître dans le Classement Général.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Pseudo de l&apos;Atelier</label>
                <input
                  type="text"
                  required
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="Ex: Usinage_GMP_33"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black shadow-lg hover:opacity-95 transition"
              >
                Charger / Créer ma Sauvegarde
              </button>
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Tester le nouvel équilibrage dès 0 $ :</span>
                <button
                  type="button"
                  onClick={handleResetGame}
                  className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition"
                >
                  Réinitialiser ma partie
                </button>
              </div>
            </form>
          </div>
        )}

        {/* En-tête & Navigation Desktop */}
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl shrink-0">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shrink-0">
                <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-black text-sm sm:text-xl text-white tracking-tight truncate">
                  CNC EMPIRE <span className="text-cyan-400">GMP</span>
                </h1>
                <div className="text-[10px] sm:text-xs text-slate-400 truncate">
                  {currentSize.name}{' '}
                  {atelierBonus > 0 && (
                    <span className="text-emerald-400 font-bold">(+{Math.round(atelierBonus * 100)}%)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-5 shrink-0">
              <div className="flex gap-2.5 sm:gap-6 bg-slate-950 px-3 sm:px-6 py-1.5 rounded-2xl border border-slate-800">
                <div>
                  <div className="text-[8px] sm:text-[9px] text-slate-500 font-black uppercase">Trésorerie</div>
                  <div className="text-xs sm:text-xl font-black font-mono text-emerald-400">{formatMoney(money)}</div>
                </div>
                <div className="w-px bg-slate-800" />
                <div>
                  <div className="text-[8px] sm:text-[9px] text-slate-500 font-black uppercase">Cadence</div>
                  <div className="text-xs sm:text-xl font-black font-mono text-cyan-400">+{formatMoney(prodStats.total)}/s</div>
                </div>
              </div>

              <button
                onClick={() => setShowAuthModal(true)}
                className="p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white flex items-center gap-2 transition touch-manipulation"
                title={isLoggedIn && pseudo ? pseudo : 'Connexion / Pseudo'}
              >
                <LogIn className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">{isLoggedIn && pseudo ? pseudo : 'Connexion / Pseudo'}</span>
              </button>
            </div>
          </div>

          {/* Barre d'onglets PC uniquement */}
          <div className="hidden lg:flex max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar gap-1.5">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-xl font-bold text-xs sm:text-sm transition-colors whitespace-nowrap border-x border-t ${
                    activeTab === tab.id
                      ? 'bg-slate-950 text-cyan-400 border-slate-800'
                      : 'bg-slate-900 text-slate-400 border-transparent hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {tab.label}
                  {tab.badge > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-bounce">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* Contenu Principal */}
        <main className="max-w-7xl mx-auto w-full p-3.5 sm:p-5 pb-24 lg:pb-5 flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'production' && renderProduction()}
          {activeTab === 'plan' && renderPlan()}
          {activeTab === 'machines' && renderMachines()}
          {activeTab === 'gacha' && renderGacha()}
          {activeTab === 'defis' && renderDefis()}
          {activeTab === 'atelier' && renderAtelier()}
          {activeTab === 'classement' && renderClassement()}
        </main>

        {/* Barre de Navigation Inférieure Tactile sur Téléphone */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1.5 shadow-[0_-8px_25px_rgba(0,0,0,0.65)]">
          <div className="grid grid-cols-7 gap-0.5">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all touch-manipulation ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-400'
                      : 'text-slate-400 hover:text-white active:bg-slate-800'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-cyan-400' : ''} transition-transform`} />
                    {tab.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center animate-bounce">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] mt-0.5 font-black tracking-tight truncate max-w-full ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}>
                    {tab.mobileLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media (min-width: 1024px) {
          .cnc-pc-16-9 {
            width: min(96vw, calc((100vh - 24px) * 16 / 9));
            height: min(calc(100vh - 24px), calc(96vw * 9 / 16));
            aspect-ratio: 16 / 9;
          }
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes craneMove {
          0% { left: 6%; }
          50% { left: 86%; }
          100% { left: 6%; }
        }
        .animate-crane { animation: craneMove 14s ease-in-out infinite; }
        
        @keyframes agvMoveH {
          0% { left: 5%; }
          50% { left: 88%; }
          100% { left: 5%; }
        }
        .animate-agv-h { animation: agvMoveH 9s linear infinite; }

        @keyframes toolHeadMove {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(5px); }
        }
        .animate-tool-head { animation: toolHeadMove 1.1s ease-in-out infinite; }

        @keyframes carriageSlide {
          0%, 100% { transform: translateX(-5px); }
          50% { transform: translateX(6px); }
        }
        .animate-carriage { animation: carriageSlide 2.2s ease-in-out infinite; }

        @keyframes cradleTilt {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
        .animate-cradle { animation: cradleTilt 2.8s ease-in-out infinite; }

        @keyframes robotArmSwing {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        .animate-robot-arm { animation: robotArmSwing 2.4s ease-in-out infinite; }

        @keyframes foilShimmer {
          0% { transform: translateX(-140%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
        .animate-foil-shimmer { animation: foilShimmer 3.2s ease-in-out infinite; }

        @keyframes floatGain {
          0% { opacity: 1; transform: translate(-50%, -20%) scale(0.85); }
          100% { opacity: 0; transform: translate(-50%, -180%) scale(1.15); }
        }
        .animate-float-gain { animation: floatGain 0.85s ease-out forwards; }

        @keyframes crateShake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-8deg) scale(1.06); }
          40% { transform: rotate(8deg) scale(1.08); }
          60% { transform: rotate(-6deg) scale(1.06); }
          80% { transform: rotate(6deg) scale(1.04); }
        }
        .animate-crate-shake { animation: crateShake 0.45s ease-in-out infinite; }

        @keyframes cardReveal {
          0% { opacity: 0; transform: scale(0.6) rotateY(90deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg); }
        }
        .animate-card-reveal { animation: cardReveal 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `
        }}
      />
    </div>
  );
}
