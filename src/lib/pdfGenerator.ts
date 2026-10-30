import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ItemValidade } from '../types';
import { calcularDiasRestantes, formatarDataBR } from './excel';

export interface OpcoesRelatorioPDF {
  coordenadorSelecionado?: string;
  industriaSelecionada?: string;
  lojaSelecionada?: string;
  skuSelecionado?: string;
  statusSelecionados?: string[];
  statusSelecionado?: string;
  nomeSistema?: string;
  geradoPor?: string;
  diasCritico?: number;
  diasNoPrazo?: number;
}

export function criarRelatorioPDFDoc(
  items: ItemValidade[],
  opcoes: OpcoesRelatorioPDF = {}
): { doc: jsPDF; nomeArquivo: string } {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const dataHoraEmissao = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nomeSistema = opcoes.nomeSistema || 'Controle de Validade de Produtos';
  const diasCritico = Number(opcoes.diasCritico) > 0 ? Number(opcoes.diasCritico) : 7;
  const diasNoPrazo = Number(opcoes.diasNoPrazo) > 0 ? Number(opcoes.diasNoPrazo) : 20;

  // 1. Cabeçalho do Documento
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, doc.internal.pageSize.width, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(nomeSistema.toUpperCase(), 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('RELATÓRIO DE CONTROLE DE VALIDADE POR COORDENADOR / VENDEDOR / LOJA / INDÚSTRIA', 14, 16);

  doc.setFontSize(8);
  doc.text(`Emissão: ${dataHoraEmissao}`, doc.internal.pageSize.width - 14, 14, { align: 'right' });

  // 2. Parâmetros do Filtro e KPIs
  let coordTexto = 'Todos (Geral)';
  if (opcoes.coordenadorSelecionado && opcoes.coordenadorSelecionado !== 'todos') {
    coordTexto = opcoes.coordenadorSelecionado;
  }

  let indTexto = 'Todas (Geral)';
  if (opcoes.industriaSelecionada && opcoes.industriaSelecionada !== 'todas') {
    indTexto = opcoes.industriaSelecionada;
  }

  let lojaTexto = '';
  if (opcoes.lojaSelecionada && opcoes.lojaSelecionada !== 'todas') {
    lojaTexto = opcoes.lojaSelecionada;
  }

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`Coord./Vend.: `, 14, 28);
  doc.setFont('helvetica', 'normal');
  doc.text(coordTexto, 37, 28);

  doc.setFont('helvetica', 'bold');
  doc.text(`Indústria: `, 95, 28);
  doc.setFont('helvetica', 'normal');
  doc.text(indTexto, 110, 28);

  if (lojaTexto) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Loja: `, 160, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(lojaTexto.length > 22 ? lojaTexto.substring(0, 20) + '...' : lojaTexto, 169, 28);
  }

  if (opcoes.skuSelecionado && opcoes.skuSelecionado !== 'todos') {
    const posX = lojaTexto ? 210 : 160;
    doc.setFont('helvetica', 'bold');
    doc.text(`SKU: `, posX, 28);
    doc.setFont('helvetica', 'normal');
    doc.text(opcoes.skuSelecionado, posX + 10, 28);
  }

  const posCrit = opcoes.skuSelecionado && opcoes.skuSelecionado !== 'todos' ? 245 : 215;
  doc.setFont('helvetica', 'bold');
  doc.text(`Critério: `, posCrit, 28);
  doc.setFont('helvetica', 'normal');
  doc.text(`≤${diasCritico}d Crít. | ≥${diasNoPrazo}d No Prazo`, posCrit + 13, 28);

  // Totais
  let qtdTotal = 0;
  let vencidos = 0;
  let criticos = 0;
  let atencao = 0;
  let noPrazo = 0;

  items.forEach((it) => {
    qtdTotal += Number(it.quantidade || 0);
    const dias = calcularDiasRestantes(it.data_vencimento);
    if (dias <= 0) {
      vencidos++;
    } else if (dias <= diasCritico) {
      criticos++;
    } else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) {
      atencao++;
    } else {
      noPrazo++;
    }
  });

  // Linha de Resumo / KPIs
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 33, doc.internal.pageSize.width - 28, 12, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DE ITENS:', 18, 40.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${items.length} reg.`, 48, 40.5);

  doc.setFont('helvetica', 'bold');
  doc.text('QTD TOTAL:', 72, 40.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${qtdTotal} un`, 91, 40.5);

  doc.setTextColor(185, 28, 28); // red-700
  doc.setFont('helvetica', 'bold');
  doc.text('VENCIDOS:', 116, 40.5);
  doc.text(`${vencidos}`, 136, 40.5);

  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`CRÍTICOS (≤${diasCritico}d):`, 150, 40.5);
  doc.text(`${criticos}`, 180, 40.5);

  if (diasNoPrazo > diasCritico && atencao > 0) {
    doc.setTextColor(3, 105, 161); // sky-700
    doc.text(`ATENÇÃO (<${diasNoPrazo}d):`, 194, 40.5);
    doc.text(`${atencao}`, 230, 40.5);

    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text(`NO PRAZO (≥${diasNoPrazo}d):`, 242, 40.5);
    doc.text(`${noPrazo}`, 276, 40.5);
  } else {
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text(`NO PRAZO (≥${diasNoPrazo}d):`, 204, 40.5);
    doc.text(`${noPrazo}`, 244, 40.5);
  }

  // 3. Montagem da Tabela com autoTable
  const rows = items.map((it) => {
    const dias = calcularDiasRestantes(it.data_vencimento);
    const responsavel = (it.vendedor || it.coordenador || '-').trim();
    const loja = (it.loja || 'Loja Principal').trim();
    const uf = it.estado ? ` (${it.estado.trim().toUpperCase()})` : '';
    const industria = (it.industria || '-').trim();
    const sku = it.codigo ? String(it.codigo).trim() : '-';
    const produto = (it.produto || '').trim();
    const qtd = `${it.quantidade} ${it.unidade || 'un'}`;
    const vencimento = formatarDataBR(it.data_vencimento);

    let situacao = `No Prazo (≥${diasNoPrazo}d)`;
    let diasStr = `${dias}d`;
    if (dias < 0) {
      situacao = `Vencido há ${Math.abs(dias)}d`;
      diasStr = `${dias}d`;
    } else if (dias === 0) {
      situacao = 'Vence HOJE';
      diasStr = '0d (Hoje)';
    } else if (dias <= diasCritico) {
      situacao = `Crítico (≤${diasCritico}d)`;
      diasStr = `${dias}d`;
    } else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) {
      situacao = `Atenção (<${diasNoPrazo}d)`;
      diasStr = `${dias}d`;
    }

    return [
      responsavel,
      `${loja}${uf}`,
      industria,
      sku,
      produto,
      qtd,
      vencimento,
      diasStr,
      situacao,
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [[
      'Vendedor / Coord.',
      'Loja / Filial',
      'Indústria',
      'SKU',
      'Descrição do Produto',
      'Qtd',
      'Vencimento',
      'Dias p/ Vencer',
      'Situação',
    ]],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' }, // Vendedor / Coord
      1: { cellWidth: 30 },                   // Loja
      2: { cellWidth: 26 },                   // Indústria
      3: { cellWidth: 20, font: 'courier' },  // SKU
      4: { cellWidth: 'auto', fontStyle: 'bold' }, // Produto
      5: { cellWidth: 16, halign: 'center' }, // Qtd
      6: { cellWidth: 20, halign: 'center', font: 'courier' }, // Vencimento
      7: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Dias p/ Vencer
      8: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }, // Situação
    },
    didParseCell: (data) => {
      // Destaque de cores na coluna "Situação" e "Dias"
      if (data.section === 'body') {
        const rowItem = items[data.row.index];
        if (rowItem) {
          const dias = calcularDiasRestantes(rowItem.data_vencimento);
          if (data.column.index === 8 || data.column.index === 7) {
            if (dias <= 0) {
              data.cell.styles.textColor = [220, 38, 38]; // red-600
              data.cell.styles.fontStyle = 'bold';
            } else if (dias <= diasCritico) {
              data.cell.styles.textColor = [217, 119, 6]; // amber-600
              data.cell.styles.fontStyle = 'bold';
            } else if (diasNoPrazo > diasCritico && dias < diasNoPrazo) {
              data.cell.styles.textColor = [2, 132, 199]; // sky-600
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [5, 150, 105]; // emerald-600
            }
          }
        }
      }
    },
    foot: [[
      'TOTAL',
      `${new Set(items.map((i) => i.loja).filter(Boolean)).size} lojas`,
      `${new Set(items.map((i) => i.industria).filter(Boolean)).size} indústrias`,
      `${items.length} SKUs`,
      `${items.length} produtos listados`,
      `${qtdTotal} un`,
      '-',
      '-',
      atencao > 0
        ? `${vencidos} venc. / ${criticos} crít. / ${atencao} aten. / ${noPrazo} no prazo`
        : `${vencidos} venc. / ${criticos} crít. / ${noPrazo} no prazo`,
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    didDrawPage: (data) => {
      // Rodapé com numeração de página
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
      const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Documento emitido automaticamente pelo ${nomeSistema} • Confidencial e de uso interno`,
        14,
        pageHeight - 6
      );
      doc.text(
        `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`,
        pageWidth - 14,
        pageHeight - 6,
        { align: 'right' }
      );
    },
  });

  // Nome limpo do arquivo para download
  let sufixoNome = 'Geral';
  if (opcoes.coordenadorSelecionado && opcoes.coordenadorSelecionado !== 'todos') {
    sufixoNome = opcoes.coordenadorSelecionado.replace(/[^a-zA-Z0-9]/g, '_');
  }
  if (opcoes.industriaSelecionada && opcoes.industriaSelecionada !== 'todas') {
    sufixoNome += `_${opcoes.industriaSelecionada.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  if (opcoes.lojaSelecionada && opcoes.lojaSelecionada !== 'todas') {
    sufixoNome += `_${opcoes.lojaSelecionada.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }
  if (opcoes.skuSelecionado && opcoes.skuSelecionado !== 'todos') {
    sufixoNome += `_SKU_${opcoes.skuSelecionado.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  const dataArquivo = now.toISOString().split('T')[0];
  const nomeArquivo = `Relatorio_Validade_${sufixoNome}_${dataArquivo}.pdf`;

  return { doc, nomeArquivo };
}

export function gerarRelatorioPDF(
  items: ItemValidade[],
  opcoes: OpcoesRelatorioPDF = {}
): void {
  const { doc, nomeArquivo } = criarRelatorioPDFDoc(items, opcoes);
  doc.save(nomeArquivo);
}

export function gerarRelatorioPDFFile(
  items: ItemValidade[],
  opcoes: OpcoesRelatorioPDF = {}
): { file: File; blob: Blob; nomeArquivo: string } {
  const { doc, nomeArquivo } = criarRelatorioPDFDoc(items, opcoes);
  const blob = doc.output('blob');
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
  return { file, blob, nomeArquivo };
}
