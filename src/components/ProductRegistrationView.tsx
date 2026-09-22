import React, { useState, useMemo, useRef } from 'react';
import {
  PackagePlus,
  Barcode,
  Building2,
  Package,
  Database,
  Cloud,
  CloudCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Sparkles,
  CalendarPlus,
  ArrowRight,
  ClipboardPaste,
  HelpCircle,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import { ProdutoCatalogo, SupabaseConfig } from '../types';
import {
  exportarProdutosCatalogoParaExcel,
  baixarModeloCadastroProdutosExcel,
  importarProdutosDeExcel,
} from '../lib/excel';

interface ProductRegistrationViewProps {
  produtosCatalogo: ProdutoCatalogo[];
  existingIndustries: string[];
  supabaseConfig: SupabaseConfig;
  onAddProduto: (produto: { codigo?: string; nome: string; industria: string; unidade_padrao?: string }) => Promise<{ success: boolean; fromSupabase: boolean; error?: string; warning?: string }>;
  onAddBatchProdutos: (produtos: Array<{ codigo?: string; nome: string; industria: string; unidade_padrao?: string }>) => Promise<{ success: boolean; count: number; fromSupabase: boolean; error?: string; warning?: string }>;
  onDeleteProduto: (produtoNome: string, industria: string, produtoId?: string) => Promise<void>;
  onSyncPending: () => Promise<void>;
  onSelectProductToLaunch: (produto: string, industria: string, codigo?: string, unidade?: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSupabaseModal: () => void;
}

export const ProductRegistrationView: React.FC<ProductRegistrationViewProps> = ({
  produtosCatalogo,
  existingIndustries,
  supabaseConfig,
  onAddProduto,
  onAddBatchProdutos,
  onDeleteProduto,
  onSyncPending,
  onSelectProductToLaunch,
  onRefresh,
  isRefreshing,
  onOpenSupabaseModal,
}) => {
  // Estado do formulário individual
  const [codigo, setCodigo] = useState('');
  const [industria, setIndustria] = useState('');
  const [produto, setProduto] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de busca e filtros da lista
  const [busca, setBusca] = useState('');
  const [filtroIndustria, setFiltroIndustria] = useState('todas');
  const [filtroSync, setFiltroSync] = useState<'todos' | 'sincronizados' | 'pendentes'>('todos');

  // Modo lote / importação
  const [modoLoteAberto, setModoLoteAberto] = useState(false);
  const [textoColar, setTextoColar] = useState('');
  const [produtosLotePreview, setProdutosLotePreview] = useState<Array<{ codigo?: string; industria: string; produto: string; unidade?: string }>>([]);
  const [isImportingFile, setIsImportingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SQL helper modal/accordion
  const [mostrarAjudaSql, setMostrarAjudaSql] = useState(false);
  const [copiouSql, setCopiouSql] = useState(false);
  const [copiouAlterSql, setCopiouAlterSql] = useState(false);

  // Mensagem local de feedback
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; mensagem: string } | null>(null);

  const dispararFeedback = (tipo: 'sucesso' | 'erro' | 'aviso', mensagem: string) => {
    setFeedback({ tipo, mensagem });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Indústrias unificadas para sugestão
  const todasIndustrias = useMemo(() => {
    const set = new Set<string>();
    existingIndustries.forEach((i) => i?.trim() && set.add(i.trim()));
    produtosCatalogo.forEach((p) => p.industria?.trim() && set.add(p.industria.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingIndustries, produtosCatalogo]);

  // Contagem de pendentes
  const totalPendentes = useMemo(() => {
    return produtosCatalogo.filter((p) => p.syncedToSupabase === false).length;
  }, [produtosCatalogo]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return produtosCatalogo.filter((p) => {
      if (filtroIndustria !== 'todas' && p.industria !== filtroIndustria) {
        return false;
      }
      if (filtroSync === 'sincronizados' && p.syncedToSupabase === false) {
        return false;
      }
      if (filtroSync === 'pendentes' && p.syncedToSupabase !== false) {
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
  }, [produtosCatalogo, busca, filtroIndustria, filtroSync]);

  // Submissão do produto individual
  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto.trim()) {
      dispararFeedback('aviso', 'O nome do produto é obrigatório.');
      return;
    }
    if (!industria.trim()) {
      dispararFeedback('aviso', 'A indústria ou marca do produto é obrigatória.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onAddProduto({
        codigo: codigo.trim() || undefined,
        industria: industria.trim(),
        nome: produto.trim(),
        unidade_padrao: unidade.trim() || 'un',
      });

      if (res.success) {
        if (res.fromSupabase) {
          if (res.warning) {
            dispararFeedback(
              'aviso',
              `Produto "${produto.trim()}" cadastrado no Supabase! ${res.warning}`
            );
          } else {
            dispararFeedback(
              'sucesso',
              `Produto "${produto.trim()}" cadastrado e salvo com sucesso no Supabase!`
            );
          }
        } else {
          dispararFeedback(
            'aviso',
            `Produto salvo localmente. ${res.error ? `Aviso Supabase: ${res.error}` : 'Conecte o Supabase para sincronizar.'}`
          );
        }
        // Limpa formulário
        setProduto('');
        setCodigo('');
      } else {
        dispararFeedback('erro', res.error || 'Erro ao cadastrar produto.');
      }
    } catch (err: any) {
      dispararFeedback('erro', err.message || 'Falha ao processar cadastro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Parser para texto colado
  const processarTextoColado = (texto: string) => {
    if (!texto.trim()) {
      setProdutosLotePreview([]);
      return;
    }

    const linhas = texto.split('\n').filter((l) => l.trim().length > 0);
    const resultado: Array<{ codigo?: string; industria: string; produto: string; unidade?: string }> = [];

    for (const linha of linhas) {
      // Ignora possíveis cabeçalhos
      if (
        linha.toLowerCase().includes('código') &&
        linha.toLowerCase().includes('produto')
      ) {
        continue;
      }

      // Tenta dividir por ponto-e-vírgula, tabulação ou pipe
      let partes = linha.split('\t');
      if (partes.length < 2) partes = linha.split(';');
      if (partes.length < 2) partes = linha.split('|');
      if (partes.length < 2) partes = linha.split(',');

      partes = partes.map((p) => p.trim());

      if (partes.length >= 3) {
        // Formato: Código | Indústria | Produto
        resultado.push({
          codigo: partes[0] || undefined,
          industria: partes[1] || 'Geral',
          produto: partes[2],
          unidade: partes[3] || 'un',
        });
      } else if (partes.length === 2) {
        // Formato: Indústria | Produto ou Código | Produto
        if (/^\d{6,}$/.test(partes[0])) {
          resultado.push({
            codigo: partes[0],
            industria: industria || 'Geral',
            produto: partes[1],
            unidade: 'un',
          });
        } else {
          resultado.push({
            industria: partes[0],
            produto: partes[1],
            unidade: 'un',
          });
        }
      } else if (partes.length === 1 && partes[0]) {
        resultado.push({
          industria: industria || 'Geral',
          produto: partes[0],
          unidade: 'un',
        });
      }
    }

    setProdutosLotePreview(resultado);
  };

  // Importar planilha Excel
  const handleArquivoExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingFile(true);
    try {
      const extraidos = await importarProdutosDeExcel(file);
      if (extraidos.length === 0) {
        dispararFeedback('aviso', 'Nenhum produto válido encontrado no arquivo.');
      } else {
        setProdutosLotePreview(extraidos);
        setModoLoteAberto(true);
        dispararFeedback('sucesso', `${extraidos.length} produto(s) carregados da planilha! Revise e confirme.`);
      }
    } catch (err: any) {
      dispararFeedback('erro', `Erro ao ler planilha: ${err.message}`);
    } finally {
      setIsImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Salvar lote completo
  const handleSalvarLote = async () => {
    if (produtosLotePreview.length === 0) return;
    setIsSubmitting(true);

    try {
      const res = await onAddBatchProdutos(
        produtosLotePreview.map((p) => ({
          codigo: p.codigo != null && String(p.codigo).trim() ? String(p.codigo).trim() : undefined,
          industria: p.industria || 'Geral',
          nome: p.produto,
          unidade_padrao: p.unidade || 'un',
        }))
      );

      if (res.success) {
        if (res.warning) {
          dispararFeedback(
            'aviso',
            `${res.count} produto(s) cadastrados no Supabase! ${res.warning}`
          );
        } else {
          dispararFeedback(
            'sucesso',
            `${res.count} produto(s) cadastrados com sucesso ${res.fromSupabase ? 'e enviados para o Supabase' : 'localmente'}!`
          );
        }
        setProdutosLotePreview([]);
        setTextoColar('');
        setModoLoteAberto(false);
      } else {
        dispararFeedback('erro', res.error || 'Erro ao salvar produtos em lote.');
      }
    } catch (err: any) {
      dispararFeedback('erro', err.message || 'Falha ao salvar produtos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const productTable = supabaseConfig.productTableName ? supabaseConfig.productTableName.trim() : 'produtos';

  // Script SQL para ajustar a tabela existente e corrigir erro de NOT NULL em industria_nome / industria
  const scriptAlterSql = `-- 1. Define valor padrão 'Geral' para 'industria_nome' (evita erro de NOT NULL):
ALTER TABLE ${productTable} ALTER COLUMN industria_nome SET DEFAULT 'Geral';

-- 2. Adiciona as colunas 'industria_nome', 'industria', 'codigo' e 'unidade_padrao' se faltarem:
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS industria_nome TEXT DEFAULT 'Geral';
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS industria TEXT;
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS unidade_padrao TEXT DEFAULT 'un';

-- 3. Atualiza eventuais registros nulos para 'Geral':
UPDATE ${productTable} SET industria_nome = 'Geral' WHERE industria_nome IS NULL;

-- 4. Recarrega o cache do PostgREST / Supabase:
NOTIFY pgrst, 'reload schema';`;

  // Script SQL completo
  const scriptSql = `-- 1. SE A TABELA JÁ EXISTE (Ajuste rápido de colunas e NOT NULL):
ALTER TABLE ${productTable} ALTER COLUMN industria_nome SET DEFAULT 'Geral';
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS industria_nome TEXT DEFAULT 'Geral';
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS industria TEXT;
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE ${productTable} ADD COLUMN IF NOT EXISTS unidade_padrao TEXT DEFAULT 'un';
UPDATE ${productTable} SET industria_nome = 'Geral' WHERE industria_nome IS NULL;
NOTIFY pgrst, 'reload schema';

-- 2. OU SE DESEJA CRIAR A TABELA DO ZERO:
CREATE TABLE IF NOT EXISTS ${productTable} (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  codigo TEXT,
  industria_nome TEXT NOT NULL DEFAULT 'Geral',
  industria TEXT,
  nome TEXT NOT NULL,
  unidade_padrao TEXT DEFAULT 'un',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(industria_nome, nome)
);

-- Ativar permissão de leitura e gravação (RLS):
ALTER TABLE ${productTable} ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total produtos" ON ${productTable};
CREATE POLICY "Acesso total produtos" ON ${productTable}
  FOR ALL
  USING (true)
  WITH CHECK (true);`;

  const copiarSql = () => {
    navigator.clipboard.writeText(scriptSql);
    setCopiouSql(true);
    setTimeout(() => setCopiouSql(false), 3000);
  };

  const copiarAlterSql = () => {
    navigator.clipboard.writeText(scriptAlterSql);
    setCopiouAlterSql(true);
    setTimeout(() => setCopiouAlterSql(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Banner de Feedback Interno */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium animate-fade-in ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : feedback.tipo === 'erro'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {feedback.tipo === 'erro' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {feedback.tipo === 'aviso' && <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />}
            <span>{feedback.mensagem}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cabeçalho da Aba de Cadastro de Produtos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Cadastro de Produtos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {produtosCatalogo.length} cadastrado{produtosCatalogo.length === 1 ? '' : 's'}
                </span>
                {totalPendentes > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Cloud className="w-3 h-3 text-amber-600" />
                    {totalPendentes} pendente{totalPendentes > 1 ? 's' : ''} de envio
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Cadastre o catálogo mestre de produtos (<strong>Código</strong>, <strong>Indústria</strong> e <strong>Produto</strong>) com sincronização e exportação direta para o <strong>Supabase</strong>.
              </p>
            </div>
          </div>

          {/* Botões de Ação Global da Aba */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Supabase */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                supabaseConfig.isConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {supabaseConfig.isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Supabase: Conectado</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold bg-white px-1.5 py-0.5 rounded">
                    {supabaseConfig.productTableName || 'produtos'}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Supabase: Desconectado</span>
                </>
              )}
            </div>

            {/* Sincronizar Pendentes se houver */}
            {totalPendentes > 0 && supabaseConfig.isConnected && (
              <button
                type="button"
                onClick={onSyncPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-lg shadow-xs transition cursor-pointer"
                title="Enviar produtos salvos localmente para o banco Supabase"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Enviar {totalPendentes} p/ Supabase</span>
              </button>
            )}

            {/* Exportar para Excel */}
            <button
              type="button"
              onClick={() => {
                if (produtosCatalogo.length === 0) {
                  dispararFeedback('aviso', 'Nenhum produto cadastrado para exportar.');
                  return;
                }
                exportarProdutosCatalogoParaExcel(produtosCatalogo);
                dispararFeedback('sucesso', 'Planilha de produtos exportada em Excel (.xlsx)!');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition cursor-pointer"
              title="Baixar lista completa de produtos em planilha Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>

            {/* Recarregar */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
              title="Recarregar produtos do banco de dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Formulário de Cadastro Principal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-linear-to-r from-slate-50/80 to-blue-50/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Novo Produto no Catálogo</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Envia automaticamente para a tabela Supabase)
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Informe o código de barras ou SKU, a indústria/marca e o nome do produto.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModoLoteAberto(!modoLoteAberto)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                  modoLoteAberto
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>{modoLoteAberto ? 'Fechar Cadastro em Lote' : 'Cadastrar em Lote / Planilha'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMostrarAjudaSql(!mostrarAjudaSql)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                title="Ver comando SQL do Supabase"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>SQL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bloco de Ajuda SQL Colapsável */}
        {mostrarAjudaSql && (
          <div className="p-4 bg-slate-900 text-slate-100 text-xs border-b border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-white">Comandos SQL para o Supabase</span>
              </div>
              <button
                type="button"
                onClick={() => setMostrarAjudaSql(false)}
                className="text-slate-400 hover:text-white px-1 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Caixa de Solução Rápida: Ajustar colunas 'industria_nome' / 'industria' */}
            <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 text-xs">
                  🔧 Solução: Ajustar 'industria_nome' e 'industria' na tabela '{productTable}'
                </span>
                <button
                  type="button"
                  onClick={copiarAlterSql}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded text-[11px] font-bold transition cursor-pointer"
                >
                  {copiouAlterSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiouAlterSql ? 'Copiado!' : 'Copiar Comando SQL'}</span>
                </button>
              </div>
              <p className="text-slate-300 text-[11px]">
                Se o Supabase informar erro de <code className="text-amber-200 font-mono font-bold">violates not-null constraint ("industria_nome")</code> ou coluna ausente, execute este script no <strong>SQL Editor</strong> do painel do Supabase:
              </p>
              <pre className="p-2 bg-black/60 rounded text-amber-200 font-mono text-[11px] overflow-x-auto select-all">
                {scriptAlterSql}
              </pre>
            </div>

            {/* Script Completo para Nova Tabela */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-slate-300">
                  Ou crie a tabela completa do zero com RLS ativo:
                </span>
                <button
                  type="button"
                  onClick={copiarSql}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                >
                  {copiouSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiouSql ? 'Copiado!' : 'Copiar Script Completo'}</span>
                </button>
              </div>
              <pre className="p-3 bg-black/50 rounded-lg text-emerald-300 font-mono text-[11px] overflow-x-auto select-all">
                {scriptSql}
              </pre>
            </div>
          </div>
        )}

        {/* Cadastro em Lote Expansível */}
        {modoLoteAberto && (
          <div className="p-4 sm:p-5 bg-blue-50/40 border-b border-blue-100">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ClipboardPaste className="w-4 h-4 text-blue-600" />
                    <span>Importar Múltiplos Produtos (Colar ou Arquivo Excel)</span>
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Cole várias linhas no formato: <code className="bg-white px-1 py-0.5 rounded text-blue-700 font-bold font-mono">Código ; Indústria ; Produto</code> ou carregue uma planilha.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={baixarModeloCadastroProdutosExcel}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-blue-600" />
                    <span>Baixar Modelo Excel</span>
                  </button>

                  <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-md transition cursor-pointer">
                    <Upload className="w-3 h-3 text-emerald-600" />
                    <span>Subir Planilha</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      className="hidden"
                      onChange={handleArquivoExcel}
                      disabled={isImportingFile}
                    />
                  </label>
                </div>
              </div>

              {/* Caixa de Texto para Colar */}
              <div>
                <textarea
                  rows={4}
                  value={textoColar}
                  onChange={(e) => {
                    setTextoColar(e.target.value);
                    processarTextoColado(e.target.value);
                  }}
                  placeholder="Exemplo para colar:
7891000100103 ; Nestlé ; Leite Condensado Moça 395g
7891991010834 ; Ambev ; Cerveja Spaten Lata 350ml
7891079012345 ; Bauducco ; Biscoito Recheado Chocooky 120g"
                  className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Pré-visualização do Lote */}
              {produtosLotePreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      Pré-visualização: {produtosLotePreview.length} produto(s) identificado(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProdutosLotePreview([]);
                        setTextoColar('');
                      }}
                      className="text-red-600 hover:underline cursor-pointer"
                    >
                      Limpar Lote
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Código</th>
                          <th className="py-2 px-3">Indústria</th>
                          <th className="py-2 px-3">Produto</th>
                          <th className="py-2 px-3">Un.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {produtosLotePreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono text-slate-600">{item.codigo || '-'}</td>
                            <td className="py-1.5 px-3 font-medium text-slate-800">{item.industria}</td>
                            <td className="py-1.5 px-3 text-slate-900 font-semibold">{item.produto}</td>
                            <td className="py-1.5 px-3 text-slate-500 font-mono">{item.unidade || 'un'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSalvarLote}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>{isSubmitting ? 'Salvando...' : `Confirmar e Enviar Todos (${produtosLotePreview.length}) para o Supabase`}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Formulário Individual */}
        <form onSubmit={handleSubmitIndividual} className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
            {/* Campo 1: Código (EAN / SKU) */}
            <div className="sm:col-span-3">
              <label htmlFor="prod-codigo" className="block text-xs font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Barcode className="w-3.5 h-3.5 text-blue-600" />
                  <span>Código (EAN / SKU)</span>
                </span>
              </label>
              <div className="relative">
                <input
                  id="prod-codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: 7891000100103"
                  className="w-full px-3 h-10 text-xs sm:text-sm font-mono bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Campo 2: Indústria / Marca */}
            <div className="sm:col-span-4">
              <label htmlFor="prod-industria" className="block text-xs font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Indústria / Marca <span className="text-red-500">*</span></span>
                </span>
              </label>
              <div className="relative">
                <input
                  id="prod-industria"
                  type="text"
                  list="lista-industrias-cadastro"
                  value={industria}
                  onChange={(e) => setIndustria(e.target.value)}
                  placeholder="Ex: Nestlé, Ambev, Bauducco..."
                  required
                  className="w-full px-3 h-10 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                <datalist id="lista-industrias-cadastro">
                  {todasIndustrias.map((ind) => (
                    <option key={ind} value={ind} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Campo 3: Nome do Produto */}
            <div className="sm:col-span-3">
              <label htmlFor="prod-nome" className="block text-xs font-bold text-slate-700 mb-1">
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nome do Produto <span className="text-red-500">*</span></span>
                </span>
              </label>
              <input
                id="prod-nome"
                type="text"
                value={produto}
                onChange={(e) => setProduto(e.target.value)}
                placeholder="Ex: Leite Condensado Moça 395g"
                required
                className="w-full px-3 h-10 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Campo 4: Unidade Padrão */}
            <div className="sm:col-span-2">
              <label htmlFor="prod-unidade" className="block text-xs font-bold text-slate-700 mb-1">
                <span>Unidade</span>
              </label>
              <select
                id="prod-unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full px-3 h-10 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition cursor-pointer"
              >
                <option value="un">un (Unidade)</option>
                <option value="cx">cx (Caixa)</option>
                <option value="fardo">fardo</option>
                <option value="pct">pct (Pacote)</option>
                <option value="kg">kg (Quilo)</option>
                <option value="display">display</option>
                <option value="lt">lt (Lata)</option>
                <option value="fd">fd (Fardo)</option>
              </select>
            </div>
          </div>

          {/* Chips Rápidos de Indústrias */}
          {todasIndustrias.length > 0 && !industria && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-600">Sugestões de marcas:</span>
              {todasIndustrias.slice(0, 6).map((ind) => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => setIndustria(ind)}
                  className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-600 transition cursor-pointer"
                >
                  {ind}
                </button>
              ))}
            </div>
          )}

          {/* Botões do Formulário Individual */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Ao salvar, o produto fica imediatamente disponível no autocomplete de cadastro de validades e é enviado ao Supabase.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setCodigo('');
                  setIndustria('');
                  setProduto('');
                  setUnidade('un');
                }}
                className="w-1/2 sm:w-auto px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Limpar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-1/2 sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isSubmitting ? 'Salvando...' : 'Salvar no Supabase'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Lista e Tabela de Produtos Cadastrados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Barra de Filtros e Busca */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-linear-to-r from-slate-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Produtos Cadastrados
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                ({produtosFiltrados.length} de {produtosCatalogo.length})
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFiltroSync('todos')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filtroSync === 'todos' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroSync('sincronizados')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filtroSync === 'sincronizados' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                No Supabase
              </button>
              <button
                type="button"
                onClick={() => setFiltroSync('pendentes')}
                className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                  filtroSync === 'pendentes' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendentes ({totalPendentes})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Campo de Busca */}
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nome do produto, código de barras ou marca..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 h-10 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Filtro de Indústria */}
            <div className="sm:col-span-4 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 h-10">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={filtroIndustria}
                onChange={(e) => setFiltroIndustria(e.target.value)}
                className="w-full text-xs sm:text-sm bg-transparent focus:outline-none text-slate-700 font-medium cursor-pointer"
              >
                <option value="todas">Todas as Indústrias ({todasIndustrias.length})</option>
                {todasIndustrias.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Produtos */}
        <div className="overflow-x-auto">
          {produtosFiltrados.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">
                {produtosCatalogo.length === 0
                  ? 'Nenhum produto cadastrado no catálogo ainda'
                  : 'Nenhum produto encontrado com os filtros'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {produtosCatalogo.length === 0
                  ? 'Use o formulário acima para cadastrar seu primeiro produto com código, indústria e nome, enviando diretamente para o Supabase.'
                  : 'Tente alterar os termos da busca ou selecionar outra indústria.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Código (EAN/SKU)</th>
                  <th className="py-3 px-4">Produto</th>
                  <th className="py-3 px-4">Indústria / Marca</th>
                  <th className="py-3 px-4 text-center">Un.</th>
                  <th className="py-3 px-4 text-center">Status Supabase</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtosFiltrados.map((item, idx) => (
                  <tr key={`${item.nome}-${item.industria}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    {/* Código */}
                    <td className="py-3 px-4">
                      {item.codigo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs font-semibold rounded border border-blue-100">
                          <Barcode className="w-3 h-3 text-blue-500" />
                          {item.codigo}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Sem código</span>
                      )}
                    </td>

                    {/* Nome do Produto */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                        {item.nome}
                      </div>
                    </td>

                    {/* Indústria */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-md">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {item.industria || 'Geral'}
                      </span>
                    </td>

                    {/* Unidade */}
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-mono text-slate-600 font-medium">
                        {item.unidade_padrao || 'un'}
                      </span>
                    </td>

                    {/* Status Supabase */}
                    <td className="py-3 px-4 text-center">
                      {item.syncedToSupabase === false ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-semibold rounded-full border border-amber-200">
                          <Cloud className="w-3 h-3 text-amber-600" />
                          Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[11px] font-semibold rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          No Supabase
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Lançar Validade */}
                        <button
                          type="button"
                          onClick={() =>
                            onSelectProductToLaunch(
                              item.nome,
                              item.industria || 'Geral',
                              item.codigo,
                              item.unidade_padrao || 'un'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer active:scale-95"
                          title="Lançar lote e data de vencimento deste produto"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Lançar Validade</span>
                        </button>

                        {/* Excluir Produto */}
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              window.confirm(
                                `Deseja remover o produto "${item.nome}" do catálogo e do banco Supabase?`
                              )
                            ) {
                              await onDeleteProduto(item.nome, item.industria, item.id);
                              dispararFeedback('sucesso', `"${item.nome}" removido com sucesso.`);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Excluir produto do catálogo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé da Tabela */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Tabela configurada no Supabase: <strong>{supabaseConfig.productTableName || 'produtos'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenSupabaseModal}
              className="text-blue-600 hover:underline font-semibold cursor-pointer"
            >
              Configurar Conexão do Supabase
            </button>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-slate-700">
              Total: {produtosCatalogo.length} produto(s)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
