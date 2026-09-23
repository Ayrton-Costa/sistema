import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Building2,
  Barcode,
  CalendarPlus,
  RefreshCw,
  Sparkles,
  Database,
  CheckCircle2,
  ExternalLink,
  Layers,
  PackagePlus,
} from 'lucide-react';
import { ProdutoCatalogo, ItemValidade, SupabaseConfig } from '../types';
import { IndustryLogoItem } from '../lib/firebase';

interface BaseProductsViewProps {
  produtosCatalogo: ProdutoCatalogo[];
  itemsValidade: ItemValidade[];
  supabaseConfig: SupabaseConfig;
  industryLogos?: Record<string, { logoUrl?: string; [key: string]: any }>;
  onRefresh: () => void;
  isRefreshing: boolean;
  onSelectProductToLaunch: (produto: string, industria: string, codigo?: string, unidade?: string) => void;
  onOpenSupabaseModal: () => void;
  onNavigateToCadastro?: () => void;
}

export const BaseProductsView: React.FC<BaseProductsViewProps> = ({
  produtosCatalogo,
  itemsValidade,
  supabaseConfig,
  industryLogos = {},
  onRefresh,
  isRefreshing,
  onSelectProductToLaunch,
  onOpenSupabaseModal,
  onNavigateToCadastro,
}) => {
  const [busca, setBusca] = useState('');
  const [industriaFiltro, setIndustriaFiltro] = useState('todas');

  // Mapa com contagem de quantas validades cadastradas existem para cada produto
  const contagemValidadesPorProduto = useMemo(() => {
    const map = new Map<string, number>();
    itemsValidade.forEach((it) => {
      const chave = `${it.produto.trim().toLowerCase()}_${it.industria.trim().toLowerCase()}`;
      map.set(chave, (map.get(chave) || 0) + 1);
    });
    return map;
  }, [itemsValidade]);

  // Lista única de indústrias presentes no catálogo
  const industrias = useMemo(() => {
    const set = new Set<string>();
    produtosCatalogo.forEach((p) => {
      if (p.industria?.trim()) set.add(p.industria.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [produtosCatalogo]);

  // Filtragem dos produtos do catálogo
  const produtosFiltrados = useMemo(() => {
    return produtosCatalogo.filter((p) => {
      if (industriaFiltro !== 'todas' && p.industria !== industriaFiltro) {
        return false;
      }
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchNome = p.nome.toLowerCase().includes(termo);
        const matchCod = p.codigo != null ? String(p.codigo).toLowerCase().includes(termo) : false;
        const matchInd = p.industria.toLowerCase().includes(termo);
        if (!matchNome && !matchCod && !matchInd) return false;
      }
      return true;
    });
  }, [produtosCatalogo, busca, industriaFiltro]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Cabeçalho do Catálogo da Base */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Produtos Cadastrados na Base
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {produtosCatalogo.length} produto{produtosCatalogo.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Catálogo mestre sincronizado do Supabase para busca rápida, autocomplete e lançamento de validades.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onNavigateToCadastro && (
              <button
                type="button"
                onClick={onNavigateToCadastro}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition cursor-pointer"
                title="Abrir tela de cadastro de novos produtos"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>Cadastrar Produto</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{isRefreshing ? 'Sincronizando...' : 'Recarregar'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenSupabaseModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Configurar Base</span>
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          {/* Campo de Busca */}
          <div className="sm:col-span-7 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome do produto, código de barras (EAN) ou marca..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 h-10 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Filtro de Indústria */}
          <div className="sm:col-span-5 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 h-10">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={industriaFiltro}
              onChange={(e) => setIndustriaFiltro(e.target.value)}
              className="w-full text-xs sm:text-sm bg-transparent focus:outline-none text-slate-700 font-medium cursor-pointer"
            >
              <option value="todas">Todas as Indústrias ({industrias.length})</option>
              {industrias.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista / Tabela de Produtos */}
      <div className="overflow-x-auto">
        {produtosFiltrados.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {produtosCatalogo.length === 0
                ? 'Nenhum produto cadastrado na base Supabase ainda'
                : 'Nenhum produto corresponde aos filtros'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {produtosCatalogo.length === 0 ? (
                <>
                  Verifique se o seu Supabase está conectado e se a tabela{' '}
                  <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono">
                    {supabaseConfig.productTableName || 'produtos'}
                  </code>{' '}
                  possui a permissão de leitura RLS ativa, ou configure o nome exato da sua tabela no menu Supabase.
                </>
              ) : (
                'Tente alterar o termo digitado na busca ou selecionar outra indústria.'
              )}
            </p>
            {produtosCatalogo.length === 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Recarregar Agora
                </button>
                <button
                  type="button"
                  onClick={onOpenSupabaseModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  Configurar Tabela / Ver SQL
                </button>
              </div>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Cód. Produto</th>
                <th className="py-3 px-4">Nome do Produto</th>
                <th className="py-3 px-4">Indústria / Marca</th>
                <th className="py-3 px-4 text-center">Un.</th>
                <th className="py-3 px-4 text-center">No Estoque</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produtosFiltrados.map((prod, idx) => {
                const chave = `${prod.nome.trim().toLowerCase()}_${prod.industria.trim().toLowerCase()}`;
                const totalValidades = contagemValidadesPorProduto.get(chave) || 0;

                return (
                  <tr key={`${prod.nome}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    {/* Código */}
                    <td className="py-3 px-4">
                      {prod.codigo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs font-semibold rounded border border-blue-100">
                          <Barcode className="w-3 h-3 text-blue-500" />
                          {prod.codigo}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Sem código</span>
                      )}
                    </td>

                    {/* Nome do Produto */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{prod.nome}</div>
                    </td>

                    {/* Indústria */}
                    <td className="py-3 px-4">
                      {prod.industria && industryLogos[prod.industria.toLowerCase()]?.logoUrl ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-orange-50/80 border border-orange-200/80 text-slate-800 text-xs font-medium rounded-md shadow-2xs">
                          <img
                            src={industryLogos[prod.industria.toLowerCase()].logoUrl}
                            alt={prod.industria}
                            className="w-4 h-4 object-contain rounded shrink-0"
                          />
                          <span>{prod.industria}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {prod.industria || 'Geral'}
                        </span>
                      )}
                    </td>

                    {/* Unidade */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-mono text-slate-600 font-medium">
                        {prod.unidade_padrao || 'un'}
                      </span>
                    </td>

                    {/* Quantidade no Estoque */}
                    <td className="py-3 px-4 text-center">
                      {totalValidades > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {totalValidades} validade{totalValidades > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Sem lotes ativos</span>
                      )}
                    </td>

                    {/* Ação: Lançar Validade */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectProductToLaunch(
                            prod.nome,
                            prod.industria || 'Geral',
                            prod.codigo,
                            prod.unidade_padrao || 'un'
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer active:scale-95"
                        title="Preencher no formulário para registrar lote e data de validade"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>Lançar Validade</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Rodapé Informativo */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>
            Ao clicar em <strong>"Lançar Validade"</strong>, o produto é enviado automaticamente ao formulário com código e indústria preenchidos.
          </span>
        </div>
        <div className="font-semibold text-slate-700">
          Exibindo {produtosFiltrados.length} de {produtosCatalogo.length} produto(s)
        </div>
      </div>
    </div>
  );
};
