import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ItemValidade, SupabaseConfig } from '../types';

const STORAGE_CONFIG_KEY = 'validade_supabase_config';
const STORAGE_ITEMS_KEY = 'validade_local_items';

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
      const anonKey = (parsed.anonKey || envKey).trim();
      return {
        url,
        anonKey,
        tableName,
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

export async function testSupabaseConnection(url: string, anonKey: string, tableName = 'validades'): Promise<{ success: boolean; message: string }> {
  const cleanUrl = cleanSupabaseUrl(url);
  const cleanKey = anonKey.trim();
  const cleanTable = cleanTableName(tableName);

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
    
    // Testa consulta com contagem total de registros na tabela
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

    const totalLinhas = count !== null ? count : (data ? data.length : 0);
    return { 
      success: true, 
      message: `Conexão bem-sucedida! Tabela "${cleanTable}" localizada com ${totalLinhas} registro(s) encontrado(s). Ao clicar em Salvar, os dados serão carregados na tela.` 
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

// Operações integradas (Supabase com fallback seguro)
export async function fetchCatalogoRelacional(config: SupabaseConfig): Promise<{
  industrias: string[];
  produtosPorIndustria: Record<string, string[]>;
  coordenadores: string[];
  lojas: Array<{ nome: string; estado?: string; coordenador?: string }>;
}> {
  const client = getSupabaseClient(config);
  if (!client || !config.isConnected) {
    return { industrias: [], produtosPorIndustria: {}, coordenadores: [], lojas: [] };
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

  try {
    // 1. Tenta buscar da view ou tabela relacional produtos + industrias
    const { data: viewData, error: viewError } = await client
      .from('view_produtos_por_industria')
      .select('industria, produto')
      .order('industria', { ascending: true });

    if (!viewError && viewData && viewData.length > 0) {
      const industriasSet = new Set<string>();
      const prodsMap: Record<string, string[]> = {};

      viewData.forEach((row: any) => {
        if (row.industria) {
          const ind = row.industria.trim();
          industriasSet.add(ind);
          const indKey = ind.toLowerCase();
          if (!prodsMap[indKey]) prodsMap[indKey] = [];
          if (row.produto && !prodsMap[indKey].includes(row.produto.trim())) {
            prodsMap[indKey].push(row.produto.trim());
          }
        }
      });

      return {
        industrias: Array.from(industriasSet),
        produtosPorIndustria: prodsMap,
        coordenadores: coordenadoresList,
        lojas: lojasList,
      };
    }

    // 2. Se a view não existir, tenta consultar diretamente a tabela industrias
    const { data: indData, error: indError } = await client
      .from('industrias')
      .select('id, nome')
      .order('nome', { ascending: true });

    if (!indError && indData && indData.length > 0) {
      const industrias = indData.map((i: any) => i.nome).filter(Boolean);
      const prodsMap: Record<string, string[]> = {};

      // Tenta buscar produtos vinculados
      const { data: prodData } = await client
        .from('produtos')
        .select('industria_id, nome');

      if (prodData && prodData.length > 0) {
        const idToName: Record<string, string> = {};
        indData.forEach((i: any) => {
          idToName[String(i.id)] = i.nome;
        });

        prodData.forEach((p: any) => {
          const indNome = idToName[String(p.industria_id)];
          if (indNome && p.nome) {
            const key = indNome.toLowerCase();
            if (!prodsMap[key]) prodsMap[key] = [];
            prodsMap[key].push(p.nome.trim());
          }
        });
      }

      return {
        industrias,
        produtosPorIndustria: prodsMap,
        coordenadores: coordenadoresList,
        lojas: lojasList,
      };
    }
  } catch (err) {
    // Silencioso se as tabelas opcionais de catálogo ainda não foram criadas
  }

  return {
    industrias: [],
    produtosPorIndustria: {},
    coordenadores: coordenadoresList,
    lojas: lojasList,
  };
}

export async function fetchAllItems(config: SupabaseConfig): Promise<{ items: ItemValidade[]; fromSupabase: boolean; error?: string }> {
  const client = getSupabaseClient(config);

  if (client && config.isConnected) {
    try {
      const { data, error } = await client
        .from(config.tableName || 'validades')
        .select('*')
        .order('data_vencimento', { ascending: true });

      if (error) {
        console.warn('Erro ao buscar do Supabase, usando armazenamento local:', error);
        return { items: getLocalItems(), fromSupabase: false, error: error.message };
      }

      if (data) {
        const formatted: ItemValidade[] = data.map((item: any) => ({
          id: String(item.id || item.uuid || 'id-' + Math.random().toString(36).substring(2, 9)),
          industria: item.industria || item.fabricante || item.empresa || '',
          produto: item.produto || item.nome || item.descricao || item.nome_produto || '',
          quantidade: Number(item.quantidade ?? item.qtd ?? item.estoque ?? 1),
          unidade: item.unidade || item.un || 'un',
          data_vencimento: item.data_vencimento || item.vencimento || item.validade || item.dt_vencimento || item.data || '',
          loja: item.loja || item.loja_nome || item.filial || item.mercado || '',
          estado: item.estado || item.uf || '',
          coordenador: item.coordenador || item.responsavel || item.supervisor || '',
          lote: item.lote || item.numero_lote || '',
          observacoes: item.observacoes || item.obs || '',
          created_at: item.created_at || item.data_cadastro || new Date().toISOString(),
        }));
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

  const localItem: ItemValidade = {
    ...item,
    id: tempId,
    created_at: now,
  };

  if (client && config.isConnected) {
    try {
      const { data, error } = await client
        .from(config.tableName || 'validades')
        .insert([
          {
            industria: item.industria.trim(),
            produto: item.produto.trim(),
            quantidade: Number(item.quantidade),
            unidade: item.unidade || 'un',
            data_vencimento: item.data_vencimento,
            loja: item.loja ? item.loja.trim() : null,
            estado: item.estado ? item.estado.trim().toUpperCase() : null,
            coordenador: item.coordenador ? item.coordenador.trim() : null,
            lote: item.lote ? item.lote.trim() : null,
            observacoes: item.observacoes ? item.observacoes.trim() : null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Falha no insert Supabase, gravando localmente:', error);
        const current = getLocalItems();
        const updated = [localItem, ...current];
        saveLocalItems(updated);
        return { item: localItem, fromSupabase: false, error: error.message };
      }

      const created: ItemValidade = {
        id: String(data.id),
        industria: data.industria,
        produto: data.produto,
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

  // Atualiza local
  const current = getLocalItems();
  const updatedLocal = current.map((it) => (it.id === item.id ? item : it));
  saveLocalItems(updatedLocal);

  if (client && config.isConnected) {
    try {
      const { error } = await client
        .from(config.tableName || 'validades')
        .update({
          industria: item.industria.trim(),
          produto: item.produto.trim(),
          quantidade: Number(item.quantidade),
          unidade: item.unidade,
          data_vencimento: item.data_vencimento,
          loja: item.loja ? item.loja.trim() : null,
          estado: item.estado ? item.estado.trim().toUpperCase() : null,
          coordenador: item.coordenador ? item.coordenador.trim() : null,
          lote: item.lote ? item.lote.trim() : null,
          observacoes: item.observacoes ? item.observacoes.trim() : null,
        })
        .eq('id', item.id);

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

  const localItems: ItemValidade[] = itemsToAdd.map((it, idx) => ({
    ...it,
    id: 'id-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 6),
    created_at: now,
  }));

  if (client && config.isConnected) {
    try {
      const recordsToInsert = itemsToAdd.map((it) => ({
        industria: it.industria.trim(),
        produto: it.produto.trim(),
        quantidade: Number(it.quantidade),
        unidade: it.unidade || 'un',
        data_vencimento: it.data_vencimento,
        loja: it.loja ? it.loja.trim() : null,
        estado: it.estado ? it.estado.trim().toUpperCase() : null,
        coordenador: it.coordenador ? it.coordenador.trim() : null,
        lote: it.lote ? it.lote.trim() : null,
        observacoes: it.observacoes ? it.observacoes.trim() : null,
      }));

      const { data, error } = await client
        .from(config.tableName || 'validades')
        .insert(recordsToInsert)
        .select();

      if (error) {
        console.warn('Falha no insert lote Supabase, salvando local:', error);
        const current = getLocalItems();
        saveLocalItems([...localItems, ...current]);
        return { items: localItems, fromSupabase: false, error: error.message };
      }

      const createdItems: ItemValidade[] = (data || []).map((row: any) => ({
        id: String(row.id),
        industria: row.industria,
        produto: row.produto,
        quantidade: Number(row.quantidade),
        unidade: row.unidade || 'un',
        data_vencimento: row.data_vencimento,
        loja: row.loja || '',
        estado: row.estado || '',
        coordenador: row.coordenador || '',
        lote: row.lote || '',
        observacoes: row.observacoes || '',
        created_at: row.created_at || now,
      }));

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
