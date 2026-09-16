import * as XLSX from 'xlsx';
import { ItemValidade } from '../types';

export function calcularDiasRestantes(dataVencimentoStr: string): number {
  if (!dataVencimentoStr) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [ano, mes, dia] = dataVencimentoStr.split('-').map(Number);
  if (!ano || !mes || !dia) return 0;

  const vencimento = new Date(ano, mes - 1, dia);
  vencimento.setHours(0, 0, 0, 0);

  const diffMs = vencimento.getTime() - hoje.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function obterStatusValidade(diasRestantes: number): {
  status: 'vencido' | 'critico' | 'atencao' | 'regular';
  rotulo: string;
  badgeClass: string;
} {
  if (diasRestantes < 0) {
    return {
      status: 'vencido',
      rotulo: `Vencido há ${Math.abs(diasRestantes)} dia(s)`,
      badgeClass: 'bg-red-50 text-red-700 border-red-200 ring-red-500/20',
    };
  }
  if (diasRestantes === 0) {
    return {
      status: 'critico',
      rotulo: 'Vence hoje!',
      badgeClass: 'bg-red-100 text-red-800 border-red-300 ring-red-600/30',
    };
  }
  if (diasRestantes <= 7) {
    return {
      status: 'critico',
      rotulo: `Crítico (${diasRestantes} dias)`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-500/20',
    };
  }
  if (diasRestantes <= 30) {
    return {
      status: 'atencao',
      rotulo: `Atenção (${diasRestantes} dias)`,
      badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200 ring-yellow-500/20',
    };
  }
  return {
    status: 'regular',
    rotulo: `No Prazo (${diasRestantes} dias)`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
  };
}

export function formatarDataBR(dataIsoStr: string): string {
  if (!dataIsoStr) return '';
  const [ano, mes, dia] = dataIsoStr.split('T')[0].split('-');
  if (!ano || !mes || !dia) return dataIsoStr;
  return `${dia}/${mes}/${ano}`;
}

export function parseDataBrOuIso(val: any): string {
  if (!val) return '';
  // Se for número de série de data do Excel (ex: 45230)
  if (typeof val === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const y = String(parsed.y);
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // continua
    }
  }

  const str = String(val).trim();
  // Se já for YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // Se for DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0');
    const mes = brMatch[2].padStart(2, '0');
    let ano = brMatch[3];
    if (ano.length === 2) {
      ano = '20' + ano;
    }
    return `${ano}-${mes}-${dia}`;
  }

  // Tenta Date.parse padrão
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
}

// Converte arquivo Excel (.xlsx, .xls, .csv) em itens de validade
export async function importarDeExcel(file: File): Promise<Array<Omit<ItemValidade, 'id' | 'created_at'>>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('O arquivo de planilha está vazio.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('Nenhuma linha de dados encontrada na planilha.');
  }

  const itemsImportados: Array<Omit<ItemValidade, 'id' | 'created_at'>> = [];

  for (const row of rows) {
    // Procura colunas com suporte a diferentes variações de nomes
    const getVal = (...keys: string[]): any => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
        // Teste case-insensitive
        const lowerK = k.toLowerCase();
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase() === lowerK && row[rowKey] !== undefined && row[rowKey] !== '') {
            return row[rowKey];
          }
        }
      }
      return '';
    };

    const industria = String(getVal('Indústria / Marca', 'Industria', 'Fabricante', 'Marca', 'Empresa')).trim();
    const produto = String(getVal('Produto', 'Nome', 'Descricao', 'Descrição', 'Item', 'Mercadoria')).trim();
    const rawData = getVal('Data de Vencimento', 'Data Vencimento', 'Vencimento', 'Validade', 'Data', 'dt_vencimento');
    const dataVencimento = parseDataBrOuIso(rawData);

    // Produto e indústria e data de vencimento são os campos essenciais
    if (!produto && !industria) {
      continue; // Ignora linhas em branco
    }

    const rawQtd = getVal('Quantidade', 'Qtd', 'Estoque', 'Saldo');
    const quantidade = Number(rawQtd) > 0 ? Number(rawQtd) : 1;
    const unidade = String(getVal('Unidade', 'Un', 'Medida') || 'un').trim();
    const loja = String(getVal('Loja', 'Filial', 'Mercado', 'Cliente')).trim();
    const estado = String(getVal('Estado (UF)', 'Estado', 'UF', 'Regiao')).trim().toUpperCase().substring(0, 2);
    const coordenador = String(getVal('Coordenador', 'Supervisor', 'Responsável', 'Responsavel', 'Promotor')).trim();
    const lote = String(getVal('Lote', 'Lote / Fabricação', 'Batch')).trim();
    const observacoes = String(getVal('Observações', 'Observacao', 'Obs', 'Detalhes')).trim();

    itemsImportados.push({
      industria: industria || 'Geral',
      produto: produto || 'Produto Sem Nome',
      quantidade,
      unidade: unidade || 'un',
      data_vencimento: dataVencimento || new Date().toISOString().split('T')[0],
      loja,
      estado,
      coordenador,
      lote,
      observacoes,
    });
  }

  return itemsImportados;
}

export function baixarModeloExcelImportacao() {
  const modelo = [
    {
      'Loja': 'Supermercado Central Loja 01',
      'Estado (UF)': 'SP',
      'Coordenador': 'Carlos Silva',
      'Indústria / Marca': 'Nestlé',
      'Produto': 'Leite Condensado Moça 395g',
      'Quantidade': 48,
      'Unidade': 'cx',
      'Data de Vencimento': '30/10/2026',
      'Lote': 'LT-98214',
      'Observações': 'Exposto na ponta de gôndola',
    },
    {
      'Loja': 'Hipermercado Esperança',
      'Estado (UF)': 'RJ',
      'Coordenador': 'Mariana Santos',
      'Indústria / Marca': 'Ambev',
      'Produto': 'Cerveja Spaten Lata 350ml',
      'Quantidade': 120,
      'Unidade': 'un',
      'Data de Vencimento': '15/11/2026',
      'Lote': 'L240901',
      'Observações': 'Campanha de Verão',
    },
    {
      'Loja': 'Rede União Sul',
      'Estado (UF)': 'PR',
      'Coordenador': 'Roberto Souza',
      'Indústria / Marca': 'Bauducco',
      'Produto': 'Biscoito Recheado Chocooky 120g',
      'Quantidade': 60,
      'Unidade': 'pct',
      'Data de Vencimento': '05/12/2026',
      'Lote': 'B-3312',
      'Observações': 'Atenção ao giro',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(modelo);
  worksheet['!cols'] = [
    { wch: 28 }, // Loja
    { wch: 12 }, // Estado
    { wch: 20 }, // Coordenador
    { wch: 22 }, // Indústria
    { wch: 34 }, // Produto
    { wch: 12 }, // Quantidade
    { wch: 10 }, // Unidade
    { wch: 18 }, // Data Vencimento
    { wch: 16 }, // Lote
    { wch: 30 }, // Observações
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo_Importacao');
  XLSX.writeFile(workbook, 'Modelo_Controle_Validade_Importacao.xlsx');
}

export function exportarParaExcel(items: ItemValidade[], nomeArquivo = 'Controle_de_Validade') {
  const dadosFormatados = items.map((item) => {
    const dias = calcularDiasRestantes(item.data_vencimento);
    const statusObj = obterStatusValidade(dias);

    let statusTexto = 'No Prazo';
    if (dias < 0) statusTexto = `VENCIDO (${Math.abs(dias)} dias)`;
    else if (dias === 0) statusTexto = 'VENCE HOJE';
    else if (dias <= 7) statusTexto = `CRÍTICO (${dias} dias)`;
    else if (dias <= 30) statusTexto = `ATENÇÃO (${dias} dias)`;

    return {
      'Loja': item.loja || '-',
      'Estado (UF)': item.estado || '-',
      'Coordenador': item.coordenador || '-',
      'Indústria / Marca': item.industria,
      'Produto': item.produto,
      'Quantidade': item.quantidade,
      'Unidade': item.unidade || 'un',
      'Data de Vencimento': formatarDataBR(item.data_vencimento),
      'Dias Restantes': dias,
      'Situação': statusTexto,
      'Lote': item.lote || '-',
      'Observações': item.observacoes || '',
      'Data de Cadastro': item.created_at ? formatarDataBR(item.created_at) : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);

  // Definir largura de colunas otimizadas para Excel
  worksheet['!cols'] = [
    { wch: 24 }, // Loja
    { wch: 12 }, // Estado
    { wch: 20 }, // Coordenador
    { wch: 22 }, // Indústria
    { wch: 32 }, // Produto
    { wch: 12 }, // Quantidade
    { wch: 10 }, // Unidade
    { wch: 18 }, // Data Vencimento
    { wch: 15 }, // Dias Restantes
    { wch: 22 }, // Situação
    { wch: 16 }, // Lote
    { wch: 28 }, // Observações
    { wch: 18 }, // Data Cadastro
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Controle de Validade');

  const hojeStr = new Date().toISOString().split('T')[0];
  const filename = `${nomeArquivo}_${hojeStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
