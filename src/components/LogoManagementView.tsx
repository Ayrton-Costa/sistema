import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
  Upload,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  Plus,
  Building2,
  ExternalLink,
  AlertTriangle,
  CloudCheck,
  Copy,
  Store,
  UserCheck,
  User,
  Sliders,
  MapPin,
  Check,
  X,
} from 'lucide-react';
import {
  driveApi,
  DriveStatusResponse,
  DriveStoreLogo,
  DriveCoordinatorLogo,
  DriveIndustryLogo,
} from '../lib/driveApi';
import { ItemValidade, ProdutoCatalogo } from '../types';

export interface LogoManagementViewProps {
  itens: ItemValidade[];
  produtosCatalogo: ProdutoCatalogo[];
  catalogoLojas?: Array<{ nome: string; estado?: string; coordenador?: string }>;
  catalogoCoordenadores?: string[];
  storeLogos?: Record<string, any>;
  coordinatorLogos?: Record<string, any>;
  onSystemLogoUpdated?: (branding: any) => void;
  onIndustryLogosUpdated?: (logos: Record<string, any>) => void;
  onStoreLogosUpdated?: (logos: Record<string, any>) => void;
  onCoordinatorLogosUpdated?: (logos: Record<string, any>) => void;
}

type TabType = 'industrias' | 'lojas' | 'coordenadores' | 'sistema';

export const LogoManagementView: React.FC<LogoManagementViewProps> = ({
  itens,
  produtosCatalogo,
  catalogoLojas = [],
  catalogoCoordenadores = [],
  storeLogos: initialStoreLogos = {},
  coordinatorLogos: initialCoordinatorLogos = {},
  onSystemLogoUpdated,
  onIndustryLogosUpdated,
  onStoreLogosUpdated,
  onCoordinatorLogosUpdated,
}) => {
  // Aba Ativa
  const [activeTab, setActiveTab] = useState<TabType>('industrias');

  // Estado da Conexão com Google Drive
  const [driveStatus, setDriveStatus] = useState<DriveStatusResponse | null>(null);
  const [isCheckingDrive, setIsCheckingDrive] = useState<boolean>(true);
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Estado do Logo do Sistema
  const [systemName, setSystemName] = useState<string>('Controle de Validade');
  const [systemLogoUrl, setSystemLogoUrl] = useState<string>('');
  const [systemLogoFile, setSystemLogoFile] = useState<File | null>(null);
  const [systemLogoPreview, setSystemLogoPreview] = useState<string>('');
  const [isSavingSystem, setIsSavingSystem] = useState<boolean>(false);
  const [systemSaveSuccess, setSystemSaveSuccess] = useState<boolean>(false);

  // Estado dos Logos das Indústrias
  const [industryLogos, setIndustryLogos] = useState<Record<string, DriveIndustryLogo>>({});
  const [newIndustryName, setNewIndustryName] = useState<string>('');
  const [savingIndustry, setSavingIndustry] = useState<string | null>(null);
  const [pendingIndustryFiles, setPendingIndustryFiles] = useState<Record<string, { file: File; preview: string }>>({});

  // Estado dos Logos das Lojas
  const [storeLogos, setStoreLogos] = useState<Record<string, DriveStoreLogo>>(initialStoreLogos);
  const [newStoreName, setNewStoreName] = useState<string>('');
  const [newStoreEstado, setNewStoreEstado] = useState<string>('');
  const [savingStore, setSavingStore] = useState<string | null>(null);
  const [pendingStoreFiles, setPendingStoreFiles] = useState<Record<string, { file: File; preview: string }>>({});

  // Estado dos Logos / Fotos dos Coordenadores
  const [coordinatorLogos, setCoordinatorLogos] = useState<Record<string, DriveCoordinatorLogo>>(initialCoordinatorLogos);
  const [newCoordinatorName, setNewCoordinatorName] = useState<string>('');
  const [savingCoordinator, setSavingCoordinator] = useState<string | null>(null);
  const [pendingCoordinatorFiles, setPendingCoordinatorFiles] = useState<Record<string, { file: File; preview: string }>>({});

  // Filtros Globais de Busca por Aba
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'todos' | 'com_logo' | 'sem_logo'>('todos');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Edição e criação automática de pasta do Drive
  const [isEditingFolder, setIsEditingFolder] = useState<boolean>(false);
  const [customFolderInput, setCustomFolderInput] = useState<string>('');
  const [isUpdatingFolder, setIsUpdatingFolder] = useState<boolean>(false);

  // Input file refs
  const systemFileInputRef = useRef<HTMLInputElement>(null);
  const industryFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const storeFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const coordinatorFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 1. Carrega dados ao montar
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsRefreshing(true);
    setIsCheckingDrive(true);

    try {
      // 1. Verifica status do Drive
      const status = await driveApi.getStatus();
      setDriveStatus(status);

      // 2. Carrega manifesto de logos gravado no Drive
      const manifestRes = await driveApi.getManifest();
      if (manifestRes.success && manifestRes.manifest) {
        const { systemConfig, industryLogos: savedLogos, storeLogos: savedStores, coordinatorLogos: savedCoordinators } = manifestRes.manifest;
        if (systemConfig) {
          if (systemConfig.systemName) setSystemName(systemConfig.systemName);
          if (systemConfig.logoUrl) {
            setSystemLogoUrl(systemConfig.logoUrl);
            setSystemLogoPreview(systemConfig.logoUrl);
          }
          onSystemLogoUpdated?.(systemConfig);
        }

        if (savedLogos) {
          setIndustryLogos(savedLogos);
          onIndustryLogosUpdated?.(savedLogos);
        }

        if (savedStores) {
          setStoreLogos(savedStores);
          onStoreLogosUpdated?.(savedStores);
        }

        if (savedCoordinators) {
          setCoordinatorLogos(savedCoordinators);
          onCoordinatorLogosUpdated?.(savedCoordinators);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do Google Drive:', err);
    } finally {
      setIsRefreshing(false);
      setIsCheckingDrive(false);
    }
  };

  // 2. Lista unificada de Indústrias
  const allIndustries = React.useMemo(() => {
    const set = new Set<string>();

    itens.forEach((it) => {
      if (it.industria?.trim()) set.add(it.industria.trim());
    });

    produtosCatalogo.forEach((p) => {
      if (p.industria?.trim()) set.add(p.industria.trim());
    });

    Object.values(industryLogos).forEach((l: any) => {
      if (l.industryName?.trim()) set.add(l.industryName.trim());
    });

    if (set.size === 0) {
      ['Nestlé', 'Unilever', 'Ambev', 'M. Dias Branco', 'BRF', 'Bauducco', 'Coca-Cola', 'Danone'].forEach((ex) =>
        set.add(ex)
      );
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itens, produtosCatalogo, industryLogos]);

  // 3. Lista unificada de Lojas
  const allStores = React.useMemo(() => {
    const map = new Map<string, { nome: string; estado?: string; coordenador?: string }>();

    // Dos itens registrados
    itens.forEach((it) => {
      if (it.loja?.trim()) {
        const nome = it.loja.trim();
        if (!map.has(nome)) {
          map.set(nome, { nome, estado: it.estado, coordenador: it.coordenador });
        }
      }
    });

    // Do catálogo relacional
    catalogoLojas.forEach((l) => {
      if (l.nome?.trim()) {
        const nome = l.nome.trim();
        const existing = map.get(nome);
        map.set(nome, {
          nome,
          estado: l.estado || existing?.estado,
          coordenador: l.coordenador || existing?.coordenador,
        });
      }
    });

    // Dos logos de lojas já salvos
    Object.values(storeLogos).forEach((sl: any) => {
      if (sl.storeName?.trim() && !map.has(sl.storeName.trim())) {
        map.set(sl.storeName.trim(), { nome: sl.storeName.trim() });
      }
    });

    if (map.size === 0) {
      ['Loja Matriz', 'Loja Centro', 'Loja Zona Sul', 'Hipermercado 01', 'Supermercado Modelo'].forEach((ex) => {
        map.set(ex, { nome: ex });
      });
    }

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [itens, catalogoLojas, storeLogos]);

  // 4. Lista unificada de Coordenadores
  const allCoordinators = React.useMemo(() => {
    const set = new Set<string>();

    itens.forEach((it) => {
      if (it.coordenador?.trim()) set.add(it.coordenador.trim());
    });

    catalogoCoordenadores.forEach((c) => {
      if (c?.trim()) set.add(c.trim());
    });

    catalogoLojas.forEach((l) => {
      if (l.coordenador?.trim()) set.add(l.coordenador.trim());
    });

    Object.values(coordinatorLogos).forEach((cl: any) => {
      if (cl.coordinatorName?.trim()) set.add(cl.coordinatorName.trim());
    });

    if (set.size === 0) {
      ['Carlos Silva', 'Mariana Santos', 'Roberto Souza', 'Fernanda Lima'].forEach((ex) => set.add(ex));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itens, catalogoCoordenadores, catalogoLojas, coordinatorLogos]);

  // Filtros aplicados
  const filteredIndustries = React.useMemo(() => {
    return allIndustries.filter((ind) => {
      const matchSearch = ind.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      const slug = ind.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const hasLogo = Boolean(
        industryLogos[slug]?.logoUrl ||
        industryLogos[ind.toLowerCase()]?.logoUrl ||
        pendingIndustryFiles[ind]?.preview
      );

      if (filterType === 'com_logo') return hasLogo;
      if (filterType === 'sem_logo') return !hasLogo;
      return true;
    });
  }, [allIndustries, searchTerm, filterType, industryLogos, pendingIndustryFiles]);

  const filteredStores = React.useMemo(() => {
    return allStores.filter((st) => {
      const matchSearch =
        st.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (st.estado && st.estado.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      const slug = st.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const hasLogo = Boolean(
        storeLogos[slug]?.logoUrl ||
        storeLogos[st.nome.toLowerCase()]?.logoUrl ||
        pendingStoreFiles[st.nome]?.preview
      );

      if (filterType === 'com_logo') return hasLogo;
      if (filterType === 'sem_logo') return !hasLogo;
      return true;
    });
  }, [allStores, searchTerm, filterType, storeLogos, pendingStoreFiles]);

  const filteredCoordinators = React.useMemo(() => {
    return allCoordinators.filter((coord) => {
      const matchSearch = coord.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      const slug = coord.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const hasLogo = Boolean(
        coordinatorLogos[slug]?.logoUrl ||
        coordinatorLogos[coord.toLowerCase()]?.logoUrl ||
        pendingCoordinatorFiles[coord]?.preview
      );

      if (filterType === 'com_logo') return hasLogo;
      if (filterType === 'sem_logo') return !hasLogo;
      return true;
    });
  }, [allCoordinators, searchTerm, filterType, coordinatorLogos, pendingCoordinatorFiles]);

  // Contadores de itens com logo
  const statsCounts = React.useMemo(() => {
    const indTotal = allIndustries.length;
    const indWithLogo = allIndustries.filter((ind) => {
      const slug = ind.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return Boolean(industryLogos[slug]?.logoUrl || industryLogos[ind.toLowerCase()]?.logoUrl);
    }).length;

    const storeTotal = allStores.length;
    const storeWithLogo = allStores.filter((st) => {
      const slug = st.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return Boolean(storeLogos[slug]?.logoUrl || storeLogos[st.nome.toLowerCase()]?.logoUrl);
    }).length;

    const coordTotal = allCoordinators.length;
    const coordWithLogo = allCoordinators.filter((coord) => {
      const slug = coord.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return Boolean(coordinatorLogos[slug]?.logoUrl || coordinatorLogos[coord.toLowerCase()]?.logoUrl);
    }).length;

    return {
      indTotal,
      indWithLogo,
      storeTotal,
      storeWithLogo,
      coordTotal,
      coordWithLogo,
    };
  }, [allIndustries, allStores, allCoordinators, industryLogos, storeLogos, coordinatorLogos]);

  // Converte arquivo para Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // ==========================================
  // LOGO DO SISTEMA
  // ==========================================
  const handleSystemFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP, SVG).');
      return;
    }

    setSystemLogoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setSystemLogoPreview(objectUrl);
  };

  const handleSaveSystemBranding = async () => {
    setIsSavingSystem(true);
    setSystemSaveSuccess(false);

    try {
      let base64Data: string | undefined = undefined;
      let mimeType: string | undefined = undefined;

      if (systemLogoFile) {
        base64Data = await fileToBase64(systemLogoFile);
        mimeType = systemLogoFile.type;
      }

      const res = await driveApi.saveSystemConfig(systemName.trim(), base64Data, mimeType);
      if (res.systemConfig) {
        setSystemLogoUrl(res.systemConfig.logoUrl || '');
        setSystemLogoPreview(res.systemConfig.logoUrl || '');
        setSystemLogoFile(null);
        onSystemLogoUpdated?.(res.systemConfig);
      }

      setSystemSaveSuccess(true);
      setTimeout(() => setSystemSaveSuccess(false), 4000);
    } catch (err: any) {
      console.warn('Aviso ao salvar logo do sistema:', err);
      alert(err?.message || 'Erro ao salvar logotipo.');
    } finally {
      setIsSavingSystem(false);
    }
  };

  const handleRemoveSystemLogo = async () => {
    if (!window.confirm('Tem certeza que deseja remover o logotipo personalizado do sistema?')) {
      return;
    }

    setIsSavingSystem(true);
    try {
      const res = await driveApi.resetSystemLogo();
      setSystemLogoUrl('');
      setSystemLogoPreview('');
      setSystemLogoFile(null);
      if (res.systemConfig) {
        onSystemLogoUpdated?.(res.systemConfig);
      }
    } catch (err: any) {
      console.warn('Erro ao remover logo do sistema:', err);
      alert(err?.message || 'Erro ao redefinir logotipo');
    } finally {
      setIsSavingSystem(false);
    }
  };

  // ==========================================
  // LOGO DE INDÚSTRIA
  // ==========================================
  const handleIndustryFileChange = (industryName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP, SVG).');
      return;
    }

    const preview = URL.createObjectURL(file);
    setPendingIndustryFiles((prev) => ({
      ...prev,
      [industryName]: { file, preview },
    }));
  };

  const handleSaveIndustryLogo = async (industryName: string) => {
    const pending = pendingIndustryFiles[industryName];
    if (!pending) return;

    setSavingIndustry(industryName);

    try {
      const base64Data = await fileToBase64(pending.file);
      const res = await driveApi.saveIndustryLogo(industryName, base64Data, pending.file.type);

      if (res.logoItem) {
        const updated = {
          ...industryLogos,
          [res.logoItem.industryId]: res.logoItem,
        };
        setIndustryLogos(updated);
        onIndustryLogosUpdated?.(updated);
      }

      setPendingIndustryFiles((prev) => {
        const copy = { ...prev };
        delete copy[industryName];
        return copy;
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar logo de indústria:', err);
      alert(err?.message || 'Erro ao salvar logotipo.');
    } finally {
      setSavingIndustry(null);
    }
  };

  const handleRemoveIndustryLogo = async (industryName: string) => {
    const slug = industryName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!window.confirm(`Deseja realmente remover o logotipo de "${industryName}" do Google Drive?`)) {
      return;
    }

    try {
      await driveApi.deleteIndustryLogo(slug);
      setIndustryLogos((prev) => {
        const copy = { ...prev };
        delete copy[slug];
        delete copy[industryName.toLowerCase()];
        onIndustryLogosUpdated?.(copy);
        return copy;
      });
      setPendingIndustryFiles((prev) => {
        const copy = { ...prev };
        delete copy[industryName];
        return copy;
      });
    } catch (err: any) {
      console.warn('Erro ao remover logo de indústria:', err);
      alert(err?.message || 'Erro ao remover logotipo da indústria.');
    }
  };

  // ==========================================
  // LOGO DE LOJA
  // ==========================================
  const handleStoreFileChange = (storeName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP, SVG).');
      return;
    }

    const preview = URL.createObjectURL(file);
    setPendingStoreFiles((prev) => ({
      ...prev,
      [storeName]: { file, preview },
    }));
  };

  const handleSaveStoreLogo = async (storeName: string) => {
    const pending = pendingStoreFiles[storeName];
    if (!pending) return;

    setSavingStore(storeName);

    try {
      const base64Data = await fileToBase64(pending.file);
      const res = await driveApi.saveStoreLogo(storeName, base64Data, pending.file.type);

      if (res.logoItem) {
        const updated = {
          ...storeLogos,
          [res.logoItem.storeId]: res.logoItem,
        };
        setStoreLogos(updated);
        onStoreLogosUpdated?.(updated);
      }

      setPendingStoreFiles((prev) => {
        const copy = { ...prev };
        delete copy[storeName];
        return copy;
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar logo da loja:', err);
      alert(err?.message || 'Erro ao salvar logotipo da loja.');
    } finally {
      setSavingStore(null);
    }
  };

  const handleRemoveStoreLogo = async (storeName: string) => {
    const slug = storeName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!window.confirm(`Deseja realmente remover o logotipo da loja "${storeName}"?`)) {
      return;
    }

    try {
      await driveApi.deleteStoreLogo(slug);
      setStoreLogos((prev) => {
        const copy = { ...prev };
        delete copy[slug];
        delete copy[storeName.toLowerCase()];
        onStoreLogosUpdated?.(copy);
        return copy;
      });
      setPendingStoreFiles((prev) => {
        const copy = { ...prev };
        delete copy[storeName];
        return copy;
      });
    } catch (err: any) {
      console.warn('Erro ao remover logo da loja:', err);
      alert(err?.message || 'Erro ao remover logotipo da loja.');
    }
  };

  // ==========================================
  // LOGO / FOTO DO COORDENADOR
  // ==========================================
  const handleCoordinatorFileChange = (coordinatorName: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP, SVG).');
      return;
    }

    const preview = URL.createObjectURL(file);
    setPendingCoordinatorFiles((prev) => ({
      ...prev,
      [coordinatorName]: { file, preview },
    }));
  };

  const handleSaveCoordinatorLogo = async (coordinatorName: string) => {
    const pending = pendingCoordinatorFiles[coordinatorName];
    if (!pending) return;

    setSavingCoordinator(coordinatorName);

    try {
      const base64Data = await fileToBase64(pending.file);
      const res = await driveApi.saveCoordinatorLogo(coordinatorName, base64Data, pending.file.type);

      if (res.logoItem) {
        const updated = {
          ...coordinatorLogos,
          [res.logoItem.coordinatorId]: res.logoItem,
        };
        setCoordinatorLogos(updated);
        onCoordinatorLogosUpdated?.(updated);
      }

      setPendingCoordinatorFiles((prev) => {
        const copy = { ...prev };
        delete copy[coordinatorName];
        return copy;
      });
    } catch (err: any) {
      console.warn('Aviso ao salvar logo do coordenador:', err);
      alert(err?.message || 'Erro ao salvar foto/logo do coordenador.');
    } finally {
      setSavingCoordinator(null);
    }
  };

  const handleRemoveCoordinatorLogo = async (coordinatorName: string) => {
    const slug = coordinatorName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!window.confirm(`Deseja realmente remover a foto/logo do coordenador "${coordinatorName}"?`)) {
      return;
    }

    try {
      await driveApi.deleteCoordinatorLogo(slug);
      setCoordinatorLogos((prev) => {
        const copy = { ...prev };
        delete copy[slug];
        delete copy[coordinatorName.toLowerCase()];
        onCoordinatorLogosUpdated?.(copy);
        return copy;
      });
      setPendingCoordinatorFiles((prev) => {
        const copy = { ...prev };
        delete copy[coordinatorName];
        return copy;
      });
    } catch (err: any) {
      console.warn('Erro ao remover logo do coordenador:', err);
      alert(err?.message || 'Erro ao remover foto do coordenador.');
    }
  };

  // ==========================================
  // GERENCIAR PASTA DO DRIVE
  // ==========================================
  const handleUpdateFolder = async () => {
    if (!customFolderInput.trim()) return;
    setIsUpdatingFolder(true);
    try {
      const res = await driveApi.updateFolderId(customFolderInput.trim());
      if (res.success) {
        setIsEditingFolder(false);
        await loadAllData();
      }
    } catch (err: any) {
      alert(err?.message || 'Erro ao atualizar ID da pasta');
    } finally {
      setIsUpdatingFolder(false);
    }
  };

  const copyServiceEmail = () => {
    const email = driveStatus?.serviceAccount || 'intelig-ncia-transcr-o@lofty-root-387111.iam.gserviceaccount.com';
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const folderUrl = `https://drive.google.com/drive/folders/${driveStatus?.folderId || '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK-'}?hl=pt-br`;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cabeçalho Principal e Banner Informativo */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                <Image className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">
                Galeria de Imagens e Logotipos
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CloudCheck className="w-3.5 h-3.5" />
                Google Drive & Armazenamento Seguro
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Gerencie e salve os logotipos das indústrias, fachadas das lojas, fotos dos coordenadores e identidade do sistema.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all duration-200"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              Abrir Pasta no Drive
            </a>

            <button
              onClick={loadAllData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all duration-200 disabled:opacity-50"
              title="Recarregar dados do Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-purple-600' : 'text-slate-500'}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Abas Superiores de Navegação */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => { setActiveTab('industrias'); setSearchTerm(''); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'industrias'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Indústrias</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'industrias' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {statsCounts.indWithLogo}/{statsCounts.indTotal}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('lojas'); setSearchTerm(''); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'lojas'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Lojas & Redes</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'lojas' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {statsCounts.storeWithLogo}/{statsCounts.storeTotal}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('coordenadores'); setSearchTerm(''); }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'coordenadores'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Coordenadores</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'coordenadores' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {statsCounts.coordWithLogo}/{statsCounts.coordTotal}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sistema')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'sistema'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Identidade do Sistema & Drive</span>
          </button>
        </div>

        {/* Barra de Busca e Filtro (quando estiver nas abas de itens) */}
        {activeTab !== 'sistema' && (
          <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Buscar ${
                  activeTab === 'industrias' ? 'indústria ou fabricante' : activeTab === 'lojas' ? 'loja ou estado' : 'coordenador'
                }...`}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <button
                onClick={() => setFilterType('todos')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterType === 'todos'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('com_logo')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterType === 'com_logo'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Com Logo
              </button>
              <button
                onClick={() => setFilterType('sem_logo')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  filterType === 'sem_logo'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Sem Logo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ABA 1: INDÚSTRIAS                                        */}
      {/* ======================================================== */}
      {activeTab === 'industrias' && (
        <div className="space-y-4">
          {/* Adicionar nova indústria rapidamente */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
            <Building2 className="w-5 h-5 text-purple-600 shrink-0" />
            <input
              type="text"
              value={newIndustryName}
              onChange={(e) => setNewIndustryName(e.target.value)}
              placeholder="Cadastrar nova indústria na galeria..."
              className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
            />
            <button
              onClick={() => {
                if (newIndustryName.trim()) {
                  setNewIndustryName('');
                }
              }}
              disabled={!newIndustryName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition disabled:opacity-50 shrink-0 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Adicionar Indústria
            </button>
          </div>

          {/* Grid de Indústrias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredIndustries.map((ind) => {
              const slug = ind.toLowerCase().replace(/[^a-z0-9]/g, '_');
              const savedLogo = industryLogos[slug]?.logoUrl || industryLogos[ind.toLowerCase()]?.logoUrl;
              const pending = pendingIndustryFiles[ind];
              const displayUrl = pending?.preview || savedLogo;
              const isSaving = savingIndustry === ind;

              return (
                <div
                  key={ind}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-sm font-bold text-slate-900 truncate" title={ind}>
                        {ind}
                      </span>
                      {savedLogo ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          No Drive
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 shrink-0">
                          Sem Logo
                        </span>
                      )}
                    </div>

                    {/* Área de Preview da Imagem */}
                    <div
                      onClick={() => industryFileInputRefs.current[ind]?.click()}
                      className="w-full h-32 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-purple-400 transition cursor-pointer flex flex-col items-center justify-center p-3 relative overflow-hidden group"
                    >
                      {displayUrl ? (
                        <img
                          src={displayUrl}
                          alt={ind}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-purple-600 transition">
                          <Building2 className="w-8 h-8 mb-1 opacity-60" />
                          <span className="text-xs font-medium">Clique para enviar logo</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                        <Upload className="w-4 h-4" />
                        Trocar Imagem
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={(el) => (industryFileInputRefs.current[ind] = el)}
                      onChange={(e) => handleIndustryFileChange(ind, e)}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Ações */}
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                    {pending ? (
                      <button
                        onClick={() => handleSaveIndustryLogo(ind)}
                        disabled={isSaving}
                        className="flex-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Salvar Logo
                      </button>
                    ) : (
                      <button
                        onClick={() => industryFileInputRefs.current[ind]?.click()}
                        className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {savedLogo ? 'Alterar' : 'Enviar'}
                      </button>
                    )}

                    {savedLogo && (
                      <button
                        onClick={() => handleRemoveIndustryLogo(ind)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remover logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: LOJAS & REDES                                     */}
      {/* ======================================================== */}
      {activeTab === 'lojas' && (
        <div className="space-y-4">
          {/* Adicionar nova Loja */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
            <Store className="w-5 h-5 text-blue-600 shrink-0" />
            <input
              type="text"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="Nome da loja ou supermercado..."
              className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
            <input
              type="text"
              value={newStoreEstado}
              onChange={(e) => setNewStoreEstado(e.target.value)}
              placeholder="UF (ex: SP, RJ)..."
              maxLength={2}
              className="w-full sm:w-24 px-3.5 py-2 text-sm uppercase rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
            <button
              onClick={() => {
                if (newStoreName.trim()) {
                  const nome = newStoreName.trim();
                  setNewStoreName('');
                  setNewStoreEstado('');
                }
              }}
              disabled={!newStoreName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50 shrink-0 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Adicionar Loja
            </button>
          </div>

          {/* Grid de Lojas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredStores.map((st) => {
              const slug = st.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
              const savedLogo = storeLogos[slug]?.logoUrl || storeLogos[st.nome.toLowerCase()]?.logoUrl;
              const pending = pendingStoreFiles[st.nome];
              const displayUrl = pending?.preview || savedLogo;
              const isSaving = savingStore === st.nome;

              return (
                <div
                  key={st.nome}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-bold text-slate-900 truncate" title={st.nome}>
                        {st.nome}
                      </span>
                      {st.estado && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {st.estado}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                      <span>{st.coordenador ? `Coord: ${st.coordenador}` : 'Rede de Lojas'}</span>
                      {savedLogo ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          No Drive
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 shrink-0">
                          Sem Fachada
                        </span>
                      )}
                    </div>

                    {/* Área de Preview da Fachada / Logo da Loja */}
                    <div
                      onClick={() => storeFileInputRefs.current[st.nome]?.click()}
                      className="w-full h-32 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-400 transition cursor-pointer flex flex-col items-center justify-center p-3 relative overflow-hidden group"
                    >
                      {displayUrl ? (
                        <img
                          src={displayUrl}
                          alt={st.nome}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 transition">
                          <Store className="w-8 h-8 mb-1 opacity-60" />
                          <span className="text-xs font-medium">Logotipo / Fachada da Loja</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                        <Upload className="w-4 h-4" />
                        Trocar Fachada
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={(el) => (storeFileInputRefs.current[st.nome] = el)}
                      onChange={(e) => handleStoreFileChange(st.nome, e)}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Ações */}
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                    {pending ? (
                      <button
                        onClick={() => handleSaveStoreLogo(st.nome)}
                        disabled={isSaving}
                        className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Salvar no Drive
                      </button>
                    ) : (
                      <button
                        onClick={() => storeFileInputRefs.current[st.nome]?.click()}
                        className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {savedLogo ? 'Alterar' : 'Enviar Logo'}
                      </button>
                    )}

                    {savedLogo && (
                      <button
                        onClick={() => handleRemoveStoreLogo(st.nome)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remover logotipo da loja"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: COORDENADORES                                     */}
      {/* ======================================================== */}
      {activeTab === 'coordenadores' && (
        <div className="space-y-4">
          {/* Adicionar novo Coordenador */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
            <UserCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <input
              type="text"
              value={newCoordinatorName}
              onChange={(e) => setNewCoordinatorName(e.target.value)}
              placeholder="Nome do novo coordenador ou supervisor..."
              className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
            <button
              onClick={() => {
                if (newCoordinatorName.trim()) {
                  setNewCoordinatorName('');
                }
              }}
              disabled={!newCoordinatorName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 shrink-0 w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              Adicionar Coordenador
            </button>
          </div>

          {/* Grid de Coordenadores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCoordinators.map((coord) => {
              const slug = coord.toLowerCase().replace(/[^a-z0-9]/g, '_');
              const savedLogo = coordinatorLogos[slug]?.logoUrl || coordinatorLogos[coord.toLowerCase()]?.logoUrl;
              const pending = pendingCoordinatorFiles[coord];
              const displayUrl = pending?.preview || savedLogo;
              const isSaving = savingCoordinator === coord;

              return (
                <div
                  key={coord}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-xs transition flex flex-col items-center text-center justify-between"
                >
                  <div className="flex flex-col items-center w-full">
                    {/* Foto / Avatar Redondo */}
                    <div
                      onClick={() => coordinatorFileInputRefs.current[coord]?.click()}
                      className="w-24 h-24 rounded-full bg-slate-50 border-2 border-dashed border-indigo-200 hover:border-indigo-500 transition cursor-pointer flex items-center justify-center relative overflow-hidden group shadow-xs mb-3"
                    >
                      {displayUrl ? (
                        <img
                          src={displayUrl}
                          alt={coord}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-indigo-400 group-hover:text-indigo-600 transition">
                          <User className="w-10 h-10 opacity-60" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-semibold gap-1 rounded-full">
                        <Upload className="w-3.5 h-3.5" />
                        Alterar
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={(el) => (coordinatorFileInputRefs.current[coord] = el)}
                      onChange={(e) => handleCoordinatorFileChange(coord, e)}
                      accept="image/*"
                      className="hidden"
                    />

                    <span className="text-sm font-bold text-slate-900 truncate w-full mb-1" title={coord}>
                      {coord}
                    </span>

                    <span className="text-xs text-slate-500 mb-2">Coordenação Regional</span>

                    {savedLogo ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Foto Salva no Drive
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                        Sem Foto Cadastrada
                      </span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="mt-4 flex items-center gap-2 pt-2 border-t border-slate-100 w-full">
                    {pending ? (
                      <button
                        onClick={() => handleSaveCoordinatorLogo(coord)}
                        disabled={isSaving}
                        className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5"
                      >
                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Salvar Foto
                      </button>
                    ) : (
                      <button
                        onClick={() => coordinatorFileInputRefs.current[coord]?.click()}
                        className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition flex items-center justify-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {savedLogo ? 'Alterar' : 'Enviar Foto'}
                      </button>
                    )}

                    {savedLogo && (
                      <button
                        onClick={() => handleRemoveCoordinatorLogo(coord)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Remover foto do coordenador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: IDENTIDADE DO SISTEMA & GOOGLE DRIVE              */}
      {/* ======================================================== */}
      {activeTab === 'sistema' && (
        <div className="space-y-6">
          {/* Card de Configuração da Pasta do Google Drive */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <CloudCheck className="w-5 h-5 text-emerald-600" />
              Configurações da Conexão com Google Drive
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Pasta do Google Drive
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800 truncate" title={driveStatus?.folderName || driveStatus?.folderId}>
                    {driveStatus?.folderName || 'controle de vencimento uploand'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFolderInput(driveStatus?.folderId || '');
                      setIsEditingFolder(!isEditingFolder);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer ml-2 shrink-0"
                  >
                    {isEditingFolder ? 'Cancelar' : 'Alterar'}
                  </button>
                </div>
                <div className="mt-1">
                  <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono truncate block">
                    {driveStatus?.folderId || '1hrak0iXGphf2xGAUJkCaTDT0-c0HrrK-'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Conta de Serviço Autorizada
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-700 font-mono truncate" title={driveStatus?.serviceAccount || 'intelig-ncia-transcr-o@lofty-root-387111.iam.gserviceaccount.com'}>
                    {driveStatus?.serviceAccount || 'intelig-ncia-transcr-o@...'}
                  </span>
                  <button
                    onClick={copyServiceEmail}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-700 transition-colors shrink-0"
                    title="Copiar e-mail da conta de serviço"
                  >
                    {copiedEmail ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Status de Conectividade
                </span>
                {isCheckingDrive ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando pasta...</span>
                  </div>
                ) : driveStatus?.connected ? (
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Ativo & Conectado</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Aguardando acesso</span>
                  </div>
                )}
              </div>
            </div>

            {/* Painel expansível para alterar pasta */}
            {isEditingFolder && (
              <div className="mt-4 p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs space-y-3">
                <div className="font-semibold text-blue-900">Alterar ID da Pasta de Destino:</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customFolderInput}
                    onChange={(e) => setCustomFolderInput(e.target.value)}
                    placeholder="Cole o ID da pasta ou o link do Google Drive"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleUpdateFolder}
                    disabled={isUpdatingFolder || !customFolderInput.trim()}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isUpdatingFolder ? 'Salvando...' : 'Salvar Pasta'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Configuração do Logotipo do Sistema (Cabeçalho) */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" />
              Identidade Visual do Cabeçalho
            </h2>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Preview do Logotipo */}
              <div
                onClick={() => systemFileInputRef.current?.click()}
                className="w-36 h-36 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-purple-500 transition cursor-pointer flex items-center justify-center p-3 relative overflow-hidden group shrink-0"
              >
                {systemLogoPreview ? (
                  <img
                    src={systemLogoPreview}
                    alt="Logo do Sistema"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-purple-600 transition text-center">
                    <Image className="w-8 h-8 mb-1 opacity-60" />
                    <span className="text-[11px] font-medium">Logotipo Principal</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                  <Upload className="w-4 h-4" />
                  Alterar
                </div>
              </div>

              <input
                type="file"
                ref={systemFileInputRef}
                onChange={handleSystemFileChange}
                accept="image/*"
                className="hidden"
              />

              {/* Formulário de Nome e Botões */}
              <div className="flex-1 space-y-3 w-full">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                    Nome da Aplicação
                  </label>
                  <input
                    type="text"
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    placeholder="Controle de Validade"
                    className="w-full sm:w-80 px-3.5 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveSystemBranding}
                    disabled={isSavingSystem}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition disabled:opacity-50"
                  >
                    {isSavingSystem ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Salvar Identidade
                  </button>

                  {systemLogoUrl && (
                    <button
                      onClick={handleRemoveSystemLogo}
                      disabled={isSavingSystem}
                      className="px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    >
                      Remover Logo
                    </button>
                  )}

                  {systemSaveSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Salvo com sucesso!
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
