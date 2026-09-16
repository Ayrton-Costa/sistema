import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { importarDeExcel, baixarModeloExcelImportacao } from '../lib/excel';
import { ItemValidade } from '../types';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Array<Omit<ItemValidade, 'id' | 'created_at'>>) => Promise<void>;
  isSupabaseConnected: boolean;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isSupabaseConnected,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<Array<Omit<ItemValidade, 'id' | 'created_at'>>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setErrorMsg(null);
    setFile(selected);
    setIsProcessing(true);

    try {
      const items = await importarDeExcel(selected);
      if (items.length === 0) {
        setErrorMsg('Nenhum registro válido com produto e indústria foi encontrado na planilha.');
        setPreviewItems([]);
      } else {
        setPreviewItems(items);
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao ler arquivo Excel: ${err.message || 'Verifique o formato do arquivo.'}`);
      setPreviewItems([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (previewItems.length === 0) return;
    setIsProcessing(true);
    try {
      await onImport(previewItems);
      onClose();
      setFile(null);
      setPreviewItems([]);
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar itens: ${err.message || 'Falha na gravação.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Importar Dados do Excel (.xlsx / .csv)
              </h3>
              <p className="text-xs text-slate-500">
                {isSupabaseConnected
                  ? 'Os itens serão gravados diretamente no banco Supabase'
                  : 'Os itens serão importados para o controle local da aplicação'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Caixa de Ação para Baixar Modelo */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Planilha Modelo Pronta
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Baixe o modelo com as colunas já formatadas (Loja, Indústria, Produto, Quantidade, Vencimento).
              </p>
            </div>
            <button
              type="button"
              onClick={baixarModeloExcelImportacao}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition shrink-0 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Baixar Modelo Excel
            </button>
          </div>

          {/* Área de Seleção de Arquivo */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
              file
                ? 'border-emerald-400 bg-emerald-50/40'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {file ? file.name : 'Clique para selecionar a planilha Excel (.xlsx, .csv)'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Compatível com colunas: Loja, Indústria, Produto, Quantidade, Vencimento, Lote, Coordenador
            </p>
          </div>

          {/* Mensagem de Erro */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pré-visualização dos Itens */}
          {previewItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {previewItems.length} produto(s) prontos para importação:
                </span>
                <span className="text-slate-500 text-[11px]">Exibindo primeiros 5 itens</span>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0">
                    <tr>
                      <th className="p-2">Indústria</th>
                      <th className="p-2">Produto</th>
                      <th className="p-2">Qtd</th>
                      <th className="p-2">Vencimento</th>
                      <th className="p-2">Loja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.slice(0, 5).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-medium text-slate-900">{item.industria}</td>
                        <td className="p-2 text-slate-700">{item.produto}</td>
                        <td className="p-2 text-slate-600">{item.quantidade} {item.unidade}</td>
                        <td className="p-2 text-slate-600">{item.data_vencimento}</td>
                        <td className="p-2 text-slate-500">{item.loja || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={previewItems.length === 0 || isProcessing}
            className="h-9 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {isProcessing
                ? 'Importando...'
                : `Importar ${previewItems.length > 0 ? previewItems.length : ''} Itens`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
