import React, { useState, useMemo, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Store,
  Building2,
  Package,
  Calendar,
  Layers,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Maximize2,
  Minimize2,
  Check,
  X,
  Plus,
  Minus,
  Sliders,
  Sparkles,
  UserCheck,
  Filter,
  MapPin,
  Barcode,
  Table as TableIcon,
  LayoutGrid,
  List,
  Download,
  Search,
  ArrowUpDown,
  MoveHorizontal,
  Smartphone,
  Monitor,
  RotateCcw,
  GripVertical,
  CalendarClock,
  History,
} from 'lucide-react';
import { ItemValidade, NivelHierarquia, ProdutoCatalogo } from '../types';
import {
  calcularDiasRestantes,
  calcularDiasDesdeAdicao,
  obterStatusValidade,
  formatarDataBR,
  exportarParaExcel,
} from '../lib/excel';

interface HierarchyViewProps {
  items: ItemValidade[];
  catalogoLojas?: Array<{ nome: string; estado?: string; coordenador?: string }>;
  catalogoCoordenadores?: string[];
  catalogoIndustrias?: string[];
  catalogoProdutos?: ProdutoCatalogo[];
  industryLogos?: Record<string, { logoUrl?: string; [key: string]: any }>;
  storeLogos?: Record<string, { logoUrl?: string; [key: string]: any }>;
  coordinatorLogos?: Record<string, { logoUrl?: string; [key: string]: any }>;
  onUpdate: (item: ItemValidade) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

interface TreeNode {
  key: string;
  nivel: NivelHierarquia;
  valor: string;
  items: ItemValidade[];
  children?: TreeNode[];
  totalItens: number;
  totalQtd: number;
  vencidos: number;
  criticos: number;
  atencao: number;
  proximaDataVencimento?: string;
  menorDiasParaVencer?: number;
}

interface ColunaConfig {
  id: string;
  rotulo: string;
  rotuloCurto?: string;
  minLargura: number;
  larguraPadrao: number;
  alinhamento: 'left' | 'center' | 'right';
  podeOrdenar: boolean;
  podeMover: boolean;
  icone: React.FC<any>;
}

const COLUNAS_BASE: ColunaConfig[] = [
  {
    id: 'estrutura',
    rotulo: 'Estrutura / Hierarquia',
    rotuloCurto: 'Hierarquia',
    minLargura: 210,
    larguraPadrao: 260,
    alinhamento: 'left',
    podeOrdenar: true,
    podeMover: false,
    icone: Layers,
  },
  {
    id: 'industria',
    rotulo: 'Indústria',
    rotuloCurto: 'Indústria',
    minLargura: 130,
    larguraPadrao: 160,
    alinhamento: 'left',
    podeOrdenar: true,
    podeMover: true,
    icone: Building2,
  },
  {
    id: 'loja',
    rotulo: 'Loja / Filial',
    rotuloCurto: 'Loja',
    minLargura: 120,
    larguraPadrao: 150,
    alinhamento: 'left',
    podeOrdenar: true,
    podeMover: true,
    icone: Store,
  },
  {
    id: 'sku',
    rotulo: 'SKU / Produto',
    rotuloCurto: 'SKU',
    minLargura: 150,
    larguraPadrao: 200,
    alinhamento: 'left',
    podeOrdenar: true,
    podeMover: true,
    icone: Barcode,
  },
  {
    id: 'quantidade',
    rotulo: 'Qtd Total',
    rotuloCurto: 'Qtd',
    minLargura: 85,
    larguraPadrao: 105,
    alinhamento: 'center',
    podeOrdenar: true,
    podeMover: true,
    icone: Package,
  },
  {
    id: 'data_vencimento',
    rotulo: 'Data Vencimento',
    rotuloCurto: 'Vencimento',
    minLargura: 115,
    larguraPadrao: 130,
    alinhamento: 'center',
    podeOrdenar: true,
    podeMover: true,
    icone: Calendar,
  },
  {
    id: 'dias_vencer',
    rotulo: 'Dias p/ Vencer',
    rotuloCurto: 'Dias',
    minLargura: 110,
    larguraPadrao: 125,
    alinhamento: 'center',
    podeOrdenar: true,
    podeMover: true,
    icone: Clock,
  },
  {
    id: 'situacao',
    rotulo: 'Situação',
    rotuloCurto: 'Status',
    minLargura: 95,
    larguraPadrao: 110,
    alinhamento: 'center',
    podeOrdenar: false,
    podeMover: true,
    icone: AlertTriangle,
  },
  {
    id: 'data_cadastro',
    rotulo: 'Data Cadastro',
    rotuloCurto: 'Cadastro',
    minLargura: 110,
    larguraPadrao: 125,
    alinhamento: 'center',
    podeOrdenar: true,
    podeMover: true,
    icone: CalendarClock,
  },
  {
    id: 'dias_cadastro',
    rotulo: 'Dias Cadastrado',
    rotuloCurto: 'Dias Cad.',
    minLargura: 110,
    larguraPadrao: 125,
    alinhamento: 'center',
    podeOrdenar: true,
    podeMover: true,
    icone: History,
  },
  {
    id: 'acoes',
    rotulo: 'Ações',
    rotuloCurto: 'Ações',
    minLargura: 85,
    larguraPadrao: 95,
    alinhamento: 'right',
    podeOrdenar: false,
    podeMover: false,
    icone: Sliders,
  },
];

const ORDEM_PADRAO_COLUNAS = [
  'estrutura',
  'industria',
  'loja',
  'sku',
  'quantidade',
  'data_vencimento',
  'dias_vencer',
  'situacao',
  'data_cadastro',
  'dias_cadastro',
  'acoes',
];

const ROTULOS_NIVEL: Record<
  NivelHierarquia,
  { nome: string; icone: React.FC<any>; cor: string; bg: string; badge: string }
> = {
  industria: {
    nome: 'Indústria / Marca',
    icone: Building2,
    cor: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    badge: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  produto: {
    nome: 'Produto',
    icone: Package,
    cor: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  loja: {
    nome: 'Loja',
    icone: Store,
    cor: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  coordenador: {
    nome: 'Coordenador',
    icone: UserCheck,
    cor: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  },
  estado: {
    nome: 'Estado (UF)',
    icone: MapPin,
    cor: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
};

const obterBadgeDias = (dias: number) => {
  if (dias < 0) {
    const abs = Math.abs(dias);
    return {
      texto: `Venceu há ${abs}d`,
      textoLongo: `Venceu há ${abs} dia${abs > 1 ? 's' : ''}`,
      classe: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      icone: XCircle,
    };
  }
  if (dias === 0) {
    return {
      texto: 'Vence HOJE!',
      textoLongo: 'Vence HOJE!',
      classe: 'bg-rose-600 text-white border-rose-700 font-black animate-pulse',
      icone: AlertTriangle,
    };
  }
  if (dias === 1) {
    return {
      texto: '1 dia (amanhã)',
      textoLongo: 'Vence amanhã (1 dia)',
      classe: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
      icone: AlertTriangle,
    };
  }
  if (dias <= 7) {
    return {
      texto: `${dias} dias`,
      textoLongo: `Faltam ${dias} dias`,
      classe: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      icone: AlertTriangle,
    };
  }
  if (dias <= 30) {
    return {
      texto: `${dias} dias`,
      textoLongo: `Faltam ${dias} dias`,
      classe: 'bg-yellow-100 text-yellow-900 border-yellow-300 font-semibold',
      icone: Clock,
    };
  }
  return {
    texto: `${dias} dias`,
    textoLongo: `Faltam ${dias} dias`,
    classe: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    icone: CheckCircle,
  };
};

// 4 Precedências de Hierarquia Solicitadas pelo Usuário
export const PRESETS_HIERARQUIA: Array<{
  id: string;
  label: string;
  labelCurto: string;
  niveis: NivelHierarquia[];
}> = [
  {
    id: 'loja_industria_sku',
    label: 'Loja / Indústrias / SKU',
    labelCurto: 'Loja → Indústria → SKU',
    niveis: ['loja', 'industria', 'produto'],
  },
  {
    id: 'sku_loja_industria',
    label: 'SKU / Loja / Indústrias',
    labelCurto: 'SKU → Loja → Indústria',
    niveis: ['produto', 'loja', 'industria'],
  },
  {
    id: 'industria_loja_sku',
    label: 'Indústrias / Lojas / SKU',
    labelCurto: 'Indústria → Loja → SKU',
    niveis: ['industria', 'loja', 'produto'],
  },
  {
    id: 'industria_sku_loja',
    label: 'Indústria / SKU / Loja',
    labelCurto: 'Indústria → SKU → Loja',
    niveis: ['industria', 'produto', 'loja'],
  },
];

// Status simplificado conforme solicitado: "Vencido", "Crítico", "No prazo"
export const obterStatusSimples = (dataVencimentoStr: string) => {
  const dias = calcularDiasRestantes(dataVencimentoStr);
  if (dias <= 0) {
    return {
      status: 'vencido' as const,
      texto: 'Vencido',
      dias,
      classe: 'bg-red-100 text-red-800 border-red-300 font-bold',
      icone: XCircle,
    };
  }
  if (dias <= 7) {
    return {
      status: 'critico' as const,
      texto: 'Crítico',
      dias,
      classe: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
      icone: AlertTriangle,
    };
  }
  return {
    status: 'no_prazo' as const,
    texto: 'No prazo',
    dias,
    classe: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    icone: CheckCircle,
  };
};

export const HierarchyView: React.FC<HierarchyViewProps> = ({
  items,
  catalogoLojas = [],
  catalogoCoordenadores = [],
  catalogoIndustrias = [],
  catalogoProdutos = [],
  industryLogos = {},
  storeLogos = {},
  coordinatorLogos = {},
  onUpdate,
  onDelete,
  isLoading,
}) => {
  // Precedência hierárquica ativa (Padrão: Loja / Indústrias / SKU)
  const [hierarquia, setHierarquia] = useState<NivelHierarquia[]>(['loja', 'industria', 'produto']);
  const [mostrarPainelPrecedencia, setMostrarPainelPrecedencia] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [itemExpandidoId, setItemExpandidoId] = useState<string | null>(null);

  // Modo de exibição: Planilha Dinâmica vs Pastas vs Forçar Formato Celular
  const [modoExibicao, setModoExibicao] = useState<'planilha' | 'pastas'>('planilha');
  const [forcarVisualizacaoMobile, setForcarVisualizacaoMobile] = useState<boolean>(false);

  // 1. MOVIMENTAÇÃO DE COLUNAS (Ordem dinâmica)
  const [ordemColunas, setOrdemColunas] = useState<string[]>(ORDEM_PADRAO_COLUNAS);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  // 2. AJUSTE DE TAMANHO DE COLUNAS (Column Resizing)
  const [largurasColunas, setLargurasColunas] = useState<Record<string, number>>(() => {
    const mapa: Record<string, number> = {};
    COLUNAS_BASE.forEach((c) => {
      mapa[c.id] = c.larguraPadrao;
    });
    return mapa;
  });

  // 3. FILTRAGEM DO MENOR PARA MAIOR / MAIOR PARA MENOR (Ordenação por coluna)
  const [colunaOrdenacao, setColunaOrdenacao] = useState<string | null>('data_vencimento');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<'asc' | 'desc' | null>('asc');

  // Filtros rápidos adicionais
  const [buscaRapida, setBuscaRapida] = useState('');
  const [skuFiltro, setSkuFiltro] = useState<string>('todos');
  const [coordenadorFiltro, setCoordenadorFiltro] = useState<string>('todos');
  const [lojaFiltro, setLojaFiltro] = useState<string>('todas');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('todos');
  const [industriaFiltro, setIndustriaFiltro] = useState<string>('todas');

  // Filtro de Status de Vencimento com múltiplas seleções (caixinhas de seleção)
  const [statusSelecionados, setStatusSelecionados] = useState<Set<'vencido' | 'critico' | 'no_prazo'>>(
    () => new Set(['vencido', 'critico', 'no_prazo'])
  );

  const alternarStatusFiltro = (st: 'vencido' | 'critico' | 'no_prazo') => {
    setStatusSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(st)) {
        next.delete(st);
      } else {
        next.add(st);
      }
      return next;
    });
  };

  const selecionarTodosStatus = () => {
    setStatusSelecionados(new Set(['vencido', 'critico', 'no_prazo']));
  };

  // Edição inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ItemValidade>>({});

  // Listas de apoio
  const listaCoordenadores = useMemo(() => {
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

  const listaEstados = useMemo(() => {
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

  const listaIndustrias = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.industria) set.add(it.industria.trim());
    });
    catalogoIndustrias.forEach((ind) => {
      if (ind) set.add(ind.trim());
    });
    Object.keys(industryLogos).forEach((ind) => {
      if (ind) set.add(ind.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, catalogoIndustrias, industryLogos]);

  const lojasFiltradas = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (!it.loja) return;
      if (coordenadorFiltro !== 'todos' && it.coordenador?.trim() !== coordenadorFiltro) return;
      if (estadoFiltro !== 'todos' && (it.estado || '').trim().toUpperCase() !== estadoFiltro) return;
      set.add(it.loja.trim());
    });
    catalogoLojas.forEach((l) => {
      if (!l.nome) return;
      if (coordenadorFiltro !== 'todos' && l.coordenador?.trim() !== coordenadorFiltro) return;
      if (estadoFiltro !== 'todos' && (l.estado || '').trim().toUpperCase() !== estadoFiltro) return;
      set.add(l.nome.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items, catalogoLojas, coordenadorFiltro, estadoFiltro]);

  const opcoesSku = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; industria: string; key: string }>();
    catalogoProdutos.forEach((p) => {
      if (p.codigo && String(p.codigo).trim()) {
        const cod = String(p.codigo).trim();
        if (industriaFiltro === 'todas' || p.industria === industriaFiltro) {
          if (!map.has(cod)) {
            map.set(cod, {
              codigo: cod,
              nome: p.nome || 'Produto sem nome',
              industria: p.industria || '',
              key: `cat_${cod}_${p.nome}`,
            });
          }
        }
      }
    });

    items.forEach((it) => {
      if (it.codigo && String(it.codigo).trim()) {
        const cod = String(it.codigo).trim();
        if (industriaFiltro === 'todas' || it.industria === industriaFiltro) {
          if (!map.has(cod)) {
            map.set(cod, {
              codigo: cod,
              nome: it.produto || 'Item sem nome',
              industria: it.industria || '',
              key: `it_${cod}_${it.produto}`,
            });
          }
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, undefined, { numeric: true })
    );
  }, [catalogoProdutos, items, industriaFiltro]);

  const limparTodosFiltros = () => {
    setSkuFiltro('todos');
    setCoordenadorFiltro('todos');
    setLojaFiltro('todas');
    setEstadoFiltro('todos');
    setIndustriaFiltro('todas');
    setBuscaRapida('');
    setStatusSelecionados(new Set(['vencido', 'critico', 'no_prazo']));
  };

  const temFiltroAtivo =
    (Boolean(skuFiltro.trim()) && skuFiltro !== 'todos') ||
    coordenadorFiltro !== 'todos' ||
    lojaFiltro !== 'todas' ||
    estadoFiltro !== 'todos' ||
    industriaFiltro !== 'todas' ||
    Boolean(buscaRapida.trim()) ||
    statusSelecionados.size < 3;

  // 4. FUNÇÕES DE MOVIMENTAÇÃO DE COLUNAS
  const moverColuna = (origemId: string, destinoId: string) => {
    if (origemId === destinoId) return;
    setOrdemColunas((prev) => {
      const idxOrigem = prev.indexOf(origemId);
      const idxDestino = prev.indexOf(destinoId);
      if (idxOrigem === -1 || idxDestino === -1) return prev;
      const copy = [...prev];
      const [removido] = copy.splice(idxOrigem, 1);
      copy.splice(idxDestino, 0, removido);
      return copy;
    });
  };

  const moverColunaParaEsquerda = (colId: string) => {
    setOrdemColunas((prev) => {
      const idx = prev.indexOf(colId);
      if (idx <= 1) return prev; // Mantém estrutura fixa na posição 0 se desejado
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const moverColunaParaDireita = (colId: string) => {
    setOrdemColunas((prev) => {
      const idx = prev.indexOf(colId);
      if (idx === -1 || idx >= prev.length - 2) return prev; // Mantém ações no final
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  const resetarColunas = () => {
    setOrdemColunas(ORDEM_PADRAO_COLUNAS);
    const mapa: Record<string, number> = {};
    COLUNAS_BASE.forEach((c) => {
      mapa[c.id] = c.larguraPadrao;
    });
    setLargurasColunas(mapa);
    setColunaOrdenacao('data_vencimento');
    setDirecaoOrdenacao('asc');
  };

  // 5. AJUSTE DE TAMANHO DE COLUNA VIA ARRASTO (Resizing)
  const iniciarRedimensionamento = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const larguraInicial = largurasColunas[colId] || 120;
    const minLargura = COLUNAS_BASE.find((c) => c.id === colId)?.minLargura || 70;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const novaLargura = Math.max(minLargura, larguraInicial + delta);
      setLargurasColunas((prev) => ({
        ...prev,
        [colId]: novaLargura,
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // 6. ALTERNAR ORDENAÇÃO (Menor para Maior / Maior para Menor)
  const alternarOrdenacao = (colId: string) => {
    if (colunaOrdenacao !== colId) {
      setColunaOrdenacao(colId);
      setDirecaoOrdenacao('asc'); // Menor para Maior
    } else if (direcaoOrdenacao === 'asc') {
      setDirecaoOrdenacao('desc'); // Maior para Menor
    } else {
      setColunaOrdenacao(null);
      setDirecaoOrdenacao(null);
    }
  };

  // Helper de comparação para ordenação
  const compararValores = (a: ItemValidade, b: ItemValidade): number => {
    if (!colunaOrdenacao || !direcaoOrdenacao) return 0;
    let res = 0;

    switch (colunaOrdenacao) {
      case 'quantidade':
        res = Number(a.quantidade || 0) - Number(b.quantidade || 0);
        break;
      case 'data_vencimento':
        res = new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
        break;
      case 'dias_vencer':
        res = calcularDiasRestantes(a.data_vencimento) - calcularDiasRestantes(b.data_vencimento);
        break;
      case 'industria':
        res = (a.industria || '').localeCompare(b.industria || '');
        break;
      case 'loja':
        res = (a.loja || '').localeCompare(b.loja || '');
        break;
      case 'sku':
        res = (a.codigo || a.produto || '').localeCompare(b.codigo || b.produto || '', undefined, {
          numeric: true,
        });
        break;
      case 'estrutura':
      case 'produto':
        res = (a.produto || '').localeCompare(b.produto || '');
        break;
      case 'data_cadastro':
        res = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        break;
      case 'dias_cadastro':
        res = calcularDiasDesdeAdicao(a.created_at).diasAtras - calcularDiasDesdeAdicao(b.created_at).diasAtras;
        break;
      default:
        res = 0;
    }

    return direcaoOrdenacao === 'asc' ? res : -res;
  };

  // Itens filtrados
  const itensParaArvore = useMemo(() => {
    const filtrados = items.filter((it) => {
      if (buscaRapida.trim()) {
        const query = buscaRapida.trim().toLowerCase();
        const textoCompleto = `${it.produto || ''} ${it.codigo || ''} ${it.industria || ''} ${it.loja || ''} ${it.coordenador || ''} ${it.estado || ''}`.toLowerCase();
        if (!textoCompleto.includes(query)) return false;
      }
      if (skuFiltro && skuFiltro !== 'todos' && skuFiltro.trim()) {
        const termoSku = skuFiltro.trim().toLowerCase();
        const matchSku = it.codigo != null && String(it.codigo).trim().toLowerCase() === termoSku;
        let matchCat = false;
        if (!matchSku && it.produto) {
          matchCat = catalogoProdutos.some(
            (p) =>
              p.codigo != null &&
              String(p.codigo).trim().toLowerCase() === termoSku &&
              p.nome.trim().toLowerCase() === it.produto.trim().toLowerCase() &&
              (!it.industria || !p.industria || p.industria.trim().toLowerCase() === it.industria.trim().toLowerCase())
          );
        }
        if (!matchSku && !matchCat) return false;
      }
      if (coordenadorFiltro !== 'todos') {
        if (it.coordenador?.trim() !== coordenadorFiltro) return false;
      }
      if (lojaFiltro !== 'todas') {
        if (it.loja?.trim() !== lojaFiltro) return false;
      }
      if (estadoFiltro !== 'todos') {
        if ((it.estado || '').trim().toUpperCase() !== estadoFiltro) return false;
      }
      if (industriaFiltro !== 'todas') {
        if (it.industria?.trim() !== industriaFiltro) return false;
      }
      if (statusSelecionados.size < 3) {
        const st = obterStatusSimples(it.data_vencimento).status;
        if (!statusSelecionados.has(st)) return false;
      }
      return true;
    });

    if (colunaOrdenacao && direcaoOrdenacao) {
      return [...filtrados].sort(compararValores);
    }
    return filtrados;
  }, [
    items,
    catalogoProdutos,
    skuFiltro,
    coordenadorFiltro,
    lojaFiltro,
    estadoFiltro,
    industriaFiltro,
    statusSelecionados,
    buscaRapida,
    colunaOrdenacao,
    direcaoOrdenacao,
  ]);

  // Resumo estatístico
  const resumoGeral = useMemo(() => {
    let qtdTotal = 0;
    let vencidos = 0;
    let criticos = 0;
    let atencao = 0;
    let noPrazo = 0;

    itensParaArvore.forEach((it) => {
      qtdTotal += Number(it.quantidade || 0);
      const dias = calcularDiasRestantes(it.data_vencimento);
      if (dias < 0) vencidos++;
      else if (dias <= 7) criticos++;
      else if (dias <= 30) atencao++;
      else noPrazo++;
    });

    const industriasUnicas = new Set(itensParaArvore.map((i) => i.industria?.trim()).filter(Boolean)).size;
    const produtosUnicos = new Set(itensParaArvore.map((i) => i.produto?.trim()).filter(Boolean)).size;
    const lojasUnicas = new Set(itensParaArvore.map((i) => i.loja?.trim()).filter(Boolean)).size;

    return {
      totalItens: itensParaArvore.length,
      qtdTotal,
      vencidos,
      criticos,
      atencao,
      noPrazo,
      industriasUnicas,
      produtosUnicos,
      lojasUnicas,
    };
  }, [itensParaArvore]);

  // Construção recursiva da árvore hierárquica dinâmica
  const arvore = useMemo(() => {
    const extrairValor = (item: ItemValidade, nivel: NivelHierarquia): string => {
      switch (nivel) {
        case 'loja':
          return item.loja ? item.loja.trim() : 'Loja Não Especificada';
        case 'industria':
          return item.industria ? item.industria.trim() : 'Indústria Não Informada';
        case 'produto':
          return item.produto ? item.produto.trim() : 'Produto Não Especificado';
        case 'coordenador':
          return item.coordenador ? item.coordenador.trim() : 'Sem Coordenador';
        case 'estado':
          return item.estado ? item.estado.trim().toUpperCase() : 'Sem UF';
        default:
          return 'Outro';
      }
    };

    const construirNos = (
      itensDoGrupo: ItemValidade[],
      nivelIndex: number,
      prefixoChave: string
    ): TreeNode[] => {
      if (nivelIndex >= hierarquia.length) {
        return [];
      }

      const nivelAtual = hierarquia[nivelIndex];
      const grupos: Record<string, ItemValidade[]> = {};

      for (const item of itensDoGrupo) {
        const val = extrairValor(item, nivelAtual);
        if (!grupos[val]) grupos[val] = [];
        grupos[val].push(item);
      }

      let chavesOrdenadas = Object.keys(grupos);

      // Aplica ordenação em nível de agrupamento se coluna estiver ativa
      if (colunaOrdenacao && direcaoOrdenacao) {
        chavesOrdenadas.sort((a, b) => {
          const itensA = grupos[a];
          const itensB = grupos[b];
          let diff = 0;

          if (colunaOrdenacao === 'quantidade') {
            const sumA = itensA.reduce((acc, it) => acc + Number(it.quantidade || 0), 0);
            const sumB = itensB.reduce((acc, it) => acc + Number(it.quantidade || 0), 0);
            diff = sumA - sumB;
          } else if (colunaOrdenacao === 'data_vencimento' || colunaOrdenacao === 'dias_vencer') {
            const minDiasA = Math.min(...itensA.map((it) => calcularDiasRestantes(it.data_vencimento)));
            const minDiasB = Math.min(...itensB.map((it) => calcularDiasRestantes(it.data_vencimento)));
            diff = minDiasA - minDiasB;
          } else {
            diff = a.localeCompare(b, undefined, { numeric: true });
          }

          return direcaoOrdenacao === 'asc' ? diff : -diff;
        });
      } else {
        chavesOrdenadas.sort((a, b) => a.localeCompare(b));
      }

      return chavesOrdenadas.map((val) => {
        let itensFilhos = grupos[val];
        if (colunaOrdenacao && direcaoOrdenacao) {
          itensFilhos = [...itensFilhos].sort(compararValores);
        }

        const chaveNo = `${prefixoChave}::${nivelAtual}::${val}`;
        let totalQtd = 0;
        let vencidos = 0;
        let criticos = 0;
        let atencao = 0;
        let proximaDataVencimento: string | undefined = undefined;
        let menorDiasParaVencer: number | undefined = undefined;

        itensFilhos.forEach((it) => {
          totalQtd += Number(it.quantidade || 0);
          const dias = calcularDiasRestantes(it.data_vencimento);
          if (dias < 0) vencidos++;
          else if (dias <= 7) criticos++;
          else if (dias <= 30) atencao++;

          if (menorDiasParaVencer === undefined || dias < menorDiasParaVencer) {
            menorDiasParaVencer = dias;
            proximaDataVencimento = it.data_vencimento;
          }
        });

        const temProximoNivel = nivelIndex + 1 < hierarquia.length;
        const subFilhos = temProximoNivel
          ? construirNos(itensFilhos, nivelIndex + 1, chaveNo)
          : undefined;

        return {
          key: chaveNo,
          nivel: nivelAtual,
          valor: val,
          items: itensFilhos,
          children: subFilhos,
          totalItens: itensFilhos.length,
          totalQtd,
          vencidos,
          criticos,
          atencao,
          proximaDataVencimento,
          menorDiasParaVencer,
        };
      });
    };

    return construirNos(itensParaArvore, 0, 'root');
  }, [itensParaArvore, hierarquia, colunaOrdenacao, direcaoOrdenacao]);

  // Expandir / Recolher Tudo
  const expandirTudo = () => {
    const todas = new Set<string>();
    const percorrer = (nos: TreeNode[]) => {
      nos.forEach((n) => {
        todas.add(n.key);
        if (n.children) percorrer(n.children);
      });
    };
    percorrer(arvore);
    setExpandedKeys(todas);
  };

  const recolherTudo = () => {
    setExpandedKeys(new Set());
  };

  const toggleExpand = (chave: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) {
        next.delete(chave);
      } else {
        next.add(chave);
      }
      return next;
    });
  };

  // Edição inline
  const handleStartEdit = (item: ItemValidade) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.produto?.trim()) return;
    const itemOriginal = items.find((i) => i.id === editingId);
    if (!itemOriginal) return;

    await onUpdate({
      ...itemOriginal,
      ...editForm,
      quantidade: Number(editForm.quantidade || 1),
    } as ItemValidade);

    setEditingId(null);
    setEditForm({});
  };

  const handleMudarQuantidade = async (item: ItemValidade, delta: number) => {
    const novaQtd = Math.max(0, Number(item.quantidade) + delta);
    if (novaQtd === 0) {
      if (!confirm(`A quantidade de "${item.produto}" chegou a 0. Deseja excluir este item?`)) {
        return;
      }
    }
    await onUpdate({
      ...item,
      quantidade: novaQtd,
    });
  };

  const getLogo = (tipo: NivelHierarquia, valor: string) => {
    const limpo = valor.toLowerCase().trim();
    const slug = limpo.replace(/[^a-z0-9]/g, '_');
    if (tipo === 'industria') {
      return industryLogos[limpo]?.logoUrl || industryLogos[slug]?.logoUrl;
    }
    if (tipo === 'loja') {
      return storeLogos[limpo]?.logoUrl || storeLogos[slug]?.logoUrl;
    }
    if (tipo === 'coordenador') {
      return coordinatorLogos[limpo]?.logoUrl || coordinatorLogos[slug]?.logoUrl;
    }
    return undefined;
  };

  // Renderizador de Célula de Linha de Nó Desktop por coluna dinâmica
  const renderCellNode = (colId: string, node: TreeNode, depth: number) => {
    const isExpanded = expandedKeys.has(node.key);
    const configNivel = ROTULOS_NIVEL[node.nivel as NivelHierarquia] || ROTULOS_NIVEL.loja;
    const Icone = configNivel.icone;
    const logoUrl = getLogo(node.nivel, node.valor);
    const badgeDias = node.menorDiasParaVencer !== undefined ? obterBadgeDias(node.menorDiasParaVencer) : null;

    switch (colId) {
      case 'estrutura':
        return (
          <div
            className="flex items-center gap-2"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.key);
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-blue-700 hover:bg-white transition shadow-2xs shrink-0"
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-blue-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {logoUrl ? (
              <div className="w-6 h-6 rounded bg-white p-0.5 border border-slate-200 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
                <img src={logoUrl} alt={node.valor} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className={`p-1 rounded shrink-0 border ${configNivel.bg} ${configNivel.cor}`}>
                <Icone className="w-3.5 h-3.5" />
              </div>
            )}

            <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
              <span className="font-bold text-[11px] sm:text-xs text-slate-900 break-words leading-tight">
                {node.valor}
              </span>
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border shrink-0 ${configNivel.badge}`}>
                {configNivel.nome}
              </span>
              <span className="text-[10px] text-slate-500 font-mono bg-white px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                {node.totalItens} {node.totalItens === 1 ? 'item' : 'itens'}
              </span>
            </div>
          </div>
        );

      case 'industria':
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {node.nivel === 'industria' ? (
              <span className="font-bold text-purple-950 flex items-center gap-1 text-[11px] break-words leading-tight">
                <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                {node.valor}
              </span>
            ) : (
              <span className="text-slate-600 font-medium text-[11px] break-words leading-tight">{node.items[0]?.industria || '-'}</span>
            )}
          </div>
        );

      case 'loja':
        return (
          <div className="break-words leading-tight">
            {node.nivel === 'loja' ? (
              <span className="font-bold text-blue-950 flex items-center gap-1 text-[11px] break-words leading-tight">
                <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                {node.valor}
              </span>
            ) : (
              <span className="text-slate-600 font-medium text-[11px]">
                {new Set(node.items.map((i) => i.loja)).size} loja(s)
              </span>
            )}
          </div>
        );

      case 'sku':
        return (
          <div className="break-words leading-tight">
            {node.nivel === 'produto' ? (
              <span className="font-bold text-emerald-950 flex items-center gap-1 text-[11px] break-words leading-tight">
                <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                {node.valor}
              </span>
            ) : (
              <span className="text-slate-600 font-medium text-[11px]">
                {new Set(node.items.map((i) => i.produto)).size} SKU(s)
              </span>
            )}
          </div>
        );

      case 'quantidade':
        return (
          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono font-black text-xs">
            <Package className="w-3 h-3 text-blue-600" />
            {node.totalQtd} un
          </span>
        );

      case 'data_vencimento':
        return node.proximaDataVencimento ? (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
            <Calendar className="w-3 h-3 text-slate-500" />
            {formatarDataBR(node.proximaDataVencimento)}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        );

      case 'dias_vencer':
        return badgeDias ? (
          (() => {
            const IconeDias = badgeDias.icone;
            return (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${badgeDias.classe}`}>
                <IconeDias className="w-3 h-3 shrink-0" />
                <span>{badgeDias.texto}</span>
              </span>
            );
          })()
        ) : (
          <span className="text-slate-400">-</span>
        );

      case 'situacao':
        return (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {node.vencidos > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-800 text-[10px] font-bold border border-red-200">
                {node.vencidos} Venc
              </span>
            )}
            {node.criticos > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                {node.criticos} Crít
              </span>
            )}
            {node.atencao > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-yellow-50 text-yellow-800 text-[10px] font-semibold border border-yellow-200">
                {node.atencao} Aten
              </span>
            )}
            {node.vencidos === 0 && node.criticos === 0 && node.atencao === 0 && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                100% Ok
              </span>
            )}
          </div>
        );

      case 'data_cadastro':
      case 'dias_cadastro':
        return <span className="text-slate-400 text-xs">-</span>;

      case 'acoes':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.key);
            }}
            className="px-2 py-0.5 text-[11px] font-bold text-blue-700 bg-white hover:bg-blue-50 rounded border border-blue-200"
          >
            {isExpanded ? 'Recolher' : 'Abrir'}
          </button>
        );

      default:
        return null;
    }
  };

  // Renderizador de Célula de Linha de Item Desktop por coluna dinâmica
  const renderCellItem = (colId: string, prod: ItemValidade, depth: number) => {
    const dias = calcularDiasRestantes(prod.data_vencimento);
    const statusObj = obterStatusValidade(dias);
    const badgeDias = obterBadgeDias(dias);
    const IconeDias = badgeDias.icone;

    switch (colId) {
      case 'estrutura':
        return (
          <div
            className="flex items-center gap-1.5 text-slate-400"
            style={{ paddingLeft: `${depth * 18 + 6}px` }}
          >
            <span className="font-mono text-slate-300 select-none text-[10px]">└──</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-700 break-words leading-tight">
              {prod.produto}
            </span>
          </div>
        );

      case 'industria':
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {getLogo('industria', prod.industria) ? (
              <img
                src={getLogo('industria', prod.industria)}
                alt={prod.industria}
                className="w-3.5 h-3.5 object-contain rounded shrink-0"
              />
            ) : (
              <Building2 className="w-3 h-3 text-purple-600 shrink-0" />
            )}
            <span className="font-semibold text-slate-800 text-[11px] break-words leading-tight">{prod.industria || '-'}</span>
          </div>
        );

      case 'loja':
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Store className="w-3 h-3 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-800 text-[11px] break-words leading-tight">{prod.loja || 'Loja Principal'}</span>
            {prod.estado && (
              <span className="px-1 py-0.2 rounded bg-amber-50 text-amber-800 font-mono text-[9px] font-bold border border-amber-200 shrink-0">
                {prod.estado}
              </span>
            )}
          </div>
        );

      case 'sku':
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-slate-900 text-[11px] break-words leading-tight">{prod.produto}</span>
            {prod.codigo && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[9px] font-bold border border-slate-200 w-fit shrink-0">
                <Barcode className="w-2.5 h-2.5 text-slate-500" />
                {prod.codigo}
              </span>
            )}
          </div>
        );

      case 'quantidade':
        return (
          <div className="inline-flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => handleMudarQuantidade(prod, -1)}
              className="w-4.5 h-4.5 rounded bg-white shadow-2xs flex items-center justify-center text-slate-700 hover:text-red-600 cursor-pointer"
              title="Diminuir"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
            <span className="font-mono font-bold text-slate-900 px-1.5 min-w-[24px] text-center text-xs">
              {prod.quantidade}
            </span>
            <button
              type="button"
              onClick={() => handleMudarQuantidade(prod, +1)}
              className="w-4.5 h-4.5 rounded bg-white shadow-2xs flex items-center justify-center text-slate-700 hover:text-emerald-600 cursor-pointer"
              title="Aumentar"
            >
              <Plus className="w-2.5 h-2.5" />
            </button>
            <span className="text-[9px] text-slate-500 font-medium px-0.5">
              {prod.unidade || 'un'}
            </span>
          </div>
        );

      case 'data_vencimento':
        return (
          <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            <Calendar className="w-3 h-3 text-blue-600" />
            {formatarDataBR(prod.data_vencimento)}
          </span>
        );

      case 'dias_vencer':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${badgeDias.classe}`}>
            <IconeDias className="w-3 h-3 shrink-0" />
            <span>{badgeDias.textoLongo}</span>
          </span>
        );

      case 'situacao':
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusObj.badgeClass}`}>
            {statusObj.rotulo}
          </span>
        );

      case 'data_cadastro': {
        const infoCad = calcularDiasDesdeAdicao(prod.created_at);
        return (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            <CalendarClock className="w-3 h-3 text-slate-400" />
            {infoCad.dataFormatada}
          </span>
        );
      }

      case 'dias_cadastro': {
        const infoCad = calcularDiasDesdeAdicao(prod.created_at);
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <History className="w-3 h-3 text-slate-400" />
            {infoCad.rotulo}
          </span>
        );
      }

      case 'acoes':
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => handleStartEdit(prod)}
              className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition cursor-pointer"
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remover "${prod.produto}" do controle?`)) {
                  onDelete(prod.id);
                }
              }}
              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition cursor-pointer"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // Renderizador de Nó Desktop
  const renderSpreadsheetNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isExpanded = expandedKeys.has(node.key);
    const temFilhos = node.children && node.children.length > 0;
    const bgLinha =
      depth === 0
        ? 'bg-slate-100/95 hover:bg-slate-200/70 border-t-2 border-slate-300 font-bold'
        : depth === 1
        ? 'bg-slate-50/85 hover:bg-slate-100/80 border-t border-slate-200 font-semibold'
        : 'bg-white hover:bg-blue-50/40 border-t border-slate-100';

    return (
      <React.Fragment key={node.key}>
        <tr
          onClick={() => toggleExpand(node.key)}
          className={`cursor-pointer select-none transition-colors duration-100 text-xs text-slate-800 ${bgLinha}`}
        >
          {ordemColunas.map((colId) => {
            const colDef = COLUNAS_BASE.find((c) => c.id === colId);
            const largura = largurasColunas[colId] || colDef?.larguraPadrao || 120;
            const alinhamentoClass =
              colDef?.alinhamento === 'center'
                ? 'text-center'
                : colDef?.alinhamento === 'right'
                ? 'text-right'
                : 'text-left';

            const isTextCol = ['estrutura', 'sku', 'loja', 'industria'].includes(colId);

            return (
              <td
                key={colId}
                className={`py-2 px-2.5 border-r border-slate-200 ${
                  isTextCol ? 'whitespace-normal break-words leading-tight text-[11px]' : 'whitespace-nowrap text-xs'
                } ${alinhamentoClass}`}
                style={{ width: `${largura}px`, maxWidth: `${largura}px` }}
              >
                {renderCellNode(colId, node, depth)}
              </td>
            );
          })}
        </tr>

        {isExpanded && temFilhos && node.children!.map((child) => renderSpreadsheetNode(child, depth + 1))}
        {isExpanded && !temFilhos && node.items.map((prod) => renderSpreadsheetItem(prod, depth + 1))}
      </React.Fragment>
    );
  };

  // Renderizador de Item Desktop
  const renderSpreadsheetItem = (prod: ItemValidade, depth: number): React.ReactNode => {
    const isEditing = editingId === prod.id;

    if (isEditing) {
      return (
        <tr key={prod.id} className="bg-blue-50/90 border-y-2 border-blue-400 text-xs">
          {ordemColunas.map((colId) => {
            const largura = largurasColunas[colId] || 120;
            return (
              <td
                key={colId}
                className="py-2 px-2 border-r border-blue-200"
                style={{ width: `${largura}px`, maxWidth: `${largura}px` }}
              >
                {colId === 'estrutura' ? (
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    Editando...
                  </span>
                ) : colId === 'industria' ? (
                  <input
                    type="text"
                    value={editForm.industria || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, industria: e.target.value }))}
                    className="w-full h-8 px-2 bg-white border border-blue-300 rounded text-xs"
                    placeholder="Indústria"
                  />
                ) : colId === 'loja' ? (
                  <input
                    type="text"
                    value={editForm.loja || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, loja: e.target.value }))}
                    className="w-full h-8 px-2 bg-white border border-blue-300 rounded text-xs"
                    placeholder="Loja"
                  />
                ) : colId === 'sku' ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={editForm.produto || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, produto: e.target.value }))}
                      className="w-full h-8 px-2 bg-white border border-blue-300 rounded text-xs font-bold"
                      placeholder="Produto"
                    />
                    <input
                      type="text"
                      value={editForm.codigo || ''}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, codigo: e.target.value }))}
                      className="w-full h-6 px-1.5 bg-white border border-blue-200 rounded text-[10px] font-mono"
                      placeholder="SKU"
                    />
                  </div>
                ) : colId === 'quantidade' ? (
                  <input
                    type="number"
                    min="1"
                    value={editForm.quantidade ?? ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, quantidade: Number(e.target.value) }))}
                    className="w-full h-8 px-1 text-center bg-white border border-blue-300 rounded font-mono font-bold"
                  />
                ) : colId === 'data_vencimento' ? (
                  <input
                    type="date"
                    value={editForm.data_vencimento || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, data_vencimento: e.target.value }))}
                    className="w-full h-8 px-1 text-xs bg-white border border-blue-300 rounded font-mono"
                  />
                ) : colId === 'acoes' ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">-</span>
                )}
              </td>
            );
          })}
        </tr>
      );
    }

    return (
      <tr
        key={prod.id}
        className="hover:bg-amber-50/40 border-b border-slate-100 text-xs text-slate-700 transition-colors"
      >
        {ordemColunas.map((colId) => {
          const colDef = COLUNAS_BASE.find((c) => c.id === colId);
          const largura = largurasColunas[colId] || colDef?.larguraPadrao || 120;
          const alinhamentoClass =
            colDef?.alinhamento === 'center'
              ? 'text-center'
              : colDef?.alinhamento === 'right'
              ? 'text-right'
              : 'text-left';

          const isTextCol = ['estrutura', 'sku', 'loja', 'industria'].includes(colId);

          return (
            <td
              key={colId}
              className={`py-2 px-2.5 border-r border-slate-200 ${
                isTextCol ? 'whitespace-normal break-words leading-tight text-[11px]' : 'whitespace-nowrap text-xs'
              } ${alinhamentoClass}`}
              style={{ width: `${largura}px`, maxWidth: `${largura}px` }}
            >
              {renderCellItem(colId, prod, depth)}
            </td>
          );
        })}
      </tr>
    );
  };

  // 7. FORMATO CELULAR / MOBILE SIMPLIFICADO
  // Requisitado: mostrar os dados mais simples na versão mobile, mantendo a visão hierárquica.
  // Visualização de itens: só descrição (Nome/SKU) e status ("Vencido", "Crítico", "No prazo").

  const renderMobileItemSimples = (prod: ItemValidade): React.ReactNode => {
    const isEditing = editingId === prod.id;
    const isExpanded = itemExpandidoId === prod.id;
    const statusObj = obterStatusSimples(prod.data_vencimento);
    const IconeStatus = statusObj.icone;

    if (isEditing) {
      return (
        <div key={`edit_${prod.id}`} className="p-3 bg-blue-50/95 rounded-xl border-2 border-blue-400 shadow-sm space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-blue-900 text-xs">
            <span>Editar #{prod.codigo || prod.produto}</span>
            <span className="text-[10px] font-mono text-blue-700">Edição Rápida</span>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Descrição do Produto</label>
            <input
              type="text"
              value={editForm.produto || ''}
              onChange={(e) => setEditForm((p) => ({ ...p, produto: e.target.value }))}
              className="w-full h-8 px-2 bg-white border border-blue-300 rounded text-xs font-semibold"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">SKU / Código</label>
              <input
                type="text"
                value={editForm.codigo || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, codigo: e.target.value }))}
                className="w-full h-8 px-2 bg-white border border-blue-300 rounded text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Quantidade</label>
              <input
                type="number"
                min="1"
                value={editForm.quantidade ?? ''}
                onChange={(e) => setEditForm((p) => ({ ...p, quantidade: Number(e.target.value) }))}
                className="w-full h-8 px-2 text-center bg-white border border-blue-300 rounded text-xs font-mono font-bold"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Data de Vencimento</label>
            <input
              type="date"
              value={editForm.data_vencimento || ''}
              onChange={(e) => setEditForm((p) => ({ ...p, data_vencimento: e.target.value }))}
              className="w-full h-8 px-2 bg-white border border-blue-300 rounded text-xs font-mono"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-200">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-xs cursor-pointer hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs cursor-pointer"
            >
              Salvar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={`item_${prod.id}`}
        className="p-2 sm:p-2.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 shadow-2xs transition"
      >
        {/* LINHA PRINCIPAL: SÓ DESCRIÇÃO E STATUS */}
        <div
          onClick={() => setItemExpandidoId((prev) => (prev === prod.id ? null : prod.id))}
          className="flex items-start justify-between gap-2 cursor-pointer select-none"
        >
          {/* DESCRIÇÃO DO PRODUTO */}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[11px] sm:text-xs text-slate-900 leading-snug break-words" title={prod.produto}>
              {prod.produto}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              {prod.codigo && (
                <span className="text-[10px] font-mono text-slate-500">
                  SKU: <span className="font-semibold text-slate-700">{prod.codigo}</span>
                </span>
              )}
              {prod.loja && hierarquia[0] !== 'loja' && (
                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 break-words leading-tight">
                  {prod.loja}
                </span>
              )}
            </div>
          </div>

          {/* STATUS: "Vencido" | "Crítico" | "No prazo" */}
          <div className="shrink-0 flex items-center gap-1.5 pt-0.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${statusObj.classe}`}
            >
              <IconeStatus className="w-3 h-3 shrink-0" />
              <span>{statusObj.texto}</span>
            </span>
          </div>
        </div>

        {/* DETALHES ADICIONAIS AO TOCAR (OPCIONAL/DISCRETO) */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/70 -mx-2.5 -mb-2.5 p-2 rounded-b-lg">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Qtd: <strong className="font-mono text-slate-900">{prod.quantidade} un</strong>
              </span>
              <span>
                Vencimento: <strong className="font-mono text-slate-900">{formatarDataBR(prod.data_vencimento)}</strong>
              </span>
              <span>
                Cadastrado: <strong className="font-mono text-slate-900">{calcularDiasDesdeAdicao(prod.created_at).dataFormatada}</strong> ({calcularDiasDesdeAdicao(prod.created_at).rotulo})
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartEdit(prod);
                }}
                className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-white transition cursor-pointer"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remover "${prod.produto}" do controle?`)) {
                    onDelete(prod.id);
                  }
                }}
                className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-white transition cursor-pointer"
                title="Excluir"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // NÓ HIERÁRQUICO MOBILE (ACCORDION NATIVO, LIMPO E SEM CONFUSÃO)
  const renderMobileNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isExpanded = expandedKeys.has(node.key);
    const temFilhos = node.children && node.children.length > 0;
    const configNivel = ROTULOS_NIVEL[node.nivel as NivelHierarquia] || ROTULOS_NIVEL.loja;
    const IconeNivel = configNivel.icone;
    const logoUrl = getLogo(node.nivel, node.valor);

    return (
      <div key={`mobile_${node.key}`} className="space-y-1.5">
        {/* Cabeçalho do Grupo */}
        <div
          onClick={() => toggleExpand(node.key)}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
            depth === 0
              ? 'bg-slate-100/90 border-slate-300 hover:bg-slate-200/80 shadow-2xs'
              : depth === 1
              ? 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
          style={{ marginLeft: `${depth * 8}px` }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.key);
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 shrink-0"
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-blue-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="w-5 h-5 object-contain rounded shrink-0 bg-white p-0.5 border border-slate-200"
              />
            ) : (
              <div className={`p-1 rounded shrink-0 border ${configNivel.bg} ${configNivel.cor}`}>
                <IconeNivel className="w-3.5 h-3.5" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[11px] sm:text-xs text-slate-900 break-words leading-tight">
                  {node.valor}
                </span>
                <span className="text-[10px] text-slate-500 font-mono bg-white px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                  {node.totalItens} {node.totalItens === 1 ? 'item' : 'itens'}
                </span>
              </div>
            </div>
          </div>

          {/* Resumo de Situação do Grupo */}
          <div className="shrink-0 flex items-center gap-1">
            {node.vencidos > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                {node.vencidos} Vencido{node.vencidos > 1 ? 's' : ''}
              </span>
            )}
            {node.criticos > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                {node.criticos} Crítico{node.criticos > 1 ? 's' : ''}
              </span>
            )}
            {node.vencidos === 0 && node.criticos === 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                No prazo
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo Expandido */}
        {isExpanded && (
          <div
            className="space-y-1.5 pl-2 border-l-2 border-blue-200"
            style={{ marginLeft: `${depth * 8 + 10}px` }}
          >
            {temFilhos && node.children!.map((child) => renderMobileNode(child, depth + 1))}
            {!temFilhos && node.items.map((prod) => renderMobileItemSimples(prod))}
          </div>
        )}
      </div>
    );
  };

  // 7.3 CONTÊINER PRINCIPAL MOBILE
  const renderMobileContainer = (isForced: boolean) => (
    <div className={`space-y-3 ${!isForced ? 'block sm:hidden' : ''}`}>
      {/* 4 PRESETS DE HIERARQUIA SOLICITADOS (ACESSÍVEIS NO TOPO DO MOBILE) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Hierarquia:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={expandirTudo}
              className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
            >
              Expandir Tudo
            </button>
            <button
              type="button"
              onClick={recolherTudo}
              className="px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
            >
              Recolher
            </button>
            {isForced && (
              <button
                type="button"
                onClick={() => setForcarVisualizacaoMobile(false)}
                className="text-[10px] text-indigo-600 font-bold hover:underline ml-1 cursor-pointer"
              >
                Voltar p/ Completo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS_HIERARQUIA.map((preset) => {
            const isAtivo = hierarquia.join('/') === preset.niveis.join('/');
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setHierarquia(preset.niveis)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 text-center cursor-pointer ${
                  isAtivo
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isAtivo && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁRVORE HIERÁRQUICA: SÓ DESCRIÇÃO E STATUS */}
      <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2">
        {arvore.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-semibold text-xs text-slate-700">Nenhum produto encontrado</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Tente ajustar os filtros ou cadastrar produtos.</p>
          </div>
        ) : (
          arvore.map((rootNode) => renderMobileNode(rootNode, 0))
        )}
      </div>

      {/* RODAPÉ RESUMO TOTALIZADOR */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs text-slate-700">
        <span className="font-semibold">
          Total: <strong>{resumoGeral.totalItens}</strong> itens (<strong>{resumoGeral.qtdTotal}</strong> un)
        </span>
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          {resumoGeral.vencidos > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
              {resumoGeral.vencidos} Vencido{resumoGeral.vencidos > 1 ? 's' : ''}
            </span>
          )}
          {resumoGeral.criticos > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
              {resumoGeral.criticos} Crítico{resumoGeral.criticos > 1 ? 's' : ''}
            </span>
          )}
          {resumoGeral.vencidos === 0 && resumoGeral.criticos === 0 && (
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              100% no prazo
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR: CONTROLES DE PLANILHA, HIERARQUIA E EXPORTAÇÃO */}
      <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* 4 Opções de Hierarquia Rápidas */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Hierarquia:</span>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
            {PRESETS_HIERARQUIA.map((preset) => {
              const isAtivo = hierarquia.join('/') === preset.niveis.join('/');
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setHierarquia(preset.niveis)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    isAtivo
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-blue-700'
                  }`}
                  title={`Agrupar por: ${preset.labelCurto}`}
                >
                  {isAtivo && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Alternadores e Botões de Controle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor Formato Normal vs Forçar Celular/Mobile */}
          <button
            type="button"
            onClick={() => setForcarVisualizacaoMobile((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg border transition cursor-pointer ${
              forcarVisualizacaoMobile
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Alternar entre Formato Normal e Visão Celular Simplificada"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{forcarVisualizacaoMobile ? 'Modo Celular Ativo' : 'Visão Celular'}</span>
          </button>

          {/* Alternador Planilha / Pastas */}
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setModoExibicao('planilha')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                modoExibicao === 'planilha' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Planilha</span>
            </button>
            <button
              type="button"
              onClick={() => setModoExibicao('pastas')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                modoExibicao === 'pastas' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />
              <span>Pastas</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMostrarPainelPrecedencia((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              mostrarPainelPrecedencia ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Configurar Ordem</span>
          </button>

          <button
            type="button"
            onClick={resetarColunas}
            className="h-8 px-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Resetar larguras e ordem das colunas ao padrão"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Resetar Colunas</span>
          </button>

          <button
            type="button"
            onClick={expandirTudo}
            className="h-8 px-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Expandir todas as pastas/linhas"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Expandir</span>
          </button>

          <button
            type="button"
            onClick={recolherTudo}
            className="h-8 px-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
            title="Recolher todas as pastas/linhas"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recolher</span>
          </button>

          <button
            type="button"
            onClick={() => exportarParaExcel(itensParaArvore)}
            className="h-8 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Exportar dados filtrados para Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* PAINEL DE CONFIGURAÇÃO DE PRECEDÊNCIA (SE ABERTO) */}
      {mostrarPainelPrecedencia && (
        <div className="p-4 bg-slate-50 rounded-xl border border-blue-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Configurar Precedência da Hierarquia
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setMostrarPainelPrecedencia(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Níveis Ativos:</span>
              <div className="space-y-1.5">
                {hierarquia.map((nivel, idx) => {
                  const cfg = ROTULOS_NIVEL[nivel];
                  const Icone = cfg.icone;
                  return (
                    <div
                      key={nivel}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <Icone className={`w-4 h-4 ${cfg.cor}`} />
                        <span className="font-semibold text-slate-800">{cfg.nome}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (idx === 0) return;
                            setHierarquia((prev) => {
                              const copy = [...prev];
                              const temp = copy[idx - 1];
                              copy[idx - 1] = copy[idx];
                              copy[idx] = temp;
                              return copy;
                            });
                          }}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                          title="Subir prioridade"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (idx === hierarquia.length - 1) return;
                            setHierarquia((prev) => {
                              const copy = [...prev];
                              const temp = copy[idx + 1];
                              copy[idx + 1] = copy[idx];
                              copy[idx] = temp;
                              return copy;
                            });
                          }}
                          disabled={idx === hierarquia.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                          title="Descer prioridade"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Atalhos da Hierarquia:</span>
              <div className="space-y-1.5">
                {PRESETS_HIERARQUIA.map((preset) => {
                  const isAtivo = hierarquia.join('/') === preset.niveis.join('/');
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setHierarquia(preset.niveis)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                        isAtivo
                          ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{preset.label}</div>
                      {isAtivo && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE FILTROS DINÂMICOS */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Busca Rápida */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-9 shadow-2xs">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={buscaRapida}
                onChange={(e) => setBuscaRapida(e.target.value)}
                placeholder="Buscar na planilha..."
                className="text-xs bg-transparent focus:outline-none font-medium text-slate-800 placeholder-slate-400 w-28 sm:w-40"
              />
              {buscaRapida && (
                <button type="button" onClick={() => setBuscaRapida('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filtro de Coordenador Requisitado */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={coordenadorFiltro}
                onChange={(e) => setCoordenadorFiltro(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[140px] truncate"
                title="Filtrar por Coordenador"
              >
                <option value="todos">Todos Coord. ({listaCoordenadores.length})</option>
                {listaCoordenadores.map((coord) => (
                  <option key={coord} value={coord}>
                    {coord}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Indústria */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <select
                value={industriaFiltro}
                onChange={(e) => setIndustriaFiltro(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[130px] truncate"
                title="Filtrar por Indústria"
              >
                <option value="todas">Todas Indústrias ({listaIndustrias.length})</option>
                {listaIndustrias.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Loja */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={lojaFiltro}
                onChange={(e) => setLojaFiltro(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[130px] truncate"
                title="Filtrar por Loja"
              >
                <option value="todas">Todas Lojas ({lojasFiltradas.length})</option>
                {lojasFiltradas.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro SKU */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Barcode className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                value={skuFiltro}
                onChange={(e) => setSkuFiltro(e.target.value)}
                className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[130px] truncate"
                title="Filtrar por SKU"
              >
                <option value="todos">Todos SKU ({opcoesSku.length})</option>
                {opcoesSku.map((p) => (
                  <option key={p.key} value={p.codigo}>
                    {p.codigo} - {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {temFiltroAtivo && (
            <button
              type="button"
              onClick={limparTodosFiltros}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 cursor-pointer transition shadow-2xs"
              title="Limpar todos os filtros ativos"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* FILTRO DE STATUS DE VENCIMENTO EM CAIXINHA DE SELEÇÃO (MULTI-SELECT) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Status de Vencimento:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Caixinha: Vencido */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-white border-slate-200 hover:border-red-300 hover:bg-red-50/40 cursor-pointer transition select-none shadow-2xs">
              <input
                type="checkbox"
                checked={statusSelecionados.has('vencido')}
                onChange={() => alternarStatusFiltro('vencido')}
                className="w-3.5 h-3.5 rounded text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
              />
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                <XCircle className="w-2.5 h-2.5 text-red-600 shrink-0" />
                Vencido
              </span>
            </label>

            {/* Caixinha: Crítico */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 cursor-pointer transition select-none shadow-2xs">
              <input
                type="checkbox"
                checked={statusSelecionados.has('critico')}
                onChange={() => alternarStatusFiltro('critico')}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
              />
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                Crítico (até 7d)
              </span>
            </label>

            {/* Caixinha: No Prazo */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 cursor-pointer transition select-none shadow-2xs">
              <input
                type="checkbox"
                checked={statusSelecionados.has('no_prazo')}
                onChange={() => alternarStatusFiltro('no_prazo')}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
              />
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                No prazo (&gt; 7d)
              </span>
            </label>

            {/* Botão Selecionar Todos os Status quando algum estiver desmarcado */}
            {statusSelecionados.size < 3 && (
              <button
                type="button"
                onClick={selecionarTodosStatus}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline ml-1 cursor-pointer"
                title="Marcar todas as opções de status"
              >
                Selecionar Todos
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BARRA DE DICA DE MOVIMENTAÇÃO DE COLUNAS E AJUSTE DE LARGURA */}
      <div className="hidden sm:flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <MoveHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <strong>Ajustar Tamanho:</strong> Arraste a borda direita de qualquer coluna.
          </span>
          <span className="flex items-center gap-1">
            <GripVertical className="w-3.5 h-3.5 text-purple-600" />
            <strong>Mover Colunas:</strong> Arraste o cabeçalho ou use as setas [←] [→].
          </span>
          <span className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600" />
            <strong>Filtrar Menor/Maior:</strong> Clique no título da coluna.
          </span>
        </div>
        {colunaOrdenacao && (
          <div className="flex items-center gap-1 text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            <span>Ordenado por: {COLUNAS_BASE.find((c) => c.id === colunaOrdenacao)?.rotulo}</span>
            <span>({direcaoOrdenacao === 'asc' ? 'Menor para Maior ↑' : 'Maior para Menor ↓'})</span>
            <button
              type="button"
              onClick={() => {
                setColunaOrdenacao(null);
                setDirecaoOrdenacao(null);
              }}
              className="ml-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ÁREA DA TABELA: VERSÃO CELULAR OU VERSÃO DESKTOP */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-xs font-semibold">Organizando linhas e colunas...</p>
        </div>
      ) : arvore.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="font-semibold text-sm text-slate-700">Nenhum produto cadastrado</div>
          <p className="text-xs text-slate-500 mt-1">
            {temFiltroAtivo ? 'Nenhum registro corresponde aos filtros.' : 'Cadastre produtos para visualizá-los na planilha.'}
          </p>
        </div>
      ) : forcarVisualizacaoMobile ? (
        renderMobileContainer(true)
      ) : (
        <>
          {renderMobileContainer(false)}

          {/* FORMATO DESKTOP / TABLET (hidden sm:block) COM MOVIMENTAÇÃO DE COLUNAS E AJUSTE DE LARGURA */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                {/* CABEÇALHO COM ARRASTO, REDIMENSIONAMENTO E ORDENAÇÃO */}
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold border-b-2 border-slate-300 select-none">
                  <tr>
                    {ordemColunas.map((colId, colIndex) => {
                      const colDef = COLUNAS_BASE.find((c) => c.id === colId);
                      if (!colDef) return null;
                      const IconeCol = colDef.icone;
                      const largura = largurasColunas[colId] || colDef.larguraPadrao;
                      const isSorted = colunaOrdenacao === colId;

                      return (
                        <th
                          key={colId}
                          draggable={colDef.podeMover}
                          onDragStart={() => setDraggedColId(colId)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedColId && draggedColId !== colId) {
                              moverColuna(draggedColId, colId);
                              setDraggedColId(null);
                            }
                          }}
                          className={`relative py-2.5 px-3 border-r border-slate-300 group transition-colors ${
                            isSorted ? 'bg-blue-50/80 text-blue-900' : 'hover:bg-slate-200/70'
                          }`}
                          style={{ width: `${largura}px`, minWidth: `${colDef.minLargura}px` }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            {/* Conteúdo Clicável para Ordenar Menor para Maior */}
                            <div
                              onClick={() => colDef.podeOrdenar && alternarOrdenacao(colId)}
                              className={`flex items-center gap-1.5 truncate flex-1 ${
                                colDef.podeOrdenar ? 'cursor-pointer hover:text-blue-700' : ''
                              }`}
                              title={
                                colDef.podeOrdenar
                                  ? `Clique para ordenar por ${colDef.rotulo} (${
                                      isSorted && direcaoOrdenacao === 'asc'
                                        ? 'Atualmente: Menor para Maior ↑. Clique para Maior para Menor ↓'
                                        : 'Menor para Maior ↑'
                                    })`
                                  : undefined
                              }
                            >
                              <IconeCol className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600 shrink-0" />
                              <span className="truncate">{colDef.rotulo}</span>

                              {/* Indicador de Ordenação Menor para Maior */}
                              {colDef.podeOrdenar && (
                                <div className="ml-1 inline-flex items-center shrink-0">
                                  {isSorted ? (
                                    direcaoOrdenacao === 'asc' ? (
                                      <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1 py-0.2 rounded" title="Menor para Maior">
                                        ↑ Menor
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1 py-0.2 rounded" title="Maior para Menor">
                                        ↓ Maior
                                      </span>
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Controles de Mover Coluna para Esquerda / Direita */}
                            {colDef.podeMover && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 bg-white/80 rounded px-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moverColunaParaEsquerda(colId);
                                  }}
                                  disabled={colIndex <= 1}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                                  title="Mover coluna para a esquerda"
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moverColunaParaDireita(colId);
                                  }}
                                  disabled={colIndex >= ordemColunas.length - 2}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                                  title="Mover coluna para a direita"
                                >
                                  →
                                </button>
                              </div>
                            )}
                          </div>

                          {/* ALÇA DE REDIMENSIONAMENTO DE COLUNA (RESIZE HANDLE) */}
                          <div
                            onMouseDown={(e) => iniciarRedimensionamento(colId, e)}
                            className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-blue-500/50 transition-colors z-20 flex items-center justify-center select-none"
                            title="Clique e arraste para redimensionar a largura desta coluna"
                          >
                            <div className="w-[1.5px] h-4 bg-slate-300 group-hover:bg-blue-600" />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* CORPO DA PLANILHA DESKTOP */}
                <tbody className="divide-y divide-slate-200">
                  {arvore.map((rootNode) => renderSpreadsheetNode(rootNode, 0))}
                </tbody>

                {/* RODAPÉ TOTALIZADOR */}
                <tfoot className="bg-slate-100 font-extrabold text-xs text-slate-800 border-t-2 border-slate-300">
                  <tr>
                    {ordemColunas.map((colId) => {
                      if (colId === 'estrutura') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300">
                            TOTAL ({arvore.length} grupos • {resumoGeral.totalItens} linhas)
                          </td>
                        );
                      }
                      if (colId === 'industria') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-purple-900">
                            {resumoGeral.industriasUnicas} indústrias
                          </td>
                        );
                      }
                      if (colId === 'loja') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-blue-900">
                            {resumoGeral.lojasUnicas} lojas
                          </td>
                        );
                      }
                      if (colId === 'sku') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-emerald-900">
                            {resumoGeral.produtosUnicos} produtos
                          </td>
                        );
                      }
                      if (colId === 'quantidade') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-center font-mono font-black text-blue-900 bg-blue-100/50">
                            {resumoGeral.qtdTotal} un
                          </td>
                        );
                      }
                      if (colId === 'data_vencimento') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-center text-slate-500 font-mono">
                            -
                          </td>
                        );
                      }
                      if (colId === 'dias_vencer') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-center">
                            {resumoGeral.vencidos > 0 ? (
                              <span className="text-red-700 font-bold">{resumoGeral.vencidos} vencidos</span>
                            ) : (
                              <span className="text-emerald-700 font-bold">100% no prazo</span>
                            )}
                          </td>
                        );
                      }
                      if (colId === 'situacao') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-center">
                            <span className="text-[11px] font-bold text-emerald-700">
                              {resumoGeral.noPrazo} em dia
                            </span>
                          </td>
                        );
                      }
                      if (colId === 'data_cadastro' || colId === 'dias_cadastro') {
                        return (
                          <td key={colId} className="py-3 px-3 border-r border-slate-300 text-center text-slate-400 font-mono text-xs">
                            -
                          </td>
                        );
                      }
                      return (
                        <td key={colId} className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => exportarParaExcel(itensParaArvore)}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-bold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
