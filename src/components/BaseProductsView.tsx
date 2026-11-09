import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarClock,
  History,
} from 'lucide-react';
import { ProdutoCatalogo, ItemValidade, SupabaseConfig } from '../types';
import { IndustryLogoItem } from '../lib/firebase';
import { calcularDiasDesdeAdicao } from '../lib/excel';

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
  const [filtroSku, setFiltroSku] = useState('todos');
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

  // Lista de SKUs disponíveis vindos diretamente da lista de produtos
  const opcoesSku = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; industria: string; key: string }>();
    produtosCatalogo.forEach((p) => {
      if (p.codigo && String(p.codigo).trim()) {
        const cod = String(p.codigo).trim();
        if (industriaFiltro === 'todas' || p.industria === industriaFiltro) {
          if (!map.has(cod)) {
            map.set(cod, {
              codigo: cod,
              nome: p.nome || 'Produto sem nome',
              industria: p.industria || '',
              key: `${cod}_${p.nome}`,
            });
          }
        }
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, undefined, { numeric: true })
    );
  }, [produtosCatalogo, industriaFiltro]);

  const handleMudarIndustria = (novaInd: string) => {
    setIndustriaFiltro(novaInd);
    if (filtroSku !== 'todos' && filtroSku !== '') {
      const pertence = produtosCatalogo.some(
        (p) =>
          p.codigo &&
          String(p.codigo).trim() === filtroSku &&
          (novaInd === 'todas' || p.industria === novaInd)
      );
      if (!pertence) {
        setFiltroSku('todos');
      }
    }
  };

  // Filtragem dos produtos do catálogo
  const produtosFiltrados = useMemo(() => {
    return produtosCatalogo.filter((p) => {
      if (industriaFiltro !== 'todas' && p.industria !== industriaFiltro) {
        return false;
      }
      if (filtroSku && filtroSku !== 'todos' && filtroSku.trim()) {
        const termoSku = filtroSku.trim().toLowerCase();
        const matchSku = p.codigo != null ? String(p.codigo).toLowerCase().trim() === termoSku : false;
        if (!matchSku) return false;
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
  }, [produtosCatalogo, busca, filtroSku, industriaFiltro]);

  // Estados de paginação para suportar grandes volumes (> 2.000 produtos) sem travamentos
  const [itensPorPagina, setItensPorPagina] = useState<number>(50);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);

  // Reseta para a página 1 ao alterar filtros ou busca
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroSku, industriaFiltro, itensPorPagina]);

  const totalPaginas = useMemo(() => {
    if (itensPorPagina === -1) return 1;
    return Math.max(1, Math.ceil(produtosFiltrados.length / itensPorPagina));
  }, [produtosFiltrados.length, itensPorPagina]);

  const paginaValida = useMemo(() => {
    return Math.min(Math.max(1, paginaAtual), totalPaginas);
  }, [paginaAtual, totalPaginas]);

  const produtosPaginados = useMemo(() => {
    if (itensPorPagina === -1) return produtosFiltrados;
    const inicio = (paginaValida - 1) * itensPorPagina;
    return produtosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [produtosFiltrados, paginaValida, itensPorPagina]);

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
          {/* Campo de Busca Geral */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome do produto ou marca..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-7 h-10 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro SKU vindo da Lista de Produtos */}
          <div className="sm:col-span-3 relative flex items-center bg-white border border-slate-200 rounded-xl px-3 h-10">
            <Barcode className="w-4 h-4 text-slate-400 shrink-0 mr-1.5" />
            <select
              id="select-filtro-sku-base"
              value={filtroSku}
              onChange={(e) => setFiltroSku(e.target.value)}
              className="w-full text-xs sm:text-sm bg-transparent focus:outline-none text-slate-800 font-medium cursor-pointer truncate"
              title="Filtrar por SKU da lista de produtos cadastrados"
            >
              <option value="todos">Todos os SKUs ({opcoesSku.length})</option>
              {opcoesSku.map((item) => (
                <option key={item.key} value={item.codigo}>
                  {item.codigo} - {item.nome} {item.industria ? `(${item.industria})` : ''}
                </option>
              ))}
            </select>
            {filtroSku !== 'todos' && filtroSku !== '' && (
              <button
                type="button"
                onClick={() => setFiltroSku('todos')}
                className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer font-bold text-xs"
                title="Limpar SKU"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro de Indústria */}
          <div className="sm:col-span-4 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 h-10">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={industriaFiltro}
              onChange={(e) => handleMudarIndustria(e.target.value)}
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
                <th className="py-3 px-4 text-center">Data Cadastro</th>
                <th className="py-3 px-3 text-center">Dias Cadastrado</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produtosPaginados.map((prod, idx) => {
                const chave = `${prod.nome.trim().toLowerCase()}_${prod.industria.trim().toLowerCase()}`;
                const totalValidades = contagemValidadesPorProduto.get(chave) || 0;
                const infoCad = calcularDiasDesdeAdicao(prod.created_at);

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

                    {/* Data de Cadastro */}
                    <td className="py-3 px-4 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                      {infoCad.dataFormatada}
                    </td>

                    {/* Dias Cadastrado */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {infoCad.rotulo}
                      </span>
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

      {/* Barra de Paginação para Grandes Volumes (> 2.000 produtos) */}
      {produtosFiltrados.length > 0 && (
        <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            <span>
              Exibindo{' '}
              <strong>
                {itensPorPagina === -1
                  ? `1 a ${produtosFiltrados.length}`
                  : `${Math.min((paginaValida - 1) * itensPorPagina + 1, produtosFiltrados.length)} a ${Math.min(
                      paginaValida * itensPorPagina,
                      produtosFiltrados.length
                    )}`}
              </strong>{' '}
              de <strong>{produtosFiltrados.length}</strong> produtos
              {produtosFiltrados.length !== produtosCatalogo.length && (
                <span className="text-slate-400"> (de {produtosCatalogo.length} na base)</span>
              )}
            </span>

            {/* Seletor de itens por página */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <span className="text-slate-500">Por página:</span>
              <select
                value={itensPorPagina}
                onChange={(e) => setItensPorPagina(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={-1}>Todos ({produtosFiltrados.length})</option>
              </select>
            </div>
          </div>

          {itensPorPagina !== -1 && totalPaginas > 1 && (
            <div className="flex items-center gap-1">
              {/* Primeira */}
              <button
                type="button"
                onClick={() => setPaginaAtual(1)}
                disabled={paginaValida <= 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                title="Primeira Página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              {/* Anterior */}
              <button
                type="button"
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                disabled={paginaValida <= 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Info Página */}
              <div className="px-3 py-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                Página {paginaValida} de {totalPaginas}
              </div>

              {/* Próxima */}
              <button
                type="button"
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaValida >= totalPaginas}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                title="Próxima Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Última */}
              <button
                type="button"
                onClick={() => setPaginaAtual(totalPaginas)}
                disabled={paginaValida >= totalPaginas}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                title="Última Página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

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
