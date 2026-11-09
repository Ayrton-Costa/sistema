import * as XLSX from 'xlsx';
import { ItemValidade, ProdutoCatalogo } from '../types';

/**
 * Extrai com precisão ano, mês e dia de qualquer formato (ISO, BR, timestamp, etc.)
 */
export function extrairAnoMesDia(dataInput: any): { ano: number; mes: number; dia: number } | null {
  if (!dataInput) return null;

  if (dataInput instanceof Date && !isNaN(dataInput.getTime())) {
    return {
      ano: dataInput.getFullYear(),
      mes: dataInput.getMonth() + 1,
      dia: dataInput.getDate(),
    };
  }

  const str = String(dataInput).trim();
  if (!str) return null;

  // 1. Formato YYYY-MM-DD (com ou sem timestamp T... ou espaço...)
  const matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (matchIso) {
    const ano = parseInt(matchIso[1], 10);
    const mes = parseInt(matchIso[2], 10);
    const dia = parseInt(matchIso[3], 10);
    if (ano > 1900 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return { ano, mes, dia };
    }
  }

  // 2. Formato brasileiro DD/MM/YYYY ou DD-MM-YYYY
  const matchBr = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (matchBr) {
    let dia = parseInt(matchBr[1], 10);
    let mes = parseInt(matchBr[2], 10);
    let ano = parseInt(matchBr[3], 10);
    if (ano < 100) ano += 2000;
    if (ano > 1900 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return { ano, mes, dia };
    }
  }

  // 3. Fallback: tentar Date.parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    if (str.includes('Z')) {
      return {
        ano: d.getUTCFullYear(),
        mes: d.getUTCMonth() + 1,
        dia: d.getUTCDate(),
      };
    }
    return {
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      dia: d.getDate(),
    };
  }

  return null;
}

export function calcularDiasRestantes(dataVencimentoStr: string): number {
  if (!dataVencimentoStr) return 0;

  const ymd = extrairAnoMesDia(dataVencimentoStr);
  if (!ymd) return 0;

  // Pega a data local de hoje (ano, mês, dia)
  const hoje = new Date();
  const hojeAno = hoje.getFullYear();
  const hojeMes = hoje.getMonth();
  const hojeDia = hoje.getDate();

  // Compara usando UTC midnight para evitar qualquer distorção de fuso horário ou horário de verão
  const utcHoje = Date.UTC(hojeAno, hojeMes, hojeDia);
  const utcVenc = Date.UTC(ymd.ano, ymd.mes - 1, ymd.dia);

  const diffMs = utcVenc - utcHoje;
  const umDiaMs = 1000 * 60 * 60 * 24;

  return Math.round(diffMs / umDiaMs);
}

export function calcularDiasDesdeAdicao(createdAtStr?: string): {
  dataFormatada: string;
  diasAtras: number;
  rotulo: string;
} {
  if (!createdAtStr) {
    return { dataFormatada: '-', diasAtras: 0, rotulo: '-' };
  }

  const ymd = extrairAnoMesDia(createdAtStr);
  if (!ymd) {
    return { dataFormatada: '-', diasAtras: 0, rotulo: '-' };
  }

  const hoje = new Date();
  const hojeAno = hoje.getFullYear();
  const hojeMes = hoje.getMonth();
  const hojeDia = hoje.getDate();

  const utcHoje = Date.UTC(hojeAno, hojeMes, hojeDia);
  const utcCriado = Date.UTC(ymd.ano, ymd.mes - 1, ymd.dia);

  const diffMs = utcHoje - utcCriado;
  const umDiaMs = 1000 * 60 * 60 * 24;
  const diasAtras = Math.max(0, Math.round(diffMs / umDiaMs));

  const pad = (n: number) => String(n).padStart(2, '0');
  const dataFormatada = `${pad(ymd.dia)}/${pad(ymd.mes)}/${ymd.ano}`;

  let rotulo = '0d (Hoje)';
  if (diasAtras === 1) {
    rotulo = '1d (Ontem)';
  } else if (diasAtras > 1) {
    rotulo = `${diasAtras}d atrás`;
  }

  return {
    dataFormatada,
    diasAtras,
    rotulo,
  };
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
  const ymd = extrairAnoMesDia(dataIsoStr);
  if (!ymd) return String(dataIsoStr);
  const diaStr = String(ymd.dia).padStart(2, '0');
  const mesStr = String(ymd.mes).padStart(2, '0');
  return `${diaStr}/${mesStr}/${ymd.ano}`;
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

    const codigo = String(getVal('Código', 'Codigo', 'Cód', 'Cod', 'SKU', 'EAN', 'Código de Barras', 'Codigo de Barras') || '').trim();
    const industria = String(getVal('Indústria / Marca', 'Industria', 'Fabricante', 'Marca', 'Empresa')).trim();
    const produto = String(getVal('Produto', 'Nome', 'Descricao', 'Descrição', 'Item', 'Mercadoria')).trim();
    const rawData = getVal('Data de Vencimento', 'Data Vencimento', 'Vencimento', 'Validade', 'Data', 'dt_vencimento');
    const dataVencimento = parseDataBrOuIso(rawData);

    // Produto e indústria e data de vencimento são os campos essenciais
    if (!produto && !industria && !codigo) {
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
      codigo: codigo || undefined,
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
      'Código': '7891000100103',
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
      'Código': '7891991010834',
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
      'Código': '7891079012345',
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
    { wch: 18 }, // Código
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

    const infoCadastro = calcularDiasDesdeAdicao(item.created_at);

    return {
      'Código': item.codigo || '-',
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
      'Data de Cadastro': infoCadastro.dataFormatada !== '-' ? infoCadastro.dataFormatada : '',
      'Dias Cadastrado': infoCadastro.dataFormatada !== '-' ? infoCadastro.rotulo : '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);

  // Definir largura de colunas otimizadas para Excel
  worksheet['!cols'] = [
    { wch: 16 }, // Código
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
    { wch: 18 }, // Dias Cadastrado
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Controle de Validade');

  const hojeStr = new Date().toISOString().split('T')[0];
  const filename = `${nomeArquivo}_${hojeStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

// Exportar catálogo de produtos cadastrados para Excel
export function exportarProdutosCatalogoParaExcel(produtos: ProdutoCatalogo[], nomeArquivo = 'Catalogo_Produtos_Cadastrados') {
  const dadosFormatados = produtos.map((p) => ({
    'Código': p.codigo || '',
    'Indústria': p.industria,
    'Produto': p.nome,
    'Unidade Padrão': p.unidade_padrao || 'un',
    'Status Supabase': p.syncedToSupabase === false ? 'Pendente de Sincronização' : 'Sincronizado',
    'Data de Cadastro': p.created_at ? formatarDataBR(p.created_at) : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);

  worksheet['!cols'] = [
    { wch: 18 }, // Código
    { wch: 25 }, // Indústria
    { wch: 38 }, // Produto
    { wch: 16 }, // Unidade Padrão
    { wch: 25 }, // Status Supabase
    { wch: 18 }, // Data de Cadastro
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');

  const hojeStr = new Date().toISOString().split('T')[0];
  const filename = `${nomeArquivo}_${hojeStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

// Baixar modelo de planilha para importação em lote de produtos
export function baixarModeloCadastroProdutosExcel() {
  const modelo = [
    {
      'Código': '7891000100103',
      'Indústria': 'Nestlé',
      'Produto': 'Leite Condensado Moça 395g',
      'Unidade': 'un',
    },
    {
      'Código': '7891991010834',
      'Indústria': 'Ambev',
      'Produto': 'Cerveja Spaten Lata 350ml',
      'Unidade': 'un',
    },
    {
      'Código': '7891079012345',
      'Indústria': 'Bauducco',
      'Produto': 'Biscoito Recheado Chocooky 120g',
      'Unidade': 'pct',
    },
    {
      'Código': '7898024394182',
      'Indústria': 'Unilever',
      'Produto': 'Sabão em Pó Omo Lavagem Perfeita 1.6kg',
      'Unidade': 'cx',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(modelo);
  worksheet['!cols'] = [
    { wch: 20 }, // Código
    { wch: 25 }, // Indústria
    { wch: 40 }, // Produto
    { wch: 12 }, // Unidade
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo_Produtos');
  XLSX.writeFile(workbook, 'Modelo_Cadastro_Produtos.xlsx');
}

// Importar produtos de arquivo Excel (.xlsx, .xls, .csv)
export async function importarProdutosDeExcel(file: File): Promise<Array<{
  codigo?: string;
  industria: string;
  produto: string;
  unidade?: string;
}>> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('O arquivo de planilha está vazio.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('Nenhuma linha de produto encontrada na planilha.');
  }

  const produtos: Array<{
    codigo?: string;
    industria: string;
    produto: string;
    unidade?: string;
  }> = [];

  for (const row of rows) {
    const getVal = (...keys: string[]): any => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== '') return row[k];
        const lowerK = k.toLowerCase();
        for (const rowKey of Object.keys(row)) {
          if (rowKey.toLowerCase() === lowerK && row[rowKey] !== undefined && row[rowKey] !== '') {
            return row[rowKey];
          }
        }
      }
      return '';
    };

    const codigo = String(getVal('Código', 'Codigo', 'Cód', 'Cod', 'SKU', 'EAN', 'Código de Barras', 'Codigo de Barras') || '').trim();
    const industria = String(getVal('Indústria', 'Industria', 'Fabricante', 'Marca', 'Empresa', 'Indústria / Marca') || '').trim();
    const produto = String(getVal('Produto', 'Nome', 'Descricao', 'Descrição', 'Item', 'Mercadoria', 'Nome do Produto') || '').trim();
    const unidade = String(getVal('Unidade', 'Un', 'Medida', 'Unidade Padrão', 'Unidade Padrao') || 'un').trim();

    if (!produto && !industria && !codigo) continue;

    if (produto) {
      produtos.push({
        codigo: codigo || undefined,
        industria: industria || 'Geral',
        produto,
        unidade: unidade || 'un',
      });
    }
  }

  return produtos;
}
