import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Store,
  Users,
  Search,
  Plus,
  ArrowRightLeft,
  CheckSquare,
  Square,
  Check,
  X,
  Filter,
  AlertCircle,
  Building2,
  MapPin,
  Package,
  Layers,
  ChevronDown,
  Sparkles,
  RefreshCw,
  FolderPlus,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { ItemValidade, SupabaseConfig, LojaCatalogo } from '../types';

interface CoordinatorStoreBindingViewProps {
  items: ItemValidade[];
  catalogoLojas: LojaCatalogo[];
  catalogoCoordenadores: string[];
  coordinatorLogos?: Record<string, { logoUrl?: string; [key: string]: any }>;
  storeLogos?: Record<string, { logoUrl?: string; [key: string]: any }>;
  supabaseConfig: SupabaseConfig;
  onUpdateLojaCoordenador: (lojaNome: string, novoCoordenador: string | null) => Promise<void>;
  onBatchUpdateLojasCoordenador: (lojasNomes: string[], novoCoordenador: string | null) => Promise<void>;
  onAddCoordenador: (nome: string) => Promise<void>;
  onAddLoja: (loja: { nome: string; estado?: string; coordenador?: string }) => Promise<void>;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const CoordinatorStoreBindingView: React.FC<CoordinatorStoreBindingViewProps> = ({
  items,
  catalogoLojas = [],
  catalogoCoordenadores = [],
  coordinatorLogos = {},
  storeLogos = {},
  supabaseConfig,
  onUpdateLojaCoordenador,
  onBatchUpdateLojasCoordenador,
  onAddCoordenador,
  onAddLoja,
  onRefresh,
  isRefreshing,
}) => {
  // Visualização: 'tabela_lojas' (lista com caixas de seleção) ou 'por_coordenador' (cards agrupados)
  const [visao, setVisao] = useState<'tabela_lojas' | 'por_coordenador'>('tabela_lojas');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCoordenador, setFiltroCoordenador] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // Caixas de seleção: Lojas selecionadas (Set de nomes de lojas)
  const [lojasSelecionadas, setLojasSelecionadas] = useState<Set<string>>(new Set());

  // Coordenador de destino para transferência em massa via caixa de seleção
  const [coordenadorDestinoEmMassa, setCoordenadorDestinoEmMassa] = useState<string>('');

  // Modais de cadastro rápido
  const [modalNovoCoordenador, setModalNovoCoordenador] = useState(false);
  const [novoCoordenadorNome, setNovoCoordenadorNome] = useState('');
  const [modalNovaLoja, setModalNovaLoja] = useState(false);
  const [novaLojaNome, setNovaLojaNome] = useState('');
  const [novaLojaEstado, setNovaLojaEstado] = useState('');
  const [novaLojaCoordenador, setNovaLojaCoordenador] = useState('');

  // Modal para adicionar lojas a um coordenador específico
  const [coordenadorModalAtivo, setCoordenadorModalAtivo] = useState<string | null>(null);
  const [buscaModalLojas, setBuscaModalLojas] = useState('');

  // Estado de loading durante operação
  const [isProcessando, setIsProcessando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  const exibirFeedback = (tipo: 'sucesso' | 'erro', mensagem: string) => {
    setFeedback({ tipo, mensagem });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Consolidação da Lista Geral de Coordenadores (Supabase + Catálogo + Itens)
  const todosCoordenadores = useMemo(() => {
    const set = new Set<string>();
    catalogoCoordenadores.forEach((c) => {
      if (c && c.trim()) set.add(c.trim());
    });
    catalogoLojas.forEach((l) => {
      if (l.coordenador && l.coordenador.trim()) set.add(l.coordenador.trim());
    });
    items.forEach((it) => {
      if (it.coordenador && it.coordenador.trim()) set.add(it.coordenador.trim());
    });

    if (set.size === 0) {
      ['Carlos Silva', 'Mariana Santos', 'Roberto Souza', 'Fernanda Lima'].forEach((c) => set.add(c));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogoCoordenadores, catalogoLojas, items]);

  // 2. Consolidação da Lista Geral de Lojas (Catálogo + Itens)
  const todasLojas = useMemo(() => {
    const map = new Map<string, { nome: string; estado?: string; coordenador?: string; totalItens: number }>();

    catalogoLojas.forEach((l) => {
      if (l.nome && l.nome.trim()) {
        const nomeTrim = l.nome.trim();
        map.set(nomeTrim.toLowerCase(), {
          nome: nomeTrim,
          estado: l.estado?.trim().toUpperCase(),
          coordenador: l.coordenador?.trim(),
          totalItens: 0,
        });
      }
    });

    items.forEach((it) => {
      if (it.loja && it.loja.trim()) {
        const nomeTrim = it.loja.trim();
        const key = nomeTrim.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.totalItens += 1;
          if (!existing.coordenador && it.coordenador?.trim()) {
            existing.coordenador = it.coordenador.trim();
          }
          if (!existing.estado && it.estado?.trim()) {
            existing.estado = it.estado.trim().toUpperCase();
          }
        } else {
          map.set(key, {
            nome: nomeTrim,
            estado: it.estado?.trim().toUpperCase(),
            coordenador: it.coordenador?.trim(),
            totalItens: 1,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [catalogoLojas, items]);

  // Lista de Estados únicos para filtro
  const estadosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    todasLojas.forEach((l) => {
      if (l.estado) set.add(l.estado.toUpperCase());
    });
    return Array.from(set).sort();
  }, [todasLojas]);

  // Lojas Filtradas
  const lojasFiltradas = useMemo(() => {
    return todasLojas.filter((l) => {
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const matchNome = l.nome.toLowerCase().includes(q);
        const matchCoord = (l.coordenador || '').toLowerCase().includes(q);
        const matchEstado = (l.estado || '').toLowerCase().includes(q);
        if (!matchNome && !matchCoord && !matchEstado) return false;
      }

      if (filtroCoordenador !== 'todos') {
        if (filtroCoordenador === 'sem_coordenador') {
          if (l.coordenador && l.coordenador.trim()) return false;
        } else if (l.coordenador?.trim() !== filtroCoordenador) {
          return false;
        }
      }

      if (filtroEstado !== 'todos') {
        if ((l.estado || '').toUpperCase() !== filtroEstado) return false;
      }

      return true;
    });
  }, [todasLojas, busca, filtroCoordenador, filtroEstado]);

  // Estatísticas
  const estatisticas = useMemo(() => {
    const totalLojas = todasLojas.length;
    let vinculadas = 0;
    let semCoordenador = 0;

    todasLojas.forEach((l) => {
      if (l.coordenador && l.coordenador.trim()) {
        vinculadas++;
      } else {
        semCoordenador++;
      }
    });

    return {
      totalCoordenadores: todosCoordenadores.length,
      totalLojas,
      vinculadas,
      semCoordenador,
    };
  }, [todasLojas, todosCoordenadores]);

  // Gerenciamento de Seleção de Caixas (Checkboxes)
  const alternarSelecaoLoja = (nomeLoja: string) => {
    setLojasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nomeLoja)) {
        next.delete(nomeLoja);
      } else {
        next.add(nomeLoja);
      }
      return next;
    });
  };

  const selecionarTodasFiltradas = () => {
    const todosNomes = lojasFiltradas.map((l) => l.nome);
    setLojasSelecionadas(new Set(todosNomes));
  };

  const desmarcarTodas = () => {
    setLojasSelecionadas(new Set());
  };

  // Manipular Mudança Individual de Coordenador (Caixa de Seleção / Dropdown)
  const handleAlterarCoordenadorIndividual = async (lojaNome: string, novoCoord: string) => {
    const coordFinal = novoCoord === 'sem_coordenador' ? null : novoCoord;
    setIsProcessando(true);
    try {
      await onUpdateLojaCoordenador(lojaNome, coordFinal);
      exibirFeedback(
        'sucesso',
        coordFinal
          ? `Loja "${lojaNome}" vinculada ao coordenador "${coordFinal}"!`
          : `Loja "${lojaNome}" desvinculada de coordenador.`
      );
    } catch (err: any) {
      exibirFeedback('erro', `Erro ao atualizar loja: ${err.message || 'Falha na gravação'}`);
    } finally {
      setIsProcessando(false);
    }
  };

  // Manipular Mudança em Massa (Caixas de Seleção marcadas)
  const handleAplicarTransferenciaEmMassa = async () => {
    if (lojasSelecionadas.size === 0) return;
    if (!coordenadorDestinoEmMassa) {
      alert('Por favor, selecione o coordenador de destino na caixa de seleção.');
      return;
    }

    const lojasArray = Array.from(lojasSelecionadas);
    const coordFinal = coordenadorDestinoEmMassa === 'sem_coordenador' ? null : coordenadorDestinoEmMassa;

    setIsProcessando(true);
    try {
      await onBatchUpdateLojasCoordenador(lojasArray, coordFinal);
      exibirFeedback(
        'sucesso',
        coordFinal
          ? `${lojasArray.length} loja(s) transferida(s) com sucesso para "${coordFinal}"!`
          : `${lojasArray.length} loja(s) desvinculadas de coordenador!`
      );
      desmarcarTodas();
      setCoordenadorDestinoEmMassa('');
    } catch (err: any) {
      exibirFeedback('erro', `Erro na transferência em massa: ${err.message || 'Falha na gravação'}`);
    } finally {
      setIsProcessando(false);
    }
  };

  // Salvar Novo Coordenador
  const handleSalvarNovoCoordenador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCoordenadorNome.trim()) return;

    setIsProcessando(true);
    try {
      await onAddCoordenador(novoCoordenadorNome.trim());
      exibirFeedback('sucesso', `Coordenador "${novoCoordenadorNome.trim()}" cadastrado com sucesso!`);
      setNovoCoordenadorNome('');
      setModalNovoCoordenador(false);
    } catch (err: any) {
      exibirFeedback('erro', 'Erro ao adicionar coordenador.');
    } finally {
      setIsProcessando(false);
    }
  };

  // Salvar Nova Loja
  const handleSalvarNovaLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaLojaNome.trim()) return;

    setIsProcessando(true);
    try {
      await onAddLoja({
        nome: novaLojaNome.trim(),
        estado: novaLojaEstado.trim().toUpperCase() || undefined,
        coordenador: novaLojaCoordenador.trim() || undefined,
      });
      exibirFeedback('sucesso', `Loja "${novaLojaNome.trim()}" cadastrada com sucesso!`);
      setNovaLojaNome('');
      setNovaLojaEstado('');
      setNovaLojaCoordenador('');
      setModalNovaLoja(false);
    } catch (err: any) {
      exibirFeedback('erro', 'Erro ao adicionar loja.');
    } finally {
      setIsProcessando(false);
    }
  };

  // Cores personalizadas para badges de coordenadores
  const obterCorCoordenador = (nomeCoord?: string) => {
    if (!nomeCoord) return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
    const hash = nomeCoord.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const cores = [
      { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
      { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
      { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
      { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
      { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
      { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
      { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
    ];
    return cores[hash % cores.length];
  };

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Vínculo de Coordenadores &amp; Lojas</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {estatisticas.totalLojas} Lojas
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Ligue coordenadores às suas respectivas lojas e transfira lojas entre coordenadores usando caixas de seleção.
              </p>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO: NOVO COORDENADOR E NOVA LOJA */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              title="Recarregar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Recarregar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setModalNovoCoordenador(true)}
            className="h-9 px-3.5 text-xs font-bold rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Coordenador</span>
          </button>

          <button
            type="button"
            onClick={() => setModalNovaLoja(true)}
            className="h-9 px-3.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Store className="w-4 h-4" />
            <span>+ Nova Loja</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK TOAST / ALERTA */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.mensagem}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CARDS COM RESUMO DE INDICADORES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Total Coordenadores</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{estatisticas.totalCoordenadores}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">cadastrados no sistema</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Total Lojas</span>
            <Store className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{estatisticas.totalLojas}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">lojas / filiais ativas</div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-emerald-800">Lojas com Coordenador</span>
            <Check className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700">{estatisticas.vinculadas}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">
            {estatisticas.totalLojas > 0
              ? `${Math.round((estatisticas.vinculadas / estatisticas.totalLojas) * 100)}% organizadas`
              : '0%'}
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold text-amber-800">Sem Coordenador</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700">{estatisticas.semCoordenador}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">
            {estatisticas.semCoordenador > 0 ? 'precisam de atribuição' : 'todas vinculadas!'}
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS E ALTERNADOR DE VISÃO */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Alternador de Visão */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setVisao('tabela_lojas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              visao === 'tabela_lojas' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
            <span>Lista de Lojas (Caixas de Seleção)</span>
          </button>
          <button
            type="button"
            onClick={() => setVisao('por_coordenador')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              visao === 'por_coordenador' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Agrupado por Coordenador</span>
          </button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca Rápida */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9 shadow-2xs">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar loja ou coordenador..."
              className="text-xs bg-transparent focus:outline-none font-medium text-slate-800 placeholder-slate-400 w-36 sm:w-48"
            />
            {busca && (
              <button type="button" onClick={() => setBusca('')} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtro Coordenador */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <select
              value={filtroCoordenador}
              onChange={(e) => setFiltroCoordenador(e.target.value)}
              className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[140px] truncate"
            >
              <option value="todos">Todos Coord. ({todosCoordenadores.length})</option>
              <option value="sem_coordenador">Sem Coordenador ({estatisticas.semCoordenador})</option>
              {todosCoordenadores.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          {estadosDisponiveis.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
              >
                <option value="todos">Todos Estados</option>
                {estadosDisponiveis.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* BARRA DE AÇÃO EM MASSA QUANDO HÁ LOJAS SELECIONADAS (CAIXINHAS DE SELEÇÃO) */}
      {lojasSelecionadas.size > 0 && (
        <div className="p-3 bg-linear-to-r from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs">
              {lojasSelecionadas.size}
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {lojasSelecionadas.size === 1
                  ? '1 loja selecionada via caixa de seleção'
                  : `${lojasSelecionadas.size} lojas selecionadas via caixas de seleção`}
              </div>
              <p className="text-[11px] text-slate-600">
                Escolha o coordenador na caixa de seleção abaixo para transferir todas juntas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Caixa de Seleção do Coordenador de Destino */}
            <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-lg px-2.5 h-9 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600">Transferir para:</span>
              <select
                value={coordenadorDestinoEmMassa}
                onChange={(e) => setCoordenadorDestinoEmMassa(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-bold text-indigo-900 cursor-pointer max-w-[170px]"
              >
                <option value="">Selecione o Coordenador...</option>
                {todosCoordenadores.map((coord) => (
                  <option key={coord} value={coord}>
                    {coord}
                  </option>
                ))}
                <option value="sem_coordenador">Desvincular (Deixar sem coordenador)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleAplicarTransferenciaEmMassa}
              disabled={!coordenadorDestinoEmMassa || isProcessando}
              className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>{isProcessando ? 'Transferindo...' : 'Transferir Lojas'}</span>
            </button>

            <button
              type="button"
              onClick={desmarcarTodas}
              className="h-9 px-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: VISÃO 1 (TABELA COM CAIXAS DE SELEÇÃO) OU VISÃO 2 (AGRUPADO POR COORDENADOR) */}
      {visao === 'tabela_lojas' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* TOPO DA TABELA: SELECIONAR TODAS */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer font-bold select-none text-slate-700 hover:text-indigo-700">
                <input
                  type="checkbox"
                  checked={lojasFiltradas.length > 0 && lojasSelecionadas.size === lojasFiltradas.length}
                  onChange={(e) => (e.target.checked ? selecionarTodasFiltradas() : desmarcarTodas())}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                />
                <span>Selecionar Todas ({lojasFiltradas.length} lojas filtradas)</span>
              </label>

              {lojasSelecionadas.size > 0 && (
                <button
                  type="button"
                  onClick={desmarcarTodas}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600 underline cursor-pointer"
                >
                  Desmarcar seleção
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              Clique na <strong>caixa de seleção</strong> da coluna "Coordenador Atual" para transferir individualmente.
            </div>
          </div>

          {/* LISTA / TABELA DE LOJAS */}
          {lojasFiltradas.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Store className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-sm text-slate-700">Nenhuma loja encontrada</p>
              <p className="text-xs text-slate-500">Tente ajustar os termos de busca ou cadastre uma nova loja.</p>
              <button
                type="button"
                onClick={() => setModalNovaLoja(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Cadastrar Loja
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[11px] border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <span className="sr-only">Seleção</span>
                    </th>
                    <th className="py-2.5 px-3">Loja / Filial</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Itens Cadastrados</th>
                    <th className="py-2.5 px-3">Coordenador Atual (Caixa de Seleção)</th>
                    <th className="py-2.5 px-3 text-right">Ação Rápida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {lojasFiltradas.map((loja) => {
                    const isSelecionada = lojasSelecionadas.has(loja.nome);
                    const corBadge = obterCorCoordenador(loja.coordenador);
                    const storeLogo = storeLogos[loja.nome]?.logoUrl;

                    return (
                      <tr
                        key={loja.nome}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelecionada ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        {/* Checkbox de Seleção */}
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelecionada}
                            onChange={() => alternarSelecaoLoja(loja.nome)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          />
                        </td>

                        {/* Nome da Loja */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {storeLogo ? (
                              <img
                                src={storeLogo}
                                alt={loja.nome}
                                className="w-6 h-6 object-contain rounded bg-white border border-slate-200 p-0.5 shrink-0"
                              />
                            ) : (
                              <div className="p-1 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                <Store className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 text-xs sm:text-[13px] break-words">
                                {loja.nome}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium">Filial ativa</div>
                            </div>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="py-2.5 px-3">
                          {loja.estado ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px] font-bold">
                              <MapPin className="w-2.5 h-2.5" />
                              {loja.estado}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Quantidade de Itens de Validade */}
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200">
                            <Package className="w-3 h-3 text-slate-500" />
                            {loja.totalItens} {loja.totalItens === 1 ? 'produto' : 'produtos'}
                          </span>
                        </td>

                        {/* Caixa de Seleção / Dropdown do Coordenador */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="relative inline-block w-full max-w-[210px]">
                              <select
                                value={loja.coordenador || 'sem_coordenador'}
                                onChange={(e) => handleAlterarCoordenadorIndividual(loja.nome, e.target.value)}
                                className={`w-full py-1.5 pl-2.5 pr-8 rounded-lg text-xs font-bold border transition cursor-pointer shadow-2xs ${
                                  loja.coordenador
                                    ? `${corBadge.bg} ${corBadge.text} ${corBadge.border} hover:border-indigo-400`
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-400'
                                }`}
                                title={`Alterar coordenador de ${loja.nome}`}
                              >
                                <option value="sem_coordenador">-- Sem Coordenador --</option>
                                {todosCoordenadores.map((coord) => (
                                  <option key={coord} value={coord}>
                                    {coord}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {loja.coordenador && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                                title="Loja Vinculada"
                              />
                            )}
                          </div>
                        </td>

                        {/* Ações Rápidas */}
                        <td className="py-2.5 px-3 text-right">
                          {loja.coordenador ? (
                            <button
                              type="button"
                              onClick={() => handleAlterarCoordenadorIndividual(loja.nome, 'sem_coordenador')}
                              className="px-2 py-1 text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition cursor-pointer"
                              title="Remover vínculo com coordenador"
                            >
                              Desvincular
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VISÃO 2: CARDS AGRUPADOS POR COORDENADOR (COM CAIXAS DE SELEÇÃO) */
        <div className="space-y-4">
          {/* Card especial: Lojas Sem Coordenador */}
          {estatisticas.semCoordenador > 0 && (
            <div className="p-4 bg-amber-50/70 rounded-2xl border-2 border-amber-300 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl border border-amber-300">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                      <span>Lojas Sem Coordenador Atribuído</span>
                      <span className="px-2 py-0.2 rounded-full text-xs font-bold bg-amber-200 text-amber-900">
                        {estatisticas.semCoordenador} lojas
                      </span>
                    </h3>
                    <p className="text-xs text-amber-800">
                      Vincule estas lojas a um coordenador selecionando abaixo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid de Lojas Sem Coordenador com Caixas de Seleção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {todasLojas
                  .filter((l) => !l.coordenador)
                  .map((loja) => (
                    <div
                      key={loja.nome}
                      className="p-2.5 bg-white rounded-xl border border-amber-200 shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-slate-900 truncate">{loja.nome}</div>
                        {loja.estado && (
                          <div className="text-[10px] font-mono text-slate-500">UF: {loja.estado}</div>
                        )}
                      </div>

                      {/* Dropdown seletor rápido */}
                      <select
                        onChange={(e) => handleAlterarCoordenadorIndividual(loja.nome, e.target.value)}
                        defaultValue=""
                        className="text-xs font-bold py-1 px-1.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg cursor-pointer"
                      >
                        <option value="" disabled>
                          + Vincular a...
                        </option>
                        {todosCoordenadores.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Cards de Cada Coordenador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todosCoordenadores.map((coordenador) => {
              const lojasDoCoord = todasLojas.filter((l) => l.coordenador === coordenador);
              const logoUrl = coordinatorLogos[coordenador]?.logoUrl;
              const totalProdutosCoord = lojasDoCoord.reduce((acc, l) => acc + l.totalItens, 0);

              return (
                <div
                  key={coordenador}
                  className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition space-y-3"
                >
                  {/* Cabeçalho do Card do Coordenador */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={coordenador}
                          className="w-10 h-10 object-contain rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 shadow-2xs"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {coordenador.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-slate-900 truncate">{coordenador}</h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                            {lojasDoCoord.length} {lojasDoCoord.length === 1 ? 'loja' : 'lojas'}
                          </span>
                          <span>•</span>
                          <span>{totalProdutosCoord} validades</span>
                        </div>
                      </div>
                    </div>

                    {/* Botão para Gerenciar / Adicionar Lojas com Checkboxes */}
                    <button
                      type="button"
                      onClick={() => {
                        setCoordenadorModalAtivo(coordenador);
                        setBuscaModalLojas('');
                      }}
                      className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0"
                      title={`Gerenciar lojas de ${coordenador}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Gerenciar Lojas</span>
                    </button>
                  </div>

                  {/* Lista de Lojas Vinculadas a Este Coordenador */}
                  {lojasDoCoord.length === 0 ? (
                    <div className="p-5 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                      <Store className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs font-semibold">Nenhuma loja vinculada a este coordenador</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCoordenadorModalAtivo(coordenador);
                          setBuscaModalLojas('');
                        }}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        + Vincular lojas agora
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {lojasDoCoord.map((loja) => (
                        <div
                          key={loja.nome}
                          className="p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs transition"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="font-bold text-slate-800 truncate">{loja.nome}</span>
                            {loja.estado && (
                              <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 shrink-0">
                                {loja.estado}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {loja.totalItens} un
                            </span>

                            {/* Dropdown para transferir para outro coordenador na hora */}
                            <select
                              value={coordenador}
                              onChange={(e) => handleAlterarCoordenadorIndividual(loja.nome, e.target.value)}
                              className="text-[10px] font-bold py-0.5 px-1 bg-white text-slate-700 border border-slate-300 rounded cursor-pointer max-w-[110px] truncate"
                              title="Transferir para outro coordenador"
                            >
                              <option value={coordenador}>{coordenador}</option>
                              {todosCoordenadores
                                .filter((c) => c !== coordenador)
                                .map((c) => (
                                  <option key={c} value={c}>
                                    Mudar p/ {c}
                                  </option>
                                ))}
                              <option value="sem_coordenador">Desvincular</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleAlterarCoordenadorIndividual(loja.nome, 'sem_coordenador')}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                              title="Desvincular loja"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: GERENCIAR LOJAS DE UM COORDENADOR COM CAIXAS DE SELEÇÃO */}
      {coordenadorModalAtivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-fade-in">
            {/* Topo do Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Lojas do Coordenador: {coordenadorModalAtivo}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Marque as caixas de seleção [✓] das lojas que pertencem a este coordenador.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCoordenadorModalAtivo(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Busca Rápida Dentro do Modal */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-8">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={buscaModalLojas}
                  onChange={(e) => setBuscaModalLojas(e.target.value)}
                  placeholder="Filtrar lojas nesta lista..."
                  className="text-xs bg-transparent focus:outline-none w-full"
                />
                {buscaModalLojas && (
                  <button type="button" onClick={() => setBuscaModalLojas('')}>
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista com Caixas de Seleção */}
            <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
              {todasLojas
                .filter((l) => {
                  if (!buscaModalLojas.trim()) return true;
                  const q = buscaModalLojas.trim().toLowerCase();
                  return l.nome.toLowerCase().includes(q) || (l.coordenador || '').toLowerCase().includes(q);
                })
                .map((loja) => {
                  const pertenceAEsteCoord = loja.coordenador === coordenadorModalAtivo;
                  const pertenceAOutro = loja.coordenador && loja.coordenador !== coordenadorModalAtivo;

                  return (
                    <label
                      key={loja.nome}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                        pertenceAEsteCoord
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={pertenceAEsteCoord}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleAlterarCoordenadorIndividual(loja.nome, coordenadorModalAtivo);
                            } else {
                              handleAlterarCoordenadorIndividual(loja.nome, 'sem_coordenador');
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight break-words">{loja.nome}</div>
                          {loja.estado && (
                            <span className="text-[10px] text-slate-500 font-mono">UF: {loja.estado}</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {pertenceAEsteCoord ? (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                            Vinculada a {coordenadorModalAtivo}
                          </span>
                        ) : pertenceAOutro ? (
                          <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Atualmente com: <strong>{loja.coordenador}</strong>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            Sem coordenador
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
            </div>

            {/* Rodapé do Modal */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setCoordenadorModalAtivo(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO COORDENADOR */}
      {modalNovoCoordenador && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Cadastrar Novo Coordenador</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoCoordenador(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovoCoordenador} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Coordenador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={novoCoordenadorNome}
                  onChange={(e) => setNovoCoordenadorNome(e.target.value)}
                  placeholder="Ex: Carlos Silva, Juliana Mendes..."
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovoCoordenador(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!novoCoordenadorNome.trim() || isProcessando}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg shadow-xs transition cursor-pointer"
                >
                  {isProcessando ? 'Salvando...' : 'Salvar Coordenador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVA LOJA */}
      {modalNovaLoja && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <Store className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Cadastrar Nova Loja / Filial</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNovaLoja(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarNovaLoja} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome da Loja <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={novaLojaNome}
                  onChange={(e) => setNovaLojaNome(e.target.value)}
                  placeholder="Ex: Supermercado Central - Loja 04"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Estado (UF) <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={novaLojaEstado}
                  onChange={(e) => setNovaLojaEstado(e.target.value.toUpperCase())}
                  placeholder="Ex: SP, RJ, MG..."
                  className="w-24 h-9 px-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-bold uppercase text-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Coordenador Responsável <span className="text-slate-400 font-normal">(Caixa de Seleção)</span>
                </label>
                <select
                  value={novaLojaCoordenador}
                  onChange={(e) => setNovaLojaCoordenador(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="">-- Sem Coordenador (definir depois) --</option>
                  {todosCoordenadores.map((coord) => (
                    <option key={coord} value={coord}>
                      {coord}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovaLoja(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!novaLojaNome.trim() || isProcessando}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg shadow-xs transition cursor-pointer"
                >
                  {isProcessando ? 'Salvando...' : 'Salvar Loja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
