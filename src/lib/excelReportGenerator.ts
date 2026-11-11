import ExcelJS from 'exceljs';
import { ItemValidade } from '../types';
import { calcularDiasRestantes, calcularDiasDesdeAdicao, formatarDataBR } from './excel';
import { formatarUnidadePDF } from './pdfGenerator';

export interface OpcoesRelatorioExcel {
  coordenadorSelecionado?: string;
  industriaSelecionada?: string;
  lojaSelecionada?: string;
  produtoSelecionado?: string;
  produtosSelecionados?: string[];
  skuSelecionado?: string;
  statusSelecionados?: string[];
  dataCadastroFiltro?: string;
  rotuloDataCadastro?: string;
  nomeSistema?: string;
  diasCritico?: number;
  diasNoPrazo?: number;
}

/**
 * Gera e baixa uma planilha profissional do Excel (.xlsx) com:
 * 1. Aba de Resumo & Tabelas Dinâmicas (KPIs, consolidado por Coordenador, Indústria e Loja).
 * 2. Aba de Base de Dados Completa com cabeçalhos estilizados, cores por status, filtros automáticos e totais.
 */
export async function exportarRelatorioExcelProfissional(
  items: ItemValidade[],
  opcoes: OpcoesRelatorioExcel = {}
): Promise<void> {
  const diasCritico = Number(opcoes.diasCritico) > 0 ? Number(opcoes.diasCritico) : 7;
  const diasNoPrazo = Number(opcoes.diasNoPrazo) > 0 ? Number(opcoes.diasNoPrazo) : 20;
  const nomeSistema = opcoes.nomeSistema || 'Controle de Validade de Produtos';
  const agora = new Date();
  const dataHoraEmissao =
    agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataIso = agora.toISOString().split('T')[0];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = nomeSistema;
  workbook.lastModifiedBy = nomeSistema;
  workbook.created = agora;
  workbook.modified = agora;

  // Cálculos de Totalizadores Globais
  let qtdTotalGeral = 0;
  let vencidosGeral = 0;
  let criticosGeral = 0;
  let atencaoGeral = 0;
  let noPrazoGeral = 0;

  items.forEach((it) => {
    qtdTotalGeral += Number(it.quantidade || 0);
    const dias = calcularDiasRestantes(it.data_vencimento);
    if (dias <= 0) vencidosGeral++;
    else if (dias <= diasCritico) criticosGeral++;
    else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) atencaoGeral++;
    else noPrazoGeral++;
  });

  const totalLinhas = items.length;
  const lojasUnicas = new Set(items.map((i) => (i.loja || '').trim()).filter(Boolean)).size;
  const industriasUnicas = new Set(items.map((i) => (i.industria || '').trim()).filter(Boolean)).size;
  const coordenadoresUnicos = new Set(
    items.map((i) => (i.vendedor || i.coordenador || '').trim()).filter(Boolean)
  ).size;

  // =========================================================================
  // ABA 1: RESUMO DINÂMICO & INDICADORES
  // =========================================================================
  const sheetResumo = workbook.addWorksheet('📊 Resumo da Extração', {
    views: [{ showGridLines: true }],
  });

  // Título do Cabeçalho
  sheetResumo.mergeCells('A1:H1');
  const titleCell = sheetResumo.getCell('A1');
  titleCell.value = `${nomeSistema.toUpperCase()} - PAINEL DE RESUMO DA EXTRAÇÃO`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate 800
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheetResumo.getRow(1).height = 30;

  // Subtítulo com Parâmetros da Extração
  sheetResumo.mergeCells('A2:H2');
  const subCell = sheetResumo.getCell('A2');
  let filtrosDesc = `Emissão: ${dataHoraEmissao} | Critério: Crítico ≤ ${diasCritico}d, No Prazo ≥ ${diasNoPrazo}d`;
  if (opcoes.coordenadorSelecionado && opcoes.coordenadorSelecionado !== 'todos') {
    filtrosDesc += ` | Coord: ${opcoes.coordenadorSelecionado}`;
  }
  if (opcoes.industriaSelecionada && opcoes.industriaSelecionada !== 'todas') {
    filtrosDesc += ` | Ind: ${opcoes.industriaSelecionada}`;
  }
  if (opcoes.lojaSelecionada && opcoes.lojaSelecionada !== 'todas') {
    filtrosDesc += ` | Loja: ${opcoes.lojaSelecionada}`;
  }
  if (opcoes.skuSelecionado && opcoes.skuSelecionado !== 'todos') {
    filtrosDesc += ` | SKU: ${opcoes.skuSelecionado}`;
  }
  if (opcoes.rotuloDataCadastro || opcoes.dataCadastroFiltro) {
    filtrosDesc += ` | Cadastro: ${opcoes.rotuloDataCadastro || opcoes.dataCadastroFiltro}`;
  }

  subCell.value = filtrosDesc;
  subCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheetResumo.getRow(2).height = 20;

  // Espaçamento
  sheetResumo.getRow(3).height = 10;

  // CARDS DE INDICADORES / KPIS (Linha 4 e 5)
  const kpis = [
    { col: 'A', titulo: 'TOTAL PRODUTOS', valor: `${totalLinhas} itens`, corFundo: 'FF2563EB', corTexto: 'FFFFFFFF' },
    { col: 'B', titulo: 'QUANTIDADE TOTAL', valor: `${qtdTotalGeral} Un`, corFundo: 'FF1D4ED8', corTexto: 'FFFFFFFF' },
    { col: 'C', titulo: 'VENCIDOS (≤ 0d)', valor: `${vencidosGeral}`, corFundo: 'FFDC2626', corTexto: 'FFFFFFFF' },
    { col: 'D', titulo: `CRÍTICOS (≤ ${diasCritico}d)`, valor: `${criticosGeral}`, corFundo: 'FFD97706', corTexto: 'FFFFFFFF' },
    { col: 'E', titulo: `ATENÇÃO (< ${diasNoPrazo}d)`, valor: `${atencaoGeral}`, corFundo: 'FF0284C7', corTexto: 'FFFFFFFF' },
    { col: 'F', titulo: `NO PRAZO (≥ ${diasNoPrazo}d)`, valor: `${noPrazoGeral}`, corFundo: 'FF059669', corTexto: 'FFFFFFFF' },
    { col: 'G', titulo: 'LOJAS ATENDIDAS', valor: `${lojasUnicas}`, corFundo: 'FF475569', corTexto: 'FFFFFFFF' },
    { col: 'H', titulo: 'INDÚSTRIAS', valor: `${industriasUnicas}`, corFundo: 'FF334155', corTexto: 'FFFFFFFF' },
  ];

  kpis.forEach((kpi) => {
    const celulaTitulo = sheetResumo.getCell(`${kpi.col}4`);
    celulaTitulo.value = kpi.titulo;
    celulaTitulo.font = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    celulaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.corFundo } };
    celulaTitulo.alignment = { horizontal: 'center', vertical: 'middle' };

    const celulaValor = sheetResumo.getCell(`${kpi.col}5`);
    celulaValor.value = kpi.valor;
    celulaValor.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF0F172A' } };
    celulaValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    celulaValor.alignment = { horizontal: 'center', vertical: 'middle' };
    celulaValor.border = {
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'medium', color: { argb: kpi.corFundo } },
    };
  });
  sheetResumo.getRow(4).height = 18;
  sheetResumo.getRow(5).height = 24;

  // Espaçamento
  sheetResumo.getRow(6).height = 14;

  // -------------------------------------------------------------------------
  // TABELA DINÂMICA 1: CONSOLIDADO POR COORDENADOR / VENDEDOR
  // -------------------------------------------------------------------------
  let linhaAtual = 7;
  sheetResumo.mergeCells(`A${linhaAtual}:H${linhaAtual}`);
  const secCoord = sheetResumo.getCell(`A${linhaAtual}`);
  secCoord.value = '👥 RESUMO DINÂMICO CONSOLIDADO POR COORDENADOR / VENDEDOR';
  secCoord.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  secCoord.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } }; // Indigo 900
  secCoord.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheetResumo.getRow(linhaAtual).height = 22;

  linhaAtual++;
  const cabecalhoCoord = [
    'Coordenador / Vendedor',
    'Total Produtos',
    'Quantidade Total (Un)',
    `Vencidos (≤0d)`,
    `Críticos (≤${diasCritico}d)`,
    `Atenção (<${diasNoPrazo}d)`,
    `No Prazo (≥${diasNoPrazo}d)`,
    '% Em Risco (Crít.+Venc.)',
  ];

  const rowCabCoord = sheetResumo.getRow(linhaAtual);
  rowCabCoord.values = cabecalhoCoord;
  rowCabCoord.height = 20;
  rowCabCoord.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; // Indigo 700
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF312E81' } } };
  });

  // Agrupamento por Coordenador
  const mapaCoord = new Map<
    string,
    { nome: string; itensCount: number; qtdTotal: number; vencidos: number; criticos: number; atencao: number; noPrazo: number }
  >();

  items.forEach((it) => {
    const nome = (it.vendedor || it.coordenador || 'Sem Coordenador Atribuído').trim();
    const curr = mapaCoord.get(nome) || {
      nome,
      itensCount: 0,
      qtdTotal: 0,
      vencidos: 0,
      criticos: 0,
      atencao: 0,
      noPrazo: 0,
    };
    curr.itensCount += 1;
    curr.qtdTotal += Number(it.quantidade || 0);
    const dias = calcularDiasRestantes(it.data_vencimento);
    if (dias <= 0) curr.vencidos++;
    else if (dias <= diasCritico) curr.criticos++;
    else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) curr.atencao++;
    else curr.noPrazo++;
    mapaCoord.set(nome, curr);
  });

  const listaCoord = Array.from(mapaCoord.values()).sort((a, b) => (b.vencidos + b.criticos) - (a.vencidos + a.criticos));
  const inicioLinhasCoord = linhaAtual + 1;

  listaCoord.forEach((c) => {
    linhaAtual++;
    const totalCriticosVenc = c.vencidos + c.criticos;
    const percRisco = c.itensCount > 0 ? (totalCriticosVenc / c.itensCount) : 0;

    const row = sheetResumo.getRow(linhaAtual);
    row.values = [
      c.nome,
      c.itensCount,
      c.qtdTotal,
      c.vencidos,
      c.criticos,
      c.atencao,
      c.noPrazo,
      percRisco,
    ];
    row.height = 19;

    const bgCor = (linhaAtual % 2 === 0) ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgCor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.font = { name: 'Calibri', size: 9, bold: true };
      } else if (colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0%';
        if (percRisco > 0.3) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNumber === 3) cell.numFmt = '#,##0" Un"';
        if (colNumber === 4 && c.vencidos > 0) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        }
        if (colNumber === 5 && c.criticos > 0) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFD97706' } };
        }
        if (colNumber === 7) {
          cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF059669' } };
        }
      }
    });
  });

  // Linha Totalizadora de Coordenadores
  linhaAtual++;
  const rowTotCoord = sheetResumo.getRow(linhaAtual);
  rowTotCoord.values = [
    'TOTAL GERAL DOS COORDENADORES',
    { formula: `SUM(B${inicioLinhasCoord}:B${linhaAtual - 1})` },
    { formula: `SUM(C${inicioLinhasCoord}:C${linhaAtual - 1})` },
    { formula: `SUM(D${inicioLinhasCoord}:D${linhaAtual - 1})` },
    { formula: `SUM(E${inicioLinhasCoord}:E${linhaAtual - 1})` },
    { formula: `SUM(F${inicioLinhasCoord}:F${linhaAtual - 1})` },
    { formula: `SUM(G${inicioLinhasCoord}:G${linhaAtual - 1})` },
    { formula: `IF(B${linhaAtual}>0,(D${linhaAtual}+E${linhaAtual})/B${linhaAtual},0)` },
  ];
  rowTotCoord.height = 21;
  rowTotCoord.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1E1B4B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Indigo 100
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF4338CA' } },
      bottom: { style: 'double', color: { argb: 'FF312E81' } },
    };
    if (colNumber === 1) cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    else if (colNumber === 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '0.0%';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (colNumber === 3) cell.numFmt = '#,##0" Un"';
    }
  });

  // Espaçamento
  linhaAtual += 2;

  // -------------------------------------------------------------------------
  // TABELA DINÂMICA 2: CONSOLIDADO POR INDÚSTRIA / FABRICANTE
  // -------------------------------------------------------------------------
  sheetResumo.mergeCells(`A${linhaAtual}:H${linhaAtual}`);
  const secInd = sheetResumo.getCell(`A${linhaAtual}`);
  secInd.value = '🏭 RESUMO DINÂMICO CONSOLIDADO POR INDÚSTRIA / FABRICANTE';
  secInd.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  secInd.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } }; // Purple 900
  secInd.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheetResumo.getRow(linhaAtual).height = 22;

  linhaAtual++;
  const cabecalhoInd = [
    'Indústria / Fabricante',
    'Total Produtos',
    'Quantidade Total (Un)',
    `Vencidos (≤0d)`,
    `Críticos (≤${diasCritico}d)`,
    `Atenção (<${diasNoPrazo}d)`,
    `No Prazo (≥${diasNoPrazo}d)`,
    '% do Total da Extração',
  ];

  const rowCabInd = sheetResumo.getRow(linhaAtual);
  rowCabInd.values = cabecalhoInd;
  rowCabInd.height = 20;
  rowCabInd.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } }; // Purple 700
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF4C1D95' } } };
  });

  const mapaInd = new Map<
    string,
    { nome: string; itensCount: number; qtdTotal: number; vencidos: number; criticos: number; atencao: number; noPrazo: number }
  >();

  items.forEach((it) => {
    const nome = (it.industria || 'Sem Indústria Atribuída').trim();
    const curr = mapaInd.get(nome) || {
      nome,
      itensCount: 0,
      qtdTotal: 0,
      vencidos: 0,
      criticos: 0,
      atencao: 0,
      noPrazo: 0,
    };
    curr.itensCount += 1;
    curr.qtdTotal += Number(it.quantidade || 0);
    const dias = calcularDiasRestantes(it.data_vencimento);
    if (dias <= 0) curr.vencidos++;
    else if (dias <= diasCritico) curr.criticos++;
    else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) curr.atencao++;
    else curr.noPrazo++;
    mapaInd.set(nome, curr);
  });

  const listaInd = Array.from(mapaInd.values()).sort((a, b) => b.qtdTotal - a.qtdTotal);
  const inicioLinhasInd = linhaAtual + 1;

  listaInd.forEach((ind) => {
    linhaAtual++;
    const percDoTotal = qtdTotalGeral > 0 ? ind.qtdTotal / qtdTotalGeral : 0;

    const row = sheetResumo.getRow(linhaAtual);
    row.values = [
      ind.nome,
      ind.itensCount,
      ind.qtdTotal,
      ind.vencidos,
      ind.criticos,
      ind.atencao,
      ind.noPrazo,
      percDoTotal,
    ];
    row.height = 19;

    const bgCor = (linhaAtual % 2 === 0) ? 'FFF8FAFC' : 'FFFFFFFF';
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgCor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (colNumber === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        cell.font = { name: 'Calibri', size: 9, bold: true };
      } else if (colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '0.0%';
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (colNumber === 3) cell.numFmt = '#,##0" Un"';
        if (colNumber === 4 && ind.vencidos > 0) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFDC2626' } };
        }
        if (colNumber === 5 && ind.criticos > 0) {
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFD97706' } };
        }
      }
    });
  });

  // Linha Totalizadora de Indústrias
  linhaAtual++;
  const rowTotInd = sheetResumo.getRow(linhaAtual);
  rowTotInd.values = [
    'TOTAL GERAL DAS INDÚSTRIAS',
    { formula: `SUM(B${inicioLinhasInd}:B${linhaAtual - 1})` },
    { formula: `SUM(C${inicioLinhasInd}:C${linhaAtual - 1})` },
    { formula: `SUM(D${inicioLinhasInd}:D${linhaAtual - 1})` },
    { formula: `SUM(E${inicioLinhasInd}:E${linhaAtual - 1})` },
    { formula: `SUM(F${inicioLinhasInd}:F${linhaAtual - 1})` },
    { formula: `SUM(G${inicioLinhasInd}:G${linhaAtual - 1})` },
    1,
  ];
  rowTotInd.height = 21;
  rowTotInd.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF3B0764' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // Purple 100
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF6D28D9' } },
      bottom: { style: 'double', color: { argb: 'FF4C1D95' } },
    };
    if (colNumber === 1) cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    else if (colNumber === 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '0.0%';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (colNumber === 3) cell.numFmt = '#,##0" Un"';
    }
  });

  // Ajuste de largura das colunas da aba de resumo
  sheetResumo.columns = [
    { width: 34 }, // Coordenador / Indústria
    { width: 16 }, // Total Produtos
    { width: 22 }, // Quantidade Total (Un)
    { width: 18 }, // Vencidos
    { width: 18 }, // Críticos
    { width: 18 }, // Atenção
    { width: 18 }, // No Prazo
    { width: 24 }, // %
  ];

  // =========================================================================
  // ABA 2: BASE DE DADOS COMPLETA (EXTRAÇÃO LINHA A LINHA)
  // =========================================================================
  const sheetBase = workbook.addWorksheet('📋 Base de Dados', {
    views: [{ showGridLines: true }],
  });

  // Título da Base de Dados
  sheetBase.mergeCells('A1:O1');
  const baseTitle = sheetBase.getCell('A1');
  baseTitle.value = `${nomeSistema.toUpperCase()} - BASE DE DADOS COMPLETA`;
  baseTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  baseTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Blue 900
  baseTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  sheetBase.getRow(1).height = 26;

  sheetBase.mergeCells('A2:O2');
  const baseSub = sheetBase.getCell('A2');
  baseSub.value = `Extração realizada em: ${dataHoraEmissao} | Total de Registros: ${totalLinhas} produtos (${qtdTotalGeral} Un) | Filtros ativos aplicados na extração`;
  baseSub.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
  baseSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  baseSub.alignment = { vertical: 'middle', horizontal: 'center' };
  sheetBase.getRow(2).height = 18;

  // Cabeçalhos da Tabela Base (Linha 3)
  const colunasBase = [
    'Vendedor / Coord.',
    'Loja / Filial',
    'UF',
    'Indústria / Marca',
    'SKU / Código',
    'Descrição do Produto',
    'Quantidade',
    'Unidade',
    'Data de Vencimento',
    'Dias p/ Vencer',
    'Situação da Validade',
    'Data de Cadastro',
    'Dias Cadastrado',
    'Lote',
    'Observações',
  ];

  const rowCabBase = sheetBase.getRow(3);
  rowCabBase.values = colunasBase;
  rowCabBase.height = 22;
  rowCabBase.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue 600
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      top: { style: 'thin', color: { argb: 'FF1D4ED8' } },
    };
  });

  // População das Linhas de Dados
  items.forEach((it, idx) => {
    const numLinha = idx + 4;
    const dias = calcularDiasRestantes(it.data_vencimento);
    const responsavel = (it.vendedor || it.coordenador || '-').trim();
    const loja = (it.loja || '-').trim();
    const uf = (it.estado || '-').trim().toUpperCase();
    const industria = (it.industria || '-').trim();
    const sku = it.codigo ? String(it.codigo).trim() : '-';
    const produto = (it.produto || '').trim();
    const quantidade = Number(it.quantidade || 0);
    const unidadeFormatada = formatarUnidadePDF(it.unidade);
    const vencimentoBR = formatarDataBR(it.data_vencimento);
    const infoCad = calcularDiasDesdeAdicao(it.created_at);

    let situacao = `No Prazo (≥${diasNoPrazo}d)`;
    let situacaoCorBg = 'FFD1FAE5'; // Emerald 100
    let situacaoCorTxt = 'FF065F46'; // Emerald 800

    if (dias < 0) {
      situacao = `Vencido há ${Math.abs(dias)}d`;
      situacaoCorBg = 'FFFEE2E2'; // Red 100
      situacaoCorTxt = 'FF991B1B'; // Red 800
    } else if (dias === 0) {
      situacao = 'Vence HOJE';
      situacaoCorBg = 'FFFEE2E2';
      situacaoCorTxt = 'FF991B1B';
    } else if (dias <= diasCritico) {
      situacao = `Crítico (≤${diasCritico}d)`;
      situacaoCorBg = 'FFFEF3C7'; // Amber 100
      situacaoCorTxt = 'FF92400E'; // Amber 800
    } else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) {
      situacao = `Atenção (<${diasNoPrazo}d)`;
      situacaoCorBg = 'FFE0F2FE'; // Sky 100
      situacaoCorTxt = 'FF075985'; // Sky 800
    }

    const row = sheetBase.getRow(numLinha);
    row.values = [
      responsavel,
      loja,
      uf,
      industria,
      sku,
      produto,
      quantidade,
      unidadeFormatada,
      vencimentoBR,
      dias,
      situacao,
      infoCad.dataFormatada !== '-' ? infoCad.dataFormatada : '',
      infoCad.rotulo !== '-' ? infoCad.rotulo : '',
      it.lote || '-',
      it.observacoes || '',
    ];
    row.height = 19;

    const bgZebra = (numLinha % 2 === 0) ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgZebra } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      // Alinhamentos específicos
      if (colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
      } else if (colNumber === 7) {
        // Quantidade
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0';
        cell.font = { name: 'Calibri', size: 9, bold: true };
      } else if (colNumber === 10) {
        // Dias p/ Vencer
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = {
          name: 'Calibri',
          size: 9,
          bold: true,
          color: { argb: dias <= 0 ? 'FFDC2626' : dias <= diasCritico ? 'FFD97706' : dias < diasNoPrazo ? 'FF0284C7' : 'FF059669' },
        };
      } else if (colNumber === 11) {
        // Situação com cor de destaque do sistema
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: situacaoCorBg } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: situacaoCorTxt } };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
  });

  // Linha de Rodapé Totalizador da Base
  const linhaTotalBase = items.length + 4;
  const rowTotBase = sheetBase.getRow(linhaTotalBase);
  rowTotBase.values = [
    'TOTAL CONSOLIDADO',
    `${lojasUnicas} lojas`,
    '-',
    `${industriasUnicas} indústrias`,
    `${totalLinhas} SKUs`,
    `${totalLinhas} produtos`,
    { formula: `SUM(G4:G${linhaTotalBase - 1})` },
    'Un',
    '-',
    '-',
    `${vencidosGeral} venc. / ${criticosGeral} crít. / ${noPrazoGeral} no prazo`,
    '-',
    '-',
    '-',
    '-',
  ];
  rowTotBase.height = 22;
  rowTotBase.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Blue 100
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2563EB' } },
      bottom: { style: 'double', color: { argb: 'FF1D4ED8' } },
    };
    if (colNumber === 1) cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    else if (colNumber === 7) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  // Configurar Filtros Automáticos (AutoFilter) na Linha de Cabeçalho da Base
  sheetBase.autoFilter = {
    from: 'A3',
    to: `O${linhaTotalBase - 1}`,
  };

  // Largura das Colunas da Base
  sheetBase.columns = [
    { width: 25 }, // Vendedor / Coord
    { width: 25 }, // Loja
    { width: 8 },  // UF
    { width: 22 }, // Indústria
    { width: 18 }, // SKU
    { width: 36 }, // Descrição do Produto
    { width: 14 }, // Quantidade
    { width: 10 }, // Unidade
    { width: 16 }, // Vencimento
    { width: 14 }, // Dias p/ Vencer
    { width: 22 }, // Situação
    { width: 16 }, // Data de Cadastro
    { width: 16 }, // Dias Cadastrado
    { width: 14 }, // Lote
    { width: 26 }, // Observações
  ];

  // =========================================================================
  // GERAÇÃO DO ARQUIVO BINÁRIO E DOWNLOAD NO NAVEGADOR
  // =========================================================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  let sufixoNome = 'Geral';
  if (opcoes.coordenadorSelecionado && opcoes.coordenadorSelecionado !== 'todos') {
    sufixoNome = opcoes.coordenadorSelecionado.replace(/[^a-zA-Z0-9]/g, '_');
  }

  const nomeArquivoFinal = `Relatorio_Validades_${sufixoNome}_${dataIso}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivoFinal;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
