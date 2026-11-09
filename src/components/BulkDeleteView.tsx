import React, { useState, useMemo } from 'react';
import {
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square,
  Filter,
  Search,
  RefreshCw,
  Building2,
  Store,
  Users,
  Calendar,
  AlertCircle,
  Package,
  Layers,
  ChevronRight,
  ShieldAlert,
  Info,
  CalendarClock,
  History,
} from 'lucide-react';
import { ItemValidade, LojaCatalogo, ProdutoCatalogo, SupabaseConfig } from '../types';
import { calcularDiasRestantes, calcularDiasDesdeAdicao, formatarDataBR } from '../lib/excel';

interface BulkDeleteViewProps {
  items: ItemValidade[];
  catalogoLojas: LojaCatalogo[];
  catalogoCoordenadores: string[];
  catalogoIndustrias: string[];
  catalogoProdutos?: ProdutoCatalogo[];
  supabaseConfig: SupabaseConfig;
  onDeleteBatch: (ids: string[]) => Promise<{ success: boolean; count: number; error?: string }>;
  onRefresh: () => void;
  isRefreshing: boolean;
}

type CriterioStatus = 'vencidos' | 'criticos' | 'vencidos_criticos' | 'atencao' | 'no_prazo' | 'personalizado' | 'todos';

export const BulkDeleteView: React.FC<BulkDeleteViewProps> = ({
  items,
  catalogoLojas,
  catalogoCoordenadores,
  catalogoIndustrias,
  catalogoProdutos,
  supabaseConfig,
  onDeleteBatch,
  onRefresh,
  isRefreshing,
}) => {
  // Critério de status selecionado
  const [criterioStatus, setCriterioStatus] = useState<CriterioStatus>('vencidos');
  const [diasPersonalizado, setDiasPersonalizado] = useState<number>(0);

  // Filtros adicionais de refinamento
  const [coordenadorFiltro, setCoordenadorFiltro] = useState<string>('todos');
  const [lojaFiltro, setLojaFiltro] = useState<string>('todas');
  const [industriaFiltro, setIndustriaFiltro] = useState<string>('todas');
  const [termoBusca, setTermoBusca] = useState<string>('');

  // IDs selecionados para exclusão
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Estado do Modal de Confirmação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ count: number; error?: string } | null>(null);

  // Mapeamento de lojas por coordenador
  const lojasDoCoordenador = useMemo(() => {
    if (coordenadorFiltro === 'todos') {
      return catalogoLojas;
    }
    const coordLower = coordenadorFiltro.trim().toLowerCase();
    return catalogoLojas.filter((l) => (l.coordenador || '').trim().toLowerCase() === coordLower);
  }, [catalogoLojas, coordenadorFiltro]);

  // Se o coordenador mudou e a loja selecionada não pertence a ele, reseta loja para 'todas'
  const handleCoordenadorChange = (novoCoord: string) => {
    setCoordenadorFiltro(novoCoord);
    if (novoCoord !== 'todos') {
      const coordLower = novoCoord.trim().toLowerCase();
      const lojasValidas = catalogoLojas
        .filter((l) => (l.coordenador || '').trim().toLowerCase() === coordLower)
        .map((l) => l.nome.toLowerCase());
      if (lojaFiltro !== 'todas' && !lojasValidas.includes(lojaFiltro.toLowerCase())) {
        setLojaFiltro('todas');
      }
    }
  };

  // Contagem global rápida para cada status
  const globalCounts = useMemo(() => {
    let vencidos = 0;
    let criticos = 0;
    let atencao = 0;
    let noPrazo = 0;

    items.forEach((it) => {
      const dias = calcularDiasRestantes(it.data_vencimento);
      if (dias <= 0) {
        vencidos++;
      } else if (dias <= 7) {
        criticos++;
      } else if (dias <= 30) {
        atencao++;
      } else {
        noPrazo++;
      }
    });

    return {
      vencidos,
      criticos,
      vencidos_criticos: vencidos + criticos,
      atencao,
      noPrazo,
      total: items.length,
    };
  }, [items]);

  // Itens filtrados conforme os critérios
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const dias = calcularDiasRestantes(it.data_vencimento);

      // 1. Filtro por status
      if (criterioStatus === 'vencidos') {
        if (dias > 0) return false;
      } else if (criterioStatus === 'criticos') {
        if (dias <= 0 || dias > 7) return false;
      } else if (criterioStatus === 'vencidos_criticos') {
        if (dias > 7) return false;
      } else if (criterioStatus === 'atencao') {
        if (dias <= 7 || dias > 30) return false;
      } else if (criterioStatus === 'no_prazo') {
        if (dias <= 30) return false;
      } else if (criterioStatus === 'personalizado') {
        if (dias > diasPersonalizado) return false;
      }

      // 2. Filtro por Coordenador
      if (coordenadorFiltro !== 'todos') {
        const itemCoord = (it.coordenador || it.vendedor || '').trim().toLowerCase();
        if (itemCoord !== coordenadorFiltro.trim().toLowerCase()) return false;
      }

      // 3. Filtro por Loja
      if (lojaFiltro !== 'todas') {
        const itemLoja = (it.loja || '').trim().toLowerCase();
        if (itemLoja !== lojaFiltro.trim().toLowerCase()) return false;
      }

      // 4. Filtro por Indústria
      if (industriaFiltro !== 'todas') {
        const itemInd = (it.industria || '').trim().toLowerCase();
        if (itemInd !== industriaFiltro.trim().toLowerCase()) return false;
      }

      // 5. Busca textual (SKU, Produto, Lote)
      if (termoBusca.trim()) {
        const term = termoBusca.toLowerCase().trim();
        const prod = (it.produto || '').toLowerCase();
        const cod = (it.codigo || '').toLowerCase();
        const lote = (it.lote || '').toLowerCase();
        const loja = (it.loja || '').toLowerCase();
        const resp = (it.vendedor || it.coordenador || '').toLowerCase();
        if (
          !prod.includes(term) &&
          !cod.includes(term) &&
          !lote.includes(term) &&
          !loja.includes(term) &&
          !resp.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    criterioStatus,
    diasPersonalizado,
    coordenadorFiltro,
    lojaFiltro,
    industriaFiltro,
    termoBusca,
  ]);

  // Sempre que a lista filtrada muda ou o critério de status muda, selecionamos por padrão todos os itens filtrados
  // para facilitar a exclusão de uma só vez
  React.useEffect(() => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  }, [criterioStatus, coordenadorFiltro, lojaFiltro, industriaFiltro, termoBusca, diasPersonalizado]);

  // Alternar seleção de um item individual
  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Selecionar todos os filtrados
  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  };

  // Desmarcar todos
  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Total de unidades e SKUs dos itens selecionados
  const selectedStats = useMemo(() => {
    const selectedList = filteredItems.filter((i) => selectedIds.has(i.id));
    const totalQtd = selectedList.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);
    const lojasDistintas = new Set(selectedList.map((i) => i.loja).filter(Boolean)).size;
    const industriasDistintas = new Set(selectedList.map((i) => i.industria).filter(Boolean)).size;

    return {
      totalItens: selectedList.length,
      totalQtd,
      lojasDistintas,
      industriasDistintas,
    };
  }, [filteredItems, selectedIds]);

  // Executar a exclusão em lote
  const handleExecuteBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setIsDeleting(true);
    setDeleteResult(null);

    try {
      const res = await onDeleteBatch(idsToDelete);
      setDeleteResult({ count: res.count, error: res.error });
      setIsConfirmModalOpen(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      setDeleteResult({ count: 0, error: err.message || 'Erro inesperado ao excluir.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho da Aba */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Exclusão em Massa por Status
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                  Descarte &amp; Limpeza
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Exclua de uma só vez todos os produtos vencidos ou críticos do controle e do banco Supabase.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>Atualizar Dados</span>
            </button>
          </div>
        </div>

        {/* Card de Aviso / Feedback */}
        {deleteResult && (
          <div
            className={`mt-4 p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
              deleteResult.error
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {deleteResult.error ? (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              ) : (
                <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              <span>
                {deleteResult.error
                  ? `Falha ao excluir itens: ${deleteResult.error}`
                  : `${deleteResult.count} item(ns) excluído(s) com sucesso do sistema e da base!`
                }
              </span>
            </div>
            <button
              onClick={() => setDeleteResult(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Seleção de Status Principal (Cards rápidos e acessíveis) */}
        <div className="mt-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5">
            1. Selecione o Critério de Status para Exclusão:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Vencidos (Destaque Principal) */}
            <button
              type="button"
              onClick={() => setCriterioStatus('vencidos')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
                criterioStatus === 'vencidos'
                  ? 'bg-red-500 text-white border-red-600 shadow-md ring-2 ring-red-400 ring-offset-1'
                  : 'bg-white hover:bg-red-50/60 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${criterioStatus === 'vencidos' ? 'text-red-100' : 'text-red-600'}`}>
                  Vencidos
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  criterioStatus === 'vencidos' ? 'bg-white text-red-700' : 'bg-red-100 text-red-800'
                }`}>
                  {globalCounts.vencidos}
                </span>
              </div>
              <p className="text-xs font-bold mt-1">≤ 0 dias</p>
              <p className={`text-[10px] mt-0.5 line-clamp-1 ${criterioStatus === 'vencidos' ? 'text-red-100' : 'text-slate-500'}`}>
                Todos já vencidos
              </p>
            </button>

            {/* Vencidos + Críticos */}
            <button
              type="button"
              onClick={() => setCriterioStatus('vencidos_criticos')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer relative overflow-hidden ${
                criterioStatus === 'vencidos_criticos'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-400 ring-offset-1'
                  : 'bg-white hover:bg-amber-50/60 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${criterioStatus === 'vencidos_criticos' ? 'text-amber-100' : 'text-amber-700'}`}>
                  Venc. + Críticos
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  criterioStatus === 'vencidos_criticos' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-900'
                }`}>
                  {globalCounts.vencidos_criticos}
                </span>
              </div>
              <p className="text-xs font-bold mt-1">≤ 7 dias</p>
              <p className={`text-[10px] mt-0.5 line-clamp-1 ${criterioStatus === 'vencidos_criticos' ? 'text-amber-100' : 'text-slate-500'}`}>
                Vencidos e críticos
              </p>
            </button>

            {/* Apenas Críticos */}
            <button
              type="button"
              onClick={() => setCriterioStatus('criticos')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                criterioStatus === 'criticos'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300 ring-offset-1'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${criterioStatus === 'criticos' ? 'text-amber-100' : 'text-amber-600'}`}>
                  Apenas Críticos
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  criterioStatus === 'criticos' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {globalCounts.criticos}
                </span>
              </div>
              <p className="text-xs font-bold mt-1">1 a 7 dias</p>
              <p className={`text-[10px] mt-0.5 line-clamp-1 ${criterioStatus === 'criticos' ? 'text-amber-100' : 'text-slate-500'}`}>
                A vencer na semana
              </p>
            </button>

            {/* Atenção */}
            <button
              type="button"
              onClick={() => setCriterioStatus('atencao')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                criterioStatus === 'atencao'
                  ? 'bg-sky-600 text-white border-sky-700 shadow-md ring-2 ring-sky-300 ring-offset-1'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${criterioStatus === 'atencao' ? 'text-sky-100' : 'text-sky-600'}`}>
                  Atenção
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  criterioStatus === 'atencao' ? 'bg-white text-sky-800' : 'bg-sky-100 text-sky-800'
                }`}>
                  {globalCounts.atencao}
                </span>
              </div>
              <p className="text-xs font-bold mt-1">8 a 30 dias</p>
              <p className={`text-[10px] mt-0.5 line-clamp-1 ${criterioStatus === 'atencao' ? 'text-sky-100' : 'text-slate-500'}`}>
                Vencimento no mês
              </p>
            </button>

            {/* No Prazo */}
            <button
              type="button"
              onClick={() => setCriterioStatus('no_prazo')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                criterioStatus === 'no_prazo'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-300 ring-offset-1'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${criterioStatus === 'no_prazo' ? 'text-emerald-100' : 'text-emerald-600'}`}>
                  No Prazo
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  criterioStatus === 'no_prazo' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {globalCounts.noPrazo}
                </span>
              </div>
              <p className="text-xs font-bold mt-1">&gt; 30 dias</p>
              <p className={`text-[10px] mt-0.5 line-clamp-1 ${criterioStatus === 'no_prazo' ? 'text-emerald-100' : 'text-slate-500'}`}>
                Prazo seguro
              </p>
            </button>

            {/* Personalizado */}
            <button
              type="button"
              onClick={() => setCriterioStatus('personalizado')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                criterioStatus === 'personalizado'
                  ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-400 ring-offset-1'
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${criterioStatus === 'personalizado' ? 'text-slate-200' : 'text-slate-600'}`}>
                  Personalizado
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  criterioStatus === 'personalizado' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'
                }`}>
                  ≤ {diasPersonalizado}d
                </span>
              </div>
              <p className="text-xs font-bold mt-1">Faixa de Dias</p>
              <p className={`text-[10px] mt-0.5 line-clamp-1 ${criterioStatus === 'personalizado' ? 'text-slate-200' : 'text-slate-500'}`}>
                Definir dias
              </p>
            </button>
          </div>

          {/* Opção adicional para dias customizados se 'personalizado' estiver ativo */}
          {criterioStatus === 'personalizado' && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">
                Excluir itens que vencem em até:
              </span>
              <input
                type="number"
                value={diasPersonalizado}
                onChange={(e) => setDiasPersonalizado(Number(e.target.value))}
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 text-center"
              />
              <span className="text-xs text-slate-500 font-medium">dias (ex: 0 para hoje, 15 para 15 dias)</span>
            </div>
          )}
        </div>

        {/* 2. Filtros de Refinamento (Coordenador, Loja, Indústria e Busca) */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              2. Refinar por Loja, Coordenador ou Indústria (Opcional):
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro Coordenador */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Users className="w-3 h-3 text-indigo-500" /> Coordenador / Vendedor
              </label>
              <select
                id="select-bulk-coordenador"
                value={coordenadorFiltro}
                onChange={(e) => handleCoordenadorChange(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="todos">Todos os Coordenadores</option>
                {catalogoCoordenadores.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Loja */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Store className="w-3 h-3 text-blue-500" /> Loja / Filial
              </label>
              <select
                id="select-bulk-loja"
                value={lojaFiltro}
                onChange={(e) => setLojaFiltro(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="todas">
                  {coordenadorFiltro === 'todos' ? 'Todas as Lojas' : `Lojas de ${coordenadorFiltro}`}
                </option>
                {lojasDoCoordenador.map((l) => (
                  <option key={l.nome} value={l.nome}>
                    {l.nome} {l.estado ? `(${l.estado})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Indústria */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-500" /> Indústria / Marca
              </label>
              <select
                id="select-bulk-industria"
                value={industriaFiltro}
                onChange={(e) => setIndustriaFiltro(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="todas">Todas as Indústrias</option>
                {catalogoIndustrias.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            {/* Busca Textual */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Search className="w-3 h-3 text-slate-500" /> Buscar SKU ou Produto
              </label>
              <div className="relative">
                <input
                  id="input-bulk-search"
                  type="text"
                  placeholder="Nome, código SKU ou lote..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Ação & Contadores */}
      <div className="bg-linear-to-r from-red-50 via-rose-50 to-orange-50 border border-red-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-slate-700">
          <div>
            <span className="text-slate-500 block text-[11px]">Itens Selecionados</span>
            <span className="text-base font-extrabold text-red-700">
              {selectedStats.totalItens}{' '}
              <span className="text-xs font-semibold text-slate-600">
                de {filteredItems.length} filtrados
              </span>
            </span>
          </div>

          <div className="border-l border-red-200 pl-3 sm:pl-6">
            <span className="text-slate-500 block text-[11px]">Volume a Descartar</span>
            <span className="text-base font-extrabold text-slate-900">
              {selectedStats.totalQtd}{' '}
              <span className="text-xs font-normal text-slate-500">unidades</span>
            </span>
          </div>

          <div className="border-l border-red-200 pl-3 sm:pl-6 hidden sm:block">
            <span className="text-slate-500 block text-[11px]">Lojas Afetadas</span>
            <span className="text-base font-extrabold text-slate-900">
              {selectedStats.lojasDistintas}
            </span>
          </div>

          <div className="border-l border-red-200 pl-3 sm:pl-6 hidden sm:block">
            <span className="text-slate-500 block text-[11px]">Indústrias</span>
            <span className="text-base font-extrabold text-slate-900">
              {selectedStats.industriasDistintas}
            </span>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          {selectedIds.size < filteredItems.length ? (
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl shadow-2xs transition cursor-pointer"
            >
              Marcar Todos ({filteredItems.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl shadow-2xs transition cursor-pointer"
            >
              Desmarcar Todos
            </button>
          )}

          {/* Botão de Exclusão em Massa */}
          <button
            id="btn-confirmar-exclusao-massa"
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={selectedStats.totalItens === 0}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>
              Excluir {selectedStats.totalItens} {criterioStatus === 'vencidos' ? 'Vencidos' : 'Item(ns)'} Selecionados
            </span>
          </button>
        </div>
      </div>

      {/* Tabela de Visualização e Conferência dos Itens */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Conferência dos Produtos ({filteredItems.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {criterioStatus === 'vencidos'
              ? 'Mostrando somente produtos com vencimento vencido (≤ 0d)'
              : `Filtro ativo: ${criterioStatus}`}
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <CheckSquare className="w-6 h-6 text-emerald-500" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              Nenhum registro encontrado para este critério!
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {criterioStatus === 'vencidos'
                ? 'Parabéns! Não há produtos com validade vencida na seleção atual.'
                : 'Tente alterar os filtros de status, coordenador ou loja acima.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 text-[11px] font-bold">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={selectedIds.size === filteredItems.length ? handleDeselectAll : handleSelectAllFiltered}
                      className="cursor-pointer text-slate-600 hover:text-red-600"
                      title={selectedIds.size === filteredItems.length ? 'Desmarcar todos' : 'Marcar todos'}
                    >
                      {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-red-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3 text-center">Dias p/ Vencer</th>
                  <th className="py-2.5 px-3">Produto</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Indústria</th>
                  <th className="py-2.5 px-3 text-center">Quantidade</th>
                  <th className="py-2.5 px-3 text-center">Vencimento</th>
                  <th className="py-2.5 px-3">Loja / Filial</th>
                  <th className="py-2.5 px-3">Coordenador / Resp.</th>
                  <th className="py-2.5 px-3 text-center">Data Cadastro</th>
                  <th className="py-2.5 px-3 text-center">Dias Cadastrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  const dias = calcularDiasRestantes(item.data_vencimento);

                  let badgeStatus = {
                    label: `No Prazo (${dias}d)`,
                    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    diasColor: 'text-emerald-700',
                  };

                  if (dias < 0) {
                    badgeStatus = {
                      label: `Vencido há ${Math.abs(dias)}d`,
                      bg: 'bg-red-50 text-red-700 border-red-200 font-bold',
                      diasColor: 'text-red-700 font-bold',
                    };
                  } else if (dias === 0) {
                    badgeStatus = {
                      label: 'Vence HOJE',
                      bg: 'bg-red-100 text-red-800 border-red-300 font-bold animate-pulse',
                      diasColor: 'text-red-700 font-bold',
                    };
                  } else if (dias <= 7) {
                    badgeStatus = {
                      label: `Crítico (${dias}d)`,
                      bg: 'bg-amber-50 text-amber-800 border-amber-200 font-bold',
                      diasColor: 'text-amber-700 font-bold',
                    };
                  } else if (dias <= 30) {
                    badgeStatus = {
                      label: `Atenção (${dias}d)`,
                      bg: 'bg-sky-50 text-sky-800 border-sky-200',
                      diasColor: 'text-sky-700 font-bold',
                    };
                  }

                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSelectItem(item.id)}
                      className={`hover:bg-red-50/40 transition cursor-pointer ${
                        isChecked ? 'bg-red-50/20' : ''
                      }`}
                    >
                      <td
                        className="py-2.5 px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(item.id);
                        }}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-red-600 inline-block" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 inline-block" />
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${badgeStatus.bg}`}>
                          {badgeStatus.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-xs ${badgeStatus.diasColor}`}>
                          {dias === 0 ? '0d (Hoje)' : `${dias}d`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.produto}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {item.codigo || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {item.industria}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {item.quantidade} <span className="text-[10px] font-normal text-slate-500">{item.unidade || 'un'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                        {formatarDataBR(item.data_vencimento)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {item.loja || 'Loja Principal'}{item.estado ? ` (${item.estado})` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.vendedor || item.coordenador || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                        {calcularDiasDesdeAdicao(item.created_at).dataFormatada}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {calcularDiasDesdeAdicao(item.created_at).rotulo}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação Segura de Exclusão em Massa */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Confirmar Exclusão em Massa?
                </h3>
                <p className="text-xs text-red-600 font-semibold mt-0.5">
                  Esta ação é irreversível e excluirá os itens permanentemente!
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Critério de Status:</span>
                <span className="font-bold text-slate-900 uppercase">
                  {criterioStatus === 'vencidos' ? 'Todos os Vencidos (≤ 0d)' : criterioStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total de Registros a Excluir:</span>
                <span className="font-extrabold text-red-700 text-sm">
                  {selectedStats.totalItens} produtos
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Volume Total de Mercadorias:</span>
                <span className="font-bold text-slate-900">
                  {selectedStats.totalQtd} unidades
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lojas Impactadas:</span>
                <span className="font-medium text-slate-800">
                  {selectedStats.lojasDistintas} loja(s)
                </span>
              </div>
              {supabaseConfig.isConnected && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-emerald-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Serão removidos tanto do navegador quanto do banco Supabase.</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Excluindo registros...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
