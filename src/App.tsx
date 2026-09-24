import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { QuickAddForm } from './components/QuickAddForm';
import { ProductList } from './components/ProductList';
import { HierarchyView } from './components/HierarchyView';
import { BaseProductsView } from './components/BaseProductsView';
import { ProductRegistrationView } from './components/ProductRegistrationView';
import { LogoManagementView } from './components/LogoManagementView';
import { SupabaseModal } from './components/SupabaseModal';
import { ImportExcelModal } from './components/ImportExcelModal';
import { ItemValidade, FiltroStatus, SupabaseConfig, ModoVisualizacao, ProdutoCatalogo } from './types';
import { driveApi, DriveSystemConfig, DriveIndustryLogo, DriveStoreLogo, DriveCoordinatorLogo } from './lib/driveApi';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  fetchAllItems,
  fetchCatalogoRelacional,
  insertItemData,
  insertBatchItemsData,
  updateItemData,
  deleteItemData,
  clearLocalItems,
  insertProdutoCatalogo,
  insertBatchProdutosCatalogo,
  deleteProdutoCatalogo,
  syncAllPendingProdutosToSupabase,
} from './lib/supabase';
import { exportarParaExcel } from './lib/excel';
import { AlertCircle, CheckCircle2, Info, X, Table, Network, Database, Sparkles, PackagePlus, FolderOpen, CloudCheck } from 'lucide-react';

export default function App() {
  const [items, setItems] = useState<ItemValidade[]>([]);
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('hierarquia');
  const [catalogoSupabase, setCatalogoSupabase] = useState<{
    industrias: string[];
    produtosPorIndustria: Record<string, string[]>;
    produtosDetalhados?: ProdutoCatalogo[];
    coordenadores: string[];
    lojas: Array<{ nome: string; estado?: string; coordenador?: string }>;
  }>({ industrias: [], produtosPorIndustria: {}, produtosDetalhados: [], coordenadores: [], lojas: [] });
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prefilledProduct, setPrefilledProduct] = useState<{
    produto: string;
    industria: string;
    codigo?: string;
    unidade?: string;
  } | null>(null);

  // Estados de Imagens e Logos do Google Drive
  const [systemBranding, setSystemBranding] = useState<DriveSystemConfig | null>(null);
  const [industryLogos, setIndustryLogos] = useState<Record<string, DriveIndustryLogo>>({});
  const [storeLogos, setStoreLogos] = useState<Record<string, DriveStoreLogo>>({});
  const [coordinatorLogos, setCoordinatorLogos] = useState<Record<string, DriveCoordinatorLogo>>({});

  // Mensagens de notificação rápida
  const [banner, setBanner] = useState<{
    tipo: 'sucesso' | 'erro' | 'aviso';
    mensagem: string;
  } | null>(null);

  const exibirNotificacao = useCallback(
    (tipo: 'sucesso' | 'erro' | 'aviso', mensagem: string) => {
      setBanner({ tipo, mensagem });
      setTimeout(() => setBanner(null), 4000);
    },
    []
  );

  // Carregar dados
  const carregarDados = useCallback(async (config: SupabaseConfig, silencioso = false) => {
    if (!silencioso) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // 1. Busca todos os itens cadastrados no Supabase
      const res = await fetchAllItems(config);
      setItems(res.items);

      // 2. Busca catálogo relacional de indústrias e produtos vinculados do Supabase
      const catalogo = await fetchCatalogoRelacional(config);
      setCatalogoSupabase(catalogo);

      if (res.error && config.isConnected) {
        exibirNotificacao(
          'erro',
          `Erro ao consultar Supabase: ${res.error}. Verifique se a tabela "${config.tableName || 'validades'}" tem a política RLS ativa.`
        );
      } else if (config.isConnected && res.fromSupabase && !silencioso) {
        const prodCount = catalogo.produtosDetalhados?.length || 0;
        const msgProd = prodCount > 0 ? ` e ${prodCount} produto(s) na base` : '';
        exibirNotificacao(
          'sucesso',
          `Conectado ao Supabase com sucesso! ${res.items.length} validade(s)${msgProd} carregado(s).`
        );
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      exibirNotificacao('erro', 'Erro ao carregar registros de validade.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [exibirNotificacao]);

  useEffect(() => {
    // Limpa dados de mock anteriores no navegador para iniciar zerado
    const storageKey = 'validade_local_items';
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Se continha apenas os IDs de demonstração (1, 2, 3, 4, 5, 6), zera
        const idsDemo = ['1', '2', '3', '4', '5', '6'];
        if (Array.isArray(parsed) && parsed.every((it: any) => idsDemo.includes(String(it.id)))) {
          clearLocalItems();
        }
      } catch {
        clearLocalItems();
      }
    }
    carregarDados(supabaseConfig);

    // Carregar identidade visual e logos do Google Drive
    driveApi.getManifest().then((res) => {
      if (res.success && res.manifest) {
        if (res.manifest.systemConfig) {
          setSystemBranding(res.manifest.systemConfig);
        }
        if (res.manifest.industryLogos) {
          setIndustryLogos(res.manifest.industryLogos);
        }
        if (res.manifest.storeLogos) {
          setStoreLogos(res.manifest.storeLogos);
        }
        if (res.manifest.coordinatorLogos) {
          setCoordinatorLogos(res.manifest.coordinatorLogos);
        }
      }
    }).catch((err) => {
      console.warn('Erro ao carregar manifesto do Drive:', err);
    });
  }, [carregarDados, supabaseConfig]);

  // Lista de indústrias cadastradas para o autocomplete rápido
  const existingIndustries = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.industria).filter(Boolean)));
  }, [items]);

  // Inclusão rápida de item
  const handleAddItem = async (novoItem: Omit<ItemValidade, 'id' | 'created_at'>) => {
    setIsSaving(true);
    try {
      const res = await insertItemData(novoItem, supabaseConfig);
      setItems((prev) => [res.item, ...prev]);

      if (res.fromSupabase) {
        exibirNotificacao('sucesso', `"${res.item.produto}" salvo e sincronizado no Supabase!`);
      } else {
        exibirNotificacao('sucesso', `"${res.item.produto}" cadastrado no controle local!`);
      }
    } catch (err: any) {
      console.error('Erro ao adicionar produto:', err);
      exibirNotificacao('erro', 'Falha ao salvar o produto.');
    } finally {
      setIsSaving(false);
    }
  };

  // Inclusão de lote de múltiplos produtos com uma única confirmação
  const handleAddBatchItems = async (novosItens: Array<Omit<ItemValidade, 'id' | 'created_at'>>) => {
    if (novosItens.length === 0) return;
    setIsSaving(true);
    try {
      const res = await insertBatchItemsData(novosItens, supabaseConfig);
      setItems((prev) => [...res.items, ...prev]);

      if (res.fromSupabase) {
        exibirNotificacao('sucesso', `${res.items.length} produto(s) salvos e sincronizados no Supabase!`);
      } else {
        exibirNotificacao('sucesso', `${res.items.length} produto(s) adicionados ao controle!`);
      }
    } catch (err: any) {
      console.error('Erro ao adicionar produtos em lote:', err);
      exibirNotificacao('erro', 'Falha ao salvar a lista de produtos.');
    } finally {
      setIsSaving(false);
    }
  };

  // Atualização de item
  const handleUpdateItem = async (itemAtualizado: ItemValidade) => {
    try {
      setItems((prev) =>
        prev.map((it) => (it.id === itemAtualizado.id ? itemAtualizado : it))
      );
      await updateItemData(itemAtualizado, supabaseConfig);
      exibirNotificacao('sucesso', 'Produto atualizado.');
    } catch (err: any) {
      console.error('Erro ao atualizar produto:', err);
      exibirNotificacao('erro', 'Erro ao salvar alterações.');
    }
  };

  // Exclusão de item
  const handleDeleteItem = async (id: string) => {
    try {
      setItems((prev) => prev.filter((it) => it.id !== id));
      await deleteItemData(id, supabaseConfig);
      exibirNotificacao('sucesso', 'Item removido do controle.');
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      exibirNotificacao('erro', 'Erro ao remover item.');
    }
  };

  // Salvar configuração do Supabase
  const handleSaveConfig = async (novaConfig: SupabaseConfig) => {
    const atualizado = saveSupabaseConfig(novaConfig);
    setSupabaseConfig(atualizado);

    if (atualizado.isConnected) {
      exibirNotificacao('sucesso', 'Supabase configurado! Sincronizando dados...');
    } else {
      exibirNotificacao('aviso', 'Operando em modo local/offline.');
    }

    await carregarDados(atualizado);
  };

  // Adicionar produto no catálogo (e Supabase)
  const handleAddProdutoCatalogo = async (novoProd: {
    codigo?: string;
    nome: string;
    industria: string;
    unidade_padrao?: string;
  }) => {
    try {
      const res = await insertProdutoCatalogo(novoProd, supabaseConfig);

      setCatalogoSupabase((prev) => {
        const ind = (res.produto.industria || 'Geral').trim();
        const prod = res.produto.nome.trim();

        const novasIndustrias = prev.industrias.includes(ind)
          ? prev.industrias
          : [...prev.industrias, ind];

        const novoProdsMap = { ...prev.produtosPorIndustria };
        const key = ind.toLowerCase();
        if (!novoProdsMap[key]) novoProdsMap[key] = [];
        if (!novoProdsMap[key].includes(prod)) {
          novoProdsMap[key] = [...novoProdsMap[key], prod];
        }

        const prevDetalhados = prev.produtosDetalhados || [];
        const filtered = prevDetalhados.filter(
          (p) => !(p.nome.toLowerCase() === prod.toLowerCase() && p.industria.toLowerCase() === ind.toLowerCase())
        );

        return {
          ...prev,
          industrias: novasIndustrias,
          produtosPorIndustria: novoProdsMap,
          produtosDetalhados: [res.produto, ...filtered],
        };
      });

      return {
        success: true,
        fromSupabase: res.fromSupabase,
        error: res.error,
        warning: res.warning,
      };
    } catch (err: any) {
      return {
        success: false,
        fromSupabase: false,
        error: err.message,
      };
    }
  };

  // Adicionar lote de produtos no catálogo (e Supabase)
  const handleBatchAddProdutosCatalogo = async (
    produtosNovos: Array<{ codigo?: string; nome: string; industria: string; unidade_padrao?: string }>
  ) => {
    try {
      const res = await insertBatchProdutosCatalogo(produtosNovos, supabaseConfig);

      setCatalogoSupabase((prev) => {
        const indSet = new Set(prev.industrias);
        const novoProdsMap = { ...prev.produtosPorIndustria };
        const prevDetalhados = prev.produtosDetalhados || [];
        const novosKeys = new Set(res.produtos.map((p) => `${p.nome.toLowerCase()}_${p.industria.toLowerCase()}`));

        res.produtos.forEach((p) => {
          indSet.add(p.industria);
          const k = p.industria.toLowerCase();
          if (!novoProdsMap[k]) novoProdsMap[k] = [];
          if (!novoProdsMap[k].includes(p.nome)) {
            novoProdsMap[k] = [...novoProdsMap[k], p.nome];
          }
        });

        const filtered = prevDetalhados.filter(
          (p) => !novosKeys.has(`${p.nome.toLowerCase()}_${p.industria.toLowerCase()}`)
        );

        return {
          ...prev,
          industrias: Array.from(indSet),
          produtosPorIndustria: novoProdsMap,
          produtosDetalhados: [...res.produtos, ...filtered],
        };
      });

      return {
        success: true,
        count: res.inseridosCount,
        fromSupabase: res.fromSupabase,
        error: res.error,
        warning: res.warning,
      };
    } catch (err: any) {
      return {
        success: false,
        count: 0,
        fromSupabase: false,
        error: err.message,
      };
    }
  };

  // Excluir produto do catálogo
  const handleDeleteProdutoCatalogo = async (
    produtoNome: string,
    industria: string,
    produtoId?: string
  ) => {
    try {
      await deleteProdutoCatalogo(produtoNome, industria, supabaseConfig, produtoId);

      setCatalogoSupabase((prev) => {
        const prevDetalhados = prev.produtosDetalhados || [];
        const filtered = prevDetalhados.filter(
          (p) => !(p.nome.toLowerCase() === produtoNome.toLowerCase() && p.industria.toLowerCase() === industria.toLowerCase())
        );

        return {
          ...prev,
          produtosDetalhados: filtered,
        };
      });
    } catch (err) {
      console.error('Erro ao deletar produto do catálogo:', err);
    }
  };

  // Sincronizar todos os pendentes
  const handleSyncPendingProdutos = async () => {
    const pendentes = catalogoSupabase.produtosDetalhados?.filter((p) => p.syncedToSupabase === false) || [];
    if (pendentes.length === 0) {
      exibirNotificacao('aviso', 'Todos os produtos já estão sincronizados no Supabase.');
      return;
    }

    try {
      const res = await syncAllPendingProdutosToSupabase(pendentes, supabaseConfig);
      if (res.success) {
        if (res.warning) {
          exibirNotificacao('aviso', `${res.syncedCount} produto(s) sincronizados com o Supabase! ${res.warning}`);
        } else {
          exibirNotificacao('sucesso', `${res.syncedCount} produto(s) sincronizados com o Supabase!`);
        }
        await carregarDados(supabaseConfig, true);
      } else {
        exibirNotificacao('erro', `Erro ao sincronizar produtos: ${res.error || 'Verifique o Supabase'}`);
      }
    } catch (err: any) {
      exibirNotificacao('erro', `Falha na sincronização: ${err.message}`);
    }
  };

  // Exportar Excel
  const handleExportExcel = () => {
    if (items.length === 0) {
      exibirNotificacao('aviso', 'Nenhum item para exportar.');
      return;
    }
    exportarParaExcel(items, 'Controle_Validade_Geral');
    exibirNotificacao('sucesso', 'Planilha Excel gerada com sucesso (.xlsx)!');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased">
      {/* Barra de Topo */}
      <Header
        supabaseConfig={supabaseConfig}
        systemBranding={systemBranding}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onExportExcel={handleExportExcel}
        onOpenImportExcel={() => setIsImportExcelOpen(true)}
        onRefresh={() => carregarDados(supabaseConfig, true)}
        onOpenLogos={() => setModoVisualizacao('logos')}
        isRefreshing={isRefreshing}
        totalItems={items.length}
      />

      {/* Notificação Toast */}
      {banner && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-3">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium animate-fade-in ${
              banner.tipo === 'sucesso'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : banner.tipo === 'erro'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {banner.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {banner.tipo === 'erro' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
              {banner.tipo === 'aviso' && <Info className="w-4 h-4 text-amber-600 shrink-0" />}
              <span>{banner.mensagem}</span>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full">
        {/* Painel de Indicadores de Validade */}
        <StatsCards
          items={items}
          filtroAtivo={filtroStatus}
          aoMudarFiltro={setFiltroStatus}
        />

        {/* Formulário Rápido de Cadastro */}
        <QuickAddForm
          onAdd={handleAddItem}
          onAddBatch={handleAddBatchItems}
          existingIndustries={existingIndustries}
          catalogoProdutosPorIndustria={catalogoSupabase.produtosPorIndustria}
          catalogoProdutosDetalhadosSupabase={catalogoSupabase.produtosDetalhados}
          catalogoIndustriasSupabase={catalogoSupabase.industrias}
          catalogoCoordenadoresSupabase={catalogoSupabase.coordenadores}
          catalogoLojasSupabase={catalogoSupabase.lojas}
          allItems={items}
          isSaving={isSaving}
          prefilledProduct={prefilledProduct}
        />

        {/* Alerta de Produtos Encontrados no Supabase quando ainda não há validades lançadas */}
        {items.length === 0 && (catalogoSupabase.produtosDetalhados?.length || 0) > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-linear-to-r from-emerald-50 to-blue-50 border border-emerald-200 text-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {catalogoSupabase.produtosDetalhados?.length} produto(s) carregado(s) da base Supabase!
                </h3>
                <p className="text-xs text-slate-600">
                  Os produtos já estão disponíveis no autocomplete do cadastro acima e listados na aba <strong>"Produtos da Base"</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModoVisualizacao('catalogo')}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer shrink-0"
            >
              Ver Produtos da Base
            </button>
          </div>
        )}

        {/* Barra de Seleção do Modo de Visualização Responsiva */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-full sm:w-fit">
            <button
              id="btn-modo-cadastro-produtos"
              type="button"
              onClick={() => setModoVisualizacao('cadastro_produtos')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoVisualizacao === 'cadastro_produtos'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackagePlus className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Cadastrar Produtos</span>
            </button>
            <button
              id="btn-modo-hierarquia"
              type="button"
              onClick={() => setModoVisualizacao('hierarquia')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoVisualizacao === 'hierarquia'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Network className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Visão Hierárquica</span>
            </button>
            <button
              id="btn-modo-tabela"
              type="button"
              onClick={() => setModoVisualizacao('tabela')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoVisualizacao === 'tabela'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="truncate">Tabela Geral</span>
            </button>
            <button
              id="btn-modo-catalogo"
              type="button"
              onClick={() => setModoVisualizacao('catalogo')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoVisualizacao === 'catalogo'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Produtos da Base</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                modoVisualizacao === 'catalogo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300 text-slate-700'
              }`}>
                {catalogoSupabase.produtosDetalhados?.length || 0}
              </span>
            </button>
            <button
              id="btn-modo-logos"
              type="button"
              onClick={() => setModoVisualizacao('logos')}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoVisualizacao === 'logos'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Logos &amp; Identidade</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                modoVisualizacao === 'logos' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300 text-slate-700'
              }`}>
                Drive
              </span>
            </button>
          </div>

          <div className="text-[11px] sm:text-xs text-slate-500 text-center sm:text-right">
            {modoVisualizacao === 'cadastro_produtos' ? (
              <span>Cadastrar <strong>Código, Indústria e Produto</strong> com exportação e sincronização com Supabase</span>
            ) : modoVisualizacao === 'hierarquia' ? (
              <span>Árvore organizada: <strong>Loja → Indústria → Produtos</strong></span>
            ) : modoVisualizacao === 'tabela' ? (
              <span>Planilha geral para filtragem e extração em Excel</span>
            ) : modoVisualizacao === 'catalogo' ? (
              <span>Catálogo mestre de produtos sincronizados do banco Supabase</span>
            ) : (
              <span>Anexar e gerenciar logotipo do sistema e marcas das indústrias no <strong>Google Drive</strong></span>
            )}
          </div>
        </div>

        {/* Exibição Condicional: Cadastrar Produtos, Hierarquia, Tabela Geral, Produtos da Base ou Logos Firebase */}
        {modoVisualizacao === 'cadastro_produtos' ? (
          <ProductRegistrationView
            produtosCatalogo={catalogoSupabase.produtosDetalhados || []}
            existingIndustries={catalogoSupabase.industrias}
            supabaseConfig={supabaseConfig}
            onAddProduto={handleAddProdutoCatalogo}
            onAddBatchProdutos={handleBatchAddProdutosCatalogo}
            onDeleteProduto={handleDeleteProdutoCatalogo}
            onSyncPending={handleSyncPendingProdutos}
            onSelectProductToLaunch={(prod, ind, cod, un) => {
              setPrefilledProduct({ produto: prod, industria: ind, codigo: cod != null ? String(cod) : undefined, unidade: un });
              setModoVisualizacao('hierarquia');
              exibirNotificacao('sucesso', `"${prod}" carregado no formulário! Preencha a loja e validade.`);
            }}
            onRefresh={() => carregarDados(supabaseConfig, true)}
            isRefreshing={isRefreshing}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        ) : modoVisualizacao === 'hierarquia' ? (
          <HierarchyView
            items={items}
            catalogoLojas={catalogoSupabase.lojas}
            catalogoCoordenadores={catalogoSupabase.coordenadores}
            catalogoIndustrias={catalogoSupabase.industrias}
            industryLogos={industryLogos}
            storeLogos={storeLogos}
            coordinatorLogos={coordinatorLogos}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            isLoading={isLoading}
          />
        ) : modoVisualizacao === 'tabela' ? (
          <ProductList
            items={items}
            catalogoLojas={catalogoSupabase.lojas}
            catalogoCoordenadores={catalogoSupabase.coordenadores}
            catalogoIndustrias={catalogoSupabase.industrias}
            catalogoProdutos={catalogoSupabase.produtosDetalhados}
            filtroStatus={filtroStatus}
            aoMudarFiltroStatus={setFiltroStatus}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            isLoading={isLoading}
          />
        ) : modoVisualizacao === 'catalogo' ? (
          <BaseProductsView
            produtosCatalogo={catalogoSupabase.produtosDetalhados || []}
            itemsValidade={items}
            supabaseConfig={supabaseConfig}
            industryLogos={industryLogos}
            onRefresh={() => carregarDados(supabaseConfig, true)}
            isRefreshing={isRefreshing}
            onSelectProductToLaunch={(prod, ind, cod, un) => {
              setPrefilledProduct({ produto: prod, industria: ind, codigo: cod != null ? String(cod) : undefined, unidade: un });
              setModoVisualizacao('hierarquia');
              exibirNotificacao('sucesso', `"${prod}" carregado no formulário! Preencha a loja e validade.`);
            }}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            onNavigateToCadastro={() => setModoVisualizacao('cadastro_produtos')}
          />
        ) : (
          <LogoManagementView
            itens={items}
            produtosCatalogo={catalogoSupabase.produtosDetalhados || []}
            catalogoLojas={catalogoSupabase.lojas}
            catalogoCoordenadores={catalogoSupabase.coordenadores}
            onSystemLogoUpdated={(branding) => setSystemBranding(branding)}
            onIndustryLogosUpdated={(logos) => setIndustryLogos(logos)}
            onStoreLogosUpdated={(logos) => setStoreLogos(logos)}
            onCoordinatorLogosUpdated={(logos) => setCoordinatorLogos(logos)}
          />
        )}
      </main>

      {/* Modal do Supabase */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        currentConfig={supabaseConfig}
        onSaveConfig={handleSaveConfig}
      />

      {/* Modal de Importação de Excel */}
      <ImportExcelModal
        isOpen={isImportExcelOpen}
        onClose={() => setIsImportExcelOpen(false)}
        onImport={handleAddBatchItems}
        isSupabaseConnected={supabaseConfig.isConnected && Boolean(supabaseConfig.url)}
      />
    </div>
  );
}
