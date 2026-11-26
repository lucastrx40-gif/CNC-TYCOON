import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wrench, Cog, Package, Gauge, FileSpreadsheet, Cpu, Gift, Trophy,
  Building2, HelpCircle, X, Trash2, Lock, Award, Lightbulb,
  Layers, RefreshCw, LogOut, Save, Download, Upload
} from 'lucide-react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, collection, getDocs, query, limit
} from 'firebase/firestore';

// ============================================================================
// 1. CONFIGURATION FIREBASE & SÉCURITÉ ANTI-TRICHE / SAUVEGARDE ROBUSTE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDemoKeyReplaceWithYourOwn",
  authDomain: "cnc-tycoon-gmp.firebaseapp.com",
  projectId: "cnc-tycoon-gmp",
  storageBucket: "cnc-tycoon-gmp.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000"
};

let db = null;
let auth = null;
try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Mode hors-ligne local actif (Firebase non configuré).", e);
}

const SEASON_APP_ID = 'cnc-empire-s2';
const SAVE_STORAGE_KEY = 'cnc_gmp_save_s2_v2';
const SAVE_BACKUP_KEY = 'cnc_gmp_save_s2_backup';
const LEGACY_KEYS = ['cnc_gmp_save_s2_v1', 'cnc_save_v6', 'cnc_save_v2', 'cnc_money', 'cnc_slots', 'cnc_inventory', 'cnc_atelier'];
const SECURITY_SALT = 'GMP_CNC_TYCOON_S2_9841_SEC';

function computeIntegrityHash(payloadStr) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1b873593;
  const full = `${SECURITY_SALT}|${payloadStr}|${SECURITY_SALT}`;
  for (let i = 0; i < full.length; i++) {
    const ch = full.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function encodeSecureSave(dataObj) {
  const json = JSON.stringify(dataObj);
  const sig = computeIntegrityHash(json);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `GMPSEC2.${sig}.${b64}`;
}

function decodeSecureSave(raw) {
  if (!raw || typeof raw !== 'string' || !raw.startsWith('GMPSEC2.')) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [, sig, b64] = parts;
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    if (computeIntegrityHash(json) !== sig) {
      console.warn('Signature de sauvegarde invalide détectée.');
      return null;
    }
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadBestLocalSave(targetPseudo = '') {
  const cleanTarget = targetPseudo.trim().toLowerCase();
  const candidates = [
    decodeSecureSave(localStorage.getItem(SAVE_STORAGE_KEY)),
    decodeSecureSave(localStorage.getItem(SAVE_BACKUP_KEY)),
    cleanTarget ? decodeSecureSave(localStorage.getItem(`${SAVE_STORAGE_KEY}_${cleanTarget}`)) : null
  ].filter(Boolean);

  if (candidates.length === 0) return null;
  const matchingUser = cleanTarget
    ? candidates.filter(c => !c.pseudo || c.pseudo.trim().toLowerCase() === cleanTarget)
    : candidates;
  const pool = matchingUser.length > 0 ? matchingUser : candidates;
  return pool.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}

// ============================================================================
// 2. CATALOGUES INDUSTRIELS (ÉQUILIBRAGE LONGUE DURÉE)
// ============================================================================
const MATERIALS_CATALOG = [
  { id: 'alu_6061', name: 'Aluminium 6061', costPerKg: 7.5, density: 2.7, diff: 1.0, reqTech: 'mat_base', color: '#38bdf8' },
  { id: 'steel_c45', name: 'Acier C45', costPerKg: 10.5, density: 7.85, diff: 1.15, reqTech: 'mat_base', color: '#94a3b8' },
  { id: 'brass_cw614', name: 'Laiton CuZn39Pb3', costPerKg: 17.0, density: 8.4, diff: 1.05, reqTech: 'mat_inox', color: '#fbbf24' },
  { id: 'inox_316l', name: 'Inox 316L', costPerKg: 24.5, density: 8.0, diff: 1.35, reqTech: 'mat_inox', color: '#cbd5e1' },
  { id: 'peek_hp', name: 'Polymère PEEK', costPerKg: 42.0, density: 1.32, diff: 1.25, reqTech: 'mat_peek', color: '#d97706' },
  { id: 'ti_6al4v', name: 'Titane TA6V', costPerKg: 82.0, density: 4.43, diff: 1.65, reqTech: 'mat_titanium', color: '#a78bfa' }
];

const PARTS_CATALOG = [
  {
    id: 'spacer_alu',
    name: 'Entretoise Cylindrique',
    materialId: 'alu_6061',
    kgPerPart: 0.25,
    baseCycleSec: 8.5,
    sellPrice: 3.2,
    reqTech: null,
    allowedMachines: ['drill_saw', 'manual_lathe', 'cnc_mill_3x', 'bi_spindle', 'cnc_5axis', 'edm_cell', 'slm_laser'],
    desc: 'Pièce de base tournée et percée en série.'
  },
  {
    id: 'shaft_steel',
    name: 'Axe de Transmission',
    materialId: 'steel_c45',
    kgPerPart: 0.65,
    baseCycleSec: 14.0,
    sellPrice: 8.5,
    reqTech: null,
    allowedMachines: ['manual_lathe', 'bi_spindle', 'cnc_5axis'],
    desc: 'Arbre épaulé rectifié pour boîtes mécaniques.'
  },
  {
    id: 'bushing_brass',
    name: 'Bague de Guidage Laiton',
    materialId: 'brass_cw614',
    kgPerPart: 0.35,
    baseCycleSec: 12.5,
    sellPrice: 11.5,
    reqTech: 'mat_inox',
    allowedMachines: ['manual_lathe', 'bi_spindle', 'cnc_5axis'],
    desc: 'Palier antifriction haute précision.'
  },
  {
    id: 'bracket_cnc',
    name: 'Support Fraisé 3 Axes',
    materialId: 'inox_316l',
    kgPerPart: 0.85,
    baseCycleSec: 21.0,
    sellPrice: 24.0,
    reqTech: 'prod_cnc3',
    allowedMachines: ['cnc_mill_3x', 'cnc_5axis', 'edm_cell'],
    desc: 'Équerre structurelle en Inox 316L.'
  },
  {
    id: 'insulator_peek',
    name: 'Isolateur PEEK Haute Temp.',
    materialId: 'peek_hp',
    kgPerPart: 0.20,
    baseCycleSec: 18.0,
    sellPrice: 31.0,
    reqTech: 'mat_peek',
    allowedMachines: ['cnc_mill_3x', 'bi_spindle', 'cnc_5axis', 'edm_cell'],
    desc: 'Composant diélectrique pour environnement sévère.'
  },
  {
    id: 'gear_helical',
    name: 'Engrenage Hélicoïdal UGV',
    materialId: 'steel_c45',
    kgPerPart: 1.15,
    baseCycleSec: 28.0,
    sellPrice: 54.0,
    reqTech: 'prod_5axis',
    allowedMachines: ['cnc_5axis', 'edm_cell', 'slm_laser'],
    desc: 'Pignon taillé 5 axes à denture hélicoïdale.'
  },
  {
    id: 'housing_ti',
    name: 'Carter Aéronautique TA6V',
    materialId: 'ti_6al4v',
    kgPerPart: 1.45,
    baseCycleSec: 39.0,
    sellPrice: 125.0,
    reqTech: 'mat_titanium',
    allowedMachines: ['cnc_5axis', 'edm_cell', 'slm_laser'],
    desc: 'Carcasse monobloc allégée en Titane aéronautique.'
  },
  {
    id: 'nozzle_slm',
    name: 'Tuyère Spatielle Inconel/Ti',
    materialId: 'ti_6al4v',
    kgPerPart: 1.80,
    baseCycleSec: 52.0,
    sellPrice: 210.0,
    reqTech: 'prod_slm',
    allowedMachines: ['slm_laser'],
    desc: 'Chambre à canaux régénératifs imprimée par fusion laser.'
  }
];

const MACHINES_CATALOG = [
  {
    id: 'drill_saw',
    name: 'Perceuse à Colonne & Scie',
    category: 'Conventionnel',
    baseCost: 110,
    costMult: 1.42,
    speedMult: 1.0,
    batchSize: 1,
    baseQuality: 72,
    basePrecision: 70,
    reqTech: null,
    defaultPart: 'spacer_alu',
    desc: 'Poste d’ébauche robuste pour entretoises simples.'
  },
  {
    id: 'manual_lathe',
    name: 'Tour Conventionnel',
    category: 'Tournage',
    baseCost: 520,
    costMult: 1.42,
    speedMult: 1.15,
    batchSize: 1,
    baseQuality: 78,
    basePrecision: 77,
    reqTech: null,
    defaultPart: 'shaft_steel',
    desc: 'Tournage parallèle de précision pour axes et bagues.'
  },
  {
    id: 'cnc_mill_3x',
    name: 'Fraiseuse CNC 3 Axes',
    category: 'Fraisage CN',
    baseCost: 2600,
    costMult: 1.42,
    speedMult: 1.35,
    batchSize: 1,
    baseQuality: 85,
    basePrecision: 84,
    reqTech: 'prod_cnc3',
    defaultPart: 'bracket_cnc',
    desc: 'Centre vertical programmable pour pièces prismatiques.'
  },
  {
    id: 'bi_spindle',
    name: 'Tour CNC Bi-Broche',
    category: 'Tournage UGV',
    baseCost: 13500,
    costMult: 1.42,
    speedMult: 1.65,
    batchSize: 2,
    baseQuality: 89,
    basePrecision: 88,
    reqTech: 'prod_bi',
    defaultPart: 'bushing_brass',
    desc: 'Double broche synchronisée produisant 2 pièces par cycle.'
  },
  {
    id: 'cnc_5axis',
    name: 'Centre 5 Axes UGV',
    category: 'Haute Précision',
    baseCost: 64000,
    costMult: 1.42,
    speedMult: 2.0,
    batchSize: 2,
    baseQuality: 93,
    basePrecision: 93,
    reqTech: 'prod_5axis',
    defaultPart: 'gear_helical',
    desc: 'Usinage continu 5 axes pour géométries complexes.'
  },
  {
    id: 'edm_cell',
    name: 'Cellule Électroérosion EDM',
    category: 'Micro-Usinage',
    baseCost: 295000,
    costMult: 1.42,
    speedMult: 2.35,
    batchSize: 3,
    baseQuality: 97,
    basePrecision: 98,
    reqTech: 'prod_edm',
    defaultPart: 'housing_ti',
    desc: 'Découpe par étincelage au micron sans effort de coupe.'
  },
  {
    id: 'slm_laser',
    name: 'Fonderie Laser Titane SLM-900',
    category: 'Fabrication Additive',
    baseCost: 2450000,
    costMult: 1.42,
    speedMult: 2.8,
    batchSize: 4,
    baseQuality: 99,
    basePrecision: 99,
    reqTech: 'prod_slm',
    defaultPart: 'nozzle_slm',
    desc: 'Fusion laser sélective sur lit de poudre métallique (4 pièces/cycle).'
  }
];

const METROLOGY_CATALOG = [
  { id: 'caliper', name: 'Pied à Coulisse & Micromètre', cost: 0, speed: 1.0, detectRate: 0.72, reqTech: 'met_manual', desc: 'Contrôle manuel poste par poste.' },
  { id: 'col2d', name: 'Colonne de Mesure 2D', cost: 2800, speed: 1.8, detectRate: 0.86, reqTech: 'met_col2d', desc: 'Relevés numériques de hauteurs et alésages.' },
  { id: 'cmm3d', name: 'Machine Tridimensionnelle MMT', cost: 26500, speed: 3.0, detectRate: 0.95, reqTech: 'met_cmm', desc: 'Palpage 3D haute précision (requis pour EN 9100).' },
  { id: 'scanner3d', name: 'Scanner Optique 3D Laser', cost: 118000, speed: 5.5, detectRate: 0.995, reqTech: 'met_scanner', desc: 'Numérisation complète et inspection automatique.' }
];

const CERTIFICATIONS_CATALOG = [
  { id: 'iso9001', name: 'ISO 9001', reqRep: 25, reqMetro: 'col2d', bonus: 0.06, desc: '+6% valeur de vente & accès aux contrats Palier 2.' },
  { id: 'en9100', name: 'EN 9100 Aéro', reqRep: 55, reqMetro: 'cmm3d', bonus: 0.11, desc: '+11% valeur de vente & contrats aéronautiques.' },
  { id: 'nadcap', name: 'NADCAP Spatial', reqRep: 85, reqMetro: 'scanner3d', bonus: 0.16, desc: '+16% valeur de vente & appels d’offres spatiaux.' }
];

const ATELIER_UPGRADES = {
  sizes: [
    { id: 'garage', name: 'Atelier Étudiant GMP', slots: 4, cost: 0, cols: 2 },
    { id: 'hall_small', name: 'Hall Mécanique (8 îlots)', slots: 8, cost: 3400, cols: 4 },
    { id: 'hall_med', name: 'Usine de Précision (12 îlots)', slots: 12, cost: 24500, cols: 4 },
    { id: 'hall_large', name: 'Pôle Aéronautique (16 îlots)', slots: 16, cost: 135000, cols: 4 },
    { id: 'complex_20', name: 'Complexe Industriel 4.0 (20 îlots)', slots: 20, cost: 580000, cols: 5 },
    { id: 'gigafactory_24', name: 'Campus Aérospatial (24 îlots)', slots: 24, cost: 2250000, cols: 6 }
  ],
  floors: [
    { id: 'concrete', name: 'Dalle Béton Brut', cost: 0, speedBonus: 0, qualBonus: 0, bg: '#0f172a' },
    { id: 'epoxy', name: 'Résine Époxy Antistatique', cost: 6400, speedBonus: 0.06, qualBonus: 3, bg: '#0c192c' },
    { id: 'cleanroom', name: 'Sol Technique Salle Blanche', cost: 58000, speedBonus: 0.12, qualBonus: 7, bg: '#091e26' }
  ],
  extras: [
    { id: 'crane', name: 'Pont Roulant 5 Tonnes', cost: 9500, effect: '+9% cadence globale', desc: 'Manutention rapide des bruts lourds.' },
    { id: 'agv', name: 'Flotte de Robots AGV', cost: 78000, effect: '+16% cadence globale', desc: 'Approvisionnement autonome des îlots CNC.' }
  ]
};

const TECH_TREE_CATALOG = [
  // Branche 1 : Production
  { id: 'prod_conv', branch: 'Production', name: 'Usinage Conventionnel', moneyCost: 0, rpCost: 0, req: null, x: 455, y: 230, effect: 'Débloque Perceuse & Tour Conventionnel', unlocks: 'Départ' },
  { id: 'prod_cnc3', branch: 'Production', name: 'Commande Numérique 3 Axes', moneyCost: 1850, rpCost: 22, req: 'prod_conv', x: 380, y: 175, effect: 'Débloque Fraiseuse 3 Axes & Support mécanique', unlocks: 'Fraiseuse 3 Axes' },
  { id: 'prod_bi', branch: 'Production', name: 'Tournage Bi-Broche', moneyCost: 11500, rpCost: 60, req: 'prod_cnc3', x: 295, y: 120, effect: 'Débloque Tour Bi-Broche (cadence x2)', unlocks: 'Tour Bi-Broche' },
  { id: 'prod_5axis', branch: 'Production', name: 'Usinage 5 Axes UGV', moneyCost: 48000, rpCost: 145, req: 'prod_bi', crossReq: 'met_cmm', x: 205, y: 78, effect: 'Débloque Centre 5 Axes & Engrenage hélicoïdal', unlocks: 'Centre 5 Axes' },
  { id: 'prod_edm', branch: 'Production', name: 'Électroérosion & Cellules 4.0', moneyCost: 215000, rpCost: 320, req: 'prod_5axis', x: 112, y: 45, effect: 'Débloque Cellule EDM & +20% Précision', unlocks: 'Cellule EDM' },
  { id: 'prod_slm', branch: 'Production', name: 'Fonderie Laser Métal SLM', moneyCost: 1450000, rpCost: 950, req: 'prod_edm', crossReq: 'mat_titanium', x: 42, y: 95, effect: 'Débloque Fonderie Laser Titane SLM-900 & Tuyère Spatielle', unlocks: 'Fonderie SLM-900' },

  // Branche 2 : Métrologie
  { id: 'met_manual', branch: 'Métrologie', name: 'Instruments Manuels', moneyCost: 0, rpCost: 0, req: null, x: 500, y: 205, effect: 'Débloque Pied à Coulisse & Micromètre', unlocks: 'Départ' },
  { id: 'met_col2d', branch: 'Métrologie', name: 'Colonne de Mesure 2D', moneyCost: 2600, rpCost: 28, req: 'met_manual', x: 500, y: 142, effect: 'Débloque Colonne 2D & +15% Détection', unlocks: 'Colonne 2D' },
  { id: 'met_cmm', branch: 'Métrologie', name: 'Machine Tridimensionnelle MMT', moneyCost: 22500, rpCost: 95, req: 'met_col2d', x: 500, y: 82, effect: 'Débloque MMT 3D & Certification EN 9100', unlocks: 'MMT 3D' },
  { id: 'met_scanner', branch: 'Métrologie', name: 'Contrôle Optique Automatisé', moneyCost: 105000, rpCost: 230, req: 'met_cmm', x: 500, y: 32, effect: 'Débloque Scanner Optique 3D (Inspection Auto x3)', unlocks: 'Scanner 3D' },

  // Branche 3 : Qualité
  { id: 'qual_basic', branch: 'Qualité', name: 'Contrôle Réception & Tri', moneyCost: 0, rpCost: 0, req: null, x: 545, y: 230, effect: 'Active le tri Conforme / Rebut & Recyclage', unlocks: 'Départ' },
  { id: 'qual_spc', branch: 'Qualité', name: 'Maîtrise Statistique (SPC)', moneyCost: 4800, rpCost: 38, req: 'qual_basic', x: 630, y: 175, effect: '+5 Qualité globale & -15% taux de défauts', unlocks: 'Procédé SPC' },
  { id: 'qual_iso', branch: 'Qualité', name: 'Zéro Défaut & Assurance Qualité', moneyCost: 32000, rpCost: 115, req: 'qual_spc', crossReq: 'met_col2d', x: 725, y: 118, effect: '+8 Qualité, +6 Précision & -20% défauts', unlocks: 'Zéro Défaut' },

  // Branche 4 : Méthodes
  { id: 'meth_std', branch: 'Méthodes', name: 'Gammes Standardisées', moneyCost: 0, rpCost: 0, req: null, x: 575, y: 280, effect: 'Optimise la préparation des séries', unlocks: 'Départ' },
  { id: 'meth_smed', branch: 'Méthodes', name: 'SMED & Changement Rapide', moneyCost: 6200, rpCost: 45, req: 'meth_std', x: 685, y: 280, effect: '+10% vitesse de cycle sur toutes les machines', unlocks: '+10% Cadence' },
  { id: 'meth_lean', branch: 'Méthodes', name: 'Lean Manufacturing & Flux Tirés', moneyCost: 46000, rpCost: 135, req: 'meth_smed', crossReq: 'qual_spc', x: 805, y: 280, effect: '+16% vitesse de cycle & +8% valeur commerciale', unlocks: '+16% Cadence & Prix' },

  // Branche 5 : Automatisation
  { id: 'auto_manual', branch: 'Automatisation', name: 'Manutention Manuelle', moneyCost: 0, rpCost: 0, req: null, x: 545, y: 330, effect: 'Alimentation standard des postes', unlocks: 'Départ' },
  { id: 'auto_conv', branch: 'Automatisation', name: 'Convoyeurs & Chargement', moneyCost: 15500, rpCost: 75, req: 'auto_manual', crossReq: 'meth_smed', x: 650, y: 392, effect: '+8% vitesse globale & flux inter-îlots', unlocks: 'Convoyeurs' },
  { id: 'auto_robot', branch: 'Automatisation', name: 'Cellules Robotisées 6 Axes', moneyCost: 92000, rpCost: 210, req: 'auto_conv', crossReq: 'met_scanner', x: 765, y: 455, effect: '+16% vitesse globale & production continue', unlocks: 'Robots 6 Axes' },

  // Branche 6 : Matériaux
  { id: 'mat_base', branch: 'Matériaux', name: 'Alliages Légers & Aciers', moneyCost: 0, rpCost: 0, req: null, x: 455, y: 330, effect: 'Débloque Aluminium 6061 & Acier C45', unlocks: 'Départ' },
  { id: 'mat_inox', branch: 'Matériaux', name: 'Inox 316L & Cuivreux', moneyCost: 6800, rpCost: 42, req: 'mat_base', x: 355, y: 392, effect: 'Débloque Inox 316L, Cuivre & Bague Laiton', unlocks: 'Inox + Cuivre' },
  { id: 'mat_peek', branch: 'Matériaux', name: 'Polymères Techniques PEEK', moneyCost: 23500, rpCost: 88, req: 'mat_inox', x: 255, y: 452, effect: 'Débloque Plastique PEEK & Isolateur Haute Temp.', unlocks: 'Plastique PEEK' },
  { id: 'mat_titanium', branch: 'Matériaux', name: 'Titane Aéronautique TA6V', moneyCost: 88000, rpCost: 205, req: 'mat_peek', crossReq: 'prod_5axis', x: 145, y: 500, effect: 'Débloque Titane TA6V & Carter Aéronautique', unlocks: 'Titane TA6V' },

  // Branche 7 : RH & Recrutement
  { id: 'rh_base', branch: 'RH', name: 'Intérim & Atelier', moneyCost: 0, rpCost: 0, req: null, x: 425, y: 280, effect: 'Débloque Caisse Standard (0.1% Secret)', unlocks: 'Départ' },
  { id: 'rh_headhunt', branch: 'RH', name: 'Chasseurs de Têtes', moneyCost: 14000, rpCost: 65, req: 'rh_base', x: 315, y: 280, effect: 'Débloque Caisse Ingénierie (0% Malus, 0.35% Secret)', unlocks: 'Caisse Ingénierie' },
  { id: 'rh_exec', branch: 'RH', name: 'Recrutement Direction GMP', moneyCost: 96000, rpCost: 225, req: 'rh_headhunt', x: 195, y: 280, effect: 'Débloque Caisse Direction GMP (1% Secret, 6% Mythique)', unlocks: 'Caisse Direction' },
  { id: 'rh_academy', branch: 'RH', name: 'Académie & Tutorat GMP', moneyCost: 340000, rpCost: 440, req: 'rh_exec', crossReq: 'qual_iso', x: 80, y: 280, effect: '+10% efficacité des opérateurs & réduction coûts RH', unlocks: '+10% Bonus RH' }
];

const CRATE_TIERS = [
  {
    id: 'standard',
    name: 'Caisse Standard',
    subtitle: 'Recrutement Atelier',
    baseCost: 450,
    costMult: 1.35,
    reqTech: null,
    badgeColor: 'text-sky-400 border-sky-500/40 bg-sky-950/50',
    accent: '#38bdf8',
    weights: { secret: 0.1, mythique: 1.0, legendaire: 5.0, epique: 12.0, rare: 28.0, commun: 47.0, malus: 6.9 }
  },
  {
    id: 'engineering',
    name: 'Caisse Ingénierie',
    subtitle: 'Zéro Malus • Haute Qualification',
    baseCost: 4800,
    costMult: 1.40,
    reqTech: 'rh_headhunt',
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-950/50',
    accent: '#c084fc',
    weights: { secret: 0.35, mythique: 2.65, legendaire: 12.0, epique: 27.0, rare: 40.0, commun: 18.0, malus: 0 }
  },
  {
    id: 'direction',
    name: 'Caisse Direction GMP',
    subtitle: 'Élite • 1% Secret Garanti dans le Pool',
    baseCost: 38000,
    costMult: 1.45,
    reqTech: 'rh_exec',
    badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-950/50',
    accent: '#fbbf24',
    weights: { secret: 1.0, mythique: 6.0, legendaire: 24.0, epique: 41.0, rare: 28.0, commun: 0, malus: 0 }
  }
];

const EMPLOYEES_CATALOG = [
  { id: 'emp_klepacz', name: 'Mr Klepacz', rarity: 'secret', role: 'Grand Maître UGV', baseMult: 1.15, qualBonus: 14, specialty: 'all', specialtyLabel: 'Toutes Machines', hair: '#cbd5e1', skin: '#f1c27d', shirt: '#be123c', glasses: true },
  { id: 'emp_castagnetti', name: 'Cedric Castagnetti', rarity: 'mythique', role: 'Architecte 5 Axes', baseMult: 0.72, qualBonus: 10, specialty: 'all', specialtyLabel: 'Toutes Machines', hair: '#1e293b', skin: '#e0ac69', shirt: '#b91c1c', glasses: false },
  { id: 'emp_mst', name: 'Ms T', rarity: 'mythique', role: 'Directrice Production', baseMult: 0.68, qualBonus: 9, specialty: 'all', specialtyLabel: 'Toutes Machines', hair: '#7c2d12', skin: '#f1c27d', shirt: '#991b1b', glasses: true },
  { id: 'emp_pompidou', name: 'Pompidou', rarity: 'legendaire', role: 'Stratège Industriel', baseMult: 0.48, qualBonus: 7, specialty: 'cnc_5axis', specialtyLabel: 'Centre 5 Axes', hair: '#94a3b8', skin: '#f1c27d', shirt: '#b45309', glasses: true },
  { id: 'emp_lorriot', name: 'Mr Lorriot', rarity: 'legendaire', role: 'Expert FAO & Cinématique', baseMult: 0.46, qualBonus: 7, specialty: 'edm_cell', specialtyLabel: 'Cellule EDM', hair: '#334155', skin: '#e0ac69', shirt: '#d97706', glasses: false },
  { id: 'emp_marty', name: 'Mme Marty', rarity: 'legendaire', role: 'Cheffe Métrologie', baseMult: 0.45, qualBonus: 8, specialty: 'cnc_mill_3x', specialtyLabel: 'Fraiseuse 3 Axes', hair: '#92400e', skin: '#ffdbac', shirt: '#b45309', glasses: true },
  { id: 'emp_blanchard', name: 'Mr Blanchard', rarity: 'legendaire', role: 'Maître Tourneur', baseMult: 0.44, qualBonus: 6, specialty: 'bi_spindle', specialtyLabel: 'Tour Bi-Broche', hair: '#64748b', skin: '#f1c27d', shirt: '#92400e', glasses: false },
  { id: 'emp_graya', name: 'Mr Graya', rarity: 'legendaire', role: 'Ingénieur Matériaux', baseMult: 0.45, qualBonus: 7, specialty: 'slm_laser', specialtyLabel: 'Fonderie SLM', hair: '#0f172a', skin: '#c68642', shirt: '#d97706', glasses: true },
  { id: 'emp_jeulin', name: 'Mr Jeulin', rarity: 'epique', role: 'Spécialiste Fabrication', baseMult: 0.30, qualBonus: 5, specialty: 'cnc_mill_3x', specialtyLabel: 'Fraiseuse 3 Axes', hair: '#475569', skin: '#f1c27d', shirt: '#6d28d9', glasses: true },
  { id: 'emp_brun', name: 'Mr Brun', rarity: 'epique', role: 'Référent Méthodes', baseMult: 0.28, qualBonus: 4, specialty: 'bi_spindle', specialtyLabel: 'Tour Bi-Broche', hair: '#451a03', skin: '#e0ac69', shirt: '#7e22ce', glasses: false },
  { id: 'emp_renaud', name: 'Mme Renaud', rarity: 'epique', role: 'Ingénieure Qualité', baseMult: 0.28, qualBonus: 6, specialty: 'cnc_5axis', specialtyLabel: 'Centre 5 Axes', hair: '#b45309', skin: '#ffdbac', shirt: '#5b21b6', glasses: true },
  { id: 'emp_pietri', name: 'Mr Pietri', rarity: 'epique', role: 'Technicien UGV', baseMult: 0.29, qualBonus: 4, specialty: 'manual_lathe', specialtyLabel: 'Tour Conv.', hair: '#1e293b', skin: '#e0ac69', shirt: '#6b21a8', glasses: false },
  { id: 'emp_julien', name: 'Julien', rarity: 'rare', role: 'Régleur CN', baseMult: 0.18, qualBonus: 3, specialty: 'cnc_mill_3x', specialtyLabel: 'Fraiseuse 3 Axes', hair: '#78350f', skin: '#f1c27d', shirt: '#0369a1', glasses: false },
  { id: 'emp_lauris', name: 'Lauris Rigal', rarity: 'rare', role: 'Opérateur Tournage', baseMult: 0.18, qualBonus: 3, specialty: 'manual_lathe', specialtyLabel: 'Tour Conv.', hair: '#334155', skin: '#f1c27d', shirt: '#0284c7', glasses: false },
  { id: 'emp_pierre', name: 'Pierre Montant', rarity: 'rare', role: 'Contrôleur Atelier', baseMult: 0.17, qualBonus: 4, specialty: 'drill_saw', specialtyLabel: 'Perceuse/Scie', hair: '#92400e', skin: '#e0ac69', shirt: '#0369a1', glasses: true },
  { id: 'emp_sebastien', name: 'Sebastien', rarity: 'rare', role: 'Fraiseur Confirmé', baseMult: 0.18, qualBonus: 3, specialty: 'cnc_mill_3x', specialtyLabel: 'Fraiseuse 3 Axes', hair: '#1e293b', skin: '#f1c27d', shirt: '#075985', glasses: false },
  { id: 'emp_hugo', name: 'Hugo', rarity: 'commun', role: 'Apprenti GMP', baseMult: 0.10, qualBonus: 2, specialty: 'drill_saw', specialtyLabel: 'Perceuse/Scie', hair: '#a16207', skin: '#ffdbac', shirt: '#334155', glasses: false },
  { id: 'emp_elliot', name: 'Elliot', rarity: 'commun', role: 'Opérateur Débutant', baseMult: 0.08, qualBonus: 1, specialty: 'manual_lathe', specialtyLabel: 'Tour Conv.', hair: '#475569', skin: '#f1c27d', shirt: '#475569', glasses: false },
  { id: 'emp_marylou', name: 'Marylou', rarity: 'malus', role: 'Fraise Casse-Outils', baseMult: -0.25, qualBonus: -6, specialty: 'all', specialtyLabel: 'Malus (-25%)', hair: '#be185d', skin: '#ffdbac', shirt: '#4d7c0f', glasses: true },
  { id: 'emp_werda', name: 'Mme Werda', rarity: 'malus', role: 'Origine d’Arrêt Machine', baseMult: -0.30, qualBonus: -8, specialty: 'all', specialtyLabel: 'Malus (-30%)', hair: '#1e293b', skin: '#e0ac69', shirt: '#3f6212', glasses: true },
  { id: 'emp_benhenni', name: 'Mr Ben henni', rarity: 'malus', role: 'Déréglage Permanent', baseMult: -0.35, qualBonus: -10, specialty: 'all', specialtyLabel: 'Malus (-35%)', hair: '#0f172a', skin: '#c68642', shirt: '#365314', glasses: false }
];

const RARITY_ORDER = { secret: 7, mythique: 6, legendaire: 5, epique: 4, rare: 3, commun: 2, malus: 1 };

const RARITY_CONFIG = {
  secret: { label: 'SECRET (0.1%)', hex: '#fb7185', badge: 'bg-rose-950/90 text-rose-300 border-rose-500', border: 'border-rose-500 shadow-rose-500/30' },
  mythique: { label: 'MYTHIQUE', hex: '#f87171', badge: 'bg-red-950/90 text-red-300 border-red-500', border: 'border-red-500 shadow-red-500/20' },
  legendaire: { label: 'LÉGENDAIRE', hex: '#fbbf24', badge: 'bg-amber-950/90 text-amber-300 border-amber-500', border: 'border-amber-500 shadow-amber-500/20' },
  epique: { label: 'ÉPIQUE', hex: '#c084fc', badge: 'bg-purple-950/90 text-purple-300 border-purple-500', border: 'border-purple-500 shadow-purple-500/20' },
  rare: { label: 'RARE', hex: '#38bdf8', badge: 'bg-sky-950/90 text-sky-300 border-sky-500', border: 'border-sky-500 shadow-sky-500/20' },
  commun: { label: 'COMMUN', hex: '#94a3b8', badge: 'bg-slate-900 text-slate-300 border-slate-600', border: 'border-slate-700' },
  malus: { label: 'MALUS', hex: '#84cc16', badge: 'bg-lime-950/90 text-lime-300 border-lime-600', border: 'border-lime-600/80' }
};

const MISSIONS_CATALOG = [
  { id: 'm_produce_15', title: 'Premiers Copeaux', desc: 'Produire 15 pièces dans votre atelier.', target: 15, statKey: 'partsProduced', rewardMoney: 140, rewardRP: 6 },
  { id: 'm_sell_40', title: 'Premières Expéditions', desc: 'Vendre 40 pièces conformes.', target: 40, statKey: 'partsSold', rewardMoney: 380, rewardRP: 12 },
  { id: 'm_inspect_60', title: 'Rigueur Métrologique', desc: 'Contrôler 60 pièces au laboratoire.', target: 60, statKey: 'partsInspected', rewardMoney: 820, rewardRP: 20 },
  { id: 'm_contract_4', title: 'Fournisseur Fiable', desc: 'Honorer 4 appels d’offres clients.', target: 4, statKey: 'contractsCompleted', rewardMoney: 2600, rewardRP: 38 },
  { id: 'm_produce_400', title: 'Cadence Industrielle', desc: 'Produire 400 pièces au total.', target: 400, statKey: 'partsProduced', rewardMoney: 9500, rewardRP: 75 },
  { id: 'm_contract_15', title: 'Partenaire Aéronautique', desc: 'Honorer 15 appels d’offres.', target: 15, statKey: 'contractsCompleted', rewardMoney: 42000, rewardRP: 180 }
];

// ============================================================================
// 3. UTILITAIRES DE FORMATAGE & GÉNÉRATION DE CONTRATS
// ============================================================================
function formatMoney(val) {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)} Md$`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)} M$`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)} k$`;
  return `${n.toFixed(0)} $`;
}

function generateContractOffer(reputation, unlockedTechs) {
  const availableParts = PARTS_CATALOG.filter(p => !p.reqTech || unlockedTechs.includes(p.reqTech));
  const part = availableParts[Math.floor(Math.random() * availableParts.length)] || PARTS_CATALOG[0];
  const tier = reputation >= 65 ? 3 : reputation >= 28 ? 2 : 1;
  const qty = tier === 1 ? 15 + Math.floor(Math.random() * 15) : tier === 2 ? 32 + Math.floor(Math.random() * 28) : 65 + Math.floor(Math.random() * 55);
  const minQuality = tier === 1 ? 72 : tier === 2 ? 84 : 92;
  const clients = ['Airbus Atlantic', 'Safran Landing', 'Dassault Systèmes', 'Alstom Transport', 'ArianeGroup', 'Michelin Outillage', 'Thales Avionics'];
  const client = clients[Math.floor(Math.random() * clients.length)];
  const baseReward = Math.round(part.sellPrice * qty * (1.16 + tier * 0.08));
  const rpReward = tier * 9 + Math.floor(qty / 8);
  return {
    id: `ctr_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    client,
    tier,
    partId: part.id,
    qty,
    minQuality,
    baseReward,
    rpReward,
    bidMult: 1.0
  };
}

// ============================================================================
// 4. COMPOSANTS GRAPHIQUES SVG (BROCHE ROTATIVE, PIÈCES, MACHINES, PORTRAITS)
// ============================================================================
const ManualSpindleSVG = ({ rpm, sparks }) => (
  <svg viewBox="0 0 140 140" className="w-28 h-28 mx-auto select-none">
    <defs>
      <radialGradient id="spindleGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity={rpm > 0 ? 0.35 : 0.08} />
        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="70" cy="70" r="64" fill="url(#spindleGlow)" stroke="#1e293b" strokeWidth="2" />
    <circle
      cx="70"
      cy="70"
      r="56"
      fill="none"
      stroke="#38bdf8"
      strokeWidth="3"
      strokeDasharray="352"
      strokeDashoffset={352 - Math.min(352, (rpm / 6000) * 352)}
      strokeLinecap="round"
      transform="rotate(-90 70 70)"
    />
    <rect x="48" y="16" width="44" height="26" rx="4" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
    <rect x="54" y="42" width="32" height="14" rx="2" fill="#475569" stroke="#94a3b8" strokeWidth="1.5" />
    <g style={{ transformOrigin: '70px 76px', animation: rpm > 100 ? `spin ${Math.max(0.12, 1.2 - rpm / 6000)}s linear infinite` : 'none' }}>
      <rect x="64" y="56" width="12" height="38" rx="2" fill="#cbd5e1" stroke="#38bdf8" strokeWidth="1.2" />
      <line x1="64" y1="64" x2="76" y2="70" stroke="#0284c7" strokeWidth="2" />
      <line x1="64" y1="74" x2="76" y2="80" stroke="#0284c7" strokeWidth="2" />
      <line x1="64" y1="84" x2="76" y2="90" stroke="#0284c7" strokeWidth="2" />
    </g>
    <rect x="34" y="96" width="72" height="18" rx="3" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
    {sparks && (
      <g fill="#facc15">
        <circle cx="54" cy="92" r="2.2" />
        <circle cx="86" cy="90" r="2.5" />
        <circle cx="46" cy="85" r="1.8" />
        <circle cx="93" cy="83" r="1.8" />
      </g>
    )}
  </svg>
);

const PartIllustration = ({ partId, sizeClass = 'w-10 h-10' }) => (
  <svg viewBox="0 0 48 48" className={`${sizeClass} shrink-0`}>
    <rect x="2" y="2" width="44" height="44" rx="10" fill="#09111e" stroke="#1e293b" strokeWidth="1.5" />
    {partId === 'spacer_alu' && (
      <g stroke="#38bdf8" strokeWidth="2" fill="#38bdf8" fillOpacity="0.18">
        <ellipse cx="24" cy="15" rx="11" ry="4.5" />
        <path d="M13 15 V33 A11 4.5 0 0 0 35 33 V15" />
        <ellipse cx="24" cy="15" rx="4.5" ry="2" fill="#09111e" />
      </g>
    )}
    {partId === 'shaft_steel' && (
      <g stroke="#cbd5e1" strokeWidth="1.8" fill="#64748b" fillOpacity="0.35">
        <rect x="8" y="20" width="8" height="8" rx="1" />
        <rect x="16" y="15" width="16" height="18" rx="1.5" />
        <rect x="32" y="20" width="8" height="8" rx="1" />
      </g>
    )}
    {partId === 'bushing_brass' && (
      <g stroke="#fbbf24" strokeWidth="2" fill="#fbbf24" fillOpacity="0.22">
        <circle cx="24" cy="24" r="13" />
        <circle cx="24" cy="24" r="6" fill="#09111e" />
      </g>
    )}
    {partId === 'bracket_cnc' && (
      <g stroke="#94a3b8" strokeWidth="2" fill="#94a3b8" fillOpacity="0.22">
        <path d="M13 11 H21 V27 H37 V35 H13 Z" />
        <circle cx="17" cy="16" r="1.5" fill="#38bdf8" />
        <circle cx="31" cy="31" r="1.5" fill="#38bdf8" />
      </g>
    )}
    {partId === 'insulator_peek' && (
      <g stroke="#f59e0b" strokeWidth="2" fill="#d97706" fillOpacity="0.25">
        <rect x="14" y="12" width="20" height="5" rx="1" />
        <rect x="17" y="17" width="14" height="5" rx="1" />
        <rect x="14" y="22" width="20" height="5" rx="1" />
        <rect x="17" y="27" width="14" height="6" rx="1" />
      </g>
    )}
    {partId === 'gear_helical' && (
      <g stroke="#38bdf8" strokeWidth="1.8" fill="#0284c7" fillOpacity="0.25">
        <circle cx="24" cy="24" r="11" />
        <circle cx="24" cy="24" r="4" fill="#09111e" />
        <line x1="24" y1="9" x2="24" y2="13" strokeWidth="2.5" />
        <line x1="24" y1="35" x2="24" y2="39" strokeWidth="2.5" />
        <line x1="9" y1="24" x2="13" y2="24" strokeWidth="2.5" />
        <line x1="35" y1="24" x2="39" y2="24" strokeWidth="2.5" />
      </g>
    )}
    {partId === 'housing_ti' && (
      <g stroke="#a78bfa" strokeWidth="2" fill="#8b5cf6" fillOpacity="0.22">
        <polygon points="24,10 36,17 36,31 24,38 12,31 12,17" />
        <circle cx="24" cy="24" r="5" fill="#09111e" />
      </g>
    )}
    {partId === 'nozzle_slm' && (
      <g stroke="#f97316" strokeWidth="2" fill="#ea580c" fillOpacity="0.25">
        <path d="M18 10 H30 L27 19 L35 36 H13 L21 19 Z" />
      </g>
    )}
  </svg>
);

const MachineIllustration = ({ machineId, active }) => (
  <svg viewBox="0 0 64 48" className="w-14 h-11 shrink-0">
    <rect x="4" y="38" width="56" height="6" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
    {machineId === 'drill_saw' && (
      <g>
        <rect x="28" y="8" width="6" height="30" fill="#64748b" />
        <rect x="20" y="6" width="22" height="8" rx="2" fill="#0284c7" />
        <line x1="31" y1="14" x2="31" y2="28" stroke="#e2e8f0" strokeWidth="2" />
      </g>
    )}
    {machineId === 'manual_lathe' && (
      <g>
        <rect x="8" y="16" width="16" height="22" rx="2" fill="#0369a1" />
        <rect x="24" y="22" width="10" height="10" fill="#cbd5e1" />
        <rect x="44" y="20" width="12" height="18" rx="2" fill="#475569" />
      </g>
    )}
    {machineId === 'cnc_mill_3x' && (
      <g>
        <rect x="10" y="6" width="44" height="32" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.6" />
        <rect x="16" y="12" width="22" height="18" rx="1.5" fill="#0284c7" fillOpacity="0.25" />
        <rect x="42" y="12" width="8" height="12" rx="1" fill="#22c55e" fillOpacity="0.5" />
      </g>
    )}
    {machineId === 'bi_spindle' && (
      <g>
        <rect x="8" y="8" width="48" height="30" rx="3" fill="#0f172a" stroke="#a855f7" strokeWidth="1.6" />
        <rect x="13" y="17" width="11" height="12" fill="#c084fc" />
        <rect x="40" y="17" width="11" height="12" fill="#c084fc" />
        <line x1="24" y1="23" x2="40" y2="23" stroke="#facc15" strokeWidth="2" strokeDasharray="2 2" />
      </g>
    )}
    {machineId === 'cnc_5axis' && (
      <g>
        <rect x="8" y="5" width="48" height="33" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.8" />
        <path d="M20 26 A12 12 0 0 0 44 26" fill="none" stroke="#fbbf24" strokeWidth="2.2" />
        <line x1="32" y1="9" x2="32" y2="22" stroke="#38bdf8" strokeWidth="2.5" />
      </g>
    )}
    {machineId === 'edm_cell' && (
      <g>
        <rect x="10" y="6" width="44" height="32" rx="3" fill="#091526" stroke="#10b981" strokeWidth="1.8" />
        <polygon points="33,10 25,23 32,23 30,34 39,20 32,20" fill="#34d399" />
      </g>
    )}
    {machineId === 'slm_laser' && (
      <g>
        <rect x="8" y="4" width="48" height="34" rx="4" fill="#180c08" stroke="#f97316" strokeWidth="2" />
        <line x1="32" y1="8" x2="32" y2="28" stroke="#fb923c" strokeWidth="2.5" />
        <polygon points="20,34 32,25 44,34" fill="#f97316" fillOpacity="0.6" />
      </g>
    )}
    {active && <circle cx="56" cy="10" r="3" fill="#22c55e" />}
  </svg>
);

const CharacterPortrait = ({ emp, sizeClass = 'w-12 h-12' }) => {
  const [imgError, setImgError] = useState(false);
  if (!emp) return null;
  const rar = RARITY_CONFIG[emp.rarity] || RARITY_CONFIG.commun;

  return (
    <div
      className={`${sizeClass} rounded-xl overflow-hidden border-2 shrink-0 flex items-center justify-center bg-slate-900 relative`}
      style={{ borderColor: rar.hex }}
    >
      {!imgError ? (
        <img
          src={`./avatars/${emp.id}.png`}
          alt={emp.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 64 64" className="w-full h-full">
          <rect width="64" height="64" fill="#0f172a" />
          <circle cx="32" cy="32" r="28" fill={rar.hex} fillOpacity="0.16" />
          <path d="M14 62 C14 47, 50 47, 50 62" fill={emp.shirt || '#334155'} />
          <circle cx="32" cy="29" r="13" fill={emp.skin || '#f1c27d'} />
          <path d="M19 27 C19 14, 45 14, 45 27 C42 20, 22 20, 19 27 Z" fill={emp.hair || '#1e293b'} />
          <circle cx="27" cy="29" r="1.7" fill="#0f172a" />
          <circle cx="37" cy="29" r="1.7" fill="#0f172a" />
          {emp.glasses && (
            <g stroke="#e2e8f0" strokeWidth="1.4" fill="none">
              <rect x="22" y="25.5" width="9" height="6.5" rx="1.5" />
              <rect x="33" y="25.5" width="9" height="6.5" rx="1.5" />
              <line x1="31" y1="28.5" x2="33" y2="28.5" />
            </g>
          )}
          {emp.rarity === 'malus' ? (
            <path d="M27 36 Q32 32 37 36" stroke="#7f1d1d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          ) : (
            <path d="M27 34 Q32 38 37 34" stroke="#78350f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          )}
        </svg>
      )}
    </div>
  );
};

const SupplyCrateSVG = ({ isOpening, rarityColor = '#38bdf8' }) => (
  <svg
    viewBox="0 0 120 96"
    className={`w-28 h-22 transition-transform ${isOpening ? 'animate-bounce scale-105' : ''}`}
  >
    <defs>
      <radialGradient id="crateBeam" cx="50%" cy="60%" r="50%">
        <stop offset="0%" stopColor={rarityColor} stopOpacity={isOpening ? 0.75 : 0.22} />
        <stop offset="100%" stopColor={rarityColor} stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="60" cy="52" rx="52" ry="38" fill="url(#crateBeam)" />
    <rect x="24" y="38" width="72" height="44" rx="6" fill="#1e293b" stroke={rarityColor} strokeWidth="2.5" />
    <line x1="24" y1="54" x2="96" y2="54" stroke="#475569" strokeWidth="2" />
    <line x1="48" y1="38" x2="48" y2="82" stroke="#334155" strokeWidth="2" />
    <line x1="72" y1="38" x2="72" y2="82" stroke="#334155" strokeWidth="2" />
    <g transform={isOpening ? 'translate(0, -10) rotate(-6 60 34)' : ''}>
      <rect x="20" y="26" width="80" height="14" rx="4" fill="#334155" stroke={rarityColor} strokeWidth="2.5" />
      <rect x="52" y="30" width="16" height="10" rx="2" fill={rarityColor} />
    </g>
  </svg>
);

const TechNodeGlyph = ({ node, unlocked, available }) => {
  const c = unlocked ? '#38bdf8' : available ? '#facc15' : '#64748b';
  return (
    <svg viewBox="0 0 36 36" className="w-9 h-9">
      {node.id === 'prod_conv' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="10" y="9" width="16" height="5" rx="1" />
          <line x1="18" y1="14" x2="18" y2="23" />
          <line x1="11" y1="27" x2="25" y2="27" strokeWidth="2.5" />
        </g>
      )}
      {node.id === 'prod_cnc3' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="8" y="8" width="20" height="20" rx="3" />
          <path d="M13 23 L13 13 L23 13" />
          <circle cx="20" cy="20" r="2.5" fill={c} />
        </g>
      )}
      {node.id === 'prod_bi' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="6" y="13" width="7" height="10" rx="1" />
          <rect x="23" y="13" width="7" height="10" rx="1" />
          <line x1="13" y1="18" x2="23" y2="18" strokeDasharray="2 2" />
        </g>
      )}
      {node.id === 'prod_5axis' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <path d="M9 22 A9 9 0 0 0 27 22" />
          <line x1="18" y1="8" x2="18" y2="19" />
          <circle cx="18" cy="22" r="3" fill={c} />
        </g>
      )}
      {node.id === 'prod_edm' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <polygon points="19,7 12,19 18,19 16,29 24,17 18,17" fill={c} fillOpacity="0.25" />
        </g>
      )}
      {node.id === 'prod_slm' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <line x1="18" y1="7" x2="18" y2="20" stroke="#f97316" strokeWidth="2.5" />
          <polygon points="11,26 18,20 25,26" fill={c} fillOpacity="0.3" />
          <line x1="8" y1="28" x2="28" y2="28" />
        </g>
      )}
      {node.id === 'met_manual' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <line x1="9" y1="14" x2="27" y2="14" />
          <line x1="12" y1="14" x2="12" y2="24" />
          <line x1="19" y1="14" x2="19" y2="22" />
        </g>
      )}
      {node.id === 'met_col2d' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <line x1="18" y1="8" x2="18" y2="27" />
          <line x1="11" y1="27" x2="25" y2="27" strokeWidth="2.5" />
          <path d="M18 15 L25 15" />
        </g>
      )}
      {node.id === 'met_cmm' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <path d="M9 26 V11 H27 V26" />
          <line x1="18" y1="11" x2="18" y2="20" />
          <circle cx="18" cy="21" r="2" fill="#ef4444" stroke="none" />
        </g>
      )}
      {node.id === 'met_scanner' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="11" y="8" width="14" height="5" rx="1" />
          <polygon points="13,13 23,13 27,27 9,27" fill={c} fillOpacity="0.18" />
        </g>
      )}
      {node.id === 'qual_basic' && (
        <g stroke={c} strokeWidth="2.2" fill="none">
          <circle cx="18" cy="18" r="9" />
          <path d="M13 18 L16.5 21.5 L23.5 14.5" />
        </g>
      )}
      {node.id === 'qual_spc' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <line x1="8" y1="18" x2="28" y2="18" strokeDasharray="2 2" />
          <polyline points="8,22 13,13 18,21 23,12 28,17" />
        </g>
      )}
      {node.id === 'qual_iso' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <path d="M18 8 L26 12 V19 C26 24 18 28 18 28 C18 28 10 24 10 19 V12 Z" fill={c} fillOpacity="0.2" />
          <path d="M14 18 L17 21 L22 15" />
        </g>
      )}
      {node.id === 'meth_std' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="10" y="8" width="16" height="20" rx="2" />
          <line x1="13" y1="14" x2="23" y2="14" />
          <line x1="13" y1="19" x2="23" y2="19" />
          <line x1="13" y1="24" x2="19" y2="24" />
        </g>
      )}
      {node.id === 'meth_smed' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <circle cx="18" cy="19" r="8" />
          <line x1="18" y1="19" x2="18" y2="14" />
          <line x1="18" y1="19" x2="22" y2="19" />
          <line x1="15" y1="8" x2="21" y2="8" />
        </g>
      )}
      {node.id === 'meth_lean' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <path d="M10 14 H25 L21 10" />
          <path d="M26 22 H11 L15 26" />
        </g>
      )}
      {node.id === 'auto_manual' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="11" y="13" width="14" height="12" rx="2" />
          <path d="M14 13 V10 H22 V13" />
        </g>
      )}
      {node.id === 'auto_conv' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <rect x="8" y="19" width="20" height="6" rx="3" />
          <circle cx="12" cy="22" r="1.2" fill={c} />
          <circle cx="18" cy="22" r="1.2" fill={c} />
          <circle cx="24" cy="22" r="1.2" fill={c} />
          <rect x="13" y="12" width="10" height="6" rx="1" />
        </g>
      )}
      {node.id === 'auto_robot' && (
        <g stroke={c} strokeWidth="2.2" fill="none">
          <line x1="10" y1="27" x2="22" y2="27" />
          <polyline points="15,27 12,18 21,11 26,15" />
          <circle cx="12" cy="18" r="2" fill={c} />
          <circle cx="21" cy="11" r="2" fill={c} />
        </g>
      )}
      {node.id === 'mat_base' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <polygon points="10,23 14,14 22,14 26,23" fill={c} fillOpacity="0.2" />
        </g>
      )}
      {node.id === 'mat_inox' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <circle cx="18" cy="18" r="8" />
          <circle cx="18" cy="18" r="3.5" />
        </g>
      )}
      {node.id === 'mat_peek' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <circle cx="14" cy="15" r="3" />
          <circle cx="23" cy="15" r="3" />
          <circle cx="18" cy="23" r="3" />
          <line x1="16" y1="16" x2="21" y2="16" />
          <line x1="15" y1="18" x2="17" y2="21" />
          <line x1="21" y1="18" x2="19" y2="21" />
        </g>
      )}
      {node.id === 'mat_titanium' && (
        <g stroke={c} strokeWidth="2.2" fill="none">
          <polygon points="18,8 27,13 27,23 18,28 9,23 9,13" />
          <line x1="18" y1="8" x2="18" y2="28" />
        </g>
      )}
      {node.id === 'rh_base' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <circle cx="18" cy="13" r="4" />
          <path d="M10 27 C10 21, 26 21, 26 27" />
        </g>
      )}
      {node.id === 'rh_headhunt' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <circle cx="15" cy="14" r="4" />
          <path d="M8 27 C8 21, 22 21, 22 27" />
          <circle cx="24" cy="15" r="3" />
          <line x1="26" y1="17" x2="29" y2="20" />
        </g>
      )}
      {node.id === 'rh_exec' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <polygon points="10,13 14,17 18,11 22,17 26,13 24,25 12,25" fill={c} fillOpacity="0.25" />
        </g>
      )}
      {node.id === 'rh_academy' && (
        <g stroke={c} strokeWidth="2" fill="none">
          <polygon points="18,9 29,14 18,19 7,14" fill={c} fillOpacity="0.25" />
          <path d="M11 17 V23 C11 25, 25 25, 25 23 V17" />
        </g>
      )}
    </svg>
  );
};

// ============================================================================
// 5. COMPOSANT PRINCIPAL : CNC TYCOON GMP
// ============================================================================
export default function App() {
  const [pseudo, setPseudo] = useState(() => localStorage.getItem('cnc_pseudo') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('cnc_password') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('cnc_pseudo')));
  const [authInputPseudo, setAuthInputPseudo] = useState('');
  const [authInputPass, setAuthInputPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [firebaseUser, setFirebaseUser] = useState(null);

  // --- ÉTAT DU JEU ---
  const [money, setMoney] = useState(115);
  const [researchPoints, setResearchPoints] = useState(4);
  const [clickLevel, setClickLevel] = useState(1);
  const [spindleRpm, setSpindleRpm] = useState(0);
  const [spindleSparks, setSpindleSparks] = useState(false);

  const [slots, setSlots] = useState(() =>
    Array.from({ length: 4 }, () => ({ machineId: null, employeeId: null, partId: 'spacer_alu', progress: 0, status: 'EMPTY' }))
  );
  const [materialStock, setMaterialStock] = useState({
    alu_6061: 8,
    steel_c45: 3,
    brass_cw614: 0,
    inox_316l: 0,
    peek_hp: 0,
    ti_6al4v: 0
  });
  const [partLots, setPartLots] = useState([]);
  const [autoSell, setAutoSell] = useState(false);

  const [metrologyOwned, setMetrologyOwned] = useState(['caliper']);
  const [activeMetroId, setActiveMetroId] = useState('caliper');
  const [autoInspect, setAutoInspect] = useState(false);
  const [reputation, setReputation] = useState(10);
  const [repMetrics, setRepMetrics] = useState({ quality: 65, reliability: 60, innovation: 20, capacity: 25, delivery: 70 });

  const [unlockedTechs, setUnlockedTechs] = useState(['prod_conv', 'met_manual', 'qual_basic', 'meth_std', 'auto_manual', 'mat_base', 'rh_base']);
  const [selectedTechId, setSelectedTechId] = useState('prod_cnc3');
  const [hoveredTechId, setHoveredTechId] = useState(null);
  const [mobileTechBranch, setMobileTechBranch] = useState('Production');

  const [inventory, setInventory] = useState({});
  const [crateOpens, setCrateOpens] = useState({ standard: 0, engineering: 0, direction: 0 });
  const [activeCrateTier, setActiveCrateTier] = useState('standard');
  const [isOpeningCrate, setIsOpeningCrate] = useState(false);
  const [lastCrateDrop, setLastCrateDrop] = useState(null);
  const [showCrateRevealModal, setShowCrateRevealModal] = useState(false);
  const [cardSubTab, setCardSubTab] = useState('deck');
  const [cardFilterRarity, setCardFilterRarity] = useState('all');
  const [cardOnlyMergeable, setCardOnlyMergeable] = useState(false);
  const [cardSortBy, setCardSortBy] = useState('rarity_desc');

  const [contracts, setContracts] = useState([]);
  const [claimedMissions, setClaimedMissions] = useState([]);
  const [stats, setStats] = useState({ partsProduced: 0, partsSold: 0, partsInspected: 0, contractsCompleted: 0, totalRevenue: 0 });

  const [atelier, setAtelier] = useState({ sizeId: 'garage', floorId: 'concrete', extras: [] });
  const [activeTab, setActiveTab] = useState('workshop');
  const [selectedSlotIdx, setSelectedSlotIdx] = useState(0);
  const [assignModalSlotIdx, setAssignModalSlotIdx] = useState(null);
  const [assignFilterRarity, setAssignFilterRarity] = useState('all');
  const [assignOnlyAvailable, setAssignOnlyAvailable] = useState(false);
  const [assignOnlySpecialty, setAssignOnlySpecialty] = useState(false);
  const [assignSortBy, setAssignSortBy] = useState('effective_desc');
  const [leaderboard, setLeaderboard] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem('cnc_gmp_tuto_seen'));
  const [tutorialStep, setTutorialStep] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [importCodeText, setImportCodeText] = useState('');

  // --- COFFRE-FORT ANTI-CHEAT & SNAPSHOT DE SAUVEGARDE ---
  const secureVaultRef = useRef({ money: 115, rp: 4, lastClickTs: 0 });
  const isHydratedRef = useRef(false);
  const latestStateRef = useRef(null);
  const lastCloudSyncRef = useRef(0);

  const addToast = (text, type = 'info') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev.slice(-3), { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  const applySavedState = (saved) => {
    if (!saved || typeof saved !== 'object') return false;
    if (typeof saved.money === 'number') { setMoney(saved.money); secureVaultRef.current.money = saved.money; }
    if (typeof saved.researchPoints === 'number') { setResearchPoints(saved.researchPoints); secureVaultRef.current.rp = saved.researchPoints; }
    if (typeof saved.clickLevel === 'number') setClickLevel(saved.clickLevel);
    if (Array.isArray(saved.slots) && saved.slots.length > 0) setSlots(saved.slots);
    if (saved.materialStock) setMaterialStock(prev => ({ ...prev, ...saved.materialStock }));
    if (Array.isArray(saved.partLots)) setPartLots(saved.partLots);
    if (typeof saved.autoSell === 'boolean') setAutoSell(saved.autoSell);
    if (Array.isArray(saved.metrologyOwned)) setMetrologyOwned(saved.metrologyOwned);
    if (saved.activeMetroId) setActiveMetroId(saved.activeMetroId);
    if (typeof saved.autoInspect === 'boolean') setAutoInspect(saved.autoInspect);
    if (typeof saved.reputation === 'number') setReputation(saved.reputation);
    if (saved.repMetrics) setRepMetrics(saved.repMetrics);
    if (Array.isArray(saved.unlockedTechs) && saved.unlockedTechs.length > 0) setUnlockedTechs(saved.unlockedTechs);
    if (saved.inventory) setInventory(saved.inventory);
    if (saved.crateOpens) setCrateOpens(saved.crateOpens);
    if (Array.isArray(saved.contracts) && saved.contracts.length > 0) setContracts(saved.contracts);
    if (Array.isArray(saved.claimedMissions)) setClaimedMissions(saved.claimedMissions);
    if (saved.stats) setStats(saved.stats);
    if (saved.atelier) setAtelier(saved.atelier);
    return true;
  };

  const buildSaveSnapshot = (overridePseudo = pseudo) => ({
    pseudo: overridePseudo,
    money: secureVaultRef.current.money,
    researchPoints: secureVaultRef.current.rp,
    clickLevel,
    slots,
    materialStock,
    partLots,
    autoSell,
    metrologyOwned,
    activeMetroId,
    autoInspect,
    reputation,
    repMetrics,
    unlockedTechs,
    inventory,
    crateOpens,
    contracts,
    claimedMissions,
    stats,
    atelier,
    updatedAt: Date.now()
  });

  const persistLocalNow = (overridePseudo = pseudo) => {
    if (!isHydratedRef.current) return null;
    const payload = buildSaveSnapshot(overridePseudo);
    const encoded = encodeSecureSave(payload);
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, encoded);
      localStorage.setItem(SAVE_BACKUP_KEY, encoded);
      if (overridePseudo) {
        const cleanId = overridePseudo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        localStorage.setItem(`${SAVE_STORAGE_KEY}_${cleanId}`, encoded);
      }
      setLastSavedAt(payload.updatedAt);
    } catch (e) {
      console.warn('Erreur écriture sauvegarde locale:', e);
    }
    return payload;
  };

  const syncFullSaveToCloud = async (payload, force = false) => {
    if (!db || !isLoggedIn || !payload?.pseudo) return;
    const now = Date.now();
    if (!force && now - lastCloudSyncRef.current < 8000) return;
    lastCloudSyncRef.current = now;
    const cleanId = payload.pseudo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const encoded = encodeSecureSave(payload);
    try {
      await setDoc(doc(db, 'artifacts', SEASON_APP_ID, 'public', 'data', 'accounts', cleanId), {
        pseudo: payload.pseudo.trim(),
        passwordHash: computeIntegrityHash(password || ''),
        encodedSave: encoded,
        updatedAt: payload.updatedAt
      }, { merge: true });

      await setDoc(doc(db, 'artifacts', SEASON_APP_ID, 'public', 'data', 'leaderboard', cleanId), {
        pseudo: payload.pseudo.trim(),
        money: Math.round(payload.money || 0),
        reputation: Math.round(payload.reputation || 10),
        partsProduced: payload.stats?.partsProduced || 0,
        updatedAt: payload.updatedAt
      }, { merge: true });
    } catch {
      // Mode hors-ligne
    }
  };

  const restoreFromCloudIfNewer = async (targetPseudo, targetPass = '') => {
    if (!db || !targetPseudo) return false;
    const cleanId = targetPseudo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    try {
      const snap = await getDoc(doc(db, 'artifacts', SEASON_APP_ID, 'public', 'data', 'accounts', cleanId));
      if (!snap.exists()) return false;
      const cloudDoc = snap.data();
      if (cloudDoc.passwordHash && targetPass && cloudDoc.passwordHash !== computeIntegrityHash(targetPass)) {
        return 'WRONG_PASSWORD';
      }
      const cloudSave = decodeSecureSave(cloudDoc.encodedSave);
      if (!cloudSave) return false;
      const localSave = loadBestLocalSave(targetPseudo);
      if (!localSave || (cloudSave.updatedAt || 0) > (localSave.updatedAt || 0)) {
        applySavedState(cloudSave);
        const encoded = encodeSecureSave(cloudSave);
        localStorage.setItem(SAVE_STORAGE_KEY, encoded);
        localStorage.setItem(SAVE_BACKUP_KEY, encoded);
        localStorage.setItem(`${SAVE_STORAGE_KEY}_${cleanId}`, encoded);
        return true;
      }
    } catch {
      // Silencieux en hors-ligne
    }
    return false;
  };

  const adjustMoney = (delta) => {
    setMoney(prev => {
      const next = Math.max(0, Number((prev + delta).toFixed(2)));
      secureVaultRef.current.money = next;
      return next;
    });
  };

  const adjustRP = (delta) => {
    setResearchPoints(prev => {
      const next = Math.max(0, Number((prev + delta).toFixed(2)));
      secureVaultRef.current.rp = next;
      return next;
    });
  };

  useEffect(() => {
    const guard = setInterval(() => {
      if (Math.abs(money - secureVaultRef.current.money) > 1.5) {
        setMoney(secureVaultRef.current.money);
        addToast('Alerte sécurité : solde restauré.', 'error');
      }
      if (Math.abs(researchPoints - secureVaultRef.current.rp) > 1.5) {
        setResearchPoints(secureVaultRef.current.rp);
      }
    }, 1000);
    return () => clearInterval(guard);
  }, [money, researchPoints]);

  useEffect(() => {
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
    const initialPseudo = localStorage.getItem('cnc_pseudo') || '';
    const saved = loadBestLocalSave(initialPseudo);
    if (saved) {
      applySavedState(saved);
    }
    isHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!auth) return;
    signInAnonymously(auth).catch(() => {});
    return onAuthStateChanged(auth, user => setFirebaseUser(user));
  }, []);

  useEffect(() => {
    if (contracts.length === 0) {
      setContracts([
        generateContractOffer(reputation, unlockedTechs),
        generateContractOffer(reputation, unlockedTechs),
        generateContractOffer(reputation, unlockedTechs)
      ]);
    }
  }, []);

  const modifiers = useMemo(() => {
    const floorObj = ATELIER_UPGRADES.floors.find(f => f.id === atelier.floorId) || ATELIER_UPGRADES.floors[0];
    let speedBonus = floorObj.speedBonus;
    let qualBonus = floorObj.qualBonus;
    let precBonus = 0;
    let priceBonus = 0;
    let defectReduction = 0;

    if (atelier.extras.includes('crane')) speedBonus += 0.09;
    if (atelier.extras.includes('agv')) speedBonus += 0.16;

    if (unlockedTechs.includes('qual_spc')) { qualBonus += 5; defectReduction += 0.15; }
    if (unlockedTechs.includes('qual_iso')) { qualBonus += 8; precBonus += 6; defectReduction += 0.20; }
    if (unlockedTechs.includes('meth_smed')) speedBonus += 0.10;
    if (unlockedTechs.includes('meth_lean')) { speedBonus += 0.16; priceBonus += 0.08; }
    if (unlockedTechs.includes('auto_conv')) speedBonus += 0.08;
    if (unlockedTechs.includes('auto_robot')) speedBonus += 0.16;
    if (unlockedTechs.includes('rh_academy')) { speedBonus += 0.10; qualBonus += 3; }

    return { speedBonus, qualBonus, precBonus, priceBonus, defectReduction };
  }, [atelier, unlockedTechs]);

  const certBonus = useMemo(() => {
    let bonus = 0;
    CERTIFICATIONS_CATALOG.forEach(c => {
      const metroIdx = METROLOGY_CATALOG.findIndex(m => m.id === activeMetroId);
      const reqIdx = METROLOGY_CATALOG.findIndex(m => m.id === c.reqMetro);
      if (reputation >= c.reqRep && metroIdx >= reqIdx) bonus += c.bonus;
    });
    return bonus;
  }, [reputation, activeMetroId]);

  // Coûts dynamiques (courbe lente et stratégique)
  const manualUpgradeCost = Math.round(95 * Math.pow(1.58, clickLevel - 1));
  const rpStudyCost = Math.round(280 * Math.pow(1.32, Math.max(0, unlockedTechs.length - 6)));
  const getMachineCost = (mId) => {
    const m = MACHINES_CATALOG.find(x => x.id === mId);
    if (!m) return 999999;
    const count = slots.filter(s => s.machineId === mId).length;
    return Math.round(m.baseCost * Math.pow(m.costMult, count));
  };
  const getCrateCost = (tierId) => {
    const tier = CRATE_TIERS.find(t => t.id === tierId) || CRATE_TIERS[0];
    const opens = Number(crateOpens?.[tier.id]) || 0;
    const rhDiscount = unlockedTechs.includes('rh_academy') ? 0.88 : 1.0;
    return Math.round(tier.baseCost * Math.pow(tier.costMult, opens) * rhDiscount);
  };

  // --- BOUCLE DE SIMULATION TEMPS RÉEL (TICK 250ms) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const dt = 0.25;
      setSpindleRpm(prev => Math.max(0, prev - 350));

      setMaterialStock(prevMat => {
        const nextMat = { ...prevMat };
        const newlyProduced = [];

        setSlots(prevSlots =>
          prevSlots.map(slot => {
            if (!slot.machineId) return slot;
            const machine = MACHINES_CATALOG.find(m => m.id === slot.machineId);
            const part = PARTS_CATALOG.find(p => p.id === slot.partId) || PARTS_CATALOG[0];
            if (!machine || !part) return slot;

            let empMult = 0;
            let empQual = 0;
            if (slot.employeeId) {
              const emp = EMPLOYEES_CATALOG.find(e => e.id === slot.employeeId);
              const owned = inventory[slot.employeeId];
              if (emp && owned) {
                const starBoost = 1 + ((owned.stars || 1) - 1) * 0.28;
                const specBoost = emp.specialty === machine.id ? 1.4 : 1.0;
                empMult = emp.baseMult * starBoost * specBoost;
                empQual = emp.qualBonus;
              }
            }

            const effectiveSpeed = Math.max(0.2, machine.speedMult * (1 + modifiers.speedBonus + empMult));
            const cycleDuration = Math.max(0.8, part.baseCycleSec / effectiveSpeed);
            const neededKg = part.kgPerPart * machine.batchSize;

            if (slot.progress === 0 && (nextMat[part.materialId] || 0) < neededKg) {
              return { ...slot, status: 'NO_MAT' };
            }

            let nextProg = slot.progress + dt / cycleDuration;
            if (nextProg >= 1) {
              if ((nextMat[part.materialId] || 0) >= neededKg) {
                nextMat[part.materialId] = Number((nextMat[part.materialId] - neededKg).toFixed(3));
                const rawQual = Math.min(100, Math.max(30, machine.baseQuality + modifiers.qualBonus + empQual));
                const defectChance = Math.max(0.015, ((100 - rawQual) / 145) * (1 - modifiers.defectReduction));
                const isConforming = Math.random() > defectChance;
                newlyProduced.push({
                  partId: part.id,
                  qty: machine.batchSize,
                  quality: Math.round(rawQual),
                  isConforming,
                  inspected: autoInspect
                });
                nextProg = nextProg - 1;
              } else {
                nextProg = 0;
                return { ...slot, progress: 0, status: 'NO_MAT' };
              }
            }
            return { ...slot, progress: Math.min(0.99, nextProg), status: 'RUNNING' };
          })
        );

        if (newlyProduced.length > 0) {
          let totalAdded = 0;
          let autoSoldRevenue = 0;
          let autoSoldQty = 0;
          let autoInspectedQty = 0;

          setPartLots(prevLots => {
            const updated = [...prevLots];
            newlyProduced.forEach(item => {
              totalAdded += item.qty;
              if (item.inspected) autoInspectedQty += item.qty;

              if (autoSell && item.inspected && item.isConforming) {
                const part = PARTS_CATALOG.find(p => p.id === item.partId);
                const unitVal = (part?.sellPrice || 5) * (1 + modifiers.priceBonus + certBonus) * (item.quality / 90);
                autoSoldRevenue += unitVal * item.qty;
                autoSoldQty += item.qty;
              } else {
                const idx = updated.findIndex(
                  l => l.partId === item.partId && l.inspected === item.inspected && l.isConforming === item.isConforming && Math.abs(l.quality - item.quality) <= 3
                );
                if (idx >= 0) {
                  updated[idx] = { ...updated[idx], qty: updated[idx].qty + item.qty };
                } else {
                  updated.push({
                    id: `lot_${Date.now()}_${Math.random()}`,
                    partId: item.partId,
                    qty: item.qty,
                    quality: item.quality,
                    inspected: item.inspected,
                    isConforming: item.isConforming
                  });
                }
              }
            });
            return updated;
          });

          if (autoSoldRevenue > 0) adjustMoney(autoSoldRevenue);
          setStats(s => ({
            ...s,
            partsProduced: s.partsProduced + totalAdded,
            partsSold: s.partsSold + autoSoldQty,
            partsInspected: s.partsInspected + autoInspectedQty,
            totalRevenue: s.totalRevenue + autoSoldRevenue
          }));
        }

        return nextMat;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [modifiers, certBonus, autoSell, autoInspect, inventory]);

  // --- SAUVEGARDE IMMÉDIATE SUR CHANGEMENTS CLÉS + FERMETURE ONGLET/APP ---
  useEffect(() => {
    if (!isHydratedRef.current) return;
    const payload = persistLocalNow(pseudo);
    latestStateRef.current = payload;
  }, [clickLevel, slots, materialStock, partLots, autoSell, metrologyOwned, activeMetroId, autoInspect, reputation, repMetrics, unlockedTechs, inventory, crateOpens, contracts, claimedMissions, stats, atelier, pseudo]);

  useEffect(() => {
    const saveTimer = setInterval(() => {
      const payload = persistLocalNow(pseudo);
      if (payload) syncFullSaveToCloud(payload, false);
    }, 2500);
    return () => clearInterval(saveTimer);
  }, [clickLevel, slots, materialStock, partLots, autoSell, metrologyOwned, activeMetroId, autoInspect, reputation, repMetrics, unlockedTechs, inventory, crateOpens, contracts, claimedMissions, stats, atelier, isLoggedIn, pseudo]);

  useEffect(() => {
    const flushSaveOnLeave = () => {
      const payload = persistLocalNow(pseudo);
      if (payload) syncFullSaveToCloud(payload, true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushSaveOnLeave();
    };
    window.addEventListener('beforeunload', flushSaveOnLeave);
    window.addEventListener('pagehide', flushSaveOnLeave);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushSaveOnLeave);
      window.removeEventListener('pagehide', flushSaveOnLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pseudo, isLoggedIn]);

  // --- ACTIONS JOUEUR ---
  const handleManualMachining = (e) => {
    if (e && typeof e.detail === 'number' && e.detail === 0) return;
    const now = Date.now();
    if (now - secureVaultRef.current.lastClickTs < 85) return;
    secureVaultRef.current.lastClickTs = now;

    setSpindleRpm(prev => Math.min(6000, prev + 1350));
    setSpindleSparks(true);
    setTimeout(() => setSpindleSparks(false), 180);

    const qty = Math.min(5, 1 + Math.floor((clickLevel - 1) / 2));
    const qual = Math.min(92, 74 + clickLevel * 2);
    setPartLots(prev => {
      const idx = prev.findIndex(l => l.partId === 'spacer_alu' && !l.inspected && l.isConforming);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty };
        return copy;
      }
      return [...prev, { id: `lot_${now}`, partId: 'spacer_alu', qty, quality: qual, inspected: false, isConforming: true }];
    });
    setStats(s => ({ ...s, partsProduced: s.partsProduced + qty }));
  };

  const handleUpgradeManual = () => {
    if (money < manualUpgradeCost) return addToast('Fonds insuffisants.', 'error');
    adjustMoney(-manualUpgradeCost);
    setClickLevel(c => c + 1);
    addToast(`Outillage manuel niveau ${clickLevel + 1} !`, 'success');
  };

  const handleBuyMachine = (machineId) => {
    const machine = MACHINES_CATALOG.find(m => m.id === machineId);
    if (!machine) return;
    if (machine.reqTech && !unlockedTechs.includes(machine.reqTech)) {
      return addToast('Débloquez la technologie R&D requise.', 'error');
    }
    const cost = getMachineCost(machineId);
    if (money < cost) return addToast('Budget insuffisant.', 'error');
    const emptyIdx = slots.findIndex(s => !s.machineId);
    if (emptyIdx === -1) return addToast('Aucun îlot libre ! Agrandissez votre atelier.', 'error');

    adjustMoney(-cost);
    setSlots(prev =>
      prev.map((s, idx) =>
        idx === emptyIdx
          ? { ...s, machineId: machine.id, partId: machine.defaultPart, progress: 0, status: 'RUNNING' }
          : s
      )
    );
    addToast(`${machine.name} installée sur l'îlot #${emptyIdx + 1} !`, 'success');
  };

  const handleSellLot = (lotId) => {
    const lot = partLots.find(l => l.id === lotId);
    if (!lot) return;
    if (!lot.inspected) return addToast('Contrôlez d’abord ce lot en Métrologie !', 'error');
    const part = PARTS_CATALOG.find(p => p.id === lot.partId);
    if (lot.isConforming) {
      const unitVal = (part?.sellPrice || 5) * (1 + modifiers.priceBonus + certBonus) * (lot.quality / 90);
      const gain = unitVal * lot.qty;
      adjustMoney(gain);
      setStats(s => ({ ...s, partsSold: s.partsSold + lot.qty, totalRevenue: s.totalRevenue + gain }));
      addToast(`Lot vendu : +${formatMoney(gain)}`, 'success');
    } else {
      const scrapVal = (part?.sellPrice || 5) * 0.15 * lot.qty;
      adjustMoney(scrapVal);
      addToast(`Rebuts recyclés : +${formatMoney(scrapVal)}`, 'info');
    }
    setPartLots(prev => prev.filter(l => l.id !== lotId));
  };

  const handleSellAllConforming = () => {
    let totalGain = 0;
    let totalQty = 0;
    const remaining = [];
    partLots.forEach(lot => {
      if (lot.inspected && lot.isConforming) {
        const part = PARTS_CATALOG.find(p => p.id === lot.partId);
        const unitVal = (part?.sellPrice || 5) * (1 + modifiers.priceBonus + certBonus) * (lot.quality / 90);
        totalGain += unitVal * lot.qty;
        totalQty += lot.qty;
      } else {
        remaining.push(lot);
      }
    });
    if (totalQty === 0) return addToast('Aucun lot conforme contrôlé prêt à expédier.', 'info');
    adjustMoney(totalGain);
    setPartLots(remaining);
    setStats(s => ({ ...s, partsSold: s.partsSold + totalQty, totalRevenue: s.totalRevenue + totalGain }));
    addToast(`Expédition globale (${totalQty} pièces) : +${formatMoney(totalGain)}`, 'success');
  };

  const handleInspectAll = () => {
    let count = 0;
    setPartLots(prev =>
      prev.map(l => {
        if (!l.inspected) {
          count += l.qty;
          return { ...l, inspected: true };
        }
        return l;
      })
    );
    if (count > 0) {
      setStats(s => ({ ...s, partsInspected: s.partsInspected + count }));
      addToast(`${count} pièces contrôlées au laboratoire.`, 'success');
    }
  };

  const handleDeliverContract = (ctr) => {
    const part = PARTS_CATALOG.find(p => p.id === ctr.partId);
    const matchingLots = partLots.filter(l => l.partId === ctr.partId && l.inspected && l.isConforming && l.quality >= ctr.minQuality);
    const totalAvail = matchingLots.reduce((acc, l) => acc + l.qty, 0);
    if (totalAvail < ctr.qty) {
      return addToast(`Stock conforme insuffisant (${totalAvail}/${ctr.qty} ${part?.name}).`, 'error');
    }

    const winChance = Math.max(0.25, Math.min(1.0, 1.35 - ctr.bidMult * 0.35 + reputation / 250));
    if (Math.random() > winChance) {
      addToast(`Offre rejetée par ${ctr.client} (prix trop élevé).`, 'error');
      setContracts(prev => prev.map(c => (c.id === ctr.id ? generateContractOffer(reputation, unlockedTechs) : c)));
      return;
    }

    let needed = ctr.qty;
    setPartLots(prev =>
      prev
        .map(l => {
          if (needed <= 0 || l.partId !== ctr.partId || !l.inspected || !l.isConforming || l.quality < ctr.minQuality) return l;
          const take = Math.min(l.qty, needed);
          needed -= take;
          return { ...l, qty: l.qty - take };
        })
        .filter(l => l.qty > 0)
    );

    const payout = Math.round(ctr.baseReward * ctr.bidMult);
    adjustMoney(payout);
    adjustRP(ctr.rpReward);
    setReputation(r => Math.min(100, r + 2));
    setRepMetrics(m => ({
      quality: Math.min(100, m.quality + 2),
      reliability: Math.min(100, m.reliability + 2),
      innovation: Math.min(100, m.innovation + 2),
      capacity: Math.min(100, m.capacity + 2),
      delivery: Math.min(100, m.delivery + 2)
    }));
    setStats(s => ({ ...s, contractsCompleted: s.contractsCompleted + 1, partsSold: s.partsSold + ctr.qty, totalRevenue: s.totalRevenue + payout }));
    setContracts(prev => prev.map(c => (c.id === ctr.id ? generateContractOffer(reputation + 2, unlockedTechs) : c)));
    addToast(`Contrat ${ctr.client} livré : +${formatMoney(payout)} & +${ctr.rpReward} RP !`, 'success');
  };

  const handleBuyResearchPoint = () => {
    if (money < rpStudyCost) return addToast('Fonds insuffisants pour lancer une étude.', 'error');
    adjustMoney(-rpStudyCost);
    adjustRP(10);
    addToast('+10 Points R&D (RP) acquis !', 'success');
  };

  const handleUnlockTech = (tech) => {
    if (unlockedTechs.includes(tech.id)) return;
    if (tech.req && !unlockedTechs.includes(tech.req)) return addToast('Prérequis principal manquant !', 'error');
    if (tech.crossReq && !unlockedTechs.includes(tech.crossReq)) {
      const crossName = TECH_TREE_CATALOG.find(t => t.id === tech.crossReq)?.name || 'Technologie liée';
      return addToast(`Passerelle requise : ${crossName}`, 'error');
    }
    if (money < tech.moneyCost || researchPoints < tech.rpCost) return addToast('Fonds ou Points R&D insuffisants.', 'error');
    adjustMoney(-tech.moneyCost);
    adjustRP(-tech.rpCost);
    setUnlockedTechs(prev => [...prev, tech.id]);
    addToast(`Technologie acquise : ${tech.name}`, 'success');
  };

  const handleOpenCrate = (tierId = activeCrateTier) => {
    const tier = CRATE_TIERS.find(t => t.id === tierId) || CRATE_TIERS[0];
    if (tier.reqTech && !unlockedTechs.includes(tier.reqTech)) {
      const reqName = TECH_TREE_CATALOG.find(t => t.id === tier.reqTech)?.name || 'Technologie RH';
      return addToast(`Débloquez "${reqName}" dans l'arbre R&D !`, 'error');
    }
    const cost = getCrateCost(tier.id);
    if (isOpeningCrate) return;
    if (money < cost) return addToast(`Budget insuffisant (${formatMoney(cost)} requis).`, 'error');
    adjustMoney(-cost);
    setActiveCrateTier(tier.id);
    setCrateOpens(prev => ({ ...prev, [tier.id]: (Number(prev?.[tier.id]) || 0) + 1 }));
    setIsOpeningCrate(true);
    setLastCrateDrop(null);

    setTimeout(() => {
      const roll = Math.random() * 100;
      let acc = 0;
      let chosenRarity = 'commun';
      const order = ['secret', 'mythique', 'legendaire', 'epique', 'rare', 'commun', 'malus'];
      for (const r of order) {
        acc += Number(tier.weights[r]) || 0;
        if (roll <= acc) {
          chosenRarity = r;
          break;
        }
      }
      const pool = EMPLOYEES_CATALOG.filter(e => e.rarity === chosenRarity);
      const safePool = pool.length > 0 ? pool : EMPLOYEES_CATALOG.filter(e => e.rarity === 'commun');
      const emp = safePool[Math.floor(Math.random() * safePool.length)];
      setInventory(prev => {
        const cur = prev[emp.id] || { count: 0, stars: 1, maxStars: 1 };
        return { ...prev, [emp.id]: { ...cur, count: cur.count + 1, maxStars: Math.max(cur.maxStars || 1, cur.stars || 1) } };
      });
      setIsOpeningCrate(false);
      setLastCrateDrop(emp);
      setShowCrateRevealModal(true);
    }, 850);
  };

  const handleMergeCard = (empId) => {
    const cur = inventory[empId];
    if (!cur || cur.count < 3 || cur.stars >= 5) return;
    const nextStars = cur.stars + 1;
    setInventory(prev => ({
      ...prev,
      [empId]: { ...cur, count: cur.count - 3, stars: nextStars, maxStars: Math.max(cur.maxStars || 1, nextStars) }
    }));
    addToast(`Fusion réussie : niveau ${nextStars}★ atteint !`, 'success');
  };

  const fetchLeaderboard = async () => {
    if (!db) return;
    try {
      const q = query(collection(db, 'artifacts', SEASON_APP_ID, 'public', 'data', 'leaderboard'), limit(50));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => d.data()).sort((a, b) => (b.money || 0) - (a.money || 0));
      setLeaderboard(list);
    } catch {
      // Silencieux en mode hors-ligne
    }
  };

  const syncAndFetchLeaderboard = async (playerPseudo = pseudo, playerMoney = secureVaultRef.current.money, playerRep = reputation, playerParts = stats.partsProduced) => {
    if (!db || !playerPseudo) return;
    const cleanId = playerPseudo.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    try {
      await setDoc(doc(db, 'artifacts', SEASON_APP_ID, 'public', 'data', 'leaderboard', cleanId), {
        pseudo: playerPseudo.trim(),
        money: Math.round(playerMoney),
        reputation: Math.round(playerRep),
        partsProduced: playerParts,
        updatedAt: Date.now()
      }, { merge: true });
      await fetchLeaderboard();
    } catch {
      // Mode hors-ligne
    }
  };

  useEffect(() => {
    if (isLoggedIn && pseudo) {
      restoreFromCloudIfNewer(pseudo, password).then(() => {
        const snap = persistLocalNow(pseudo);
        if (snap) syncFullSaveToCloud(snap, true);
        fetchLeaderboard();
      });
    }
  }, [isLoggedIn, pseudo, firebaseUser]);

  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab]);

  // --- ÉCRAN DE CONNEXION ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const p = authInputPseudo.trim();
    const pw = authInputPass.trim();
    if (p.length < 2 || pw.length < 3) {
      setAuthError('Pseudo (2 car. min) et mot de passe (3 car. min) requis.');
      return;
    }

    const cloudStatus = await restoreFromCloudIfNewer(p, pw);
    if (cloudStatus === 'WRONG_PASSWORD') {
      setAuthError('Mot de passe incorrect pour ce pseudo GMP.');
      return;
    }

    if (!cloudStatus) {
      const localExisting = loadBestLocalSave(p);
      if (localExisting) applySavedState(localExisting);
    }

    localStorage.setItem('cnc_pseudo', p);
    localStorage.setItem('cnc_password', pw);
    setPseudo(p);
    setPassword(pw);
    setIsLoggedIn(true);
    setAuthError('');
    const snap = persistLocalNow(p);
    if (snap) await syncFullSaveToCloud(snap, true);
    await fetchLeaderboard();
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center font-black text-lg text-white shadow-lg">
              GMP
            </div>
            <div>
              <h1 className="text-xl font-black text-white">CNC Tycoon GMP</h1>
              <p className="text-xs text-cyan-400 font-bold">Saison 2 • Simulation Industrielle</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Connectez-vous avec votre pseudo GMP pour sauvegarder votre atelier et apparaître au classement général.
          </p>
          <form onSubmit={handleLoginSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Pseudo Joueur</label>
              <input
                type="text"
                value={authInputPseudo}
                onChange={e => setAuthInputPseudo(e.target.value)}
                placeholder="Ex: Usineur_GMP"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Mot de passe</label>
              <input
                type="password"
                value={authInputPass}
                onChange={e => setAuthInputPass(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-sky-500 outline-none"
              />
            </div>
            {authError && <p className="text-xs text-rose-400 font-bold">{authError}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm shadow-lg"
            >
              Entrer dans l’Atelier
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 6. VUES DES ONGLETS
  // ============================================================================
  const renderWorkshop = () => {
    const sizeObj = ATELIER_UPGRADES.sizes.find(s => s.id === atelier.sizeId) || ATELIER_UPGRADES.sizes[0];
    const floorObj = ATELIER_UPGRADES.floors.find(f => f.id === atelier.floorId) || ATELIER_UPGRADES.floors[0];
    const readyPartsCount = partLots.filter(l => l.inspected && l.isConforming).reduce((a, b) => a + b.qty, 0);
    const uninspectedCount = partLots.filter(l => !l.inspected).reduce((a, b) => a + b.qty, 0);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-sky-400">Poste Manuel &amp; Prototypage</span>
              <span className="text-xs font-bold text-slate-400">Niv. {clickLevel}</span>
            </div>
            <ManualSpindleSVG rpm={spindleRpm} sparks={spindleSparks} />
            <div className="text-center mt-2">
              <div className="text-xs font-black text-cyan-300">{spindleRpm} RPM</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Cliquez avec la souris pour usiner des <b className="text-slate-200">Entretoises Aluminium</b> (à contrôler en Métrologie avant vente).
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleManualMachining}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-400 hover:to-cyan-500 active:scale-[0.99] text-white font-black text-sm shadow-lg shadow-sky-500/20 transition-all select-none"
            >
              USINER UNE PIÈCE (+{Math.min(5, 1 + Math.floor((clickLevel - 1) / 2))})
            </button>
            <button
              type="button"
              onClick={handleUpgradeManual}
              disabled={money < manualUpgradeCost}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-between border ${
                money >= manualUpgradeCost
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <span>Outillage Carbure Niv.{clickLevel + 1}</span>
              <span>{formatMoney(manualUpgradeCost)}</span>
            </button>
            {uninspectedCount > 0 && (
              <button
                type="button"
                onClick={handleInspectAll}
                className="w-full py-2 rounded-xl bg-amber-600/30 border border-amber-500/50 hover:bg-amber-600/40 text-amber-300 font-black text-xs"
              >
                Contrôler en Métrologie ({uninspectedCount} pcs)
              </button>
            )}
            {readyPartsCount > 0 && (
              <button
                type="button"
                onClick={handleSellAllConforming}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow"
              >
                Vendre le Stock Conforme ({readyPartsCount} pièces)
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" /> {sizeObj.name} — Plan 2D ({slots.length} îlots)
              </h2>
              <p className="text-xs text-slate-400">Sol : {floorObj.name} • Cliquez sur un îlot pour le configurer.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-300 font-bold">
                Cadence +{Math.round(modifiers.speedBonus * 100)}%
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold">
                Qualité +{modifiers.qualBonus}
              </span>
            </div>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl border border-slate-800"
            style={{ backgroundColor: floorObj.bg }}
          >
            {slots.map((slot, idx) => {
              const machine = MACHINES_CATALOG.find(m => m.id === slot.machineId);
              const part = PARTS_CATALOG.find(p => p.id === slot.partId);
              const emp = EMPLOYEES_CATALOG.find(e => e.id === slot.employeeId);
              return (
                <div
                  key={idx}
                  onClick={() => { setSelectedSlotIdx(idx); setActiveTab('machines'); }}
                  className={`rounded-xl border p-2.5 cursor-pointer transition-all flex flex-col justify-between min-h-[118px] ${
                    slot.status === 'NO_MAT'
                      ? 'bg-rose-950/30 border-rose-500/60'
                      : machine
                      ? 'bg-slate-900/90 border-slate-700 hover:border-sky-400'
                      : 'bg-slate-950/60 border-dashed border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400">
                    <span>ÎLOT #{idx + 1}</span>
                    {slot.status === 'NO_MAT' && <span className="text-rose-400">MANQUE MATIÈRE</span>}
                    {slot.status === 'RUNNING' && <span className="text-emerald-400">EN CYCLE</span>}
                  </div>

                  {machine ? (
                    <>
                      <div className="flex items-center gap-2 my-1">
                        <MachineIllustration machineId={machine.id} active={slot.status === 'RUNNING'} />
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">{machine.name}</div>
                          <div className="text-[10px] text-sky-300 truncate">{part?.name}</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all"
                            style={{ width: `${Math.round(slot.progress * 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{emp ? `👤 ${emp.name}` : 'Sans opérateur'}</span>
                          <span>{Math.round(slot.progress * 100)}%</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-500 font-bold">
                      + Installer Machine
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMachines = () => {
    const ownedEmployees = EMPLOYEES_CATALOG.filter(e => inventory[e.id] && inventory[e.id].count > 0);

    return (
      <div className="space-y-4">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-base font-black text-white mb-3 flex items-center gap-2">
            <Cog className="w-5 h-5 text-sky-400" /> Acheter &amp; Installer une Machine-Outil
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {MACHINES_CATALOG.map(m => {
              const unlocked = !m.reqTech || unlockedTechs.includes(m.reqTech);
              const cost = getMachineCost(m.id);
              const reqName = m.reqTech ? TECH_TREE_CATALOG.find(t => t.id === m.reqTech)?.name : null;
              return (
                <div key={m.id} className={`rounded-2xl border p-3 flex flex-col justify-between ${unlocked ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-75'}`}>
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <MachineIllustration machineId={m.id} active={false} />
                      <div>
                        <div className="text-xs font-black text-white">{m.name}</div>
                        <div className="text-[10px] text-sky-400 font-bold">{m.category} • x{m.batchSize} pcs/cycle</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2">{m.desc}</p>
                  </div>
                  {!unlocked ? (
                    <div className="text-[11px] text-amber-400 font-bold bg-amber-950/30 border border-amber-800/50 rounded-xl px-2.5 py-1.5 text-center">
                      🔒 R&amp;D : {reqName}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyMachine(m.id)}
                      disabled={money < cost}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-between ${
                        money >= cost ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span>Installer</span>
                      <span>{formatMoney(cost)}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-base font-black text-white">Pilotage des Îlots Installés</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {slots.map((slot, idx) => {
              if (!slot.machineId) return null;
              const machine = MACHINES_CATALOG.find(m => m.id === slot.machineId);
              const compatibleParts = PARTS_CATALOG.filter(
                p => p.allowedMachines.includes(machine.id) && (!p.reqTech || unlockedTechs.includes(p.reqTech))
              );
              return (
                <div key={idx} className={`rounded-2xl border p-3.5 bg-slate-950/90 space-y-2.5 ${selectedSlotIdx === idx ? 'border-sky-500' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MachineIllustration machineId={machine.id} active={slot.status === 'RUNNING'} />
                      <div>
                        <div className="text-xs font-black text-white">Îlot #{idx + 1} • {machine.name}</div>
                        <div className="text-[10px] text-slate-400">Qualité base {machine.baseQuality}/100 • Batch x{machine.batchSize}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSlots(prev => prev.map((s, i) => (i === idx ? { machineId: null, employeeId: null, partId: 'spacer_alu', progress: 0, status: 'EMPTY' } : s)));
                        addToast(`Îlot #${idx + 1} libéré.`, 'info');
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                      title="Démonter la machine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Pièce usinée</label>
                      <select
                        value={slot.partId}
                        onChange={e =>
                          setSlots(prev => prev.map((s, i) => (i === idx ? { ...s, partId: e.target.value, progress: 0 } : s)))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold"
                      >
                        {compatibleParts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatMoney(p.sellPrice)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Opérateur affecté</label>
                      {(() => {
                        const assignedEmp = slot.employeeId ? EMPLOYEES_CATALOG.find(e => e.id === slot.employeeId) : null;
                        const assignedOwned = assignedEmp ? inventory[assignedEmp.id] : null;
                        const assignedRar = assignedEmp ? (RARITY_CONFIG[assignedEmp.rarity] || RARITY_CONFIG.commun) : null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setAssignFilterRarity('all');
                              setAssignOnlyAvailable(false);
                              setAssignOnlySpecialty(false);
                              setAssignSortBy('effective_desc');
                              setAssignModalSlotIdx(idx);
                            }}
                            className={`w-full bg-slate-900 hover:bg-slate-800 border rounded-xl px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition-all ${
                              assignedEmp ? 'border-sky-500/60' : 'border-slate-700 hover:border-sky-500/50'
                            }`}
                          >
                            {assignedEmp ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <CharacterPortrait emp={assignedEmp} sizeClass="w-6 h-6" />
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-white truncate">
                                    {assignedEmp.name} <span className="text-amber-400">{'★'.repeat(assignedOwned?.stars || 1)}</span>
                                  </div>
                                  <div className={`text-[10px] font-bold truncate ${assignedEmp.baseMult >= 0 ? 'text-emerald-400' : 'text-lime-400'}`}>
                                    {assignedEmp.baseMult >= 0 ? `+${Math.round(assignedEmp.baseMult * 100)}%` : `${Math.round(assignedEmp.baseMult * 100)}%`} • {assignedRar?.label}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-400">+ Choisir une carte opérateur...</span>
                            )}
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-sky-600/20 text-sky-300 border border-sky-500/30 shrink-0">
                              Cartes
                            </span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderStocks = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-5 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-400" /> Approvisionnement Matières Premières
        </h2>
        <div className="space-y-2">
          {MATERIALS_CATALOG.map(mat => {
            const unlocked = !mat.reqTech || unlockedTechs.includes(mat.reqTech);
            const stock = Number(materialStock[mat.id] || 0);
            const cost10 = Math.round(mat.costPerKg * 10);
            const cost50 = Math.round(mat.costPerKg * 50 * 0.94);
            return (
              <div key={mat.id} className={`p-3 rounded-xl border ${unlocked ? 'bg-slate-950/90 border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-black text-white">{mat.name}</div>
                    <div className="text-[11px] text-slate-400">Stock : <b className="text-sky-300">{stock.toFixed(1)} kg</b> • {mat.costPerKg} $/kg</div>
                  </div>
                  {unlocked ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          if (money < cost10) return addToast('Fonds insuffisants.', 'error');
                          adjustMoney(-cost10);
                          setMaterialStock(prev => ({ ...prev, [mat.id]: (prev[mat.id] || 0) + 10 }));
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-black text-emerald-300"
                      >
                        +10kg ({formatMoney(cost10)})
                      </button>
                      <button
                        onClick={() => {
                          if (money < cost50) return addToast('Fonds insuffisants.', 'error');
                          adjustMoney(-cost50);
                          setMaterialStock(prev => ({ ...prev, [mat.id]: (prev[mat.id] || 0) + 50 }));
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-black text-white"
                      >
                        +50kg ({formatMoney(cost50)})
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-bold">🔒 R&amp;D Matériaux</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-7 bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-black text-white">Lots Produits Finis &amp; Ventes</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoSell(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border ${autoSell ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
            >
              Vente Auto : {autoSell ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={handleSellAllConforming}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black"
            >
              Tout Expédier
            </button>
          </div>
        </div>

        {partLots.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800">
            Aucun lot en stock. Usinez des pièces manuellement ou lancez vos machines !
          </div>
        ) : (
          <div className="space-y-2">
            {partLots.map(lot => {
              const part = PARTS_CATALOG.find(p => p.id === lot.partId);
              const unitVal = (part?.sellPrice || 5) * (1 + modifiers.priceBonus + certBonus) * (lot.quality / 90);
              return (
                <div key={lot.id} className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PartIllustration partId={lot.partId} />
                    <div>
                      <div className="text-xs font-black text-white">
                        {part?.name} <span className="text-sky-400">x{lot.qty}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Qualité : {lot.quality}/100</span>
                        {!lot.inspected ? (
                          <span className="text-amber-400 font-bold">• Non contrôlé</span>
                        ) : lot.isConforming ? (
                          <span className="text-emerald-400 font-bold">• Conforme</span>
                        ) : (
                          <span className="text-rose-400 font-bold">• Rebut</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSellLot(lot.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                      !lot.inspected
                        ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300'
                        : lot.isConforming
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    {!lot.inspected ? 'Contrôle requis' : lot.isConforming ? `Vendre (${formatMoney(unitVal * lot.qty)})` : 'Recycler'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderMetrology = () => {
    const uninspectedCount = partLots.filter(l => !l.inspected).reduce((a, b) => a + b.qty, 0);
    return (
      <div className="space-y-4">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Gauge className="w-5 h-5 text-emerald-400" /> Laboratoire de Métrologie &amp; Certifications
            </h2>
            <p className="text-xs text-slate-400">Contrôlez la conformité dimensionnelle et décrochez les certifications aéronautiques.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoInspect(v => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border ${autoInspect ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
            >
              Contrôle Auto : {autoInspect ? 'ACTIF' : 'MANUEL'}
            </button>
            {uninspectedCount > 0 && (
              <button onClick={handleInspectAll} className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-black">
                Contrôler ({uninspectedCount} pcs)
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {METROLOGY_CATALOG.map(m => {
            const isOwned = metrologyOwned.includes(m.id);
            const techOk = !m.reqTech || unlockedTechs.includes(m.reqTech);
            return (
              <div key={m.id} className={`rounded-2xl border p-3.5 flex flex-col justify-between ${activeMetroId === m.id ? 'bg-emerald-950/20 border-emerald-500' : 'bg-slate-900/90 border-slate-800'}`}>
                <div>
                  <div className="text-xs font-black text-white mb-1">{m.name}</div>
                  <p className="text-[11px] text-slate-400 mb-2">{m.desc}</p>
                  <div className="text-[11px] text-emerald-300 font-bold">Détection : {Math.round(m.detectRate * 100)}%</div>
                </div>
                <div className="mt-3">
                  {isOwned ? (
                    <button
                      onClick={() => setActiveMetroId(m.id)}
                      className={`w-full py-2 rounded-xl text-xs font-black ${activeMetroId === m.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      {activeMetroId === m.id ? '✓ Équipement Actif' : 'Activer ce poste'}
                    </button>
                  ) : !techOk ? (
                    <div className="text-[11px] text-amber-400 font-bold text-center py-1.5 bg-amber-950/30 rounded-xl">🔒 R&amp;D Métrologie</div>
                  ) : (
                    <button
                      onClick={() => {
                        if (money < m.cost) return addToast('Fonds insuffisants.', 'error');
                        adjustMoney(-m.cost);
                        setMetrologyOwned(prev => [...prev, m.id]);
                        setActiveMetroId(m.id);
                        addToast(`${m.name} installé au labo !`, 'success');
                      }}
                      className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black"
                    >
                      Acheter ({formatMoney(m.cost)})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CERTIFICATIONS_CATALOG.map(c => {
            const metroIdx = METROLOGY_CATALOG.findIndex(m => m.id === activeMetroId);
            const reqIdx = METROLOGY_CATALOG.findIndex(m => m.id === c.reqMetro);
            const unlocked = reputation >= c.reqRep && metroIdx >= reqIdx;
            return (
              <div key={c.id} className={`rounded-2xl border p-4 ${unlocked ? 'bg-amber-950/20 border-amber-500/60' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-black text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" /> {c.name}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${unlocked ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {unlocked ? 'CERTIFIÉ' : `Req. Rép ${c.reqRep}`}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderContracts = () => (
    <div className="space-y-4">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-sky-400" /> Appels d’Offres &amp; Réputation Industrielle
          </h2>
          <p className="text-xs text-slate-400">Réputation globale : <b className="text-amber-400">{reputation}/100</b> • Bonus certifications : <b className="text-emerald-400">+{Math.round(certBonus * 100)}%</b></p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {Object.entries(repMetrics).map(([k, v]) => (
            <span key={k} className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-bold capitalize">
              {k} : <b className="text-sky-400">{v}%</b>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {contracts.map(ctr => {
          const part = PARTS_CATALOG.find(p => p.id === ctr.partId);
          const readyQty = partLots
            .filter(l => l.partId === ctr.partId && l.inspected && l.isConforming && l.quality >= ctr.minQuality)
            .reduce((a, b) => a + b.qty, 0);
          const winProb = Math.round(Math.max(25, Math.min(100, (1.35 - ctr.bidMult * 0.35 + reputation / 250) * 100)));

          return (
            <div key={ctr.id} className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-sky-400">{ctr.client}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-800 text-amber-300">Palier {ctr.tier}</span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-3">
                  <PartIllustration partId={ctr.partId} />
                  <div>
                    <div className="text-xs font-black text-white">{part?.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Quantité : <b className={readyQty >= ctr.qty ? 'text-emerald-400' : 'text-amber-300'}>{readyQty}/{ctr.qty}</b> • Qual. ≥ {ctr.minQuality}
                    </div>
                  </div>
                </div>

                {ctr.tier >= 2 && (
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Marge proposée : <b>{Math.round(ctr.bidMult * 100)}%</b></span>
                      <span className="text-emerald-400 font-bold">Succès : {winProb}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.85"
                      max="1.20"
                      step="0.05"
                      value={ctr.bidMult}
                      onChange={e =>
                        setContracts(prev => prev.map(c => (c.id === ctr.id ? { ...c, bidMult: parseFloat(e.target.value) } : c)))
                      }
                      className="w-full accent-sky-500"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-emerald-400">{formatMoney(Math.round(ctr.baseReward * ctr.bidMult))}</span>
                  <span className="text-purple-300">+{ctr.rpReward} RP</span>
                </div>
                <button
                  onClick={() => handleDeliverContract(ctr)}
                  disabled={readyQty < ctr.qty}
                  className={`w-full py-2.5 rounded-xl text-xs font-black ${
                    readyQty >= ctr.qty ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {readyQty >= ctr.qty ? 'Livrer la Commande' : `Manque ${ctr.qty - readyQty} pièces`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- RENDU ARBRE R&D (CONSTELLATION PC + ONGLETS MOBILE) ---
  const renderTechTree = () => {
    const branches = ['Production', 'Métrologie', 'Qualité', 'Méthodes', 'Automatisation', 'Matériaux', 'RH'];
    const branchColors = {
      Production: '#38bdf8',
      Métrologie: '#34d399',
      Qualité: '#fbbf24',
      Méthodes: '#f472b6',
      Automatisation: '#a78bfa',
      Matériaux: '#fb923c',
      RH: '#f43f5e'
    };

    const selectedNode = TECH_TREE_CATALOG.find(t => t.id === selectedTechId) || TECH_TREE_CATALOG[1];
    const isSelUnlocked = unlockedTechs.includes(selectedNode.id);
    const mainReqMet = !selectedNode.req || unlockedTechs.includes(selectedNode.req);
    const crossReqMet = !selectedNode.crossReq || unlockedTechs.includes(selectedNode.crossReq);
    const isSelAvailable = !isSelUnlocked && mainReqMet && crossReqMet;
    const reqNode = selectedNode.req ? TECH_TREE_CATALOG.find(t => t.id === selectedNode.req) : null;
    const crossReqNode = selectedNode.crossReq ? TECH_TREE_CATALOG.find(t => t.id === selectedNode.crossReq) : null;

    const crossLinks = TECH_TREE_CATALOG.filter(t => t.crossReq).map(target => {
      const source = TECH_TREE_CATALOG.find(s => s.id === target.crossReq);
      if (!source) return null;
      const bothUnlocked = unlockedTechs.includes(source.id) && unlockedTechs.includes(target.id);
      const sourceUnlocked = unlockedTechs.includes(source.id);
      const isHoveredLink = hoveredTechId === source.id || hoveredTechId === target.id || selectedTechId === source.id || selectedTechId === target.id;
      const midX = (source.x + target.x) / 2 + (500 - (source.x + target.x) / 2) * 0.14;
      const midY = (source.y + target.y) / 2 + (280 - (source.y + target.y) / 2) * 0.14;
      return { source, target, bothUnlocked, sourceUnlocked, isHoveredLink, midX, midY };
    }).filter(Boolean);

    return (
      <div className="space-y-4">
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" /> Constellation Technologique R&amp;D (7 Branches Interconnectées)
            </h2>
            <p className="text-xs text-slate-400">
              Les branches communiquent entre elles par des <span className="text-cyan-300 font-bold">passerelles industrielles</span> (ex: 5 Axes ↔ MMT 3D, Titane ↔ 5 Axes, Robotique ↔ Scanner 3D).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-purple-950/60 border border-purple-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-purple-300" />
              <span className="text-xs font-black text-purple-200">{Math.floor(researchPoints)} Points R&amp;D (RP)</span>
            </div>
            <button
              onClick={handleBuyResearchPoint}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-black px-3 py-2 rounded-xl shadow-lg transition-all"
            >
              Étude R&amp;D (+10 RP) • {formatMoney(rpStudyCost)}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="hidden md:block xl:col-span-8 bg-[#050811] border border-slate-800 rounded-2xl p-3 relative overflow-hidden shadow-2xl">
            <svg viewBox="0 0 1000 560" className="w-full h-auto select-none">
              <defs>
                <radialGradient id="constellationBg" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="#0f1e3a" stopOpacity="0.9" />
                  <stop offset="65%" stopColor="#070c1a" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#03050a" stopOpacity="1" />
                </radialGradient>
                <filter id="nodeGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="1000" height="560">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect x="0" y="0" width="1000" height="560" rx="16" fill="url(#constellationBg)" />
              <circle cx="500" cy="280" r="95" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 6" />
              <circle cx="500" cy="280" r="195" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 6" />
              <circle cx="500" cy="280" r="295" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4 6" />

              {[
                [70, 40], [180, 35], [340, 50], [660, 48], [840, 55], [930, 120],
                [55, 210], [945, 220], [65, 420], [925, 410], [210, 525], [790, 520], [430, 535], [580, 530]
              ].map(([sx, sy], idx) => (
                <circle key={idx} cx={sx} cy={sy} r={idx % 3 === 0 ? 1.8 : 1.1} fill="#64748b" opacity="0.55" />
              ))}

              <text x="155" y="28" fill="#38bdf8" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">PRODUCTION</text>
              <text x="500" y="14" fill="#34d399" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">MÉTROLOGIE</text>
              <text x="775" y="95" fill="#fbbf24" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">QUALITÉ</text>
              <text x="885" y="262" fill="#f472b6" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">MÉTHODES</text>
              <text x="820" y="495" fill="#a78bfa" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">AUTOMATISATION</text>
              <text x="160" y="542" fill="#fb923c" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">MATÉRIAUX</text>
              <text x="88" y="255" fill="#f43f5e" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="1.5">RH &amp; ÉLITE</text>

              {TECH_TREE_CATALOG.filter(n => !n.req).map(rootNode => {
                const col = branchColors[rootNode.branch] || '#38bdf8';
                return (
                  <line
                    key={`core_${rootNode.id}`}
                    x1="500"
                    y1="280"
                    x2={rootNode.x}
                    y2={rootNode.y}
                    stroke={col}
                    strokeWidth="2.4"
                    strokeOpacity="0.65"
                  />
                );
              })}

              {crossLinks.map(({ source, target, bothUnlocked, sourceUnlocked, isHoveredLink, midX, midY }) => {
                const strokeCol = bothUnlocked ? '#38bdf8' : sourceUnlocked ? '#eab308' : '#334155';
                return (
                  <path
                    key={`cross_${source.id}_${target.id}`}
                    d={`M ${source.x} ${source.y} Q ${midX} ${midY} ${target.x} ${target.y}`}
                    fill="none"
                    stroke={strokeCol}
                    strokeWidth={isHoveredLink ? 3 : bothUnlocked ? 2.2 : 1.5}
                    strokeDasharray={bothUnlocked ? 'none' : '5 5'}
                    strokeOpacity={isHoveredLink ? 1 : bothUnlocked ? 0.85 : 0.45}
                    filter={bothUnlocked || isHoveredLink ? 'url(#nodeGlow)' : undefined}
                  />
                );
              })}

              {TECH_TREE_CATALOG.filter(n => n.req).map(node => {
                const parent = TECH_TREE_CATALOG.find(p => p.id === node.req);
                if (!parent) return null;
                const unlocked = unlockedTechs.includes(node.id);
                const parentUnlocked = unlockedTechs.includes(parent.id);
                const col = branchColors[node.branch] || '#38bdf8';
                const isLit = hoveredTechId === node.id || hoveredTechId === parent.id || selectedTechId === node.id;
                return (
                  <line
                    key={`link_${parent.id}_${node.id}`}
                    x1={parent.x}
                    y1={parent.y}
                    x2={node.x}
                    y2={node.y}
                    stroke={unlocked ? col : parentUnlocked ? '#eab308' : '#1e293b'}
                    strokeWidth={isLit ? 4 : unlocked ? 3 : 2}
                    strokeOpacity={unlocked ? 0.95 : parentUnlocked ? 0.7 : 0.45}
                    filter={unlocked || isLit ? 'url(#nodeGlow)' : undefined}
                  />
                );
              })}

              <g transform="translate(500, 280)">
                <circle r="30" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" filter="url(#nodeGlow)" />
                <circle r="22" fill="#0284c7" fillOpacity="0.25" stroke="#7dd3fc" strokeWidth="1" />
                <text y="-2" fill="#e0f2fe" fontSize="9" fontWeight="900" textAnchor="middle">CNC</text>
                <text y="9" fill="#38bdf8" fontSize="8" fontWeight="800" textAnchor="middle">R&amp;D</text>
              </g>

              {TECH_TREE_CATALOG.map(node => {
                const unlocked = unlockedTechs.includes(node.id);
                const reqOk = (!node.req || unlockedTechs.includes(node.req)) && (!node.crossReq || unlockedTechs.includes(node.crossReq));
                const available = !unlocked && reqOk;
                const isSelected = selectedTechId === node.id;
                const isHovered = hoveredTechId === node.id;
                const col = branchColors[node.branch] || '#38bdf8';
                const strokeColor = unlocked ? col : available ? '#facc15' : '#475569';

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedTechId(node.id)}
                    onMouseEnter={() => setHoveredTechId(node.id)}
                    onMouseLeave={() => setHoveredTechId(null)}
                    className="cursor-pointer"
                  >
                    {(isSelected || isHovered || unlocked) && (
                      <circle
                        r={isSelected ? 27 : 23}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        strokeOpacity={isSelected ? 0.95 : 0.45}
                        filter="url(#nodeGlow)"
                      />
                    )}
                    {available && (
                      <circle r="24" fill="none" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.85" />
                    )}
                    <circle
                      r="18"
                      fill={unlocked ? '#0b192c' : available ? '#1c1917' : '#090d16'}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : 2.2}
                    />
                    <g transform="translate(-18, -18)">
                      <TechNodeGlyph node={node} unlocked={unlocked} available={available} />
                    </g>
                    {unlocked && (
                      <g transform="translate(12, -12)">
                        <circle r="6" fill="#10b981" stroke="#064e3b" strokeWidth="1.2" />
                        <path d="M-2.5 0 L-0.8 2 L2.8 -2" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                      </g>
                    )}
                    {node.crossReq && !unlocked && (
                      <g transform="translate(-12, -12)">
                        <circle r="5.5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.2" />
                        <circle r="2" fill="#38bdf8" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="md:hidden bg-slate-900/95 border border-slate-800 rounded-2xl p-3 space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {branches.map(b => (
                <button
                  key={b}
                  onClick={() => setMobileTechBranch(b)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap border ${mobileTechBranch === b ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  {b}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {TECH_TREE_CATALOG.filter(t => t.branch === mobileTechBranch).map(node => {
                const unlocked = unlockedTechs.includes(node.id);
                const reqOk = (!node.req || unlockedTechs.includes(node.req)) && (!node.crossReq || unlockedTechs.includes(node.crossReq));
                const available = !unlocked && reqOk;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedTechId(node.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${selectedTechId === node.id ? 'border-sky-400 bg-slate-800' : 'border-slate-800 bg-slate-950/80'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TechNodeGlyph node={node} unlocked={unlocked} available={available} />
                      <div>
                        <div className="text-xs font-black text-white">{node.name}</div>
                        <div className="text-[11px] text-slate-400">{node.effect}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded ${unlocked ? 'bg-emerald-900/60 text-emerald-300' : available ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
                      {unlocked ? 'ACQUIS' : available ? 'DISPO' : 'VERROUILLÉ'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="xl:col-span-4 bg-slate-900/95 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border"
                  style={{
                    color: branchColors[selectedNode.branch] || '#38bdf8',
                    borderColor: `${branchColors[selectedNode.branch] || '#38bdf8'}66`,
                    backgroundColor: '#0f172a'
                  }}
                >
                  Branche {selectedNode.branch}
                </span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${isSelUnlocked ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : isSelAvailable ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-slate-800 text-slate-400'}`}>
                  {isSelUnlocked ? 'Technologie Acquise' : isSelAvailable ? 'Prête à débloquer' : 'Verrouillée'}
                </span>
              </div>

              <div className="flex items-center gap-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                  <TechNodeGlyph node={selectedNode} unlocked={isSelUnlocked} available={isSelAvailable} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{selectedNode.name}</h3>
                  <p className="text-xs text-cyan-300 font-semibold">{selectedNode.unlocks}</p>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Effet Industriel</div>
                <p className="text-slate-200 font-semibold">{selectedNode.effect}</p>
              </div>

              {(reqNode || crossReqNode) && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Connexions &amp; Prérequis</div>
                  {reqNode && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Branche {reqNode.branch} : <b>{reqNode.name}</b></span>
                      <span className={mainReqMet ? 'text-emerald-400 font-black' : 'text-rose-400 font-black'}>
                        {mainReqMet ? '✓ Validé' : '✗ Requis'}
                      </span>
                    </div>
                  )}
                  {crossReqNode && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-cyan-300">Passerelle {crossReqNode.branch} : <b>{crossReqNode.name}</b></span>
                      <span className={crossReqMet ? 'text-emerald-400 font-black' : 'text-amber-400 font-black'}>
                        {crossReqMet ? '✓ Relié' : '⚡ Requis'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!isSelUnlocked && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-slate-400 block text-[10px]">Coût Budget</span>
                    <span className={`font-black text-sm ${money >= selectedNode.moneyCost ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatMoney(selectedNode.moneyCost)}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-slate-400 block text-[10px]">Coût Recherche</span>
                    <span className={`font-black text-sm ${researchPoints >= selectedNode.rpCost ? 'text-purple-300' : 'text-rose-400'}`}>
                      {selectedNode.rpCost} RP
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              {isSelUnlocked ? (
                <div className="w-full py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-black text-center">
                  ✓ Compétence active dans votre usine
                </div>
              ) : (
                <button
                  onClick={() => handleUnlockTech(selectedNode)}
                  disabled={!isSelAvailable || money < selectedNode.moneyCost || researchPoints < selectedNode.rpCost}
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
                    isSelAvailable && money >= selectedNode.moneyCost && researchPoints >= selectedNode.rpCost
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {!isSelAvailable
                    ? 'Prérequis ou Passerelle manquante'
                    : money < selectedNode.moneyCost || researchPoints < selectedNode.rpCost
                    ? 'Budget ou RP insuffisant'
                    : `Débloquer ${selectedNode.name}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDU COFFRES, CARTES & GMP-DEX ---
  const renderGacha = () => {
    const unlockedCount = Object.values(inventory).filter(v => v && v.count > 0).length;
    const filteredCards = EMPLOYEES_CATALOG
      .filter(emp => {
        const owned = inventory[emp.id];
        if (!owned || owned.count <= 0) return false;
        if (cardFilterRarity !== 'all' && emp.rarity !== cardFilterRarity) return false;
        if (cardOnlyMergeable && owned.count < 3) return false;
        return true;
      })
      .sort((a, b) => {
        const oa = inventory[a.id] || { count: 0, stars: 1 };
        const ob = inventory[b.id] || { count: 0, stars: 1 };
        if (cardSortBy === 'rarity_desc') return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        if (cardSortBy === 'rarity_asc') return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        if (cardSortBy === 'stars') return ob.stars - oa.stars;
        if (cardSortBy === 'bonus') return b.baseMult - a.baseMult;
        if (cardSortBy === 'count') return ob.count - oa.count;
        return a.name.localeCompare(b.name);
      });

    return (
      <div className="space-y-4">
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2"><Gift className="w-5 h-5 text-amber-400" /> Recrutement RH &amp; Caisses Spécialisées</h2>
              <p className="text-xs text-slate-400">Débloquez la branche <span className="text-rose-400 font-bold">RH</span> dans l’arbre R&amp;D pour accéder aux caisses d’élite (jusqu’à <span className="text-amber-300 font-bold">1% Secret</span>).</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCardSubTab('deck')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${cardSubTab === 'deck' ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
              >
                Mes Cartes ({filteredCards.length})
              </button>
              <button
                onClick={() => setCardSubTab('dex')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${cardSubTab === 'dex' ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
              >
                GMP-Dex ({unlockedCount}/{EMPLOYEES_CATALOG.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {CRATE_TIERS.map(tier => {
              const unlocked = !tier.reqTech || unlockedTechs.includes(tier.reqTech);
              const reqName = tier.reqTech ? TECH_TREE_CATALOG.find(t => t.id === tier.reqTech)?.name : null;
              const price = getCrateCost(tier.id);
              const opensCount = Number(crateOpens?.[tier.id]) || 0;
              const canAfford = unlocked && !isOpeningCrate && money >= price;

              return (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${unlocked ? 'bg-slate-900/95 border-slate-700' : 'bg-slate-950/70 border-slate-800 opacity-80'}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${tier.badgeColor}`}>
                        {tier.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">Tirages : {opensCount}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-semibold mb-3">{tier.subtitle}</p>

                    <div className="flex justify-center my-2">
                      <SupplyCrateSVG
                        isOpening={isOpeningCrate && activeCrateTier === tier.id}
                        rarityColor={lastCrateDrop && activeCrateTier === tier.id ? RARITY_CONFIG[lastCrateDrop.rarity].hex : tier.accent}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[10px] bg-slate-950/90 border border-slate-800 rounded-xl p-2 mt-2">
                      <div className="text-center"><span className="text-rose-400 font-black block">Secret</span><span className="text-white font-bold">{tier.weights.secret}%</span></div>
                      <div className="text-center"><span className="text-red-400 font-black block">Myth.</span><span className="text-white font-bold">{tier.weights.mythique}%</span></div>
                      <div className="text-center"><span className="text-amber-400 font-black block">Lég.</span><span className="text-white font-bold">{tier.weights.legendaire}%</span></div>
                      <div className="text-center"><span className="text-purple-400 font-black block">Épique</span><span className="text-white font-bold">{tier.weights.epique}%</span></div>
                      <div className="text-center"><span className="text-sky-400 font-black block">Rare</span><span className="text-white font-bold">{tier.weights.rare}%</span></div>
                      <div className="text-center"><span className="text-slate-400 font-black block">Com.</span><span className="text-white font-bold">{tier.weights.commun}%</span></div>
                      <div className="col-span-2 text-center"><span className="text-lime-400 font-black block">Malus</span><span className="text-white font-bold">{tier.weights.malus}%</span></div>
                    </div>
                  </div>

                  <div className="mt-3">
                    {!unlocked ? (
                      <div className="w-full py-2 px-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>R&amp;D RH : {reqName}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenCrate(tier.id)}
                        disabled={!canAfford}
                        className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-between transition-all ${canAfford ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                      >
                        <span>{isOpeningCrate && activeCrateTier === tier.id ? 'Recrutement...' : 'Ouvrir Caisse'}</span>
                        <span>{formatMoney(price)}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {lastCrateDrop && (
            <div
              onClick={() => setShowCrateRevealModal(true)}
              className={`mt-4 p-4 rounded-2xl border-2 bg-slate-950/95 flex flex-wrap items-center justify-between gap-4 shadow-xl cursor-pointer hover:scale-[1.01] transition-transform ${RARITY_CONFIG[lastCrateDrop.rarity].border}`}
            >
              <div className="flex items-center gap-3">
                <CharacterPortrait emp={lastCrateDrop} sizeClass="w-16 h-16" />
                <div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${RARITY_CONFIG[lastCrateDrop.rarity].badge}`}>
                    Dernière recrue : {RARITY_CONFIG[lastCrateDrop.rarity].label}
                  </span>
                  <h3 className="text-base font-black text-white mt-1">{lastCrateDrop.name}</h3>
                  <p className="text-xs text-slate-400">{lastCrateDrop.role} • {lastCrateDrop.specialtyLabel || 'Polyvalent'}</p>
                </div>
              </div>
              <div className="text-right text-xs">
                <div className={`font-black ${lastCrateDrop.baseMult >= 0 ? 'text-emerald-400' : 'text-lime-400'}`}>
                  Cadence : {lastCrateDrop.baseMult >= 0 ? `+${Math.round(lastCrateDrop.baseMult * 100)}%` : `${Math.round(lastCrateDrop.baseMult * 100)}%`}
                </div>
                <div className="text-slate-300 font-bold">Qualité : {lastCrateDrop.qualBonus >= 0 ? `+${lastCrateDrop.qualBonus}` : lastCrateDrop.qualBonus}</div>
              </div>
            </div>
          )}
        </div>

        {cardSubTab === 'deck' ? (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'secret', label: 'Secret' },
                  { id: 'mythique', label: 'Mythique' },
                  { id: 'legendaire', label: 'Légendaire' },
                  { id: 'epique', label: 'Épique' },
                  { id: 'rare', label: 'Rare' },
                  { id: 'commun', label: 'Commun' },
                  { id: 'malus', label: 'Malus' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setCardFilterRarity(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cardFilterRarity === f.id ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCardOnlyMergeable(prev => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cardOnlyMergeable ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >
                  Fusionnables (3+)
                </button>
                <select
                  value={cardSortBy}
                  onChange={e => setCardSortBy(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-bold"
                >
                  <option value="rarity_desc">Rareté (Décroissant)</option>
                  <option value="rarity_asc">Rareté (Croissant)</option>
                  <option value="stars">Étoiles ★</option>
                  <option value="bonus">Cadence %</option>
                  <option value="count">Doublons</option>
                  <option value="name">Nom A→Z</option>
                </select>
              </div>
            </div>

            {filteredCards.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Aucune carte ne correspond à ce filtre. Ouvrez une caisse ci-dessus pour recruter !
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredCards.map(emp => {
                  const owned = inventory[emp.id] || { count: 1, stars: 1 };
                  const rar = RARITY_CONFIG[emp.rarity] || RARITY_CONFIG.commun;
                  const canMerge = owned.count >= 3 && owned.stars < 5;
                  return (
                    <div key={emp.id} className={`bg-slate-950/90 border-2 rounded-2xl p-3 flex flex-col justify-between shadow-lg ${rar.border}`}>
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${rar.badge}`}>{rar.label}</span>
                          <span className="text-xs font-black text-slate-300">x{owned.count}</span>
                        </div>
                        <div className="flex items-center gap-2.5 my-2">
                          <CharacterPortrait emp={emp} sizeClass="w-14 h-14" />
                          <div className="min-w-0">
                            <div className="text-sm font-black text-white truncate">{emp.name}</div>
                            <div className="text-[11px] text-amber-400 font-bold">{'★'.repeat(owned.stars)}{'☆'.repeat(Math.max(0, 5 - owned.stars))}</div>
                            <div className="text-[10px] text-slate-400 truncate">{emp.role}</div>
                          </div>
                        </div>
                        <div className="bg-slate-900/90 rounded-xl p-2 text-[11px] space-y-1 border border-slate-800">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cadence :</span>
                            <span className={`font-black ${emp.baseMult >= 0 ? 'text-emerald-400' : 'text-lime-400'}`}>
                              {emp.baseMult >= 0 ? `+${Math.round(emp.baseMult * 100)}%` : `${Math.round(emp.baseMult * 100)}%`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Qualité :</span>
                            <span className="text-sky-300 font-black">{emp.qualBonus >= 0 ? `+${emp.qualBonus}` : emp.qualBonus}</span>
                          </div>
                        </div>
                      </div>

                      {canMerge && (
                        <button
                          onClick={() => handleMergeCard(emp.id)}
                          className="mt-2.5 w-full py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow"
                        >
                          Fusionner (3 → ★{owned.stars + 1})
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Collection GMP-Dex ({unlockedCount} / {EMPLOYEES_CATALOG.length} découverts)</h3>
              <div className="w-40 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                <div className="h-full bg-amber-400" style={{ width: `${Math.round((unlockedCount / Math.max(1, EMPLOYEES_CATALOG.length)) * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {EMPLOYEES_CATALOG.map(emp => {
                const owned = inventory[emp.id];
                const isDiscovered = owned && (owned.count > 0 || (owned.maxStars || 0) > 0);
                const rar = RARITY_CONFIG[emp.rarity] || RARITY_CONFIG.commun;
                return (
                  <div
                    key={emp.id}
                    className={`rounded-xl border p-2.5 flex flex-col items-center text-center ${isDiscovered ? `bg-slate-950/90 ${rar.border}` : 'bg-slate-950/50 border-slate-800 opacity-60'}`}
                  >
                    <div className={!isDiscovered ? 'brightness-0 invert opacity-25' : ''}>
                      <CharacterPortrait emp={emp} sizeClass="w-12 h-12" />
                    </div>
                    <div className="text-xs font-black text-white mt-1.5 truncate w-full">
                      {isDiscovered ? emp.name : '???'}
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border mt-1 ${rar.badge}`}>
                      {rar.label}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {isDiscovered ? `Max ${owned.maxStars || owned.stars || 1}★` : 'Non recruté'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMissions = () => (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h2 className="text-base font-black text-white flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" /> Objectifs &amp; Missions Industrielles
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MISSIONS_CATALOG.map(m => {
          const cur = Number(stats[m.statKey] || 0);
          const done = cur >= m.target;
          const claimed = claimedMissions.includes(m.id);
          return (
            <div key={m.id} className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="text-xs font-black text-white">{m.title}</div>
                <div className="text-[11px] text-slate-400">{m.desc}</div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: `${Math.min(100, Math.round((cur / m.target) * 100))}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 font-bold">
                  {Math.min(cur, m.target)} / {m.target} • Récompense : {formatMoney(m.rewardMoney)} + {m.rewardRP} RP
                </div>
              </div>
              {claimed ? (
                <span className="px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-400 text-xs font-black">✓ Validée</span>
              ) : (
                <button
                  disabled={!done}
                  onClick={() => {
                    adjustMoney(m.rewardMoney);
                    adjustRP(m.rewardRP);
                    setClaimedMissions(prev => [...prev, m.id]);
                    addToast(`Mission "${m.title}" réclamée !`, 'success');
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-black ${
                    done ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {done ? 'Réclamer' : 'En cours'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAtelier = () => (
    <div className="space-y-4">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-sky-400" /> Agrandissement des Bâtiments (jusqu’à 24 îlots)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ATELIER_UPGRADES.sizes.map(sz => {
            const currentSlots = slots.length;
            const isCurrent = atelier.sizeId === sz.id || currentSlots === sz.slots;
            const isSmaller = sz.slots < currentSlots;
            return (
              <div key={sz.id} className={`p-3.5 rounded-2xl border ${isCurrent ? 'bg-sky-950/30 border-sky-500' : 'bg-slate-950/90 border-slate-800'}`}>
                <div className="text-xs font-black text-white">{sz.name}</div>
                <div className="text-[11px] text-slate-400 my-1">Capacité : <b className="text-sky-300">{sz.slots} îlots</b></div>
                {isCurrent ? (
                  <div className="text-xs font-black text-emerald-400 mt-2">✓ Bâtiment Actuel</div>
                ) : isSmaller ? (
                  <div className="text-xs font-bold text-slate-600 mt-2">Déjà dépassé</div>
                ) : (
                  <button
                    onClick={() => {
                      if (money < sz.cost) return addToast('Fonds insuffisants.', 'error');
                      adjustMoney(-sz.cost);
                      setAtelier(a => ({ ...a, sizeId: sz.id }));
                      setSlots(prev => [
                        ...prev,
                        ...Array.from({ length: sz.slots - prev.length }, () => ({
                          machineId: null,
                          employeeId: null,
                          partId: 'spacer_alu',
                          progress: 0,
                          status: 'EMPTY'
                        }))
                      ]);
                      addToast(`Atelier agrandi à ${sz.slots} îlots !`, 'success');
                    }}
                    className="mt-2 w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black"
                  >
                    Construire ({formatMoney(sz.cost)})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <h3 className="text-sm font-black text-white">Revêtements de Sol Industriels</h3>
          {ATELIER_UPGRADES.floors.map(fl => (
            <div key={fl.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-white">{fl.name}</div>
                <div className="text-[11px] text-slate-400">+{Math.round(fl.speedBonus * 100)}% cadence • +{fl.qualBonus} qualité</div>
              </div>
              {atelier.floorId === fl.id ? (
                <span className="text-xs font-black text-emerald-400">✓ Posé</span>
              ) : (
                <button
                  onClick={() => {
                    if (money < fl.cost) return addToast('Fonds insuffisants.', 'error');
                    adjustMoney(-fl.cost);
                    setAtelier(a => ({ ...a, floorId: fl.id }));
                  }}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-black"
                >
                  {formatMoney(fl.cost)}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <h3 className="text-sm font-black text-white">Équipements Logistiques</h3>
          {ATELIER_UPGRADES.extras.map(ex => {
            const owned = atelier.extras.includes(ex.id);
            return (
              <div key={ex.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-white">{ex.name}</div>
                  <div className="text-[11px] text-slate-400">{ex.effect} • {ex.desc}</div>
                </div>
                {owned ? (
                  <span className="text-xs font-black text-emerald-400">✓ Installé</span>
                ) : (
                  <button
                    onClick={() => {
                      if (money < ex.cost) return addToast('Fonds insuffisants.', 'error');
                      adjustMoney(-ex.cost);
                      setAtelier(a => ({ ...a, extras: [...a.extras, ex.id] }));
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-black"
                  >
                    {formatMoney(ex.cost)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="space-y-4">
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> Classement Général Saison 2
          </h2>
          <p className="text-xs text-slate-400">
            Synchronisé automatiquement à chaque connexion • Dernière sauvegarde :{' '}
            <b className="text-emerald-400">{lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : 'Active'}</b>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const snap = persistLocalNow(pseudo);
              if (snap) syncFullSaveToCloud(snap, true);
              syncAndFetchLeaderboard();
              addToast('Sauvegarde locale + Cloud effectuée !', 'success');
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Sauvegarder
          </button>
          <button
            onClick={() => syncAndFetchLeaderboard()}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualiser
          </button>
          <button
            onClick={() => {
              const snap = persistLocalNow(pseudo);
              if (snap) syncFullSaveToCloud(snap, true);
              localStorage.removeItem('cnc_pseudo');
              localStorage.removeItem('cnc_password');
              setIsLoggedIn(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-black flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Déconnexion
          </button>
        </div>
      </div>

      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 space-y-2.5">
        <div className="text-xs font-black text-slate-300 flex items-center justify-between">
          <span>Code de Transfert / Sauvegarde de Secours</span>
          <button
            type="button"
            onClick={() => {
              const snap = persistLocalNow(pseudo);
              if (!snap) return;
              const code = encodeSecureSave(snap);
              if (navigator.clipboard) {
                navigator.clipboard.writeText(code).then(() => addToast('Code de sauvegarde copié !', 'success')).catch(() => setImportCodeText(code));
              } else {
                setImportCodeText(code);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-black flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Copier mon code
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={importCodeText}
            onChange={e => setImportCodeText(e.target.value)}
            placeholder="Collez ici un code GMPSEC2... pour restaurer une partie"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={() => {
              const decoded = decodeSecureSave(importCodeText.trim());
              if (!decoded) return addToast('Code de sauvegarde invalide ou altéré.', 'error');
              applySavedState(decoded);
              const snap = persistLocalNow(pseudo);
              if (snap) syncFullSaveToCloud(snap, true);
              setImportCodeText('');
              addToast('Partie restaurée avec succès !', 'success');
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1"
          >
            <Upload className="w-3 h-3" /> Restaurer
          </button>
        </div>
      </div>

      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl overflow-hidden">
        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Aucun score en ligne chargé (vérifiez votre configuration Firebase ou cliquez sur Actualiser).
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {leaderboard.map((row, idx) => (
              <div key={idx} className={`px-4 py-3 flex items-center justify-between text-xs ${row.pseudo === pseudo ? 'bg-sky-950/30' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black ${idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-black text-white">{row.pseudo}</div>
                    <div className="text-[10px] text-slate-400">Réputation {row.reputation || 10}/100 • {row.partsProduced || 0} pcs</div>
                  </div>
                </div>
                <div className="font-black text-emerald-400 text-sm">{formatMoney(row.money || 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const tutorialSteps = [
    { title: '1. Atelier & Prototypage Manuel', text: 'Cliquez sur « Usiner une pièce » dans l’onglet Atelier pour fabriquer vos premières entretoises Aluminium.' },
    { title: '2. Contrôle & Vente', text: 'Passez par Métrologie pour valider la conformité de vos lots, puis expédiez-les dans Stocks & Ventes.' },
    { title: '3. Automatisation & Machines', text: 'Achetez des machines dans Parc Machines et approvisionnez vos matières premières (Aluminium, Acier, Inox, Titane).' },
    { title: '4. Constellation R&D & Équipe RH', text: 'Débloquez de nouvelles technologies et recrutez des opérateurs (Cartes RH) pour booster vos cadences.' }
  ];

  const readyMissionCount = MISSIONS_CATALOG.filter(
    m => !claimedMissions.includes(m.id) && Number(stats[m.statKey] || 0) >= m.target
  ).length;
  const uninspectedPartsBadge = partLots.filter(l => !l.inspected).reduce((a, b) => a + b.qty, 0);
  const readyToSellBadge = partLots.filter(l => l.inspected && l.isConforming).reduce((a, b) => a + b.qty, 0);
  const noMatSlotsBadge = slots.filter(s => s.machineId && s.status === 'NO_MAT').length;

  const navItems = [
    { id: 'workshop', label: 'Atelier', sub: 'Plan 2D & Clic', icon: Wrench, color: 'text-sky-400', activeBg: 'from-sky-600 to-blue-600', badge: 0 },
    { id: 'machines', label: 'Machines', sub: 'Parc & Îlots', icon: Cog, color: 'text-cyan-400', activeBg: 'from-cyan-600 to-sky-600', badge: noMatSlotsBadge },
    { id: 'stocks', label: 'Stocks', sub: 'Matières & Vente', icon: Package, color: 'text-amber-400', activeBg: 'from-amber-600 to-orange-600', badge: readyToSellBadge },
    { id: 'metrology', label: 'Métrologie', sub: 'Contrôle & ISO', icon: Gauge, color: 'text-emerald-400', activeBg: 'from-emerald-600 to-teal-600', badge: uninspectedPartsBadge },
    { id: 'contracts', label: 'Contrats', sub: 'Appels d’offres', icon: FileSpreadsheet, color: 'text-indigo-400', activeBg: 'from-indigo-600 to-blue-600', badge: 0 },
    { id: 'gacha', label: 'Cartes RH', sub: 'Coffres & Équipe', icon: Gift, color: 'text-pink-400', activeBg: 'from-pink-600 to-rose-600', badge: 0 },
    { id: 'atelier', label: 'Locaux', sub: 'Sols & 24 îlots', icon: Building2, color: 'text-violet-400', activeBg: 'from-violet-600 to-purple-600', badge: 0 },
    { id: 'leaderboard', label: 'Classement', sub: 'Top & Compte', icon: Trophy, color: 'text-yellow-400', activeBg: 'from-amber-500 to-yellow-600', badge: 0 }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20 md:pb-4">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes crateShake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          20% { transform: rotate(-6deg) scale(1.06); }
          40% { transform: rotate(6deg) scale(1.08); }
          60% { transform: rotate(-5deg) scale(1.06); }
          80% { transform: rotate(5deg) scale(1.08); }
        }
        @keyframes cardPopIn {
          0% { opacity: 0; transform: scale(0.45) rotateY(75deg) translateY(25px); }
          65% { opacity: 1; transform: scale(1.04) rotateY(-6deg) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg) translateY(0); }
        }
        .animate-crate-shake { animation: crateShake 0.45s ease-in-out infinite; }
        .animate-card-reveal { animation: cardPopIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>

      {/* NOTIFICATIONS FLOTTANTES */}
      <div className="fixed bottom-20 md:bottom-4 right-3 sm:right-4 z-50 space-y-2 pointer-events-none max-w-[90vw]">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-3.5 py-2 rounded-xl text-xs font-black shadow-xl border backdrop-blur ${
              t.type === 'error'
                ? 'bg-rose-950/95 border-rose-500 text-rose-200'
                : t.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
                : 'bg-slate-900/95 border-sky-500 text-sky-200'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* MODALE DE SÉLECTION DE CARTE OPÉRATEUR */}
      {assignModalSlotIdx !== null && (() => {
        const targetSlot = slots[assignModalSlotIdx];
        const targetMachine = targetSlot ? MACHINES_CATALOG.find(m => m.id === targetSlot.machineId) : null;
        if (!targetSlot || !targetMachine) return null;

        const computeEffectiveSpeedPct = (emp) => {
          const owned = inventory[emp.id];
          const starBoost = 1 + ((owned?.stars || 1) - 1) * 0.28;
          const specBoost = emp.specialty === targetMachine.id ? 1.4 : 1.0;
          return Math.round(emp.baseMult * starBoost * specBoost * 100);
        };

        const candidateCards = EMPLOYEES_CATALOG
          .filter(emp => {
            const owned = inventory[emp.id];
            if (!owned || owned.count <= 0) return false;
            if (assignFilterRarity !== 'all' && emp.rarity !== assignFilterRarity) return false;
            if (assignOnlySpecialty && emp.specialty !== targetMachine.id && emp.specialty !== 'all') return false;
            if (assignOnlyAvailable) {
              const busySlot = slots.findIndex((s, i) => i !== assignModalSlotIdx && s.employeeId === emp.id);
              if (busySlot !== -1) return false;
            }
            return true;
          })
          .sort((a, b) => {
            if (assignSortBy === 'effective_desc') return computeEffectiveSpeedPct(b) - computeEffectiveSpeedPct(a);
            if (assignSortBy === 'rarity_desc') return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
            if (assignSortBy === 'stars') return (inventory[b.id]?.stars || 1) - (inventory[a.id]?.stars || 1);
            if (assignSortBy === 'quality') return b.qualBonus - a.qualBonus;
            return a.name.localeCompare(b.name);
          });

        return (
          <div
            onClick={() => setAssignModalSlotIdx(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="max-w-4xl w-full max-h-[88vh] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
                <div>
                  <span className="text-[10px] font-black uppercase text-sky-400">Affectation Îlot #{assignModalSlotIdx + 1}</span>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    {targetMachine.name}
                    <span className="text-xs font-bold text-slate-400">• Choisissez une carte opérateur</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {targetSlot.employeeId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSlots(prev => prev.map((s, i) => (i === assignModalSlotIdx ? { ...s, employeeId: null } : s)));
                        setAssignModalSlotIdx(null);
                        addToast(`Opérateur retiré de l'îlot #${assignModalSlotIdx + 1}.`, 'info');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-700/60 text-rose-200 text-xs font-black"
                    >
                      Retirer le poste
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAssignModalSlotIdx(null)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-3 border-b border-slate-800 bg-slate-900/90 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'all', label: 'Toutes' },
                      { id: 'secret', label: 'Secret' },
                      { id: 'mythique', label: 'Mythique' },
                      { id: 'legendaire', label: 'Légendaire' },
                      { id: 'epique', label: 'Épique' },
                      { id: 'rare', label: 'Rare' },
                      { id: 'commun', label: 'Commun' },
                      { id: 'malus', label: 'Malus' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAssignFilterRarity(f.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                          assignFilterRarity === f.id ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAssignOnlySpecialty(v => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        assignOnlySpecialty ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Spécialité machine
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignOnlyAvailable(v => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        assignOnlyAvailable ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      Libres uniquement
                    </button>
                    <select
                      value={assignSortBy}
                      onChange={e => setAssignSortBy(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-bold"
                    >
                      <option value="effective_desc">Bonus Machine ↓</option>
                      <option value="rarity_desc">Rareté ↓</option>
                      <option value="stars">Étoiles ★</option>
                      <option value="quality">Qualité +</option>
                      <option value="name">Nom A→Z</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                {candidateCards.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    Aucune carte disponible avec ces filtres. Recrutez des opérateurs dans l’onglet <b className="text-pink-400">Cartes RH</b> !
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {candidateCards.map(emp => {
                      const owned = inventory[emp.id] || { count: 1, stars: 1 };
                      const rar = RARITY_CONFIG[emp.rarity] || RARITY_CONFIG.commun;
                      const isHere = targetSlot.employeeId === emp.id;
                      const otherSlotIdx = slots.findIndex((s, i) => i !== assignModalSlotIdx && s.employeeId === emp.id);
                      const isSpecialtyMatch = emp.specialty === targetMachine.id;
                      const effPct = computeEffectiveSpeedPct(emp);

                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setSlots(prev =>
                              prev.map((s, i) => {
                                if (i === assignModalSlotIdx) return { ...s, employeeId: emp.id };
                                if (s.employeeId === emp.id) return { ...s, employeeId: null };
                                return s;
                              })
                            );
                            setAssignModalSlotIdx(null);
                            addToast(`${emp.name} affecté sur l'îlot #${assignModalSlotIdx + 1} !`, 'success');
                          }}
                          className={`cursor-pointer rounded-2xl border-2 p-3 flex flex-col justify-between transition-all hover:scale-[1.01] bg-slate-950/95 ${
                            isHere ? 'ring-2 ring-sky-400 border-sky-400' : rar.border
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${rar.badge}`}>
                                {rar.label}
                              </span>
                              {isHere ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-600 text-white">En poste ici</span>
                              ) : otherSlotIdx !== -1 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60">
                                  Îlot #{otherSlotIdx + 1}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-400">Disponible</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 my-1.5">
                              <CharacterPortrait emp={emp} sizeClass="w-12 h-12" />
                              <div className="min-w-0">
                                <div className="text-sm font-black text-white truncate">{emp.name}</div>
                                <div className="text-[11px] text-amber-400 font-bold">
                                  {'★'.repeat(owned.stars || 1)}{'☆'.repeat(Math.max(0, 5 - (owned.stars || 1)))}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">{emp.role}</div>
                              </div>
                            </div>

                            <div className="bg-slate-900/90 rounded-xl p-2 text-[11px] space-y-1 border border-slate-800 mt-2">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Cadence sur cette machine :</span>
                                <span className={`font-black ${effPct >= 0 ? 'text-emerald-400' : 'text-lime-400'}`}>
                                  {effPct >= 0 ? `+${effPct}%` : `${effPct}%`}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Qualité :</span>
                                <span className="text-sky-300 font-black">{emp.qualBonus >= 0 ? `+${emp.qualBonus}` : emp.qualBonus}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Spécialité :</span>
                                <span className={`font-bold ${isSpecialtyMatch ? 'text-amber-300' : 'text-slate-300'}`}>
                                  {emp.specialtyLabel} {isSpecialtyMatch ? '(x1.4)' : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2.5 w-full py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-200 hover:text-white border border-sky-500/40 text-center text-xs font-black transition-colors">
                            {isHere ? 'Déjà affecté' : otherSlotIdx !== -1 ? `Transférer depuis l'îlot #${otherSlotIdx + 1}` : 'Affecter à cette machine'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODALE ANIMÉE D'OUVERTURE DE COFFRE & APPARITION DE CARTE */}
      {(isOpeningCrate || (showCrateRevealModal && lastCrateDrop)) && (
        <div
          onClick={() => { if (!isOpeningCrate) setShowCrateRevealModal(false); }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          {isOpeningCrate ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="animate-crate-shake">
                <SupplyCrateSVG isOpening={true} rarityColor="#fbbf24" />
              </div>
              <div className="text-base font-black text-amber-300 tracking-wide uppercase animate-pulse">
                Ouverture de la caisse de recrutement...
              </div>
            </div>
          ) : lastCrateDrop && (
            <div
              onClick={e => e.stopPropagation()}
              className={`animate-card-reveal max-w-xs w-full rounded-3xl border-2 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl text-center space-y-4 relative overflow-hidden ${RARITY_CONFIG[lastCrateDrop.rarity].border}`}
            >
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: `radial-gradient(circle at 50% 25%, ${RARITY_CONFIG[lastCrateDrop.rarity].hex}, transparent 70%)` }}
              />
              <div className="relative z-10 flex flex-col items-center">
                <span className={`text-[11px] font-black uppercase px-3 py-1 rounded-full border tracking-wider ${RARITY_CONFIG[lastCrateDrop.rarity].badge}`}>
                  {RARITY_CONFIG[lastCrateDrop.rarity].label}
                </span>

                <div className="my-4 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-xl">
                  <CharacterPortrait emp={lastCrateDrop} sizeClass="w-28 h-28" />
                </div>

                <h3 className="text-xl font-black text-white">{lastCrateDrop.name}</h3>
                <p className="text-xs text-cyan-300 font-bold mt-0.5">{lastCrateDrop.role}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Spécialité : {lastCrateDrop.specialtyLabel || 'Toutes Machines'}</p>

                <div className="w-full grid grid-cols-2 gap-2 mt-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Cadence</span>
                    <span className={`text-sm font-black ${lastCrateDrop.baseMult >= 0 ? 'text-emerald-400' : 'text-lime-400'}`}>
                      {lastCrateDrop.baseMult >= 0 ? `+${Math.round(lastCrateDrop.baseMult * 100)}%` : `${Math.round(lastCrateDrop.baseMult * 100)}%`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Qualité</span>
                    <span className="text-sm font-black text-sky-300">
                      {lastCrateDrop.qualBonus >= 0 ? `+${lastCrateDrop.qualBonus}` : lastCrateDrop.qualBonus}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCrateRevealModal(false)}
                  className="mt-5 w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg"
                >
                  Ajouter à mon Équipe
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-sky-500/50 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-sky-400">Guide Express • Étape {tutorialStep + 1}/4</span>
              <button
                onClick={() => {
                  localStorage.setItem('cnc_gmp_tuto_seen', '1');
                  setShowTutorial(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-base font-black text-white">{tutorialSteps[tutorialStep].title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{tutorialSteps[tutorialStep].text}</p>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setTutorialStep(s => Math.max(0, s - 1))}
                disabled={tutorialStep === 0}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold disabled:opacity-40"
              >
                Précédent
              </button>
              {tutorialStep < 3 ? (
                <button
                  onClick={() => setTutorialStep(s => s + 1)}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-black"
                >
                  Suivant
                </button>
              ) : (
                <button
                  onClick={() => {
                    localStorage.setItem('cnc_gmp_tuto_seen', '1');
                    setShowTutorial(false);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black"
                >
                  C’est parti !
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EN-TÊTE COMPACT & ERGONOMIQUE MOBILE/PC */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-4 py-2.5 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center font-black text-sm text-white shadow-lg shrink-0">
              GMP
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-white truncate">CNC Tycoon GMP</h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">Joueur : <span className="text-sky-400 font-bold">{pseudo}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="bg-emerald-950/80 border border-emerald-700/60 px-2.5 py-1.5 rounded-xl text-xs font-black text-emerald-300 whitespace-nowrap">
              {formatMoney(money)}
            </div>
            <div className="bg-purple-950/80 border border-purple-700/60 px-2.5 py-1.5 rounded-xl text-xs font-black text-purple-300 whitespace-nowrap">
              {Math.floor(researchPoints)} RP
            </div>
            <button
              onClick={() => setActiveTab('tech')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1 transition-all ${
                activeTab === 'tech'
                  ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                  : 'bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700'
              }`}
              title="Arbre R&D"
            >
              <Cpu className="w-4 h-4" />
              <span className="hidden sm:inline">R&amp;D</span>
            </button>
            <button
              onClick={() => setActiveTab('missions')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1 relative transition-all ${
                activeTab === 'missions'
                  ? 'bg-amber-600 border-amber-400 text-white shadow-lg'
                  : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
              }`}
              title="Missions"
            >
              <Award className="w-4 h-4" />
              <span className="hidden sm:inline">Missions</span>
              {readyMissionCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                  {readyMissionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
              className="p-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
              title="Guide rapide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* NAVIGATION VISUELLE DESKTOP & TABLETTE (CARTES AVEC ICÔNES) */}
        <nav className="hidden md:grid max-w-7xl mx-auto mt-2.5 grid-cols-8 gap-1.5">
          {navItems.map(tab => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-2 rounded-xl border text-left transition-all relative flex items-center gap-2 ${
                  isActive
                    ? `bg-gradient-to-r ${tab.activeBg} border-white/30 text-white shadow-lg`
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-black/20 text-white' : `bg-slate-900 ${tab.color}`}`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">{tab.label}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : 'text-slate-500'}`}>{tab.sub}</div>
                </div>
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black shadow">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* RUBAN D'ACCÈS SECONDAIRE SUR MOBILE (POUR LES ONGLETS HORS BARRE INFÉRIEURE) */}
        <div className="flex md:hidden gap-1.5 overflow-x-auto mt-2 pb-0.5 no-scrollbar">
          {navItems.map(tab => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap flex items-center gap-1.5 border relative ${
                  isActive
                    ? `bg-gradient-to-r ${tab.activeBg} border-white/30 text-white shadow`
                    : 'bg-slate-950/90 border-slate-800 text-slate-300'
                }`}
              >
                <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="px-1.5 rounded-full bg-rose-500 text-white text-[9px]">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4">
        {activeTab === 'workshop' && renderWorkshop()}
        {activeTab === 'machines' && renderMachines()}
        {activeTab === 'stocks' && renderStocks()}
        {activeTab === 'metrology' && renderMetrology()}
        {activeTab === 'contracts' && renderContracts()}
        {activeTab === 'tech' && renderTechTree()}
        {activeTab === 'gacha' && renderGacha()}
        {activeTab === 'missions' && renderMissions()}
        {activeTab === 'atelier' && renderAtelier()}
        {activeTab === 'leaderboard' && renderLeaderboard()}
      </main>

      {/* BARRE DE NAVIGATION TACTILE INFÉRIEURE SUR TÉLÉPHONE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-1.5 py-1.5 grid grid-cols-5 gap-1">
        {[
          navItems[0], // Atelier
          navItems[1], // Machines
          navItems[2], // Stocks
          navItems[3], // Métrologie
          navItems[5]  // Cartes RH
        ].map(tab => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={`bottom_${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center relative transition-all ${
                isActive ? 'bg-sky-600/25 text-sky-300 border border-sky-500/40' : 'text-slate-400'
              }`}
            >
              <IconComp className={`w-4 h-4 ${isActive ? 'text-sky-400' : tab.color}`} />
              <span className="text-[10px] font-black mt-0.5 truncate max-w-full px-1">{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-rose-500" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
