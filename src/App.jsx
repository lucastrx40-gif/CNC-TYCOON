import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Wrench, Settings, Cpu, Award, Users, Package, TrendingUp, 
  Zap, ShieldCheck, Layers, Plus, ArrowUpCircle, Sparkles, 
  Trophy, UserCheck, Lock, Unlock, Play, RefreshCw, AlertTriangle,
  CheckCircle2, Flame, Droplets, Box, Building2, Compass, 
  ChevronRight, Star, Crown, Activity, DollarSign, LogIn, Save,
  Sliders, Eye, Briefcase, FileText, Crosshair
} from 'lucide-react';

// ==========================================
// CONFIGURATION FIREBASE & INITIALISATION
// ==========================================
const firebaseConfig = {

  apiKey: "AIzaSyCdGM5WTpuxrz7VNkRXqPPXz9LxDsPQia0",

  authDomain: "cnc-tycoon-gmp.firebaseapp.com",

  projectId: "cnc-tycoon-gmp",

  storageBucket: "cnc-tycoon-gmp.firebasestorage.app",

  messagingSenderId: "907776837224",

  appId: "1:907776837224:web:95ffba314b7a28ecc59ddd",

  measurementId: "G-4NW1GH3ERT"

};

const appId = "cnc-empire-v1";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// DONNÉES DU JEU (MACHINES, EMPLOYÉS, ATELIER)
// ==========================================

const MACHINES_CATALOG = [
  {
    id: 'drill_saw',
    name: 'Perceuse & Scie à Ruban',
    category: 'Conventionnel',
    axes: '1 Axe',
    baseCost: 50,
    baseProd: 2,
    costMult: 1.18,
    prodMult: 1.25,
    rpm: '1 500 tr/min',
    color: 'from-slate-600 to-slate-800',
    accent: '#94a3b8',
    desc: 'Découpe de lopins bruts et perçage d’ébauche.'
  },
  {
    id: 'lathe_conv',
    name: 'Tour Parallèle Conventionnel',
    category: 'Tournage',
    axes: '2 Axes Manuels',
    baseCost: 350,
    baseProd: 14,
    costMult: 1.20,
    prodMult: 1.28,
    rpm: '2 500 tr/min',
    color: 'from-emerald-700 to-slate-900',
    accent: '#10b981',
    desc: 'Usinage de pièces de révolution au vernier.'
  },
  {
    id: 'mill_3axis',
    name: 'Centre d’Usinage 3 Axes CNC',
    category: 'Fraisage CN',
    axes: '3 Axes (X,Y,Z)',
    baseCost: 2200,
    baseProd: 85,
    costMult: 1.22,
    prodMult: 1.30,
    rpm: '10 000 tr/min',
    color: 'from-blue-600 to-slate-900',
    accent: '#3b82f6',
    desc: 'Fraisage numérique précis avec changeur d’outils 24 postes.'
  },
  {
    id: 'lathe_sub',
    name: 'Tour CN Bi-Broche & Axe C/Y',
    category: 'Tournage-Fraisage',
    axes: '4 Axes CN',
    baseCost: 15000,
    baseProd: 520,
    costMult: 1.24,
    prodMult: 1.32,
    rpm: '6 000 tr/min',
    color: 'from-indigo-600 to-slate-900',
    accent: '#6366f1',
    desc: 'Reprise automatique en contre-broche et fraisage embarqué.'
  },
  {
    id: 'mill_5axis',
    name: 'Centre 5 Axes Continu UGV',
    category: 'Haute Précision',
    axes: '5 Axes Simultanés',
    baseCost: 95000,
    baseProd: 3100,
    costMult: 1.25,
    prodMult: 1.35,
    rpm: '24 000 tr/min',
    color: 'from-purple-600 to-slate-900',
    accent: '#a855f7',
    desc: 'Usinage Grande Vitesse d’aubes de turbines et moules complexes.'
  },
  {
    id: 'edm_wire',
    name: 'Électroérosion à Fil (EDM)',
    category: 'Usinage Spécial',
    axes: '4 Axes Fil',
    baseCost: 650000,
    baseProd: 19500,
    costMult: 1.26,
    prodMult: 1.36,
    rpm: 'Fil Ø0.1mm',
    color: 'from-amber-600 to-slate-900',
    accent: '#f59e0b',
    desc: 'Découpe d’aciers trempés et carbures au micron près dans l’eau déionisée.'
  },
  {
    id: 'aero_cell',
    name: 'Cellule Robotisée 5 Axes Titane',
    category: 'Aérospatial 4.0',
    axes: '5 Axes + Palettisation',
    baseCost: 4800000,
    baseProd: 145000,
    costMult: 1.28,
    prodMult: 1.40,
    rpm: '30 000 tr/min HSK-A63',
    color: 'from-rose-600 to-slate-900',
    accent: '#f43f5e',
    desc: 'Production autonome 24/7 de pièces structurelles en Inconel et Titane TA6V.'
  }
];

const WORKSHOP_TIERS = [
  {
    level: 1,
    name: 'Garage d’Usinage Artisanal',
    slots: 4,
    cost: 0,
    globalBonus: 1.0,
    desc: 'Murs en parpaings bruts, éclairage néon et établi métallique.',
    bgStyle: 'bg-zinc-900 border-zinc-700',
    gridBg: 'radial-gradient(circle, #3f3f46 1px, transparent 1px)'
  },
  {
    level: 2,
    name: 'Atelier PME Mécanique de Précision',
    slots: 8,
    cost: 12000,
    globalBonus: 1.25,
    desc: 'Dalle béton quartzé, réseau d’air comprimé et pont roulant.',
    bgStyle: 'bg-slate-900 border-blue-900/60',
    gridBg: 'radial-gradient(circle, #334155 1.5px, transparent 1.5px)'
  },
  {
    level: 3,
    name: 'Usine Aéronautique Climatisée',
    slots: 12,
    cost: 450000,
    globalBonus: 1.60,
    desc: 'Atmosphère régulée à 20°C ±0.5°C, éclairage LED haute baie et extraction de brouillard d’huile.',
    bgStyle: 'bg-slate-950 border-cyan-500/40',
    gridBg: 'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)'
  },
  {
    level: 4,
    name: 'Gigafactory Usinage 4.0 Autonome',
    slots: 16,
    cost: 25000000,
    globalBonus: 2.25,
    desc: 'Jumeau numérique temps réel, AGV laser, récupération centrale des copeaux et supervision IA.',
    bgStyle: 'bg-black border-amber-500/50',
    gridBg: 'linear-gradient(to right, rgba(6,182,212,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(6,182,212,0.12) 1px, transparent 1px)'
  }
];

const AESTHETICS_SHOP = {
  floors: [
    { id: 'concrete', name: 'Béton Brut d’Atelier', cost: 0, bonus: 0, color: '#18181b', pattern: 'opacity-20' },
    { id: 'epoxy_grey', name: 'Résine Époxy Gris Anthracite', cost: 3500, bonus: 0.05, color: '#1e293b', pattern: 'opacity-30' },
    { id: 'epoxy_blue', name: 'Résine Antistatique Bleu ISO', cost: 45000, bonus: 0.12, color: '#0f172a', pattern: 'opacity-40' },
    { id: 'carbon_tile', name: 'Dalles Techniques Carbone & LED Or', cost: 850000, bonus: 0.25, color: '#090d16', pattern: 'opacity-50' }
  ],
  walls: [
    { id: 'cinderblock', name: 'Parpaings & Tôles Bac Acier', cost: 0, bonus: 0, border: 'border-zinc-700' },
    { id: 'acoustic', name: 'Panneaux Acoustiques Anti-Bruit', cost: 5000, bonus: 0.05, border: 'border-emerald-500/50' },
    { id: 'cleanroom', name: 'Cloisons Blanches Salle Propre', cost: 65000, bonus: 0.12, border: 'border-cyan-400/60' },
    { id: 'glass_cyber', name: 'Verrière Panoramique Bureau d’Études', cost: 1200000, bonus: 0.25, border: 'border-amber-400/80' }
  ],
  addons: [
    { id: 'chip_conveyor', name: 'Convoyeur & Compacteur de Copeaux Central', cost: 8000, bonus: 0.08, icon: '♻️', desc: 'Valorise la revente des copeaux d’alu, laiton et titane (+8% revenus).' },
    { id: 'overhead_crane', name: 'Pont Roulant Motorisé 10 Tonnes', cost: 35000, bonus: 0.12, icon: '🏗️', desc: 'Réduit drastiquement les temps de chargement des bruts lourds (+12% revenus).' },
    { id: 'tool_presetter', name: 'Banc de Préréglage Optique Laser', cost: 180000, bonus: 0.18, icon: '🔬', desc: 'Jauge les outils hors-machine pour zéro arrêt broche (+18% revenus).' },
    { id: 'agv_fleet', name: 'Flotte de Robots AGV Palettiseurs', cost: 2500000, bonus: 0.30, icon: '🤖', desc: 'Alimentation continue des centres 5 axes jour et nuit (+30% revenus).' }
  ]
};

const METROLOGY_UPGRADES = [
  { id: 'caliper', name: 'Pied à Coulisse Numérique & Micromètre IP67', cost: 250, mult: 0.10, accuracy: '± 0.02 mm' },
  { id: 'height_gauge', name: 'Colonne de Mesure sur Marbre Granit', cost: 4000, mult: 0.20, accuracy: '± 0.005 mm' },
  { id: 'roughness', name: 'Rugosimètre & Profilomètre Optique Ra/Rz', cost: 32000, mult: 0.35, accuracy: '± 0.001 mm' },
  { id: 'laser_arm', name: 'Bras de Mesure Polyarticulé Scanner Laser 3D', cost: 280000, mult: 0.55, accuracy: '± 0.0005 mm' },
  { id: 'cmm_zeiss', name: 'Machine Tridimensionnelle (MMT) Pont Continu', cost: 3200000, mult: 1.00, accuracy: '± 0.15 µm (Sub-micron)' }
];

const EMPLOYEE_TEMPLATES = [
  // COMMUNS (Gris)
  { templateId: 'emp_c1', name: 'Lucas "Ébavureur"', role: 'Opérateur Débutant', rarity: 'COMMON', rarityLabel: 'Commun', prodBonus: 0.15, costDiscount: 0, globalBonus: 0, color: '#94a3b8', bg: 'bg-slate-800', border: 'border-slate-500' },
  { templateId: 'emp_c2', name: 'Maxime P.', role: 'Apprenti Bac Pro TU', rarity: 'COMMON', rarityLabel: 'Commun', prodBonus: 0.18, costDiscount: 0.02, globalBonus: 0, color: '#94a3b8', bg: 'bg-slate-800', border: 'border-slate-500' },
  // RARES (Bleu)
  { templateId: 'emp_r1', name: 'Sarah Vance', role: 'Régleuse CNC 3 Axes', rarity: 'RARE', rarityLabel: 'Rare', prodBonus: 0.38, costDiscount: 0.08, globalBonus: 0, color: '#38bdf8', bg: 'bg-sky-950/80', border: 'border-sky-400' },
  { templateId: 'emp_r2', name: 'Karim Benali', role: 'Technicien Outilleur Carbure', rarity: 'RARE', rarityLabel: 'Rare', prodBonus: 0.42, costDiscount: 0.10, globalBonus: 0, color: '#38bdf8', bg: 'bg-sky-950/80', border: 'border-sky-400' },
  // ÉPIQUES (Violet)
  { templateId: 'emp_e1', name: 'Hélène K.', role: 'Programmeuse FAO 5 Axes', rarity: 'EPIC', rarityLabel: 'Épique', prodBonus: 0.85, costDiscount: 0.15, globalBonus: 0.02, color: '#c084fc', bg: 'bg-purple-950/80', border: 'border-purple-400' },
  { templateId: 'emp_e2', name: 'Marc "Le Micron"', role: 'Métrologue Expert ISO-9001', rarity: 'EPIC', rarityLabel: 'Épique', prodBonus: 0.95, costDiscount: 0.12, globalBonus: 0.03, color: '#c084fc', bg: 'bg-purple-950/80', border: 'border-purple-400' },
  // LÉGENDAIRES (Or)
  { templateId: 'emp_l1', name: 'Maître Henri', role: 'Compagnon Tourneur-Fraiseur', rarity: 'LEGENDARY', rarityLabel: 'Légendaire', prodBonus: 1.90, costDiscount: 0.22, globalBonus: 0.06, color: '#fbbf24', bg: 'bg-amber-950/80', border: 'border-amber-400' },
  { templateId: 'emp_l2', name: 'Viktor Novak', role: 'Architecte Post-Processeur UGV', rarity: 'LEGENDARY', rarityLabel: 'Légendaire', prodBonus: 2.10, costDiscount: 0.25, globalBonus: 0.08, color: '#fbbf24', bg: 'bg-amber-950/80', border: 'border-amber-400' },
  // MYTHIQUES (Rouge/Cyan)
  { templateId: 'emp_m1', name: 'Dr. Élise Moreau', role: 'Directrice Technique Aérospatiale', rarity: 'MYTHIC', rarityLabel: 'Mythique', prodBonus: 4.20, costDiscount: 0.35, globalBonus: 0.15, color: '#f43f5e', bg: 'bg-rose-950/90', border: 'border-rose-400' }
];

const CHESTS_CATALOG = [
  {
    id: 'chest_std',
    name: 'Caisse d’Atelier Standard',
    cost: 600,
    desc: 'Recrutement local : forte probabilité d’Opérateurs et Régleurs CNC.',
    color: 'from-slate-700 to-slate-900',
    border: 'border-slate-500',
    odds: { COMMON: 68, RARE: 25, EPIC: 6, LEGENDARY: 1, MYTHIC: 0 }
  },
  {
    id: 'chest_exp',
    name: 'Mallette Chasseur de Têtes',
    cost: 12000,
    desc: 'Sélection d’experts : garantit au minimum un profil Rare ou supérieur.',
    color: 'from-blue-700 to-indigo-950',
    border: 'border-cyan-400',
    odds: { COMMON: 0, RARE: 60, EPIC: 30, LEGENDARY: 8.5, MYTHIC: 1.5 }
  },
  {
    id: 'chest_aero',
    name: 'Valise Exécutive Aéronautique',
    cost: 280000,
    desc: 'Débauchage international : Épique garanti, fortes chances de Légendaire et Mythique !',
    color: 'from-amber-600 via-rose-800 to-slate-950',
    border: 'border-amber-400',
    odds: { COMMON: 0, RARE: 0, EPIC: 52, LEGENDARY: 36, MYTHIC: 12 }
  }
];

const CONTRACTS_LIST = [
  {
    id: 'c_auto',
    title: 'Série de 500 Moyeux Aluminium 6061',
    client: 'Alpine Motorsport',
    duration: 45,
    mult: 1.35,
    completionBonusSeconds: 30,
    reqRpm: 'Fraisage / Tournage standard',
    badge: 'Automobile'
  },
  {
    id: 'c_med',
    title: 'Prothèses de Hanche en Titane Médical',
    client: 'BioMed Ortho',
    duration: 60,
    mult: 1.60,
    completionBonusSeconds: 45,
    reqRpm: 'Tolérance ISO 13485',
    badge: 'Médical'
  },
  {
    id: 'c_aero',
    title: 'Rouet de Compresseur Monobloc (Blisk) Inconel 718',
    client: 'Safran / ArianeGroup',
    duration: 90,
    mult: 2.00,
    completionBonusSeconds: 75,
    reqRpm: 'Usinage 5 Axes UGV',
    badge: 'Aérospatial'
  }
];

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

const formatMoney = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0 $';
  if (num < 1000) return `${num.toFixed(num < 10 ? 1 : 0)} $`;
  const suffixes = ['', 'k', 'M', 'Md', 'T', 'Qa', 'Qi'];
  const tier = Math.floor(Math.log10(Math.abs(num)) / 3);
  if (tier === 0) return `${Math.floor(num)} $`;
  const suffix = suffixes[tier] || `e${tier * 3}`;
  const scale = Math.pow(10, tier * 3);
  const scaled = num / scale;
  return `${scaled.toFixed(2)} ${suffix}$`;
};

const simpleHash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h.toString(16);
};

// ==========================================
// COMPOSANT PRINCIPAL
// ==========================================

export default function App() {
  // --- Authentification & Cloud ---
  const [fbUser, setFbUser] = useState(null);
  const [account, setAccount] = useState({
    isLogged: false,
    pseudo: '',
    accountKey: ''
  });
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const [authForm, setAuthForm] = useState({ pseudo: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('Non connecté');

  // --- État du Jeu (Sauvegardé) ---
  const [money, setMoney] = useState(120);
  const [totalEarned, setTotalEarned] = useState(120);
  const [workshopLevel, setWorkshopLevel] = useState(1);
  const [aesthetics, setAesthetics] = useState({
    floor: 'concrete',
    wall: 'cinderblock',
    addons: []
  });
  const [metrologyOwned, setMetrologyOwned] = useState([]);
  
  // Machines placées sur la grille (16 emplacements max)
  const [slots, setSlots] = useState(() => {
    const initial = Array(16).fill(null);
    initial[0] = {
      slotIndex: 0,
      machineId: 'drill_saw',
      level: 1,
      employeeUid: null
    };
    return initial;
  });

  // Liste des employés possédés
  const [employees, setEmployees] = useState([
    {
      uid: 'starter_emp_1',
      templateId: 'emp_c1',
      stars: 1
    }
  ]);

  // --- États Temps Réel / Gameplay ---
  const [activeTab, setActiveTab] = useState('map2d'); // map2d, workshop, employees, chests, metrology, aesthetics, leaderboard
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [mapZoom, setMapZoom] = useState(1);
  const [showMapLabels, setShowMapLabels] = useState(true);
  const [showAgvPaths, setShowAgvPaths] = useState(true);
  const [spindleHeat, setSpindleHeat] = useState(18); // 0 à 100%
  const [overclockBoost, setOverclockBoost] = useState(false);
  const [coolantActive, setCoolantActive] = useState(false);
  const [activeContract, setActiveContract] = useState(null); // { ...contract, timeLeft }
  const [floatingClicks, setFloatingClicks] = useState([]);
  
  // Animation Gacha Coffres
  const [chestOpening, setChestOpening] = useState(false);
  const [chestResult, setChestResult] = useState(null);

  // Classement Général
  const [leaderboard, setLeaderboard] = useState([]);
  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ==========================================
  // 1. INITIALISATION FIREBASE AUTH
  // ==========================================
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Erreur Auth Firebase:', err);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
    });
    return () => unsub();
  }, []);

  // ==========================================
  // 2. ÉCOUTE DU CLASSEMENT GÉNÉRAL EN TEMPS RÉEL
  // ==========================================
  useEffect(() => {
    if (!fbUser) return;
    const lbRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsub = onSnapshot(
      lbRef,
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        // Tri en mémoire par $/s décroissant
        list.sort((a, b) => (b.incomePerSec || 0) - (a.incomePerSec || 0));
        setLeaderboard(list.slice(0, 50));
      },
      (err) => {
        console.error('Erreur lecture leaderboard:', err);
      }
    );
    return () => unsub();
  }, [fbUser]);

  // ==========================================
  // 3. CALCULS DE PRODUCTION ($/SEC & BONUS)
  // ==========================================
  const productionStats = useMemo(() => {
    const currentWorkshop = WORKSHOP_TIERS.find((w) => w.level === workshopLevel) || WORKSHOP_TIERS[0];
    
    // Bonus esthétiques et utilitaires d'atelier
    const floorObj = AESTHETICS_SHOP.floors.find((f) => f.id === aesthetics.floor);
    const wallObj = AESTHETICS_SHOP.walls.find((w) => w.id === aesthetics.wall);
    const addonsBonus = aesthetics.addons.reduce((acc, adId) => {
      const ad = AESTHETICS_SHOP.addons.find((a) => a.id === adId);
      return acc + (ad ? ad.bonus : 0);
    }, 0);
    const aestheticsMult = 1 + (floorObj?.bonus || 0) + (wallObj?.bonus || 0) + addonsBonus;

    // Bonus Métrologie (Qualité ISO)
    const metrologyMult = 1 + metrologyOwned.reduce((acc, mId) => {
      const m = METROLOGY_UPGRADES.find((u) => u.id === mId);
      return acc + (m ? m.mult : 0);
    }, 0);

    // Bonus global des employés Mythiques / Légendaires / Épiques assignés
    let assignedGlobalBonus = 0;
    slots.forEach((slot) => {
      if (slot && slot.employeeUid) {
        const emp = employees.find((e) => e.uid === slot.employeeUid);
        if (emp) {
          const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
          if (tpl) {
            const starMult = 1 + (emp.stars - 1) * 0.4;
            assignedGlobalBonus += tpl.globalBonus * starMult;
          }
        }
      }
    });

    // Calcul par machine
    let rawMachinesTotal = 0;
    const slotBreakdown = slots.map((slot) => {
      if (!slot) return 0;
      const mac = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
      if (!mac) return 0;

      // Production de base de la machine selon son niveau
      let macProd = mac.baseProd * Math.pow(mac.prodMult, slot.level - 1);

      // Bonus de l'opérateur assigné à ce poste
      if (slot.employeeUid) {
        const emp = employees.find((e) => e.uid === slot.employeeUid);
        if (emp) {
          const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
          if (tpl) {
            const starMult = 1 + (emp.stars - 1) * 0.5;
            macProd *= (1 + tpl.prodBonus * starMult);
          }
        }
      }

      rawMachinesTotal += macProd;
      return macProd;
    });

    // Multiplicateur de contrat actif
    const contractMult = activeContract ? activeContract.mult : 1.0;

    // Multiplicateur d'Overclocking / Lubrification haute pression
    const boostMult = (overclockBoost ? 1.75 : 1.0) * (coolantActive ? 1.25 : 1.0);

    const totalGlobalMult =
      currentWorkshop.globalBonus *
      aestheticsMult *
      metrologyMult *
      (1 + assignedGlobalBonus) *
      contractMult *
      boostMult;

    const totalPerSec = rawMachinesTotal * totalGlobalMult;

    return {
      rawMachinesTotal,
      slotBreakdown,
      workshopMult: currentWorkshop.globalBonus,
      aestheticsMult,
      metrologyMult,
      assignedGlobalBonus,
      contractMult,
      boostMult,
      totalGlobalMult,
      totalPerSec
    };
  }, [slots, employees, workshopLevel, aesthetics, metrologyOwned, activeContract, overclockBoost, coolantActive]);

  // ==========================================
  // 4. BOUCLE DE JEU (IDLE + CONTRATS + REFROIDISSEMENT)
  // ==========================================
  const statsRef = useRef(productionStats);
  useEffect(() => {
    statsRef.current = productionStats;
  }, [productionStats]);

  useEffect(() => {
    const interval = setInterval(() => {
      const gain = statsRef.current.totalPerSec / 4; // Tick toutes les 250ms pour fluidité du compteur
      if (gain > 0) {
        setMoney((prev) => prev + gain);
        setTotalEarned((prev) => prev + gain);
      }

      // Refroidissement progressif de la broche
      setSpindleHeat((prev) => {
        const coolRate = coolantActive ? 4.5 : 1.2;
        const next = Math.max(15, prev - coolRate * 0.25);
        if (next < 45 && overclockBoost) {
          setOverclockBoost(false);
        }
        return next;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [coolantActive, overclockBoost]);

  // Timer des contrats (1s)
  useEffect(() => {
    if (!activeContract) return;
    const timer = setInterval(() => {
      setActiveContract((prev) => {
        if (!prev) return null;
        if (prev.timeLeft <= 1) {
          // Contrat terminé -> Prime !
          const reward = Math.max(250, statsRef.current.totalPerSec * prev.completionBonusSeconds);
          setMoney((m) => m + reward);
          setTotalEarned((t) => t + reward);
          showToast(`Contrat "${prev.title}" livré ! Prime reçue : +${formatMoney(reward)}`, 'success');
          return null;
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeContract]);

  // ==========================================
  // 5. CONNEXION / CRÉATION DE COMPTE & SAUVEGARDE CLOUD
  // ==========================================
  const saveProgressToCloud = async (customAccount = account) => {
    if (!fbUser || !customAccount.isLogged || !customAccount.accountKey) return;
    try {
      const savePayload = {
        pseudo: customAccount.pseudo,
        money,
        totalEarned,
        incomePerSec: statsRef.current.totalPerSec,
        workshopLevel,
        aestheticsJson: JSON.stringify(aesthetics),
        metrologyJson: JSON.stringify(metrologyOwned),
        slotsJson: JSON.stringify(slots),
        employeesJson: JSON.stringify(employees),
        updatedAt: Date.now()
      };

      // Sauvegarde du profil joueur
      const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', customAccount.accountKey);
      await setDoc(accountRef, savePayload, { merge: true });

      // Mise à jour du Leaderboard Général
      const lbRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', customAccount.accountKey);
      const activeMachinesCount = slots.filter(Boolean).length;
      await setDoc(lbRef, {
        pseudo: customAccount.pseudo,
        incomePerSec: statsRef.current.totalPerSec,
        totalEarned,
        workshopLevel,
        machinesCount: activeMachinesCount,
        employeesCount: employees.length,
        updatedAt: Date.now()
      }, { merge: true });

      const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSavedText(`Sauvegardé à ${nowStr}`);
    } catch (err) {
      console.error('Erreur sauvegarde Firestore:', err);
    }
  };

  // Sauvegarde automatique toutes les 8 secondes
  useEffect(() => {
    if (!account.isLogged || !fbUser) return;
    const autoSave = setInterval(() => {
      saveProgressToCloud();
    }, 8000);
    return () => clearInterval(autoSave);
  }, [account, fbUser, money, totalEarned, workshopLevel, aesthetics, metrologyOwned, slots, employees]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const cleanPseudo = authForm.pseudo.trim();
    const pwd = authForm.password.trim();

    if (cleanPseudo.length < 3 || cleanPseudo.length > 20) {
      setAuthError('Le pseudo doit contenir entre 3 et 20 caractères.');
      return;
    }
    if (pwd.length < 4) {
      setAuthError('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    if (!fbUser) {
      setAuthError('Connexion au serveur en cours, veuillez réessayer dans une seconde.');
      return;
    }

    setAuthLoading(true);
    try {
      const accountKey = cleanPseudo.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const pwdHash = simpleHash(pwd + '_cnc_salt');
      const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', accountKey);
      const snap = await getDoc(accountRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.passwordHash !== pwdHash) {
          setAuthError('Ce pseudo existe déjà et le mot de passe est incorrect.');
          setAuthLoading(false);
          return;
        }
        // Chargement de la progression existante
        setMoney(data.money ?? 120);
        setTotalEarned(data.totalEarned ?? 120);
        setWorkshopLevel(data.workshopLevel ?? 1);
        if (data.aestheticsJson) setAesthetics(JSON.parse(data.aestheticsJson));
        if (data.metrologyJson) setMetrologyOwned(JSON.parse(data.metrologyJson));
        if (data.slotsJson) setSlots(JSON.parse(data.slotsJson));
        if (data.employeesJson) setEmployees(JSON.parse(data.employeesJson));

        const loggedAcc = { isLogged: true, pseudo: data.pseudo || cleanPseudo, accountKey };
        setAccount(loggedAcc);
        setAuthModalOpen(false);
        showToast(`Bon retour dans votre atelier, ${loggedAcc.pseudo} !`, 'success');
      } else {
        // Création d'un nouveau compte avec la progression actuelle
        const newPayload = {
          pseudo: cleanPseudo,
          passwordHash: pwdHash,
          money,
          totalEarned,
          incomePerSec: productionStats.totalPerSec,
          workshopLevel,
          aestheticsJson: JSON.stringify(aesthetics),
          metrologyJson: JSON.stringify(metrologyOwned),
          slotsJson: JSON.stringify(slots),
          employeesJson: JSON.stringify(employees),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await setDoc(accountRef, newPayload);

        const lbRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', accountKey);
        await setDoc(lbRef, {
          pseudo: cleanPseudo,
          incomePerSec: productionStats.totalPerSec,
          totalEarned,
          workshopLevel,
          machinesCount: slots.filter(Boolean).length,
          employeesCount: employees.length,
          updatedAt: Date.now()
        });

        const loggedAcc = { isLogged: true, pseudo: cleanPseudo, accountKey };
        setAccount(loggedAcc);
        setAuthModalOpen(false);
        showToast(`Atelier enregistré au nom de ${cleanPseudo} !`, 'success');
      }
    } catch (err) {
      console.error('Erreur connexion:', err);
      setAuthError('Une erreur réseau est survenue.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ==========================================
  // 6. ACTIONS DE GAMEPLAY (USINAGE MANUEL, ACHATS, GACHA)
  // ==========================================

  // Clic d'usinage manuel / Overclock Vc
  const handleManualMachining = (e) => {
    const manualGain = Math.max(5, productionStats.totalPerSec * 0.35 + 10);
    setMoney((m) => m + manualGain);
    setTotalEarned((t) => t + manualGain);

    // Chauffage broche & activation boost
    setSpindleHeat((prev) => {
      const next = Math.min(100, prev + 8);
      if (next >= 65) setOverclockBoost(true);
      return next;
    });

    // Effet flottant
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();
    setFloatingClicks((prev) => [...prev.slice(-8), { id, x, y, text: `+${formatMoney(manualGain)}` }]);
    setTimeout(() => {
      setFloatingClicks((prev) => prev.filter((c) => c.id !== id));
    }, 900);
  };

  // Acheter une machine sur un emplacement libre
  const handleBuyMachine = (machineId, targetSlotIndex) => {
    const mac = MACHINES_CATALOG.find((m) => m.id === machineId);
    if (!mac) return;

    // Coût augmente légèrement selon le nombre de machines identiques déjà possédées
    const sameOwnedCount = slots.filter((s) => s && s.machineId === machineId).length;
    const finalCost = Math.floor(mac.baseCost * Math.pow(1.35, sameOwnedCount));

    if (money < finalCost) {
      showToast('Trésorerie insuffisante pour acquérir cette machine-outil.', 'error');
      return;
    }

    setMoney((m) => m - finalCost);
    setSlots((prev) => {
      const next = [...prev];
      next[targetSlotIndex] = {
        slotIndex: targetSlotIndex,
        machineId: mac.id,
        level: 1,
        employeeUid: null
      };
      return next;
    });
    showToast(`${mac.name} installée sur le Poste #${targetSlotIndex + 1} !`, 'success');
  };

  // Améliorer une machine (Vitesse de coupe Vc / Avance fz)
  const getUpgradeCost = (slot) => {
    if (!slot) return 0;
    const mac = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
    if (!mac) return 0;
    let rawCost = mac.baseCost * 0.75 * Math.pow(mac.costMult, slot.level);
    // Réduction de coût si un employé y est affecté
    if (slot.employeeUid) {
      const emp = employees.find((e) => e.uid === slot.employeeUid);
      if (emp) {
        const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
        if (tpl) rawCost *= (1 - tpl.costDiscount);
      }
    }
    return Math.floor(rawCost);
  };

  const handleUpgradeMachine = (slotIndex) => {
    const slot = slots[slotIndex];
    if (!slot) return;
    const cost = getUpgradeCost(slot);
    if (money < cost) {
      showToast('Fonds insuffisants pour optimiser ce poste.', 'error');
      return;
    }
    setMoney((m) => m - cost);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], level: next[slotIndex].level + 1 };
      return next;
    });
  };

  // Vendre / Déclasser une machine pour libérer un emplacement
  const handleSellMachine = (slotIndex) => {
    const slot = slots[slotIndex];
    if (!slot) return;
    const mac = MACHINES_CATALOG.find((m) => m.id === slot.machineId);
    const refund = Math.floor((mac?.baseCost || 50) * 0.5 * slot.level);
    setMoney((m) => m + refund);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    showToast(`Machine revendue sur le marché de l'occasion (+${formatMoney(refund)}).`, 'info');
  };

  // Assigner ou retirer un employé d'une machine
  const handleAssignEmployee = (slotIndex, empUid) => {
    setSlots((prev) => {
      // On retire d'abord cet employé s'il était sur un autre poste
      const cleaned = prev.map((s) => {
        if (!s) return null;
        if (s.employeeUid === empUid) return { ...s, employeeUid: null };
        return s;
      });
      if (cleaned[slotIndex]) {
        cleaned[slotIndex] = { ...cleaned[slotIndex], employeeUid: empUid };
      }
      return cleaned;
    });
    showToast('Opérateur affecté au poste d’usinage !', 'success');
  };

  // Agrandir l'atelier
  const handleUpgradeWorkshop = () => {
    const nextTier = WORKSHOP_TIERS.find((w) => w.level === workshopLevel + 1);
    if (!nextTier) return;
    if (money < nextTier.cost) {
      showToast(`Il vous faut ${formatMoney(nextTier.cost)} pour agrandir l'atelier.`, 'error');
      return;
    }
    setMoney((m) => m - nextTier.cost);
    setWorkshopLevel(nextTier.level);
    showToast(`Félicitations ! Vous passez au niveau : ${nextTier.name} !`, 'success');
  };

  // Ouvrir un Coffre de Recrutement (Gacha)
  const handleOpenChest = (chest) => {
    if (money < chest.cost) {
      showToast('Trésorerie insuffisante pour ouvrir ce coffre.', 'error');
      return;
    }
    setMoney((m) => m - chest.cost);
    setChestResult(null);
    setChestOpening(true);

    // Tirage pondéré de la rareté
    const roll = Math.random() * 100;
    let cumulative = 0;
    let chosenRarity = 'COMMON';
    for (const [rarity, prob] of Object.entries(chest.odds)) {
      cumulative += prob;
      if (roll <= cumulative) {
        chosenRarity = rarity;
        break;
      }
    }

    const candidates = EMPLOYEE_TEMPLATES.filter((t) => t.rarity === chosenRarity);
    const pickedTemplate = candidates[Math.floor(Math.random() * candidates.length)] || EMPLOYEE_TEMPLATES[0];

    const newEmployee = {
      uid: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      templateId: pickedTemplate.templateId,
      stars: 1
    };

    setTimeout(() => {
      setEmployees((prev) => [...prev, newEmployee]);
      setChestOpening(false);
      setChestResult({ ...pickedTemplate, uid: newEmployee.uid, stars: 1 });
    }, 1100);
  };

  // Fusionner 3 employés identiques (même templateId et même nombre d'étoiles)
  const handleMergeEmployees = (templateId, stars) => {
    const matching = employees.filter((e) => e.templateId === templateId && e.stars === stars);
    if (matching.length < 3) return;

    const toConsume = matching.slice(0, 3).map((e) => e.uid);
    const keptUid = toConsume[0];
    const removedUids = toConsume.slice(1);

    // Libérer les postes qui utilisaient les 2 doublons consommés
    setSlots((prev) =>
      prev.map((s) => {
        if (s && removedUids.includes(s.employeeUid)) {
          return { ...s, employeeUid: keptUid };
        }
        return s;
      })
    );

    setEmployees((prev) =>
      prev
        .filter((e) => !removedUids.includes(e.uid))
        .map((e) => (e.uid === keptUid ? { ...e, stars: e.stars + 1 } : e))
    );

    const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === templateId);
    showToast(`Promotion réussie ! ${tpl?.name} passe au rang ${stars + 1} ★ !`, 'success');
  };

  // Données de l'atelier courant
  const currentWorkshop = WORKSHOP_TIERS.find((w) => w.level === workshopLevel) || WORKSHOP_TIERS[0];
  const nextWorkshop = WORKSHOP_TIERS.find((w) => w.level === workshopLevel + 1);
  const currentFloorObj = AESTHETICS_SHOP.floors.find((f) => f.id === aesthetics.floor) || AESTHETICS_SHOP.floors[0];
  const currentWallObj = AESTHETICS_SHOP.walls.find((w) => w.id === aesthetics.wall) || AESTHETICS_SHOP.walls[0];

  // Rendu SVG Top-Down 2D détaillé par type de machine-outil
  const renderMachine2DSvg = (machineId, isOverclocked, isCoolant) => {
    const spinSpeed = isOverclocked ? '0.6s' : '2.4s';
    switch (machineId) {
      case 'drill_saw':
        return (
          <svg viewBox="0 0 120 90" className="w-full h-full">
            <rect x="8" y="10" width="104" height="70" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="2.5" />
            {/* Table d'étau et lopin d'alu */}
            <rect x="18" y="22" width="46" height="46" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
            <rect x="26" y="36" width="30" height="14" fill="#94a3b8" />
            {/* Ruban de scie & poulies */}
            <circle cx="84" cy="30" r="11" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <circle cx="84" cy="60" r="11" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <line x1="73" y1="30" x2="73" y2="60" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="3 2" />
            {/* Foret en rotation */}
            <g style={{ transformOrigin: '41px 43px', animation: `spin ${spinSpeed} linear infinite` }}>
              <circle cx="41" cy="43" r="9" fill="#475569" stroke="#e2e8f0" strokeWidth="1.5" />
              <line x1="33" y1="43" x2="49" y2="43" stroke="#f59e0b" strokeWidth="2" />
              <line x1="41" y1="35" x2="41" y2="51" stroke="#f59e0b" strokeWidth="2" />
            </g>
          </svg>
        );
      case 'lathe_conv':
      case 'lathe_sub': {
        const isCnc = machineId === 'lathe_sub';
        return (
          <svg viewBox="0 0 120 90" className="w-full h-full">
            {/* Bâti du tour */}
            <rect x="6" y="12" width="108" height="66" rx="6" fill={isCnc ? '#1e1b4b' : '#064e3b'} stroke={isCnc ? '#6366f1' : '#10b981'} strokeWidth="2.5" />
            {/* Glissières prismatiques */}
            <line x1="28" y1="34" x2="96" y2="34" stroke="#64748b" strokeWidth="3" />
            <line x1="28" y1="56" x2="96" y2="56" stroke="#64748b" strokeWidth="3" />
            {/* Mandrin 3 mors (Gauche) */}
            <rect x="12" y="24" width="18" height="42" rx="2" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Contre-pointe ou Contre-broche (Droite) */}
            <rect x="92" y="28" width="14" height="34" rx="2" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Pièce cylindrique en rotation */}
            <rect x="30" y="39" width="62" height="12" fill="#e2e8f0" />
            <line x1="30" y1="45" x2="92" y2="45" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 4" />
            {/* Tourelle porte-outils */}
            <polygon points="55,18 73,18 69,37 59,37" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
            {isCoolant && <circle cx="62" cy="41" r="7" fill="rgba(56,189,248,0.55)" className="animate-ping" />}
            {isOverclocked && <circle cx="64" cy="39" r="5" fill="#fbbf24" className="animate-ping" />}
          </svg>
        );
      }
      case 'mill_3axis':
      case 'mill_5axis': {
        const is5Axis = machineId === 'mill_5axis';
        return (
          <svg viewBox="0 0 120 90" className="w-full h-full">
            {/* Cabine carénée CNC */}
            <rect x="6" y="8" width="108" height="74" rx="7" fill={is5Axis ? '#2e1065' : '#0f172a'} stroke={is5Axis ? '#a855f7' : '#3b82f6'} strokeWidth="2.5" />
            {/* Magasin d'outils latéral */}
            <circle cx="22" cy="45" r="12" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
            {/* Table rainurée en T ou Berceau 5 axes */}
            {is5Axis ? (
              <circle cx="68" cy="45" r="22" fill="#1e293b" stroke="#c084fc" strokeWidth="2" />
            ) : (
              <rect x="42" y="23" width="52" height="44" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
            )}
            {/* Pièce aéronautique usinée */}
            <rect x="56" y="33" width="24" height="24" rx="4" fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1.5" />
            {/* Broche UGV centrale */}
            <g style={{ transformOrigin: '68px 45px', animation: `spin ${spinSpeed} linear infinite` }}>
              <circle cx="68" cy="45" r="10" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
              <line x1="58" y1="45" x2="78" y2="45" stroke="#f59e0b" strokeWidth="2.5" />
              <line x1="68" y1="35" x2="68" y2="55" stroke="#f59e0b" strokeWidth="2.5" />
            </g>
            {/* Vitre coulissante avant */}
            <rect x="38" y="75" width="60" height="5" rx="2" fill="#38bdf8" fillOpacity="0.7" />
            {isCoolant && <circle cx="68" cy="45" r="14" fill="rgba(34,211,238,0.35)" className="animate-pulse" />}
          </svg>
        );
      }
      case 'edm_wire':
        return (
          <svg viewBox="0 0 120 90" className="w-full h-full">
            <rect x="6" y="8" width="108" height="74" rx="7" fill="#1c1917" stroke="#f59e0b" strokeWidth="2.5" />
            {/* Bac diélectrique eau déionisée */}
            <rect x="18" y="18" width="70" height="54" rx="5" fill="#083344" stroke="#06b6d4" strokeWidth="2" />
            {/* Matrice acier trempé */}
            <polygon points="40,28 68,28 74,60 34,60" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Fil laiton et étincelles */}
            <circle cx="54" cy="44" r="6" fill="#fef08a" className="animate-ping" />
            <circle cx="54" cy="44" r="3" fill="#ffffff" />
            {/* Pupitre CN latéral */}
            <rect x="94" y="22" width="12" height="46" rx="2" fill="#334155" stroke="#fbbf24" strokeWidth="1" />
          </svg>
        );
      case 'aero_cell':
      default:
        return (
          <svg viewBox="0 0 120 90" className="w-full h-full">
            <rect x="4" y="6" width="112" height="78" rx="8" fill="#31102f" stroke="#f43f5e" strokeWidth="2.5" />
            {/* Centre 5 axes principal */}
            <rect x="12" y="14" width="54" height="62" rx="5" fill="#0f172a" stroke="#fb7185" strokeWidth="1.5" />
            <g style={{ transformOrigin: '39px 45px', animation: `spin ${spinSpeed} linear infinite` }}>
              <circle cx="39" cy="45" r="13" fill="#1e293b" stroke="#f43f5e" strokeWidth="2" />
              <polygon points="39,33 49,52 29,52" fill="#fbbf24" />
            </g>
            {/* Bras Robot Polyarticulé 6 axes (Orange) */}
            <circle cx="88" cy="45" r="12" fill="#ea580c" stroke="#fed7aa" strokeWidth="2" />
            <line x1="88" y1="45" x2="60" y2="45" stroke="#f97316" strokeWidth="6" strokeLinecap="round" />
            <circle cx="60" cy="45" r="5" fill="#fbbf24" />
            {/* Palettes Titane */}
            <rect x="76" y="14" width="30" height="14" rx="2" fill="#334155" stroke="#38bdf8" strokeWidth="1" />
            <rect x="76" y="62" width="30" height="14" rx="2" fill="#334155" stroke="#10b981" strokeWidth="1" />
          </svg>
        );
    }
  };

  // ==========================================
  // RENDU GRAPHIQUE
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      
      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-bounce bg-slate-900/95 border-amber-500/60 text-amber-200">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{notification.msg}</span>
        </div>
      )}

      {/* ==========================================
          MODAL D'AUTHENTIFICATION PSEUDO + MDP
      ========================================== */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
                <Cpu className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white uppercase">
                  CNC Empire <span className="text-amber-400">4.0</span>
                </h2>
                <p className="text-xs text-slate-400">Identification Chef d'Atelier & Classement Cloud</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed bg-slate-950/70 p-3 rounded-lg border border-slate-800">
              Entrez votre <strong>Pseudo</strong> et un <strong>Mot de passe</strong>. Si votre atelier n'existe pas encore, il sera créé automatiquement. Sinon, votre progression sera restaurée et synchronisée avec le <strong>Classement Général</strong>.
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Pseudo du Directeur / Atelier
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Usinage_Precision_33"
                  value={authForm.pseudo}
                  onChange={(e) => setAuthForm({ ...authForm, pseudo: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Mot de passe de sauvegarde
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
                >
                  <LogIn className="w-4 h-4" />
                  {authLoading ? 'Synchronisation...' : 'Charger / Créer mon Atelier'}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Mode Invité
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          BARRE SUPÉRIEURE (HUD INDUSTRIEL)
      ========================================== */}
      <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Statut Atelier */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Settings className="w-6 h-6 animate-spin" style={{ animationDuration: '12s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg tracking-tight text-white">
                  CNC EMPIRE <span className="text-amber-400 text-xs font-mono px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded">ISO-9001</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentWorkshop.name} (Niv. {workshopLevel})</span>
              </p>
            </div>
          </div>

          {/* Compteurs principaux : Trésorerie & $/sec */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Trésorerie</div>
                <div className="text-base sm:text-lg font-black font-mono text-emerald-400">
                  {formatMoney(money)}
                </div>
              </div>
            </div>

            <div className="bg-slate-950 border border-cyan-500/40 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Cadence d'Usinage</div>
                <div className="text-base sm:text-lg font-black font-mono text-cyan-300">
                  +{formatMoney(productionStats.totalPerSec)}<span className="text-xs text-cyan-500">/s</span>
                </div>
              </div>
            </div>

            {/* Profil & Bouton Sauvegarde */}
            <div className="flex items-center gap-2">
              {account.isLogged ? (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> {account.pseudo}
                    </div>
                    <div className="text-[10px] text-slate-400">{lastSavedText}</div>
                  </div>
                  <button
                    onClick={() => saveProgressToCloud()}
                    title="Sauvegarder maintenant"
                    className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    title="Changer de compte"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs"
                  >
                    Compte
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 transition"
                >
                  <LogIn className="w-4 h-4" />
                  Connexion / Classement
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BARRE DE NAVIGATION PAR ONGLETS */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 py-1.5 no-scrollbar">
          {[
            { id: 'map2d', label: 'Vue Plan 2D Interactif', icon: Compass, badge: 'LIVE 2D' },
            { id: 'workshop', label: 'Postes & Machines', icon: Cpu, badge: `${slots.filter(Boolean).length}/${currentWorkshop.slots}` },
            { id: 'chests', label: 'Recrutement (Coffres)', icon: Package, badge: 'Gacha' },
            { id: 'employees', label: 'Équipe & Fusion', icon: Users, badge: employees.length },
            { id: 'aesthetics', label: 'Agrandir & Déco', icon: Building2, badge: `Niv.${workshopLevel}` },
            { id: 'metrology', label: 'Métrologie & Contrats', icon: Crosshair, badge: `x${productionStats.metrologyMult.toFixed(2)}` },
            { id: 'leaderboard', label: 'Classement Général', icon: Trophy, badge: leaderboard.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      active ? 'bg-slate-950/30 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ==========================================
          CONTENU PRINCIPAL
      ========================================== */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 flex-1 flex flex-col gap-5">

        {/* BANDEAU DE CONTRAT ACTIF & COMMANDE D'USINAGE MANUEL (OVERCLOCKING) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Pupitre CNC d'Overclocking Manuel */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Pupitre CN Fanuc / Heidenhain
                </span>
                {overclockBoost && (
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                    🔥 Avance Rapide Vc x1.75 Active !
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Optimisation Manuelle des Broches & Lubrification Haute Pression
              </h3>
              <p className="text-xs text-slate-400">
                Cliquez sur <strong>Usiner / Boost Vc</strong> pour encaisser des pièces immédiatement et monter les broches en température (x1.75 $/s au-dessus de 65% de charge).
              </p>

              {/* Jauge de charge thermique broche */}
              <div className="pt-1">
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" /> Charge Broche & Plaquettes Carbure : {Math.round(spindleHeat)}%
                  </span>
                  <span className="text-cyan-400">
                    Multiplicateur Global : x{productionStats.totalGlobalMult.toFixed(2)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-200 ${
                      spindleHeat >= 65
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{ width: `${spindleHeat}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Boutons d'action CNC */}
            <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={handleManualMachining}
                className="relative flex-1 sm:w-48 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition select-none overflow-hidden"
              >
                <Zap className="w-5 h-5 fill-slate-950" />
                <span>USINER / BOOST Vc</span>
                {floatingClicks.map((fc) => (
                  <span
                    key={fc.id}
                    style={{ left: fc.x, top: fc.y }}
                    className="pointer-events-none absolute text-xs font-mono font-black text-white bg-slate-950/90 px-1.5 py-0.5 rounded border border-amber-400 animate-ping"
                  >
                    {fc.text}
                  </span>
                ))}
              </button>

              <button
                onClick={() => {
                  setCoolantActive((c) => !c);
                  showToast(
                    !coolantActive
                      ? 'Arrosage centre-broche 70 bars activé (+25% $/s) !'
                      : 'Arrosage haute pression coupé.',
                    'info'
                  );
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                  coolantActive
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span>{coolantActive ? 'Arrosage 70 Bars : ON (+25%)' : 'Activer Arrosage (+25%)'}</span>
              </button>
            </div>
          </div>

          {/* État du Contrat d'Usinage en cours */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-amber-400" /> Appel d'Offres en Cours
              </span>
              {activeContract && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                  {activeContract.timeLeft}s restantes
                </span>
              )}
            </div>

            {activeContract ? (
              <div className="space-y-2 my-auto">
                <div className="text-sm font-bold text-white">{activeContract.title}</div>
                <div className="text-xs text-slate-400">
                  Client : <strong className="text-slate-200">{activeContract.client}</strong> • Bonus cadence :{' '}
                  <strong className="text-emerald-400">x{activeContract.mult}</strong>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${(activeContract.timeLeft / activeContract.duration) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="my-auto py-2">
                <p className="text-xs text-slate-400 mb-2">
                  Aucun contrat prioritaire actif. Signez un appel d'offres automobile ou aéronautique pour booster vos revenus !
                </p>
                <button
                  onClick={() => setActiveTab('metrology')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <FileText className="w-4 h-4" /> Choisir un Contrat Client
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ==========================================
            ONGLET 0 : VUE PLAN 2D INTERACTIF DE L'USINE
        ========================================== */}
        {activeTab === 'map2d' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* CARTE ARCHITECTURALE 2D COMPLÈTE (8 COLONNES) */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              {/* Barre d'outils du Plan 2D */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-amber-400" />
                  <div>
                    <h2 className="text-xs sm:text-sm font-black uppercase text-white tracking-wider">
                      Plan Architectural 2D Temps Réel — {currentWorkshop.name}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Cliquez sur n'importe quelle machine ou emplacement du Hall CNC pour le piloter ou y affecter un opérateur.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowMapLabels((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                      showMapLabels
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-slate-950 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 inline mr-1" />
                    Labels $/s
                  </button>
                  <button
                    onClick={() => setShowAgvPaths((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                      showAgvPaths
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-950 border-slate-700 text-slate-400'
                    }`}
                  >
                    Flux Logistique
                  </button>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs">
                    <button
                      onClick={() => setMapZoom((z) => Math.max(0.85, +(z - 0.1).toFixed(2)))}
                      className="px-2.5 py-1 hover:bg-slate-800 text-slate-300 font-bold"
                    >
                      -
                    </button>
                    <span className="px-2 font-mono text-[11px] text-amber-400">{Math.round(mapZoom * 100)}%</span>
                    <button
                      onClick={() => setMapZoom((z) => Math.min(1.2, +(z + 0.1).toFixed(2)))}
                      className="px-2.5 py-1 hover:bg-slate-800 text-slate-300 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* CONTENEUR DU PLAN D'USINE MULTI-SALLES */}
              <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl p-3 sm:p-4 overflow-x-auto shadow-2xl relative">
                <div
                  style={{ transform: `scale(${mapZoom})`, transformOrigin: 'top center' }}
                  className="min-w-[680px] transition-transform duration-200 space-y-3"
                >
                  {/* RANGÉE SUPÉRIEURE : 3 SALLES TECHNIQUES ANNEXES */}
                  <div className="grid grid-cols-12 gap-3">
                    
                    {/* SALLE 1 : MAGASIN MATIÈRES PREMIÈRES & EXPÉDITION (4 cols) */}
                    <div className="col-span-4 bg-slate-900/90 border-2 border-amber-500/40 rounded-xl p-3 relative overflow-hidden flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Box className="w-3.5 h-3.5" /> Magasin Bruts & Quai
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300">
                          Alu / TA6V / Inconel
                        </span>
                      </div>

                      {/* Racks de barres métalliques et palettes Europe */}
                      <div className="grid grid-cols-2 gap-2 my-auto">
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <div className="text-[9px] font-mono text-slate-400 mb-1">Racks Barres Ø50-150</div>
                          <div className="space-y-1">
                            <div className="h-2 rounded bg-gradient-to-r from-slate-400 to-slate-200 w-full" title="Aluminium 7075" />
                            <div className="h-2 rounded bg-gradient-to-r from-amber-500 to-yellow-300 w-5/6" title="Laiton CuZn39Pb3" />
                            <div className="h-2 rounded bg-gradient-to-r from-cyan-400 to-blue-500 w-11/12" title="Titane Grade 5" />
                            <div className="h-2 rounded bg-gradient-to-r from-rose-500 to-purple-500 w-4/5" title="Inconel 718" />
                          </div>
                        </div>

                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col justify-between">
                          <div className="text-[9px] font-mono text-slate-400">Palettes Prêtes</div>
                          <div className="grid grid-cols-3 gap-1 py-1">
                            {[1, 2, 3, 4, 5, 6].map((p) => (
                              <div
                                key={p}
                                className="h-4 rounded-sm bg-amber-700/70 border border-amber-500/60 flex items-center justify-center"
                              >
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              </div>
                            ))}
                          </div>
                          <div className="text-[9px] font-mono text-emerald-400 text-right">Expédition OK</div>
                        </div>
                      </div>
                    </div>

                    {/* SALLE 2 : LABORATOIRE DE MÉTROLOGIE CLIMATISÉ 20°C (5 cols) */}
                    <div
                      onClick={() => setActiveTab('metrology')}
                      className="col-span-5 bg-cyan-950/25 border-2 border-cyan-400/60 rounded-xl p-3 relative overflow-hidden cursor-pointer hover:border-cyan-300 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1.5 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                          <Crosshair className="w-3.5 h-3.5" /> Labo Métrologie (20.0°C ±0.2°C)
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200">
                          Qualité x{productionStats.metrologyMult.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 my-auto">
                        {METROLOGY_UPGRADES.map((m, idx) => {
                          const owned = metrologyOwned.includes(m.id);
                          return (
                            <div
                              key={m.id}
                              className={`p-1.5 rounded-lg border text-center flex flex-col items-center justify-center ${
                                owned
                                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20'
                                  : 'bg-slate-950/60 border-slate-800 text-slate-600'
                              }`}
                            >
                              <div className="text-xs font-mono font-black">
                                {idx === 0 && '📏'}
                                {idx === 1 && '📐'}
                                {idx === 2 && '🔬'}
                                {idx === 3 && '🦾'}
                                {idx === 4 && '🎯'}
                              </div>
                              <div className="text-[8px] font-bold leading-tight mt-1 truncate w-full">
                                {m.name.split(' ')[0]}
                              </div>
                              <div className={`w-1.5 h-1.5 rounded-full mt-1 ${owned ? 'bg-emerald-400 animate-ping' : 'bg-slate-700'}`} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-[9px] text-cyan-300/80 font-mono mt-1.5 flex justify-between">
                        <span>Marbre Granit Grade 00</span>
                        <span>{metrologyOwned.length}/5 Instruments Certifiés</span>
                      </div>
                    </div>

                    {/* SALLE 3 : BUREAU D'ÉTUDES CAO/FAO & VESTIAIRES (3 cols) */}
                    <div
                      onClick={() => setActiveTab('employees')}
                      className="col-span-3 bg-indigo-950/25 border-2 border-indigo-400/50 rounded-xl p-3 cursor-pointer hover:border-indigo-300 transition flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between border-b border-indigo-900/60 pb-1.5 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> Bureau FAO & Équipe
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200">
                          {employees.length} RH
                        </span>
                      </div>

                      {/* Postes CAO et employés en réserve */}
                      <div className="space-y-1.5 my-auto">
                        <div className="flex items-center justify-between text-[10px] bg-slate-950/80 px-2 py-1 rounded border border-slate-800">
                          <span className="text-slate-400">Stations Mastercam/TopSolid</span>
                          <span className="text-emerald-400 font-mono font-bold">ONLINE</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {employees.slice(0, 8).map((emp) => {
                            const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
                            const isAssigned = slots.some((s) => s && s.employeeUid === emp.uid);
                            return (
                              <span
                                key={emp.uid}
                                title={`${tpl?.name} (${isAssigned ? 'En poste' : 'En salle FAO'})`}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-0.5"
                                style={{
                                  borderColor: tpl?.color || '#64748b',
                                  backgroundColor: isAssigned ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.9)'
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tpl?.color }} />
                                <span className="truncate max-w-[52px]">{tpl?.name.split(' ')[0]}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* COULOIR LOGISTIQUE & RAIL AGV / CONVOYEUR COPEAUX */}
                  {showAgvPaths && (
                    <div className="bg-slate-900/95 border border-dashed border-amber-500/50 rounded-xl px-4 py-2 flex items-center justify-between relative overflow-hidden">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-amber-300 z-10">
                        <span>⚠️ ALLÉE DE CIRCULATION SÉCURISÉE ISO</span>
                        {aesthetics.addons.includes('chip_conveyor') && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ♻️ Convoyeur Central Copeaux Actif
                          </span>
                        )}
                      </div>

                      {/* Animation AGV si débloqué ou chariot élévateur */}
                      <div className="flex items-center gap-6 text-xs font-mono text-cyan-300 animate-pulse z-10">
                        {aesthetics.addons.includes('agv_fleet') ? (
                          <span>🤖 AGV-01 ➔ Alimentation Palettes Titane ➔ 🤖 AGV-02</span>
                        ) : (
                          <span>🚜 Transpalette Manuel • Flux Bruts ➔ Machines CNC</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GRAND HALL D'USINAGE PRINCIPAL (AVEC SOL, MURS, PONT ROULANT & LES 16 ÎLOTS CNC) */}
                  <div
                    className={`rounded-2xl border-4 p-4 relative overflow-hidden transition-all ${currentWallObj.border}`}
                    style={{
                      backgroundColor: currentFloorObj.color,
                      backgroundImage: currentWorkshop.gridBg,
                      backgroundSize: '24px 24px'
                    }}
                  >
                    {/* Pont Roulant Motorisé 10T (Traverse le Hall si acheté) */}
                    {aesthetics.addons.includes('overhead_crane') && (
                      <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/60 flex items-center justify-between text-[11px] font-mono text-amber-300 shadow-inner">
                        <span>🏗️ RAIL PONT ROULant DEMAG 10 TONNES — TRAVÉE A-B</span>
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black animate-pulse">
                          MANUTENTION LOURDE +12%
                        </span>
                      </div>
                    )}

                    {/* GRILLE 2D DES ÎLOTS D'USINAGE */}
                    <div className="grid grid-cols-4 gap-3.5 relative z-10">
                      {Array.from({ length: 16 }).map((_, idx) => {
                        const isUnlocked = idx < currentWorkshop.slots;
                        const slotData = slots[idx];
                        const mac = slotData ? MACHINES_CATALOG.find((m) => m.id === slotData.machineId) : null;
                        const emp =
                          slotData && slotData.employeeUid
                            ? employees.find((e) => e.uid === slotData.employeeUid)
                            : null;
                        const empTpl = emp ? EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId) : null;
                        const isSelected = selectedSlot === idx;
                        const slotIncome = productionStats.slotBreakdown[idx] * productionStats.totalGlobalMult;

                        if (!isUnlocked) {
                          return (
                            <div
                              key={idx}
                              onClick={() => setActiveTab('aesthetics')}
                              className="h-44 rounded-xl border-2 border-dashed border-slate-800/90 bg-slate-950/60 flex flex-col items-center justify-center p-2 text-center cursor-pointer hover:border-amber-500/50 transition"
                            >
                              <Lock className="w-5 h-5 text-slate-600 mb-1" />
                              <span className="text-[11px] font-bold text-slate-500">Zone Non Construite #{idx + 1}</span>
                              <span className="text-[9px] text-amber-500/80 mt-0.5">Cliquer pour agrandir les murs</span>
                            </div>
                          );
                        }

                        if (!slotData) {
                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedSlot(idx)}
                              className={`h-44 rounded-xl border-2 border-dashed p-3 flex flex-col items-center justify-center cursor-pointer transition ${
                                isSelected
                                  ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10'
                                  : 'border-yellow-500/40 bg-slate-900/50 hover:border-amber-400'
                              }`}
                            >
                              <div className="text-[10px] font-mono text-yellow-500/80 mb-2 uppercase tracking-widest">
                                [ Marquage Sol #{idx + 1} ]
                              </div>
                              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-300 mb-1.5">
                                <Plus className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-white">Installer Machine</span>
                              <span className="text-[10px] text-slate-400">Dalle béton câblée 400V</span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSlot(idx)}
                            className={`h-44 rounded-xl p-2 flex flex-col justify-between cursor-pointer transition relative bg-slate-950/90 border-2 ${
                              isSelected
                                ? 'border-amber-400 ring-2 ring-amber-400/40 scale-[1.02]'
                                : 'border-yellow-500/50 hover:border-cyan-400'
                            }`}
                          >
                            {/* Barre supérieure de l'îlot : Colonne lumineuse (Andon) & Numéro de poste */}
                            <div className="flex items-center justify-between gap-1 z-10">
                              <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Cycle CN actif" />
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    overclockBoost ? 'bg-rose-500 animate-ping' : 'bg-amber-400'
                                  }`}
                                  title="Charge broche"
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${coolantActive ? 'bg-cyan-400' : 'bg-slate-700'}`}
                                  title="Arrosage 70B"
                                />
                                <span className="text-[10px] font-mono font-bold text-slate-200 ml-0.5">
                                  #{idx + 1}•N{slotData.level}
                                </span>
                              </div>

                              {showMapLabels && (
                                <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  +{formatMoney(slotIncome)}/s
                                </span>
                              )}
                            </div>

                            {/* Dessin 2D Top-Down de la Machine-Outil */}
                            <div className="h-24 w-full my-auto relative">
                              {renderMachine2DSvg(slotData.machineId, overclockBoost, coolantActive)}
                            </div>

                            {/* Pied de l'îlot : Nom de la machine + Badge Opérateur en poste */}
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/90 text-[10px]">
                              <span className="font-bold text-slate-200 truncate">{mac?.name}</span>
                              {empTpl ? (
                                <span
                                  className="px-1.5 py-0.5 rounded font-bold shrink-0 flex items-center gap-0.5 bg-slate-900 border"
                                  style={{ borderColor: empTpl.color, color: empTpl.color }}
                                >
                                  <span>👷</span>
                                  <span>{'★'.repeat(emp.stars)}</span>
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-500 font-mono shrink-0">Sans Op.</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PANNEAU D'INSPECTION RAPIDE DU POSTE SÉLECTIONNÉ SUR LA CARTE 2D (4 COLONNES) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-amber-400" />
                      <h3 className="font-black text-sm uppercase tracking-wider text-white">
                        Îlot 2D Sélectionné : Poste #{selectedSlot + 1}
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('workshop')}
                      className="text-[11px] text-cyan-400 hover:underline font-bold"
                    >
                      Vue Détaillée
                    </button>
                  </div>

                  {!slots[selectedSlot] ? (
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                      <p className="text-xs text-slate-400 mb-2">
                        Choisissez une machine-outil à implanter sur la dalle du <strong>Poste #{selectedSlot + 1}</strong> :
                      </p>
                      {MACHINES_CATALOG.map((mac) => {
                        const sameCount = slots.filter((s) => s && s.machineId === mac.id).length;
                        const cost = Math.floor(mac.baseCost * Math.pow(1.35, sameCount));
                        const canAfford = money >= cost;
                        return (
                          <div
                            key={mac.id}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">{mac.name}</div>
                              <div className="text-[10px] font-mono text-emerald-400">
                                +{formatMoney(mac.baseProd * productionStats.totalGlobalMult)}/s • {mac.axes}
                              </div>
                            </div>
                            <button
                              onClick={() => handleBuyMachine(mac.id, selectedSlot)}
                              disabled={!canAfford}
                              className={`px-3 py-1.5 rounded-lg font-black text-xs shrink-0 ${
                                canAfford
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              {formatMoney(cost)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    (() => {
                      const currentSlot = slots[selectedSlot];
                      const mac = MACHINES_CATALOG.find((m) => m.id === currentSlot.machineId);
                      const upgCost = getUpgradeCost(currentSlot);
                      const canUpg = money >= upgCost;
                      const currentSlotProd =
                        productionStats.slotBreakdown[selectedSlot] * productionStats.totalGlobalMult;

                      return (
                        <div className="space-y-3">
                          {/* Aperçu 2D agrandi de la machine */}
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                            <div className="w-24 h-20 shrink-0">
                              {renderMachine2DSvg(currentSlot.machineId, overclockBoost, coolantActive)}
                            </div>
                            <div>
                              <span className="text-[10px] font-mono text-cyan-400 uppercase">
                                {mac?.axes} • {mac?.rpm}
                              </span>
                              <h4 className="text-sm font-black text-white">{mac?.name}</h4>
                              <div className="text-xs font-mono text-emerald-400 font-bold mt-1">
                                Niv. {currentSlot.level} • +{formatMoney(currentSlotProd)}/s
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleUpgradeMachine(selectedSlot)}
                            disabled={!canUpg}
                            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-between transition ${
                              canUpg
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <span>Améliorer Paramètres Coupe (Niv.{currentSlot.level + 1})</span>
                            <span className="font-mono">{formatMoney(upgCost)}</span>
                          </button>

                          {/* Affectation rapide d'un employé */}
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-300">
                              <span>Opérateur sur l'îlot #{selectedSlot + 1}</span>
                              {currentSlot.employeeUid && (
                                <button
                                  onClick={() => handleAssignEmployee(selectedSlot, null)}
                                  className="text-[11px] text-rose-400 hover:underline"
                                >
                                  Retirer
                                </button>
                              )}
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                              {employees.map((emp) => {
                                const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
                                if (!tpl) return null;
                                const busyIdx = slots.findIndex((s) => s && s.employeeUid === emp.uid);
                                const isHere = busyIdx === selectedSlot;
                                return (
                                  <div
                                    key={emp.uid}
                                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                                  >
                                    <div className="truncate">
                                      <span className="font-bold text-white">{tpl.name}</span>{' '}
                                      <span className="text-amber-400">{'★'.repeat(emp.stars)}</span>
                                      <div className="text-[10px] text-slate-400">
                                        {tpl.role} (+{Math.round(tpl.prodBonus * (1 + (emp.stars - 1) * 0.5) * 100)}%)
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleAssignEmployee(selectedSlot, emp.uid)}
                                      disabled={isHere}
                                      className={`px-2.5 py-1 rounded font-bold text-[11px] ${
                                        isHere
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                                      }`}
                                    >
                                      {isHere ? 'Actif' : 'Affecter'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {slots[selectedSlot] && (
                  <button
                    onClick={() => handleSellMachine(selectedSlot)}
                    className="w-full py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-semibold transition mt-3"
                  >
                    Revendre cette machine-outil
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ONGLET 1 : ATELIER VISUEL & PARC MACHINES
        ========================================== */}
        {activeTab === 'workshop' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* VUE VISUELLE DE L'ATELIER (8 COLONNES) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div
                className={`rounded-2xl border-2 p-4 sm:p-5 relative overflow-hidden shadow-2xl transition-all ${currentWallObj.border}`}
                style={{
                  backgroundColor: currentFloorObj.color,
                  backgroundImage: currentWorkshop.gridBg,
                  backgroundSize: '28px 28px'
                }}
              >
                {/* En-tête de l'atelier visuel */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm p-3 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <h2 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">
                        Plan d'Implantation : {currentWorkshop.name}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sol : <span className="text-slate-200">{currentFloorObj.name}</span> • Structure :{' '}
                      <span className="text-slate-200">{currentWallObj.name}</span>
                    </p>
                  </div>

                  {/* Badges des équipements d'atelier installés */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {aesthetics.addons.map((adId) => {
                      const ad = AESTHETICS_SHOP.addons.find((a) => a.id === adId);
                      if (!ad) return null;
                      return (
                        <span
                          key={adId}
                          title={ad.desc}
                          className="px-2 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs flex items-center gap-1"
                        >
                          <span>{ad.icon}</span>
                          <span className="hidden sm:inline text-[11px] font-semibold text-amber-300">
                            {ad.name.split(' ')[0]}
                          </span>
                        </span>
                      );
                    })}
                    {nextWorkshop && (
                      <button
                        onClick={() => setActiveTab('aesthetics')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" /> Agrandir ({currentWorkshop.slots} → {nextWorkshop.slots} postes)
                      </button>
                    )}
                  </div>
                </div>

                {/* GRILLE DES EMPLACEMENTS MACHINES */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 16 }).map((_, index) => {
                    const isUnlocked = index < currentWorkshop.slots;
                    const slotData = slots[index];
                    const machineObj = slotData ? MACHINES_CATALOG.find((m) => m.id === slotData.machineId) : null;
                    const assignedEmp =
                      slotData && slotData.employeeUid
                        ? employees.find((e) => e.uid === slotData.employeeUid)
                        : null;
                    const empTemplate = assignedEmp
                      ? EMPLOYEE_TEMPLATES.find((t) => t.templateId === assignedEmp.templateId)
                      : null;
                    const isSelected = selectedSlot === index;
                    const slotIncome = productionStats.slotBreakdown[index] * productionStats.totalGlobalMult;

                    if (!isUnlocked) {
                      return (
                        <div
                          key={index}
                          onClick={() => setActiveTab('aesthetics')}
                          className="h-36 rounded-xl border border-dashed border-slate-800 bg-slate-950/50 flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:border-slate-700 transition group"
                        >
                          <Lock className="w-5 h-5 text-slate-600 group-hover:text-amber-400 mb-1 transition" />
                          <span className="text-[11px] font-bold text-slate-500">Poste #{index + 1} Verrouillé</span>
                          <span className="text-[10px] text-slate-600 mt-0.5">Agrandissez l'atelier</span>
                        </div>
                      );
                    }

                    if (!slotData) {
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedSlot(index)}
                          className={`h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 transition ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500/10'
                              : 'border-slate-700 bg-slate-900/60 hover:border-cyan-400/60 hover:bg-slate-900'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 mb-1.5">
                            <Plus className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-200">Poste #{index + 1} Libre</span>
                          <span className="text-[10px] text-amber-400 mt-0.5">Acheter une machine</span>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={index}
                        onClick={() => setSelectedSlot(index)}
                        className={`h-36 rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition relative overflow-hidden bg-gradient-to-br ${
                          machineObj?.color
                        } ${
                          isSelected
                            ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/20 scale-[1.02]'
                            : 'border border-slate-700/80 hover:border-slate-500'
                        }`}
                      >
                        {/* En-tête carte machine : Voyant LED & Niveau */}
                        <div className="flex items-center justify-between z-10">
                          <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold bg-slate-950/80 px-2 py-0.5 rounded-md text-slate-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            #{index + 1} • Niv.{slotData.level}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-amber-300 font-bold">
                            {machineObj?.axes}
                          </span>
                        </div>

                        {/* Visuel central de la machine en usinage */}
                        <div className="my-auto flex items-center justify-between gap-2 z-10 px-1">
                          <div className="min-w-0">
                            <div className="text-xs font-black text-white truncate leading-tight">
                              {machineObj?.name}
                            </div>
                            <div className="text-[11px] font-mono text-emerald-300 font-bold mt-0.5">
                              +{formatMoney(slotIncome)}/s
                            </div>
                          </div>
                          <div className="w-8 h-8 rounded-lg bg-slate-950/60 border border-white/10 flex items-center justify-center shrink-0">
                            <Settings
                              className="w-5 h-5 text-cyan-300 animate-spin"
                              style={{ animationDuration: overclockBoost ? '1.2s' : '4s' }}
                            />
                          </div>
                        </div>

                        {/* Pied de carte : Opérateur assigné */}
                        <div className="z-10">
                          {empTemplate ? (
                            <div
                              className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-950/90 border text-[10px]"
                              style={{ borderColor: empTemplate.color }}
                            >
                              <span className="font-bold truncate text-white flex items-center gap-1">
                                <UserCheck className="w-3 h-3 shrink-0" style={{ color: empTemplate.color }} />
                                {empTemplate.name}
                              </span>
                              <span className="text-amber-400 font-mono shrink-0">{'★'.repeat(assignedEmp.stars)}</span>
                            </div>
                          ) : (
                            <div className="px-2 py-1 rounded-lg bg-slate-950/60 border border-dashed border-slate-600 text-[10px] text-slate-400 text-center">
                              Aucun opérateur affecté
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PANNEAU D'INSPECTION & ACHAT DU POSTE SÉLECTIONNÉ (4 COLONNES) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-amber-400" />
                    <h3 className="font-black text-sm uppercase tracking-wider text-white">
                      Gestion du Poste #{selectedSlot + 1}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {slots[selectedSlot] ? 'Occupé' : 'Emplacement Libre'}
                  </span>
                </div>

                {/* CAS 1 : EMPLACEMENT LIBRE -> CATALOGUE D'ACHAT MACHINES */}
                {!slots[selectedSlot] ? (
                  <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1">
                    <p className="text-xs text-slate-400 mb-2">
                      Sélectionnez une machine-outil à installer sur le <strong>Poste #{selectedSlot + 1}</strong> :
                    </p>
                    {MACHINES_CATALOG.map((mac) => {
                      const sameCount = slots.filter((s) => s && s.machineId === mac.id).length;
                      const cost = Math.floor(mac.baseCost * Math.pow(1.35, sameCount));
                      const canAfford = money >= cost;
                      return (
                        <div
                          key={mac.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col gap-2 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                                {mac.category} • {mac.axes}
                              </span>
                              <h4 className="font-bold text-sm text-white mt-1">{mac.name}</h4>
                              <p className="text-[11px] text-slate-400 leading-snug">{mac.desc}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                            <div className="text-xs font-mono">
                              <div className="text-emerald-400 font-bold">
                                Base : +{formatMoney(mac.baseProd * productionStats.totalGlobalMult)}/s
                              </div>
                              <div className="text-[10px] text-slate-500">Broche : {mac.rpm}</div>
                            </div>
                            <button
                              onClick={() => handleBuyMachine(mac.id, selectedSlot)}
                              disabled={!canAfford}
                              className={`px-3 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition ${
                                canAfford
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              <Plus className="w-4 h-4" />
                              <span>{formatMoney(cost)}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* CAS 2 : MACHINE INSTALLÉE -> AMÉLIORATION & AFFECTATION D'OPÉRATEUR */
                  (() => {
                    const currentSlot = slots[selectedSlot];
                    const mac = MACHINES_CATALOG.find((m) => m.id === currentSlot.machineId);
                    const upgCost = getUpgradeCost(currentSlot);
                    const canUpg = money >= upgCost;
                    const currentSlotProd = productionStats.slotBreakdown[selectedSlot] * productionStats.totalGlobalMult;
                    const assignedEmp = currentSlot.employeeUid
                      ? employees.find((e) => e.uid === currentSlot.employeeUid)
                      : null;
                    const assignedTpl = assignedEmp
                      ? EMPLOYEE_TEMPLATES.find((t) => t.templateId === assignedEmp.templateId)
                      : null;

                    return (
                      <div className="flex flex-col gap-4 flex-1 justify-between">
                        <div className="space-y-3">
                          <div className={`p-3.5 rounded-xl bg-gradient-to-br ${mac?.color} border border-white/10`}>
                            <div className="flex justify-between items-center text-xs font-mono text-slate-200 mb-1">
                              <span>{mac?.category}</span>
                              <span>{mac?.rpm}</span>
                            </div>
                            <h4 className="text-base font-black text-white">{mac?.name}</h4>
                            <p className="text-xs text-slate-200/80 mt-1">{mac?.desc}</p>
                            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                              <div>
                                <div className="text-[10px] uppercase text-slate-300">Niveau Paramètres Vc/fz</div>
                                <div className="text-sm font-black text-amber-300">Niveau {currentSlot.level}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] uppercase text-slate-300">Production Poste</div>
                                <div className="text-sm font-black font-mono text-emerald-300">
                                  +{formatMoney(currentSlotProd)}/s
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Bouton d'amélioration de la machine */}
                          <button
                            onClick={() => handleUpgradeMachine(selectedSlot)}
                            disabled={!canUpg}
                            className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-between transition ${
                              canUpg
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <ArrowUpCircle className="w-5 h-5" />
                              <span>Optimiser Vitesse de Coupe (Niv.{currentSlot.level + 1})</span>
                            </span>
                            <span className="font-mono">{formatMoney(upgCost)}</span>
                          </button>

                          {/* Section Affectation de l'Opérateur / Employé */}
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-cyan-400" /> Opérateur Affecté au Poste
                              </span>
                              {assignedEmp && (
                                <button
                                  onClick={() => handleAssignEmployee(selectedSlot, null)}
                                  className="text-[11px] text-rose-400 hover:underline"
                                >
                                  Retirer
                                </button>
                              )}
                            </div>

                            {assignedTpl ? (
                              <div
                                className={`p-2.5 rounded-xl border ${assignedTpl.bg} ${assignedTpl.border} flex items-center justify-between`}
                              >
                                <div>
                                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                                    <span>{assignedTpl.name}</span>
                                    <span className="text-amber-400">{'★'.repeat(assignedEmp.stars)}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-300">
                                    {assignedTpl.role} ({assignedTpl.rarityLabel})
                                  </div>
                                  <div className="text-[11px] font-mono text-emerald-300 mt-0.5">
                                    +{Math.round(assignedTpl.prodBonus * (1 + (assignedEmp.stars - 1) * 0.5) * 100)}% Prod
                                    {assignedTpl.costDiscount > 0 && ` • -${Math.round(assignedTpl.costDiscount * 100)}% Coût Niv.`}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">
                                Aucun employé sur cette machine. Sélectionnez un membre de votre équipe ci-dessous :
                              </p>
                            )}

                            {/* Liste rapide des employés disponibles */}
                            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 pt-1">
                              {employees.map((emp) => {
                                const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
                                if (!tpl) return null;
                                const busySlotIndex = slots.findIndex((s) => s && s.employeeUid === emp.uid);
                                const isHere = busySlotIndex === selectedSlot;
                                const effectiveBonus = Math.round(tpl.prodBonus * (1 + (emp.stars - 1) * 0.5) * 100);

                                return (
                                  <div
                                    key={emp.uid}
                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-white truncate flex items-center gap-1">
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: tpl.color }}
                                        />
                                        <span>{tpl.name}</span>
                                        <span className="text-amber-400 text-[10px]">{'★'.repeat(emp.stars)}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        +{effectiveBonus}% Prod •{' '}
                                        {busySlotIndex !== -1 ? `Poste #${busySlotIndex + 1}` : 'Disponible'}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleAssignEmployee(selectedSlot, emp.uid)}
                                      disabled={isHere}
                                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0 transition ${
                                        isHere
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                                      }`}
                                    >
                                      {isHere ? 'En poste' : 'Affecter'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Revendre la machine */}
                        <button
                          onClick={() => handleSellMachine(selectedSlot)}
                          className="w-full py-2 px-3 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-semibold transition mt-3"
                        >
                          Revendre cette machine pour remplacer par un modèle supérieur
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ONGLET 2 : RECRUTEMENT & COFFRES GACHA
        ========================================== */}
        {activeTab === 'chests' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
                <div>
                  <h2 className="text-lg font-black text-white uppercase flex items-center gap-2">
                    <Package className="w-6 h-6 text-amber-400" /> Centre de Recrutement & Chasseurs de Têtes
                  </h2>
                  <p className="text-xs text-slate-400">
                    Ouvrez des mallettes de recrutement pour obtenir des Opérateurs, Programmeurs FAO, Compagnons et Directeurs Techniques.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('employees')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center gap-1.5 self-start"
                >
                  <Users className="w-4 h-4" /> Voir mon Équipe ({employees.length})
                </button>
              </div>

              {/* Animation / Résultat d'ouverture de coffre */}
              {(chestOpening || chestResult) && (
                <div className="mb-6 p-6 rounded-2xl bg-slate-950 border-2 border-amber-500/60 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                  {chestOpening ? (
                    <div className="py-6 flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-slate-950 animate-bounce shadow-xl shadow-amber-500/30">
                        <Package className="w-9 h-9 animate-spin" />
                      </div>
                      <div className="text-sm font-black text-amber-300 uppercase tracking-wider">
                        Analyse des CV & Entretien Technique en cours...
                      </div>
                    </div>
                  ) : (
                    chestResult && (
                      <div className="py-2 flex flex-col items-center max-w-md">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-2 border"
                          style={{
                            color: chestResult.color,
                            borderColor: chestResult.color,
                            backgroundColor: 'rgba(0,0,0,0.5)'
                          }}
                        >
                          Nouveau Recrutement • {chestResult.rarityLabel}
                        </span>
                        <h3 className="text-2xl font-black text-white">{chestResult.name}</h3>
                        <p className="text-sm font-semibold text-slate-300 mb-3">{chestResult.role}</p>

                        <div className="grid grid-cols-2 gap-2 w-full bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs font-mono mb-4">
                          <div className="text-emerald-400 font-bold">
                            +{Math.round(chestResult.prodBonus * 100)}% Cadence Machine
                          </div>
                          <div className="text-cyan-400 font-bold">
                            -{Math.round(chestResult.costDiscount * 100)}% Coût Amélioration
                          </div>
                          {chestResult.globalBonus > 0 && (
                            <div className="col-span-2 text-amber-400 font-bold border-t border-slate-800 pt-1.5">
                              🌟 Synergie Atelier Global : +{Math.round(chestResult.globalBonus * 100)}% sur toutes les machines !
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setChestResult(null)}
                          className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
                        >
                          Super, Continuer !
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Les 3 Coffres */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {CHESTS_CATALOG.map((chest) => {
                  const canAfford = money >= chest.cost && !chestOpening;
                  return (
                    <div
                      key={chest.id}
                      className={`rounded-2xl p-5 bg-gradient-to-b ${chest.color} border-2 ${chest.border} flex flex-col justify-between shadow-xl`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-lg bg-black/40 text-xs font-mono font-bold text-amber-300">
                            Coffre RH
                          </span>
                          <Sparkles className="w-5 h-5 text-amber-300" />
                        </div>
                        <h3 className="text-lg font-black text-white mb-1">{chest.name}</h3>
                        <p className="text-xs text-slate-200/80 mb-4 leading-relaxed">{chest.desc}</p>

                        {/* Probabilités d'obtention */}
                        <div className="bg-slate-950/70 rounded-xl p-3 border border-white/10 space-y-1 text-[11px] font-mono mb-5">
                          <div className="text-slate-400 font-sans font-bold uppercase text-[10px] mb-1">
                            Taux de drop certifiés :
                          </div>
                          {chest.odds.COMMON > 0 && (
                            <div className="flex justify-between text-slate-300">
                              <span>Commun (Opérateur)</span>
                              <span>{chest.odds.COMMON}%</span>
                            </div>
                          )}
                          {chest.odds.RARE > 0 && (
                            <div className="flex justify-between text-sky-400">
                              <span>Rare (Régleur CNC)</span>
                              <span>{chest.odds.RARE}%</span>
                            </div>
                          )}
                          {chest.odds.EPIC > 0 && (
                            <div className="flex justify-between text-purple-400">
                              <span>Épique (FAO / Métrologue)</span>
                              <span>{chest.odds.EPIC}%</span>
                            </div>
                          )}
                          {chest.odds.LEGENDARY > 0 && (
                            <div className="flex justify-between text-amber-400 font-bold">
                              <span>Légendaire (Compagnon 5 Axes)</span>
                              <span>{chest.odds.LEGENDARY}%</span>
                            </div>
                          )}
                          {chest.odds.MYTHIC > 0 && (
                            <div className="flex justify-between text-rose-400 font-bold">
                              <span>Mythique (Directeur Aéro)</span>
                              <span>{chest.odds.MYTHIC}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenChest(chest)}
                        disabled={!canAfford}
                        className={`w-full py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition ${
                          canAfford
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg'
                            : 'bg-slate-900/80 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Recruter ({formatMoney(chest.cost)})</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ONGLET 3 : INVENTAIRE EMPLOYÉS & FUSION
        ========================================== */}
        {activeTab === 'employees' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white uppercase flex items-center gap-2">
                  <Users className="w-6 h-6 text-cyan-400" /> Organigramme & Fusion des Compétences
                </h2>
                <p className="text-xs text-slate-400">
                  Fusionnez <strong>3 employés identiques</strong> de même grade pour former un expert étoilé (+50% d'efficacité supplémentaire par étoile ★).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {employees.map((emp) => {
                const tpl = EMPLOYEE_TEMPLATES.find((t) => t.templateId === emp.templateId);
                if (!tpl) return null;
                const assignedSlotIndex = slots.findIndex((s) => s && s.employeeUid === emp.uid);
                const sameCount = employees.filter(
                  (e) => e.templateId === emp.templateId && e.stars === emp.stars
                ).length;
                const canMerge = sameCount >= 3;
                const starMult = 1 + (emp.stars - 1) * 0.5;

                return (
                  <div
                    key={emp.uid}
                    className={`p-4 rounded-2xl border ${tpl.bg} ${tpl.border} flex flex-col justify-between gap-3`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/50"
                          style={{ color: tpl.color }}
                        >
                          {tpl.rarityLabel}
                        </span>
                        <span className="text-amber-400 font-mono text-sm tracking-widest">
                          {'★'.repeat(emp.stars)}
                        </span>
                      </div>
                      <h3 className="text-base font-black text-white">{tpl.name}</h3>
                      <p className="text-xs text-slate-300 mb-3">{tpl.role}</p>

                      <div className="space-y-1 text-xs font-mono bg-slate-950/70 p-2.5 rounded-xl border border-white/10">
                        <div className="text-emerald-400 font-bold">
                          • Cadence poste : +{Math.round(tpl.prodBonus * starMult * 100)}%
                        </div>
                        {tpl.costDiscount > 0 && (
                          <div className="text-cyan-300">
                            • Coût réglage : -{Math.round(tpl.costDiscount * 100)}%
                          </div>
                        )}
                        {tpl.globalBonus > 0 && (
                          <div className="text-amber-300">
                            • Bonus Atelier : +{Math.round(tpl.globalBonus * (1 + (emp.stars - 1) * 0.4) * 100)}%
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <span className="text-xs text-slate-300">
                        {assignedSlotIndex !== -1 ? (
                          <strong className="text-emerald-400">Affecté au Poste #{assignedSlotIndex + 1}</strong>
                        ) : (
                          <span className="text-slate-400">En réserve</span>
                        )}
                      </span>

                      {canMerge && (
                        <button
                          onClick={() => handleMergeEmployees(emp.templateId, emp.stars)}
                          className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md animate-pulse"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Fusionner (3→★{emp.stars + 1})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==========================================
            ONGLET 4 : AGRANDISSEMENT & ESTHÉTIQUE ATELIER
        ========================================== */}
        {activeTab === 'aesthetics' && (
          <div className="space-y-6">
            
            {/* Agrandissement des Murs / Structure Principale */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-lg font-black text-white uppercase flex items-center gap-2 mb-1">
                <Building2 className="w-6 h-6 text-amber-400" /> Agrandissement Architectural de l'Usine
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Poussez les murs pour débloquer jusqu'à 16 emplacements de machines CNC et augmenter le multiplicateur d'efficacité global.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                {WORKSHOP_TIERS.map((tier) => {
                  const isCurrent = tier.level === workshopLevel;
                  const isUnlocked = tier.level <= workshopLevel;
                  const isNext = tier.level === workshopLevel + 1;
                  const canAfford = money >= tier.cost;

                  return (
                    <div
                      key={tier.level}
                      className={`p-4 rounded-2xl border flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-400'
                          : isUnlocked
                          ? 'bg-slate-950 border-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center text-xs font-mono mb-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                            Palier {tier.level}
                          </span>
                          <span className="text-cyan-400 font-bold">{tier.slots} Emplacements</span>
                        </div>
                        <h3 className="font-black text-sm text-white mb-1">{tier.name}</h3>
                        <p className="text-xs text-slate-400 mb-3">{tier.desc}</p>
                        <div className="text-xs font-mono text-emerald-400 font-bold mb-3">
                          Multiplicateur Structure : x{tier.globalBonus.toFixed(2)}
                        </div>
                      </div>

                      {isUnlocked ? (
                        <div className="py-2 text-center rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                          {isCurrent ? 'Atelier Actuel' : 'Acquis'}
                        </div>
                      ) : isNext ? (
                        <button
                          onClick={handleUpgradeWorkshop}
                          disabled={!canAfford}
                          className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Agrandir ({formatMoney(tier.cost)})
                        </button>
                      ) : (
                        <div className="py-2 text-center rounded-xl bg-slate-900 text-slate-500 text-xs font-semibold">
                          Débloquez le palier précédent
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Personnalisation Esthétique : Sols, Murs & Équipements */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              
              {/* Revêtements de Sol */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" /> Revêtements de Sol
                </h3>
                {AESTHETICS_SHOP.floors.map((fl) => {
                  const isActive = aesthetics.floor === fl.id;
                  const canBuy = money >= fl.cost;
                  return (
                    <div
                      key={fl.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{fl.name}</div>
                        <div className="text-[11px] font-mono text-emerald-400">
                          Bonus propreté : +{Math.round(fl.bonus * 100)}% $/s
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (isActive) return;
                          if (money < fl.cost) {
                            showToast('Trésorerie insuffisante.', 'error');
                            return;
                          }
                          setMoney((m) => m - fl.cost);
                          setAesthetics((prev) => ({ ...prev, floor: fl.id }));
                          showToast(`Sol "${fl.name}" appliqué dans l'atelier !`, 'success');
                        }}
                        disabled={isActive || !canBuy}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : canBuy
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Installé' : formatMoney(fl.cost)}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Murs & Cloisons */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" /> Murs & Isolation
                </h3>
                {AESTHETICS_SHOP.walls.map((w) => {
                  const isActive = aesthetics.wall === w.id;
                  const canBuy = money >= w.cost;
                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{w.name}</div>
                        <div className="text-[11px] font-mono text-emerald-400">
                          Stabilité thermique : +{Math.round(w.bonus * 100)}% $/s
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (isActive) return;
                          if (money < w.cost) {
                            showToast('Trésorerie insuffisante.', 'error');
                            return;
                          }
                          setMoney((m) => m - w.cost);
                          setAesthetics((prev) => ({ ...prev, wall: w.id }));
                          showToast(`Murs "${w.name}" installés !`, 'success');
                        }}
                        disabled={isActive || !canBuy}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : canBuy
                            ? 'bg-purple-500 hover:bg-purple-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isActive ? 'Installé' : formatMoney(w.cost)}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Infrastructures Lourdes (Pont roulant, AGV, Convoyeur copeaux) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" /> Infrastructures d'Atelier
                </h3>
                {AESTHETICS_SHOP.addons.map((ad) => {
                  const owned = aesthetics.addons.includes(ad.id);
                  const canBuy = money >= ad.cost;
                  return (
                    <div
                      key={ad.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{ad.icon}</span>
                          <span>{ad.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{ad.desc}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (owned) return;
                          if (money < ad.cost) return;
                          setMoney((m) => m - ad.cost);
                          setAesthetics((prev) => ({ ...prev, addons: [...prev.addons, ad.id] }));
                          showToast(`${ad.name} installé dans l'atelier !`, 'success');
                        }}
                        disabled={owned || !canBuy}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                          owned
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : canBuy
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {owned ? 'Actif' : formatMoney(ad.cost)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ONGLET 5 : MÉTROLOGIE & CONTRATS CLIENTS
        ========================================== */}
        {activeTab === 'metrology' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Laboratoire de Métrologie Climatisé */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-lg font-black text-white uppercase flex items-center gap-2">
                  <Crosshair className="w-6 h-6 text-cyan-400" /> Laboratoire de Métrologie & Qualité
                </h2>
                <p className="text-xs text-slate-400">
                  Plus vos instruments de contrôle sont précis, plus vous certifiez des tolérances serrées et vendez vos pièces usinées cher (Multiplicateur actuel :{' '}
                  <strong className="text-emerald-400">x{productionStats.metrologyMult.toFixed(2)}</strong>).
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {METROLOGY_UPGRADES.map((m) => {
                  const isOwned = metrologyOwned.includes(m.id);
                  const canBuy = money >= m.cost;
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          Incertitude : {m.accuracy}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-1">{m.name}</h4>
                        <div className="text-xs font-mono text-emerald-400 font-bold">
                          +{Math.round(m.mult * 100)}% sur la valeur de toutes les pièces
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (isOwned || money < m.cost) return;
                          setMoney((prev) => prev - m.cost);
                          setMetrologyOwned((prev) => [...prev, m.id]);
                          showToast(`${m.name} acquis pour le laboratoire qualité !`, 'success');
                        }}
                        disabled={isOwned || !canBuy}
                        className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 ${
                          isOwned
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : canBuy
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isOwned ? 'Certifié' : formatMoney(m.cost)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Appels d'Offres Industriels & Contrats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div>
                <h2 className="text-lg font-black text-white uppercase flex items-center gap-2">
                  <Briefcase className="w-6 h-6 text-amber-400" /> Appels d'Offres & Contrats Clients
                </h2>
                <p className="text-xs text-slate-400">
                  Lancez une série prioritaire pour multiplier temporairement votre cadence et toucher une prime de livraison à la fin du compte à rebours.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {CONTRACTS_LIST.map((c) => {
                  const isRunning = activeContract && activeContract.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-xl border ${
                        isRunning ? 'bg-emerald-950/30 border-emerald-400' : 'bg-slate-950 border-slate-800'
                      } flex flex-col justify-between gap-3`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {c.badge} • Client : {c.client}
                          </span>
                          <h4 className="text-sm font-black text-white mt-1">{c.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Durée : {c.duration}s • Cadence pendant contrat :{' '}
                            <strong className="text-emerald-400">x{c.mult}</strong>
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (activeContract) {
                              showToast('Un contrat est déjà en cours d’usinage !', 'error');
                              return;
                            }
                            setActiveContract({ ...c, timeLeft: c.duration });
                            showToast(`Contrat "${c.title}" démarré !`, 'success');
                          }}
                          disabled={!!activeContract}
                          className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 ${
                            isRunning
                              ? 'bg-emerald-500 text-slate-950'
                              : activeContract
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                          }`}
                        >
                          {isRunning ? `En cours (${activeContract.timeLeft}s)` : 'Signer Contrat'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ONGLET 6 : CLASSEMENT GÉNÉRAL TEMPS RÉEL
        ========================================== */}
        {activeTab === 'leaderboard' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-black text-white uppercase flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" /> Classement Mondial des Ateliers d'Usinage
                </h2>
                <p className="text-xs text-slate-400">
                  Classement en temps réel basé sur la cadence de génération d'argent par seconde ($/s).
                </p>
              </div>
              <div className="flex items-center gap-2">
                {account.isLogged ? (
                  <button
                    onClick={() => {
                      saveProgressToCloud();
                      showToast('Score synchronisé avec le Classement Général !', 'success');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" /> Actualiser mon Score
                  </button>
                ) : (
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" /> Enregistrer mon Pseudo au Classement
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                    <th className="py-3 px-3">Rang</th>
                    <th className="py-3 px-3">Chef d'Atelier (Pseudo)</th>
                    <th className="py-3 px-3">Cadence ($/sec)</th>
                    <th className="py-3 px-3">Chiffre d'Affaires Total</th>
                    <th className="py-3 px-3">Infrastructure</th>
                    <th className="py-3 px-3">Parc CNC / Équipe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs sm:text-sm">
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Aucun atelier enregistré pour le moment. Connectez-vous pour prendre la 1ère place !
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((row, idx) => {
                      const isMe = account.isLogged && row.id === account.accountKey;
                      const tierObj = WORKSHOP_TIERS.find((t) => t.level === row.workshopLevel) || WORKSHOP_TIERS[0];
                      return (
                        <tr
                          key={row.id}
                          className={`${
                            isMe ? 'bg-amber-500/15 font-bold' : 'hover:bg-slate-950/60'
                          } transition`}
                        >
                          <td className="py-3 px-3 font-mono">
                            {idx === 0 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black">🥇 #1</span>
                            ) : idx === 1 ? (
                              <span className="px-2 py-0.5 rounded bg-slate-300 text-slate-950 font-black">🥈 #2</span>
                            ) : idx === 2 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-700 text-white font-black">🥉 #3</span>
                            ) : (
                              <span className="text-slate-400">#{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-white flex items-center gap-2">
                            <span>{row.pseudo}</span>
                            {isMe && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">
                                VOUS
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-cyan-300">
                            +{formatMoney(row.incomePerSec || 0)}/s
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-400">
                            {formatMoney(row.totalEarned || 0)}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-300">
                            Niv.{row.workshopLevel || 1} ({tierObj.name})
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-slate-400">
                            {row.machinesCount || 1} machines • {row.employeesCount || 1} opérateurs
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
