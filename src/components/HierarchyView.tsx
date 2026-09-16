import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { ItemValidade, NivelHierarquia } from '../types';
import {
  calcularDiasRestantes,
  obterStatusValidade,
  formatarDataBR,
  exportarParaExcel,
} from '../lib/excel';

interface HierarchyViewProps {
  items: ItemValidade[];
  onUpdate: (item: ItemValidade) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

interface TreeNode {
  key: string;
  nivel: NivelHierarquia | 'produto';
  valor: string;
  items: ItemValidade[];
  children?: TreeNode[];
  totalItens: number;
  totalQtd: number;
  vencidos: number;
  criticos: number;
  atencao: number;
}

const ROTULOS_NIVEL: Record<NivelHierarquia, { nome: string; icone: React.FC<any>; cor: string; bg: string }> = {
  loja: { nome: 'Loja', icone: Store, cor: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  industria: { nome: 'Indústria / Marca', icone: Building2, cor: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  coordenador: { nome: 'Coordenador', icone: Package, cor: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  estado: { nome: 'Estado (UF)', icone: Store, cor: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
};

export const HierarchyView: React.FC<HierarchyViewProps> = ({
  items,
  onUpdate,
  onDelete,
  isLoading,
}) => {
  // Precedência padrão solicitada: Loja -> Indústria (os produtos são as folhas)
  const [hierarquia, setHierarquia] = useState<NivelHierarquia[]>(['loja', 'industria']);
  const [mostrarPainelPrecedencia, setMostrarPainelPrecedencia] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Estado de edição inline de produto
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ItemValidade>>({});

  // Níveis disponíveis que podem ser adicionados
  const niveisPossiveis: NivelHierarquia[] = ['loja', 'industria', 'coordenador', 'estado'];

  // Função para mover nível para cima
  const moverNivelParaCima = (index: number) => {
    if (index === 0) return;
    setHierarquia((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Função para mover nível para baixo
  const moverNivelParaBaixo = (index: number) => {
    if (index === hierarquia.length - 1) return;
    setHierarquia((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  // Alternar nível ativo na hierarquia
  const toggleNivelNaHierarquia = (nivel: NivelHierarquia) => {
    if (hierarquia.includes(nivel)) {
      if (hierarquia.length <= 1) return; // Mantém ao menos 1 nível
      setHierarquia((prev) => prev.filter((n) => n !== nivel));
    } else {
      setHierarquia((prev) => [...prev, nivel]);
    }
  };

  // Construção recursiva da árvore baseada nos níveis de precedência configurados
  const arvore = useMemo(() => {
    const extrairValor = (item: ItemValidade, nivel: NivelHierarquia): string => {
      switch (nivel) {
        case 'loja':
          return item.loja ? item.loja.trim() : 'Loja Não Especificada';
        case 'industria':
          return item.industria ? item.industria.trim() : 'Indústria Não Informada';
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

      const chavesOrdenadas = Object.keys(grupos).sort((a, b) => a.localeCompare(b));

      return chavesOrdenadas.map((val) => {
        const itensFilhos = grupos[val];
        const chaveNo = `${prefixoChave}::${nivelAtual}::${val}`;

        let totalQtd = 0;
        let vencidos = 0;
        let criticos = 0;
        let atencao = 0;

        itensFilhos.forEach((it) => {
          totalQtd += Number(it.quantidade || 0);
          const dias = calcularDiasRestantes(it.data_vencimento);
          if (dias < 0) vencidos++;
          else if (dias <= 7) criticos++;
          else if (dias <= 30) atencao++;
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
        };
      });
    };

    return construirNos(items, 0, 'root');
  }, [items, hierarquia]);

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
    setEditForm({
      ...item,
    });
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

  // Renderização recursiva de cada nó da árvore
  const renderNode = (node: TreeNode, profundidade = 0) => {
    const isExpanded = expandedKeys.has(node.key);
    const configNivel = ROTULOS_NIVEL[node.nivel as NivelHierarquia] || ROTULOS_NIVEL.loja;
    const Icone = configNivel.icone;
    const ehUltimoNivel = !node.children || node.children.length === 0;

    return (
      <div key={node.key} className="transition-all duration-150">
        {/* Barra do Nó de Agrupamento */}
        <div
          onClick={() => toggleExpand(node.key)}
          className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition cursor-pointer select-none ${
            profundidade === 0
              ? 'bg-slate-50/90 hover:bg-slate-100/80 border-slate-200 shadow-2xs'
              : profundidade === 1
              ? 'bg-white hover:bg-slate-50/80 border-slate-200/80 ml-3 sm:ml-5'
              : 'bg-white hover:bg-slate-50/70 border-slate-200/70 ml-6 sm:ml-9'
          }`}
        >
          {/* Lado Esquerdo: Ícone + Rótulo + Valor */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-slate-700 transition"
              aria-label={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-blue-600 transition-transform" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform" />
              )}
            </button>

            <div
              className={`p-1.5 rounded-lg shrink-0 border ${configNivel.bg} ${configNivel.cor}`}
            >
              <Icone className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {node.valor}
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  {configNivel.nome}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{node.totalItens} produto(s)</span>
                <span>•</span>
                <span>{node.totalQtd} unidades</span>
              </div>
            </div>
          </div>

          {/* Lado Direito: Alertas e Badges de Validade */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {node.vencidos > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                <XCircle className="w-3 h-3" />
                <span>{node.vencidos} Vencido{node.vencidos > 1 ? 's' : ''}</span>
              </span>
            )}
            {node.criticos > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                <span>{node.criticos} Crítico{node.criticos > 1 ? 's' : ''}</span>
              </span>
            )}
            {node.atencao > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-800 border border-yellow-200">
                <Clock className="w-3 h-3" />
                <span>{node.atencao}</span>
              </span>
            )}
            {node.vencidos === 0 && node.criticos === 0 && node.atencao === 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-3 h-3" />
                <span className="hidden sm:inline">100% no Prazo</span>
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo Expandido */}
        {isExpanded && (
          <div className="mt-2 mb-3 space-y-2">
            {/* Se tiver nós intermediários (filhos), renderiza recursivamente */}
            {node.children && node.children.length > 0 ? (
              node.children.map((child) => renderNode(child, profundidade + 1))
            ) : (
              /* Se for a folha da hierarquia, renderiza a lista de produtos encapsulados */
              <div
                className={`overflow-hidden border border-slate-200 rounded-xl bg-white shadow-2xs ${
                  profundidade === 0
                    ? 'ml-0'
                    : profundidade === 1
                    ? 'ml-1 sm:ml-5'
                    : 'ml-2 sm:ml-9'
                }`}
              >
                {/* Visualização em Cards para Mobile (sm:hidden) */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {node.items.map((prod) => {
                    const isEditing = editingId === prod.id;
                    const dias = calcularDiasRestantes(prod.data_vencimento);
                    const statusObj = obterStatusValidade(dias);

                    if (isEditing) {
                      return (
                        <div key={prod.id} className="p-3 bg-blue-50/50 space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Produto:</span>
                            <input
                              type="text"
                              value={editForm.produto || ''}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, produto: e.target.value }))
                              }
                              className="w-full h-9 px-2 text-xs bg-white border border-blue-300 rounded-lg font-medium mt-0.5"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Quantidade:</span>
                              <input
                                type="number"
                                value={editForm.quantidade ?? ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    quantidade: Number(e.target.value),
                                  }))
                                }
                                className="w-full h-9 px-2 text-xs bg-white border border-blue-300 rounded-lg font-medium mt-0.5"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Vencimento:</span>
                              <input
                                type="date"
                                value={editForm.data_vencimento || ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    data_vencimento: e.target.value,
                                  }))
                                }
                                className="w-full h-9 px-2 text-xs bg-white border border-blue-300 rounded-lg font-medium mt-0.5"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg font-semibold"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="px-3 py-1.5 text-xs text-white bg-emerald-600 rounded-lg font-semibold"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={prod.id} className="p-3 hover:bg-slate-50 transition-colors space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{prod.produto}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span>{prod.industria}</span>
                              {prod.loja && <span> • {prod.loja}</span>}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusObj.badgeClass}`}
                          >
                            {statusObj.rotulo}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                          {/* Stepper Touch de Quantidade */}
                          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleMudarQuantidade(prod, -1)}
                              className="w-7 h-7 rounded bg-white shadow-2xs flex items-center justify-center text-slate-700 active:bg-slate-200 cursor-pointer"
                              title="Diminuir"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-bold text-slate-900 px-2 min-w-[28px] text-center">
                              {prod.quantidade}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMudarQuantidade(prod, +1)}
                              className="w-7 h-7 rounded bg-white shadow-2xs flex items-center justify-center text-slate-700 active:bg-slate-200 cursor-pointer"
                              title="Aumentar"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-slate-500 font-semibold px-1.5">
                              {prod.unidade || 'un'}
                            </span>
                          </div>

                          {/* Data e Ações */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-slate-700 font-semibold text-xs">
                              <Calendar className="w-3.5 h-3.5 text-blue-600" />
                              <span>{formatarDataBR(prod.data_vencimento)}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(prod)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 bg-slate-50 rounded-md border border-slate-200"
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
                                className="p-1.5 text-slate-500 hover:text-red-600 bg-slate-50 rounded-md border border-slate-200"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {(prod.lote || prod.observacoes) && (
                          <div className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-center gap-2">
                            {prod.lote && <span className="font-mono font-bold text-slate-700">Lote: {prod.lote}</span>}
                            {prod.observacoes && <span>Obs: {prod.observacoes}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tabela Padrão para Desktop e Tablets (hidden sm:block) */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Produto</th>
                        <th className="py-2.5 px-3">Qtd / Un</th>
                        <th className="py-2.5 px-3">Vencimento</th>
                        <th className="py-2.5 px-3">Situação</th>
                        <th className="py-2.5 px-3 hidden md:table-cell">Lote / Obs</th>
                        <th className="py-2.5 px-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {node.items.map((prod) => {
                        const isEditing = editingId === prod.id;
                        const dias = calcularDiasRestantes(prod.data_vencimento);
                        const statusObj = obterStatusValidade(dias);

                        if (isEditing) {
                          return (
                            <tr key={prod.id} className="bg-blue-50/50">
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={editForm.produto || ''}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({ ...prev, produto: e.target.value }))
                                  }
                                  className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded font-medium"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  value={editForm.quantidade ?? ''}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      quantidade: Number(e.target.value),
                                    }))
                                  }
                                  className="w-16 h-8 px-2 text-xs bg-white border border-blue-300 rounded font-medium"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={editForm.data_vencimento || ''}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      data_vencimento: e.target.value,
                                    }))
                                  }
                                  className="h-8 px-2 text-xs bg-white border border-blue-300 rounded font-medium"
                                />
                              </td>
                              <td className="p-2" colSpan={2}>
                                <input
                                  type="text"
                                  placeholder="Lote / Observações"
                                  value={editForm.observacoes || ''}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      observacoes: e.target.value,
                                    }))
                                  }
                                  className="w-full h-8 px-2 text-xs bg-white border border-blue-300 rounded font-medium"
                                />
                              </td>
                              <td className="p-2 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={handleSaveEdit}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{prod.produto}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                <span>{prod.industria}</span>
                                {prod.loja && <span>• {prod.loja}</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMudarQuantidade(prod, -1)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-slate-800 min-w-[20px] text-center">
                                  {prod.quantidade}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMudarQuantidade(prod, +1)}
                                  className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <span className="text-[11px] text-slate-500 ml-1">
                                  {prod.unidade || 'un'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {formatarDataBR(prod.data_vencimento)}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusObj.badgeClass}`}
                              >
                                {statusObj.rotulo}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 hidden md:table-cell text-slate-500">
                              {prod.lote ? (
                                <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded mr-1">
                                  {prod.lote}
                                </span>
                              ) : null}
                              <span className="truncate max-w-[120px] inline-block align-bottom">
                                {prod.observacoes || '-'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(prod)}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50"
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
                                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Barra Superior da Hierarquia: Ações e Botão de Ajuste de Precedência */}
      <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Visualizador da Ordem Atual */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Estrutura de Precedência:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {hierarquia.map((nivel, idx) => {
              const cfg = ROTULOS_NIVEL[nivel];
              const Icone = cfg.icone;
              return (
                <React.Fragment key={nivel}>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${cfg.bg} ${cfg.cor}`}
                  >
                    <Icone className="w-3.5 h-3.5" />
                    <span>{cfg.nome}</span>
                    <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                  </div>
                  <span className="text-slate-400 font-bold">→</span>
                </React.Fragment>
              );
            })}
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border bg-slate-50 border-slate-200 text-slate-700 font-semibold">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span>Produtos</span>
            </div>
          </div>
        </div>

        {/* Botões de Controle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarPainelPrecedencia((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              mostrarPainelPrecedencia
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Ajustar Precedência</span>
          </button>

          <button
            type="button"
            onClick={expandirTudo}
            className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            title="Expandir todas as pastas"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={recolherTudo}
            className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            title="Recolher todas as pastas"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Painel Interativo de Ajuste de Precedência da Hierarquia */}
      {mostrarPainelPrecedencia && (
        <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-xl border border-blue-200 shadow-xs animate-fade-in space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                Configurar Precedência da Hierarquia
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Altere a ordem de agrupamento (ex: <strong>Loja → Indústria → Produtos</strong> ou{' '}
                <strong>Indústria → Loja → Produtos</strong>).
              </p>
            </div>
            <button
              onClick={() => setMostrarPainelPrecedencia(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Lista dos Níveis Ativos com botões de Subir / Descer */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Níveis Ativos (Ordem de Precedência):
              </span>
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
                          onClick={() => moverNivelParaCima(idx)}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                          title="Subir prioridade"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moverNivelParaBaixo(idx)}
                          disabled={idx === hierarquia.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                          title="Descer prioridade"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleNivelNaHierarquia(nivel)}
                          disabled={hierarquia.length <= 1}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-30 cursor-pointer ml-1"
                          title="Remover este nível"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Níveis que podem ser adicionados à hierarquia */}
              {niveisPossiveis.some((n) => !hierarquia.includes(n)) && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    Adicionar mais agrupamentos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {niveisPossiveis
                      .filter((n) => !hierarquia.includes(n))
                      .map((n) => {
                        const cfg = ROTULOS_NIVEL[n];
                        const Icone = cfg.icone;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggleNivelNaHierarquia(n)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-dashed border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-600 transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-blue-600" />
                            <Icone className="w-3.5 h-3.5" />
                            <span>{cfg.nome}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Níveis Disponíveis para Adicionar ou Presets Rápidos */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Atalhos Rápidos de Hierarquia:
              </span>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setHierarquia(['loja', 'industria'])}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                    hierarquia.join('->') === 'loja->industria'
                      ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-semibold">Padrão: Loja → Indústria → Produtos</div>
                    <div className="text-[11px] text-slate-500">
                      Ideal para conferências por filial e cliente
                    </div>
                  </div>
                  {hierarquia.join('->') === 'loja->industria' && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setHierarquia(['industria', 'loja'])}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                    hierarquia.join('->') === 'industria->loja'
                      ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-semibold">Indústria → Loja → Produtos</div>
                    <div className="text-[11px] text-slate-500">
                      Ideal para negociações com fabricantes e promotores
                    </div>
                  </div>
                  {hierarquia.join('->') === 'industria->loja' && (
                    <Check className="w-4 h-4 text-purple-600" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setHierarquia(['coordenador', 'loja', 'industria'])}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer flex items-center justify-between ${
                    hierarquia.join('->') === 'coordenador->loja->industria'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-semibold">Coordenador → Loja → Indústria → Produtos</div>
                    <div className="text-[11px] text-slate-500">
                      Visão gerencial por supervisor de campo
                    </div>
                  </div>
                  {hierarquia.join('->') === 'coordenador->loja->industria' && (
                    <Check className="w-4 h-4 text-indigo-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Árvore de Dados Encapsulados */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
            <p className="mt-2 text-xs">Organizando hierarquia de estoque...</p>
          </div>
        ) : arvore.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="font-semibold text-sm text-slate-700">Nenhum produto cadastrado</div>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre novos itens acima ou importe sua planilha Excel para ver a árvore hierárquica.
            </p>
          </div>
        ) : (
          arvore.map((rootNode) => renderNode(rootNode, 0))
        )}
      </div>
    </div>
  );
};
