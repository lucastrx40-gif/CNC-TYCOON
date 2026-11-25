import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import {
  Settings, Cpu, Users, Package, Map, ArrowUpCircle, Zap, Trophy, Factory,
  UserCheck, Lock, Check, LogIn, LogOut, RefreshCw, Sparkles, Image as ImageIcon,
  AlertCircle, Cloud, RotateCcw, Play, Pause, Boxes, Microscope, GitBranch,
  Briefcase, Award, TrendingUp, ShoppingCart, ShieldCheck, AlertTriangle,
  Recycle, Wrench, CheckCircle2, Clock, Target, Sliders, Layers, FileCheck,
  ChevronRight, Plus, Minus, BarChart3
} from 'lucide-react';

// ============================================================================
// MODULE 0 : CONFIGURATION FIREBASE & UTILITAIRES GLOBAUX
// ============================================================================
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdGM5WTpuxrz7VNkRXqPPXz9LxDsPQia0",
  authDomain: "cnc-tycoon-gmp.firebaseapp.com",
  projectId: "cnc-tycoon-gmp",
  storageBucket: "cnc-tycoon-gmp.firebasestorage.app",
  messagingSenderId: "907776837224",
  appId: "1:907776837224:web:95ffba314b7a28ecc59ddd",
  measurementId: "G-4NW1GH3ERT"
};

let firebaseApp = null;
let auth = null;
let db = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cnc-empire-v1';

try {
  const activeConfig = (typeof __firebase_config !== 'undefined' && __firebase_config)
    ? JSON.parse(__firebase_config)
    : YOUR_FIREBASE_CONFIG;
  firebaseApp = !getApps().length ? initializeApp(activeConfig) : getApps()[0];
  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
} catch (e) {
  console.warn("Firebase initialisé en mode dégradé :", e);
}

const SAVE_VERSION = 2;
const MAX_OFFLINE_SECONDS = 7200; // Plafond hors-ligne configurable : 2 heures max

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const formatMoney = (num) => {
  if (num === undefined || num === null || isNaN(num)) return '0 €';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs < 10) return `${sign}${abs.toFixed(2)} €`;
  if (abs < 1000) return `${sign}${Math.round(abs)} €`;
  const suffixes = ['', 'k', 'M', 'Md', 'T'];
  const tier = Math.floor(Math.log10(abs) / 3);
  const idx = Math.min(tier, suffixes.length - 1);
  const scale = Math.pow(10, idx * 3);
  return `${sign}${(abs / scale).toFixed(2)} ${suffixes[idx]}€`;
};

const formatWeight = (kg) => {
  if (!kg || kg <= 0) return '0 g';
  if (kg < 1) return `${Math.round(kg * 1000)} g`;
  if (kg < 100) return `${kg.toFixed(2)} kg`;
  return `${Math.round(kg)} kg`;
};

const formatDuration = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem.toString().padStart(2, '0')}s` : `${rem}s`;
};

const cleanKey = (str) => (str || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

// ============================================================================
// MODULE 1 : MATIÈRES PREMIÈRES (DONNÉES CENTRALISÉES)
// ============================================================================
const MATERIALS_CATALOG = [
  {
    id: 'alu',
    name: 'Aluminium 6061',
    short: 'Alu 6061',
    pricePerKg: 6,
    unit: 'kg',
    color: '#38bdf8',
    machinability: 4, // Bonus de facilité d'usinage sur la qualité
    reqTech: null,
    desc: 'Léger, facile à usiner. Idéal pour démarrer les séries.'
  },
  {
    id: 'steel',
    name: 'Acier C45',
    short: 'Acier C45',
    pricePerKg: 8,
    unit: 'kg',
    color: '#94a3b8',
    machinability: 0,
    reqTech: null,
    desc: 'Acier mécanique polyvalent pour axes, brides et arbres.'
  },
  {
    id: 'plastic',
    name: 'Plastique POM / PEEK',
    short: 'POM Tech',
    pricePerKg: 15,
    unit: 'kg',
    color: '#a78bfa',
    machinability: 6,
    reqTech: 'mat_plastics',
    desc: 'Polymère haute stabilité dimensionnelle, coupe rapide.'
  },
  {
    id: 'inox',
    name: 'Inox 316L',
    short: 'Inox 316L',
    pricePerKg: 24,
    unit: 'kg',
    color: '#2dd4bf',
    machinability: -5,
    reqTech: 'mat_inox',
    desc: 'Résistant à la corrosion mais exigeant en arrosage et rigidité.'
  },
  {
    id: 'copper',
    name: 'Cuivre / Laiton C360',
    short: 'Cuivre',
    pricePerKg: 32,
    unit: 'kg',
    color: '#f59e0b',
    machinability: 2,
    reqTech: 'mat_copper',
    desc: 'Composants électriques, thermiques et connectique de précision.'
  },
  {
    id: 'titanium',
    name: 'Titane Ti-6Al-4V',
    short: 'Titane Aéro',
    pricePerKg: 95,
    unit: 'kg',
    color: '#fb7185',
    machinability: -10,
    reqTech: 'mat_titanium',
    desc: 'Alliage aéronautique à très forte valeur ajoutée, tolérances serrées.'
  }
];

// ============================================================================
// MODULE 2 : CATALOGUE DES PIÈCES & GAMMES MULTI-OPÉRATIONS EXTENSIBLES
// ============================================================================
const PARTS_CATALOG = [
  {
    id: 'spacer',
    name: 'Entretoise Usinée',
    category: 'Tournage / Débit',
    materialId: 'alu',
    materialKg: 0.15,
    baseCycleTime: 6,
    baseValue: 18,
    difficulty: 1,
    precisionReq: 45,
    minQuality: 55,
    compatibleMachines: ['drill_saw', 'lathe_conv', 'lathe_sub'],
    reqTech: null,
    routing: [{ step: 1, op: 'Débit & Perçage', machineTypes: ['drill_saw', 'lathe_conv', 'lathe_sub'], ratio: 1.0 }]
  },
  {
    id: 'shaft',
    name: 'Axe de Transmission',
    category: 'Tournage',
    materialId: 'steel',
    materialKg: 0.35,
    baseCycleTime: 10,
    baseValue: 42,
    difficulty: 2,
    precisionReq: 58,
    minQuality: 62,
    compatibleMachines: ['lathe_conv', 'lathe_sub'],
    reqTech: null,
    routing: [{ step: 1, op: 'Tournage cylindrique', machineTypes: ['lathe_conv', 'lathe_sub'], ratio: 1.0 }]
  },
  {
    id: 'bracket',
    name: 'Support Mécanique',
    category: 'Fraisage',
    materialId: 'alu',
    materialKg: 0.40,
    baseCycleTime: 11,
    baseValue: 64,
    difficulty: 2,
    precisionReq: 62,
    minQuality: 66,
    compatibleMachines: ['drill_saw', 'mill_3axis', 'mill_5axis'],
    reqTech: null,
    routing: [{ step: 1, op: 'Fraisage & Perçage', machineTypes: ['drill_saw', 'mill_3axis', 'mill_5axis'], ratio: 1.0 }]
  },
  {
    id: 'bushing',
    name: 'Bague de Guidage',
    category: 'Tournage Précis',
    materialId: 'steel',
    materialKg: 0.25,
    baseCycleTime: 9,
    baseValue: 76,
    difficulty: 3,
    precisionReq: 70,
    minQuality: 72,
    compatibleMachines: ['lathe_conv', 'lathe_sub'],
    reqTech: 'prod_cnc',
    routing: [{ step: 1, op: 'Alésage & Finition CN', machineTypes: ['lathe_conv', 'lathe_sub'], ratio: 1.0 }]
  },
  {
    id: 'pulley',
    name: 'Poulie Crantée',
    category: 'Polymère Technique',
    materialId: 'plastic',
    materialKg: 0.22,
    baseCycleTime: 9,
    baseValue: 95,
    difficulty: 3,
    precisionReq: 68,
    minQuality: 70,
    compatibleMachines: ['mill_3axis', 'lathe_sub', 'mill_5axis'],
    reqTech: 'mat_plastics',
    routing: [{ step: 1, op: 'Taillage CNC', machineTypes: ['mill_3axis', 'lathe_sub', 'mill_5axis'], ratio: 1.0 }]
  },
  {
    id: 'flange',
    name: 'Bride Hydraulique',
    category: 'Usinage Combiné',
    materialId: 'steel',
    materialKg: 0.60,
    baseCycleTime: 14,
    baseValue: 135,
    difficulty: 4,
    precisionReq: 74,
    minQuality: 75,
    compatibleMachines: ['mill_3axis', 'lathe_sub', 'mill_5axis'],
    reqTech: 'prod_3axis',
    routing: [{ step: 1, op: 'Fraisage CN 3 Axes', machineTypes: ['mill_3axis', 'lathe_sub', 'mill_5axis'], ratio: 1.0 }]
  },
  {
    id: 'gear',
    name: 'Engrenage Inox',
    category: 'Mécanique de Précision',
    materialId: 'inox',
    materialKg: 0.50,
    baseCycleTime: 17,
    baseValue: 265,
    difficulty: 5,
    precisionReq: 80,
    minQuality: 80,
    compatibleMachines: ['mill_3axis', 'mill_5axis', 'edm_wire'],
    reqTech: 'mat_inox',
    routing: [{ step: 1, op: 'Taillage Haute Précision', machineTypes: ['mill_3axis', 'mill_5axis', 'edm_wire'], ratio: 1.0 }]
  },
  {
    id: 'connector',
    name: 'Collecteur Thermique',
    category: 'Haute Conductivité',
    materialId: 'copper',
    materialKg: 0.35,
    baseCycleTime: 15,
    baseValue: 340,
    difficulty: 5,
    precisionReq: 84,
    minQuality: 82,
    compatibleMachines: ['lathe_sub', 'mill_5axis', 'edm_wire'],
    reqTech: 'mat_copper',
    routing: [{ step: 1, op: 'Découpe Fil / Micro-usinage', machineTypes: ['lathe_sub', 'mill_5axis', 'edm_wire'], ratio: 1.0 }]
  },
  {
    id: 'housing',
    name: 'Carter de Réducteur',
    category: 'Usinage 5 Axes',
    materialId: 'inox',
    materialKg: 0.90,
    baseCycleTime: 22,
    baseValue: 590,
    difficulty: 6,
    precisionReq: 86,
    minQuality: 85,
    compatibleMachines: ['mill_5axis', 'aero_cell'],
    reqTech: 'prod_5axis',
    routing: [{ step: 1, op: 'Fraisage 5 Axes Continu', machineTypes: ['mill_5axis', 'aero_cell'], ratio: 1.0 }]
  },
  {
    id: 'aero_strut',
    name: 'Support Structurel Aéro',
    category: 'Aéronautique',
    materialId: 'titanium',
    materialKg: 0.75,
    baseCycleTime: 26,
    baseValue: 1850,
    difficulty: 7,
    precisionReq: 91,
    minQuality: 89,
    compatibleMachines: ['mill_5axis', 'edm_wire', 'aero_cell'],
    reqTech: 'mat_titanium',
    routing: [{ step: 1, op: 'UGV Titane 5 Axes', machineTypes: ['mill_5axis', 'edm_wire', 'aero_cell'], ratio: 1.0 }]
  },
  {
    id: 'turbine_blade',
    name: 'Aube de Turbine HP',
    category: 'Spatial / Turbine',
    materialId: 'titanium',
    materialKg: 0.65,
    baseCycleTime: 30,
    baseValue: 3400,
    difficulty: 8,
    precisionReq: 95,
    minQuality: 92,
    compatibleMachines: ['aero_cell'],
    reqTech: 'auto_cells',
    routing: [{ step: 1, op: 'Cellule Robotisée UGV', machineTypes: ['aero_cell'], ratio: 1.0 }]
  }
];

// ============================================================================
// MODULE 3 : MACHINES DE PRODUCTION, MÉTROLOGIE & SUPPORT
// ============================================================================
const MACHINES_CATALOG = [
  {
    id: 'drill_saw',
    name: 'Scie & Perceuse Industrielle',
    category: 'Débit & Perçage',
    techLevel: 1,
    baseCost: 250,
    cycleMultiplier: 1.0,
    qtyPerCycle: 2,
    baseQuality: 65,
    basePrecision: 56,
    opCostPerCycle: 1,
    compatibleMaterials: ['alu', 'steel', 'plastic'],
    reqTech: null,
    color: '#475569',
    pros: 'Très rapide en débit x2, coût quasi nul',
    cons: 'Précision limitée aux pièces simples'
  },
  {
    id: 'lathe_conv',
    name: 'Tour Conventionnel',
    category: 'Tournage Manuel',
    techLevel: 1,
    baseCost: 850,
    cycleMultiplier: 1.0,
    qtyPerCycle: 1,
    baseQuality: 73,
    basePrecision: 68,
    opCostPerCycle: 2,
    compatibleMaterials: ['alu', 'steel', 'plastic', 'copper'],
    reqTech: null,
    color: '#047857',
    pros: 'Polyvalent en tournage, bonne finition de base',
    cons: '1 pièce par cycle'
  },
  {
    id: 'mill_3axis',
    name: 'Centre d\'Usinage 3 Axes',
    category: 'Fraisage CNC',
    techLevel: 2,
    baseCost: 3800,
    cycleMultiplier: 0.90,
    qtyPerCycle: 2,
    baseQuality: 80,
    basePrecision: 77,
    opCostPerCycle: 6,
    compatibleMaterials: ['alu', 'steel', 'plastic', 'inox', 'copper'],
    reqTech: 'prod_3axis',
    color: '#2563eb',
    pros: 'Pilier polyvalent du fraisage CNC (x2/cycle)',
    cons: 'Ne réalise pas les pièces 5 axes complexes'
  },
  {
    id: 'lathe_sub',
    name: 'Tour CNC Bi-Broche',
    category: 'Tournage CNC',
    techLevel: 3,
    baseCost: 12500,
    cycleMultiplier: 0.72,
    qtyPerCycle: 3,
    baseQuality: 85,
    basePrecision: 84,
    opCostPerCycle: 14,
    compatibleMaterials: ['alu', 'steel', 'plastic', 'inox', 'copper'],
    reqTech: 'prod_cnc',
    color: '#4f46e5',
    pros: 'Cadence très élevée (3 pièces/cycle) & haute précision',
    cons: 'Spécialisé pièces de révolution'
  },
  {
    id: 'mill_5axis',
    name: 'Centre 5 Axes UGV',
    category: 'Usinage Complexe',
    techLevel: 4,
    baseCost: 52000,
    cycleMultiplier: 0.85,
    qtyPerCycle: 2,
    baseQuality: 91,
    basePrecision: 92,
    opCostPerCycle: 38,
    compatibleMaterials: ['alu', 'steel', 'plastic', 'inox', 'copper', 'titanium'],
    reqTech: 'prod_5axis',
    color: '#9333ea',
    pros: 'Compatible Titane & pièces complexes aéronautiques',
    cons: 'Coût d\'acquisition et d\'exploitation élevé'
  },
  {
    id: 'edm_wire',
    name: 'Électroérosion à Fil (EDM)',
    category: 'Procédé Spécial',
    techLevel: 5,
    baseCost: 135000,
    cycleMultiplier: 0.95,
    qtyPerCycle: 2,
    baseQuality: 95,
    basePrecision: 97,
    opCostPerCycle: 65,
    compatibleMaterials: ['steel', 'inox', 'copper', 'titanium'],
    reqTech: 'prod_complex',
    color: '#d97706',
    pros: 'Précision micrométrique inégalée sur métaux durs',
    cons: 'Cycle plus lent, réservé aux matériaux conducteurs'
  },
  {
    id: 'aero_cell',
    name: 'Cellule Robotisée Titane',
    category: 'Automatisation Ultime',
    techLevel: 6,
    baseCost: 390000,
    cycleMultiplier: 0.65,
    qtyPerCycle: 4,
    baseQuality: 96,
    basePrecision: 98,
    opCostPerCycle: 145,
    compatibleMaterials: ['alu', 'steel', 'plastic', 'inox', 'copper', 'titanium'],
    reqTech: 'auto_cells',
    color: '#e11d48',
    pros: 'Production en série x4 en qualité Aéronautique / Spatial',
    cons: 'Investissement lourd et consommation matière massive'
  }
];

const METROLOGY_CATALOG = [
  {
    id: 'caliper_dig',
    name: 'Pied à Coulisse Numérique',
    cost: 450,
    detectionRate: 0.65,
    maxMeasurablePrecision: 70,
    processFeedbackBonus: 0,
    autoInspect: false,
    reqTech: null,
    desc: 'Permet le contrôle dimensionnel manuel des premiers lots (détection 65%).'
  },
  {
    id: 'micrometer',
    name: 'Micromètre & Tampons',
    cost: 2200,
    detectionRate: 0.78,
    maxMeasurablePrecision: 80,
    processFeedbackBonus: 2,
    autoInspect: false,
    reqTech: 'metro_manual',
    desc: 'Contrôle précis au centième. Améliore les réglages suivants (+2 Qualité/Précision).'
  },
  {
    id: 'height_gauge',
    name: 'Colonne de Mesure Numérique',
    cost: 9500,
    detectionRate: 0.88,
    maxMeasurablePrecision: 88,
    processFeedbackBonus: 4,
    autoInspect: false,
    reqTech: 'metro_column',
    desc: 'Mesure rapide sur marbre granit. Correction SPC (+4 Qualité/Précision).'
  },
  {
    id: 'profile_proj',
    name: 'Projecteur de Profil Optique',
    cost: 34000,
    detectionRate: 0.94,
    maxMeasurablePrecision: 93,
    processFeedbackBonus: 6,
    autoInspect: false,
    reqTech: 'metro_advanced',
    desc: 'Requis pour la certification ISO 9001. Détection 94% (+6 stabilité procédé).'
  },
  {
    id: 'cmm_3d',
    name: 'Machine Tridimensionnelle (MMT)',
    cost: 115000,
    detectionRate: 0.985,
    maxMeasurablePrecision: 98,
    processFeedbackBonus: 8,
    autoInspect: false,
    reqTech: 'metro_cmm',
    desc: 'Requis pour la certification EN 9100 Aéronautique. Palpage 3D au micron.'
  },
  {
    id: 'opt_scanner',
    name: 'Scanner Optique Automatisé',
    cost: 290000,
    detectionRate: 0.998,
    maxMeasurablePrecision: 100,
    processFeedbackBonus: 10,
    autoInspect: true,
    reqTech: 'metro_auto',
    desc: 'Contrôle 100% automatisé à la sortie de chaque cycle CNC (+10 procédé).'
  }
];

const SUPPORT_CATALOG = [
  {
    id: 'coolant_sys',
    name: 'Centrale Lubrification & Filtration',
    cost: 2400,
    cycleBonus: 0.05,
    qualityBonus: 4,
    precisionBonus: 2,
    opCostReduction: 0.15,
    reqTech: null,
    desc: '+4 Qualité, +2 Précision, -15% coût d\'exploitation sur tout le parc.'
  },
  {
    id: 'tool_presetter',
    name: 'Banc de Préréglage & Magasin Outils',
    cost: 14000,
    cycleBonus: 0.12,
    qualityBonus: 3,
    precisionBonus: 4,
    opCostReduction: 0.10,
    reqTech: 'meth_tools',
    desc: 'Réduit les temps de changement d\'outil (-12% cycle) et +4 Précision.'
  },
  {
    id: 'crane',
    name: 'Pont Roulant 10T',
    cost: 38000,
    cycleBonus: 0.15,
    qualityBonus: 1,
    precisionBonus: 0,
    opCostReduction: 0,
    reqTech: 'meth_flow',
    desc: 'Manutention rapide des bruts lourds (-15% cycle). Visible animé sur le Plan 2D.'
  },
  {
    id: 'conveyor',
    name: 'Convoyeur & Évacuateur Automatique',
    cost: 85000,
    cycleBonus: 0.15,
    qualityBonus: 2,
    precisionBonus: 1,
    opCostReduction: 0.10,
    reqTech: 'auto_conveyor',
    desc: 'Fluidifie les flux atelier (-15% temps de cycle, +2 Qualité).'
  },
  {
    id: 'agv',
    name: 'Flotte Robots AGV Logistique',
    cost: 210000,
    cycleBonus: 0.22,
    qualityBonus: 2,
    precisionBonus: 2,
    opCostReduction: 0.12,
    reqTech: 'auto_robots',
    desc: 'Logistique autonome entre magasin et îlots (-22% cycle). Visible sur le Plan 2D.'
  }
];

const ATELIER_UPGRADES = {
  sizes: [
    { level: 1, name: 'Garage d\'Usinage', slots: 4, cost: 0 },
    { level: 2, name: 'Atelier PME', slots: 8, cost: 18000 },
    { level: 3, name: 'Usine Aéronautique', slots: 12, cost: 120000 },
    { level: 4, name: 'Gigafactory 4.0', slots: 16, cost: 650000 }
  ],
  floors: [
    { id: 'beton', name: 'Dalle Béton Brut', cost: 0, qualBonus: 0, precBonus: 0, color: '#1e293b' },
    { id: 'resine', name: 'Résine Époxy Antistatique (+2 Qual/Préc)', cost: 24000, qualBonus: 2, precBonus: 2, color: '#0c4a6e' },
    { id: 'carbone', name: 'Dalle Stabilisée ISO (+5 Qual/Préc)', cost: 180000, qualBonus: 5, precBonus: 5, color: '#090d16' }
  ]
};

// ============================================================================
// MODULE 4 : ARBRE TECHNOLOGIQUE INDUSTRIEL (6 BRANCHES, 24 TECHNOLOGIES)
// ============================================================================
const TECH_BRANCHES = [
  { id: 'production', name: 'Production', color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' },
  { id: 'metrology', name: 'Métrologie', color: 'text-cyan-400', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10' },
  { id: 'quality', name: 'Qualité & Normes', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
  { id: 'methods', name: 'Méthodes', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
  { id: 'automation', name: 'Automatisation', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
  { id: 'materials', name: 'Matériaux', color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/10' }
];

const TECH_TREE = [
  // Branche 1 : Production
  { id: 'prod_3axis', branch: 'production', name: 'Fraisage CNC 3 Axes', costMoney: 1500, costRP: 10, prereqs: [], unlocks: 'Centre 3 Axes, Bride Hydraulique', effects: { cycleSpeed: 0.05 }, desc: 'Débloque les centres d\'usinage 3 axes et le fraisage de série.' },
  { id: 'prod_cnc', branch: 'production', name: 'Tournage CN Bi-Broche', costMoney: 5500, costRP: 35, prereqs: ['prod_3axis'], unlocks: 'Tour CNC Bi-Broche, Bague de Guidage', effects: { cycleSpeed: 0.06 }, desc: 'Passe au tournage numérique multi-pièces haute cadence.' },
  { id: 'prod_5axis', branch: 'production', name: 'Usinage 5 Axes UGV', costMoney: 26000, costRP: 95, prereqs: ['prod_cnc'], unlocks: 'Centre 5 Axes UGV, Carter Réducteur', effects: { precision: 3 }, desc: 'Usinage continu sur 5 axes simultanés pour géométries complexes.' },
  { id: 'prod_complex', branch: 'production', name: 'Électroérosion & Procédés', costMoney: 75000, costRP: 210, prereqs: ['prod_5axis'], unlocks: 'Électroérosion à Fil (EDM)', effects: { quality: 3, precision: 4 }, desc: 'Maîtrise de la découpe par étincelage haute précision.' },

  // Branche 2 : Métrologie
  { id: 'metro_manual', branch: 'metrology', name: 'Contrôle Dimensionnel Fin', costMoney: 900, costRP: 8, prereqs: [], unlocks: 'Micromètre & Tampons', effects: { precision: 2 }, desc: 'Débloque le micromètre et les mesures au centième.' },
  { id: 'metro_column', branch: 'metrology', name: 'Métrologie sur Marbre', costMoney: 4200, costRP: 30, prereqs: ['metro_manual'], unlocks: 'Colonne de Mesure Numérique', effects: { precision: 3 }, desc: 'Contrôle de hauteur et perpendicularité sur marbre granit.' },
  { id: 'metro_advanced', branch: 'metrology', name: 'Métrologie Optique', costMoney: 18000, costRP: 80, prereqs: ['metro_column'], unlocks: 'Projecteur de Profil Optique', effects: { quality: 2, precision: 3 }, desc: 'Analyse optique sans contact des profils critiques.' },
  { id: 'metro_cmm', branch: 'metrology', name: 'Contrôle Tridimensionnel', costMoney: 62000, costRP: 180, prereqs: ['metro_advanced'], unlocks: 'Machine Tridimensionnelle (MMT)', effects: { precision: 5 }, desc: 'Indispensable pour certifier les lots Aéronautiques EN 9100.' },
  { id: 'metro_auto', branch: 'metrology', name: 'Inspection Automatisée 3D', costMoney: 160000, costRP: 380, prereqs: ['metro_cmm'], unlocks: 'Scanner Optique Automatisé', effects: { autoInspectUnlock: true, quality: 3 }, desc: 'Contrôle automatique de chaque lot dès la sortie de machine.' },

  // Branche 3 : Qualité & Normes
  { id: 'qual_basic', branch: 'quality', name: 'Procédures Qualité Atelier', costMoney: 1100, costRP: 10, prereqs: [], unlocks: 'Réduction des rebuts, +4 Qualité', effects: { quality: 4 }, desc: 'Standardise les fiches suiveuses et réduit les défauts de fabrication.' },
  { id: 'qual_spc', branch: 'quality', name: 'Maîtrise Statistique (SPC)', costMoney: 7500, costRP: 45, prereqs: ['qual_basic'], unlocks: 'Correction auto des dérives (+5 Qual/Préc)', effects: { quality: 5, precision: 4 }, desc: 'Exploite les données de métrologie pour corriger les procédés.' },
  { id: 'qual_iso9001', branch: 'quality', name: 'Certification ISO 9001', costMoney: 32000, costRP: 120, prereqs: ['qual_spc', 'metro_advanced'], unlocks: 'Certificat ISO 9001 (+10% prix vente, Contrats Niv.3)', effects: { certIso9001: true, priceBonus: 0.10 }, desc: 'Ouvre les appels d\'offres industriels exigeants et valorise vos pièces.' },
  { id: 'qual_en9100', branch: 'quality', name: 'Certification EN 9100 Aéro', costMoney: 145000, costRP: 340, prereqs: ['qual_iso9001', 'metro_cmm'], unlocks: 'Certificat EN 9100 (+15% prix vente, Marchés Aéro)', effects: { certEn9100: true, priceBonus: 0.15 }, desc: 'Accès aux contrats stratégiques Aéronautique & Spatial.' },

  // Branche 4 : Méthodes & Industrialisation
  { id: 'meth_setup', branch: 'methods', name: 'SMED & Réglages Rapides', costMoney: 1600, costRP: 12, prereqs: [], unlocks: '-10% temps de cycle global', effects: { cycleSpeed: 0.10 }, desc: 'Optimise les montages d\'usinage et réduit les temps morts.' },
  { id: 'meth_tools', branch: 'methods', name: 'Ingénierie Outils Carbure', costMoney: 6800, costRP: 40, prereqs: ['meth_setup'], unlocks: 'Banc de Préréglage, -15% coûts op.', effects: { opCostReduction: 0.15, quality: 2 }, desc: 'Débloque le banc de préréglage et allonge la durée de vie des fraises.' },
  { id: 'meth_flow', branch: 'methods', name: 'Flux Tirés & Manutention', costMoney: 22000, costRP: 90, prereqs: ['meth_tools'], unlocks: 'Pont Roulant 10T, Réappro Auto Matières', effects: { autoRestockUnlock: true, cycleSpeed: 0.08 }, desc: 'Débloque le réapprovisionnement automatique des matières premières.' },
  { id: 'meth_lean', branch: 'methods', name: 'Usine Lean 4.0', costMoney: 92000, costRP: 240, prereqs: ['meth_flow'], unlocks: '-15% coût matières, +12% cadence', effects: { materialSave: 0.15, cycleSpeed: 0.12 }, desc: 'Optimisation des chutes matières et industrialisation avancée.' },

  // Branche 5 : Automatisation
  { id: 'auto_semi', branch: 'automation', name: 'Commercialisation Automatisée', costMoney: 1400, costRP: 10, prereqs: [], unlocks: 'Règles de Vente Automatique avancées', effects: { autoSellBonus: true }, desc: 'Configure des seuils de stock minimum et automatise vos expéditions.' },
  { id: 'auto_conveyor', branch: 'automation', name: 'Convoyage Inter-Îlots', costMoney: 35000, costRP: 110, prereqs: ['auto_semi', 'meth_flow'], unlocks: 'Convoyeur Automatique', effects: { cycleSpeed: 0.08 }, desc: 'Débloque les convoyeurs automatisés entre les centres CNC.' },
  { id: 'auto_robots', branch: 'automation', name: 'Robotique Mobile AGV', costMoney: 110000, costRP: 260, prereqs: ['auto_conveyor'], unlocks: 'Flotte Robots AGV Logistique', effects: { cycleSpeed: 0.10, quality: 2 }, desc: 'Alimente les îlots en autonomie complète.' },
  { id: 'auto_cells', branch: 'automation', name: 'Cellules Robotisées 24/7', costMoney: 230000, costRP: 460, prereqs: ['auto_robots', 'prod_5axis'], unlocks: 'Cellule Robotisée Titane, Aube de Turbine HP', effects: { cycleSpeed: 0.12, precision: 3 }, desc: 'Sommet de l\'automatisation manufacturière sans surveillance.' },

  // Branche 6 : Matériaux & Procédés
  { id: 'mat_plastics', branch: 'materials', name: 'Polymères Techniques', costMoney: 2200, costRP: 18, prereqs: [], unlocks: 'Plastique POM/PEEK, Poulie Crantée', effects: {}, desc: 'Usinage rapide des polymères techniques à haute marge.' },
  { id: 'mat_inox', branch: 'materials', name: 'Métallurgie Inox 316L', costMoney: 9800, costRP: 55, prereqs: ['mat_plastics', 'prod_3axis'], unlocks: 'Inox 316L, Engrenage Inox', effects: { quality: 2 }, desc: 'Maîtrise de la coupe des aciers inoxydables.' },
  { id: 'mat_copper', branch: 'materials', name: 'Alliages Cuivreux', costMoney: 24000, costRP: 105, prereqs: ['mat_inox'], unlocks: 'Cuivre C360, Collecteur Thermique', effects: { precision: 2 }, desc: 'Usinage des pièces de conduction thermique et électronique.' },
  { id: 'mat_titanium', branch: 'materials', name: 'Titane Aéronautique', costMoney: 88000, costRP: 230, prereqs: ['mat_copper', 'prod_5axis'], unlocks: 'Titane Ti-6Al-4V, Support Structurel Aéro', effects: { quality: 3 }, desc: 'Ouvre la fabrication des pièces critiques en titane.' }
];

// ============================================================================
// MODULE 5 : PERSONNEL SPÉCIALISTE (PRÉSERVATION DES 12 PERSONNAGES & AVATARS)
// Les cartes n'inventent plus d'argent magique : elles améliorent la VITESSE,
// la QUALITÉ et la PRÉCISION réelles de la machine sur laquelle elles travaillent !
// ============================================================================
const RARITY_META = {
  COMMON: { label: 'Commun', gradient: 'from-slate-500 via-slate-600 to-slate-800', text: 'text-slate-300', glow: '#94a3b8', foil: false },
  RARE: { label: 'Rare', gradient: 'from-cyan-400 via-blue-600 to-indigo-900', text: 'text-cyan-300', glow: '#22d3ee', foil: false },
  EPIC: { label: 'Épique', gradient: 'from-fuchsia-500 via-purple-600 to-indigo-950', text: 'text-purple-300', glow: '#c084fc', foil: true },
  LEGENDARY: { label: 'Légendaire', gradient: 'from-yellow-300 via-amber-500 to-orange-700', text: 'text-amber-300', glow: '#fbbf24', foil: true },
  MYTHIC: { label: 'Mythique', gradient: 'from-rose-400 via-red-600 to-slate-950', text: 'text-rose-400', glow: '#f43f5e', foil: true }
};

const EMPLOYEES_CATALOG = [
  { id: 'emp_mst', name: 'Ms T', rarity: 'MYTHIC', specialty: 'ALL', specName: 'Toutes Machines', speedBonus: 0.35, qualBonus: 12, precBonus: 14, title: 'Directrice Métrologie ISO' },
  { id: 'emp_marty', name: 'Mme Marty', rarity: 'LEGENDARY', specialty: 'mill_5axis', specName: 'Centre 5 Axes', speedBonus: 0.28, qualBonus: 9, precBonus: 10, title: 'Experte UGV 5 Axes' },
  { id: 'emp_blanchard', name: 'Mr Blanchard', rarity: 'LEGENDARY', specialty: 'aero_cell', specName: 'Cellule Robotisée', speedBonus: 0.30, qualBonus: 8, precBonus: 10, title: 'Architecte Robotique' },
  { id: 'emp_graya', name: 'Mr Graya', rarity: 'LEGENDARY', specialty: 'edm_wire', specName: 'Électroérosion', speedBonus: 0.25, qualBonus: 10, precBonus: 11, title: 'Maître Électroérosion' },
  { id: 'emp_renaud', name: 'Mme Renaud', rarity: 'EPIC', specialty: 'mill_3axis', specName: 'Centre 3 Axes', speedBonus: 0.20, qualBonus: 6, precBonus: 7, title: 'Ingénieure FAO 3 Axes' },
  { id: 'emp_pietri', name: 'Mr Pietri', rarity: 'EPIC', specialty: 'lathe_sub', specName: 'Tour CNC', speedBonus: 0.22, qualBonus: 6, precBonus: 6, title: 'Spécialiste Bi-Broche' },
  { id: 'emp_pompidou', name: 'Pompidou', rarity: 'RARE', specialty: 'mill_3axis', specName: 'Centre 3 Axes', speedBonus: 0.14, qualBonus: 4, precBonus: 4, title: 'Régleur Fraiseur CN' },
  { id: 'emp_lauris', name: 'Lauris Rigal', rarity: 'RARE', specialty: 'lathe_conv', specName: 'Tour Conventionnel', speedBonus: 0.15, qualBonus: 5, precBonus: 4, title: 'Tourneur Précision' },
  { id: 'emp_pierre', name: 'Pierre Montant', rarity: 'RARE', specialty: 'drill_saw', specName: 'Scie & Perceuse', speedBonus: 0.16, qualBonus: 4, precBonus: 4, title: 'Chef Débit & Ajustage' },
  { id: 'emp_sebastien', name: 'Sebastien', rarity: 'RARE', specialty: 'lathe_sub', specName: 'Tour CNC', speedBonus: 0.15, qualBonus: 4, precBonus: 5, title: 'Opérateur Programmateur' },
  { id: 'emp_cedric', name: 'Cedric Castagnetti', rarity: 'COMMON', specialty: 'drill_saw', specName: 'Scie & Perceuse', speedBonus: 0.08, qualBonus: 2, precBonus: 2, title: 'Opérateur Atelier' },
  { id: 'emp_elliot', name: 'Elliot', rarity: 'COMMON', specialty: 'lathe_conv', specName: 'Tour Conventionnel', speedBonus: 0.08, qualBonus: 2, precBonus: 2, title: 'Apprenti Usineur' }
];

const CHEST_ODDS = { COMMON: 52, RARE: 30, EPIC: 12, LEGENDARY: 5, MYTHIC: 1 };
const AVATAR_SPRITE_POSITIONS = {
  emp_cedric:    { x: '0%',   y: '0%'   },
  emp_marty:     { x: '25%',  y: '0%'   },
  emp_lauris:    { x: '50%',  y: '0%'   },
  emp_elliot:    { x: '75%',  y: '0%'   },
  emp_blanchard: { x: '100%', y: '0%'   },
  emp_pompidou:  { x: '0%',   y: '100%' },
  emp_renaud:    { x: '25%',  y: '100%' },
  emp_pietri:    { x: '50%',  y: '100%' },
  emp_mst:       { x: '75%',  y: '100%' },
  emp_pierre:    { x: '100%', y: '100%' },
};

// ============================================================================
// MODULE 6 : MISSIONS DYNAMIQUES & GÉNÉRATEUR D'APPELS D'OFFRES
// ============================================================================
const MISSIONS_CATALOG = [
  // Missions Principales (guidage progressif)
  { id: 'm_first_machine', type: 'main', title: 'Premier Équipement', desc: 'Installez au moins 1 machine de production dans l\'atelier.', rewardMoney: 400, rewardRP: 10, rewardRep: 3, check: (s) => s.stats.machinesInstalled >= 1, progress: (s) => [Math.min(1, s.stats.machinesInstalled), 1] },
  { id: 'm_prod_20', type: 'main', title: 'Mise en Route Atelier', desc: 'Fabriquez 20 pièces mécaniques au total.', rewardMoney: 750, rewardRP: 15, rewardRep: 4, check: (s) => s.stats.totalPartsProduced >= 20, progress: (s) => [Math.min(20, s.stats.totalPartsProduced), 20] },
  { id: 'm_first_sale', type: 'main', title: 'Premières Facturations', desc: 'Réalisez 1 000 € de chiffre d\'affaires cumulé.', rewardMoney: 900, rewardRP: 18, rewardRep: 4, check: (s) => s.stats.totalRevenue >= 1000, progress: (s) => [Math.min(1000, Math.floor(s.stats.totalRevenue)), 1000] },
  { id: 'm_first_metro', type: 'main', title: 'Rigueur Métrologique', desc: 'Acquérez votre premier équipement de métrologie et contrôlez 10 pièces.', rewardMoney: 1500, rewardRP: 25, rewardRep: 6, check: (s) => s.metrology.length >= 1 && s.stats.totalInspected >= 10, progress: (s) => [Math.min(10, s.stats.totalInspected), 10] },
  { id: 'm_first_tech', type: 'main', title: 'Bureau R&D Actif', desc: 'Débloquez 2 compétences dans l\'Arbre Technologique.', rewardMoney: 2200, rewardRP: 30, rewardRep: 5, check: (s) => s.unlockedTechs.length >= 2, progress: (s) => [Math.min(2, s.unlockedTechs.length), 2] },
  { id: 'm_first_contract', type: 'main', title: 'Fournisseur Agréé', desc: 'Livrez et réussissez votre premier Appel d\'Offres client.', rewardMoney: 4500, rewardRP: 50, rewardRep: 10, check: (s) => s.stats.contractsCompleted >= 1, progress: (s) => [Math.min(1, s.stats.contractsCompleted), 1] },
  { id: 'm_prod_250', type: 'main', title: 'Production en Série', desc: 'Produisez 250 pièces cumulées dans votre usine.', rewardMoney: 9500, rewardRP: 80, rewardRep: 8, check: (s) => s.stats.totalPartsProduced >= 250, progress: (s) => [Math.min(250, s.stats.totalPartsProduced), 250] },
  { id: 'm_qual_90', type: 'main', title: 'Excellence Industrielle', desc: 'Produisez 40 pièces atteignant une qualité ≥ 90/100.', rewardMoney: 24000, rewardRP: 140, rewardRep: 12, check: (s) => s.stats.highQualityParts >= 40, progress: (s) => [Math.min(40, s.stats.highQualityParts), 40] },
  { id: 'm_iso9001', type: 'main', title: 'Cap ISO 9001', desc: 'Obtenez la certification ISO 9001 (Tech + Projecteur Optique).', rewardMoney: 55000, rewardRP: 200, rewardRep: 15, check: (s) => s.certs.iso9001, progress: (s) => [s.certs.iso9001 ? 1 : 0, 1] },
  { id: 'm_en9100', type: 'main', title: 'Fleuron Aéronautique', desc: 'Obtenez la certification EN 9100 et livrez 5 contrats.', rewardMoney: 180000, rewardRP: 450, rewardRep: 20, check: (s) => s.certs.en9100 && s.stats.contractsCompleted >= 5, progress: (s) => [Math.min(5, s.stats.contractsCompleted), 5] },

  // Missions Secondaires
  { id: 's_park_4', type: 'side', title: 'Atelier Complet', desc: 'Installez 4 machines de production simultanément.', rewardMoney: 3000, rewardRP: 35, rewardRep: 5, check: (s) => s.stats.machinesInstalled >= 4, progress: (s) => [Math.min(4, s.stats.machinesInstalled), 4] },
  { id: 's_rev_50k', type: 'side', title: 'PME Rentable', desc: 'Atteignez 50 000 € de chiffre d\'affaires cumulé.', rewardMoney: 12000, rewardRP: 95, rewardRep: 10, check: (s) => s.stats.totalRevenue >= 50000, progress: (s) => [Math.min(50000, Math.floor(s.stats.totalRevenue)), 50000] },
  { id: 's_materials_4', type: 'side', title: 'Multi-Matériaux', desc: 'Débloquez au moins 2 technologies de la branche Matériaux.', rewardMoney: 16000, rewardRP: 110, rewardRep: 8, check: (s) => s.unlockedTechs.filter(t => t.startsWith('mat_')).length >= 2, progress: (s) => [Math.min(2, s.unlockedTechs.filter(t => t.startsWith('mat_')).length), 2] }
];

const CLIENTS_POOL = [
  { id: 'c_local', name: 'Ateliers Aquitaine Méca', tier: 1, minRep: 0, badge: 'Régional' },
  { id: 'c_auto', name: 'MecaSud Automobile', tier: 2, minRep: 25, badge: 'Automobile' },
  { id: 'c_hydro', name: 'HydroTech Systèmes', tier: 3, minRep: 45, reqCert: 'iso9001', badge: 'ISO 9001' },
  { id: 'c_aero', name: 'AeroNova Industries', tier: 4, minRep: 70, reqCert: 'en9100', badge: 'EN 9100 Aéro' },
  { id: 'c_space', name: 'Ariane Propulsion Labs', tier: 5, minRep: 85, reqCert: 'en9100', badge: 'Spatial' }
];

// ============================================================================
// MODULE 7 : MOTEURS DE CALCUL CENTRALISÉS (QUALITÉ, ÉCONOMIE, CONTRATS, MIGRATION)
// Aucune formule métier n'est dispersée dans les composants UI.
// ============================================================================
const FactoryEngine = {
  /** Agrège les effets passifs de toutes les technologies débloquées */
  getTechEffects(unlockedTechs) {
    const res = {
      cycleSpeed: 0,
      quality: 0,
      precision: 0,
      opCostReduction: 0,
      materialSave: 0,
      priceBonus: 0,
      autoRestockUnlock: false,
      autoInspectUnlock: false,
      certIso9001: false,
      certEn9100: false
    };
    unlockedTechs.forEach(id => {
      const t = TECH_TREE.find(x => x.id === id);
      if (!t || !t.effects) return;
      if (t.effects.cycleSpeed) res.cycleSpeed += t.effects.cycleSpeed;
      if (t.effects.quality) res.quality += t.effects.quality;
      if (t.effects.precision) res.precision += t.effects.precision;
      if (t.effects.opCostReduction) res.opCostReduction += t.effects.opCostReduction;
      if (t.effects.materialSave) res.materialSave += t.effects.materialSave;
      if (t.effects.priceBonus) res.priceBonus += t.effects.priceBonus;
      if (t.effects.autoRestockUnlock) res.autoRestockUnlock = true;
      if (t.effects.autoInspectUnlock) res.autoInspectUnlock = true;
      if (t.effects.certIso9001) res.certIso9001 = true;
      if (t.effects.certEn9100) res.certEn9100 = true;
    });
    return res;
  },

  /** Agrège les capacités du laboratoire de métrologie */
  getMetrologyProfile(ownedMetrologyIds) {
    const owned = METROLOGY_CATALOG.filter(m => ownedMetrologyIds.includes(m.id));
    if (owned.length === 0) {
      return { detectionRate: 0, maxMeasurablePrecision: 0, processFeedbackBonus: 0, autoInspect: false, hasProjector: false, hasCMM: false };
    }
    const bestDetection = Math.max(...owned.map(m => m.detectionRate));
    const maxPrecision = Math.max(...owned.map(m => m.maxMeasurablePrecision));
    const bestFeedback = Math.max(...owned.map(m => m.processFeedbackBonus));
    const autoInspect = owned.some(m => m.autoInspect);
    return {
      detectionRate: bestDetection,
      maxMeasurablePrecision: maxPrecision,
      processFeedbackBonus: bestFeedback,
      autoInspect,
      hasProjector: ownedMetrologyIds.includes('profile_proj') || ownedMetrologyIds.includes('cmm_3d') || ownedMetrologyIds.includes('opt_scanner'),
      hasCMM: ownedMetrologyIds.includes('cmm_3d') || ownedMetrologyIds.includes('opt_scanner')
    };
  },

  /** Agrège les équipements de support & le revêtement de sol */
  getSupportProfile(ownedSupportIds, atelierFloorId) {
    const owned = SUPPORT_CATALOG.filter(s => ownedSupportIds.includes(s.id));
    const floor = ATELIER_UPGRADES.floors.find(f => f.id === atelierFloorId) || ATELIER_UPGRADES.floors[0];
    return {
      cycleBonus: owned.reduce((acc, s) => acc + s.cycleBonus, 0),
      qualityBonus: owned.reduce((acc, s) => acc + s.qualityBonus, 0) + (floor.qualBonus || 0),
      precisionBonus: owned.reduce((acc, s) => acc + s.precisionBonus, 0) + (floor.precBonus || 0),
      opCostReduction: Math.min(0.65, owned.reduce((acc, s) => acc + s.opCostReduction, 0))
    };
  },

  /** Calcule les certifications actives (exigent à la fois Tech + Métrologie réelle) */
  getCertifications(unlockedTechs, ownedMetrologyIds, reputation) {
    const techFx = this.getTechEffects(unlockedTechs);
    const metro = this.getMetrologyProfile(ownedMetrologyIds);
    const iso9001 = Boolean(techFx.certIso9001 && metro.hasProjector && (reputation.quality || 0) >= 40);
    const en9100 = Boolean(techFx.certEn9100 && metro.hasCMM && (reputation.quality || 0) >= 65);
    return { iso9001, en9100 };
  },

  /** Bonus réel d'un employé affecté sur une machine */
  getOperatorBonus(employeeRecord, machineId) {
    if (!employeeRecord) return { speed: 0, quality: 0, precision: 0, isSynergy: false, name: null };
    const tpl = EMPLOYEES_CATALOG.find(e => e.id === employeeRecord.templateId);
    if (!tpl) return { speed: 0, quality: 0, precision: 0, isSynergy: false, name: null };
    const stars = employeeRecord.stars || 1;
    const starScale = 1 + (stars - 1) * 0.25;
    const isSynergy = tpl.specialty === machineId || tpl.specialty === 'ALL';
    const synScale = isSynergy ? 1.5 : 1.0;
    return {
      speed: tpl.speedBonus * starScale * synScale,
      quality: Math.round(tpl.qualBonus * starScale * synScale),
      precision: Math.round(tpl.precBonus * starScale * synScale),
      isSynergy,
      name: tpl.name,
      stars
    };
  },

  /** Calcul transparent du temps de cycle, de la qualité et de la précision d'un poste */
  evaluateSlotProduction(slot, stateContext) {
    const mac = MACHINES_CATALOG.find(m => m.id === slot.machineId);
    const part = PARTS_CATALOG.find(p => p.id === slot.partId);
    if (!mac || !part) return null;

    const mat = MATERIALS_CATALOG.find(m => m.id === part.materialId);
    const empRec = slot.employeeId ? stateContext.inventory.find(e => e.uid === slot.employeeId) : null;
    const opBonus = this.getOperatorBonus(empRec, mac.id);
    const techFx = stateContext.techFx;
    const metro = stateContext.metro;
    const support = stateContext.support;

    // Temps de cycle effectif (en secondes)
    const speedFactor = 1 + techFx.cycleSpeed + support.cycleBonus + opBonus.speed;
    const cycleTime = Math.max(2.0, (part.baseCycleTime * mac.cycleMultiplier) / speedFactor);

    // Matière consommée par cycle (avec réduction Lean éventuelle)
    const qtyPerCycle = mac.qtyPerCycle;
    const matPerPiece = part.materialKg * (1 - techFx.materialSave);
    const materialCostPerCycle = qtyPerCycle * matPerPiece;

    // Coût de fonctionnement par cycle
    const opReduction = Math.min(0.75, techFx.opCostReduction + support.opCostReduction);
    const opCost = mac.opCostPerCycle * (1 - opReduction);
    const unitCost = (matPerPiece * (mat ? mat.pricePerKg : 6)) + (opCost / qtyPerCycle);

    // Qualité de fabrication réelle (0-100) — explicable facteur par facteur
    const diffPenalty = (part.difficulty - 1) * 2.5;
    const matMod = mat ? mat.machinability : 0;
    const processFeedback = techFx.quality > 0 ? metro.processFeedbackBonus : Math.floor(metro.processFeedbackBonus * 0.5);

    const rawQuality = mac.baseQuality + matMod - diffPenalty + techFx.quality + support.qualityBonus + opBonus.quality + processFeedback;
    const quality = clamp(Math.round(rawQuality), 25, 100);

    // Précision dimensionnelle distincte (0-100)
    const rawPrecision = mac.basePrecision - (part.difficulty - 1) * 2.0 + techFx.precision + support.precisionBonus + opBonus.precision + processFeedback;
    const precision = clamp(Math.round(rawPrecision), 25, 100);

    const isConforming = quality >= part.minQuality && precision >= part.precisionReq;

    return {
      mac,
      part,
      mat,
      qtyPerCycle,
      cycleTime,
      materialCostPerCycle,
      opCost,
      unitCost,
      quality,
      precision,
      isConforming,
      opBonus,
      breakdown: [
        { label: `Base ${mac.name}`, q: mac.baseQuality, p: mac.basePrecision },
        { label: `Matière & Difficulté`, q: Math.round(matMod - diffPenalty), p: Math.round(-(part.difficulty - 1) * 2) },
        { label: `Technologies & Support`, q: techFx.quality + support.qualityBonus, p: techFx.precision + support.precisionBonus },
        { label: `Rétroaction Métrologie`, q: processFeedback, p: processFeedback },
        ...(opBonus.name ? [{ label: `Opérateur ${opBonus.name}${opBonus.isSynergy ? ' (Synergie)' : ''}`, q: opBonus.quality, p: opBonus.precision }] : [])
      ]
    };
  },

  /** Prix unitaire de vente en fonction de la qualité, du statut, du marché et des certifications */
  computeUnitSalePrice(lot, marketDemand, certs, techFx) {
    const part = PARTS_CATALOG.find(p => p.id === lot.partId);
    if (!part) return 0;
    const demandMult = marketDemand[lot.partId] || 1.0;

    if (lot.status === 'non_conforming') {
      // Pièce non conforme vendue en déclassé à prix réduit (40%)
      return Math.max(1, part.baseValue * 0.40 * demandMult);
    }

    // Multiplicateur de qualité (de 0.75x à 1.40x)
    const qualityFactor = 0.70 + (lot.quality / 100) * 0.65;
    // Bonus de certification sur pièces contrôlées conformes
    let certBonus = 1.0;
    if (lot.status === 'conforming') {
      certBonus += 0.08; // Prime de traçabilité lot contrôlé
      if (certs.iso9001) certBonus += 0.10;
      if (certs.en9100) certBonus += 0.15;
    }
    return part.baseValue * qualityFactor * demandMult * certBonus * (1 + (techFx?.priceBonus || 0) * 0.25);
  },

  /** Ajoute ou fusionne un lot dans l'inventaire agrégé (évite les objets par pièce) */
  mergeBatchIntoLots(existingLots, newBatch) {
    // Regroupe par palier de 2 points de qualité/précision pour garder un inventaire propre et performant
    const qBucket = Math.round(newBatch.quality / 2) * 2;
    const pBucket = Math.round(newBatch.precision / 2) * 2;
    const idx = existingLots.findIndex(
      l => l.partId === newBatch.partId &&
           l.status === newBatch.status &&
           Math.abs(l.quality - qBucket) <= 2 &&
           Math.abs(l.precision - pBucket) <= 2
    );
    if (idx >= 0) {
      const next = [...existingLots];
      const cur = next[idx];
      const totalQty = cur.quantity + newBatch.quantity;
      next[idx] = {
        ...cur,
        quantity: totalQty,
        quality: Math.round((cur.quality * cur.quantity + newBatch.quality * newBatch.quantity) / totalQty),
        precision: Math.round((cur.precision * cur.quantity + newBatch.precision * newBatch.quantity) / totalQty),
        unitCost: (cur.unitCost * cur.quantity + newBatch.unitCost * newBatch.quantity) / totalQty
      };
      return next;
    }
    return [
      ...existingLots,
      {
        lotId: `lot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        partId: newBatch.partId,
        materialId: newBatch.materialId,
        quantity: newBatch.quantity,
        reserved: 0,
        quality: newBatch.quality,
        precision: newBatch.precision,
        unitCost: newBatch.unitCost,
        status: newBatch.status, // 'uninspected' | 'conforming' | 'non_conforming'
        actuallyConforming: newBatch.actuallyConforming,
        createdAt: Date.now()
      }
    ];
  },

  /** Génère des appels d'offres cohérents avec le niveau de l'entreprise */
  generateContract(unlockedTechs, repGlobal, certs) {
    const availableParts = PARTS_CATALOG.filter(p => !p.reqTech || unlockedTechs.includes(p.reqTech));
    const eligibleClients = CLIENTS_POOL.filter(c => {
      if (repGlobal < c.minRep - 15) return false;
      return true;
    });
    const client = eligibleClients[Math.floor(Math.random() * eligibleClients.length)] || CLIENTS_POOL[0];
    const part = availableParts[Math.floor(Math.random() * availableParts.length)] || PARTS_CATALOG[0];

    const qty = Math.round((12 + client.tier * 14 + Math.random() * 18) / 5) * 5;
    const minQuality = clamp(part.minQuality + (client.tier - 1) * 4, 55, 95);
    const minPrecision = clamp(part.precisionReq + (client.tier - 1) * 3, 45, 96);
    const deadlineSec = 240 + client.tier * 90; // 4 à 11.5 minutes de temps de jeu
    const unitReward = part.baseValue * (1.42 + client.tier * 0.14);
    const baseReward = Math.round(qty * unitReward);
    const rewardRP = Math.round(18 + client.tier * 22 + part.difficulty * 8);

    return {
      id: `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      clientName: client.name,
      clientBadge: client.badge,
      tier: client.tier,
      partId: part.id,
      materialId: part.materialId,
      quantity: qty,
      minQuality,
      minPrecision,
      reqCert: client.reqCert || null,
      minRep: client.minRep,
      deadlineSec,
      remainingSec: deadlineSec,
      baseReward,
      agreedReward: baseReward,
      rewardRP,
      bidType: 'standard',
      status: 'available', // 'available' | 'accepted' | 'completed' | 'expired'
      createdAt: Date.now()
    };
  },

  /** Migration versionnée v1 -> v2 : ne perd aucune donnée joueur existante */
  migrateSaveData(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // Déjà en version 2 : on assainit simplement les champs manquants sans re-migrer
    if (raw.saveVersion >= SAVE_VERSION) {
      const slots = Array(16).fill(null);
      if (Array.isArray(raw.slots)) {
        for (let i = 0; i < Math.min(16, raw.slots.length); i++) {
          slots[i] = raw.slots[i] ? {
            machineId: raw.slots[i].machineId,
            employeeId: raw.slots[i].employeeId || null,
            partId: raw.slots[i].partId || null,
            cycleProgress: Number(raw.slots[i].cycleProgress) || 0,
            paused: Boolean(raw.slots[i].paused)
          } : null;
        }
      }
      return {
        ...raw,
        saveVersion: SAVE_VERSION,
        money: Math.max(0, Number(raw.money) || 0),
        researchPoints: Math.max(0, Number(raw.researchPoints) || 0),
        materials: { alu: 0, steel: 0, plastic: 0, inox: 0, copper: 0, titanium: 0, ...(raw.materials || {}) },
        finishedLots: Array.isArray(raw.finishedLots) ? raw.finishedLots : [],
        slots,
        metrology: Array.isArray(raw.metrology) ? raw.metrology : [],
        support: Array.isArray(raw.support) ? raw.support : [],
        unlockedTechs: Array.isArray(raw.unlockedTechs) ? raw.unlockedTechs : [],
        autoSellRules: raw.autoSellRules || {},
        autoRestock: raw.autoRestock || {},
        contracts: Array.isArray(raw.contracts) ? raw.contracts : [],
        claimedMissions: Array.isArray(raw.claimedMissions) ? raw.claimedMissions : [],
        inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
        atelier: { sizeLevel: 1, floor: 'beton', ...(raw.atelier || {}) },
        reputation: { quality: 20, reliability: 20, innovation: 15, capacity: 15, delivery: 20, ...(raw.reputation || {}) },
        stats: {
          totalPartsProduced: 0, totalRevenue: 0, totalProfit: 0,
          totalInspected: 0, highQualityParts: 0, contractsCompleted: 0,
          contractsFailed: 0, ...(raw.stats || {})
        },
        lastActiveAt: Number(raw.lastActiveAt || raw.updatedAt) || Date.now(),
        wasMigrated: false
      };
    }

    // MIGRATION V1 -> V2 : Préservation de l'argent, des machines, des cartes et compensation juste
    const legacyMoney = Math.max(1200, Number(raw.money) || 0);
    const legacyClickLevel = Math.max(1, Number(raw.clickLevel) || 1);
    const legacyAtelier = raw.atelier || { sizeLevel: 1, floor: 'beton', crane: false, agv: false };

    const migratedSupport = [];
    if (legacyAtelier.crane) migratedSupport.push('crane');
    if (legacyAtelier.agv) migratedSupport.push('agv');

    const migratedTechs = new Set();
    const migratedSlots = Array(16).fill(null);

    if (Array.isArray(raw.slots)) {
      raw.slots.forEach((s, i) => {
        if (i < 16 && s && s.machineId && MACHINES_CATALOG.some(m => m.id === s.machineId)) {
          const mac = MACHINES_CATALOG.find(m => m.id === s.machineId);
          // Débloque la techno correspondante si le joueur possédait déjà la machine en v1
          if (mac.reqTech) migratedTechs.add(mac.reqTech);
          const defaultPart = PARTS_CATALOG.find(p => p.compatibleMachines.includes(mac.id))?.id || 'spacer';
          migratedSlots[i] = {
            machineId: mac.id,
            employeeId: s.employeeId || null,
            partId: defaultPart,
            cycleProgress: 0,
            paused: false
          };
        }
      });
    }

    // Compensation équitable en Points de Recherche & Matières pour l'ancien niveau de clic
    const compensationRP = 20 + (legacyClickLevel - 1) * 15;

    return {
      saveVersion: SAVE_VERSION,
      migratedFromV1: true,
      wasMigrated: true,
      pseudo: raw.pseudo || '',
      password: raw.password || '',
      money: legacyMoney,
      researchPoints: compensationRP,
      materials: { alu: 40, steel: 25, plastic: 0, inox: 0, copper: 0, titanium: 0 },
      finishedLots: [],
      slots: migratedSlots,
      metrology: [],
      support: migratedSupport,
      unlockedTechs: Array.from(migratedTechs),
      autoSellRules: {},
      autoRestock: {},
      contracts: [],
      claimedMissions: [],
      inventory: Array.isArray(raw.inventory) ? raw.inventory : [],
      atelier: { sizeLevel: legacyAtelier.sizeLevel || 1, floor: legacyAtelier.floor || 'beton' },
      reputation: { quality: 25, reliability: 25, innovation: 20, capacity: 25, delivery: 25 },
      stats: {
        totalPartsProduced: 0, totalRevenue: 0, totalProfit: 0,
        totalInspected: 0, highQualityParts: 0, contractsCompleted: 0, contractsFailed: 0
      },
      lastActiveAt: Date.now()
    };
  }
};

// ============================================================================
// MODULE 8 : COMPOSANTS D'ILLUSTRATION SVG (MACHINES, PORTRAITS 5x2 & CARTES)
// ============================================================================
const MachineIllustration = ({ id, animated = true, className = "w-full h-full" }) => {
  switch (id) {
    case 'drill_saw':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="12" y="64" width="96" height="16" rx="3" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          <path d="M 22 64 L 22 24 Q 22 16 32 16 L 52 16 Q 58 16 58 24 L 58 34 L 34 34 L 34 52 L 58 52 L 58 64 Z" fill="#475569" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="48" y1="34" x2="48" y2="56" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="3 2" className={animated ? "animate-pulse" : ""} />
          <rect x="38" y="48" width="18" height="6" rx="1" fill="#38bdf8" />
          <rect x="84" y="14" width="7" height="50" fill="#64748b" />
          <rect x="70" y="14" width="26" height="16" rx="3" fill="#0284c7" stroke="#7dd3fc" strokeWidth="1.5" />
          <g className={animated ? "animate-tool-head" : ""}>
            <rect x="76" y="30" width="8" height="7" fill="#334155" />
            <path d="M 78 37 L 82 37 L 80 54 Z" fill="#f59e0b" />
          </g>
          <rect x="70" y="54" width="20" height="4" rx="1" fill="#94a3b8" />
        </svg>
      );
    case 'lathe_conv':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="10" y="56" width="100" height="24" rx="3" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
          <rect x="16" y="46" width="88" height="10" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
          <rect x="10" y="22" width="28" height="34" rx="2" fill="#047857" stroke="#34d399" strokeWidth="1.5" />
          <circle cx="24" cy="36" r="7" fill="#0f172a" stroke="#6ee7b7" strokeWidth="1.5" />
          <rect x="38" y="28" width="8" height="20" rx="1" fill="#94a3b8" />
          <rect x="46" y="34" width="44" height="8" fill="#cbd5e1" />
          <rect x="46" y="35" width="26" height="6" fill="#38bdf8" />
          <path d="M 90 38 L 98 33 L 108 33 L 108 46 L 98 46 Z" fill="#047857" stroke="#34d399" strokeWidth="1.5" />
          <g className={animated ? "animate-carriage" : ""}>
            <rect x="58" y="42" width="16" height="18" rx="2" fill="#334155" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M 64 42 L 66 37 L 69 42 Z" fill="#fbbf24" />
          </g>
        </svg>
      );
    case 'mill_3axis':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="12" y="10" width="96" height="70" rx="5" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2" />
          <rect x="22" y="18" width="58" height="44" rx="3" fill="#090d16" stroke="#38bdf8" strokeWidth="1.5" />
          <rect x="28" y="52" width="46" height="6" rx="1" fill="#64748b" />
          <rect x="38" y="45" width="26" height="7" rx="1" fill="#38bdf8" />
          <g className={animated ? "animate-tool-head" : ""}>
            <rect x="44" y="20" width="14" height="16" rx="2" fill="#e2e8f0" stroke="#3b82f6" strokeWidth="1.5" />
            <path d="M 49 42 L 53 42 L 52 47 L 50 47 Z" fill="#fbbf24" />
          </g>
          <rect x="85" y="22" width="18" height="40" rx="2" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
          <rect x="88" y="26" width="12" height="10" rx="1" fill="#0284c7" />
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
          <g className={animated ? "animate-carriage" : ""}>
            <polygon points="44,23 54,23 57,31 49,37 41,31" fill="#e2e8f0" stroke="#4f46e5" strokeWidth="1.5" />
            <rect x="48" y="35" width="2" height="4" fill="#fbbf24" />
          </g>
          <rect x="84" y="24" width="18" height="36" rx="2" fill="#0f172a" stroke="#a5b4fc" strokeWidth="1.5" />
        </svg>
      );
    case 'mill_5axis':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="10" y="8" width="100" height="74" rx="7" fill="#3b0764" stroke="#c084fc" strokeWidth="2" />
          <rect x="20" y="16" width="64" height="54" rx="6" fill="#090d16" stroke="#a855f7" strokeWidth="1.5" />
          <g className={animated ? "origin-[52px_52px] animate-cradle" : ""}>
            <path d="M 32 46 A 20 14 0 0 0 72 46" fill="none" stroke="#94a3b8" strokeWidth="5" />
            <path d="M 45 48 L 49 38 L 55 38 L 59 48 Z" fill="#38bdf8" />
          </g>
          <g className={animated ? "animate-tool-head" : ""}>
            <path d="M 46 16 L 58 16 L 55 32 L 49 32 Z" fill="#f8fafc" stroke="#c084fc" strokeWidth="1.5" />
            <line x1="52" y1="32" x2="52" y2="40" stroke="#f43f5e" strokeWidth="2" />
          </g>
          <rect x="88" y="20" width="16" height="44" rx="3" fill="#0f172a" stroke="#d8b4fe" strokeWidth="1.5" />
        </svg>
      );
    case 'edm_wire':
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="12" y="10" width="96" height="70" rx="5" fill="#451a03" stroke="#f59e0b" strokeWidth="2" />
          <rect x="22" y="36" width="60" height="34" rx="3" fill="#083344" stroke="#22d3ee" strokeWidth="2" />
          <rect x="24" y="42" width="56" height="26" rx="2" fill="#06b6d4" opacity="0.35" />
          <rect x="36" y="50" width="32" height="10" rx="1" fill="#94a3b8" />
          <line x1="52" y1="24" x2="52" y2="68" stroke="#fde047" strokeWidth="1.5" />
          {animated && <circle cx="52" cy="55" r="4" fill="#22d3ee" className="animate-ping" />}
          <rect x="86" y="20" width="16" height="50" rx="2" fill="#0f172a" stroke="#fbbf24" strokeWidth="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 90" className={className}>
          <rect x="8" y="8" width="104" height="74" rx="6" fill="#4c0519" stroke="#fb7185" strokeWidth="2" />
          <rect x="16" y="18" width="34" height="48" rx="3" fill="#090d16" stroke="#f43f5e" strokeWidth="1.5" />
          <rect x="70" y="18" width="34" height="48" rx="3" fill="#090d16" stroke="#f43f5e" strokeWidth="1.5" />
          <g className={animated ? "origin-[60px_64px] animate-robot-arm" : ""}>
            <circle cx="60" cy="62" r="6" fill="#f97316" />
            <line x1="60" y1="62" x2="48" y2="38" stroke="#f97316" strokeWidth="6" strokeLinecap="round" />
            <line x1="48" y1="38" x2="66" y2="28" stroke="#fb923c" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        </svg>
      );
  }
};

const CharacterPortrait = ({ id, spriteSheetUrl, className = "w-full h-full" }) => {
  const spritePos = AVATAR_SPRITE_POSITIONS[id];
  if (spritePos && spriteSheetUrl) {
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
      />
    );
  }
  const palette = {
    emp_mst: ['#881337', '#e11d48'], emp_marty: ['#78350f', '#d97706'], emp_blanchard: ['#1e3a8a', '#2563eb'],
    emp_graya: ['#7c2d12', '#ea580c'], emp_renaud: ['#4c1d95', '#7c3aed'], emp_pietri: ['#312e81', '#4f46e5'],
    emp_pompidou: ['#0c4a6e', '#0284c7'], emp_lauris: ['#064e3b', '#059669'], emp_pierre: ['#1e293b', '#475569'],
    emp_sebastien: ['#164e63', '#0891b2'], emp_cedric: ['#334155', '#64748b'], emp_elliot: ['#1e293b', '#3b82f6']
  };
  const [bg, suit] = palette[id] || ['#334155', '#475569'];
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <rect width="100" height="100" rx="14" fill={bg} />
      <path d="M 18 96 Q 20 66 50 66 Q 80 66 82 96 Z" fill={suit} stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" />
      <circle cx="50" cy="42" r="18" fill="#fed7aa" />
      <circle cx="43" cy="41" r="2.2" fill="#0f172a" />
      <circle cx="57" cy="41" r="2.2" fill="#0f172a" />
      <path d="M 44 49 Q 50 53 56 49" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
      <path d="M 30 35 Q 50 15 70 35 Z" fill="#fbbf24" />
    </svg>
  );
};

const EmployeeCard = ({ employee, count = 1, onMerge, spriteSheetUrl }) => {
  const meta = RARITY_META[employee.rarity] || RARITY_META.COMMON;
  const stars = employee.stars || 1;
  const starScale = 1 + (stars - 1) * 0.25;
  const spd = Math.round(employee.speedBonus * starScale * 100);
  const qual = Math.round(employee.qualBonus * starScale);
  const prec = Math.round(employee.precBonus * starScale);

  return (
    <div
      className={`relative rounded-2xl p-[3px] bg-gradient-to-br ${meta.gradient} w-full h-full flex-shrink-0 group overflow-hidden transition-all duration-300 hover:-translate-y-1`}
      style={{ boxShadow: `0 10px 24px -6px ${meta.glow}44` }}
    >
      {meta.foil && (
        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-foil-shimmer" />
      )}
      <div className="relative h-full w-full bg-slate-950/95 rounded-[13px] p-2.5 flex flex-col justify-between gap-2 border border-white/15 text-center">
        <div className="shrink-0">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-900 border border-white/10">
            <span className={meta.text}>{meta.label}</span>
            <span className="text-yellow-400">{'★'.repeat(stars)}</span>
          </div>
          <h3 className="text-sm font-black text-white leading-tight mt-1.5 truncate">{employee.name}</h3>
          <div className="text-[10px] text-slate-400 truncate">{employee.title}</div>
        </div>

        <div className="flex items-center justify-center shrink-0">
          <div className={`w-24 h-24 aspect-square rounded-2xl bg-gradient-to-br ${meta.gradient} p-[2px] relative`}>
            <div className="w-full h-full bg-slate-900 rounded-[14px] overflow-hidden">
              <CharacterPortrait id={employee.id || employee.templateId} spriteSheetUrl={spriteSheetUrl} />
            </div>
            {count > 1 && (
              <div className="absolute -top-2 -right-2 bg-slate-950 border border-white/40 text-white text-[10px] font-black px-2 py-0.5 rounded-full z-20">
                x{count}
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto shrink-0 bg-slate-900/95 rounded-xl p-2 border border-white/10 text-left space-y-1">
          <div className="text-[9px] text-slate-400 uppercase font-bold">Spécialité (x1.5 bonus)</div>
          <div className="text-xs font-black text-cyan-300 truncate">{employee.specName}</div>
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800 text-center font-mono text-[10px]">
            <div className="bg-slate-950 rounded py-0.5 text-amber-300 font-bold">+{spd}% Vit</div>
            <div className="bg-slate-950 rounded py-0.5 text-emerald-300 font-bold">+{qual} Qual</div>
            <div className="bg-slate-950 rounded py-0.5 text-cyan-300 font-bold">+{prec} Préc</div>
          </div>
          {count >= 3 && onMerge && (
            <button
              onClick={(e) => { e.stopPropagation(); onMerge(employee); }}
              className="mt-1.5 w-full bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 text-[10px] font-black py-1.5 rounded-lg flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> FUSIONNER (3)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ÉTAT INITIAL NOUVEAU JOUEUR (BOUCLE INDUSTRIELLE NATURELLE)
// ============================================================================
const createDefaultGameState = () => ({
  saveVersion: SAVE_VERSION,
  money: 1200,
  researchPoints: 15,
  materials: { alu: 25, steel: 15, plastic: 0, inox: 0, copper: 0, titanium: 0 },
  finishedLots: [],
  slots: Array(16).fill(null),
  metrology: [],
  support: [],
  unlockedTechs: [],
  autoSellRules: {}, // { [partId]: { enabled: boolean, minKeep: number } }
  autoRestock: {},   // { [matId]: { enabled: boolean, thresholdKg: number, buyKg: number } }
  contracts: [],
  claimedMissions: [],
  inventory: [],     // Cartes d'opérateurs recrutés
  atelier: { sizeLevel: 1, floor: 'beton' },
  reputation: { quality: 20, reliability: 20, innovation: 15, capacity: 15, delivery: 20 },
  stats: {
    totalPartsProduced: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalInspected: 0,
    highQualityParts: 0,
    contractsCompleted: 0,
    contractsFailed: 0
  },
  lastActiveAt: Date.now()
});

// ============================================================================
// APPLICATION PRINCIPALE : CNC EMPIRE TYCOON INDUSTRIEL v2.0
// ============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('factory');
  const [toast, setToast] = useState(null);
  const [cloudStatus, setCloudStatus] = useState('connecting');

  // --- COMPTE & AUTHENTIFICATION ---
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPseudoInput, setAuthPseudoInput] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [lastCloudSave, setLastCloudSave] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // --- ÉTAT CENTRAL DU JEU ---
  const [game, setGame] = useState(() => createDefaultGameState());
  const [marketDemand, setMarketDemand] = useState(() => {
    const d = {};
    PARTS_CATALOG.forEach(p => { d[p.id] = 1.0; });
    return d;
  });
  const [marketHeadline, setMarketHeadline] = useState("Marché industriel stable : demande soutenue en mécanique générale.");

  // --- ÉTATS UI & MODALES ---
  const [leaderboard, setLeaderboard] = useState([]);
  const [spriteSheetUrl, setSpriteSheetUrl] = useState(null);
  const [avatarSource, setAvatarSource] = useState('svg');
  const [selectedSlotModal, setSelectedSlotModal] = useState(null); // index pour achat/config machine
  const [assignModalSlot, setAssignModalSlot] = useState(null);     // index pour affectation opérateur
  const [sellModalLotId, setSellModalLotId] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [offlineReport, setOfflineReport] = useState(null);
  const [chestAnim, setChestAnim] = useState(false);
  const [chestResult, setChestResult] = useState(null);
  const [selectedTechBranch, setSelectedTechBranch] = useState('all');

  const cloudReadyRef = useRef(false);
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  const marketRef = useRef(marketDemand);
  useEffect(() => { marketRef.current = marketDemand; }, [marketDemand]);

  const showMsg = useCallback((msg, tone = 'info') => {
    setToast({ msg, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // --- PROFILS INDUSTRIELS DÉRIVÉS (CENTRALISÉS) ---
  const techFx = useMemo(() => FactoryEngine.getTechEffects(game.unlockedTechs), [game.unlockedTechs]);
  const metroProfile = useMemo(() => FactoryEngine.getMetrologyProfile(game.metrology), [game.metrology]);
  const supportProfile = useMemo(() => FactoryEngine.getSupportProfile(game.support, game.atelier.floor), [game.support, game.atelier.floor]);
  const certs = useMemo(() => FactoryEngine.getCertifications(game.unlockedTechs, game.metrology, game.reputation), [game.unlockedTechs, game.metrology, game.reputation]);
  const currentSize = useMemo(() => ATELIER_UPGRADES.sizes.find(s => s.level === game.atelier.sizeLevel) || ATELIER_UPGRADES.sizes[0], [game.atelier.sizeLevel]);

  const globalReputation = useMemo(() => {
    const r = game.reputation;
    return Math.round(((r.quality || 0) + (r.reliability || 0) + (r.innovation || 0) + (r.capacity || 0) + (r.delivery || 0)) / 5);
  }, [game.reputation]);

  const stateContext = useMemo(() => ({
    inventory: game.inventory,
    techFx,
    metro: metroProfile,
    support: supportProfile,
    certs
  }), [game.inventory, techFx, metroProfile, supportProfile, certs]);

  const machinesInstalledCount = useMemo(() => game.slots.filter(Boolean).length, [game.slots]);
  const totalFinishedPartsCount = useMemo(() => game.finishedLots.reduce((a, l) => a + l.quantity, 0), [game.finishedLots]);
  const chestCost = useMemo(() => Math.floor(1800 * Math.pow(1.22, game.inventory.length)), [game.inventory.length]);

  // Consommation estimée en kg/min par matériau
  const materialConsumptionPerMin = useMemo(() => {
    const map = {};
    game.slots.forEach((slot, idx) => {
      if (idx >= currentSize.slots || !slot || !slot.machineId || !slot.partId || slot.paused) return;
      const evalRes = FactoryEngine.evaluateSlotProduction(slot, stateContext);
      if (!evalRes) return;
      const kgPerMin = (evalRes.materialCostPerCycle / evalRes.cycleTime) * 60;
      map[evalRes.part.materialId] = (map[evalRes.part.materialId] || 0) + kgPerMin;
    });
    return map;
  }, [game.slots, currentSize.slots, stateContext]);

  // ==========================================================================
  // INITIALISATION FIREBASE (AUTH PUIS DONNÉES — CONFORME AUX 3 RÈGLES)
  // ==========================================================================
  useEffect(() => {
    if (!auth) {
      setCloudStatus('offline');
      cloudReadyRef.current = true;
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        setCloudStatus('online');
      } catch (e) {
        console.warn("Erreur auth Firebase :", e);
        setCloudStatus('offline');
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Chargement de la sauvegarde invité (users/{uid}/saves/main), leaderboard & avatars Cloud
  useEffect(() => {
    if (!user || !db) return;

    let cancelled = false;

    // 1. Chargement sauvegarde personnelle (mode invité ou reprise)
    const loadGuestSave = async () => {
      try {
        const guestRef = doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'main');
        const snap = await getDoc(guestRef);
        if (!cancelled && snap.exists()) {
          const migrated = FactoryEngine.migrateSaveData(snap.data());
          if (migrated) {
            applyLoadedStateWithOffline(migrated);
            if (migrated.pseudo) {
              setPseudo(migrated.pseudo);
              setPassword(migrated.password || '');
              setIsLoggedIn(true);
            }
          }
        }
      } catch (err) {
        console.warn("Lecture sauvegarde utilisateur :", err);
      } finally {
        cloudReadyRef.current = true;
      }
    };
    loadGuestSave();

    // 2. Écoute Classement Général
    const lbRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsubLb = onSnapshot(lbRef, (qs) => {
      if (cancelled) return;
      const list = [];
      qs.forEach(d => list.push(d.data()));
      list.sort((a, b) => (b.score || b.income || 0) - (a.score || a.income || 0));
      setLeaderboard(list.slice(0, 50));
      setCloudStatus('online');
    }, (err) => {
      console.warn("Erreur lecture leaderboard :", err);
      if (err.code === 'permission-denied') setCloudStatus('permission_error');
    });

    // 3. Écoute Planche Avatars Cloud + Fallback /avatars.png
    const avatarRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'avatars');
    const unsubAv = onSnapshot(avatarRef, (snap) => {
      if (cancelled) return;
      if (snap.exists() && snap.data()?.sheetUrl) {
        setSpriteSheetUrl(snap.data().sheetUrl);
        setAvatarSource('cloud');
      } else {
        const probe = new Image();
        probe.onload = () => { if (!cancelled) { setSpriteSheetUrl('/avatars.png'); setAvatarSource('static'); } };
        probe.src = '/avatars.png';
      }
    }, (err) => {
      console.warn("Erreur lecture avatars Cloud :", err);
    });

    return () => {
      cancelled = true;
      unsubLb();
      unsubAv();
    };
  }, [user]);

  // ==========================================================================
  // SIMULATION HORS-LIGNE CONTRÔLÉE (PLAFONNÉE À 2H, RESPECTE LES STOCKS)
  // ==========================================================================
  const applyLoadedStateWithOffline = (loaded) => {
    const now = Date.now();
    const elapsedSec = clamp((now - (loaded.lastActiveAt || now)) / 1000, 0, MAX_OFFLINE_SECONDS);

    if (elapsedSec < 20) {
      setGame({ ...loaded, lastActiveAt: now });
      if (loaded.wasMigrated) {
        showMsg("🔄 Ancienne sauvegarde v1 migrée en Tycoon Industriel v2 (argent, cartes et atelier conservés !)");
      }
      return;
    }

    // Simule les cycles complets effectués pendant l'absence en respectant les matières disponibles
    const simTechFx = FactoryEngine.getTechEffects(loaded.unlockedTechs);
    const simMetro = FactoryEngine.getMetrologyProfile(loaded.metrology);
    const simSupport = FactoryEngine.getSupportProfile(loaded.support, loaded.atelier.floor);
    const simCerts = FactoryEngine.getCertifications(loaded.unlockedTechs, loaded.metrology, loaded.reputation);
    const simCtx = { inventory: loaded.inventory, techFx: simTechFx, metro: simMetro, support: simSupport, certs: simCerts };
    const maxSlots = (ATELIER_UPGRADES.sizes.find(s => s.level === loaded.atelier.sizeLevel) || ATELIER_UPGRADES.sizes[0]).slots;

    let simMaterials = { ...loaded.materials };
    let simLots = [...loaded.finishedLots];
    let simMoney = loaded.money;
    let simRP = loaded.researchPoints;
    let totalProducedOffline = 0;
    let totalAutoSoldValue = 0;
    const simStats = { ...loaded.stats };

    const nextSlots = loaded.slots.map((slot, idx) => {
      if (idx >= maxSlots || !slot || !slot.machineId || !slot.partId || slot.paused) return slot;
      const evalRes = FactoryEngine.evaluateSlotProduction(slot, simCtx);
      if (!evalRes) return slot;

      const possibleCyclesByTime = Math.floor((elapsedSec + (slot.cycleProgress || 0)) / evalRes.cycleTime);
      const availMat = simMaterials[evalRes.part.materialId] || 0;
      const possibleCyclesByMat = Math.floor(availMat / evalRes.materialCostPerCycle);
      const actualCycles = Math.min(possibleCyclesByTime, possibleCyclesByMat);

      if (actualCycles > 0) {
        simMaterials[evalRes.part.materialId] = Math.max(0, availMat - actualCycles * evalRes.materialCostPerCycle);
        const opTotal = actualCycles * evalRes.opCost;
        simMoney = Math.max(0, simMoney - opTotal);
        const qtyMade = actualCycles * evalRes.qtyPerCycle;
        totalProducedOffline += qtyMade;
        simStats.totalPartsProduced += qtyMade;
        if (evalRes.quality >= 90) simStats.highQualityParts += qtyMade;
        simRP += Math.floor(actualCycles * Math.max(1, evalRes.part.difficulty * 0.6));

        const status = (simMetro.autoInspect || simTechFx.autoInspectUnlock)
          ? (evalRes.isConforming ? 'conforming' : 'non_conforming')
          : 'uninspected';
        if (status !== 'uninspected') simStats.totalInspected += qtyMade;

        simLots = FactoryEngine.mergeBatchIntoLots(simLots, {
          partId: evalRes.part.id,
          materialId: evalRes.part.materialId,
          quantity: qtyMade,
          quality: evalRes.quality,
          precision: evalRes.precision,
          unitCost: evalRes.unitCost,
          status,
          actuallyConforming: evalRes.isConforming
        });
      }
      return { ...slot, cycleProgress: 0 };
    });

    // Vente auto hors-ligne (ne touche jamais les pièces réservées)
    simLots = simLots.map(lot => {
      const rule = loaded.autoSellRules?.[lot.partId];
      if (!rule || !rule.enabled || lot.status === 'non_conforming') return lot;
      const sellable = Math.max(0, lot.quantity - (lot.reserved || 0) - (rule.minKeep || 0));
      if (sellable > 0) {
        const unitP = FactoryEngine.computeUnitSalePrice(lot, marketRef.current, simCerts, simTechFx);
        const rev = sellable * unitP;
        simMoney += rev;
        totalAutoSoldValue += rev;
        simStats.totalRevenue += rev;
        simStats.totalProfit += rev - sellable * lot.unitCost;
        return { ...lot, quantity: lot.quantity - sellable };
      }
      return lot;
    }).filter(l => l.quantity > 0);

    setGame({
      ...loaded,
      money: simMoney,
      researchPoints: simRP,
      materials: simMaterials,
      finishedLots: simLots,
      slots: nextSlots,
      stats: simStats,
      lastActiveAt: now
    });

    if (totalProducedOffline > 0) {
      setOfflineReport({
        elapsedSec,
        parts: totalProducedOffline,
        revenue: totalAutoSoldValue,
        wasMigrated: loaded.wasMigrated
      });
    } else if (loaded.wasMigrated) {
      showMsg("🔄 Sauvegarde v1 migrée avec succès vers CNC Tycoon Industriel v2 !");
    }
  };

  // ==========================================================================
  // BOUCLE DE SIMULATION CENTRALE (250ms — CYCLES CNC, AUTO-RESTOCK, AUTO-SELL, DÉLAIS CONTRATS)
  // ==========================================================================
  useEffect(() => {
    let lastTime = Date.now();
    const tick = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(1.0, (now - lastTime) / 1000);
      lastTime = now;

      setGame(prev => {
        const curSize = ATELIER_UPGRADES.sizes.find(s => s.level === prev.atelier.sizeLevel) || ATELIER_UPGRADES.sizes[0];
        const curTechFx = FactoryEngine.getTechEffects(prev.unlockedTechs);
        const curMetro = FactoryEngine.getMetrologyProfile(prev.metrology);
        const curSupport = FactoryEngine.getSupportProfile(prev.support, prev.atelier.floor);
        const curCerts = FactoryEngine.getCertifications(prev.unlockedTechs, prev.metrology, prev.reputation);
        const ctx = { inventory: prev.inventory, techFx: curTechFx, metro: curMetro, support: curSupport, certs: curCerts };

        let money = prev.money;
        let researchPoints = prev.researchPoints;
        let materials = { ...prev.materials };
        let finishedLots = prev.finishedLots;
        let stats = { ...prev.stats };
        let reputation = { ...prev.reputation };
        let changedLots = false;

        // 1. Réapprovisionnement automatique (si débloqué par Tech Méthodes 'meth_flow')
        if (curTechFx.autoRestockUnlock) {
          MATERIALS_CATALOG.forEach(mat => {
            const rule = prev.autoRestock?.[mat.id];
            if (rule && rule.enabled && (materials[mat.id] || 0) < (rule.thresholdKg || 10)) {
              const buyKg = rule.buyKg || 25;
              const cost = buyKg * mat.pricePerKg;
              if (money >= cost) {
                money -= cost;
                materials[mat.id] = (materials[mat.id] || 0) + buyKg;
              }
            }
          });
        }

        // 2. Avancement des cycles sur chaque machine active
        const nextSlots = prev.slots.map((slot, idx) => {
          if (idx >= curSize.slots || !slot || !slot.machineId || !slot.partId || slot.paused) return slot;
          const evalRes = FactoryEngine.evaluateSlotProduction(slot, ctx);
          if (!evalRes) return slot;

          const availMat = materials[evalRes.part.materialId] || 0;
          if (availMat < evalRes.materialCostPerCycle) {
            // En attente de matière première : ne remet pas à zéro brutalement, reste en attente propre
            return slot;
          }

          let progress = (slot.cycleProgress || 0) + dt;
          if (progress >= evalRes.cycleTime) {
            progress -= evalRes.cycleTime;
            // Consommation matière + coût d'exploitation
            materials[evalRes.part.materialId] = Math.max(0, availMat - evalRes.materialCostPerCycle);
            money = Math.max(0, money - evalRes.opCost);

            // Détermination statut de contrôle (auto si scanner optique installé, sinon en attente de contrôle)
            const autoInspect = curMetro.autoInspect || curTechFx.autoInspectUnlock;
            let status = 'uninspected';
            if (autoInspect) {
              const detectedDefect = !evalRes.isConforming && Math.random() <= curMetro.detectionRate;
              status = detectedDefect ? 'non_conforming' : 'conforming';
              stats.totalInspected += evalRes.qtyPerCycle;
            }

            finishedLots = FactoryEngine.mergeBatchIntoLots(finishedLots, {
              partId: evalRes.part.id,
              materialId: evalRes.part.materialId,
              quantity: evalRes.qtyPerCycle,
              quality: evalRes.quality,
              precision: evalRes.precision,
              unitCost: evalRes.unitCost,
              status,
              actuallyConforming: evalRes.isConforming
            });
            changedLots = true;

            stats.totalPartsProduced += evalRes.qtyPerCycle;
            if (evalRes.quality >= 90) stats.highQualityParts += evalRes.qtyPerCycle;
            // Gain progressif de Points de Recherche industriels à la fin des cycles
            researchPoints += Math.max(0.4, evalRes.part.difficulty * 0.45);
          }

          return { ...slot, cycleProgress: progress };
        });

        // 3. Vente automatique des lots conformes (ou non contrôlés si configuré) SANS JAMAIS VENDRE LES PIÈCES RÉSERVÉES
        if (changedLots) {
          finishedLots = finishedLots.map(lot => {
            const rule = prev.autoSellRules?.[lot.partId];
            if (!rule || !rule.enabled) return lot;
            if (lot.status === 'non_conforming') return lot; // Ne vend jamais un rebut automatiquement
            const minKeep = Math.max(0, Number(rule.minKeep) || 0);
            const unreserved = Math.max(0, lot.quantity - (lot.reserved || 0));
            const toSell = Math.max(0, unreserved - minKeep);
            if (toSell > 0) {
              const unitPrice = FactoryEngine.computeUnitSalePrice(lot, marketRef.current, curCerts, curTechFx);
              const rev = toSell * unitPrice;
              money += rev;
              stats.totalRevenue += rev;
              stats.totalProfit += rev - (toSell * lot.unitCost);
              return { ...lot, quantity: lot.quantity - toSell };
            }
            return lot;
          }).filter(l => l.quantity > 0);
        }

        // 4. Mise à jour du compte à rebours des contrats acceptés + génération de nouvelles offres
        let contracts = prev.contracts.map(c => {
          if (c.status === 'accepted') {
            const nextRem = c.remainingSec - dt;
            if (nextRem <= 0) {
              stats.contractsFailed += 1;
              reputation.delivery = clamp(reputation.delivery - 6, 0, 100);
              reputation.reliability = clamp(reputation.reliability - 5, 0, 100);
              return { ...c, remainingSec: 0, status: 'expired' };
            }
            return { ...c, remainingSec: nextRem };
          }
          return c;
        });

        const availCount = contracts.filter(c => c.status === 'available').length;
        if (availCount < 3) {
          const repAvg = Math.round((reputation.quality + reputation.reliability + reputation.innovation + reputation.capacity + reputation.delivery) / 5);
          contracts = [...contracts, FactoryEngine.generateContract(prev.unlockedTechs, repAvg, curCerts)];
        }
        // Nettoyage des anciens contrats expirés/terminés pour garder la liste propre
        if (contracts.length > 14) {
          const active = contracts.filter(c => c.status === 'available' || c.status === 'accepted');
          const archived = contracts.filter(c => c.status !== 'available' && c.status !== 'accepted').slice(-5);
          contracts = [...active, ...archived];
        }

        return {
          ...prev,
          money,
          researchPoints,
          materials,
          finishedLots,
          slots: nextSlots,
          contracts,
          reputation,
          stats,
          lastActiveAt: now
        };
      });
    }, 250);

    return () => clearInterval(tick);
  }, []);

  // Flucutation douce du marché industriel toutes les 45 secondes
  useEffect(() => {
    const mInterval = setInterval(() => {
      const next = {};
      let hotPart = null;
      let maxVal = 0;
      PARTS_CATALOG.forEach(p => {
        const factor = Number((0.88 + Math.random() * 0.34).toFixed(2));
        next[p.id] = factor;
        if (factor > maxVal) { maxVal = factor; hotPart = p; }
      });
      setMarketDemand(next);
      if (hotPart) {
        setMarketHeadline(`Tendance Marché : Forte demande sur "${hotPart.name}" (+${Math.round((maxVal - 1) * 100)}%)`);
      }
    }, 45000);
    return () => clearInterval(mInterval);
  }, []);

  // ==========================================================================
  // SAUVEGARDE CLOUD FIRESTORE (INVITÉ + COMPTE PSEUDO/MDP + CLASSEMENT)
  // ==========================================================================
  const syncWithCloud = useCallback(async (silent = true, customAccount = null) => {
    if (!db || !user) return false;
    const g = gameRef.current;
    const activePseudo = (customAccount?.pseudo ?? pseudo).trim();
    const activePass = (customAccount?.password ?? password).trim();
    const cleanP = cleanKey(activePseudo);
    const now = Date.now();

    const payload = {
      ...g,
      pseudo: activePseudo,
      password: activePass,
      saveVersion: SAVE_VERSION,
      lastActiveAt: now,
      updatedAt: now
    };

    try {
      // 1. Sauvegarde toujours dans l'espace privé de l'utilisateur courant (survit au F5 sans localStorage)
      const guestRef = doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'main');
      await setDoc(guestRef, payload, { merge: true });

      // 2. Si connecté avec un Pseudo, sauvegarde le compte cross-device & met à jour le Classement
      if (cleanP) {
        const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', cleanP);
        await setDoc(accountRef, payload, { merge: true });

        const enterpriseScore = Math.round(g.stats.totalRevenue + g.money * 0.5 + g.stats.contractsCompleted * 5000);
        const lbRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', cleanP);
        await setDoc(lbRef, {
          pseudo: activePseudo,
          atelierName: (ATELIER_UPGRADES.sizes.find(s => s.level === g.atelier.sizeLevel) || ATELIER_UPGRADES.sizes[0]).name,
          score: enterpriseScore,
          totalRevenue: Math.round(g.stats.totalRevenue),
          partsProduced: g.stats.totalPartsProduced,
          contractsCompleted: g.stats.contractsCompleted,
          reputation: Math.round((g.reputation.quality + g.reputation.reliability + g.reputation.innovation + g.reputation.capacity + g.reputation.delivery) / 5),
          timestamp: now
        }, { merge: true });
      }

      setLastCloudSave(new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCloudStatus('online');
      if (!silent) showMsg("✅ Sauvegarde Cloud & Classement synchronisés !", "success");
      return true;
    } catch (err) {
      console.warn("Erreur sauvegarde Cloud :", err);
      if (err.code === 'permission-denied') setCloudStatus('permission_error');
      if (!silent) showMsg("⚠️ Impossible de joindre Firebase (vérifiez les règles Firestore)", "error");
      return false;
    }
  }, [user, pseudo, password, showMsg]);

  // Auto-save périodique fiable toutes les 10s
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      if (cloudReadyRef.current) syncWithCloud(true);
    }, 10000);
    return () => clearInterval(t);
  }, [user, syncWithCloud]);

  // Connexion / Reprise d'une partie existante par Pseudo + Mot de passe
  const handleAccountLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    const trimmedP = authPseudoInput.trim();
    const trimmedPwd = authPasswordInput.trim();
    const cleanP = cleanKey(trimmedP);

    if (!cleanP || !trimmedPwd) {
      setAuthError("Saisissez un Pseudo et un Mot de passe.");
      return;
    }
    if (!db || !user) {
      setAuthError("Connexion au serveur Firebase en cours, réessayez dans un instant.");
      return;
    }

    setIsAuthLoading(true);
    try {
      const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'accounts', cleanP);
      const snap = await getDoc(accountRef);

      if (snap.exists()) {
        const data = snap.data();
        if (data.password && String(data.password).trim() !== trimmedPwd) {
          setAuthError("Mot de passe incorrect pour cet atelier.");
          setIsAuthLoading(false);
          return;
        }
        const migrated = FactoryEngine.migrateSaveData(data);
        setPseudo(data.pseudo || trimmedP);
        setPassword(trimmedPwd);
        setIsLoggedIn(true);
        applyLoadedStateWithOffline(migrated);
        // Sauvegarde immédiatement le format v2 migré dans le profil invité
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'main'), { ...migrated, pseudo: data.pseudo || trimmedP, password: trimmedPwd }, { merge: true });
        setShowAuthModal(false);
        showMsg(`🎉 Atelier "${data.pseudo || trimmedP}" restauré avec succès !`, "success");
      } else {
        setPseudo(trimmedP);
        setPassword(trimmedPwd);
        setIsLoggedIn(true);
        await syncWithCloud(false, { pseudo: trimmedP, password: trimmedPwd });
        setShowAuthModal(false);
        showMsg(`🚀 Nouvel atelier industriel créé pour ${trimmedP} !`, "success");
      }
    } catch (err) {
      console.warn("Erreur login :", err);
      setAuthError(err.code === 'permission-denied' ? "Accès refusé par les règles Firestore." : "Erreur réseau Firebase.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggedIn) await syncWithCloud(true);
    setIsLoggedIn(false);
    setPseudo('');
    setPassword('');
    setAuthPseudoInput('');
    setAuthPasswordInput('');
    showMsg("👋 Déconnecté. Vous pouvez charger un autre compte.");
  };

  const handleResetGame = async () => {
    const fresh = createDefaultGameState();
    setGame(fresh);
    setConfirmReset(false);
    setShowAuthModal(false);
    if (db && user) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'main'), { ...fresh, pseudo, password });
    }
    showMsg("🔄 Nouvelle entreprise industrielle démarrée à 1 200 € !");
  };

  // Upload & diffusion Cloud de la planche des 10 avatars
  const handleUploadSpriteSheet = (e) => {
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
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        setSpriteSheetUrl(dataUrl);
        setAvatarSource('local');
        if (db && user && dataUrl.length < 900000) {
          try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'avatars'), { sheetUrl: dataUrl, updatedAt: Date.now() }, { merge: true });
            setAvatarSource('cloud');
            showMsg("🎨 Planche d'avatars synchronisée sur le Cloud pour tous les joueurs !", "success");
            return;
          } catch {}
        }
        showMsg("🎨 Planche des 10 avatars chargée !");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ==========================================================================
  // ACTIONS GAMEPLAY INDUSTRIEL (ACHATS, CONFIG, MÉTROLOGIE, VENTES, CONTRATS)
  // ==========================================================================
  const getMachineCost = (macId) => {
    const mac = MACHINES_CATALOG.find(m => m.id === macId);
    const owned = game.slots.filter(s => s && s.machineId === macId).length;
    return Math.round(mac.baseCost * Math.pow(1.22, owned));
  };

  const handleBuyMachine = (slotIdx, macId) => {
    const mac = MACHINES_CATALOG.find(m => m.id === macId);
    if (!mac) return;
    if (mac.reqTech && !game.unlockedTechs.includes(mac.reqTech)) {
      const t = TECH_TREE.find(x => x.id === mac.reqTech);
      showMsg(`🔒 Technologie requise : ${t?.name}`, "error");
      return;
    }
    const cost = getMachineCost(macId);
    if (game.money < cost) {
      showMsg(`Trésorerie insuffisante (${formatMoney(cost)} requis)`, "error");
      return;
    }
    const defaultPart = PARTS_CATALOG.find(p => p.compatibleMachines.includes(mac.id) && (!p.reqTech || game.unlockedTechs.includes(p.reqTech)))?.id || null;
    setGame(prev => {
      const nextSlots = [...prev.slots];
      nextSlots[slotIdx] = { machineId: mac.id, employeeId: null, partId: defaultPart, cycleProgress: 0, paused: false };
      return {
        ...prev,
        money: prev.money - cost,
        slots: nextSlots,
        reputation: { ...prev.reputation, capacity: clamp(prev.reputation.capacity + 4, 0, 100) }
      };
    });
    setSelectedSlotModal(null);
    showMsg(`🏭 ${mac.name} installée sur l'îlot #${slotIdx + 1} !`, "success");
  };

  const handleSellMachine = (slotIdx) => {
    const slot = game.slots[slotIdx];
    if (!slot) return;
    const mac = MACHINES_CATALOG.find(m => m.id === slot.machineId);
    const refund = Math.round((mac?.baseCost || 0) * 0.5);
    setGame(prev => {
      const nextSlots = [...prev.slots];
      nextSlots[slotIdx] = null;
      return { ...prev, money: prev.money + refund, slots: nextSlots };
    });
    showMsg(`♻️ ${mac?.name} revendue (+${formatMoney(refund)})`);
  };

  const handleConfigureSlotPart = (slotIdx, partId) => {
    setGame(prev => {
      const nextSlots = [...prev.slots];
      if (!nextSlots[slotIdx]) return prev;
      nextSlots[slotIdx] = { ...nextSlots[slotIdx], partId, cycleProgress: 0 };
      return { ...prev, slots: nextSlots };
    });
  };

  const handleToggleSlotPause = (slotIdx) => {
    setGame(prev => {
      const nextSlots = [...prev.slots];
      if (!nextSlots[slotIdx]) return prev;
      nextSlots[slotIdx] = { ...nextSlots[slotIdx], paused: !nextSlots[slotIdx].paused };
      return { ...prev, slots: nextSlots };
    });
  };

  const handleAssignOperator = (slotIdx, empUid) => {
    setGame(prev => {
      const nextSlots = prev.slots.map(s => (s && s.employeeId === empUid) ? { ...s, employeeId: null } : s);
      if (nextSlots[slotIdx]) nextSlots[slotIdx] = { ...nextSlots[slotIdx], employeeId: empUid || null };
      return { ...prev, slots: nextSlots };
    });
  };

  // Prototypage manuel d'appoint (évite tout blocage si un joueur vide sa trésorerie et ses matières)
  const handleManualSubcontract = () => {
    setGame(prev => ({
      ...prev,
      money: prev.money + 25,
      researchPoints: prev.researchPoints + 0.5
    }));
  };

  const handleBuyMaterial = (matId, kg) => {
    const mat = MATERIALS_CATALOG.find(m => m.id === matId);
    if (!mat) return;
    if (mat.reqTech && !game.unlockedTechs.includes(mat.reqTech)) {
      const t = TECH_TREE.find(x => x.id === mat.reqTech);
      showMsg(`🔒 Technologie Matériaux requise : ${t?.name}`, "error");
      return;
    }
    const cost = kg * mat.pricePerKg;
    if (game.money < cost) {
      showMsg(`Trésorerie insuffisante (${formatMoney(cost)})`, "error");
      return;
    }
    setGame(prev => ({
      ...prev,
      money: prev.money - cost,
      materials: { ...prev.materials, [matId]: (prev.materials[matId] || 0) + kg }
    }));
    showMsg(`📦 +${kg} kg de ${mat.short} livrés en magasin !`);
  };

  // Contrôle Métrologique manuel d'un lot non contrôlé
  const handleInspectLot = (lotId) => {
    if (game.metrology.length === 0) {
      showMsg("🔬 Achetez d'abord un équipement de métrologie (ex: Pied à Coulisse à 450 €) !", "error");
      return;
    }
    setGame(prev => {
      const idx = prev.finishedLots.findIndex(l => l.lotId === lotId);
      if (idx < 0) return prev;
      const lot = prev.finishedLots[idx];
      if (lot.status !== 'uninspected') return prev;

      const part = PARTS_CATALOG.find(p => p.id === lot.partId);
      const isActuallyOk = lot.actuallyConforming !== undefined
        ? lot.actuallyConforming
        : (lot.quality >= (part?.minQuality || 60) && lot.precision >= (part?.precisionReq || 50));

      // Si la précision requise dépasse la capacité du labo de métrologie, la détection est réduite
      const labAdequate = metroProfile.maxMeasurablePrecision >= (part?.precisionReq || 50);
      const effectiveDetect = labAdequate ? metroProfile.detectionRate : metroProfile.detectionRate * 0.5;
      const detectedDefect = !isActuallyOk && Math.random() <= effectiveDetect;
      const newStatus = detectedDefect ? 'non_conforming' : 'conforming';

      const nextLots = [...prev.finishedLots];
      nextLots[idx] = { ...lot, status: newStatus };

      return {
        ...prev,
        finishedLots: nextLots,
        researchPoints: prev.researchPoints + Math.max(1, Math.round(lot.quantity * 0.15)),
        stats: { ...prev.stats, totalInspected: prev.stats.totalInspected + lot.quantity },
        reputation: { ...prev.reputation, quality: clamp(prev.reputation.quality + (detectedDefect ? 1 : 0.5), 0, 100) }
      };
    });
    showMsg("🔬 Contrôle métrologique effectué sur le lot !");
  };

  const handleInspectAllLots = () => {
    if (game.metrology.length === 0) {
      showMsg("🔬 Installez au moins un instrument de métrologie !", "error");
      return;
    }
    const uninspected = game.finishedLots.filter(l => l.status === 'uninspected');
    if (uninspected.length === 0) return;
    uninspected.forEach(l => handleInspectLot(l.lotId));
  };

  // Recyclage d'un lot non conforme (récupère 65% de la matière première)
  const handleRecycleLot = (lotId) => {
    const lot = game.finishedLots.find(l => l.lotId === lotId);
    if (!lot) return;
    const part = PARTS_CATALOG.find(p => p.id === lot.partId);
    const available = Math.max(0, lot.quantity - (lot.reserved || 0));
    if (available <= 0) return;
    const recoveredKg = available * (part?.materialKg || 0.2) * 0.65;

    setGame(prev => ({
      ...prev,
      materials: { ...prev.materials, [lot.materialId]: (prev.materials[lot.materialId] || 0) + recoveredKg },
      finishedLots: prev.finishedLots.map(l => l.lotId === lotId ? { ...l, quantity: l.quantity - available } : l).filter(l => l.quantity > 0)
    }));
    showMsg(`♻️ Lot recyclé : +${formatWeight(recoveredKg)} de matière récupérée !`);
  };

  // Vente manuelle d'une quantité choisie
  const handleManualSellConfirm = (lotId, qty) => {
    const lot = game.finishedLots.find(l => l.lotId === lotId);
    if (!lot) return;
    const maxSellable = Math.max(0, lot.quantity - (lot.reserved || 0));
    const actualQty = clamp(Math.floor(qty), 1, maxSellable);
    if (actualQty <= 0) return;

    const unitPrice = FactoryEngine.computeUnitSalePrice(lot, marketDemand, certs, techFx);
    const revenue = actualQty * unitPrice;
    const cost = actualQty * lot.unitCost;
    const profit = revenue - cost;

    setGame(prev => ({
      ...prev,
      money: prev.money + revenue,
      finishedLots: prev.finishedLots.map(l => l.lotId === lotId ? { ...l, quantity: l.quantity - actualQty } : l).filter(l => l.quantity > 0),
      stats: { ...prev.stats, totalRevenue: prev.stats.totalRevenue + revenue, totalProfit: prev.stats.totalProfit + profit }
    }));
    setSellModalLotId(null);
    showMsg(`💶 Vente validée : +${formatMoney(revenue)} (Marge : ${formatMoney(profit)})`, "success");
  };

  // Achat Métrologie / Support / Technologie
  const handleBuyMetrology = (id) => {
    const item = METROLOGY_CATALOG.find(m => m.id === id);
    if (!item || game.metrology.includes(id)) return;
    if (item.reqTech && !game.unlockedTechs.includes(item.reqTech)) {
      const t = TECH_TREE.find(x => x.id === item.reqTech);
      showMsg(`🔒 Technologie requise : ${t?.name}`, "error");
      return;
    }
    if (game.money < item.cost) return;
    setGame(prev => ({
      ...prev,
      money: prev.money - item.cost,
      metrology: [...prev.metrology, id],
      reputation: { ...prev.reputation, quality: clamp(prev.reputation.quality + 6, 0, 100) }
    }));
    showMsg(`🔬 ${item.name} installé dans le laboratoire !`, "success");
  };

  const handleBuySupport = (id) => {
    const item = SUPPORT_CATALOG.find(s => s.id === id);
    if (!item || game.support.includes(id)) return;
    if (item.reqTech && !game.unlockedTechs.includes(item.reqTech)) {
      const t = TECH_TREE.find(x => x.id === item.reqTech);
      showMsg(`🔒 Technologie requise : ${t?.name}`, "error");
      return;
    }
    if (game.money < item.cost) return;
    setGame(prev => ({
      ...prev,
      money: prev.money - item.cost,
      support: [...prev.support, id],
      reputation: { ...prev.reputation, capacity: clamp(prev.reputation.capacity + 5, 0, 100) }
    }));
    showMsg(`⚙️ ${item.name} mis en service !`, "success");
  };

  const handleUnlockTech = (techId) => {
    const t = TECH_TREE.find(x => x.id === techId);
    if (!t || game.unlockedTechs.includes(techId)) return;
    const prereqsOk = t.prereqs.every(p => game.unlockedTechs.includes(p));
    if (!prereqsOk) { showMsg("🔒 Débloquez d'abord les prérequis technologiques.", "error"); return; }
    if (game.money < t.costMoney || game.researchPoints < t.costRP) return;
    setGame(prev => ({
      ...prev,
      money: prev.money - t.costMoney,
      researchPoints: prev.researchPoints - t.costRP,
      unlockedTechs: [...prev.unlockedTechs, techId],
      reputation: { ...prev.reputation, innovation: clamp(prev.reputation.innovation + 5, 0, 100) }
    }));
    showMsg(`🧠 Technologie débloquée : ${t.name} !`, "success");
  };

  // Missions : réclamation récompense
  const handleClaimMission = (mission) => {
    if (game.claimedMissions.includes(mission.id)) return;
    setGame(prev => ({
      ...prev,
      money: prev.money + mission.rewardMoney,
      researchPoints: prev.researchPoints + mission.rewardRP,
      claimedMissions: [...prev.claimedMissions, mission.id],
      reputation: {
        ...prev.reputation,
        reliability: clamp(prev.reputation.reliability + mission.rewardRep, 0, 100),
        innovation: clamp(prev.reputation.innovation + Math.ceil(mission.rewardRep / 2), 0, 100)
      }
    }));
    showMsg(`🏆 Mission "${mission.title}" validée ! +${formatMoney(mission.rewardMoney)} & +${mission.rewardRP} PR`, "success");
  };

  // Contrats & Appels d'Offres : Soumission / Acceptation / Livraison
  const getMatchingStockForContract = (contract) => {
    return game.finishedLots
      .filter(l => l.partId === contract.partId && l.status !== 'non_conforming' && l.quality >= contract.minQuality && l.precision >= contract.minPrecision)
      .reduce((acc, l) => acc + l.quantity, 0);
  };

  const handleAcceptContract = (contractId, bidMode = 'standard') => {
    const c = game.contracts.find(x => x.id === contractId);
    if (!c || c.status !== 'available') return;
    const activeAccepted = game.contracts.filter(x => x.status === 'accepted').length;
    if (activeAccepted >= 3) {
      showMsg("⚠️ Maximum 3 contrats simultanés en cours !", "error");
      return;
    }
    if (c.reqCert === 'iso9001' && !certs.iso9001) { showMsg("🔒 Certification ISO 9001 requise pour cet appel d'offres !", "error"); return; }
    if (c.reqCert === 'en9100' && !certs.en9100) { showMsg("🔒 Certification EN 9100 Aéronautique requise !", "error"); return; }
    if (globalReputation < c.minRep) { showMsg(`🔒 Réputation globale ${c.minRep}/100 requise.`, "error"); return; }

    // Soumission (Bid) : Compétitif (-8% prix, 100% succès), Standard (100% prix), Premium (+15% prix, chances selon réputation)
    let mult = 1.0;
    if (bidMode === 'competitive') mult = 0.92;
    if (bidMode === 'premium') {
      const winChance = clamp(0.45 + (globalReputation - c.minRep) * 0.015, 0.35, 0.92);
      if (Math.random() > winChance) {
        setGame(prev => ({
          ...prev,
          contracts: prev.contracts.filter(x => x.id !== contractId)
        }));
        showMsg(`❌ Soumission Premium rejetée par ${c.clientName} (offre jugée trop chère).`, "error");
        return;
      }
      mult = 1.15;
    }

    const agreedReward = Math.round(c.baseReward * mult);

    // Réservation automatique des lots déjà conformes en stock pour empêcher la vente auto
    let needToReserve = c.quantity;
    setGame(prev => {
      const nextLots = prev.finishedLots.map(l => {
        if (needToReserve > 0 && l.partId === c.partId && l.status !== 'non_conforming' && l.quality >= c.minQuality && l.precision >= c.minPrecision) {
          const free = Math.max(0, l.quantity - (l.reserved || 0));
          const take = Math.min(free, needToReserve);
          needToReserve -= take;
          return { ...l, reserved: (l.reserved || 0) + take };
        }
        return l;
      });
      return {
        ...prev,
        finishedLots: nextLots,
        contracts: prev.contracts.map(x => x.id === contractId ? { ...x, status: 'accepted', agreedReward, bidType: bidMode } : x)
      };
    });
    showMsg(`📝 Contrat remporté avec ${c.clientName} (${formatMoney(agreedReward)}) !`, "success");
  };

  const handleDeliverContract = (contractId) => {
    const c = game.contracts.find(x => x.id === contractId);
    if (!c || c.status !== 'accepted') return;

    const matching = game.finishedLots.filter(
      l => l.partId === c.partId && l.status !== 'non_conforming' && l.quality >= c.minQuality && l.precision >= c.minPrecision
    );
    const totalAvail = matching.reduce((a, l) => a + l.quantity, 0);
    if (totalAvail < c.quantity) {
      showMsg(`Stock conforme insuffisant (${totalAvail}/${c.quantity} pièces prêtes).`, "error");
      return;
    }

    // Vérifie si des lots non contrôlés sont livrés (risque d'audit client si pas contrôlé !)
    const hasUninspected = matching.some(l => l.status === 'uninspected');
    const bonusControlled = hasUninspected ? 0 : Math.round(c.agreedReward * 0.06);
    const totalPay = c.agreedReward + bonusControlled;

    let remainingToDeduct = c.quantity;
    setGame(prev => {
      const nextLots = prev.finishedLots.map(l => {
        if (remainingToDeduct > 0 && l.partId === c.partId && l.status !== 'non_conforming' && l.quality >= c.minQuality && l.precision >= c.minPrecision) {
          const take = Math.min(l.quantity, remainingToDeduct);
          remainingToDeduct -= take;
          return { ...l, quantity: l.quantity - take, reserved: Math.max(0, (l.reserved || 0) - take) };
        }
        return l;
      }).filter(l => l.quantity > 0);

      return {
        ...prev,
        money: prev.money + totalPay,
        researchPoints: prev.researchPoints + c.rewardRP,
        finishedLots: nextLots,
        contracts: prev.contracts.map(x => x.id === contractId ? { ...x, status: 'completed' } : x),
        stats: {
          ...prev.stats,
          totalRevenue: prev.stats.totalRevenue + totalPay,
          totalProfit: prev.stats.totalProfit + totalPay * 0.6,
          contractsCompleted: prev.stats.contractsCompleted + 1
        },
        reputation: {
          quality: clamp(prev.reputation.quality + (hasUninspected ? 1 : 4), 0, 100),
          reliability: clamp(prev.reputation.reliability + 5, 0, 100),
          innovation: clamp(prev.reputation.innovation + 2, 0, 100),
          capacity: clamp(prev.reputation.capacity + 3, 0, 100),
          delivery: clamp(prev.reputation.delivery + 5, 0, 100)
        }
      };
    });

    showMsg(`🏆 Livraison ${c.clientName} réussie ! +${formatMoney(totalPay)} & +${c.rewardRP} PR`, "success");
  };

  // Recrutement Gacha (Cartes Opérateurs)
  const handleOpenChest = () => {
    if (game.money < chestCost || chestAnim) return;
    setGame(prev => ({ ...prev, money: prev.money - chestCost }));
    setChestAnim(true);
    setChestResult(null);
    setTimeout(() => {
      const roll = Math.random() * 100;
      let cum = 0, rarity = 'COMMON';
      for (const [r, prob] of Object.entries(CHEST_ODDS)) {
        cum += prob;
        if (roll <= cum) { rarity = r; break; }
      }
      const pool = EMPLOYEES_CATALOG.filter(e => e.rarity === rarity);
      const picked = pool[Math.floor(Math.random() * pool.length)];
      const newRec = { uid: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, templateId: picked.id, stars: 1 };
      setGame(prev => ({ ...prev, inventory: [...prev.inventory, newRec] }));
      setChestAnim(false);
      setChestResult({ ...picked, ...newRec });
    }, 900);
  };

  const handleMergeCards = (tpl) => {
    const stars = tpl.stars || 1;
    const free = game.inventory.filter(e => e.templateId === tpl.id && (e.stars || 1) === stars && !game.slots.some(s => s && s.employeeId === e.uid));
    if (free.length < 3) return;
    const toRemove = free.slice(0, 3).map(e => e.uid);
    setGame(prev => ({
      ...prev,
      inventory: [...prev.inventory.filter(e => !toRemove.includes(e.uid)), { uid: `emp_${Date.now()}_m`, templateId: tpl.id, stars: stars + 1 }]
    }));
    showMsg(`⭐ Fusion réussie : ${tpl.name} passe ${stars + 1}★ !`, "success");
  };

  // ==========================================================================
  // VUE 1 : ATELIER & PRODUCTION (PLAN 2D INTERACTIF + GESTION DES CYCLES)
  // ==========================================================================
  const renderFactoryTab = () => {
    const floorObj = ATELIER_UPGRADES.floors.find(f => f.id === game.atelier.floor) || ATELIER_UPGRADES.floors[0];
    const hasCrane = game.support.includes('crane');
    const hasAgv = game.support.includes('agv');

    return (
      <div className="space-y-6">
        {/* Bandeau de synthèse rapide & Sous-traitance d'appoint */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Factory className="w-5 h-5 text-cyan-400" /> {currentSize.name} — Chaîne de Production Réelle
              </h2>
              <p className="text-xs text-slate-400">
                Les machines consomment vos matières premières pour fabriquer des pièces stockées en lots. Vendez-les ou livrez des contrats !
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-bold">
                Îlots : {machinesInstalledCount} / {currentSize.slots}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-bold">
                Stock fini : {totalFinishedPartsCount} pcs
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold">
                {marketHeadline}
              </span>
            </div>
          </div>

          <button
            onClick={handleManualSubcontract}
            className="lg:col-span-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border border-emerald-400/40 rounded-2xl p-3.5 text-left transition active:scale-95 shadow-lg flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-4 h-4" /> Établi / Retouche
              </div>
              <div className="text-[11px] text-emerald-100">Usinage prototype rapide</div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-black text-white">+25 €</div>
              <div className="text-[10px] text-emerald-200">+0.5 PR</div>
            </div>
          </button>
        </div>

        {/* PLAN 2D DE L'ATELIER EN TEMPS RÉEL (16:9) */}
        <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Hall CNC 16 îlots */}
            <div
              className="xl:col-span-9 rounded-2xl relative border-4 border-slate-700 overflow-hidden p-3 min-h-[460px]"
              style={{ backgroundColor: floorObj.color }}
            >
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {game.slots.map((slot, idx) => {
                  const unlocked = idx < currentSize.slots;
                  if (!unlocked) {
                    return (
                      <div key={idx} className="h-44 bg-slate-950/75 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-600 p-3 text-center">
                        <Lock className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-black uppercase">Îlot #{idx + 1} verrouillé</span>
                        <span className="text-[9px] text-slate-500 mt-0.5">Agrandissez les murs dans Métrologie & Support</span>
                      </div>
                    );
                  }

                  if (!slot || !slot.machineId) {
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedSlotModal(idx)}
                        className="h-44 bg-slate-950/50 hover:bg-slate-900/80 border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-2xl flex flex-col items-center justify-center transition group p-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition mb-2">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black text-white">ÎLOT #{idx + 1} LIBRE</span>
                        <span className="text-[10px] text-cyan-300 mt-0.5">Installer une machine CNC</span>
                      </button>
                    );
                  }

                  const evalRes = FactoryEngine.evaluateSlotProduction(slot, stateContext);
                  const mac = MACHINES_CATALOG.find(m => m.id === slot.machineId);
                  const availMat = evalRes ? (game.materials[evalRes.part.materialId] || 0) : 0;
                  const missingMat = evalRes && availMat < evalRes.materialCostPerCycle;
                  const statusLabel = slot.paused ? 'EN PAUSE' : !slot.partId ? 'À CONFIGURER' : missingMat ? 'MANQUE MATIÈRE' : 'EN PRODUCTION';
                  const statusColor = slot.paused ? 'bg-slate-600' : !slot.partId ? 'bg-amber-500' : missingMat ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500';
                  const pct = evalRes ? clamp((slot.cycleProgress / evalRes.cycleTime) * 100, 0, 100) : 0;
                  const empRec = slot.employeeId ? game.inventory.find(e => e.uid === slot.employeeId) : null;
                  const empTpl = empRec ? EMPLOYEES_CATALOG.find(t => t.id === empRec.templateId) : null;

                  return (
                    <div
                      key={idx}
                      className="rounded-2xl p-2.5 flex flex-col justify-between border-2 border-white/15 shadow-xl relative overflow-hidden"
                      style={{ background: `linear-gradient(160deg, ${mac.color}dd 0%, #090d16 92%)` }}
                    >
                      {/* En-tête statut */}
                      <div className="flex items-center justify-between gap-1 text-[9px] font-black z-10">
                        <span className="bg-slate-950/80 px-2 py-0.5 rounded-md text-white font-mono">#{idx + 1} {mac.name.split(' ')[0]}</span>
                        <span className={`px-2 py-0.5 rounded-md text-slate-950 font-black ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Illustration + Infos pièce en cours */}
                      <div className="flex items-center gap-2 my-1.5 z-10">
                        <div className="w-16 h-14 bg-slate-950/70 rounded-xl p-1 border border-white/10 shrink-0">
                          <MachineIllustration id={mac.id} animated={!slot.paused && !missingMat && Boolean(slot.partId)} />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-xs font-black text-white truncate">{evalRes ? evalRes.part.name : 'Aucune pièce'}</div>
                          {evalRes ? (
                            <>
                              <div className="text-[10px] font-mono text-cyan-300">
                                x{evalRes.qtyPerCycle} / {evalRes.cycleTime.toFixed(1)}s • {formatWeight(evalRes.materialCostPerCycle)} {evalRes.mat?.short}
                              </div>
                              <div className="text-[10px] font-mono flex items-center gap-2 mt-0.5">
                                <span className={evalRes.quality >= evalRes.part.minQuality ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
                                  Q:{evalRes.quality}
                                </span>
                                <span className={evalRes.precision >= evalRes.part.precisionReq ? 'text-cyan-300 font-bold' : 'text-rose-300 font-bold'}>
                                  P:{evalRes.precision}
                                </span>
                                <span className="text-slate-400">({formatMoney(evalRes.unitCost)}/u)</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] text-amber-300">Choisissez une pièce à usiner</div>
                          )}
                        </div>
                      </div>

                      {/* Barre de progression du cycle réel */}
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10 mb-2 z-10">
                        <div
                          className={`h-full transition-all duration-200 ${missingMat ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}
                          style={{ width: `${missingMat ? 100 : pct}%` }}
                        />
                      </div>

                      {/* Raison claire si manque matière */}
                      {missingMat && evalRes && (
                        <div className="mb-1.5 px-2 py-1 rounded-lg bg-rose-950/90 border border-rose-500/50 text-[9px] text-rose-200 flex items-center justify-between gap-1 z-10">
                          <span className="truncate">Manque {evalRes.mat?.short}</span>
                          <button
                            onClick={() => handleBuyMaterial(evalRes.part.materialId, 15)}
                            className="px-1.5 py-0.5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded shrink-0"
                          >
                            +15kg ({formatMoney(15 * (evalRes.mat?.pricePerKg || 6))})
                          </button>
                        </div>
                      )}

                      {/* Contrôles rapides du poste */}
                      <div className="flex items-center justify-between gap-1 z-10 pt-1 border-t border-white/10">
                        <button
                          onClick={() => setSelectedSlotModal(idx)}
                          className="flex-1 py-1 px-2 rounded-lg bg-slate-950/90 hover:bg-slate-800 text-[10px] font-bold text-cyan-300 border border-white/10 truncate"
                        >
                          Configurer
                        </button>
                        <button
                          onClick={() => setAssignModalSlot(idx)}
                          title={empTpl ? `Opérateur : ${empTpl.name}` : 'Affecter un opérateur'}
                          className={`py-1 px-2 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${empTpl ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-slate-950/90 border-white/10 text-slate-300 hover:text-white'}`}
                        >
                          <UserCheck className="w-3 h-3" /> {empTpl ? empTpl.name.split(' ')[0] : 'Équipe'}
                        </button>
                        <button
                          onClick={() => handleToggleSlotPause(idx)}
                          className="p-1 rounded-lg bg-slate-950/90 hover:bg-slate-800 text-slate-300 border border-white/10"
                          title={slot.paused ? 'Reprendre' : 'Mettre en pause'}
                        >
                          {slot.paused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pont Roulant 10T animé */}
              {hasCrane && (
                <div className="absolute top-1 bottom-1 w-8 z-20 animate-crane pointer-events-none opacity-80">
                  <div className="w-full h-full bg-yellow-500/60 border-x-2 border-slate-950 flex items-center justify-center">
                    <div className="w-5 h-8 bg-slate-950 border border-yellow-300 rounded flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                  </div>
                </div>
              )}

              {/* Robot AGV animé */}
              {hasAgv && (
                <div className="absolute bottom-3 left-0 right-0 z-20 pointer-events-none">
                  <div className="relative w-12 h-6 bg-slate-950 border-2 border-cyan-400 rounded-lg shadow-[0_0_12px_#22d3ee] animate-agv-h flex items-center justify-center text-[8px] font-mono font-black text-cyan-300">
                    AGV-01
                  </div>
                </div>
              )}
            </div>

            {/* Colonne Droite : État des Salles Annexes (Magasin, Labo Métrologie, Contrats actifs) */}
            <div className="xl:col-span-3 flex flex-col gap-3">
              {/* Magasin Matières Rapide */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-cyan-400" /> Magasin Matières
                  </span>
                  <button onClick={() => setActiveTab('inventory')} className="text-[10px] text-cyan-400 font-bold hover:underline">
                    Gérer →
                  </button>
                </div>
                <div className="space-y-1.5">
                  {MATERIALS_CATALOG.filter(m => !m.reqTech || game.unlockedTechs.includes(m.reqTech)).map(mat => {
                    const qty = game.materials[mat.id] || 0;
                    const rate = materialConsumptionPerMin[mat.id] || 0;
                    return (
                      <div key={mat.id} className="flex items-center justify-between bg-slate-900 rounded-xl px-2.5 py-1.5 text-xs border border-slate-800">
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mat.color }} />
                            {mat.short}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {formatWeight(qty)} {rate > 0 && <span className="text-amber-400">(-{rate.toFixed(1)} kg/m)</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleBuyMaterial(mat.id, 20)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-cyan-600 text-[10px] font-black text-white transition"
                        >
                          +20kg
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Labo Métrologie 20°C */}
              <div className="bg-slate-950 border border-cyan-500/30 rounded-2xl p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Microscope className="w-4 h-4 text-cyan-400" /> Labo Métrologie 20°C
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(metroProfile.detectionRate * 100)}% dét.</span>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div>Précision mesurable : <b className="text-white">{metroProfile.maxMeasurablePrecision}/100</b></div>
                  <div>Rétroaction procédé : <b className="text-emerald-400">+{metroProfile.processFeedbackBonus} Qual/Préc</b></div>
                  <div className="flex gap-1.5 pt-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${certs.iso9001 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>ISO 9001</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${certs.en9100 ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>EN 9100 AÉRO</span>
                  </div>
                </div>
              </div>

              {/* Contrats en cours */}
              <div className="bg-slate-950 border border-amber-500/30 rounded-2xl p-3.5 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-amber-400" /> Contrats Actifs
                  </span>
                  <button onClick={() => setActiveTab('contracts')} className="text-[10px] text-amber-400 font-bold hover:underline">
                    Offres →
                  </button>
                </div>
                {game.contracts.filter(c => c.status === 'accepted').length === 0 ? (
                  <p className="text-[11px] text-slate-500">Aucun contrat accepté. Consultez les appels d'offres clients !</p>
                ) : (
                  <div className="space-y-2">
                    {game.contracts.filter(c => c.status === 'accepted').map(c => {
                      const part = PARTS_CATALOG.find(p => p.id === c.partId);
                      const ready = getMatchingStockForContract(c);
                      const isReady = ready >= c.quantity;
                      return (
                        <div key={c.id} className="bg-slate-900 rounded-xl p-2 border border-slate-800 text-xs">
                          <div className="flex justify-between font-bold text-white">
                            <span className="truncate">{part?.name}</span>
                            <span className="text-amber-400 font-mono">{formatDuration(c.remainingSec)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-[10px]">
                            <span className={isReady ? 'text-emerald-400 font-black' : 'text-slate-400'}>
                              {ready}/{c.quantity} pcs (Q≥{c.minQuality})
                            </span>
                            {isReady && (
                              <button onClick={() => handleDeliverContract(c.id)} className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black">
                                Livrer !
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // VUE 2 : MATIÈRES PREMIÈRES, INVENTAIRE PAR LOTS & COMMERCIALISATION
  // ==========================================================================
  const renderInventoryTab = () => {
    const uninspectedCount = game.finishedLots.filter(l => l.status === 'uninspected').length;
    const activeParts = PARTS_CATALOG.filter(p => !p.reqTech || game.unlockedTechs.includes(p.reqTech));

    return (
      <div className="space-y-6">
        {/* SECTION 1 : APPROVISIONNEMENT MATIÈRES PREMIÈRES */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-400" /> Approvisionnement Matières Premières
              </h2>
              <p className="text-xs text-slate-400">Achetez vos barres et lopins bruts. La réapprovisionnement automatique se débloque dans l'onglet Technologie (Méthodes).</p>
            </div>
            {techFx.materialSave > 0 && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-black">
                Lean 4.0 actif : -{Math.round(techFx.materialSave * 100)}% chutes matière
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MATERIALS_CATALOG.map(mat => {
              const locked = mat.reqTech && !game.unlockedTechs.includes(mat.reqTech);
              const reqTechObj = locked ? TECH_TREE.find(t => t.id === mat.reqTech) : null;
              const stockKg = game.materials[mat.id] || 0;
              const ratePerMin = materialConsumptionPerMin[mat.id] || 0;
              const autoRule = game.autoRestock?.[mat.id] || { enabled: false, thresholdKg: 15, buyKg: 30 };

              return (
                <div key={mat.id} className={`rounded-2xl p-4 border-2 flex flex-col justify-between ${locked ? 'bg-slate-950/60 border-slate-800/80 opacity-65' : 'bg-slate-950 border-slate-800'}`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: mat.color }} />
                        <h3 className="font-black text-white text-sm">{mat.name}</h3>
                      </div>
                      <span className="font-mono text-xs font-black text-amber-400">{mat.pricePerKg} €/kg</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{mat.desc}</p>

                    {locked ? (
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-amber-300 flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Débloqué par : <b>{reqTechObj?.name}</b></span>
                      </div>
                    ) : (
                      <>
                        <div className="mt-3 flex items-center justify-between bg-slate-900 rounded-xl px-3 py-2 border border-slate-800 font-mono">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">En Stock</div>
                            <div className="text-base font-black text-white">{formatWeight(stockKg)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] text-slate-500 uppercase">Consommation</div>
                            <div className="text-xs font-bold text-amber-400">{ratePerMin > 0 ? `-${ratePerMin.toFixed(1)} kg/min` : '0 kg/min'}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[10, 50, 200].map(qty => {
                            const cost = qty * mat.pricePerKg;
                            const canBuy = game.money >= cost;
                            return (
                              <button
                                key={qty}
                                onClick={() => handleBuyMaterial(mat.id, qty)}
                                disabled={!canBuy}
                                className={`py-1.5 rounded-xl text-[11px] font-black transition ${canBuy ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                              >
                                +{qty}kg<div className="text-[9px] font-mono opacity-80">{formatMoney(cost)}</div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Auto-restock si débloqué */}
                        {techFx.autoRestockUnlock && (
                          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Réappro auto (&lt;15kg → +30kg)</span>
                            <button
                              onClick={() => setGame(prev => ({
                                ...prev,
                                autoRestock: {
                                  ...prev.autoRestock,
                                  [mat.id]: { enabled: !autoRule.enabled, thresholdKg: 15, buyKg: 30 }
                                }
                              }))}
                              className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${autoRule.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}
                            >
                              {autoRule.enabled ? 'ACTIF' : 'OFF'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2 : INVENTAIRE DES LOTS DE PRODUITS FINIS & VENTE MANUELLE */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" /> Stock de Pièces Finies (Gestion par Lots)
                </h2>
                <p className="text-xs text-slate-400">Contrôlez vos lots en métrologie pour certifier leur conformité (+8% de valeur) avant de les vendre ou livrer.</p>
              </div>
              {uninspectedCount > 0 && (
                <button
                  onClick={handleInspectAllLots}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center gap-1.5 shadow"
                >
                  <Microscope className="w-4 h-4" /> Contrôler tous les lots ({uninspectedCount})
                </button>
              )}
            </div>

            {game.finishedLots.length === 0 ? (
              <div className="py-12 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl text-sm">
                Aucune pièce en stock. Installez et lancez une machine dans l'onglet <b>Atelier & Production</b> !
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                {game.finishedLots.map(lot => {
                  const part = PARTS_CATALOG.find(p => p.id === lot.partId);
                  const unitPrice = FactoryEngine.computeUnitSalePrice(lot, marketDemand, certs, techFx);
                  const margin = unitPrice - lot.unitCost;
                  const sellable = Math.max(0, lot.quantity - (lot.reserved || 0));
                  const statusBadge =
                    lot.status === 'conforming' ? { text: 'CONFORME ✓', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' } :
                    lot.status === 'non_conforming' ? { text: 'NON CONFORME ✕', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' } :
                    { text: 'NON CONTRÔLÉ', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };

                  return (
                    <div key={lot.lotId} className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{part?.name}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>{statusBadge.text}</span>
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-1 flex flex-wrap gap-3">
                          <span>Qté : <b className="text-white">{lot.quantity}</b> {lot.reserved > 0 && <span className="text-amber-400">({lot.reserved} rés. contrat)</span>}</span>
                          <span>Qualité : <b className="text-emerald-300">{lot.quality}/100</b></span>
                          <span>Précision : <b className="text-cyan-300">{lot.precision}/100</b></span>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs">
                        <div className="text-emerald-400 font-black">{formatMoney(unitPrice)} / pc</div>
                        <div className="text-[10px] text-slate-400">
                          Coût : {formatMoney(lot.unitCost)} • Marge : <span className={margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatMoney(margin)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {lot.status === 'uninspected' && (
                          <button
                            onClick={() => handleInspectLot(lot.lotId)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-black transition flex items-center gap-1"
                          >
                            <Microscope className="w-3.5 h-3.5" /> Contrôler
                          </button>
                        )}
                        {lot.status === 'non_conforming' && sellable > 0 && (
                          <button
                            onClick={() => handleRecycleLot(lot.lotId)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-black transition flex items-center gap-1"
                          >
                            <Recycle className="w-3.5 h-3.5" /> Recycler
                          </button>
                        )}
                        <button
                          disabled={sellable <= 0}
                          onClick={() => { setSellModalLotId(lot.lotId); setSellQuantity(sellable); }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition ${sellable > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                          Vendre ({sellable})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3 : RÈGLES DE VENTE AUTOMATIQUE & MARCHÉ */}
          <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h2 className="text-base font-black text-white flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-amber-400" /> Vente Automatique & Marché
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Activez l'expédition automatique par référence. Les pièces réservées aux contrats et les lots non conformes ne sont <b>jamais</b> vendus automatiquement.
            </p>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
              {activeParts.map(part => {
                const rule = game.autoSellRules?.[part.id] || { enabled: false, minKeep: 10 };
                const demand = marketDemand[part.id] || 1.0;
                const pct = Math.round((demand - 1) * 100);
                return (
                  <div key={part.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-white">{part.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Base {part.baseValue} € • Marché : <span className={pct >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{pct >= 0 ? `+${pct}%` : `${pct}%`}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setGame(prev => ({
                          ...prev,
                          autoSellRules: { ...prev.autoSellRules, [part.id]: { ...rule, enabled: !rule.enabled } }
                        }))}
                        className={`px-3 py-1 rounded-full text-[10px] font-black transition ${rule.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}
                      >
                        {rule.enabled ? 'AUTO ON' : 'MANUEL'}
                      </button>
                    </div>

                    {rule.enabled && (
                      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800">
                        <span className="text-slate-400">Stock min. à conserver :</span>
                        <div className="flex items-center gap-1.5">
                          {[0, 10, 25, 50].map(val => (
                            <button
                              key={val}
                              onClick={() => setGame(prev => ({
                                ...prev,
                                autoSellRules: { ...prev.autoSellRules, [part.id]: { ...rule, minKeep: val } }
                              }))}
                              className={`px-2 py-0.5 rounded font-mono font-bold ${rule.minKeep === val ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // VUE 3 : MÉTROLOGIE, AUTOMATISATION & AGRANDISSEMENT LOCAUX
  // ==========================================================================
  const renderMetrologyAndSupportTab = () => (
    <div className="space-y-6">
      {/* Laboratoire de Métrologie */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Microscope className="w-5 h-5 text-cyan-400" /> Laboratoire de Métrologie & Contrôle Qualité
            </h2>
            <p className="text-xs text-slate-400">
              Ces instruments ne fabriquent pas de pièces : ils détectent les non-conformités, améliorent les procédés suivants et débloquent les certifications ISO 9001 & EN 9100.
            </p>
          </div>
          <div className="flex gap-3 font-mono text-xs bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <span>Détection : <b className="text-cyan-400">{Math.round(metroProfile.detectionRate * 100)}%</b></span>
            <span>Précision max : <b className="text-emerald-400">{metroProfile.maxMeasurablePrecision}/100</b></span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {METROLOGY_CATALOG.map(m => {
            const owned = game.metrology.includes(m.id);
            const locked = m.reqTech && !game.unlockedTechs.includes(m.reqTech);
            const reqTechObj = locked ? TECH_TREE.find(t => t.id === m.reqTech) : null;
            const canBuy = !owned && !locked && game.money >= m.cost;

            return (
              <div key={m.id} className={`rounded-2xl p-4 border-2 flex flex-col justify-between ${owned ? 'bg-emerald-950/25 border-emerald-500/40' : 'bg-slate-950 border-slate-800'}`}>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-white text-sm">{m.name}</h3>
                    {owned && <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Installé</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{m.desc}</p>
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                    <div className="bg-slate-900 rounded-lg p-1.5"><div className="text-slate-500">Détect.</div><div className="text-cyan-300 font-black">{Math.round(m.detectionRate * 100)}%</div></div>
                    <div className="bg-slate-900 rounded-lg p-1.5"><div className="text-slate-500">Portée</div><div className="text-white font-black">{m.maxMeasurablePrecision}</div></div>
                    <div className="bg-slate-900 rounded-lg p-1.5"><div className="text-slate-500">Procédé</div><div className="text-emerald-300 font-black">+{m.processFeedbackBonus}</div></div>
                  </div>
                </div>
                <div className="mt-4">
                  {owned ? (
                    <div className="w-full py-2 text-center rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-black">Opérationnel en Laboratoire</div>
                  ) : locked ? (
                    <div className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Tech requise : {reqTechObj?.name}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyMetrology(m.id)}
                      disabled={!canBuy}
                      className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-between px-4 transition ${canBuy ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                    >
                      <span>Acquérir</span>
                      <span className="font-mono">{formatMoney(m.cost)}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Équipements de Support & Automatisation + Locaux */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <h2 className="text-lg font-black text-white flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-amber-400" /> Équipements de Support & Automatisation
          </h2>
          <p className="text-xs text-slate-400 mb-4">Améliorent les temps de cycle, la stabilité de coupe et réduisent les coûts d'exploitation.</p>

          <div className="space-y-3">
            {SUPPORT_CATALOG.map(s => {
              const owned = game.support.includes(s.id);
              const locked = s.reqTech && !game.unlockedTechs.includes(s.reqTech);
              const reqTechObj = locked ? TECH_TREE.find(t => t.id === s.reqTech) : null;
              const canBuy = !owned && !locked && game.money >= s.cost;
              return (
                <div key={s.id} className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 ${owned ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-black text-white text-sm">{s.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.desc}</div>
                  </div>
                  {owned ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 text-xs font-black flex items-center gap-1"><Check className="w-4 h-4" /> Actif</span>
                  ) : locked ? (
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-300 text-[11px] font-bold flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> {reqTechObj?.name}</span>
                  ) : (
                    <button
                      onClick={() => handleBuySupport(s.id)}
                      disabled={!canBuy}
                      className={`px-4 py-2 rounded-xl text-xs font-black font-mono transition ${canBuy ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                    >
                      {formatMoney(s.cost)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agrandir les Murs & Revêtements de sol */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h3 className="text-base font-black text-white flex items-center gap-2 mb-3">
              <Factory className="w-5 h-5 text-cyan-400" /> Agrandir les Murs de l'Usine
            </h3>
            <div className="space-y-2">
              {ATELIER_UPGRADES.sizes.map(s => {
                const isCur = s.level === game.atelier.sizeLevel;
                const isNext = s.level === game.atelier.sizeLevel + 1;
                const done = s.level < game.atelier.sizeLevel;
                const canAff = game.money >= s.cost;
                if (done) return <div key={s.level} className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold flex justify-between"><span>{s.name} ({s.slots} îlots)</span><Check className="w-4 h-4" /></div>;
                if (isCur) return <div key={s.level} className="p-3 rounded-xl bg-slate-800 border border-cyan-500/40 text-white text-xs font-bold flex justify-between"><span>{s.name} ({s.slots} îlots)</span><span className="text-cyan-400">Actuel</span></div>;
                if (isNext) return (
                  <button
                    key={s.level}
                    disabled={!canAff}
                    onClick={() => {
                      if (!canAff) return;
                      setGame(prev => ({ ...prev, money: prev.money - s.cost, atelier: { ...prev.atelier, sizeLevel: s.level } }));
                      showMsg(`🏗️ Usine agrandie : ${s.name} (${s.slots} îlots) !`, "success");
                    }}
                    className={`w-full p-3 rounded-xl text-xs font-black flex justify-between items-center transition ${canAff ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'}`}
                  >
                    <span>Agrandir : {s.name} ({s.slots} îlots)</span>
                    <span className="font-mono">{formatMoney(s.cost)}</span>
                  </button>
                );
                return <div key={s.level} className="p-3 rounded-xl bg-slate-950/60 text-slate-600 text-xs font-bold flex justify-between"><span>{s.name} ({s.slots} îlots)</span><Lock className="w-3.5 h-3.5" /></div>;
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <h3 className="text-base font-black text-white flex items-center gap-2 mb-3">
              <Sliders className="w-5 h-5 text-emerald-400" /> Sols & Stabilité Vibratoire
            </h3>
            <div className="space-y-2">
              {ATELIER_UPGRADES.floors.map((f, idx) => {
                const curIdx = ATELIER_UPGRADES.floors.findIndex(x => x.id === game.atelier.floor);
                if (idx < curIdx) return <div key={f.id} className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold flex justify-between"><span>{f.name}</span><Check className="w-4 h-4" /></div>;
                if (idx === curIdx) return <div key={f.id} className="p-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-white text-xs font-bold flex justify-between"><span>{f.name}</span><span className="text-emerald-400">Installé</span></div>;
                if (idx === curIdx + 1) {
                  const canAff = game.money >= f.cost;
                  return (
                    <button
                      key={f.id}
                      disabled={!canAff}
                      onClick={() => {
                        if (!canAff) return;
                        setGame(prev => ({ ...prev, money: prev.money - f.cost, atelier: { ...prev.atelier, floor: f.id } }));
                        showMsg(`✨ Sol posé : ${f.name}`, "success");
                      }}
                      className={`w-full p-3 rounded-xl text-xs font-black flex justify-between items-center transition ${canAff ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-950 text-slate-500 border border-slate-800 cursor-not-allowed'}`}
                    >
                      <span>{f.name}</span>
                      <span className="font-mono">{formatMoney(f.cost)}</span>
                    </button>
                  );
                }
                return <div key={f.id} className="p-3 rounded-xl bg-slate-950/60 text-slate-600 text-xs font-bold flex justify-between"><span>{f.name}</span><Lock className="w-3.5 h-3.5" /></div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================================================
  // VUE 4 : ARBRE TECHNOLOGIQUE INDUSTRIEL (6 BRANCHES)
  // ==========================================================================
  const renderTechTreeTab = () => {
    const visibleBranches = selectedTechBranch === 'all'
      ? TECH_BRANCHES
      : TECH_BRANCHES.filter(b => b.id === selectedTechBranch);

    return (
      <div className="space-y-5">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-cyan-400" /> Arbre Technologique Industriel ({game.unlockedTechs.length}/{TECH_TREE.length})
            </h2>
            <p className="text-xs text-slate-400">
              Investissez vos bénéfices et vos <b>Points de Recherche (PR)</b> obtenus via la production, les missions et les contrats.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTechBranch('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${selectedTechBranch === 'all' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
            >
              Toutes (6)
            </button>
            {TECH_BRANCHES.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedTechBranch(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${selectedTechBranch === b.id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleBranches.map(branch => {
            const nodes = TECH_TREE.filter(t => t.branch === branch.id);
            return (
              <div key={branch.id} className={`bg-slate-900 border-2 ${branch.border} rounded-3xl p-4 flex flex-col gap-3 shadow-xl`}>
                <div className={`px-3 py-2 rounded-2xl ${branch.bg} flex items-center justify-between`}>
                  <h3 className={`font-black text-sm uppercase tracking-wider ${branch.color}`}>{branch.name}</h3>
                  <span className="text-xs font-mono font-bold text-slate-300">
                    {nodes.filter(n => game.unlockedTechs.includes(n.id)).length}/{nodes.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {nodes.map((node, i) => {
                    const acquired = game.unlockedTechs.includes(node.id);
                    const missingPrereqs = node.prereqs.filter(p => !game.unlockedTechs.includes(p));
                    const available = !acquired && missingPrereqs.length === 0;
                    const canAfford = available && game.money >= node.costMoney && game.researchPoints >= node.costRP;

                    return (
                      <div key={node.id} className="relative">
                        {i > 0 && <div className="w-0.5 h-3 bg-slate-700 mx-auto -mt-3 mb-0" />}
                        <div className={`rounded-2xl p-3.5 border-2 transition ${
                          acquired ? 'bg-emerald-950/30 border-emerald-500/50' :
                          available ? 'bg-slate-950 border-cyan-500/40' :
                          'bg-slate-950/50 border-slate-800/80 opacity-65'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-white text-sm">{node.name}</span>
                            {acquired ? (
                              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">ACQUIS ✓</span>
                            ) : available ? (
                              <span className="text-[10px] font-black text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full">DISPONIBLE</span>
                            ) : (
                              <span className="text-[10px] font-black text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3" /> VERROUILLÉ</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{node.desc}</p>
                          <div className="mt-2 text-[10px] text-cyan-300 font-bold bg-slate-900 rounded-lg px-2.5 py-1 border border-slate-800">
                            Débloque : {node.unlocks}
                          </div>

                          {!acquired && missingPrereqs.length > 0 && (
                            <div className="mt-2 text-[10px] text-amber-300 font-bold">
                              Prérequis : {missingPrereqs.map(p => TECH_TREE.find(x => x.id === p)?.name).join(', ')}
                            </div>
                          )}

                          {!acquired && (
                            <button
                              disabled={!canAfford}
                              onClick={() => handleUnlockTech(node.id)}
                              className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-between transition ${
                                canAfford ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white shadow' : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                              }`}
                            >
                              <span>Rechercher</span>
                              <span className="font-mono flex items-center gap-2">
                                <span className={game.money >= node.costMoney ? 'text-emerald-200' : 'text-rose-400'}>{formatMoney(node.costMoney)}</span>
                                <span>•</span>
                                <span className={game.researchPoints >= node.costRP ? 'text-amber-200' : 'text-rose-400'}>{node.costRP} PR</span>
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // VUE 5 : APPELS D'OFFRES, CONTRATS, MISSIONS & RÉPUTATION
  // ==========================================================================
  const renderContractsTab = () => {
    const acceptedContracts = game.contracts.filter(c => c.status === 'accepted');
    const availableContracts = game.contracts.filter(c => c.status === 'available');

    const missionCtx = {
      stats: { ...game.stats, machinesInstalled: machinesInstalledCount },
      metrology: game.metrology,
      unlockedTechs: game.unlockedTechs,
      certs
    };

    return (
      <div className="space-y-6">
        {/* Tableau Réputation & Certifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> Réputation Entreprise : {globalReputation}/100
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Réussissez vos appels d'offres dans les délais pour accéder aux donneurs d'ordres Automobile, Aéronautique et Spatial.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${certs.iso9001 ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4" /> ISO 9001 {certs.iso9001 ? 'CERTIFIÉ' : '(Tech + Optique + Qual≥40)'}
              </span>
              <span className={`px-3 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${certs.en9100 ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                <ShieldCheck className="w-4 h-4" /> EN 9100 {certs.en9100 ? 'CERTIFIÉ' : '(Tech + MMT + Qual≥65)'}
              </span>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Qualité', val: game.reputation.quality, color: 'bg-emerald-500' },
              { label: 'Fiabilité', val: game.reputation.reliability, color: 'bg-cyan-500' },
              { label: 'Innovation', val: game.reputation.innovation, color: 'bg-purple-500' },
              { label: 'Capacité', val: game.reputation.capacity, color: 'bg-blue-500' },
              { label: 'Délais', val: game.reputation.delivery, color: 'bg-amber-500' }
            ].map(p => (
              <div key={p.label} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-slate-400 uppercase font-black">{p.label}</div>
                <div className="text-lg font-mono font-black text-white my-1">{Math.round(p.val)}</div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${p.color}`} style={{ width: `${clamp(p.val, 0, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Appels d'offres & Contrats */}
          <div className="xl:col-span-7 space-y-5">
            {/* Contrats en cours */}
            {acceptedContracts.length > 0 && (
              <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5 shadow-xl space-y-3">
                <h3 className="text-base font-black text-emerald-300 flex items-center gap-2">
                  <FileCheck className="w-5 h-5" /> Contrats Acceptés en Cours ({acceptedContracts.length}/3)
                </h3>
                {acceptedContracts.map(c => {
                  const part = PARTS_CATALOG.find(p => p.id === c.partId);
                  const ready = getMatchingStockForContract(c);
                  const pct = clamp((ready / c.quantity) * 100, 0, 100);
                  const canDeliver = ready >= c.quantity;
                  return (
                    <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs text-amber-400 font-black uppercase">{c.clientName} • {c.clientBadge}</div>
                          <div className="text-base font-black text-white">{c.quantity} × {part?.name}</div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-emerald-400 font-black text-base">{formatMoney(c.agreedReward)}</div>
                          <div className="text-xs text-amber-300 flex items-center justify-end gap-1"><Clock className="w-3.5 h-3.5" /> {formatDuration(c.remainingSec)}</div>
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 flex flex-wrap gap-3">
                        <span>Qualité min : <b className="text-white">{c.minQuality}/100</b></span>
                        <span>Précision min : <b className="text-white">{c.minPrecision}/100</b></span>
                        <span>Récompense R&D : <b className="text-cyan-300">+{c.rewardRP} PR</b></span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className={`h-full transition-all ${canDeliver ? 'bg-emerald-400' : 'bg-cyan-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-mono font-bold text-slate-300">Stock conforme prêt : {ready} / {c.quantity}</span>
                        <button
                          disabled={!canDeliver}
                          onClick={() => handleDeliverContract(c.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition ${canDeliver ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                        >
                          {canDeliver ? 'Livrer & Encaisser →' : 'En production...'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Appels d'offres disponibles */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-amber-400" /> Appels d'Offres Industriels Disponibles
                </h3>
                <button
                  onClick={() => setGame(prev => ({
                    ...prev,
                    contracts: [
                      ...prev.contracts.filter(c => c.status !== 'available'),
                      FactoryEngine.generateContract(prev.unlockedTechs, globalReputation, certs),
                      FactoryEngine.generateContract(prev.unlockedTechs, globalReputation, certs),
                      FactoryEngine.generateContract(prev.unlockedTechs, globalReputation, certs)
                    ]
                  }))}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Nouvelles offres
                </button>
              </div>

              {availableContracts.map(c => {
                const part = PARTS_CATALOG.find(p => p.id === c.partId);
                const mat = MATERIALS_CATALOG.find(m => m.id === c.materialId);
                const hasMachine = game.slots.some(s => s && part?.compatibleMachines.includes(s.machineId));
                const certOk = !c.reqCert || (c.reqCert === 'iso9001' ? certs.iso9001 : certs.en9100);
                const repOk = globalReputation >= c.minRep;
                const canAccept = certOk && repOk;

                return (
                  <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">{c.clientBadge}</span>
                        <h4 className="text-sm font-black text-white mt-1">{c.clientName} — {c.quantity} × {part?.name}</h4>
                        <div className="text-[11px] text-slate-400">Matière : <b>{mat?.name}</b> • Délai : <b>{formatDuration(c.deadlineSec)}</b></div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-base font-black text-emerald-400">{formatMoney(c.baseReward)}</div>
                        <div className="text-[11px] text-cyan-300 font-bold">+{c.rewardRP} PR</div>
                      </div>
                    </div>

                    {/* Diagnostic de faisabilité explicite */}
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Qualité ≥ {c.minQuality}</span>
                      <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Précision ≥ {c.minPrecision}</span>
                      <span className={`px-2 py-1 rounded-lg border ${hasMachine ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'}`}>
                        {hasMachine ? 'Machine compatible ✓' : 'Machine à installer'}
                      </span>
                      {c.reqCert && (
                        <span className={`px-2 py-1 rounded-lg border ${certOk ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/15 border-rose-500/30 text-rose-300'}`}>
                          Certif {c.reqCert.toUpperCase()} {certOk ? '✓' : 'manquante'}
                        </span>
                      )}
                      {!repOk && (
                        <span className="px-2 py-1 rounded-lg border bg-rose-500/15 border-rose-500/30 text-rose-300">
                          Réputation {c.minRep} requise
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        disabled={!canAccept}
                        onClick={() => handleAcceptContract(c.id, 'standard')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition ${canAccept ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                      >
                        Accepter ({formatMoney(c.baseReward)})
                      </button>
                      <button
                        disabled={!canAccept}
                        onClick={() => handleAcceptContract(c.id, 'premium')}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition ${canAccept ? 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}`}
                      >
                        Soumission +15%
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Missions reliées aux vrais événements du jeu */}
          <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" /> Missions & Objectifs Industriels
            </h3>
            <div className="space-y-2.5 max-h-[680px] overflow-y-auto custom-scrollbar pr-1">
              {MISSIONS_CATALOG.map(m => {
                const claimed = game.claimedMissions.includes(m.id);
                const done = m.check(missionCtx);
                const [cur, max] = m.progress(missionCtx);
                const pct = clamp((cur / max) * 100, 0, 100);

                return (
                  <div key={m.id} className={`rounded-2xl p-3.5 border ${claimed ? 'bg-slate-950/40 border-slate-800/60 opacity-60' : done ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${m.type === 'main' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-purple-500/15 text-purple-300'}`}>
                          {m.type === 'main' ? 'Principale' : 'Secondaire'}
                        </span>
                        <h4 className="text-sm font-black text-white mt-1">{m.title}</h4>
                        <p className="text-[11px] text-slate-400">{m.desc}</p>
                      </div>
                      <div className="text-right font-mono text-[11px] shrink-0">
                        <div className="text-emerald-400 font-black">+{formatMoney(m.rewardMoney)}</div>
                        <div className="text-cyan-300 font-bold">+{m.rewardRP} PR</div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className={`h-full ${done ? 'bg-emerald-400' : 'bg-cyan-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{cur}/{max}</span>
                      {claimed ? (
                        <span className="text-[10px] font-black text-emerald-400">Validée ✓</span>
                      ) : done ? (
                        <button
                          onClick={() => handleClaimMission(m)}
                          className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black shadow"
                        >
                          Réclamer
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // VUE 6 : ÉQUIPE & RECRUTEMENT (VOS 12 CARTES + AVATARS 5x2 PRÉSERVÉS)
  // ==========================================================================
  const renderStaffTab = () => {
    const grouped = {};
    game.inventory.forEach(item => {
      const tpl = EMPLOYEES_CATALOG.find(e => e.id === item.templateId);
      if (!tpl) return;
      const key = `${tpl.id}_${item.stars || 1}`;
      if (!grouped[key]) grouped[key] = { template: { ...tpl, ...item, stars: item.stars || 1 }, count: 0, items: [] };
      grouped[key].count++;
      grouped[key].items.push(item);
    });
    const list = Object.values(grouped).sort((a, b) => b.template.qualBonus - a.template.qualBonus);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-xl flex flex-col items-center justify-center min-h-[420px]">
          {chestAnim ? (
            <div className="py-10">
              <Package className="w-20 h-20 text-amber-400 mx-auto animate-bounce" />
              <div className="mt-4 text-lg font-black text-amber-300">Recrutement en cours...</div>
            </div>
          ) : chestResult ? (
            <div className="flex flex-col items-center w-full animate-card-reveal">
              <div className="text-xs font-black uppercase text-amber-400 mb-2">Nouveau Spécialiste Recruté !</div>
              <div className="w-56"><EmployeeCard employee={chestResult} spriteSheetUrl={spriteSheetUrl} /></div>
              <button onClick={() => setChestResult(null)} className="mt-4 px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-black">Continuer</button>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-400/50 flex items-center justify-center mb-4">
                <Package className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-xl font-black text-white">Caisse de Recrutement</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5">
                Recrutez vos opérateurs et ingénieurs. Affectés sur une machine, ils réduisent les temps de cycle et augmentent la <b>Qualité</b> et la <b>Précision</b> réelles des pièces produites !
              </p>
              <button
                disabled={game.money < chestCost}
                onClick={handleOpenChest}
                className={`w-full py-3.5 rounded-2xl font-black text-sm transition ${game.money >= chestCost ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
              >
                Recruter ({formatMoney(chestCost)})
              </button>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px] font-mono">
                {Object.entries(CHEST_ODDS).map(([r, p]) => (
                  <span key={r} className={`${RARITY_META[r].text} bg-slate-950 px-2 py-1 rounded-lg border border-slate-800`}>{RARITY_META[r].label} {p}%</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> Équipe & Spécialistes ({game.inventory.length})
            </h3>
            <label className="cursor-pointer text-xs text-cyan-300 hover:text-white font-black bg-cyan-500/15 hover:bg-cyan-600 border border-cyan-500/40 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition">
              <ImageIcon className="w-3.5 h-3.5" />
              {avatarSource === 'cloud' ? 'Avatars Cloud actifs (Changer)' : 'Importer la planche d\'avatars'}
              <input type="file" accept="image/*" onChange={handleUploadSpriteSheet} className="hidden" />
            </label>
          </div>

          {list.length === 0 ? (
            <div className="py-16 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl text-sm">
              Aucun spécialiste recruté. Ouvrez une caisse pour renforcer la qualité et la cadence de vos machines !
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {list.map(g => {
                const freeCount = g.items.filter(i => !game.slots.some(s => s && s.employeeId === i.uid)).length;
                return (
                  <EmployeeCard
                    key={`${g.template.id}_${g.template.stars}`}
                    employee={g.template}
                    count={g.count}
                    onMerge={freeCount >= 3 ? () => handleMergeCards(g.template) : null}
                    spriteSheetUrl={spriteSheetUrl}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // VUE 7 : CLASSEMENT GÉNÉRAL INDUSTRIEL
  // ==========================================================================
  const renderLeaderboardTab = () => (
    <
