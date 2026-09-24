import React, { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Minus,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Zap,
  Store,
  MapPin,
  UserCheck,
  PackagePlus,
  Send,
  Trash2,
  ListPlus,
  Sparkles,
  Barcode,
  Search,
} from 'lucide-react';
import { ItemValidade, ProdutoCatalogo } from '../types';

interface ItemPendente {
  idTemp: string;
  codigo?: string;
  produto: string;
  quantidade: number;
  unidade: string;
  data_vencimento: string;
  lote?: string;
  observacoes?: string;
}

interface QuickAddFormProps {
  onAdd: (item: Omit<ItemValidade, 'id' | 'created_at'>) => Promise<void>;
  onAddBatch?: (items: Array<Omit<ItemValidade, 'id' | 'created_at'>>) => Promise<void>;
  existingIndustries: string[];
  catalogoProdutosPorIndustria?: Record<string, string[]>;
  catalogoProdutosDetalhadosSupabase?: ProdutoCatalogo[];
  catalogoIndustriasSupabase?: string[];
  catalogoCoordenadoresSupabase?: string[];
  catalogoLojasSupabase?: Array<{ nome: string; estado?: string; coordenador?: string }>;
  allItems?: ItemValidade[];
  isSaving: boolean;
  prefilledProduct?: { produto: string; industria: string; codigo?: string; unidade?: string } | null;
}

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const QuickAddForm: React.FC<QuickAddFormProps> = ({
  onAdd,
  onAddBatch,
  existingIndustries,
  catalogoProdutosPorIndustria = {},
  catalogoProdutosDetalhadosSupabase = [],
  catalogoIndustriasSupabase = [],
  catalogoCoordenadoresSupabase = [],
  catalogoLojasSupabase = [],
  allItems = [],
  isSaving,
  prefilledProduct,
}) => {
  const [codigo, setCodigo] = useState('');
  const [loja, setLoja] = useState('');
  const [estado, setEstado] = useState('');
  const [coordenador, setCoordenador] = useState('');
  const [industria, setIndustria] = useState('');
  const [produto, setProduto] = useState('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [unidade, setUnidade] = useState('un');
  const [dataVencimento, setDataVencimento] = useState('');
  const [lote, setLote] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Lista de produtos adicionados para a mesma Loja / Indústria antes de finalizar e enviar
  const [produtosPendentes, setProdutosPendentes] = useState<ItemPendente[]>([]);

  const produtoInputRef = useRef<HTMLInputElement>(null);

  // Preenche dados quando um produto for selecionado a partir da aba "Produtos da Base"
  React.useEffect(() => {
    if (prefilledProduct) {
      setProduto(prefilledProduct.produto);
      if (prefilledProduct.industria && prefilledProduct.industria !== 'Geral') {
        setIndustria(prefilledProduct.industria);
      }
      if (prefilledProduct.codigo != null) {
        setCodigo(String(prefilledProduct.codigo));
      }
      if (prefilledProduct.unidade) {
        setUnidade(prefilledProduct.unidade);
      }
      // Rola a tela suavemente para o formulário
      const el = document.getElementById('form-inclusao-rapida');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [prefilledProduct]);

  // Lista única de coordenadores (Supabase + histórico de itens)
  const coordenadoresCadastrados = useMemo(() => {
    const set = new Set<string>();
    catalogoCoordenadoresSupabase.forEach((c) => {
      if (c?.trim()) set.add(c.trim());
    });
    catalogoLojasSupabase.forEach((l) => {
      if (l.coordenador?.trim()) set.add(l.coordenador.trim());
    });
    allItems.forEach((it) => {
      if (it.coordenador?.trim()) set.add(it.coordenador.trim());
    });

    // Se a base ainda estiver zerada, disponibiliza coordenadores padrão
    if (set.size === 0) {
      ['Carlos Silva', 'Mariana Santos', 'Roberto Souza', 'Fernanda Lima'].forEach((ex) => set.add(ex));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allItems, catalogoCoordenadoresSupabase, catalogoLojasSupabase]);

  // Lista de lojas cadastradas: filtradas dinamicamente pelo coordenador e estado selecionados
  const lojasCadastradas = useMemo(() => {
    const coordTrim = coordenador.trim().toLowerCase();
    const estTrim = estado.trim().toUpperCase();

    const mapLojas = new Map<string, { nome: string; estado?: string; coordenador?: string }>();

    catalogoLojasSupabase.forEach((l) => {
      if (l.nome?.trim()) {
        mapLojas.set(l.nome.trim(), {
          nome: l.nome.trim(),
          estado: l.estado?.trim(),
          coordenador: l.coordenador?.trim(),
        });
      }
    });

    allItems.forEach((it) => {
      if (it.loja?.trim()) {
        const nome = it.loja.trim();
        const existing = mapLojas.get(nome);
        mapLojas.set(nome, {
          nome,
          estado: it.estado?.trim() || existing?.estado,
          coordenador: it.coordenador?.trim() || existing?.coordenador,
        });
      }
    });

    if (mapLojas.size === 0) {
      [
        { nome: 'Loja Matriz', estado: 'SP', coordenador: 'Carlos Silva' },
        { nome: 'Loja Centro', estado: 'RJ', coordenador: 'Mariana Santos' },
        { nome: 'Loja Zona Sul', estado: 'MG', coordenador: 'Roberto Souza' },
        { nome: 'Hipermercado 01', estado: 'SP', coordenador: 'Carlos Silva' },
        { nome: 'Supermercado Modelo', estado: 'BA', coordenador: 'Fernanda Lima' },
      ].forEach((ex) => mapLojas.set(ex.nome, ex));
    }

    const todas = Array.from(mapLojas.values());

    // Se houver coordenador selecionado, prioriza ou filtra as lojas dele
    let resultado = todas;
    if (coordTrim) {
      const lojasDoCoord = todas.filter(
        (l) => l.coordenador?.trim().toLowerCase() === coordTrim
      );
      if (lojasDoCoord.length > 0) {
        resultado = lojasDoCoord;
      }
    }

    // Se houver estado selecionado, filtra por ele
    if (estTrim) {
      const lojasDoEstado = resultado.filter(
        (l) => (l.estado || '').trim().toUpperCase() === estTrim
      );
      if (lojasDoEstado.length > 0) {
        resultado = lojasDoEstado;
      }
    }

    return resultado.map((l) => l.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allItems, catalogoLojasSupabase, coordenador, estado]);

  // Ao selecionar uma loja, preenche automaticamente Estado e Coordenador correspondentes
  const handleMudarLoja = (nomeLoja: string) => {
    setLoja(nomeLoja);
    const trimmed = nomeLoja.trim().toLowerCase();
    if (!trimmed) return;

    // Procura na tabela dedicada de lojas
    const lojaEncontrada = catalogoLojasSupabase.find(
      (l) => l.nome.trim().toLowerCase() === trimmed
    );
    if (lojaEncontrada) {
      if (lojaEncontrada.estado) setEstado(lojaEncontrada.estado);
      if (lojaEncontrada.coordenador) setCoordenador(lojaEncontrada.coordenador);
      return;
    }

    // Procura na tabela validades
    const itemExistente = allItems.find(
      (it) => it.loja && it.loja.trim().toLowerCase() === trimmed
    );
    if (itemExistente) {
      if (itemExistente.estado) setEstado(itemExistente.estado);
      if (itemExistente.coordenador) setCoordenador(itemExistente.coordenador);
      return;
    }

    // Fallback padrão
    const fallbackStore = [
      { nome: 'Loja Matriz', estado: 'SP', coordenador: 'Carlos Silva' },
      { nome: 'Loja Centro', estado: 'RJ', coordenador: 'Mariana Santos' },
      { nome: 'Loja Zona Sul', estado: 'MG', coordenador: 'Roberto Souza' },
      { nome: 'Hipermercado 01', estado: 'SP', coordenador: 'Carlos Silva' },
      { nome: 'Supermercado Modelo', estado: 'BA', coordenador: 'Fernanda Lima' },
    ].find((ex) => ex.nome.toLowerCase() === trimmed);
    if (fallbackStore) {
      if (fallbackStore.estado) setEstado(fallbackStore.estado);
      if (fallbackStore.coordenador) setCoordenador(fallbackStore.coordenador);
    }
  };

  // Ao selecionar um coordenador, se a loja atual não pertencer a ele, reseta a loja
  const handleMudarCoordenador = (nomeCoord: string) => {
    setCoordenador(nomeCoord);
    const coordTrim = nomeCoord.trim().toLowerCase();
    if (!coordTrim) return;

    if (loja) {
      const lojaPertence =
        catalogoLojasSupabase.some(
          (l) =>
            l.nome.trim().toLowerCase() === loja.trim().toLowerCase() &&
            l.coordenador?.trim().toLowerCase() === coordTrim
        ) ||
        allItems.some(
          (it) =>
            it.loja?.trim().toLowerCase() === loja.trim().toLowerCase() &&
            it.coordenador?.trim().toLowerCase() === coordTrim
        ) ||
        [
          { nome: 'Loja Matriz', coordenador: 'Carlos Silva' },
          { nome: 'Loja Centro', coordenador: 'Mariana Santos' },
          { nome: 'Loja Zona Sul', coordenador: 'Roberto Souza' },
          { nome: 'Hipermercado 01', coordenador: 'Carlos Silva' },
          { nome: 'Supermercado Modelo', coordenador: 'Fernanda Lima' },
        ].some(
          (ex) =>
            ex.nome.toLowerCase() === loja.trim().toLowerCase() &&
            ex.coordenador.toLowerCase() === coordTrim
        );

      if (!lojaPertence) {
        setLoja('');
      }
    }
  };

  // Ao mudar o estado, se a loja atual não pertencer a ele, reseta a loja
  const handleMudarEstado = (novoEstado: string) => {
    setEstado(novoEstado);
    const estTrim = novoEstado.trim().toUpperCase();
    if (!estTrim) return;

    if (loja) {
      const lojaNoEstado =
        catalogoLojasSupabase.some(
          (l) =>
            l.nome.trim().toLowerCase() === loja.trim().toLowerCase() &&
            (l.estado || '').trim().toUpperCase() === estTrim
        ) ||
        allItems.some(
          (it) =>
            it.loja?.trim().toLowerCase() === loja.trim().toLowerCase() &&
            (it.estado || '').trim().toUpperCase() === estTrim
        );

      if (!lojaNoEstado) {
        setLoja('');
      }
    }
  };

  // Busca automática DINÂMICA quando o usuário digita ou apaga o código do produto
  const handleCodigoChange = (novoCodigo: string) => {
    setCodigo(novoCodigo);
    const codLimpo = novoCodigo.trim().toLowerCase();

    // Se o usuário apagar ou excluir o código, limpa imediatamente a descrição e a indústria
    if (!codLimpo) {
      setProduto('');
      setIndustria('');
      return;
    }

    let match: { nome: string; industria: string; unidade?: string } | null = null;

    // 1. Procura primeiro no catálogo relacional detalhado do Supabase
    if (catalogoProdutosDetalhadosSupabase && catalogoProdutosDetalhadosSupabase.length > 0) {
      const matchCatalogo = catalogoProdutosDetalhadosSupabase.find((p) => {
        const codP = (p.codigo != null ? String(p.codigo) : '').trim().toLowerCase();
        return codP && codP === codLimpo;
      });

      if (matchCatalogo) {
        match = {
          nome: matchCatalogo.nome,
          industria: matchCatalogo.industria,
          unidade: matchCatalogo.unidade_padrao,
        };
      }
    }

    // 2. Procura nos itens já salvos no Supabase (tabela validades)
    if (!match && allItems && allItems.length > 0) {
      const matchValidade = allItems.find((it) => {
        const codIt = (it.codigo != null ? String(it.codigo) : '').trim().toLowerCase();
        return codIt && codIt === codLimpo;
      });

      if (matchValidade) {
        match = {
          nome: matchValidade.produto,
          industria: matchValidade.industria,
          unidade: matchValidade.unidade,
        };
      }
    }

    if (match) {
      // Dinâmico: preenche SEMPRE a indústria correspondente e a descrição do produto!
      // Evita erros de digitar código de uma indústria e aparecer outra
      setProduto(match.nome);
      setIndustria(match.industria);
      if (match.unidade) {
        setUnidade(match.unidade);
      }
    } else {
      // Código alterado ou não encontrado: limpa descrição e indústria para não deixar resíduo
      setProduto('');
      setIndustria('');
    }
  };

  // Ao selecionar um produto pelo nome, preenche também o código e a indústria se existirem cadastrados
  const handleProdutoChange = (novoNomeProduto: string) => {
    setProduto(novoNomeProduto);
    const nomeLimpo = novoNomeProduto.trim().toLowerCase();
    if (!nomeLimpo) return;

    // 1. Busca no catálogo detalhado de produtos do Supabase
    if (catalogoProdutosDetalhadosSupabase && catalogoProdutosDetalhadosSupabase.length > 0) {
      const match = catalogoProdutosDetalhadosSupabase.find(
        (p) => p.nome.trim().toLowerCase() === nomeLimpo
      );
      if (match) {
        if (match.codigo && !codigo.trim()) setCodigo(String(match.codigo));
        if (match.industria && !industria.trim()) setIndustria(match.industria);
        if (match.unidade_padrao) setUnidade(match.unidade_padrao);
        return;
      }
    }

    // 2. Busca no mapeamento de catalogoProdutosPorIndustria
    if (!industria.trim()) {
      for (const [ind, prods] of Object.entries(catalogoProdutosPorIndustria)) {
        if (Array.isArray(prods) && prods.some((p) => p.trim().toLowerCase() === nomeLimpo)) {
          setIndustria(ind);
          break;
        }
      }
    }

    // 3. Busca em allItems
    const matchItem = allItems.find(
      (it) => it.produto.trim().toLowerCase() === nomeLimpo
    );
    if (matchItem) {
      if (matchItem.codigo && !codigo.trim()) setCodigo(String(matchItem.codigo));
      if (matchItem.industria && !industria.trim()) setIndustria(matchItem.industria);
      if (matchItem.unidade) setUnidade(matchItem.unidade);
    }
  };

  // Sugestões de códigos disponíveis no Supabase
  const sugestoesCodigos = useMemo(() => {
    const mapCodigos = new Map<string, string>(); // codigo -> descricao
    if (catalogoProdutosDetalhadosSupabase) {
      catalogoProdutosDetalhadosSupabase.forEach((p) => {
        const codStr = p.codigo != null ? String(p.codigo).trim() : '';
        if (codStr) {
          mapCodigos.set(codStr, `${codStr} - ${p.nome || ''} (${p.industria || ''})`);
        }
      });
    }
    allItems.forEach((it) => {
      const codStr = it.codigo != null ? String(it.codigo).trim() : '';
      if (codStr && !mapCodigos.has(codStr)) {
        mapCodigos.set(codStr, `${codStr} - ${it.produto || ''} (${it.industria || ''})`);
      }
    });
    return Array.from(mapCodigos.entries()).map(([cod, label]) => ({ codigo: cod, label }));
  }, [catalogoProdutosDetalhadosSupabase, allItems]);

  // Mostra estritamente as indústrias cadastradas no Supabase (tanto da tabela de validades, produtos quanto indústrias)
  const sugestoesIndustrias = useMemo(() => {
    const setInds = new Set<string>();

    catalogoIndustriasSupabase.forEach((i) => {
      if (i?.trim()) setInds.add(i.trim());
    });
    existingIndustries.forEach((i) => {
      if (i?.trim()) setInds.add(i.trim());
    });
    if (catalogoProdutosDetalhadosSupabase) {
      catalogoProdutosDetalhadosSupabase.forEach((p) => {
        if (p.industria?.trim()) setInds.add(p.industria.trim());
      });
    }
    Object.keys(catalogoProdutosPorIndustria).forEach((ind) => {
      if (ind?.trim()) setInds.add(ind.trim());
    });

    const combined = Array.from(setInds).sort((a, b) => a.localeCompare(b));

    if (!industria.trim()) return combined;
    return combined.filter((ind) =>
      ind.toLowerCase().includes(industria.toLowerCase())
    );
  }, [existingIndustries, catalogoIndustriasSupabase, catalogoProdutosDetalhadosSupabase, catalogoProdutosPorIndustria, industria]);

  // AUTOMÁTICO: Mostra os produtos cadastrados no Supabase filtrados pela indústria selecionada,
  // ou TODOS os produtos cadastrados no Supabase se nenhuma indústria foi escolhida ainda.
  const sugestoesProdutosPorIndustria = useMemo(() => {
    const setProds = new Set<string>();

    if (industria.trim()) {
      const indNormalizada = industria.trim().toLowerCase();

      // 1. Produtos já cadastrados no Supabase para esta indústria (na tabela validades)
      allItems.forEach((it) => {
        if (it.industria && it.industria.trim().toLowerCase() === indNormalizada && it.produto?.trim()) {
          setProds.add(it.produto.trim());
        }
      });

      // 2. Produtos vinculados no catálogo do Supabase (tabela produtos)
      if (Array.isArray(catalogoProdutosPorIndustria[indNormalizada])) {
        catalogoProdutosPorIndustria[indNormalizada].forEach((p) => {
          if (p?.trim()) setProds.add(p.trim());
        });
      } else {
        for (const [key, prods] of Object.entries(catalogoProdutosPorIndustria)) {
          if (key.trim().toLowerCase() === indNormalizada && Array.isArray(prods)) {
            (prods as string[]).forEach((p) => {
              if (p?.trim()) setProds.add(p.trim());
            });
          }
        }
      }

      // 3. Produtos detalhados com indústria correspondente
      if (catalogoProdutosDetalhadosSupabase) {
        catalogoProdutosDetalhadosSupabase.forEach((p) => {
          if (p.industria && p.industria.trim().toLowerCase() === indNormalizada && p.nome?.trim()) {
            setProds.add(p.nome.trim());
          }
        });
      }
    } else {
      // Se nenhuma indústria foi selecionada ainda, sugere todos os produtos cadastrados no catálogo do Supabase
      if (catalogoProdutosDetalhadosSupabase && catalogoProdutosDetalhadosSupabase.length > 0) {
        catalogoProdutosDetalhadosSupabase.forEach((p) => {
          if (p.nome?.trim()) setProds.add(p.nome.trim());
        });
      }

      // Adiciona também produtos de catalogoProdutosPorIndustria
      Object.values(catalogoProdutosPorIndustria).forEach((prods) => {
        if (Array.isArray(prods)) {
          prods.forEach((p) => {
            if (p?.trim()) setProds.add(p.trim());
          });
        }
      });

      // E produtos da tabela validades
      allItems.forEach((it) => {
        if (it.produto?.trim()) {
          setProds.add(it.produto.trim());
        }
      });
    }

    return Array.from(setProds).sort();
  }, [industria, allItems, catalogoProdutosPorIndustria, catalogoProdutosDetalhadosSupabase]);

  const aplicarDataAtalho = (diasAdicionais: number) => {
    const target = new Date();
    target.setDate(target.getDate() + diasAdicionais);
    setDataVencimento(target.toISOString().split('T')[0]);
  };

  const aplicarFimDoMes = () => {
    const now = new Date();
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDataVencimento(fimMes.toISOString().split('T')[0]);
  };

  const aplicarFimProximoMes = () => {
    const now = new Date();
    const fimProx = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    setDataVencimento(fimProx.toISOString().split('T')[0]);
  };

  // Adicionar produto atual à fila de produtos para envio conjunto
  const handleAdicionarFila = () => {
    if (!industria.trim() || !produto.trim() || !dataVencimento) return;

    const novoPendente: ItemPendente = {
      idTemp: 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      codigo: codigo.trim() || undefined,
      produto: produto.trim(),
      quantidade: Math.max(1, Number(quantidade) || 1),
      unidade: unidade || 'un',
      data_vencimento: dataVencimento,
      lote: lote.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
    };

    setProdutosPendentes((prev) => [...prev, novoPendente]);

    // Limpa campos do produto mantendo Loja, Estado, Coordenador e Indústria
    setCodigo('');
    setProduto('');
    setDataVencimento('');
    setLote('');
    setObservacoes('');
    setQuantidade(1);

    if (produtoInputRef.current) {
      produtoInputRef.current.focus();
    }
  };

  // Remove um item da fila temporária
  const handleRemoverItemFila = (idTemp: string) => {
    setProdutosPendentes((prev) => prev.filter((it) => it.idTemp !== idTemp));
  };

  // Finalizar e enviar todos os produtos acumulados (ou o produto atual)
  const handleFinalizarEEnviar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const dadosBase = {
      loja: loja.trim() || undefined,
      estado: estado.trim() || undefined,
      coordenador: coordenador.trim() || undefined,
      industria: industria.trim(),
    };

    // Caso haja produto preenchido nos campos no momento de clicar em finalizar, inclui também
    let itensParaEnviar: Array<Omit<ItemValidade, 'id' | 'created_at'>> = [
      ...produtosPendentes.map((p) => ({
        ...dadosBase,
        codigo: p.codigo != null && String(p.codigo).trim() ? String(p.codigo).trim() : undefined,
        produto: p.produto,
        quantidade: p.quantidade,
        unidade: p.unidade,
        data_vencimento: p.data_vencimento,
        lote: p.lote,
        observacoes: p.observacoes,
      })),
    ];

    if (produto.trim() && dataVencimento && industria.trim()) {
      itensParaEnviar.push({
        ...dadosBase,
        codigo: codigo.trim() || undefined,
        produto: produto.trim(),
        quantidade: Math.max(1, Number(quantidade) || 1),
        unidade: unidade || 'un',
        data_vencimento: dataVencimento,
        lote: lote.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      });
    }

    if (itensParaEnviar.length === 0) return;

    if (onAddBatch && itensParaEnviar.length > 1) {
      await onAddBatch(itensParaEnviar);
    } else {
      // Salva itens individualmente se não houver handler em lote
      for (const it of itensParaEnviar) {
        await onAdd(it);
      }
    }

    // Limpa a fila e os campos de produto
    setProdutosPendentes([]);
    setCodigo('');
    setProduto('');
    setDataVencimento('');
    setLote('');
    setObservacoes('');
    setQuantidade(1);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2600);
  };

  return (
    <div id="form-inclusao-rapida" className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Cadastro e Lançamento de Validades
            </h2>
            <p className="text-xs text-slate-500">
              Selecione a Loja e a Indústria: os produtos aparecem automaticamente para você adicionar e enviar.
            </p>
          </div>
        </div>

        {showSuccessToast && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200 animate-fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>Produtos salvos com sucesso!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleFinalizarEEnviar} className="space-y-3">
        {/* Linha 1: Dados da Loja, Estado e Coordenador */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl">
          <div className="sm:col-span-5">
            <label
              htmlFor="select-loja"
              className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between"
            >
              <div className="flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-blue-600" />
                <span>Nome da Loja</span>
              </div>
              <span className="text-[10px] font-normal text-slate-500">Selecione da lista</span>
            </label>
            <div className="relative">
              <select
                id="select-loja"
                value={loja}
                onChange={(e) => handleMudarLoja(e.target.value)}
                className="w-full h-11 sm:h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 cursor-pointer"
              >
                <option value="">Selecione a Loja ({lojasCadastradas.length})...</option>
                {lojasCadastradas.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="select-estado"
              className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Estado (UF)</span>
            </label>
            <select
              id="select-estado"
              value={estado}
              onChange={(e) => handleMudarEstado(e.target.value)}
              className="w-full h-11 sm:h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 cursor-pointer"
            >
              <option value="">Selecione...</option>
              {ESTADOS_BRASIL.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4">
            <label
              htmlFor="select-coordenador"
              className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between"
            >
              <div className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Coordenador / Responsável</span>
              </div>
              <span className="text-[10px] font-normal text-slate-500">Selecione da lista</span>
            </label>
            <div className="relative">
              <select
                id="select-coordenador"
                value={coordenador}
                onChange={(e) => handleMudarCoordenador(e.target.value)}
                className="w-full h-11 sm:h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 cursor-pointer"
              >
                <option value="">Selecione o Coordenador ({coordenadoresCadastrados.length})...</option>
                {coordenadoresCadastrados.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Linha 2: Código, Indústria, Produto, Quantidade e Vencimento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Código do Produto (EAN / SKU) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-codigo-produto"
                className="block text-xs font-semibold text-slate-700 flex items-center gap-1"
              >
                <Barcode className="w-3.5 h-3.5 text-blue-600" />
                <span>Cód. Produto</span>
              </label>
              {sugestoesCodigos.length > 0 && (
                <span className="text-[10px] text-slate-500 font-medium">
                  {sugestoesCodigos.length} no Supabase
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="input-codigo-produto"
                type="text"
                list="lista-codigos-supabase"
                value={codigo}
                onChange={(e) => handleCodigoChange(e.target.value)}
                placeholder="Ex: 7891000..."
                className="w-full h-11 sm:h-10 pl-3 pr-8 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono font-medium text-slate-800"
              />
              {codigo && (
                <button
                  type="button"
                  onClick={() => handleCodigoChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Limpar código (apaga descrição e indústria)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <datalist id="lista-codigos-supabase">
                {sugestoesCodigos.map((item) => (
                  <option key={item.codigo} value={item.codigo}>
                    {item.label}
                  </option>
                ))}
              </datalist>
            </div>
            {codigo && produto && industria && (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-medium truncate">
                <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">Vinculado à {industria}</span>
              </div>
            )}
          </div>

          {/* Indústria / Fabricante */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-industria"
                className="block text-xs font-semibold text-slate-700"
              >
                Indústria / Fabricante <span className="text-red-500">*</span>
              </label>
            </div>
            <div className="relative">
              <input
                id="input-industria"
                type="text"
                list="lista-industrias"
                required
                value={industria}
                onChange={(e) => setIndustria(e.target.value)}
                placeholder="Ex: Nestlé, Ambev..."
                className="w-full h-11 sm:h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
              <datalist id="lista-industrias">
                {sugestoesIndustrias.map((sug) => (
                  <option key={sug} value={sug} />
                ))}
              </datalist>
            </div>

            {/* Chips rápidos de indústrias cadastradas para tocar no celular */}
            {sugestoesIndustrias.length > 0 && !industria && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
                <span className="text-[10px] text-slate-600 font-semibold shrink-0">Sugestões:</span>
                {sugestoesIndustrias.slice(0, 5).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setIndustria(ind)}
                    className="shrink-0 text-[11px] px-2.5 py-1 bg-blue-50 text-blue-700 font-medium rounded-full border border-blue-200/80 active:scale-95 transition"
                  >
                    {ind}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Produto com filtro automático pela indústria selecionada */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-produto"
                className="block text-xs font-semibold text-slate-700"
              >
                Produto <span className="text-red-500">*</span>
              </label>
              {sugestoesProdutosPorIndustria.length > 0 && (
                <span className="text-[11px] text-blue-600 font-medium truncate max-w-[170px]">
                  {industria ? `${sugestoesProdutosPorIndustria.length} da ${industria}` : `${sugestoesProdutosPorIndustria.length} disponíveis`}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="input-produto"
                ref={produtoInputRef}
                type="text"
                list="lista-produtos-sugeridos"
                value={produto}
                onChange={(e) => handleProdutoChange(e.target.value)}
                placeholder={
                  industria
                    ? `Produto da ${industria}...`
                    : 'Digite ou selecione...'
                }
                className="w-full h-11 sm:h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              />
              <datalist id="lista-produtos-sugeridos">
                {sugestoesProdutosPorIndustria.map((prod) => (
                  <option key={prod} value={prod} />
                ))}
              </datalist>
            </div>

            {/* Chips rápidos dos produtos vinculados */}
            {sugestoesProdutosPorIndustria.length > 0 && !produto && (
              <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar">
                <span className="text-[10px] text-slate-600 font-semibold shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-600" /> Toque:
                </span>
                {sugestoesProdutosPorIndustria.slice(0, 5).map((prodNome) => (
                  <button
                    key={prodNome}
                    type="button"
                    onClick={() => handleProdutoChange(prodNome)}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95"
                  >
                    {prodNome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantidade e Unidade com botões (+ / -) ideais para toque */}
          <div className="lg:col-span-2">
            <label
              htmlFor="input-quantidade"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Qtd & Unidade <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              {/* Stepper Touch */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl h-11 sm:h-10 p-1">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-white shadow-2xs text-slate-600 hover:text-slate-900 active:bg-slate-100 flex items-center justify-center cursor-pointer"
                  title="Diminuir"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  id="input-quantidade"
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
                  className="w-12 text-center text-sm font-bold text-slate-900 bg-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-white shadow-2xs text-slate-600 hover:text-slate-900 active:bg-slate-100 flex items-center justify-center cursor-pointer"
                  title="Aumentar"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Unidade */}
              <select
                id="select-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="flex-1 h-11 sm:h-10 px-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                <option value="un">un</option>
                <option value="cx">cx</option>
                <option value="kg">kg</option>
                <option value="pct">pct</option>
                <option value="fardo">fardo</option>
                <option value="lt">lt</option>
              </select>
            </div>
          </div>

          {/* Data de Vencimento */}
          <div className="lg:col-span-2">
            <label
              htmlFor="input-vencimento"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Data de Vencimento <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input-vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full h-11 sm:h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Atalhos rápidos de data para agilizar o lançamento mobile */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Vence em (Toque rápido):
            </span>
            <button
              id="btn-toggle-extras"
              type="button"
              onClick={() => setShowExtras(!showExtras)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
            >
              {showExtras ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Menos opções
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> + Lote & Obs
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              id="btn-atalho-7d"
              type="button"
              onClick={() => aplicarDataAtalho(7)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 active:bg-blue-100 active:text-blue-700 text-slate-700 font-medium shrink-0 transition"
            >
              +7 dias
            </button>
            <button
              id="btn-atalho-15d"
              type="button"
              onClick={() => aplicarDataAtalho(15)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 active:bg-blue-100 active:text-blue-700 text-slate-700 font-medium shrink-0 transition"
            >
              +15 dias
            </button>
            <button
              id="btn-atalho-30d"
              type="button"
              onClick={() => aplicarDataAtalho(30)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 active:bg-blue-100 active:text-blue-700 text-slate-700 font-medium shrink-0 transition"
            >
              +30 dias
            </button>
            <button
              id="btn-atalho-60d"
              type="button"
              onClick={() => aplicarDataAtalho(60)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 active:bg-blue-100 active:text-blue-700 text-slate-700 font-medium shrink-0 transition"
            >
              +60 dias
            </button>
            <button
              id="btn-atalho-90d"
              type="button"
              onClick={() => aplicarDataAtalho(90)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 active:bg-blue-100 active:text-blue-700 text-slate-700 font-medium shrink-0 transition"
            >
              +90 dias
            </button>
            <button
              id="btn-atalho-fim-mes"
              type="button"
              onClick={aplicarFimDoMes}
              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium shrink-0 border border-blue-200/80 transition"
            >
              Fim do mês
            </button>
            <button
              id="btn-atalho-fim-prox"
              type="button"
              onClick={aplicarFimProximoMes}
              className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium shrink-0 border border-blue-200/80 transition"
            >
              Fim próx. mês
            </button>
          </div>
        </div>

        {/* Campos Opcionais Extras */}
        {showExtras && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 animate-fade-in">
            <div>
              <label
                htmlFor="input-lote"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Número de Lote (Opcional)
              </label>
              <input
                id="input-lote"
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ex: L-48190"
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="input-observacoes"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Observações / Localização (Opcional)
              </label>
              <input
                id="input-observacoes"
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Gôndola 3, aplicar desconto..."
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Lista de Produtos Pendentes para Envio em Lote (mesma loja/indústria) */}
        {produtosPendentes.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50/60 border border-blue-200/70 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
                <ListPlus className="w-4 h-4 text-blue-600" />
                <span>
                  {produtosPendentes.length} produto(s) pronto(s) para enviar (
                  {industria || 'Indústria'}) {loja ? `• Loja: ${loja}` : ''}
                </span>
              </div>
              <span className="text-[11px] text-blue-700">
                Adicione mais produtos ou clique em "Finalizar e Enviar"
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {produtosPendentes.map((item) => (
                <div
                  key={item.idTemp}
                  className="flex items-center justify-between gap-2 p-2 bg-white rounded-md border border-blue-100 text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-800 truncate">
                      {item.produto}
                    </span>
                    {item.codigo && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-mono rounded text-[10px] shrink-0">
                        {item.codigo}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium shrink-0">
                      {item.quantidade} {item.unidade}
                    </span>
                    <span className="text-slate-500 shrink-0">
                      Venc: {item.data_vencimento.split('-').reverse().join('/')}
                    </span>
                    {item.lote && (
                      <span className="text-slate-400 text-[11px] truncate">
                        Lote: {item.lote}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoverItemFila(item.idTemp)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer shrink-0"
                    title="Remover produto da lista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Ações: Adicionar outro produto & Finalizar e Enviar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Botão de Adicionar outro produto daquela indústria */}
          <button
            id="btn-adicionar-outro-produto"
            type="button"
            onClick={handleAdicionarFila}
            disabled={!industria.trim() || !produto.trim() || !dataVencimento}
            className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-40 text-slate-800 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4 text-slate-600" />
            <span>+ Adicionar outro produto desta indústria</span>
          </button>

          {/* Botão de Finalizar e Enviar */}
          <button
            id="btn-finalizar-enviar"
            type="submit"
            disabled={
              isSaving ||
              (produtosPendentes.length === 0 &&
                (!industria.trim() || !produto.trim() || !dataVencimento))
            }
            className="inline-flex items-center justify-center gap-2 h-12 sm:h-10 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {isSaving
                ? 'Enviando ao Supabase...'
                : produtosPendentes.length > 0
                ? `Finalizar e Enviar (${produtosPendentes.length + (produto.trim() && dataVencimento ? 1 : 0)} itens)`
                : 'Salvar e Enviar'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};

