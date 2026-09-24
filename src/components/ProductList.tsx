import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  FileSpreadsheet,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  Minus,
  ArrowUpDown,
  Building2,
  Calendar,
  AlertCircle,
  Package,
  Store,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { ItemValidade, FiltroStatus, ProdutoCatalogo } from '../types';
import {
  calcularDiasRestantes,
  obterStatusValidade,
  formatarDataBR,
  exportarParaExcel,
} from '../lib/excel';

interface ProductListProps {
  items: ItemValidade[];
  catalogoLojas?: Array<{ nome: string; estado?: string; coordenador?: string }>;
  catalogoCoordenadores?: string[];
  catalogoIndustrias?: string[];
  catalogoProdutos?: ProdutoCatalogo[];
  filtroStatus: FiltroStatus;
  aoMudarFiltroStatus: (filtro: FiltroStatus) => void;
  onUpdate: (item: ItemValidade) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

type SortOrder = 'vencimento_asc' | 'vencimento_desc' | 'industria_asc' | 'loja_asc' | 'quantidade_desc';

export const ProductList: React.FC<ProductListProps> = ({
  items,
  catalogoLojas = [],
  catalogoCoordenadores = [],
  catalogoIndustrias = [],
  catalogoProdutos = [],
  filtroStatus,
  aoMudarFiltroStatus,
  onUpdate,
  onDelete,
  isLoading,
}) => {
  const [busca, setBusca] = useState('');
  const [coordenadorSelecionado, setCoordenadorSelecionado] = useState<string>('todos');
  const [lojaSelecionada, setLojaSelecionada] = useState<string>('todas');
  const [estadoSelecionado, setEstadoSelecionado] = useState<string>('todos');
  const [industriaSelecionada, setIndustriaSelecionada] = useState<string>('todas');
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<SortOrder>('vencimento_asc');

  // Estado de edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ItemValidade>>({});

  // Lista única de coordenadores cadastrados para filtro (tanto dos itens quanto do catálogo)
  const coordenadores = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.coordenador) set.add(it.coordenador.trim());
    });
    catalogoCoordenadores.forEach((c) => {
      if (c) set.add(c.trim());
    });
    catalogoLojas.forEach((l) => {
      if (l.coordenador) set.add(l.coordenador.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, catalogoCoordenadores, catalogoLojas]);

  // Lista de lojas vinculadas ao coordenador e estado selecionados
  const lojasDoCoordenador = useMemo(() => {
    const set = new Set<string>();
    // Lojas dos itens
    items.forEach((it) => {
      if (!it.loja) return;
      if (coordenadorSelecionado !== 'todos' && it.coordenador?.trim() !== coordenadorSelecionado) return;
      if (estadoSelecionado !== 'todos' && (it.estado || '').trim().toUpperCase() !== estadoSelecionado) return;
      set.add(it.loja.trim());
    });

    // Lojas cadastradas no catálogo do Supabase
    catalogoLojas.forEach((l) => {
      if (!l.nome) return;
      if (coordenadorSelecionado !== 'todos' && l.coordenador?.trim() !== coordenadorSelecionado) return;
      if (estadoSelecionado !== 'todos' && (l.estado || '').trim().toUpperCase() !== estadoSelecionado) return;
      set.add(l.nome.trim());
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, catalogoLojas, coordenadorSelecionado, estadoSelecionado]);

  // Se o coordenador mudou e a loja selecionada não pertence a ele, reseta a loja para "todas"
  const handleMudarCoordenador = (novoCoord: string) => {
    setCoordenadorSelecionado(novoCoord);
    if (lojaSelecionada !== 'todas') {
      const lojaPertence =
        items.some((it) =>
          it.loja?.trim() === lojaSelecionada &&
          (novoCoord === 'todos' || it.coordenador?.trim() === novoCoord) &&
          (estadoSelecionado === 'todos' || (it.estado || '').trim().toUpperCase() === estadoSelecionado)
        ) ||
        catalogoLojas.some((l) =>
          l.nome?.trim() === lojaSelecionada &&
          (novoCoord === 'todos' || l.coordenador?.trim() === novoCoord) &&
          (estadoSelecionado === 'todos' || (l.estado || '').trim().toUpperCase() === estadoSelecionado)
        );
      if (!lojaPertence) {
        setLojaSelecionada('todas');
      }
    }
  };

  // Se o estado mudou e a loja selecionada não pertence a ele, reseta a loja para "todas"
  const handleMudarEstado = (novoEstado: string) => {
    setEstadoSelecionado(novoEstado);
    if (lojaSelecionada !== 'todas') {
      const lojaPertence =
        items.some((it) =>
          it.loja?.trim() === lojaSelecionada &&
          (coordenadorSelecionado === 'todos' || it.coordenador?.trim() === coordenadorSelecionado) &&
          (novoEstado === 'todos' || (it.estado || '').trim().toUpperCase() === novoEstado)
        ) ||
        catalogoLojas.some((l) =>
          l.nome?.trim() === lojaSelecionada &&
          (coordenadorSelecionado === 'todos' || l.coordenador?.trim() === coordenadorSelecionado) &&
          (novoEstado === 'todos' || (l.estado || '').trim().toUpperCase() === novoEstado)
        );
      if (!lojaPertence) {
        setLojaSelecionada('todas');
      }
    }
  };

  // Lista única de indústrias cadastradas para filtro
  const industrias = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.industria) set.add(it.industria.trim());
    });
    catalogoProdutos.forEach((p) => {
      if (p.industria) set.add(p.industria.trim());
    });
    catalogoIndustrias.forEach((ind) => {
      if (ind) set.add(ind.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, catalogoProdutos, catalogoIndustrias]);

  // Lista de produtos disponíveis para filtro (filtrados pela indústria selecionada, se houver)
  const produtosFiltroOpcoes = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.produto?.trim()) {
        if (industriaSelecionada === 'todas' || it.industria === industriaSelecionada) {
          set.add(it.produto.trim());
        }
      }
    });
    catalogoProdutos.forEach((p) => {
      if (p.nome?.trim()) {
        if (industriaSelecionada === 'todas' || p.industria === industriaSelecionada) {
          set.add(p.nome.trim());
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, catalogoProdutos, industriaSelecionada]);

  // Lista única de estados cadastrados para filtro (com fallback para UFs padrão do Brasil)
  const estados = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.estado) set.add(it.estado.trim().toUpperCase());
    });
    catalogoLojas.forEach((l) => {
      if (l.estado) set.add(l.estado.trim().toUpperCase());
    });
    if (set.size === 0) {
      return [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
      ];
    }
    return Array.from(set).sort();
  }, [items, catalogoLojas]);

  const limparTodosFiltros = () => {
    setBusca('');
    setCoordenadorSelecionado('todos');
    setLojaSelecionada('todas');
    setEstadoSelecionado('todos');
    setIndustriaSelecionada('todas');
    setProdutoSelecionado('todos');
    aoMudarFiltroStatus('todos');
  };

  const temFiltroAtivo =
    Boolean(busca.trim()) ||
    coordenadorSelecionado !== 'todos' ||
    lojaSelecionada !== 'todas' ||
    estadoSelecionado !== 'todos' ||
    industriaSelecionada !== 'todas' ||
    produtoSelecionado !== 'todos' ||
    filtroStatus !== 'todos';

  // Filtragem e ordenação
  const itensFiltrados = useMemo(() => {
    return items
      .filter((item) => {
        // Filtro de texto geral
        if (busca.trim()) {
          const termo = busca.toLowerCase();
          const matchCod = item.codigo != null ? String(item.codigo).toLowerCase().includes(termo) : false;
          const matchInd = item.industria ? String(item.industria).toLowerCase().includes(termo) : false;
          const matchProd = item.produto ? String(item.produto).toLowerCase().includes(termo) : false;
          const matchLoja = item.loja ? String(item.loja).toLowerCase().includes(termo) : false;
          const matchEst = item.estado ? String(item.estado).toLowerCase().includes(termo) : false;
          const matchCoord = item.coordenador ? String(item.coordenador).toLowerCase().includes(termo) : false;
          const matchLote = item.lote ? String(item.lote).toLowerCase().includes(termo) : false;
          const matchObs = item.observacoes ? String(item.observacoes).toLowerCase().includes(termo) : false;
          if (!matchCod && !matchInd && !matchProd && !matchLoja && !matchEst && !matchCoord && !matchLote && !matchObs) {
            return false;
          }
        }

        // Filtro de indústria
        if (industriaSelecionada !== 'todas') {
          if (item.industria !== industriaSelecionada) return false;
        }

        // Filtro de produto específico
        if (produtoSelecionado !== 'todos') {
          if (item.produto.trim().toLowerCase() !== produtoSelecionado.trim().toLowerCase()) {
            return false;
          }
        }

        // Filtro de loja
        if (lojaSelecionada !== 'todas') {
          if (item.loja !== lojaSelecionada) return false;
        }

        // Filtro de estado
        if (estadoSelecionado !== 'todos') {
          if ((item.estado || '').toUpperCase() !== estadoSelecionado) return false;
        }

        // Filtro de coordenador
        if (coordenadorSelecionado !== 'todos') {
          if (item.coordenador !== coordenadorSelecionado) return false;
        }

        // Filtro de status
        const dias = calcularDiasRestantes(item.data_vencimento);
        if (filtroStatus === 'vencidos') return dias < 0;
        if (filtroStatus === 'critico_7d') return dias >= 0 && dias <= 7;
        if (filtroStatus === 'atencao_30d') return dias > 7 && dias <= 30;
        if (filtroStatus === 'regular') return dias > 30;

        return true;
      })
      .sort((a, b) => {
        if (ordenacao === 'vencimento_asc') {
          return a.data_vencimento.localeCompare(b.data_vencimento);
        }
        if (ordenacao === 'vencimento_desc') {
          return b.data_vencimento.localeCompare(a.data_vencimento);
        }
        if (ordenacao === 'industria_asc') {
          const comp = a.industria.localeCompare(b.industria);
          return comp !== 0 ? comp : a.produto.localeCompare(b.produto);
        }
        if (ordenacao === 'loja_asc') {
          const comp = (a.loja || '').localeCompare(b.loja || '');
          return comp !== 0 ? comp : a.produto.localeCompare(b.produto);
        }
        if (ordenacao === 'quantidade_desc') {
          return (b.quantidade || 0) - (a.quantidade || 0);
        }
        return 0;
      });
  }, [items, busca, industriaSelecionada, produtoSelecionado, lojaSelecionada, estadoSelecionado, coordenadorSelecionado, filtroStatus, ordenacao]);

  const handleStartEdit = (item: ItemValidade) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.industria || !editForm.produto || !editForm.data_vencimento) {
      return;
    }
    await onUpdate(editForm as ItemValidade);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleAjustarQtd = async (item: ItemValidade, delta: number) => {
    const novaQtd = Math.max(0, (item.quantidade || 0) + delta);
    if (novaQtd === 0) {
      if (confirm(`A quantidade de "${item.produto}" chegou a zero. Deseja remover do controle de validade?`)) {
        await onDelete(item.id);
        return;
      }
    }
    await onUpdate({
      ...item,
      quantidade: novaQtd,
    });
  };

  const handleExportarExcel = () => {
    const listaParaExportar = itensFiltrados.length > 0 ? itensFiltrados : items;
    exportarParaExcel(listaParaExportar, 'Controle_Validade_Estoque');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Barra de Filtros e Busca Rápida */}
      <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-busca-geral"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por loja, estado, coordenador, indústria, produto, lote..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtros Dropdowns e Ordenação */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro Loja */}
            {/* Filtro Coordenador (Primeiro na precedência gerencial) */}
            {coordenadores.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 h-10 shadow-2xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-indigo-600 tracking-wider leading-none">
                    Coordenador
                  </span>
                  <select
                    id="select-filtro-coordenador"
                    value={coordenadorSelecionado}
                    onChange={(e) => handleMudarCoordenador(e.target.value)}
                    className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[140px] truncate"
                  >
                    <option value="todos">Todos Coord. ({coordenadores.length})</option>
                    {coordenadores.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Filtro Loja (Vinculado ao Coordenador selecionado) */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 h-10 shadow-2xs">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-blue-600 tracking-wider leading-none">
                  {coordenadorSelecionado !== 'todos' ? `Lojas de ${coordenadorSelecionado}` : 'Loja'}
                </span>
                <select
                  id="select-filtro-loja"
                  value={lojaSelecionada}
                  onChange={(e) => setLojaSelecionada(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[150px] truncate"
                >
                  <option value="todas">
                    {coordenadorSelecionado !== 'todos'
                      ? `Todas as Lojas (${lojasDoCoordenador.length})`
                      : `Todas as Lojas (${lojasDoCoordenador.length})`}
                  </option>
                  {lojasDoCoordenador.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtro Estado */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 h-10 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-amber-600 tracking-wider leading-none">
                  Estado
                </span>
                <select
                  id="select-filtro-estado"
                  value={estadoSelecionado}
                  onChange={(e) => handleMudarEstado(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[110px] truncate"
                >
                  <option value="todos">Todos ({estados.length})</option>
                  {estados.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtro Indústria */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 h-10 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-purple-600 tracking-wider leading-none">
                  Indústria
                </span>
                <select
                  id="select-filtro-industria"
                  value={industriaSelecionada}
                  onChange={(e) => {
                    setIndustriaSelecionada(e.target.value);
                    setProdutoSelecionado('todos');
                  }}
                  className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[140px] truncate"
                >
                  <option value="todas">Todas ({industrias.length})</option>
                  {industrias.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtro de Produto da Base */}
            {produtosFiltroOpcoes.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 h-10 shadow-2xs">
                <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-blue-500 tracking-wider leading-none">
                    Produto
                  </span>
                  <select
                    id="select-filtro-produto"
                    value={produtoSelecionado}
                    onChange={(e) => setProdutoSelecionado(e.target.value)}
                    className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[150px] truncate"
                    title="Filtrar por produto específico"
                  >
                    <option value="todos">Todos ({produtosFiltroOpcoes.length})</option>
                    {produtosFiltroOpcoes.map((prod) => (
                      <option key={prod} value={prod}>
                        {prod}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 h-10 shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider leading-none">
                  Ordem
                </span>
                <select
                  id="select-ordenacao"
                  value={ordenacao}
                  onChange={(e) => setOrdenacao(e.target.value as SortOrder)}
                  className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="vencimento_asc">Vencimento (Mais Próximo)</option>
                  <option value="vencimento_desc">Vencimento (Mais Distante)</option>
                  <option value="industria_asc">Indústria (A-Z)</option>
                  <option value="loja_asc">Loja (A-Z)</option>
                  <option value="quantidade_desc">Maior Quantidade</option>
                </select>
              </div>
            </div>

            {/* Botão de Limpar Filtros quando algum estiver ativo */}
            {temFiltroAtivo && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="inline-flex items-center gap-1.5 h-10 px-3 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 font-semibold transition cursor-pointer shrink-0"
                title="Limpar todos os filtros da tabela"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}

            {/* Botão de Extrair em Excel */}
            <button
              id="btn-exportar-excel"
              onClick={handleExportarExcel}
              disabled={items.length === 0}
              title="Baixar planilha formatada .xlsx"
              className="inline-flex items-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Extrair em Excel ({itensFiltrados.length})</span>
            </button>
          </div>
        </div>

        {/* Abas Rápidas de Status */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Status:
          </span>
          <button
            id="tab-todos"
            onClick={() => aoMudarFiltroStatus('todos')}
            className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
              filtroStatus === 'todos'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos ({items.length})
          </button>
          <button
            id="tab-vencidos"
            onClick={() => aoMudarFiltroStatus('vencidos')}
            className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
              filtroStatus === 'vencidos'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
            }`}
          >
            Vencidos
          </button>
          <button
            id="tab-critico"
            onClick={() => aoMudarFiltroStatus('critico_7d')}
            className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
              filtroStatus === 'critico_7d'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            Vencem em até 7 dias
          </button>
          <button
            id="tab-atencao"
            onClick={() => aoMudarFiltroStatus('atencao_30d')}
            className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
              filtroStatus === 'atencao_30d'
                ? 'bg-yellow-600 text-white'
                : 'bg-white text-yellow-800 border border-yellow-200 hover:bg-yellow-50'
            }`}
          >
            Vencem em 30 dias
          </button>
          <button
            id="tab-regular"
            onClick={() => aoMudarFiltroStatus('regular')}
            className={`px-3 py-1 rounded-full font-medium transition cursor-pointer ${
              filtroStatus === 'regular'
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            No Prazo
          </button>
        </div>

        {/* Badges de Filtros Ativos na Tabela */}
        {temFiltroAtivo && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" /> Filtros ativos:
            </span>
            {busca.trim() && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg font-medium">
                <span>Busca: <strong>"{busca}"</strong></span>
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {coordenadorSelecionado !== 'todos' && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg font-medium">
                <UserCheck className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Coord: <strong>{coordenadorSelecionado}</strong></span>
                <button
                  type="button"
                  onClick={() => handleMudarCoordenador('todos')}
                  className="p-0.5 hover:bg-indigo-100 rounded text-indigo-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {lojaSelecionada !== 'todas' && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg font-medium">
                <Store className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Loja: <strong>{lojaSelecionada}</strong></span>
                <button
                  type="button"
                  onClick={() => setLojaSelecionada('todas')}
                  className="p-0.5 hover:bg-blue-100 rounded text-blue-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {estadoSelecionado !== 'todos' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg font-medium">
                <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                <span>UF: <strong>{estadoSelecionado}</strong></span>
                <button
                  type="button"
                  onClick={() => handleMudarEstado('todos')}
                  className="p-0.5 hover:bg-amber-100 rounded text-amber-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {industriaSelecionada !== 'todas' && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-lg font-medium">
                <Building2 className="w-3 h-3 text-purple-600 shrink-0" />
                <span>Indústria: <strong>{industriaSelecionada}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setIndustriaSelecionada('todas');
                    setProdutoSelecionado('todos');
                  }}
                  className="p-0.5 hover:bg-purple-100 rounded text-purple-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {produtoSelecionado !== 'todos' && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg font-medium">
                <Package className="w-3 h-3 text-blue-600 shrink-0" />
                <span>Produto: <strong>{produtoSelecionado}</strong></span>
                <button
                  type="button"
                  onClick={() => setProdutoSelecionado('todos')}
                  className="p-0.5 hover:bg-blue-100 rounded text-blue-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filtroStatus !== 'todos' && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg font-medium">
                <span>Status: <strong>{filtroStatus}</strong></span>
                <button
                  type="button"
                  onClick={() => aoMudarFiltroStatus('todos')}
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={limparTodosFiltros}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold ml-1 cursor-pointer"
            >
              Limpar Todos
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Produtos */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Loja & UF</th>
              <th className="py-3 px-4">Coordenador</th>
              <th className="py-3 px-4">Indústria</th>
              <th className="py-3 px-4">Produto</th>
              <th className="py-3 px-4 text-center">Qtd / Un</th>
              <th className="py-3 px-4">Vencimento</th>
              <th className="py-3 px-4">Situação</th>
              <th className="py-3 px-4 hidden sm:table-cell">Lote / Obs</th>
              <th className="py-3 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                  <p className="mt-2 text-xs">Carregando itens de validade...</p>
                </td>
              </tr>
            ) : itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-700">Nenhum registro de validade encontrado</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    {busca || filtroStatus !== 'todos' || industriaSelecionada !== 'todas' || lojaSelecionada !== 'todas' || produtoSelecionado !== 'todos'
                      ? 'Tente ajustar ou limpar os filtros de busca acima.'
                      : catalogoProdutos.length > 0
                      ? `Você possui ${catalogoProdutos.length} produto(s) na base Supabase. Utilize o formulário acima ou a aba "Produtos da Base" para registrar lotes e validades.`
                      : 'Cadastre um novo item acima para iniciar o controle.'}
                  </p>
                </td>
              </tr>
            ) : (
              itensFiltrados.map((item) => {
                const isEditing = editingId === item.id;
                const dias = calcularDiasRestantes(item.data_vencimento);
                const statusInfo = obterStatusValidade(dias);

                if (isEditing) {
                  return (
                    <tr key={item.id} className="bg-blue-50/40">
                      {/* Loja & Estado */}
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="Loja"
                            value={editForm.loja || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, loja: e.target.value })
                            }
                            className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="UF"
                            maxLength={2}
                            value={editForm.estado || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, estado: e.target.value.toUpperCase() })
                            }
                            className="w-12 h-8 px-1 text-xs text-center uppercase bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </td>

                      {/* Coordenador */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="Coordenador"
                          value={editForm.coordenador || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, coordenador: e.target.value })
                          }
                          className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Indústria */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={editForm.industria || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, industria: e.target.value })
                          }
                          className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Produto */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={editForm.produto || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, produto: e.target.value })
                          }
                          className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </td>

                      {/* Quantidade */}
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1 items-center justify-center">
                          <input
                            type="number"
                            min="1"
                            value={editForm.quantidade || 1}
                            onChange={(e) =>
                              setEditForm({ ...editForm, quantidade: Number(e.target.value) })
                            }
                            className="w-16 h-8 px-1.5 text-xs bg-white border border-blue-300 rounded text-center"
                          />
                          <select
                            value={editForm.unidade || 'un'}
                            onChange={(e) =>
                              setEditForm({ ...editForm, unidade: e.target.value })
                            }
                            className="h-8 px-1 text-xs bg-white border border-blue-300 rounded"
                          >
                            <option value="un">un</option>
                            <option value="cx">cx</option>
                            <option value="kg">kg</option>
                            <option value="pct">pct</option>
                            <option value="fardo">fardo</option>
                            <option value="lt">lt</option>
                          </select>
                        </div>
                      </td>

                      {/* Vencimento */}
                      <td className="py-2.5 px-3">
                        <input
                          type="date"
                          value={editForm.data_vencimento || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, data_vencimento: e.target.value })
                          }
                          className="h-8 px-2 text-xs bg-white border border-blue-300 rounded"
                        />
                      </td>

                      {/* Situação */}
                      <td className="py-2.5 px-3 text-xs text-slate-500 italic">
                        Ao salvar
                      </td>

                      {/* Lote e Obs */}
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                        <input
                          type="text"
                          placeholder="Lote"
                          value={editForm.lote || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, lote: e.target.value })
                          }
                          className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded mb-1"
                        />
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            title="Salvar alterações"
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            title="Cancelar"
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      dias < 0 ? 'bg-red-50/25' : dias <= 7 ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Loja & Estado */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                          {item.loja || <span className="text-slate-400 font-normal">Geral</span>}
                        </span>
                        {item.estado && (
                          <span className="inline-block px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200">
                            {item.estado}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Coordenador */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.coordenador || <span className="text-slate-300">-</span>}</span>
                      </div>
                    </td>

                    {/* Indústria */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.industria}</span>
                      </div>
                    </td>

                    {/* Produto */}
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{item.produto}</span>
                        {item.codigo && (
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-mono rounded text-[10px] font-normal border border-blue-100">
                            Cód: {item.codigo}
                          </span>
                        )}
                      </div>
                      {item.observacoes && (
                        <div className="text-[11px] text-slate-500 mt-0.5 sm:hidden line-clamp-1 font-normal">
                          {item.observacoes}
                        </div>
                      )}
                    </td>

                    {/* Quantidade */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAjustarQtd(item, -1)}
                          title="Diminuir 1 unidade"
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="font-bold text-slate-900 min-w-[2.2rem]">
                          {item.quantidade} <span className="text-xs font-normal text-slate-500">{item.unidade}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAjustarQtd(item, 1)}
                          title="Aumentar 1 unidade"
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>

                    {/* Data de Vencimento */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatarDataBR(item.data_vencimento)}</span>
                      </div>
                    </td>

                    {/* Situação / Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}
                      >
                        {dias <= 7 && <AlertCircle className="w-3 h-3" />}
                        {statusInfo.rotulo}
                      </span>
                    </td>

                    {/* Lote e Observações */}
                    <td className="py-3 px-4 text-xs text-slate-600 hidden sm:table-cell max-w-[200px] truncate">
                      {item.lote && (
                        <span className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono mr-1.5">
                          Lote: {item.lote}
                        </span>
                      )}
                      {item.observacoes && (
                        <span className="text-slate-500 italic truncate">{item.observacoes}</span>
                      )}
                      {!item.lote && !item.observacoes && (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          title="Editar item"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover "${item.produto}" (${item.industria}) do controle?`)) {
                              onDelete(item.id);
                            }
                          }}
                          title="Excluir item"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé da tabela com contagem e exportação rápida */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div>
          Mostrando <strong>{itensFiltrados.length}</strong> de <strong>{items.length}</strong> produtos
          cadastrados
        </div>

        <button
          onClick={handleExportarExcel}
          disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Baixar relatório completo em Excel (.xlsx)</span>
        </button>
      </div>
    </div>
  );
};
