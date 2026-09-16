export interface ItemValidade {
  id: string;
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

export type StatusValidade = 'vencido' | 'critico' | 'atencao' | 'regular';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  isConnected: boolean;
}

export type FiltroStatus = 'todos' | 'vencidos' | 'critico_7d' | 'atencao_30d' | 'regular';

// Níveis possíveis para organização da hierarquia
export type NivelHierarquia = 'loja' | 'industria' | 'coordenador' | 'estado';

export type ModoVisualizacao = 'tabela' | 'hierarquia';
