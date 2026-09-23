export interface DriveStatusResponse {
  connected: boolean;
  folderId?: string;
  folderName?: string;
  serviceAccount?: string;
  error?: string;
  storageNote?: string;
}

export interface DriveSystemConfig {
  systemName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface DriveIndustryLogo {
  industryId: string;
  industryName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface DriveStoreLogo {
  storeId: string;
  storeName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface DriveCoordinatorLogo {
  coordinatorId: string;
  coordinatorName: string;
  logoUrl?: string;
  driveFileId?: string;
  updatedAt: string;
}

export interface DriveManifestResponse {
  success: boolean;
  manifest: {
    systemConfig: DriveSystemConfig;
    industryLogos: Record<string, DriveIndustryLogo>;
    storeLogos: Record<string, DriveStoreLogo>;
    coordinatorLogos: Record<string, DriveCoordinatorLogo>;
    version: number;
    lastUpdated: string;
  };
  error?: string;
}

export const driveApi = {
  async getStatus(): Promise<DriveStatusResponse> {
    try {
      const res = await fetch('/api/drive/status');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          connected: false,
          error: errorData.error || `Erro HTTP ${res.status}`,
        };
      }
      return await res.json();
    } catch (err: any) {
      return {
        connected: false,
        error: err?.message || 'Não foi possível conectar ao servidor de Drive',
      };
    }
  },

  async getManifest(): Promise<DriveManifestResponse> {
    try {
      const res = await fetch('/api/drive/manifest');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      return {
        success: true,
        manifest: {
          systemConfig: data.manifest?.systemConfig || { systemName: 'Controle de Validade', logoUrl: '', updatedAt: '' },
          industryLogos: data.manifest?.industryLogos || {},
          storeLogos: data.manifest?.storeLogos || {},
          coordinatorLogos: data.manifest?.coordinatorLogos || {},
          version: data.manifest?.version || 1,
          lastUpdated: data.manifest?.lastUpdated || '',
        },
      };
    } catch (err: any) {
      console.warn('Aviso ao buscar dados do Google Drive:', err);
      return {
        success: false,
        manifest: {
          systemConfig: { systemName: 'Controle de Validade', logoUrl: '', updatedAt: '' },
          industryLogos: {},
          storeLogos: {},
          coordinatorLogos: {},
          version: 1,
          lastUpdated: '',
        },
        error: err?.message,
      };
    }
  },

  async saveSystemConfig(systemName?: string, imageBase64?: string, mimeType?: string) {
    const res = await fetch('/api/drive/system-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemName, imageBase64, mimeType }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao salvar identidade');
    }
    return data;
  },

  async saveIndustryLogo(industryName: string, imageBase64: string, mimeType?: string) {
    const res = await fetch('/api/drive/industry-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industryName, imageBase64, mimeType }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao salvar logo da indústria');
    }
    return data;
  },

  async deleteIndustryLogo(industryId: string) {
    const res = await fetch(`/api/drive/industry-logo/${encodeURIComponent(industryId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao excluir logo da indústria');
    }
    return data;
  },

  async saveStoreLogo(storeName: string, imageBase64: string, mimeType?: string) {
    const res = await fetch('/api/drive/store-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName, imageBase64, mimeType }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao salvar logotipo da loja');
    }
    return data;
  },

  async deleteStoreLogo(storeId: string) {
    const res = await fetch(`/api/drive/store-logo/${encodeURIComponent(storeId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao excluir logotipo da loja');
    }
    return data;
  },

  async saveCoordinatorLogo(coordinatorName: string, imageBase64: string, mimeType?: string) {
    const res = await fetch('/api/drive/coordinator-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinatorName, imageBase64, mimeType }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao salvar foto/logo do coordenador');
    }
    return data;
  },

  async deleteCoordinatorLogo(coordinatorId: string) {
    const res = await fetch(`/api/drive/coordinator-logo/${encodeURIComponent(coordinatorId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao excluir foto/logo do coordenador');
    }
    return data;
  },

  async resetSystemLogo() {
    const res = await fetch('/api/drive/system-logo', {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao redefinir logotipo do sistema');
    }
    return data;
  },

  async updateFolderId(folderId: string) {
    const res = await fetch('/api/drive/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao atualizar pasta do Google Drive');
    }
    return data;
  },

  async createAutoFolder() {
    const res = await fetch('/api/drive/create-folder', {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Erro ao criar pasta automática no Drive');
    }
    return data;
  },
};
