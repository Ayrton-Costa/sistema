export interface ItemValidade {
  id: string;
  codigo?: string; // Código do produto (EAN, SKU, Código de barras ou código interno)
  industria: string;
  produto: string;
  quantidade: number;
  unidade: string;
  data_vencimento: string; // formato YYYY-MM-DD
  loja?: string;
  estado?: string;
  coordenador?: string;
  lote?: string;
  observacoes?: string;
  created_at?: string;
}

export interface ProdutoCatalogo {
  id?: string;
  codigo?: string;
  nome: string;
  industria: string;
  unidade_padrao?: string;
  syncedToSupabase?: boolean;
  created_at?: string;
}

export type StatusValidade = 'vencido' | 'critico' | 'atencao' | 'regular';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  productTableName?: string;
  isConnected: boolean;
}

export type FiltroStatus = 'todos' | 'vencidos' | 'critico_7d' | 'atencao_30d' | 'regular';

// Níveis possíveis para organização da hierarquia
export type NivelHierarquia = 'loja' | 'industria' | 'coordenador' | 'estado';

export type ModoVisualizacao = 'hierarquia' | 'tabela' | 'catalogo' | 'cadastro_produtos';
