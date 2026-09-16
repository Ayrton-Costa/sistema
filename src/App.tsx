import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { QuickAddForm } from './components/QuickAddForm';
import { ProductList } from './components/ProductList';
import { HierarchyView } from './components/HierarchyView';
import { SupabaseModal } from './components/SupabaseModal';
import { ImportExcelModal } from './components/ImportExcelModal';
import { ItemValidade, FiltroStatus, SupabaseConfig, ModoVisualizacao } from './types';
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
} from './lib/supabase';
import { exportarParaExcel } from './lib/excel';
import { AlertCircle, CheckCircle2, Info, X, Table, Network } from 'lucide-react';

export default function App() {
  const [items, setItems] = useState<ItemValidade[]>([]);
  const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('hierarquia');
  const [catalogoSupabase, setCatalogoSupabase] = useState<{
    industrias: string[];
    produtosPorIndustria: Record<string, string[]>;
    coordenadores: string[];
    lojas: Array<{ nome: string; estado?: string; coordenador?: string }>;
  }>({ industrias: [], produtosPorIndustria: {}, coordenadores: [], lojas: [] });
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        exibirNotificacao(
          'sucesso',
          `Conectado ao Supabase com sucesso! ${res.items.length} registro(s) carregado(s).`
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
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onExportExcel={handleExportExcel}
        onOpenImportExcel={() => setIsImportExcelOpen(true)}
        onRefresh={() => carregarDados(supabaseConfig, true)}
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
          catalogoIndustriasSupabase={catalogoSupabase.industrias}
          catalogoCoordenadoresSupabase={catalogoSupabase.coordenadores}
          catalogoLojasSupabase={catalogoSupabase.lojas}
          allItems={items}
          isSaving={isSaving}
        />

        {/* Barra de Seleção do Modo de Visualização Responsiva */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
          <div className="grid grid-cols-2 sm:flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-full sm:w-fit">
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
          </div>

          <div className="text-[11px] sm:text-xs text-slate-500 text-center sm:text-right">
            {modoVisualizacao === 'hierarquia' ? (
              <span>Árvore organizada: <strong>Loja → Indústria → Produtos</strong></span>
            ) : (
              <span>Planilha geral para filtragem e extração em Excel</span>
            )}
          </div>
        </div>

        {/* Exibição Condicional: Hierarquia ou Tabela Geral */}
        {modoVisualizacao === 'hierarquia' ? (
          <HierarchyView
            items={items}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            isLoading={isLoading}
          />
        ) : (
          <ProductList
            items={items}
            filtroStatus={filtroStatus}
            aoMudarFiltroStatus={setFiltroStatus}
            onUpdate={handleUpdateItem}
            onDelete={handleDeleteItem}
            isLoading={isLoading}
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
