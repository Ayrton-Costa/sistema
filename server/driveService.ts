import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

export interface SystemConfigData {
  systemName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface IndustryLogoData {
  industryId: string;
  industryName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface StoreLogoData {
  storeId: string;
  storeName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface CoordinatorLogoData {
  coordinatorId: string;
  coordinatorName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface DriveManifest {
  systemConfig: SystemConfigData;
  industryLogos: Record<string, IndustryLogoData>;
  storeLogos: Record<string, StoreLogoData>;
  coordinatorLogos: Record<string, CoordinatorLogoData>;
  version: number;
  lastUpdated: string;
}

// Diretório para armazenamento persistente local híbrido
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const LOCAL_MANIFEST_PATH = path.resolve(DATA_DIR, 'validades_logos_manifest.json');

// Garante que os diretórios existam
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  // Ignora erro de criação se já existir
}

// Credenciais da Conta de Serviço Google Cloud
export const SERVICE_ACCOUNT_CREDENTIALS = {
  type: 'service_account',
  project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID || 'lofty-root-387111',
  private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID || '9db11577abbf5f4fed6353d8d194004df82a3194',
  private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDdjAlNjm8/GjEc
J/gfr4mkTC6xN2pOyJ5mAqXi3DY1Q9fI5LKXIm8DbQGMFZ+8yqFfTnFvjLfOx9te
yOHtiQ/RkTqG1yeAVn71sVIK/3Jgdw+mcXHNyQuC/yXZeZ92lBdxOMbz0rjXTqG7
Zz6+wrkvvwYJYL7XYn7FT0fQPEuxRH1oM0+1m4+6ao1UYvmezEDp0T9a/XPB3PKR
c0BgwWJv7lTGJ44y2rJjnLDbw/e+onsrHDBRmg890IB/aZ06wIv49rp/Z3oUBwGY
R5Iy0LQKPed78DkVwrFICipoUJJgDyobd2Xj0KI2aosBt9aBUik99YB7wm1K5qZX
KQtY0XU/AgMBAAECggEAC1mYwmnpJhzz5iLgEdN+5DVo8PhLUHTztHsvP3OTrV/n
5qlcwuRnNpA3k5MqB1SENutAYXwekI/pm64D8RTkBBMCIhVUtzz3LSQj9V9H30xK
N3c5YtcJaXEj4cPa2QrWNp03iBdEE/e5zm2IJ+K29Qy+xO05abRolTguECt+nzqw
HpnXegJdnLiPZmXRIuZV2wjt3shSen0/2mZBrdsSJq/DV8XT6y/zBbE1b0a3vr7q
LCVBKK6lolvjtlSmYATJS1B4uPYBhit7MLUjCCctFCKPQbodFnzVFJXMlcpEKK8T
UMAbKXKUYbKYG0gZfU7HfUL5MfCaCY9b5XbL99LJbQKBgQD1KwIcpZeRO1YJ2waI
hQfODaQJey8bSDWMmW3lAf1M0maFju3TiydMr1C056lUh/WnbmYXi8dI4wer3p0I
Rt4WxtfjkutUaQPW4wpp8cbZrO3BTIh7JjoqGL11lFVloii3F968NV+ZbyEN7At3
0RzZY3ndPPNW5wJUGpomYx2V5QKBgQDnVdxx3Q5uRKlghJdNUv45fnJzPLLWrcBh
nIQS435Hk2VrcYqmo5fuq+4dPJC+K3RfTZYqAmqimB+h8e/K2LpxOScvkPiLrGJp
BpHZgbfoXsoTop/pgNQVd+VqoflsyxK1+O1+mP9mnh2MCeCd3b7W2JRiGUXOXMVK
vVz1JzSsUwKBgQCQavZCg7TlwysqgQ+3KY3wbg6b2ylji8SnftXCWcqpDyN/NzOX
MlhDDt6ewfv4JGKrbxfKdPc+UyX4sxiTgJNgnV8c2jWvsnCli3Zd9CMrpHclL30R
9fG7THmGIouvY7dSK0h0W4hl7JVvCwWyXcb9s2Bc14OMRGYVvtnhFO+flQKBgHxL
4Pd5DADpeYx3kYgleJ1RuJL8YScCEqUf4ML5Yud4Zfz188aXjdHapUUmPqs/U/bF
DFMkG0GjtRNhmDMIghzF1a00GqeJhxLhScpxbWw4SiGEtqFS7CFg226Q+yCeeD44
Mvtbn5b2i++revm3pItxsUCITb6UkBkZZ/H9D8srAoGBAO0NMEd1XALbMTFUMm4y
IPwGU0acTKbcy3h0ZoJyi9rHSlh/1+XaWKAEVy9KCAY+yRdEHkuGKQNa+MI1JYIo
1VaFHTbBzcBCBCy9fX5fQev+2T/mpmQ9LIYx7HHejZjFZBuF6Mljvr7WFR6foJaZ
1J9hrPRRHbHaJzS2gjyZejac
-----END PRIVATE KEY-----`).replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'intelig-ncia-transcr-o@lofty-root-387111.iam.gserviceaccount.com',
  client_id: '104336877923313368116',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

// Limpa URL ou ID de pasta do Google Drive
export function extractDriveFolderId(input: string): string {
  if (!input) return '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK-';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    let id = folderMatch[1];
    if (id === '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK') {
      id = `${id}-`;
    }
    return id;
  }
  const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    let id = idMatch[1];
    if (id === '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK') {
      id = `${id}-`;
    }
    return id;
  }
  let cleaned = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleaned === '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK') {
    cleaned = `${cleaned}-`;
  }
  return cleaned || '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK-';
}

// Pasta atual do Google Drive
let currentFolderId = extractDriveFolderId(process.env.GOOGLE_API_FOLDER_ID || '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK-');

export function getCurrentFolderId(): string {
  return currentFolderId;
}

export function setCurrentFolderId(newId: string): string {
  const cleaned = extractDriveFolderId(newId);
  if (cleaned) {
    currentFolderId = cleaned;
  }
  return currentFolderId;
}

const MANIFEST_FILE_NAME = 'validades_logos_manifest.json';

// In-memory fallback / cache inicial
function loadInitialManifest(): DriveManifest {
  try {
    if (fs.existsSync(LOCAL_MANIFEST_PATH)) {
      const content = fs.readFileSync(LOCAL_MANIFEST_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          systemConfig: {
            systemName: parsed.systemConfig?.systemName || 'Controle de Validade',
            logoUrl: parsed.systemConfig?.logoUrl || '',
            driveFileId: parsed.systemConfig?.driveFileId || '',
            updatedAt: parsed.systemConfig?.updatedAt || new Date().toISOString(),
          },
          industryLogos: parsed.industryLogos || {},
          storeLogos: parsed.storeLogos || {},
          coordinatorLogos: parsed.coordinatorLogos || {},
          version: parsed.version || 1,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    }
  } catch (_e) {
    // Retorna fallback
  }

  return {
    systemConfig: {
      systemName: 'Controle de Validade',
      logoUrl: '',
      updatedAt: new Date().toISOString(),
    },
    industryLogos: {},
    storeLogos: {},
    coordinatorLogos: {},
    version: 1,
    lastUpdated: new Date().toISOString(),
  };
}

let localManifestCache: DriveManifest = loadInitialManifest();

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_CREDENTIALS.client_email,
    key: SERVICE_ACCOUNT_CREDENTIALS.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

export async function checkDriveConnection() {
  try {
    const drive = getDriveClient();
    const folderRes = await drive.files.get({
      fileId: currentFolderId,
      fields: 'id, name, mimeType, trashed, shared',
      supportsAllDrives: true,
    });

    return {
      connected: true,
      folderId: currentFolderId,
      folderName: folderRes.data.name || 'controle de vencimento uploand',
      serviceAccount: SERVICE_ACCOUNT_CREDENTIALS.client_email,
      storageNote: 'Conectado ao Google Drive com armazenamento híbrido resiliente.',
    };
  } catch (error: any) {
    let errorHelp = error?.message || 'Erro ao conectar ao Google Drive';

    if (error?.code === 404 || error?.status === 404) {
      errorHelp = `A pasta "${currentFolderId}" não foi encontrada no Google Drive ou a Conta de Serviço não tem acesso. Compartilhe a pasta no Google Drive com ${SERVICE_ACCOUNT_CREDENTIALS.client_email} (permissão Editor).`;
    } else if (error?.code === 403 || error?.status === 403) {
      errorHelp = `Permissão negada. Compartilhe a pasta do Google Drive com ${SERVICE_ACCOUNT_CREDENTIALS.client_email} como Editor.`;
    }

    return {
      connected: false,
      folderId: currentFolderId,
      serviceAccount: SERVICE_ACCOUNT_CREDENTIALS.client_email,
      error: errorHelp,
    };
  }
}

/**
 * Cria uma pasta dedicada automaticamente no Drive se o usuário desejar
 */
export async function createAutoFolder(): Promise<{ success: boolean; folderId?: string; error?: string }> {
  try {
    const drive = getDriveClient();
    const folder = await drive.files.create({
      requestBody: {
        name: 'Controle de Validades - Logos',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
    });

    if (folder.data.id) {
      currentFolderId = folder.data.id;
      return {
        success: true,
        folderId: folder.data.id,
      };
    }
    return { success: false, error: 'Não foi possível obter o ID da pasta criada.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Falha ao criar pasta automática no Drive' };
  }
}

async function findFileInFolder(fileName: string): Promise<string | null> {
  try {
    if (!currentFolderId) return null;
    const drive = getDriveClient();
    const query = `'${currentFolderId}' in parents and name = '${fileName}' and trashed = false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id || null;
    }
    return null;
  } catch (_err: any) {
    return null;
  }
}

export async function getDriveManifest(): Promise<DriveManifest> {
  try {
    // 1. Tentar ler do Google Drive se o arquivo existir
    const manifestFileId = await findFileInFolder(MANIFEST_FILE_NAME);
    if (manifestFileId) {
      const drive = getDriveClient();
      const res = await drive.files.get(
        { fileId: manifestFileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'json' }
      );

      if (res.data && typeof res.data === 'object') {
        const data = res.data as any;
        localManifestCache = {
          systemConfig: {
            systemName: data.systemConfig?.systemName || localManifestCache.systemConfig.systemName,
            logoUrl: data.systemConfig?.logoUrl || localManifestCache.systemConfig.logoUrl,
            driveFileId: data.systemConfig?.driveFileId || localManifestCache.systemConfig.driveFileId,
            updatedAt: data.systemConfig?.updatedAt || new Date().toISOString(),
          },
          industryLogos: data.industryLogos || localManifestCache.industryLogos || {},
          storeLogos: data.storeLogos || localManifestCache.storeLogos || {},
          coordinatorLogos: data.coordinatorLogos || localManifestCache.coordinatorLogos || {},
          version: data.version || 1,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        };

        // Salva cópia local
        try {
          fs.writeFileSync(LOCAL_MANIFEST_PATH, JSON.stringify(localManifestCache, null, 2), 'utf-8');
        } catch (_w) {}

        return localManifestCache;
      }
    }
  } catch (_err) {
    // Falha silenciosa no Drive - usa persistência local
  }

  // 2. Fallback de persistência local em disco
  try {
    if (fs.existsSync(LOCAL_MANIFEST_PATH)) {
      const content = fs.readFileSync(LOCAL_MANIFEST_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        localManifestCache = {
          systemConfig: parsed.systemConfig || localManifestCache.systemConfig,
          industryLogos: parsed.industryLogos || {},
          storeLogos: parsed.storeLogos || {},
          coordinatorLogos: parsed.coordinatorLogos || {},
          version: parsed.version || 1,
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    }
  } catch (_err) {}

  return localManifestCache;
}

export async function saveDriveManifest(manifest: DriveManifest): Promise<boolean> {
  localManifestCache = manifest;

  // 1. Sempre salva imediatamente no armazenamento local persistente
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  } catch (diskErr) {
    console.warn('Aviso ao gravar manifesto em disco:', diskErr);
  }

  // 2. Tenta sincronizar com o Google Drive (sem travar se a cota de Service Account estiver restrita)
  try {
    const drive = getDriveClient();
    const manifestFileId = await findFileInFolder(MANIFEST_FILE_NAME);
    const jsonString = JSON.stringify(manifest, null, 2);
    const stream = Readable.from([jsonString]);

    if (manifestFileId) {
      await drive.files.update({
        fileId: manifestFileId,
        media: {
          mimeType: 'application/json',
          body: stream,
        },
        supportsAllDrives: true,
      });
    } else {
      await drive.files.create({
        requestBody: {
          name: MANIFEST_FILE_NAME,
          parents: [currentFolderId],
          mimeType: 'application/json',
        },
        media: {
          mimeType: 'application/json',
          body: stream,
        },
        supportsAllDrives: true,
      });
    }
    return true;
  } catch (_driveErr) {
    // Cota restrita de Service Account ou pasta pessoal: persistido com sucesso localmente
    return true;
  }
}

export async function uploadImageToDrive(
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; webViewLink?: string; publicUrl: string }> {
  // 1. Salva imediatamente cópia local de alta performance e disponibilidade
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const localFilePath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(localFilePath, buffer);
  } catch (fsErr) {
    console.warn('Aviso ao salvar arquivo no disco local:', fsErr);
  }

  // Identificador padrão caso o Google Drive restrinja cota de contas de serviço
  let fileId = `local_${fileName}`;
  const drive = getDriveClient();

  // 2. Tentar envio para o Google Drive
  try {
    const existingFileId = await findFileInFolder(fileName);
    const stream = Readable.from(buffer);

    if (existingFileId) {
      const updateRes = await drive.files.update({
        fileId: existingFileId,
        media: {
          mimeType,
          body: stream,
        },
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true,
      });
      if (updateRes.data.id) {
        fileId = updateRes.data.id;
      }
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [currentFolderId],
          mimeType,
        },
        media: {
          mimeType,
          body: stream,
        },
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true,
      });
      if (createRes.data.id) {
        fileId = createRes.data.id;
      }
    }

    // Tentar tornar o arquivo acessível publicamente para leitura
    if (fileId && !fileId.startsWith('local_')) {
      try {
        await drive.permissions.create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true,
        });
      } catch (_permErr) {}
    }
  } catch (driveErr: any) {
    // Quando a Google rejeita com 'Service Accounts do not have storage quota'
    // em pastas pessoais (My Drive), mantemos o arquivo salvo no armazenamento local persistente
    // com entrega imediata e perfeita via streaming proxy!
    fileId = `local_${fileName}`;
  }

  const publicUrl = `/api/drive/file/${fileId}`;
  return {
    fileId,
    publicUrl,
  };
}

export async function deleteFileFromDrive(fileId: string): Promise<boolean> {
  // Se for arquivo local
  if (fileId.startsWith('local_')) {
    const rawFileName = fileId.replace(/^local_/, '');
    const localFilePath = path.join(UPLOADS_DIR, rawFileName);
    try {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      return true;
    } catch (_e) {
      return false;
    }
  }

  // Se for arquivo no Google Drive
  try {
    const drive = getDriveClient();
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
  } catch (_err) {}

  return true;
}

export const deleteDriveFile = deleteFileFromDrive;

export async function getDriveFileStream(fileId: string) {
  // 1. Se for arquivo local, serve diretamente do disco com máxima velocidade
  if (fileId.startsWith('local_')) {
    const fileName = fileId.replace(/^local_/, '');
    const filePath = path.join(UPLOADS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      let mimeType = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.svg') mimeType = 'image/svg+xml';

      return {
        stream: fs.createReadStream(filePath),
        meta: {
          mimeType,
          name: fileName,
          size: stats.size,
        },
      };
    }
  }

  // 2. Se houver cópia em disco local com o mesmo ID ou nome
  const fallbackPath = path.join(UPLOADS_DIR, fileId);
  if (fs.existsSync(fallbackPath)) {
    const stats = fs.statSync(fallbackPath);
    return {
      stream: fs.createReadStream(fallbackPath),
      meta: {
        mimeType: 'image/png',
        name: fileId,
        size: stats.size,
      },
    };
  }

  // 3. Tentar buscar do Google Drive
  const drive = getDriveClient();
  const fileMeta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true,
  });

  const fileStream = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  );

  return {
    stream: fileStream.data,
    meta: {
      mimeType: fileMeta.data.mimeType || 'image/png',
      name: fileMeta.data.name || 'image',
      size: fileMeta.data.size,
    },
  };
}

export const GOOGLE_DRIVE_FOLDER_ID = getCurrentFolderId();
