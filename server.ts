import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkDriveConnection,
  getDriveManifest,
  saveDriveManifest,
  uploadImageToDrive,
  getDriveFileStream,
  deleteDriveFile,
  createAutoFolder,
  setCurrentFolderId,
  getCurrentFolderId,
  GOOGLE_DRIVE_FOLDER_ID,
  SERVICE_ACCOUNT_CREDENTIALS,
} from './server/driveService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Permite payloads de imagem em base64 até 25MB
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // ==========================================
  // ROTAS DE API DO GOOGLE DRIVE
  // ==========================================

  // 1. Status da Conexão com Google Drive
  app.get('/api/drive/status', async (_req, res) => {
    try {
      const status = await checkDriveConnection();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({
        connected: false,
        error: err?.message || 'Erro ao verificar conexão com o Google Drive',
      });
    }
  });

  // Atualizar ID da Pasta do Google Drive
  app.post('/api/drive/folder', async (req, res) => {
    try {
      const { folderId } = req.body;
      if (!folderId || !folderId.trim()) {
        return res.status(400).json({ success: false, error: 'ID ou link da pasta é obrigatório' });
      }
      const updatedId = setCurrentFolderId(folderId);
      const status = await checkDriveConnection();
      res.json({ success: true, folderId: updatedId, status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao configurar pasta' });
    }
  });

  // Criar Pasta Automática no Google Drive da Conta de Serviço
  app.post('/api/drive/create-folder', async (_req, res) => {
    try {
      const result = await createAutoFolder();
      if (result.success) {
        const status = await checkDriveConnection();
        res.json({ success: true, folderId: result.folderId, status });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao criar pasta' });
    }
  });

  // 2. Obter Manifesto de Logos e Configurações
  app.get('/api/drive/manifest', async (_req, res) => {
    try {
      const manifest = await getDriveManifest();
      res.json({ success: true, manifest });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Erro ao obter manifesto do Google Drive',
      });
    }
  });

  // 3. Salvar / Atualizar Identidade do Sistema
  app.post('/api/drive/system-config', async (req, res) => {
    try {
      const { systemName, imageBase64, mimeType = 'image/png' } = req.body;
      const manifest = await getDriveManifest();

      let logoUrl = manifest.systemConfig.logoUrl;
      let driveFileId = manifest.systemConfig.driveFileId;

      if (imageBase64) {
        // Converte base64 data url ou puro para buffer
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const fileName = `system_logo_${Date.now()}.png`;

        const uploadResult = await uploadImageToDrive(fileName, buffer, mimeType);
        logoUrl = uploadResult.publicUrl;
        driveFileId = uploadResult.fileId;
      }

      manifest.systemConfig = {
        systemName: systemName !== undefined ? systemName : manifest.systemConfig.systemName,
        logoUrl: logoUrl || '',
        driveFileId: driveFileId || '',
        updatedAt: new Date().toISOString(),
      };
      manifest.lastUpdated = new Date().toISOString();

      await saveDriveManifest(manifest);

      res.json({
        success: true,
        systemConfig: manifest.systemConfig,
        message: 'Identidade do sistema salva com sucesso!',
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar system-config:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Falha ao salvar configuração',
      });
    }
  });

  // 4. Salvar / Atualizar Logo de Indústria
  app.post('/api/drive/industry-logo', async (req, res) => {
    try {
      const { industryName, imageBase64, mimeType = 'image/png' } = req.body;

      if (!industryName || !industryName.trim()) {
        return res.status(400).json({ success: false, error: 'Nome da indústria é obrigatório' });
      }

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Imagem em base64 é obrigatória' });
      }

      const trimmedName = industryName.trim();
      const industryId = trimmedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const fileName = `industry_${industryId}.png`;

      const uploadResult = await uploadImageToDrive(fileName, buffer, mimeType);
      const manifest = await getDriveManifest();

      const logoItem = {
        industryId,
        industryName: trimmedName,
        logoUrl: uploadResult.publicUrl,
        driveFileId: uploadResult.fileId,
        updatedAt: new Date().toISOString(),
      };

      manifest.industryLogos[industryId] = logoItem;
      manifest.lastUpdated = new Date().toISOString();

      await saveDriveManifest(manifest);

      res.json({
        success: true,
        logoItem,
        message: `Logotipo de "${trimmedName}" salvo com sucesso!`,
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar industry-logo:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Falha ao salvar logo',
      });
    }
  });

  // 5. Excluir Logo de Indústria
  app.delete('/api/drive/industry-logo/:industryId', async (req, res) => {
    try {
      const { industryId } = req.params;
      const manifest = await getDriveManifest();
      const existing = manifest.industryLogos[industryId];

      if (existing) {
        if (existing.driveFileId) {
          await deleteDriveFile(existing.driveFileId);
        }
        delete manifest.industryLogos[industryId];
        manifest.lastUpdated = new Date().toISOString();
        await saveDriveManifest(manifest);
      }

      res.json({ success: true, message: 'Logo excluído com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao remover logo' });
    }
  });

  // 6. Salvar / Atualizar Logo de Loja
  app.post('/api/drive/store-logo', async (req, res) => {
    try {
      const { storeName, imageBase64, mimeType = 'image/png' } = req.body;

      if (!storeName || !storeName.trim()) {
        return res.status(400).json({ success: false, error: 'Nome da loja é obrigatório' });
      }

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Imagem em base64 é obrigatória' });
      }

      const trimmedName = storeName.trim();
      const storeId = trimmedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const fileName = `store_${storeId}.png`;

      const uploadResult = await uploadImageToDrive(fileName, buffer, mimeType);
      const manifest = await getDriveManifest();

      const logoItem = {
        storeId,
        storeName: trimmedName,
        logoUrl: uploadResult.publicUrl,
        driveFileId: uploadResult.fileId,
        updatedAt: new Date().toISOString(),
      };

      if (!manifest.storeLogos) manifest.storeLogos = {};
      manifest.storeLogos[storeId] = logoItem;
      manifest.lastUpdated = new Date().toISOString();

      await saveDriveManifest(manifest);

      res.json({
        success: true,
        logoItem,
        message: `Logotipo de "${trimmedName}" salvo com sucesso!`,
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar store-logo:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Falha ao salvar logo da loja',
      });
    }
  });

  // 7. Excluir Logo de Loja
  app.delete('/api/drive/store-logo/:storeId', async (req, res) => {
    try {
      const { storeId } = req.params;
      const manifest = await getDriveManifest();
      const existing = manifest.storeLogos?.[storeId];

      if (existing) {
        if (existing.driveFileId) {
          await deleteDriveFile(existing.driveFileId);
        }
        delete manifest.storeLogos[storeId];
        manifest.lastUpdated = new Date().toISOString();
        await saveDriveManifest(manifest);
      }

      res.json({ success: true, message: 'Logo da loja excluído com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao remover logo da loja' });
    }
  });

  // 8. Salvar / Atualizar Logo / Foto do Coordenador
  app.post('/api/drive/coordinator-logo', async (req, res) => {
    try {
      const { coordinatorName, imageBase64, mimeType = 'image/png' } = req.body;

      if (!coordinatorName || !coordinatorName.trim()) {
        return res.status(400).json({ success: false, error: 'Nome do coordenador é obrigatório' });
      }

      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Imagem em base64 é obrigatória' });
      }

      const trimmedName = coordinatorName.trim();
      const coordinatorId = trimmedName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const fileName = `coordinator_${coordinatorId}.png`;

      const uploadResult = await uploadImageToDrive(fileName, buffer, mimeType);
      const manifest = await getDriveManifest();

      const logoItem = {
        coordinatorId,
        coordinatorName: trimmedName,
        logoUrl: uploadResult.publicUrl,
        driveFileId: uploadResult.fileId,
        updatedAt: new Date().toISOString(),
      };

      if (!manifest.coordinatorLogos) manifest.coordinatorLogos = {};
      manifest.coordinatorLogos[coordinatorId] = logoItem;
      manifest.lastUpdated = new Date().toISOString();

      await saveDriveManifest(manifest);

      res.json({
        success: true,
        logoItem,
        message: `Foto/logo do coordenador "${trimmedName}" salvo com sucesso!`,
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar coordinator-logo:', err?.message || err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Falha ao salvar logo do coordenador',
      });
    }
  });

  // 9. Excluir Logo / Foto do Coordenador
  app.delete('/api/drive/coordinator-logo/:coordinatorId', async (req, res) => {
    try {
      const { coordinatorId } = req.params;
      const manifest = await getDriveManifest();
      const existing = manifest.coordinatorLogos?.[coordinatorId];

      if (existing) {
        if (existing.driveFileId) {
          await deleteDriveFile(existing.driveFileId);
        }
        delete manifest.coordinatorLogos[coordinatorId];
        manifest.lastUpdated = new Date().toISOString();
        await saveDriveManifest(manifest);
      }

      res.json({ success: true, message: 'Foto/logo do coordenador excluído com sucesso!' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao remover logo do coordenador' });
    }
  });

  // 6. Resetar Logo do Sistema
  app.delete('/api/drive/system-logo', async (_req, res) => {
    try {
      const manifest = await getDriveManifest();
      if (manifest.systemConfig.driveFileId) {
        await deleteDriveFile(manifest.systemConfig.driveFileId);
      }
      manifest.systemConfig.logoUrl = '';
      manifest.systemConfig.driveFileId = '';
      manifest.systemConfig.updatedAt = new Date().toISOString();
      manifest.lastUpdated = new Date().toISOString();
      await saveDriveManifest(manifest);

      res.json({ success: true, systemConfig: manifest.systemConfig });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erro ao redefinir logo' });
    }
  });

  // 7. Proxy de Streaming para imagens do Google Drive
  app.get('/api/drive/file/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const { meta, stream } = await getDriveFileStream(fileId);

      res.setHeader('Content-Type', meta.mimeType || 'image/png');
      if (meta.size) {
        res.setHeader('Content-Length', meta.size);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

      stream.pipe(res);
    } catch (err: any) {
      console.warn(`Erro ao servir arquivo do Drive ${req.params.fileId}:`, err?.message);
      res.status(404).send('Arquivo não encontrado no Google Drive');
    }
  });

  // ==========================================
  // CONFIGURAÇÃO DO FRONTEND (VITE / ESTÁTICO)
  // ==========================================
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`Pasta Google Drive configurada: ${GOOGLE_DRIVE_FOLDER_ID}`);
    console.log(`Conta de Serviço: ${SERVICE_ACCOUNT_CREDENTIALS.client_email}`);
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar servidor:', err);
  process.exit(1);
});
