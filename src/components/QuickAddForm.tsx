import React, { useState, useRef, useMemo } from 'react';
import {
  Plus,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  Store,
  MapPin,
  UserCheck,
  PackagePlus,
  Send,
  Trash2,
  ListPlus,
} from 'lucide-react';
import { ItemValidade } from '../types';

interface ItemPendente {
  idTemp: string;
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
  catalogoIndustriasSupabase?: string[];
  catalogoCoordenadoresSupabase?: string[];
  catalogoLojasSupabase?: Array<{ nome: string; estado?: string; coordenador?: string }>;
  allItems?: ItemValidade[];
  isSaving: boolean;
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
  catalogoIndustriasSupabase = [],
  catalogoCoordenadoresSupabase = [],
  catalogoLojasSupabase = [],
  allItems = [],
  isSaving,
}) => {
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

  // Lista única de coordenadores do Supabase (tanto da tabela de coordenadores quanto da tabela validades)
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
    return Array.from(set).sort();
  }, [allItems, catalogoCoordenadoresSupabase, catalogoLojasSupabase]);

  // Lista única de lojas já existentes (tanto da tabela dedicada 'lojas' quanto de 'validades')
  const lojasCadastradas = useMemo(() => {
    const set = new Set<string>();
    catalogoLojasSupabase.forEach((l) => {
      if (l.nome?.trim()) set.add(l.nome.trim());
    });
    allItems.forEach((it) => {
      if (it.loja?.trim()) set.add(it.loja.trim());
    });
    return Array.from(set).sort();
  }, [allItems, catalogoLojasSupabase]);

  // Ao selecionar ou digitar uma loja cadastrada, preenche automaticamente Estado e Coordenador
  const handleMudarLoja = (nomeLoja: string) => {
    setLoja(nomeLoja);
    const trimmed = nomeLoja.trim().toLowerCase();
    if (!trimmed) return;

    // Procura na tabela dedicada de lojas
    const lojaEncontrada = catalogoLojasSupabase.find(
      (l) => l.nome.trim().toLowerCase() === trimmed
    );
    if (lojaEncontrada) {
      if (lojaEncontrada.estado && !estado) setEstado(lojaEncontrada.estado);
      if (lojaEncontrada.coordenador && !coordenador) setCoordenador(lojaEncontrada.coordenador);
      return;
    }

    // Caso contrário, procura na tabela validades
    const itemExistente = allItems.find(
      (it) => it.loja && it.loja.trim().toLowerCase() === trimmed
    );
    if (itemExistente) {
      if (itemExistente.estado && !estado) setEstado(itemExistente.estado);
      if (itemExistente.coordenador && !coordenador) setCoordenador(itemExistente.coordenador);
    }
  };

  // Mostra estritamente as indústrias cadastradas no Supabase (tanto da tabela de validades quanto da tabela de indústrias)
  const sugestoesIndustrias = useMemo(() => {
    const combined = Array.from(
      new Set([
        ...catalogoIndustriasSupabase.filter(Boolean),
        ...existingIndustries.filter(Boolean),
      ])
    ).sort();

    if (!industria.trim()) return combined;
    return combined.filter((ind) =>
      ind.toLowerCase().includes(industria.toLowerCase())
    );
  }, [existingIndustries, catalogoIndustriasSupabase, industria]);

  // AUTOMÁTICO: Mostra SOMENTE os produtos cadastrados no Supabase para a indústria selecionada
  const sugestoesProdutosPorIndustria = useMemo(() => {
    if (!industria.trim()) return [];
    const indNormalizada = industria.trim().toLowerCase();
    const setProds = new Set<string>();

    // 1. Produtos já cadastrados no Supabase para esta indústria (na tabela validades)
    allItems.forEach((it) => {
      if (it.industria && it.industria.trim().toLowerCase() === indNormalizada && it.produto?.trim()) {
        setProds.add(it.produto.trim());
      }
    });

    // 2. Produtos vinculados no catálogo do Supabase (tabela produtos vinculada a industrias)
    if (Array.isArray(catalogoProdutosPorIndustria[indNormalizada])) {
      catalogoProdutosPorIndustria[indNormalizada].forEach((p) => {
        if (p?.trim()) setProds.add(p.trim());
      });
    } else {
      // Caso haja correspondência de nome (ex: "Ambev" ou variações maiúsculas/minúsculas)
      for (const [key, prods] of Object.entries(catalogoProdutosPorIndustria)) {
        if (key.trim().toLowerCase() === indNormalizada && Array.isArray(prods)) {
          (prods as string[]).forEach((p) => {
            if (p?.trim()) setProds.add(p.trim());
          });
        }
      }
    }

    return Array.from(setProds).sort();
  }, [industria, allItems, catalogoProdutosPorIndustria]);

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
      produto: produto.trim(),
      quantidade: Math.max(1, Number(quantidade) || 1),
      unidade: unidade || 'un',
      data_vencimento: dataVencimento,
      lote: lote.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
    };

    setProdutosPendentes((prev) => [...prev, novoPendente]);

    // Limpa campos do produto mantendo Loja, Estado, Coordenador e Indústria
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
    setProduto('');
    setDataVencimento('');
    setLote('');
    setObservacoes('');
    setQuantidade(1);

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2600);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 mb-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50/80 border border-slate-200/80 rounded-lg">
          <div className="sm:col-span-5">
            <label
              htmlFor="input-loja"
              className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1"
            >
              <Store className="w-3.5 h-3.5 text-slate-500" />
              <span>Nome da Loja</span>
            </label>
            <div className="relative">
              <input
                id="input-loja"
                type="text"
                list="lista-lojas-cadastradas"
                value={loja}
                onChange={(e) => handleMudarLoja(e.target.value)}
                placeholder="Ex: Hiper Centro, Loja 04..."
                className="w-full h-9 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="lista-lojas-cadastradas">
                {lojasCadastradas.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="select-estado"
              className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Estado (UF)</span>
            </label>
            <select
              id="select-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full h-9 px-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
              htmlFor="input-coordenador"
              className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Coordenador / Responsável</span>
            </label>
            <div className="relative">
              <input
                id="input-coordenador"
                type="text"
                list="lista-coordenadores-cadastrados"
                value={coordenador}
                onChange={(e) => setCoordenador(e.target.value)}
                placeholder="Ex: Carlos Silva, Mariana..."
                className="w-full h-9 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="lista-coordenadores-cadastrados">
                {coordenadoresCadastrados.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Linha 2: Indústria, Produto, Quantidade e Vencimento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Indústria / Fabricante */}
          <div className="lg:col-span-3">
            <label
              htmlFor="input-industria"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Indústria / Fabricante <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input-industria"
                type="text"
                list="lista-industrias"
                required
                value={industria}
                onChange={(e) => setIndustria(e.target.value)}
                placeholder="Ex: Nestlé, Ambev..."
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <datalist id="lista-industrias">
                {sugestoesIndustrias.map((sug) => (
                  <option key={sug} value={sug} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Produto com filtro automático pela indústria selecionada */}
          <div className="lg:col-span-4">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-produto"
                className="block text-xs font-medium text-slate-700"
              >
                Produto <span className="text-red-500">*</span>
              </label>
              {industria && sugestoesProdutosPorIndustria.length > 0 && (
                <span className="text-[11px] text-blue-600 font-medium">
                  {sugestoesProdutosPorIndustria.length} produtos de {industria}
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
                onChange={(e) => setProduto(e.target.value)}
                placeholder={
                  industria
                    ? `Escolha ou digite o produto da ${industria}...`
                    : 'Digite ou selecione o produto...'
                }
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <datalist id="lista-produtos-sugeridos">
                {sugestoesProdutosPorIndustria.map((prod) => (
                  <option key={prod} value={prod} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Quantidade e Unidade */}
          <div className="lg:col-span-2">
            <label
              htmlFor="input-quantidade"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Qtd & Unidade <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-1.5">
              <input
                id="input-quantidade"
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                className="w-20 h-10 px-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-medium"
              />
              <select
                id="select-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="flex-1 h-10 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="lg:col-span-3">
            <label
              htmlFor="input-vencimento"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Data de Vencimento <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input-vencimento"
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Atalhos rápidos de data para agilizar o lançamento */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500">
          <span className="font-medium text-slate-600 flex items-center gap-1 mr-1">
            <Calendar className="w-3.5 h-3.5" /> Vence em:
          </span>
          <button
            id="btn-atalho-7d"
            type="button"
            onClick={() => aplicarDataAtalho(7)}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            +7 dias
          </button>
          <button
            id="btn-atalho-15d"
            type="button"
            onClick={() => aplicarDataAtalho(15)}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            +15 dias
          </button>
          <button
            id="btn-atalho-30d"
            type="button"
            onClick={() => aplicarDataAtalho(30)}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            +30 dias
          </button>
          <button
            id="btn-atalho-60d"
            type="button"
            onClick={() => aplicarDataAtalho(60)}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            +60 dias
          </button>
          <button
            id="btn-atalho-90d"
            type="button"
            onClick={() => aplicarDataAtalho(90)}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            +90 dias
          </button>
          <button
            id="btn-atalho-fim-mes"
            type="button"
            onClick={aplicarFimDoMes}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            Fim deste mês
          </button>
          <button
            id="btn-atalho-fim-prox"
            type="button"
            onClick={aplicarFimProximoMes}
            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            Fim do próx. mês
          </button>

          <button
            id="btn-toggle-extras"
            type="button"
            onClick={() => setShowExtras(!showExtras)}
            className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            {showExtras ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Menos opções
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Lote & Obs (opcional)
              </>
            )}
          </button>
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          {/* Botão de Adicionar outro produto daquela indústria */}
          <button
            id="btn-adicionar-outro-produto"
            type="button"
            onClick={handleAdicionarFila}
            disabled={!industria.trim() || !produto.trim() || !dataVencimento}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 text-xs font-medium rounded-lg transition cursor-pointer"
          >
            <PackagePlus className="w-4 h-4 text-slate-600" />
            <span>+ Adicionar outro produto desta indústria</span>
          </button>

          {/* Botão de Finalizar e Enviar */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              id="btn-finalizar-enviar"
              type="submit"
              disabled={
                isSaving ||
                (produtosPendentes.length === 0 &&
                  (!industria.trim() || !produto.trim() || !dataVencimento))
              }
              className="inline-flex items-center justify-center gap-2 h-10 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Enviando ao Supabase...'
                  : produtosPendentes.length > 0
                  ? `Finalizar e Enviar (${produtosPendentes.length + (produto.trim() && dataVencimento ? 1 : 0)} itens)`
                  : 'Finalizar e Enviar'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

