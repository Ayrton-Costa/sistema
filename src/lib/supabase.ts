import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ItemValidade, ProdutoCatalogo, SupabaseConfig } from '../types';

const STORAGE_CONFIG_KEY = 'validade_supabase_config';
const STORAGE_ITEMS_KEY = 'validade_local_items';
const STORAGE_CATALOGO_KEY = 'validade_catalogo_local';

// Limpa e normaliza a URL do Supabase para evitar erros de caminho como PGRST125
export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  // Se o usuário colou a URL do dashboard, extrai apenas o subdomínio do projeto
  const projectRefMatch = url.match(/app\.supabase\.com\/project\/([a-zA-Z0-9_-]+)/) ||
                          url.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (projectRefMatch && projectRefMatch[1]) {
    url = `https://${projectRefMatch[1]}.supabase.co`;
  }
  
  // Remove caminhos acidentais adicionados no final como /rest/v1, /v1, /auth, etc.
  url = url.replace(/\/rest\/v1\/?$/, '')
           .replace(/\/rest\/?$/, '')
           .replace(/\/v1\/?$/, '')
           .replace(/\/+$/, '');

  // Garante o protocolo https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url;
}

export function cleanTableName(rawTable: string): string {
  if (!rawTable) return 'validades';
  let t = rawTable.trim();
  // Remove barras, esquemas como 'public.' ou aspas acidentais
  t = t.replace(/^public\./i, '').replace(/["'`/]/g, '').trim();
  return t || 'validades';
}

function getFutureDateString(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

export function getStoredSupabaseConfig(): SupabaseConfig {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  try {
    const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const url = cleanSupabaseUrl(parsed.url || envUrl);
      const tableName = cleanTableName(parsed.tableName || 'validades');
      const productTableName = parsed.productTableName ? cleanTableName(parsed.productTableName) : undefined;
      const anonKey = (parsed.anonKey || envKey).trim();
      return {
        url,
        anonKey,
        tableName,
        productTableName,
        isConnected: Boolean(parsed.isConnected && url && anonKey),
      };
    }
  } catch (err) {
    console.error('Erro ao ler config do Supabase do localStorage', err);
  }

  const url = cleanSupabaseUrl(envUrl);
  const anonKey = envKey.trim();
  return {
    url,
    anonKey,
    tableName: 'validades',
    isConnected: Boolean(url && anonKey),
  };
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  const current = getStoredSupabaseConfig();
  const updated: SupabaseConfig = {
    url: config.url !== undefined ? cleanSupabaseUrl(config.url) : current.url,
    anonKey: config.anonKey !== undefined ? config.anonKey.trim() : current.anonKey,
    tableName: config.tableName !== undefined ? cleanTableName(config.tableName) : current.tableName,
    productTableName: config.productTableName !== undefined ? (config.productTableName ? cleanTableName(config.productTableName) : undefined) : current.productTableName,
    isConnected: config.isConnected !== undefined ? Boolean(config.isConnected) : current.isConnected,
  };
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

let cachedClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  const cfg = config || getStoredSupabaseConfig();
  const url = cleanSupabaseUrl(cfg.url);
  const key = cfg.anonKey ? cfg.anonKey.trim() : '';

  if (!url || !key) {
    return null;
  }

  if (cachedClient && currentClientUrl === url && currentClientKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key);
    currentClientUrl = url;
    currentClientKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Falha ao inicializar cliente Supabase:', err);
    return null;
  }
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string,
  tableName = 'validades',
  productTableName?: string
): Promise<{ success: boolean; message: string; produtosCount?: number; validadesCount?: number }> {
  const cleanUrl = cleanSupabaseUrl(url);
  const cleanKey = anonKey.trim();
  const cleanTable = cleanTableName(tableName);
  const cleanProdTable = productTableName ? cleanTableName(productTableName) : null;

  if (!cleanUrl || !cleanKey) {
    return { success: false, message: 'URL e Chave Anônima do Supabase são obrigatórias.' };
  }

  // Verifica se o usuário colou uma URL inválida
  try {
    const parsedUrl = new URL(cleanUrl);
    if (!parsedUrl.hostname.endsWith('supabase.co')) {
      return {
        success: false,
        message: `A URL "${cleanUrl}" não é a Project URL do Supabase. A URL correta é encontrada no painel em Project Settings > API e tem o formato: https://[seu-projeto-id].supabase.co (sem /rest/v1 ou outros caminhos no final).`,
      };
    }
  } catch {
    return {
      success: false,
      message: 'Formato de URL inválido. A URL correta é no formato: https://[seu-projeto-id].supabase.co',
    };
  }

  try {
    const client = createClient(cleanUrl, cleanKey);
    
    // Testa consulta com contagem total de registros na tabela principal
    const { count, data, error } = await client
      .from(cleanTable)
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message: `Conectou ao seu projeto Supabase, mas a tabela "${cleanTable}" não foi encontrada. Verifique se o nome está correto ou execute o script SQL abaixo no SQL Editor do Supabase para criá-la.`,
        };
      }
      if (error.code === 'PGRST125') {
        return {
          success: false,
          message: `Erro de caminho inválido (PGRST125). A URL do Supabase configurada tinha caminhos extras. O sistema corrigiu para "${cleanUrl}". Clique em "Salvar e Conectar" para aplicar.`,
        };
      }
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('apikey')) {
        return {
          success: false,
          message: `Chave de API inválida ou expirada. Use a chave "anon public" em Project Settings > API do seu painel Supabase.`,
        };
      }
      return { 
        success: false, 
        message: `Erro ao acessar a tabela "${cleanTable}": ${error.message} (Código: ${error.code || 'RLS/Permissão'}). Verifique se as políticas RLS foram aplicadas.` 
      };
    }

    const totalLinhasValidades = count !== null ? count : (data ? data.length : 0);

    // Também verifica a tabela de produtos para diagnóstico instantâneo
    let produtosEncontrados = 0;
    let tabelaProdutoUsada = '';
    const candidateTables = cleanProdTable
      ? [cleanProdTable, 'produtos', 'Produtos', 'tb_produtos', 'catalogo_produtos', 'produto']
      : ['produtos', 'Produtos', 'tb_produtos', 'catalogo_produtos', 'produto', 'catalogo'];

    for (const pTable of candidateTables) {
      try {
        const { count: pCount, error: pErr } = await client
          .from(pTable)
          .select('*', { count: 'exact', head: true });
        if (!pErr && pCount !== null) {
          produtosEncontrados = pCount;
          tabelaProdutoUsada = pTable;
          break;
        }
      } catch {
        // segue para a próxima
      }
    }

    let msg = `Conexão bem-sucedida! Tabela de validades "${cleanTable}" localizada com ${totalLinhasValidades} registro(s).`;
    if (tabelaProdutoUsada) {
      msg += ` Tabela de produtos "${tabelaProdutoUsada}" localizada com ${produtosEncontrados} produto(s) cadastrado(s)!`;
    } else {
      msg += ` Dica: Nenhuma tabela de produtos separada foi detectada automaticamente (você pode informar o nome exato no campo "Tabela de Produtos da Base").`;
    }

    return { 
      success: true, 
      message: msg,
      validadesCount: totalLinhasValidades,
      produtosCount: produtosEncontrados,
    };
  } catch (err: any) {
    return { 
      success: false, 
      message: `Falha na conexão: ${err.message || 'Verifique se a URL e a internet estão ativas.'}` 
    };
  }
}

// Helpers de persistência local
export function getLocalItems(): ItemValidade[] {
  try {
    const raw = localStorage.getItem(STORAGE_ITEMS_KEY);
    if (raw !== null) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Erro ao ler itens locais:', e);
  }
  // Se não existir, inicia zerado para começar a cadastrar
  localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify([]));
  return [];
}

export function saveLocalItems(items: ItemValidade[]) {
  try {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Erro ao salvar itens locais:', e);
  }
}

export function clearLocalItems() {
  try {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Erro ao zerar itens locais:', e);
  }
}

// Helpers de persistência local para Catálogo de Produtos
export function getLocalCatalogo(): ProdutoCatalogo[] {
  try {
    const raw = localStorage.getItem(STORAGE_CATALOGO_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((p: any) => ({
          ...p,
          codigo: p.codigo != null && String(p.codigo).trim() ? String(p.codigo).trim() : undefined,
          nome: String(p.nome || '').trim(),
          industria: String(p.industria || 'Geral').trim(),
          unidade_padrao: String(p.unidade_padrao || 'un').trim(),
        }));
      }
    }
  } catch (e) {
    console.error('Erro ao ler catálogo local:', e);
  }
  return [];
}

export function saveLocalCatalogo(produtos: ProdutoCatalogo[]) {
  try {
    const sanitized = produtos.map((p) => ({
      ...p,
      codigo: p.codigo != null && String(p.codigo).trim() ? String(p.codigo).trim() : undefined,
      nome: String(p.nome || '').trim(),
      industria: String(p.industria || 'Geral').trim(),
      unidade_padrao: String(p.unidade_padrao || 'un').trim(),
    }));
    localStorage.setItem(STORAGE_CATALOGO_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Erro ao salvar catálogo local:', e);
  }
}

function mergeLocalProdutosIntoCatalogo(
  remoteProdutos: ProdutoCatalogo[],
  industriasSet: Set<string>,
  prodsMap: Record<string, string[]>
): ProdutoCatalogo[] {
  const localList = getLocalCatalogo();
  const merged = [...remoteProdutos];

  for (const loc of localList) {
    const ind = String(loc.industria || 'Geral').trim();
    const prod = String(loc.nome || '').trim();
    if (!prod) continue;

    industriasSet.add(ind);
    const key = ind.toLowerCase();
    if (!prodsMap[key]) prodsMap[key] = [];
    if (!prodsMap[key].includes(prod)) {
      prodsMap[key].push(prod);
    }

    const existingIdx = merged.findIndex(
      (m) => m.nome.toLowerCase() === prod.toLowerCase() && m.industria.toLowerCase() === ind.toLowerCase()
    );

    const safeLocCod = loc.codigo != null && String(loc.codigo).trim() ? String(loc.codigo).trim() : undefined;

    if (existingIdx >= 0) {
      if (!merged[existingIdx].codigo && safeLocCod) {
        merged[existingIdx].codigo = safeLocCod;
      }
      if (!merged[existingIdx].id && loc.id) {
        merged[existingIdx].id = String(loc.id);
      }
      if (merged[existingIdx].syncedToSupabase === undefined) {
        merged[existingIdx].syncedToSupabase = true;
      }
    } else {
      merged.push({
        ...loc,
        codigo: safeLocCod,
        syncedToSupabase: loc.syncedToSupabase ?? false,
      });
    }
  }

  return merged;
}

// Operações integradas (Supabase com fallback seguro)
export async function fetchCatalogoRelacional(config: SupabaseConfig): Promise<{
  industrias: string[];
  produtosPorIndustria: Record<string, string[]>;
  produtosDetalhados?: ProdutoCatalogo[];
  coordenadores: string[];
  lojas: Array<{ nome: string; estado?: string; coordenador?: string }>;
}> {
  const client = getSupabaseClient(config);
  if (!client || !config.isConnected) {
    const localProds = getLocalCatalogo();
    const indSet = new Set<string>();
    const map: Record<string, string[]> = {};
    localProds.forEach((p) => {
      const ind = (p.industria || 'Geral').trim();
      indSet.add(ind);
      const k = ind.toLowerCase();
      if (!map[k]) map[k] = [];
      if (!map[k].includes(p.nome)) map[k].push(p.nome);
    });

    return {
      industrias: Array.from(indSet),
      produtosPorIndustria: map,
      produtosDetalhados: localProds,
      coordenadores: [],
      lojas: [],
    };
  }

  let coordenadoresList: string[] = [];
  try {
    // Busca coordenadores cadastrados na tabela dedicada de coordenadores (se existir)
    const { data: coordData, error: coordError } = await client
      .from('coordenadores')
      .select('nome')
      .order('nome', { ascending: true });

    if (!coordError && coordData && coordData.length > 0) {
      coordenadoresList = coordData.map((c: any) => c.nome?.trim()).filter(Boolean);
    }
  } catch (err) {
    // Silencioso se a tabela coordenadores ainda não foi criada
  }

  let lojasList: Array<{ nome: string; estado?: string; coordenador?: string }> = [];
  try {
    // Busca lojas cadastradas na tabela dedicada de lojas (se existir)
    const { data: lojasData, error: lojasError } = await client
      .from('lojas')
      .select('nome, estado, coordenador')
      .order('nome', { ascending: true });

    if (!lojasError && lojasData && lojasData.length > 0) {
      lojasList = lojasData
        .filter((l: any) => Boolean(l.nome?.trim()))
        .map((l: any) => ({
          nome: l.nome.trim(),
          estado: l.estado?.trim() || undefined,
          coordenador: l.coordenador?.trim() || undefined,
        }));
    }
  } catch (err) {
    // Silencioso se a tabela lojas ainda não foi criada
  }

  const produtosDetalhadosList: ProdutoCatalogo[] = [];

  try {
    // 1. Tenta buscar da view ou tabela relacional produtos + industrias
    try {
      const { data: viewData, error: viewError } = await client
        .from('view_produtos_por_industria')
        .select('*');

      if (!viewError && viewData && viewData.length > 0) {
        const industriasSet = new Set<string>();
        const prodsMap: Record<string, string[]> = {};

        viewData.forEach((row: any) => {
          const ind = String(row.industria || row.industria_nome || '').trim();
          const prod = String(row.produto || row.nome || '').trim();
          const rawCod = row.codigo ?? row.codigo_barras ?? row.ean ?? row.sku;
          const cod = rawCod != null && String(rawCod).trim() ? String(rawCod).trim() : undefined;

          if (ind) {
            industriasSet.add(ind);
            const indKey = ind.toLowerCase();
            if (!prodsMap[indKey]) prodsMap[indKey] = [];
            if (prod && !prodsMap[indKey].includes(prod)) {
              prodsMap[indKey].push(prod);
            }
          }

          if (prod) {
            produtosDetalhadosList.push({
              codigo: cod,
              nome: prod,
              industria: ind,
              unidade_padrao: String(row.unidade_padrao || row.unidade || 'un').trim(),
            });
          }
        });

        if (produtosDetalhadosList.length > 0) {
          const finalProds = mergeLocalProdutosIntoCatalogo(produtosDetalhadosList, industriasSet, prodsMap);
          return {
            industrias: Array.from(industriasSet),
            produtosPorIndustria: prodsMap,
            produtosDetalhados: finalProds,
            coordenadores: coordenadoresList,
            lojas: lojasList,
          };
        }
      }
    } catch {
      // Continua para tentar diretamente as tabelas produtos e industrias
    }

    // 2. Consulta diretamente a tabela "produtos" (e variações de nome de tabela)
    const industriasSet = new Set<string>();
    const prodsMap: Record<string, string[]> = {};

    // Busca indústrias cadastradas se a tabela existir
    const idToIndName: Record<string, string> = {};
    const candidateIndTables = ['industrias', 'Industrias', 'fabricantes', 'marcas'];
    for (const indTable of candidateIndTables) {
      try {
        const { data: indData, error: indErr } = await client
          .from(indTable)
          .select('*')
          .limit(2000);
        if (!indErr && indData && indData.length > 0) {
          indData.forEach((i: any) => {
            const nomeInd = (i.nome || i.industria || i.fabricante || i.marca || i.Nome || '').trim();
            if (nomeInd) {
              industriasSet.add(nomeInd);
              if (i.id) idToIndName[String(i.id)] = nomeInd;
            }
          });
          break;
        }
      } catch {
        // Tenta próxima tabela de indústrias
      }
    }

    // Busca produtos cadastrados na tabela "produtos"
    // Considera a tabela customizada configurada pelo usuário se houver, além da lista exaustiva de candidatos
    const configuredProdTable = config.productTableName ? cleanTableName(config.productTableName) : null;
    const candidateProdTables = [
      ...(configuredProdTable ? [configuredProdTable] : []),
      'produtos',
      'Produtos',
      'tb_produtos',
      'catalogo_produtos',
      'catalogo',
      'produto',
      'Produto',
      'products',
      'Products',
      'itens',
      'Itens',
      'itens_base',
      'base_produtos',
      'cad_produtos',
    ];

    // Remove duplicatas
    const uniqueCandidateProdTables = Array.from(new Set(candidateProdTables));

    for (const prodTable of uniqueCandidateProdTables) {
      try {
        const { data: prodData, error: prodErr } = await client
          .from(prodTable)
          .select('*')
          .limit(5000);

        if (prodErr) {
          if (configuredProdTable === prodTable) {
            console.warn(`[Supabase] Erro ao consultar tabela de produtos configurada "${prodTable}":`, prodErr);
          }
          continue;
        }

        if (prodData && prodData.length > 0) {
          console.log(`[Supabase] Produtos encontrados na tabela "${prodTable}": ${prodData.length} registro(s).`);
          prodData.forEach((p: any) => {
            // Mapeia o nome do produto com tolerância total a maiúsculas/minúsculas e variações de cabeçalho
            const prodNome = (
              p.nome ||
              p.produto ||
              p.descricao ||
              p.descricao_produto ||
              p.item ||
              p.title ||
              p.name ||
              p.Nome ||
              p.Produto ||
              p.PRODUTO ||
              p.DESCRICAO ||
              p.Descricao ||
              p.ITEM ||
              ''
            ).trim();

            if (!prodNome) return;

            // Mapeia indústria ou fabricante ou usa 'Geral'
            const rawIndNome =
              p.industria_nome ??
              p.industria ??
              p.fabricante ??
              p.marca ??
              p.fornecedor ??
              p.empresa ??
              p.Industria ??
              p.Marca ??
              p.Fabricante ??
              p.INDUSTRIA ??
              p.MARCA ??
              (p.industria_id ? idToIndName[String(p.industria_id)] : '') ??
              'Geral';
            const indNome = String(rawIndNome).trim() || 'Geral';

            // Mapeia código (EAN, SKU, código de barras, etc)
            const rawCod =
              p.codigo ??
              p.codigo_barras ??
              p.cod_barras ??
              p.ean ??
              p.sku ??
              p.cod ??
              p.Codigo ??
              p.CODIGO ??
              p.EAN ??
              p.SKU ??
              p.Cod;
            const cod = rawCod != null && String(rawCod).trim() ? String(rawCod).trim() : undefined;

            const rawUnid =
              p.unidade_padrao ??
              p.unidade ??
              p.un ??
              p.Unidade ??
              p.UNIDADE ??
              'un';
            const unid = String(rawUnid).trim() || 'un';

            industriasSet.add(indNome);
            const key = indNome.toLowerCase();
            if (!prodsMap[key]) prodsMap[key] = [];
            if (!prodsMap[key].includes(prodNome)) {
              prodsMap[key].push(prodNome);
            }

            // Evita duplicar na lista detalhada
            const jaExiste = produtosDetalhadosList.some(
              (it) => it.nome.toLowerCase() === prodNome.toLowerCase() && it.industria.toLowerCase() === indNome.toLowerCase()
            );
            if (!jaExiste) {
              produtosDetalhadosList.push({
                codigo: cod,
                nome: prodNome,
                industria: indNome,
                unidade_padrao: unid,
              });
            }
          });

          if (produtosDetalhadosList.length > 0) {
            break; // Encontrou e carregou produtos da base
          }
        }
      } catch (e) {
        // Tenta próxima tabela candidata
      }
    }

    // 3. Fallback adicional: se a tabela "produtos" ainda não tiver registros,
    // extrai todos os produtos únicos já lançados na tabela principal de validades
    if (produtosDetalhadosList.length === 0) {
      try {
        const { data: valData } = await client
          .from(config.tableName || 'validades')
          .select('codigo, produto, nome, industria, unidade')
          .limit(1000);

        if (valData && valData.length > 0) {
          valData.forEach((v: any) => {
            const pNome = String(v.produto || v.nome || '').trim();
            const pInd = String(v.industria || 'Geral').trim();
            const rawPCod = v.codigo;
            const pCod = rawPCod != null && String(rawPCod).trim() ? String(rawPCod).trim() : undefined;
            const pUn = String(v.unidade || 'un').trim();

            if (pNome) {
              industriasSet.add(pInd);
              const key = pInd.toLowerCase();
              if (!prodsMap[key]) prodsMap[key] = [];
              if (!prodsMap[key].includes(pNome)) {
                prodsMap[key].push(pNome);
              }

              const jaExiste = produtosDetalhadosList.some(
                (it) => it.nome.toLowerCase() === pNome.toLowerCase()
              );
              if (!jaExiste) {
                produtosDetalhadosList.push({
                  codigo: pCod,
                  nome: pNome,
                  industria: pInd,
                  unidade_padrao: pUn,
                });
              }
            }
          });
        }
      } catch {
        // Silencioso
      }
    }

    const finalProds = mergeLocalProdutosIntoCatalogo(produtosDetalhadosList, industriasSet, prodsMap);
    return {
      industrias: Array.from(industriasSet),
      produtosPorIndustria: prodsMap,
      produtosDetalhados: finalProds,
      coordenadores: coordenadoresList,
      lojas: lojasList,
    };
  } catch (err) {
    // Silencioso se as tabelas opcionais de catálogo ainda não foram criadas
  }

  const fallbackSet = new Set<string>();
  const fallbackMap: Record<string, string[]> = {};
  const finalProdsFallback = mergeLocalProdutosIntoCatalogo(produtosDetalhadosList, fallbackSet, fallbackMap);
  return {
    industrias: Array.from(fallbackSet),
    produtosPorIndustria: fallbackMap,
    produtosDetalhados: finalProdsFallback,
    coordenadores: coordenadoresList,
    lojas: lojasList,
  };
}

export async function fetchAllItems(config: SupabaseConfig): Promise<{ items: ItemValidade[]; fromSupabase: boolean; error?: string }> {
  const client = getSupabaseClient(config);

  if (client && config.isConnected) {
    try {
      // Tenta consultar todos os registros da tabela configurada
      let queryRes = await client
        .from(config.tableName || 'validades')
        .select('*');

      // Se falhou com a tabela configurada e a tabela configurada não era 'produtos', tenta 'validades' ou 'produtos'
      if (queryRes.error && queryRes.error.code === '42P01') {
        const fallbackTables = ['validades', 'produtos', 'Produtos'];
        for (const fbTable of fallbackTables) {
          if (fbTable !== (config.tableName || 'validades')) {
            const fbRes = await client.from(fbTable).select('*');
            if (!fbRes.error && fbRes.data && fbRes.data.length > 0) {
              queryRes = fbRes;
              break;
            }
          }
        }
      }

      if (queryRes.error) {
        console.warn('Erro ao buscar do Supabase, usando armazenamento local:', queryRes.error);
        return { items: getLocalItems(), fromSupabase: false, error: queryRes.error.message };
      }

      const data = queryRes.data;
      if (data) {
        const formatted: ItemValidade[] = data
          .map((item: any) => {
            const rawCod = item.codigo ?? item.codigo_barras ?? item.ean ?? item.sku ?? item.cod ?? item.Codigo;
            const cod = rawCod != null && String(rawCod).trim() ? String(rawCod).trim() : '';
            const rawInd = item.industria ?? item.industria_nome ?? item.fabricante ?? item.empresa ?? item.marca ?? item.Industria;
            const ind = String(rawInd || 'Geral').trim() || 'Geral';
            const rawProd = item.produto ?? item.nome ?? item.descricao ?? item.nome_produto ?? item.item ?? item.Nome ?? item.Produto;
            const prod = String(rawProd || '').trim();
            const rawUnid = item.unidade ?? item.unidade_padrao ?? item.un ?? 'un';
            const unid = String(rawUnid || 'un').trim() || 'un';
            const rawLoja = item.loja ?? item.loja_nome ?? item.filial ?? item.mercado ?? '';
            const rawEst = item.estado ?? item.uf ?? item.UF ?? '';
            const rawCoord = item.coordenador ?? item.responsavel ?? item.supervisor ?? '';
            const rawLote = item.lote ?? item.numero_lote ?? item.Lote ?? '';
            const rawObs = item.observacoes ?? item.obs ?? '';

            return {
              id: String(item.id || item.uuid || 'id-' + Math.random().toString(36).substring(2, 9)),
              codigo: cod,
              industria: ind,
              produto: prod,
              quantidade: Number(item.quantidade ?? item.qtd ?? item.estoque ?? 1),
              unidade: unid,
              data_vencimento: String(item.data_vencimento || item.vencimento || item.validade || item.dt_vencimento || item.data || ''),
              loja: String(rawLoja).trim(),
              estado: String(rawEst).trim(),
              coordenador: String(rawCoord).trim(),
              lote: String(rawLote).trim(),
              observacoes: String(rawObs).trim(),
              created_at: item.created_at || item.data_cadastro || new Date().toISOString(),
            };
          })
          .filter((it: ItemValidade) => Boolean(it.produto.trim())); // Só inclui se tiver nome de produto

        // Ordena com segurança por data de vencimento se houver data
        formatted.sort((a, b) => {
          if (!a.data_vencimento) return 1;
          if (!b.data_vencimento) return -1;
          return a.data_vencimento.localeCompare(b.data_vencimento);
        });

        // Salva backup local
        saveLocalItems(formatted);
        return { items: formatted, fromSupabase: true };
      }
    } catch (err: any) {
      console.warn('Exceção ao buscar do Supabase:', err);
      return { items: getLocalItems(), fromSupabase: false, error: err.message };
    }
  }

  return { items: getLocalItems(), fromSupabase: false };
}

export async function insertItemData(item: Omit<ItemValidade, 'id' | 'created_at'>, config: SupabaseConfig): Promise<{ item: ItemValidade; fromSupabase: boolean; error?: string }> {
  const client = getSupabaseClient(config);
  const now = new Date().toISOString();
  const tempId = 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const safeItemCod = item.codigo != null && String(item.codigo).trim() ? String(item.codigo).trim() : undefined;

  const localItem: ItemValidade = {
    ...item,
    codigo: safeItemCod,
    id: tempId,
    created_at: now,
  };

  if (client && config.isConnected) {
    try {
      const payload: Record<string, any> = {
        industria: String(item.industria || 'Geral').trim(),
        produto: String(item.produto || '').trim(),
        quantidade: Number(item.quantidade),
        unidade: item.unidade ? String(item.unidade).trim() : 'un',
        data_vencimento: item.data_vencimento,
        loja: item.loja ? String(item.loja).trim() : null,
        estado: item.estado ? String(item.estado).trim().toUpperCase() : null,
        coordenador: item.coordenador ? String(item.coordenador).trim() : null,
        lote: item.lote ? String(item.lote).trim() : null,
        observacoes: item.observacoes ? String(item.observacoes).trim() : null,
      };
      if (safeItemCod) {
        payload.codigo = safeItemCod;
      }

      let res = await client
        .from(config.tableName || 'validades')
        .insert([payload])
        .select()
        .single();

      // Fallback: se der erro por causa da coluna codigo inexistente na tabela, tenta sem a coluna codigo
      if (res.error && res.error.message && res.error.message.includes('codigo')) {
        delete payload.codigo;
        res = await client
          .from(config.tableName || 'validades')
          .insert([payload])
          .select()
          .single();
      }

      const { data, error } = res;

      if (error) {
        console.warn('Falha no insert Supabase, gravando localmente:', error);
        const current = getLocalItems();
        const updated = [localItem, ...current];
        saveLocalItems(updated);
        return { item: localItem, fromSupabase: false, error: error.message };
      }

      const created: ItemValidade = {
        id: String(data.id),
        codigo: data.codigo != null && String(data.codigo).trim() ? String(data.codigo).trim() : (safeItemCod || ''),
        industria: String(data.industria || localItem.industria),
        produto: String(data.produto || localItem.produto),
        quantidade: Number(data.quantidade),
        unidade: data.unidade || 'un',
        data_vencimento: data.data_vencimento,
        loja: data.loja || '',
        estado: data.estado || '',
        coordenador: data.coordenador || '',
        lote: data.lote || '',
        observacoes: data.observacoes || '',
        created_at: data.created_at || now,
      };

      // Atualiza local
      const current = getLocalItems();
      saveLocalItems([created, ...current]);

      return { item: created, fromSupabase: true };
    } catch (err: any) {
      console.warn('Exceção no insert Supabase:', err);
      const current = getLocalItems();
      saveLocalItems([localItem, ...current]);
      return { item: localItem, fromSupabase: false, error: err.message };
    }
  }

  // Apenas local
  const current = getLocalItems();
  saveLocalItems([localItem, ...current]);
  return { item: localItem, fromSupabase: false };
}

export async function updateItemData(item: ItemValidade, config: SupabaseConfig): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient(config);

  const safeCod = item.codigo != null && String(item.codigo).trim() ? String(item.codigo).trim() : undefined;
  const sanitizedItem: ItemValidade = {
    ...item,
    codigo: safeCod || '',
    industria: String(item.industria || 'Geral').trim(),
    produto: String(item.produto || '').trim(),
    unidade: item.unidade ? String(item.unidade).trim() : 'un',
  };

  // Atualiza local
  const current = getLocalItems();
  const updatedLocal = current.map((it) => (it.id === item.id ? sanitizedItem : it));
  saveLocalItems(updatedLocal);

  if (client && config.isConnected) {
    try {
      const payload: Record<string, any> = {
        industria: sanitizedItem.industria,
        produto: sanitizedItem.produto,
        quantidade: Number(item.quantidade),
        unidade: sanitizedItem.unidade,
        data_vencimento: item.data_vencimento,
        loja: item.loja ? String(item.loja).trim() : null,
        estado: item.estado ? String(item.estado).trim().toUpperCase() : null,
        coordenador: item.coordenador ? String(item.coordenador).trim() : null,
        lote: item.lote ? String(item.lote).trim() : null,
        observacoes: item.observacoes ? String(item.observacoes).trim() : null,
      };
      if (safeCod) {
        payload.codigo = safeCod;
      }

      let { error } = await client
        .from(config.tableName || 'validades')
        .update(payload)
        .eq('id', item.id);

      if (error && error.message && error.message.includes('codigo')) {
        delete payload.codigo;
        const retry = await client
          .from(config.tableName || 'validades')
          .update(payload)
          .eq('id', item.id);
        error = retry.error;
      }

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

export async function deleteItemData(id: string, config: SupabaseConfig): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient(config);

  // Remove local
  const current = getLocalItems();
  saveLocalItems(current.filter((it) => it.id !== id));

  if (client && config.isConnected) {
    try {
      const { error } = await client
        .from(config.tableName || 'validades')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

export async function insertBatchItemsData(
  itemsToAdd: Array<Omit<ItemValidade, 'id' | 'created_at'>>,
  config: SupabaseConfig
): Promise<{ items: ItemValidade[]; fromSupabase: boolean; error?: string }> {
  if (itemsToAdd.length === 0) {
    return { items: [], fromSupabase: false };
  }

  const client = getSupabaseClient(config);
  const now = new Date().toISOString();

  const localItems: ItemValidade[] = itemsToAdd.map((it, idx) => {
    const safeCod = it.codigo != null && String(it.codigo).trim() ? String(it.codigo).trim() : undefined;
    return {
      ...it,
      codigo: safeCod || '',
      industria: String(it.industria || 'Geral').trim(),
      produto: String(it.produto || '').trim(),
      unidade: it.unidade ? String(it.unidade).trim() : 'un',
      id: 'id-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 6),
      created_at: now,
    };
  });

  if (client && config.isConnected) {
    try {
      const recordsToInsert = itemsToAdd.map((it) => {
        const safeCod = it.codigo != null && String(it.codigo).trim() ? String(it.codigo).trim() : undefined;
        const row: Record<string, any> = {
          industria: String(it.industria || 'Geral').trim(),
          produto: String(it.produto || '').trim(),
          quantidade: Number(it.quantidade),
          unidade: it.unidade ? String(it.unidade).trim() : 'un',
          data_vencimento: it.data_vencimento,
          loja: it.loja ? String(it.loja).trim() : null,
          estado: it.estado ? String(it.estado).trim().toUpperCase() : null,
          coordenador: it.coordenador ? String(it.coordenador).trim() : null,
          lote: it.lote ? String(it.lote).trim() : null,
          observacoes: it.observacoes ? String(it.observacoes).trim() : null,
        };
        if (safeCod) {
          row.codigo = safeCod;
        }
        return row;
      });

      let res = await client
        .from(config.tableName || 'validades')
        .insert(recordsToInsert)
        .select();

      if (res.error && res.error.message && res.error.message.includes('codigo')) {
        const recordsWithoutCodigo = recordsToInsert.map(({ codigo, ...rest }) => rest);
        res = await client
          .from(config.tableName || 'validades')
          .insert(recordsWithoutCodigo)
          .select();
      }

      const { data, error } = res;

      if (error) {
        console.warn('Falha no insert lote Supabase, salvando local:', error);
        const current = getLocalItems();
        saveLocalItems([...localItems, ...current]);
        return { items: localItems, fromSupabase: false, error: error.message };
      }

      const createdItems: ItemValidade[] = (data || []).map((row: any, i: number) => {
        const fallbackCod = itemsToAdd[i]?.codigo != null ? String(itemsToAdd[i].codigo).trim() : '';
        const safeRowCod = row.codigo != null && String(row.codigo).trim() ? String(row.codigo).trim() : fallbackCod;
        return {
          id: String(row.id),
          codigo: safeRowCod,
          industria: String(row.industria || itemsToAdd[i]?.industria || 'Geral'),
          produto: String(row.produto || itemsToAdd[i]?.produto || ''),
          quantidade: Number(row.quantidade),
          unidade: row.unidade || 'un',
          data_vencimento: row.data_vencimento,
          loja: row.loja || '',
          estado: row.estado || '',
          coordenador: row.coordenador || '',
          lote: row.lote || '',
          observacoes: row.observacoes || '',
          created_at: row.created_at || now,
        };
      });

      const current = getLocalItems();
      saveLocalItems([...createdItems, ...current]);
      return { items: createdItems, fromSupabase: true };
    } catch (err: any) {
      console.warn('Exceção no insert lote Supabase:', err);
      const current = getLocalItems();
      saveLocalItems([...localItems, ...current]);
      return { items: localItems, fromSupabase: false, error: err.message };
    }
  }

  // Apenas local
  const current = getLocalItems();
  saveLocalItems([...localItems, ...current]);
  return { items: localItems, fromSupabase: false };
}

// ==========================================
// OPERAÇÕES DO CATÁLOGO DE PRODUTOS (SUPABASE)
// ==========================================

export interface ProductTableSchema {
  tableName: string;
  nameCol: string;
  indCol: string | null;
  extraIndCol?: string | null;
  codeCol: string | null;
  unitCol: string | null;
  triedIndCandidates: string[];
  triedUnitCandidates: string[];
  triedCodeCandidates: string[];
  missingIndustryColumn: boolean;
}

const cachedProductSchemas: Record<string, ProductTableSchema> = {};

export function invalidateProductSchemaCache(tableName?: string) {
  if (tableName) {
    delete cachedProductSchemas[cleanTableName(tableName)];
  } else {
    for (const key of Object.keys(cachedProductSchemas)) {
      delete cachedProductSchemas[key];
    }
  }
}

// Extrai o nome da coluna faltante quando o PostgREST / Supabase rejeita com PGRST204 ou erro de coluna inexistente
function extractMissingColumnFromError(errorMsg?: string): string | null {
  if (!errorMsg) return null;
  // "Could not find the 'industria' column of 'produtos' in the schema cache"
  const m1 = errorMsg.match(/Could not find the '([^']+)' column/i);
  if (m1 && m1[1]) return m1[1].toLowerCase();

  // "column "industria" of relation "produtos" does not exist"
  const m2 = errorMsg.match(/column "([^"]+)" of relation/i);
  if (m2 && m2[1]) return m2[1].toLowerCase();

  return null;
}

// Extrai o nome da coluna que violou restrição NOT NULL (Postgres 23502)
function extractViolatedNotNullColumn(errorMsg?: string): string | null {
  if (!errorMsg) return null;
  // Ex: 'null value in column "industria_nome" of relation "produtos" violates not-null constraint'
  const m1 = errorMsg.match(/null value in column "([^"]+)"/i);
  if (m1 && m1[1]) return m1[1].toLowerCase();

  // Ex: 'column "industria_nome" violates not-null constraint'
  const m2 = errorMsg.match(/column "([^"]+)" violates not-null/i);
  if (m2 && m2[1]) return m2[1].toLowerCase();

  return null;
}

// Inspeciona ou descobre as colunas suportadas pela tabela de produtos no Supabase
export async function resolveProductTableSchema(
  client: any,
  rawTableName: string
): Promise<ProductTableSchema> {
  const cleanName = cleanTableName(rawTableName);
  if (cachedProductSchemas[cleanName]) {
    return cachedProductSchemas[cleanName];
  }

  // 1. Tenta inspecionar 1 registro existente para extrair os nomes reais das colunas
  try {
    const { data, error } = await client.from(cleanName).select('*').limit(1);
    if (!error && data && data.length > 0) {
      const keys = Object.keys(data[0]);
      const lowerMap: Record<string, string> = {};
      keys.forEach((k) => {
        lowerMap[k.toLowerCase()] = k;
      });

      // Identifica coluna de nome/descrição
      const nameCandidates = ['nome', 'produto', 'descricao', 'descricao_produto', 'item', 'title', 'name'];
      let nameCol = 'nome';
      for (const cand of nameCandidates) {
        if (lowerMap[cand]) {
          nameCol = lowerMap[cand];
          break;
        }
      }

      // Identifica coluna de indústria / marca / fabricante
      // Prioridade: 'industria_nome' (padrão de SupabaseModal) e 'industria'
      let indCol: string | null = null;
      let extraIndCol: string | null = null;
      if (lowerMap['industria_nome']) {
        indCol = lowerMap['industria_nome'];
        if (lowerMap['industria']) {
          extraIndCol = lowerMap['industria'];
        }
      } else if (lowerMap['industria']) {
        indCol = lowerMap['industria'];
      } else {
        const indCandidates = ['marca', 'fabricante', 'fornecedor', 'empresa', 'categoria'];
        for (const cand of indCandidates) {
          if (lowerMap[cand]) {
            indCol = lowerMap[cand];
            break;
          }
        }
      }

      // Identifica coluna de código / EAN / SKU
      const codeCandidates = ['codigo', 'codigo_barras', 'cod_barras', 'ean', 'sku', 'cod'];
      let codeCol: string | null = null;
      for (const cand of codeCandidates) {
        if (lowerMap[cand]) {
          codeCol = lowerMap[cand];
          break;
        }
      }

      // Identifica coluna de unidade
      const unitCandidates = ['unidade_padrao', 'unidade', 'un'];
      let unitCol: string | null = null;
      for (const cand of unitCandidates) {
        if (lowerMap[cand]) {
          unitCol = lowerMap[cand];
          break;
        }
      }

      const schema: ProductTableSchema = {
        tableName: cleanName,
        nameCol,
        indCol,
        extraIndCol,
        codeCol,
        unitCol,
        triedIndCandidates: indCol ? [indCol.toLowerCase()] : [],
        triedUnitCandidates: unitCol ? [unitCol.toLowerCase()] : [],
        triedCodeCandidates: codeCol ? [codeCol.toLowerCase()] : [],
        missingIndustryColumn: indCol === null,
      };

      cachedProductSchemas[cleanName] = schema;
      return schema;
    }
  } catch (err) {
    console.warn(`[Supabase] Erro ao inspecionar colunas de ${cleanName}:`, err);
  }

  // 2. Se a tabela estiver vazia, sonda diretamente o PostgREST para saber exatamente quais colunas existem
  let probedIndCol: string | null = null;
  let probedExtraIndCol: string | null = null;
  let probedCodeCol: string | null = 'codigo';
  let probedUnitCol: string | null = 'unidade_padrao';
  let probedNameCol: string = 'nome';

  try {
    // Sonda industria_nome e industria
    const { error: errIndNome } = await client.from(cleanName).select('industria_nome').limit(0);
    const hasIndNome = !errIndNome;

    const { error: errInd } = await client.from(cleanName).select('industria').limit(0);
    const hasInd = !errInd;

    if (hasIndNome && hasInd) {
      probedIndCol = 'industria_nome';
      probedExtraIndCol = 'industria';
    } else if (hasIndNome) {
      probedIndCol = 'industria_nome';
    } else if (hasInd) {
      probedIndCol = 'industria';
    } else {
      const { error: errMarca } = await client.from(cleanName).select('marca').limit(0);
      if (!errMarca) {
        probedIndCol = 'marca';
      } else {
        probedIndCol = 'industria_nome'; // default padrão do schema oficial
      }
    }
  } catch {}

  try {
    const { error: errCod } = await client.from(cleanName).select('codigo').limit(0);
    if (errCod) {
      const { error: errCodBarras } = await client.from(cleanName).select('codigo_barras').limit(0);
      if (!errCodBarras) probedCodeCol = 'codigo_barras';
      else {
        const { error: errEan } = await client.from(cleanName).select('ean').limit(0);
        if (!errEan) probedCodeCol = 'ean';
        else probedCodeCol = null;
      }
    }
  } catch {}

  try {
    const { error: errUnit } = await client.from(cleanName).select('unidade_padrao').limit(0);
    if (errUnit) {
      const { error: errUnidade } = await client.from(cleanName).select('unidade').limit(0);
      if (!errUnidade) probedUnitCol = 'unidade';
      else probedUnitCol = null;
    }
  } catch {}

  const defaultSchema: ProductTableSchema = {
    tableName: cleanName,
    nameCol: probedNameCol,
    indCol: probedIndCol || 'industria_nome',
    extraIndCol: probedExtraIndCol,
    codeCol: probedCodeCol,
    unitCol: probedUnitCol,
    triedIndCandidates: probedIndCol ? [probedIndCol.toLowerCase()] : ['industria_nome'],
    triedUnitCandidates: probedUnitCol ? [probedUnitCol.toLowerCase()] : [],
    triedCodeCandidates: probedCodeCol ? [probedCodeCol.toLowerCase()] : [],
    missingIndustryColumn: false,
  };
  cachedProductSchemas[cleanName] = defaultSchema;
  return defaultSchema;
}

// Constrói o objeto de inserção respeitando exatamente as colunas válidas no Supabase
function buildProductRow(
  item: { codigo?: string; nome: string; industria: string; unidade_padrao?: string },
  schema: ProductTableSchema
): Record<string, any> {
  const safeInd = String(item.industria || '').trim() || 'Geral';
  const row: Record<string, any> = {
    [schema.nameCol]: String(item.nome || '').trim() || 'Produto sem nome',
  };

  if (schema.indCol) {
    row[schema.indCol] = safeInd;
  }

  // Se a tabela tiver tanto 'industria_nome' quanto 'industria', preenche ambos
  if (schema.extraIndCol && schema.extraIndCol !== schema.indCol) {
    row[schema.extraIndCol] = safeInd;
  }

  const safeCod = item.codigo != null && String(item.codigo).trim() ? String(item.codigo).trim() : undefined;
  if (schema.codeCol && safeCod) {
    row[schema.codeCol] = safeCod;
  }

  const safeUnit = item.unidade_padrao != null && String(item.unidade_padrao).trim() ? String(item.unidade_padrao).trim() : 'un';
  if (schema.unitCol && safeUnit) {
    row[schema.unitCol] = safeUnit;
  }

  return row;
}

// Ajusta o esquema dinamicamente ao detectar erro de coluna inexistente
function adaptSchemaForMissingColumn(schema: ProductTableSchema, missingCol: string): boolean {
  const col = missingCol.toLowerCase();

  // Caso 1: Falha na coluna de indústria (ex: 'industria' ou 'industria_nome')
  if (schema.indCol && schema.indCol.toLowerCase() === col) {
    schema.triedIndCandidates.push(col);
    // Prioridade com industria_nome e industria
    const indCandidates = ['industria_nome', 'industria', 'marca', 'fabricante', 'fornecedor', 'empresa', 'categoria'];
    const nextCandidate = indCandidates.find((c) => !schema.triedIndCandidates.includes(c));
    if (nextCandidate) {
      schema.indCol = nextCandidate;
      schema.triedIndCandidates.push(nextCandidate);
    } else {
      // Nenhuma coluna de indústria existe na tabela do Supabase. Omitir campo!
      schema.indCol = null;
      schema.missingIndustryColumn = true;
    }
    return true;
  }

  if (schema.extraIndCol && schema.extraIndCol.toLowerCase() === col) {
    schema.extraIndCol = null;
    return true;
  }

  // Caso 2: Falha na coluna de unidade
  if (schema.unitCol && schema.unitCol.toLowerCase() === col) {
    schema.triedUnitCandidates.push(col);
    const unitCandidates = ['unidade', 'un'];
    const nextCandidate = unitCandidates.find((c) => !schema.triedUnitCandidates.includes(c));
    if (nextCandidate) {
      schema.unitCol = nextCandidate;
      schema.triedUnitCandidates.push(nextCandidate);
    } else {
      schema.unitCol = null;
    }
    return true;
  }

  // Caso 3: Falha na coluna de código
  if (schema.codeCol && schema.codeCol.toLowerCase() === col) {
    schema.triedCodeCandidates.push(col);
    const codeCandidates = ['codigo_barras', 'cod_barras', 'ean', 'sku', 'cod'];
    const nextCandidate = codeCandidates.find((c) => !schema.triedCodeCandidates.includes(c));
    if (nextCandidate) {
      schema.codeCol = nextCandidate;
      schema.triedCodeCandidates.push(nextCandidate);
    } else {
      schema.codeCol = null;
    }
    return true;
  }

  // Caso 4: Falha na coluna de nome
  if (schema.nameCol.toLowerCase() === col) {
    if (col === 'nome') {
      schema.nameCol = 'produto';
      return true;
    } else if (col === 'produto') {
      schema.nameCol = 'descricao';
      return true;
    }
  }

  return false;
}

export async function insertProdutoCatalogo(
  novo: { codigo?: string; nome: string; industria: string; unidade_padrao?: string },
  config: SupabaseConfig
): Promise<{ produto: ProdutoCatalogo; fromSupabase: boolean; error?: string; warning?: string }> {
  const client = getSupabaseClient(config);
  const now = new Date().toISOString();
  const tempId = 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  const localItem: ProdutoCatalogo = {
    id: tempId,
    codigo: novo.codigo != null && String(novo.codigo).trim() ? String(novo.codigo).trim() : undefined,
    nome: String(novo.nome || '').trim(),
    industria: String(novo.industria || 'Geral').trim() || 'Geral',
    unidade_padrao: String(novo.unidade_padrao || 'un').trim() || 'un',
    syncedToSupabase: false,
    created_at: now,
  };

  if (client && config.isConnected) {
    let tableToUse = config.productTableName ? cleanTableName(config.productTableName) : 'produtos';
    let schema = await resolveProductTableSchema(client, tableToUse);

    let attempts = 0;
    let success = false;
    let lastError: any = null;
    let resData: any = null;

    while (attempts < 8 && !success) {
      attempts++;
      const payload = buildProductRow(localItem, schema);

      try {
        const res = await client
          .from(tableToUse)
          .insert([payload])
          .select()
          .single();

        if (!res.error && res.data) {
          success = true;
          resData = res.data;
          break;
        }

        lastError = res.error;

        // 1. Trata violação de restrição NOT NULL (Postgres 23502 - ex: null value in column "industria_nome"...)
        const notNullCol = extractViolatedNotNullColumn(res.error?.message);
        if (notNullCol) {
          let adapted = false;
          if (notNullCol.includes('ind') || notNullCol.includes('marca') || notNullCol.includes('fabric')) {
            schema.indCol = notNullCol;
            schema.missingIndustryColumn = false;
            adapted = true;
          } else if (notNullCol.includes('nome') || notNullCol.includes('prod') || notNullCol.includes('desc')) {
            schema.nameCol = notNullCol;
            adapted = true;
          } else if (notNullCol.includes('cod') || notNullCol.includes('ean') || notNullCol.includes('sku')) {
            schema.codeCol = notNullCol;
            adapted = true;
          } else if (notNullCol.includes('un')) {
            schema.unitCol = notNullCol;
            adapted = true;
          }
          if (adapted) {
            cachedProductSchemas[tableToUse] = schema;
            continue; // Tenta novamente com o campo obrigatório NOT NULL preenchido!
          }
        }

        // 2. Se for erro de chave única duplicada (Postgres 23505), tenta upsert ignorando duplicatas
        if (res.error && (res.error.code === '23505' || res.error.message?.includes('duplicate key') || res.error.message?.includes('unique constraint'))) {
          try {
            const upsertRes = await client.from(tableToUse).upsert([payload], { ignoreDuplicates: true }).select().single();
            if (!upsertRes.error && upsertRes.data) {
              success = true;
              resData = upsertRes.data;
              break;
            }
          } catch {}
        }

        // 3. Se a tabela não existir (42P01), tenta tabelas alternativas
        if (res.error && res.error.code === '42P01') {
          const fallbackTables = ['catalogo_produtos', 'tb_produtos', 'produtos_base', 'itens'];
          let foundTable = false;
          for (const altTable of fallbackTables) {
            tableToUse = altTable;
            schema = await resolveProductTableSchema(client, altTable);
            const altPayload = buildProductRow(localItem, schema);
            const altRes = await client.from(altTable).insert([altPayload]).select().single();
            if (!altRes.error && altRes.data) {
              success = true;
              resData = altRes.data;
              foundTable = true;
              break;
            }
          }
          if (foundTable) break;
        }

        // 4. Verifica se o erro foi coluna inexistente no schema cache
        const missingCol = extractMissingColumnFromError(res.error?.message);
        if (missingCol) {
          const adapted = adaptSchemaForMissingColumn(schema, missingCol);
          if (adapted) {
            cachedProductSchemas[tableToUse] = schema;
            continue; // Tenta novamente com o esquema adaptado
          }
        }

        // Se não for erro recuperável, encerra
        break;
      } catch (err: any) {
        lastError = err;
        break;
      }
    }

    if (success && resData) {
      const rawResCod = resData.codigo ?? resData.codigo_barras ?? resData.ean ?? localItem.codigo;
      const created: ProdutoCatalogo = {
        id: String(resData.id || localItem.id),
        codigo: rawResCod != null && String(rawResCod).trim() ? String(rawResCod).trim() : undefined,
        nome: String(resData.nome || resData.produto || resData.descricao || localItem.nome).trim(),
        industria: String(resData.industria || resData.industria_nome || resData.marca || resData.fabricante || localItem.industria).trim(),
        unidade_padrao: String(resData.unidade_padrao || resData.unidade || localItem.unidade_padrao || 'un').trim(),
        syncedToSupabase: true,
        created_at: resData.created_at || now,
      };

      const currentLocal = getLocalCatalogo();
      const updated = [
        created,
        ...currentLocal.filter(
          (p) => !(p.nome.toLowerCase() === created.nome.toLowerCase() && p.industria.toLowerCase() === created.industria.toLowerCase())
        ),
      ];
      saveLocalCatalogo(updated);

      let warningMsg: string | undefined = undefined;
      if (schema.missingIndustryColumn) {
        warningMsg = `Produto salvo no Supabase! (Dica: sua tabela "${tableToUse}" não possui a coluna 'industria'. Para gravá-la também no banco, execute: ALTER TABLE ${tableToUse} ADD COLUMN IF NOT EXISTS industria TEXT;)`;
      }

      return { produto: created, fromSupabase: true, warning: warningMsg };
    }

    // Se falhou no Supabase, mantém seguro localmente
    console.warn('Falha ao inserir produto no Supabase após tentativas:', lastError);
    const currentLocal = getLocalCatalogo();
    const updated = [
      localItem,
      ...currentLocal.filter(
        (p) => !(p.nome.toLowerCase() === localItem.nome.toLowerCase() && p.industria.toLowerCase() === localItem.industria.toLowerCase())
      ),
    ];
    saveLocalCatalogo(updated);

    return {
      produto: localItem,
      fromSupabase: false,
      error:
        lastError?.code === '42P01'
          ? `Tabela "${tableToUse}" não existe no seu Supabase. Crie-a no SQL Editor do Supabase.`
          : lastError?.message || 'Erro desconhecido ao comunicar com Supabase.',
    };
  }

  // Modo local
  const currentLocal = getLocalCatalogo();
  const updated = [
    localItem,
    ...currentLocal.filter(
      (p) => !(p.nome.toLowerCase() === localItem.nome.toLowerCase() && p.industria.toLowerCase() === localItem.industria.toLowerCase())
    ),
  ];
  saveLocalCatalogo(updated);
  return { produto: localItem, fromSupabase: false };
}

export async function insertBatchProdutosCatalogo(
  produtosToAdd: Array<{ codigo?: string; nome: string; industria: string; unidade_padrao?: string }>,
  config: SupabaseConfig
): Promise<{ produtos: ProdutoCatalogo[]; fromSupabase: boolean; inseridosCount: number; error?: string; warning?: string }> {
  if (produtosToAdd.length === 0) {
    return { produtos: [], fromSupabase: false, inseridosCount: 0 };
  }

  const client = getSupabaseClient(config);
  const now = new Date().toISOString();

  const localItems: ProdutoCatalogo[] = produtosToAdd.map((it, idx) => ({
    id: 'prod-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 6),
    codigo: it.codigo != null && String(it.codigo).trim() ? String(it.codigo).trim() : undefined,
    nome: String(it.nome || '').trim(),
    industria: String(it.industria || 'Geral').trim() || 'Geral',
    unidade_padrao: String(it.unidade_padrao || 'un').trim() || 'un',
    syncedToSupabase: false,
    created_at: now,
  }));

  if (client && config.isConnected) {
    let tableToUse = config.productTableName ? cleanTableName(config.productTableName) : 'produtos';
    let schema = await resolveProductTableSchema(client, tableToUse);

    let attempts = 0;
    let success = false;
    let lastError: any = null;
    let resData: any[] = [];

    while (attempts < 8 && !success) {
      attempts++;
      const recordsToInsert = localItems.map((it) => buildProductRow(it, schema));

      try {
        const res = await client.from(tableToUse).insert(recordsToInsert).select();

        if (!res.error && res.data) {
          success = true;
          resData = res.data;
          break;
        }

        lastError = res.error;

        // 1. Trata violação de restrição NOT NULL (Postgres 23502 - ex: null value in column "industria_nome"...)
        const notNullCol = extractViolatedNotNullColumn(res.error?.message);
        if (notNullCol) {
          let adapted = false;
          if (notNullCol.includes('ind') || notNullCol.includes('marca') || notNullCol.includes('fabric')) {
            schema.indCol = notNullCol;
            schema.missingIndustryColumn = false;
            adapted = true;
          } else if (notNullCol.includes('nome') || notNullCol.includes('prod') || notNullCol.includes('desc')) {
            schema.nameCol = notNullCol;
            adapted = true;
          } else if (notNullCol.includes('cod') || notNullCol.includes('ean') || notNullCol.includes('sku')) {
            schema.codeCol = notNullCol;
            adapted = true;
          } else if (notNullCol.includes('un')) {
            schema.unitCol = notNullCol;
            adapted = true;
          }
          if (adapted) {
            cachedProductSchemas[tableToUse] = schema;
            continue; // Tenta novamente com o campo obrigatório NOT NULL preenchido!
          }
        }

        // 2. Se for erro de chave única duplicada (Postgres 23505), tenta upsert ignorando duplicatas
        if (res.error && (res.error.code === '23505' || res.error.message?.includes('duplicate key') || res.error.message?.includes('unique constraint'))) {
          try {
            const upsertRes = await client.from(tableToUse).upsert(recordsToInsert, { ignoreDuplicates: true }).select();
            if (!upsertRes.error && upsertRes.data) {
              success = true;
              resData = upsertRes.data;
              break;
            }
          } catch {}
        }

        // 3. Se a tabela não existir, tenta alternativas
        if (res.error && res.error.code === '42P01') {
          const fallbackTables = ['catalogo_produtos', 'tb_produtos', 'produtos_base', 'itens'];
          let foundTable = false;
          for (const altTable of fallbackTables) {
            tableToUse = altTable;
            schema = await resolveProductTableSchema(client, altTable);
            const altRecords = localItems.map((it) => buildProductRow(it, schema));
            const altRes = await client.from(altTable).insert(altRecords).select();
            if (!altRes.error && altRes.data) {
              success = true;
              resData = altRes.data;
              foundTable = true;
              break;
            }
          }
          if (foundTable) break;
        }

        // 4. Verifica coluna inexistente e adapta o esquema dinamicamente
        const missingCol = extractMissingColumnFromError(res.error?.message);
        if (missingCol) {
          const adapted = adaptSchemaForMissingColumn(schema, missingCol);
          if (adapted) {
            cachedProductSchemas[tableToUse] = schema;
            continue; // Tenta novamente com colunas adaptadas
          }
        }

        break;
      } catch (err: any) {
        lastError = err;
        break;
      }
    }

    if (success) {
      const createdList: ProdutoCatalogo[] = resData.map((row: any, i: number) => {
        const rawRowCod = row.codigo ?? row.codigo_barras ?? row.ean ?? localItems[i]?.codigo;
        return {
          id: String(row.id || localItems[i]?.id),
          codigo: rawRowCod != null && String(rawRowCod).trim() ? String(rawRowCod).trim() : undefined,
          nome: String(row.nome || row.produto || row.descricao || localItems[i]?.nome).trim(),
          industria: String(row.industria || row.industria_nome || row.marca || row.fabricante || localItems[i]?.industria).trim(),
          unidade_padrao: String(row.unidade_padrao || row.unidade || localItems[i]?.unidade_padrao || 'un').trim(),
          syncedToSupabase: true,
          created_at: row.created_at || now,
        };
      });

      const finalSaved = createdList.length > 0 ? createdList : localItems.map((l) => ({ ...l, syncedToSupabase: true }));
      const currentLocal = getLocalCatalogo();
      const existingKeys = new Set(finalSaved.map((l) => `${l.nome.toLowerCase()}_${l.industria.toLowerCase()}`));
      const filtered = currentLocal.filter((p) => !existingKeys.has(`${p.nome.toLowerCase()}_${p.industria.toLowerCase()}`));
      saveLocalCatalogo([...finalSaved, ...filtered]);

      let warningMsg: string | undefined = undefined;
      if (schema.missingIndustryColumn) {
        warningMsg = `Produtos salvos no Supabase! (Dica: sua tabela "${tableToUse}" não possui a coluna 'industria'. Para gravá-la também no banco, execute: ALTER TABLE ${tableToUse} ADD COLUMN IF NOT EXISTS industria TEXT;)`;
      }

      return {
        produtos: finalSaved,
        fromSupabase: true,
        inseridosCount: finalSaved.length,
        warning: warningMsg,
      };
    }

    // Salva local se Supabase falhou
    console.warn('Falha no lote de produtos Supabase:', lastError);
    const currentLocal = getLocalCatalogo();
    const existingKeys = new Set(localItems.map((l) => `${l.nome.toLowerCase()}_${l.industria.toLowerCase()}`));
    const filtered = currentLocal.filter((p) => !existingKeys.has(`${p.nome.toLowerCase()}_${p.industria.toLowerCase()}`));
    saveLocalCatalogo([...localItems, ...filtered]);

    return {
      produtos: localItems,
      fromSupabase: false,
      inseridosCount: localItems.length,
      error:
        lastError?.code === '42P01'
          ? `Tabela "${tableToUse}" não existe no seu Supabase. Crie-a no SQL Editor.`
          : lastError?.message || 'Erro ao comunicar com Supabase.',
    };
  }

  // Local
  const currentLocal = getLocalCatalogo();
  const existingKeys = new Set(localItems.map((l) => `${l.nome.toLowerCase()}_${l.industria.toLowerCase()}`));
  const filtered = currentLocal.filter((p) => !existingKeys.has(`${p.nome.toLowerCase()}_${p.industria.toLowerCase()}`));
  saveLocalCatalogo([...localItems, ...filtered]);
  return { produtos: localItems, fromSupabase: false, inseridosCount: localItems.length };
}

export async function deleteProdutoCatalogo(
  produtoNome: string,
  industria: string,
  config: SupabaseConfig,
  produtoId?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient(config);

  // Remove do local
  const currentLocal = getLocalCatalogo();
  const filtered = currentLocal.filter(
    (p) => !(p.nome.toLowerCase() === produtoNome.toLowerCase() && p.industria.toLowerCase() === industria.toLowerCase())
  );
  saveLocalCatalogo(filtered);

  if (client && config.isConnected) {
    try {
      const tableToUse = config.productTableName ? cleanTableName(config.productTableName) : 'produtos';
      const schema = await resolveProductTableSchema(client, tableToUse);

      if (produtoId && !produtoId.startsWith('prod-')) {
        await client.from(tableToUse).delete().eq('id', produtoId);
      } else {
        let query = client.from(tableToUse).delete();
        if (schema.nameCol) {
          query = query.ilike(schema.nameCol, produtoNome.trim());
        }
        if (schema.indCol) {
          query = query.ilike(schema.indCol, industria.trim());
        }
        await query;
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

export async function syncAllPendingProdutosToSupabase(
  produtos: ProdutoCatalogo[],
  config: SupabaseConfig
): Promise<{ success: boolean; syncedCount: number; error?: string; warning?: string }> {
  const client = getSupabaseClient(config);
  if (!client || !config.isConnected) {
    return { success: false, syncedCount: 0, error: 'Supabase não está conectado.' };
  }

  const pendentes = produtos.filter((p) => p.syncedToSupabase === false);
  if (pendentes.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  const res = await insertBatchProdutosCatalogo(
    pendentes.map((p) => ({
      codigo: p.codigo != null && String(p.codigo).trim() ? String(p.codigo).trim() : undefined,
      nome: String(p.nome).trim(),
      industria: String(p.industria).trim(),
      unidade_padrao: String(p.unidade_padrao || 'un').trim(),
    })),
    config
  );

  return {
    success: res.fromSupabase,
    syncedCount: res.fromSupabase ? res.inseridosCount : 0,
    error: res.error,
    warning: res.warning,
  };
}
