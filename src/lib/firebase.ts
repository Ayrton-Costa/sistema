import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const auth = getAuth(getApp());
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Inicialização segura do Firebase (Singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Chaves de cache local para agilidade e modo offline
const STORAGE_SYSTEM_LOGO_KEY = 'validades_system_logo_firebase_cache';
const STORAGE_INDUSTRY_LOGOS_KEY = 'validades_industry_logos_firebase_cache';

export interface SystemBranding {
  logoUrl: string;
  systemName?: string;
  updatedAt: string;
}

export interface IndustryLogoItem {
  id: string; // ID sanitizado para chave no Firestore
  industryName: string;
  logoUrl: string;
  updatedAt: string;
}

// Sanitiza o nome da indústria para um ID seguro compatível com isValidId do Firestore (letras, números, _, -)
export function sanitizeIndustryId(name: string): string {
  if (!name) return 'geral';
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 64);
  return clean || 'ind_' + Math.abs(hashCode(name));
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// Teste de conexão com o Firestore
export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'system_config', 'branding'));
    return { ok: true };
  } catch (error: any) {
    if (error?.code === 'unavailable' || error?.message?.includes('the client is offline')) {
      return { ok: false, error: 'Cliente offline ou indisponível.' };
    }
    // Se o documento simplesmente não existir ainda, a conexão com o servidor foi bem-sucedida!
    return { ok: true };
  }
}

// -------------------------------------------------------------
// 1. LOGO DO SISTEMA (Salvo no Firestore: /system_config/branding)
// -------------------------------------------------------------

export function getCachedSystemBranding(): SystemBranding | null {
  try {
    const raw = localStorage.getItem(STORAGE_SYSTEM_LOGO_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function fetchSystemBranding(): Promise<SystemBranding | null> {
  const cached = getCachedSystemBranding();
  try {
    const ref = doc(db, 'system_config', 'branding');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as SystemBranding;
      localStorage.setItem(STORAGE_SYSTEM_LOGO_KEY, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.GET, 'system_config/branding');
    } catch {
      // Retorna o cache caso o Firestore esteja em carregamento inicial
      return cached;
    }
  }
  return cached;
}

export async function saveSystemBranding(logoUrl: string, systemName?: string): Promise<SystemBranding> {
  const branding: SystemBranding = {
    logoUrl,
    systemName: systemName?.trim() || 'Controle de Validades',
    updatedAt: new Date().toISOString(),
  };

  try {
    const ref = doc(db, 'system_config', 'branding');
    await setDoc(ref, branding);
    localStorage.setItem(STORAGE_SYSTEM_LOGO_KEY, JSON.stringify(branding));
    return branding;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'system_config/branding');
  }
}

export async function removeSystemLogo(): Promise<void> {
  try {
    const ref = doc(db, 'system_config', 'branding');
    await deleteDoc(ref);
    localStorage.removeItem(STORAGE_SYSTEM_LOGO_KEY);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'system_config/branding');
  }
}

// -------------------------------------------------------------
// 2. LOGOS DAS INDÚSTRIAS (Salvo no Firestore: /industry_logos/{id})
// -------------------------------------------------------------

export function getCachedIndustryLogos(): Record<string, IndustryLogoItem> {
  try {
    const raw = localStorage.getItem(STORAGE_INDUSTRY_LOGOS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveCachedIndustryLogos(map: Record<string, IndustryLogoItem>) {
  try {
    localStorage.setItem(STORAGE_INDUSTRY_LOGOS_KEY, JSON.stringify(map));
  } catch {}
}

export async function fetchAllIndustryLogos(): Promise<Record<string, IndustryLogoItem>> {
  const cached = getCachedIndustryLogos();
  try {
    const colRef = collection(db, 'industry_logos');
    const snapshot = await getDocs(colRef);
    const map: Record<string, IndustryLogoItem> = {};

    snapshot.forEach((d) => {
      const item = d.data() as IndustryLogoItem;
      const key = item.industryName.trim().toLowerCase();
      map[key] = {
        ...item,
        id: d.id,
      };
    });

    saveCachedIndustryLogos(map);
    return map;
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.LIST, 'industry_logos');
    } catch {
      return cached;
    }
  }
  return cached;
}

export async function saveIndustryLogo(industryName: string, logoUrl: string): Promise<IndustryLogoItem> {
  const trimmedName = industryName.trim();
  const id = sanitizeIndustryId(trimmedName);
  const path = `industry_logos/${id}`;

  const item: IndustryLogoItem = {
    id,
    industryName: trimmedName,
    logoUrl,
    updatedAt: new Date().toISOString(),
  };

  try {
    const ref = doc(db, 'industry_logos', id);
    await setDoc(ref, item);

    // Atualiza cache local
    const cached = getCachedIndustryLogos();
    cached[trimmedName.toLowerCase()] = item;
    saveCachedIndustryLogos(cached);

    return item;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeIndustryLogo(industryName: string): Promise<void> {
  const trimmedName = industryName.trim();
  const id = sanitizeIndustryId(trimmedName);
  const path = `industry_logos/${id}`;

  try {
    const ref = doc(db, 'industry_logos', id);
    await deleteDoc(ref);

    const cached = getCachedIndustryLogos();
    delete cached[trimmedName.toLowerCase()];
    saveCachedIndustryLogos(cached);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------
// 3. UTILITÁRIO DE PROCESSAMENTO E COMPRESSÃO DE IMAGEM
// -------------------------------------------------------------

/**
 * Redimensiona e otimiza imagens (PNG/JPEG) no navegador para evitar arquivos
 * pesados e garantir carregamento instantâneo no Firebase Firestore (< 150KB).
 */
export async function optimizeImageFile(file: File, maxDimension = 360, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        // Fundo transparente preservado para PNG
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Se arquivo original for PNG, tenta png, senão jpeg
        const isPng = file.type === 'image/png';
        const dataUrl = canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
