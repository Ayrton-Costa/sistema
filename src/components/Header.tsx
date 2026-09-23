import React from 'react';
import {
  CalendarClock,
  Database,
  FileSpreadsheet,
  Upload,
  RefreshCw,
  FolderOpen,
  CloudCheck,
} from 'lucide-react';
import { SupabaseConfig } from '../types';

interface HeaderProps {
  supabaseConfig: SupabaseConfig;
  systemBranding?: {
    systemName: string;
    logoUrl?: string;
  } | null;
  onOpenSupabaseModal: () => void;
  onExportExcel: () => void;
  onOpenImportExcel: () => void;
  onRefresh: () => void;
  onOpenLogos?: () => void;
  isRefreshing: boolean;
  totalItems: number;
}

export const Header: React.FC<HeaderProps> = ({
  supabaseConfig,
  systemBranding,
  onOpenSupabaseModal,
  onExportExcel,
  onOpenImportExcel,
  onRefresh,
  onOpenLogos,
  isRefreshing,
  totalItems,
}) => {
  const isConnected = supabaseConfig.isConnected && Boolean(supabaseConfig.url);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Identificação da Aplicação (Com suporte ao Logo customizado do Google Drive) */}
        <div className="flex items-center gap-3">
          {systemBranding?.logoUrl ? (
            <div className="w-11 h-11 rounded-xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={systemBranding.logoUrl}
                alt="Logo do Sistema"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {systemBranding?.systemName || 'Controle de Validade'}
              </h1>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                <CloudCheck className="w-3 h-3 text-emerald-500" /> Google Drive + Supabase
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Vencimento por Indústria, Produto e Quantidade
            </p>
          </div>
        </div>

        {/* Status de Conexão e Ações Globais */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Status do Supabase */}
          <button
            id="btn-status-supabase-header"
            type="button"
            onClick={onOpenSupabaseModal}
            title="Clique para configurar o Supabase"
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isConnected ? 'Supabase Conectado' : 'Conectar Supabase'}
            </span>
          </button>

          {/* Atalho de Logos no Google Drive */}
          {onOpenLogos && (
            <button
              id="btn-header-logos"
              type="button"
              onClick={onOpenLogos}
              title="Gerenciar logos do sistema e indústrias no Google Drive"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Logos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900 font-bold">
                Drive
              </span>
            </button>
          )}

          {/* Atualizar / Sincronizar */}
          <button
            id="btn-sincronizar"
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Atualizar dados"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Importar Planilha Excel */}
          <button
            id="btn-header-import-excel"
            type="button"
            onClick={onOpenImportExcel}
            title="Importar dados de planilha Excel ou CSV"
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Importar</span>
            <span>Excel</span>
          </button>

          {/* Botão Principal: Extrair em Excel */}
          <button
            id="btn-header-export-excel"
            type="button"
            onClick={onExportExcel}
            disabled={totalItems === 0}
            className="inline-flex items-center gap-2 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden xs:inline">Extrair em</span>
            <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
