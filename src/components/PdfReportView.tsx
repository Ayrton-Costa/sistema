import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileDown,
  Printer,
  Users,
  Building2,
  Store,
  Barcode,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  ChevronDown,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Info,
  Layers,
  X,
  Sliders,
  Check,
  Settings,
  MessageCircle,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { ItemValidade, LojaCatalogo, SupabaseConfig } from '../types';
import { calcularDiasRestantes, formatarDataBR } from '../lib/excel';
import { gerarRelatorioPDF } from '../lib/pdfGenerator';

interface PdfReportViewProps {
  items: ItemValidade[];
  catalogoLojas?: LojaCatalogo[];
  catalogoCoordenadores?: string[];
  catalogoIndustrias?: string[];
  systemBranding?: { systemName: string; logoUrl?: string } | null;
  supabaseConfig: SupabaseConfig;
}

export const PdfReportView: React.FC<PdfReportViewProps> = ({
  items,
  catalogoLojas = [],
  catalogoCoordenadores = [],
  catalogoIndustrias = [],
  systemBranding,
  supabaseConfig,
}) => {
  // Filtros de seleção: Coordenador e Indústria (Individual e Geral)
  const [coordenadorSelecionado, setCoordenadorSelecionado] = useState<string>('todos');
  const [industriaSelecionada, setIndustriaSelecionada] = useState<string>('todas');
  const [lojaSelecionada, setLojaSelecionada] = useState<string>('todas');
  const [skuSelecionado, setSkuSelecionado] = useState<string>('todos');
  // Caixas de seleção para múltiplo status (Vencidos, Críticos, Atenção, No Prazo)
  const [statusSelecionados, setStatusSelecionados] = useState<Set<string>>(
    () => new Set(['vencido', 'critico', 'atencao', 'no_prazo'])
  );
  const [busca, setBusca] = useState<string>('');

  // Helpers para manipulação das caixas de seleção de status
  const alternarStatus = (st: string) => {
    setStatusSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(st)) {
        next.delete(st);
      } else {
        next.add(st);
      }
      return next;
    });
  };

  const selecionarTodosStatus = () => {
    setStatusSelecionados(new Set(['vencido', 'critico', 'atencao', 'no_prazo']));
  };

  const selecionarApenasUrgentes = () => {
    setStatusSelecionados(new Set(['vencido', 'critico']));
  };

  const limparStatus = () => {
    setStatusSelecionados(new Set());
  };

  // Modo de exibição do Resumo: Detalhado vs Consolidado por Coordenador vs Consolidado por Indústria
  const [modoResumo, setModoResumo] = useState<'detalhado' | 'por_coordenador' | 'por_industria' | 'por_loja'>('detalhado');

  // Ordenação de colunas da tabela (maior para menor e menor para maior)
  type ColunaOrdenacao =
    | 'responsavel'
    | 'loja'
    | 'industria'
    | 'sku'
    | 'produto'
    | 'quantidade'
    | 'vencimento'
    | 'dias'
    | 'situacao';
  type DirecaoOrdenacao = 'asc' | 'desc';

  const [colunaOrdenacao, setColunaOrdenacao] = useState<ColunaOrdenacao>('dias');
  const [direcaoOrdenacao, setDirecaoOrdenacao] = useState<DirecaoOrdenacao>('asc');

  const alternarOrdenacao = (coluna: ColunaOrdenacao) => {
    if (colunaOrdenacao === coluna) {
      setDirecaoOrdenacao((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setColunaOrdenacao(coluna);
      setDirecaoOrdenacao('asc');
    }
  };

  // Estados para Envio do Relatório para o WhatsApp
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState<boolean>(false);
  const [telefoneWhatsApp, setTelefoneWhatsApp] = useState<string>('');
  const [copiadoFeedback, setCopiadoFeedback] = useState<boolean>(false);

  // Critérios de Dias configuráveis pelo usuário para definir cada Status
  // Padrão solicitado: 20 dias para critério de "No Prazo", e crítico até 7 dias (ambos 100% customizáveis)
  const [diasCritico, setDiasCritico] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('relatorio_pdf_dias_critico');
      return saved ? Math.max(1, Number(saved)) : 7;
    } catch {
      return 7;
    }
  });

  const [diasNoPrazo, setDiasNoPrazo] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('relatorio_pdf_dias_no_prazo');
      return saved ? Math.max(1, Number(saved)) : 20; // Default 20 dias
    } catch {
      return 20;
    }
  });

  const [mostrarConfigDias, setMostrarConfigDias] = useState<boolean>(false);

  const handleMudarDiasCritico = (val: number) => {
    const limpo = Math.max(1, Math.min(365, val || 1));
    setDiasCritico(limpo);
    try {
      localStorage.setItem('relatorio_pdf_dias_critico', String(limpo));
    } catch {}
  };

  const handleMudarDiasNoPrazo = (val: number) => {
    const limpo = Math.max(1, Math.min(365, val || 1));
    setDiasNoPrazo(limpo);
    try {
      localStorage.setItem('relatorio_pdf_dias_no_prazo', String(limpo));
    } catch {}
  };

  // Classificação dinâmica de status com base nos critérios de dias definidos pelo usuário
  const classificarStatus = (dataVencimento: string) => {
    const dias = calcularDiasRestantes(dataVencimento);
    if (dias < 0) {
      return {
        status: 'vencido',
        texto: `Vencido há ${Math.abs(dias)}d`,
        classe: 'bg-red-50 text-red-700 border-red-200',
        badge: 'Vencido',
        icone: XCircle,
      };
    }
    if (dias === 0) {
      return {
        status: 'vencido',
        texto: 'Vence HOJE',
        classe: 'bg-red-100 text-red-800 border-red-300 font-black',
        badge: 'Vence Hoje',
        icone: AlertTriangle,
      };
    }
    if (dias <= diasCritico) {
      return {
        status: 'critico',
        texto: `Crítico (≤ ${diasCritico}d)`,
        classe: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'Crítico',
        icone: AlertTriangle,
      };
    }
    if (diasNoPrazo > diasCritico && dias < diasNoPrazo) {
      return {
        status: 'atencao',
        texto: `Atenção (< ${diasNoPrazo}d)`,
        classe: 'bg-blue-50 text-blue-800 border-blue-200',
        badge: 'Atenção',
        icone: Clock,
      };
    }
    return {
      status: 'no_prazo',
      texto: `No Prazo (≥ ${diasNoPrazo}d)`,
      classe: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badge: 'No Prazo',
      icone: CheckCircle,
    };
  };

  // 1. Lista única de Coordenadores / Vendedores
  const listaCoordenadores = useMemo(() => {
    const set = new Set<string>();
    catalogoCoordenadores.forEach((c) => {
      if (c?.trim()) set.add(c.trim());
    });
    catalogoLojas.forEach((l) => {
      if (l.coordenador?.trim()) set.add(l.coordenador.trim());
    });
    items.forEach((it) => {
      if (it.vendedor?.trim()) set.add(it.vendedor.trim());
      if (it.coordenador?.trim()) set.add(it.coordenador.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogoCoordenadores, catalogoLojas, items]);

  // 2. Lista única de Indústrias
  const listaIndustrias = useMemo(() => {
    const set = new Set<string>();
    catalogoIndustrias.forEach((ind) => {
      if (ind?.trim()) set.add(ind.trim());
    });
    items.forEach((it) => {
      if (it.industria?.trim()) set.add(it.industria.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogoIndustrias, items]);

  // 3. Lista de Lojas: quando o coordenador é selecionado, exibe SOMENTE as lojas vinculadas a ele!
  const listaLojas = useMemo(() => {
    const set = new Set<string>();
    const coordTrim = coordenadorSelecionado.trim().toLowerCase();

    if (coordenadorSelecionado !== 'todos') {
      // 1. Lojas do catálogo atribuídas a este coordenador
      catalogoLojas.forEach((l) => {
        if (l.coordenador?.trim().toLowerCase() === coordTrim && l.nome?.trim()) {
          set.add(l.nome.trim());
        }
      });
      // 2. Lojas dos itens onde o coordenador/vendedor é este
      items.forEach((it) => {
        const resp = (it.vendedor || it.coordenador || '').trim().toLowerCase();
        if (resp === coordTrim && it.loja?.trim()) {
          set.add(it.loja.trim());
        }
      });
    } else {
      catalogoLojas.forEach((l) => {
        if (l.nome?.trim()) set.add(l.nome.trim());
      });
      items.forEach((it) => {
        if (it.loja?.trim()) set.add(it.loja.trim());
      });
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [catalogoLojas, items, coordenadorSelecionado]);

  // Ao mudar coordenador: se a loja atual não pertencer a este novo coordenador, reseta para 'todas'
  const handleMudarCoordenador = (novoCoord: string) => {
    setCoordenadorSelecionado(novoCoord);
    if (novoCoord !== 'todos' && lojaSelecionada !== 'todas') {
      const coordTrim = novoCoord.trim().toLowerCase();
      const lojaPertence =
        catalogoLojas.some(
          (l) => l.nome?.trim().toLowerCase() === lojaSelecionada.toLowerCase() && l.coordenador?.trim().toLowerCase() === coordTrim
        ) ||
        items.some(
          (it) => it.loja?.trim().toLowerCase() === lojaSelecionada.toLowerCase() && (it.vendedor || it.coordenador || '').trim().toLowerCase() === coordTrim
        );
      if (!lojaPertence) {
        setLojaSelecionada('todas');
      }
    }
  };

  // 4. Lista única de SKUs com código e descrição para filtro
  const listaSkus = useMemo(() => {
    const mapa = new Map<string, { codigo: string; produto: string; count: number }>();
    items.forEach((it) => {
      const cod = (it.codigo || '').trim();
      if (!cod) return;
      const curr = mapa.get(cod) || { codigo: cod, produto: it.produto || '', count: 0 };
      curr.count += 1;
      mapa.set(cod, curr);
    });
    return Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  }, [items]);

  // Contagem dinâmica por status respeitando os filtros de Coordenador, Indústria, Loja, SKU e Busca
  const contagemPorStatus = useMemo(() => {
    let vencidos = 0;
    let criticos = 0;
    let atencao = 0;
    let noPrazo = 0;

    items.forEach((it) => {
      if (coordenadorSelecionado !== 'todos') {
        const resp = (it.vendedor || it.coordenador || '').trim();
        if (resp !== coordenadorSelecionado) return;
      }
      if (industriaSelecionada !== 'todas') {
        if ((it.industria || '').trim() !== industriaSelecionada) return;
      }
      if (lojaSelecionada !== 'todas') {
        if ((it.loja || '').trim() !== lojaSelecionada) return;
      }
      if (skuSelecionado !== 'todos') {
        if ((it.codigo || '').trim() !== skuSelecionado) return;
      }
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const texto = `${it.produto || ''} ${it.codigo || ''} ${it.industria || ''} ${it.loja || ''} ${it.coordenador || ''} ${it.vendedor || ''}`.toLowerCase();
        if (!texto.includes(q)) return;
      }

      const st = classificarStatus(it.data_vencimento).status;
      if (st === 'vencido') vencidos++;
      else if (st === 'critico') criticos++;
      else if (st === 'atencao') atencao++;
      else noPrazo++;
    });

    return { vencidos, criticos, atencao, noPrazo };
  }, [items, coordenadorSelecionado, industriaSelecionada, lojaSelecionada, skuSelecionado, busca, diasCritico, diasNoPrazo]);

  // 5. Filtragem dos Itens para o Relatório
  const itensFiltrados = useMemo(() => {
    return items.filter((it) => {
      // Filtro de Coordenador / Vendedor
      if (coordenadorSelecionado !== 'todos') {
        const resp = (it.vendedor || it.coordenador || '').trim();
        if (resp !== coordenadorSelecionado) return false;
      }

      // Filtro de Indústria
      if (industriaSelecionada !== 'todas') {
        if ((it.industria || '').trim() !== industriaSelecionada) return false;
      }

      // Filtro de Loja
      if (lojaSelecionada !== 'todas') {
        if ((it.loja || '').trim() !== lojaSelecionada) return false;
      }

      // Filtro de SKU
      if (skuSelecionado !== 'todos') {
        if ((it.codigo || '').trim() !== skuSelecionado) return false;
      }

      // Filtro de Status em Caixas de Seleção (Multi-seleção)
      const st = classificarStatus(it.data_vencimento).status;
      if (!statusSelecionados.has(st)) return false;

      // Busca Rápida
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const texto = `${it.produto || ''} ${it.codigo || ''} ${it.industria || ''} ${it.loja || ''} ${it.coordenador || ''} ${it.vendedor || ''}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }

      return true;
    });
  }, [items, coordenadorSelecionado, industriaSelecionada, lojaSelecionada, skuSelecionado, statusSelecionados, busca, diasCritico, diasNoPrazo]);

  // 6. Ordenação dos Itens filtrados para exibição na tabela e exportação em PDF
  const itensOrdenados = useMemo(() => {
    if (!colunaOrdenacao) return itensFiltrados;

    const ordenados = [...itensFiltrados];
    const fator = direcaoOrdenacao === 'asc' ? 1 : -1;

    ordenados.sort((a, b) => {
      switch (colunaOrdenacao) {
        case 'responsavel': {
          const valA = (a.vendedor || a.coordenador || '').trim().toLowerCase();
          const valB = (b.vendedor || b.coordenador || '').trim().toLowerCase();
          return valA.localeCompare(valB, 'pt-BR') * fator;
        }
        case 'loja': {
          const valA = (a.loja || '').trim().toLowerCase();
          const valB = (b.loja || '').trim().toLowerCase();
          return valA.localeCompare(valB, 'pt-BR') * fator;
        }
        case 'industria': {
          const valA = (a.industria || '').trim().toLowerCase();
          const valB = (b.industria || '').trim().toLowerCase();
          return valA.localeCompare(valB, 'pt-BR') * fator;
        }
        case 'sku': {
          const valA = (a.codigo || '').trim();
          const valB = (b.codigo || '').trim();
          return valA.localeCompare(valB, 'pt-BR', { numeric: true }) * fator;
        }
        case 'produto': {
          const valA = (a.produto || '').trim().toLowerCase();
          const valB = (b.produto || '').trim().toLowerCase();
          return valA.localeCompare(valB, 'pt-BR') * fator;
        }
        case 'quantidade': {
          const valA = Number(a.quantidade || 0);
          const valB = Number(b.quantidade || 0);
          return (valA - valB) * fator;
        }
        case 'vencimento': {
          const valA = new Date(a.data_vencimento).getTime() || 0;
          const valB = new Date(b.data_vencimento).getTime() || 0;
          return (valA - valB) * fator;
        }
        case 'dias':
        case 'situacao': {
          const diasA = calcularDiasRestantes(a.data_vencimento);
          const diasB = calcularDiasRestantes(b.data_vencimento);
          return (diasA - diasB) * fator;
        }
        default:
          return 0;
      }
    });

    return ordenados;
  }, [itensFiltrados, colunaOrdenacao, direcaoOrdenacao]);

  // 7. Cálculos de Estatísticas e Resumo com os critérios de dias customizados
  const resumo = useMemo(() => {
    let qtdTotal = 0;
    let vencidos = 0;
    let criticos = 0;
    let atencao = 0;
    let noPrazo = 0;

    itensFiltrados.forEach((it) => {
      qtdTotal += Number(it.quantidade || 0);
      const st = classificarStatus(it.data_vencimento).status;
      if (st === 'vencido') vencidos++;
      else if (st === 'critico') criticos++;
      else if (st === 'atencao') atencao++;
      else noPrazo++;
    });

    const lojasUnicas = new Set(itensFiltrados.map((i) => i.loja).filter(Boolean)).size;
    const industriasUnicas = new Set(itensFiltrados.map((i) => i.industria).filter(Boolean)).size;
    const coordenadoresUnicos = new Set(
      itensFiltrados.map((i) => (i.vendedor || i.coordenador || '').trim()).filter(Boolean)
    ).size;

    return {
      totalLinhas: itensFiltrados.length,
      qtdTotal,
      vencidos,
      criticos,
      atencao,
      noPrazo,
      lojasUnicas,
      industriasUnicas,
      coordenadoresUnicos,
    };
  }, [itensFiltrados, diasCritico, diasNoPrazo]);

  // 6. Resumos Agrupados para visão consolidada
  const resumoPorCoordenador = useMemo(() => {
    const mapa = new Map<
      string,
      {
        responsavel: string;
        lojas: Set<string>;
        industrias: Set<string>;
        itensCount: number;
        qtdTotal: number;
        vencidos: number;
        criticos: number;
        atencao: number;
        noPrazo: number;
      }
    >();

    itensFiltrados.forEach((it) => {
      const resp = (it.vendedor || it.coordenador || 'Sem Coordenador Atribuído').trim();
      const curr = mapa.get(resp) || {
        responsavel: resp,
        lojas: new Set<string>(),
        industrias: new Set<string>(),
        itensCount: 0,
        qtdTotal: 0,
        vencidos: 0,
        criticos: 0,
        atencao: 0,
        noPrazo: 0,
      };

      if (it.loja) curr.lojas.add(it.loja);
      if (it.industria) curr.industrias.add(it.industria);
      curr.itensCount += 1;
      curr.qtdTotal += Number(it.quantidade || 0);

      const st = classificarStatus(it.data_vencimento).status;
      if (st === 'vencido') curr.vencidos++;
      else if (st === 'critico') curr.criticos++;
      else if (st === 'atencao') curr.atencao++;
      else curr.noPrazo++;

      mapa.set(resp, curr);
    });

    return Array.from(mapa.values()).sort((a, b) => a.responsavel.localeCompare(b.responsavel));
  }, [itensFiltrados, diasCritico, diasNoPrazo]);

  const resumoPorIndustria = useMemo(() => {
    const mapa = new Map<
      string,
      {
        industria: string;
        lojas: Set<string>;
        coordenadores: Set<string>;
        itensCount: number;
        qtdTotal: number;
        vencidos: number;
        criticos: number;
        atencao: number;
        noPrazo: number;
      }
    >();

    itensFiltrados.forEach((it) => {
      const ind = (it.industria || 'Geral').trim();
      const curr = mapa.get(ind) || {
        industria: ind,
        lojas: new Set<string>(),
        coordenadores: new Set<string>(),
        itensCount: 0,
        qtdTotal: 0,
        vencidos: 0,
        criticos: 0,
        atencao: 0,
        noPrazo: 0,
      };

      if (it.loja) curr.lojas.add(it.loja);
      const resp = it.vendedor || it.coordenador;
      if (resp) curr.coordenadores.add(resp);
      curr.itensCount += 1;
      curr.qtdTotal += Number(it.quantidade || 0);

      const st = classificarStatus(it.data_vencimento).status;
      if (st === 'vencido') curr.vencidos++;
      else if (st === 'critico') curr.criticos++;
      else if (st === 'atencao') curr.atencao++;
      else curr.noPrazo++;

      mapa.set(ind, curr);
    });

    return Array.from(mapa.values()).sort((a, b) => a.industria.localeCompare(b.industria));
  }, [itensFiltrados, diasCritico, diasNoPrazo]);

  // Ação: Baixar Arquivo PDF (.pdf) com os critérios de dias configurados e ordenação ativa
  const handleBaixarPDF = () => {
    if (itensOrdenados.length === 0) {
      alert('Nenhum registro encontrado para gerar o arquivo PDF.');
      return;
    }

    gerarRelatorioPDF(itensOrdenados, {
      coordenadorSelecionado,
      industriaSelecionada,
      lojaSelecionada,
      skuSelecionado,
      statusSelecionados: Array.from(statusSelecionados),
      nomeSistema: systemBranding?.systemName || 'Controle de Validade de Produtos',
      diasCritico,
      diasNoPrazo,
    });
  };

  // Ação: Imprimir / Salvar como PDF via Navegador
  const handleImprimir = () => {
    window.print();
  };

  // Geração do texto formatado para envio no WhatsApp
  const gerarTextoWhatsApp = () => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const coord = coordenadorSelecionado !== 'todos' ? coordenadorSelecionado : 'Todos (Visão Geral)';
    const ind = industriaSelecionada !== 'todas' ? industriaSelecionada : 'Todas as Indústrias';
    const loja = lojaSelecionada !== 'todas' ? lojaSelecionada : 'Todas as Lojas';
    const sku = skuSelecionado !== 'todos' ? skuSelecionado : 'Todos';

    let msg = `📋 *RELATÓRIO DE CONTROLE DE VALIDADE*\n`;
    msg += `🏢 *${systemBranding?.systemName || 'Controle de Validade de Produtos'}*\n`;
    msg += `📅 *Emissão:* ${dataHoje} às ${horaHoje}\n\n`;

    msg += `📌 *FILTROS APLICADOS:*\n`;
    msg += `• Coord./Vendedor: *${coord}*\n`;
    msg += `• Indústria: *${ind}*\n`;
    if (lojaSelecionada !== 'todas') msg += `• Loja: *${loja}*\n`;
    if (skuSelecionado !== 'todos') msg += `• SKU: *${sku}*\n`;
    msg += `• Critério de Dias: Crítico ≤ ${diasCritico}d | No Prazo ≥ ${diasNoPrazo}d\n\n`;

    msg += `📊 *RESUMO GERAL:*\n`;
    msg += `• Total de Produtos: *${resumo.totalLinhas} itens* (*${resumo.qtdTotal} unidades*)\n`;
    msg += `🔴 *Vencidos (≤0d):* ${resumo.vencidos}\n`;
    msg += `🟠 *Críticos (≤${diasCritico}d):* ${resumo.criticos}\n`;
    if (resumo.atencao > 0) {
      msg += `🔵 *Atenção (<${diasNoPrazo}d):* ${resumo.atencao}\n`;
    }
    msg += `🟢 *No Prazo (≥${diasNoPrazo}d):* ${resumo.noPrazo}\n\n`;

    // Principais itens críticos ou vencidos (até 10 itens para mensagem ágil e objetiva)
    const itensPrioritarios = itensOrdenados
      .filter((it) => {
        const dias = calcularDiasRestantes(it.data_vencimento);
        return dias <= diasCritico;
      })
      .slice(0, 10);

    if (itensPrioritarios.length > 0) {
      msg += `🚨 *ITENS EM RISCO PARA AÇÃO IMEDIATA (${itensPrioritarios.length}):*\n`;
      itensPrioritarios.forEach((it, idx) => {
        const dias = calcularDiasRestantes(it.data_vencimento);
        const sit = dias < 0 ? `Vencido há ${Math.abs(dias)}d` : dias === 0 ? 'Vence HOJE' : `Crítico (${dias}d)`;
        msg += `${idx + 1}. *${it.produto}*\n`;
        msg += `   └ SKU: ${it.codigo || '-'} | Loja: ${it.loja || 'Loja Principal'}\n`;
        msg += `   └ Venc: ${formatarDataBR(it.data_vencimento)} (${sit}) | Qtd: *${it.quantidade} ${it.unidade || 'un'}*\n`;
      });

      const totalCriticosEVencidos = resumo.vencidos + resumo.criticos;
      if (totalCriticosEVencidos > itensPrioritarios.length) {
        msg += `\n_...e mais ${totalCriticosEVencidos - itensPrioritarios.length} itens no relatório completo._\n`;
      }
    } else if (resumo.totalLinhas > 0) {
      msg += `✅ *Nenhum item vencido ou crítico neste filtro!*\n`;
    }

    msg += `\n📲 _Enviado via ${systemBranding?.systemName || 'Controle de Validade'}_`;
    return msg;
  };

  const handleEnviarWhatsApp = () => {
    const texto = gerarTextoWhatsApp();
    const textoCodificado = encodeURIComponent(texto);
    const apenasDigitos = telefoneWhatsApp.replace(/\D/g, '');

    let url = '';
    if (apenasDigitos.length >= 10) {
      const numeroFinal = apenasDigitos.length <= 11 ? `55${apenasDigitos}` : apenasDigitos;
      url = `https://wa.me/${numeroFinal}?text=${textoCodificado}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${textoCodificado}`;
    }

    window.open(url, '_blank');
  };

  const handleCopiarTextoWhatsApp = () => {
    const texto = gerarTextoWhatsApp();
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoFeedback(true);
      setTimeout(() => setCopiadoFeedback(false), 2500);
    });
  };

  const handleCompartilharWebShare = () => {
    const texto = gerarTextoWhatsApp();
    if (navigator.share) {
      navigator.share({
        title: `Relatório de Validades - ${systemBranding?.systemName || 'Controle de Validade'}`,
        text: texto,
      }).catch(() => {});
    } else {
      handleCopiarTextoWhatsApp();
    }
  };

  const totalStatusPossiveis = diasNoPrazo > diasCritico ? 4 : 3;
  const temFiltroAtivo =
    coordenadorSelecionado !== 'todos' ||
    industriaSelecionada !== 'todas' ||
    lojaSelecionada !== 'todas' ||
    skuSelecionado !== 'todos' ||
    statusSelecionados.size < totalStatusPossiveis ||
    Boolean(busca.trim());

  const limparFiltros = () => {
    setCoordenadorSelecionado('todos');
    setIndustriaSelecionada('todas');
    setLojaSelecionada('todas');
    setSkuSelecionado('todos');
    setStatusSelecionados(new Set(['vencido', 'critico', 'atencao', 'no_prazo']));
    setBusca('');
  };

  return (
    <div className="space-y-4">
      {/* CABEÇALHO DA ABA DE RELATÓRIO PDF (Oculta na impressão) */}
      <div className="print:hidden p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Relatório &amp; Emissão de Arquivo PDF</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  {resumo.totalLinhas} Registros
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Resumo individual ou geral por <strong>Vendedor / Loja / Indústria / SKU / Qtd / Vencimento</strong> com exportação em PDF.
              </p>
            </div>
          </div>
        </div>

        {/* BOTÕES DE GERAÇÃO DE PDF, IMPRESSÃO E WHATSAPP */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão de Enviar no WhatsApp */}
          <button
            type="button"
            onClick={() => setMostrarModalWhatsApp(true)}
            className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="Enviar resumo executivo do relatório para o WhatsApp"
          >
            <MessageCircle className="w-4 h-4 fill-white/20" />
            <span>Enviar no WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleBaixarPDF}
            className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="Gerar e baixar arquivo PDF formatado"
          >
            <FileDown className="w-4 h-4" />
            <span>Baixar Arquivo PDF</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className="h-9 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Imprimir ou Salvar como PDF via navegador"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS: SELEÇÃO DE COORDENADOR E INDÚSTRIA (RESUMO INDIVIDUAL E GERAL) */}
      <div className="print:hidden p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. SELETOR DE COORDENADOR / VENDEDOR (Individual e Geral) */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">Coordenador / Vendedor:</span>
                <select
                  value={coordenadorSelecionado}
                  onChange={(e) => handleMudarCoordenador(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none font-bold text-slate-800 cursor-pointer max-w-[170px] truncate"
                >
                  <option value="todos">Todos (Visão Geral)</option>
                  {listaCoordenadores.map((coord) => (
                    <option key={coord} value={coord}>
                      {coord}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. SELETOR DE INDÚSTRIA (Individual e Geral) */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">Indústria:</span>
                <select
                  value={industriaSelecionada}
                  onChange={(e) => setIndustriaSelecionada(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none font-bold text-slate-800 cursor-pointer max-w-[160px] truncate"
                >
                  <option value="todas">Todas (Visão Geral)</option>
                  {listaIndustrias.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. SELETOR DE LOJA: QUANDO SELECIONA O COORDENADOR, APARECEM SOMENTE AS SUAS LOJAS */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">
                  {coordenadorSelecionado !== 'todos' ? `Lojas de ${coordenadorSelecionado}:` : 'Loja:'}
                </span>
                <select
                  value={lojaSelecionada}
                  onChange={(e) => setLojaSelecionada(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none font-bold text-slate-800 cursor-pointer max-w-[160px] truncate"
                >
                  <option value="todas">
                    {coordenadorSelecionado !== 'todos'
                      ? `Todas de ${coordenadorSelecionado} (${listaLojas.length})`
                      : `Todas as Lojas (${listaLojas.length})`}
                  </option>
                  {listaLojas.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. SELETOR DE SKU */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Barcode className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 uppercase leading-none">SKU:</span>
                <select
                  value={skuSelecionado}
                  onChange={(e) => setSkuSelecionado(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none font-bold text-slate-800 cursor-pointer max-w-[170px] truncate"
                >
                  <option value="todos">Todos os SKUs ({listaSkus.length})</option>
                  {listaSkus.map((sku) => (
                    <option key={sku.codigo} value={sku.codigo}>
                      {sku.codigo} - {sku.produto ? sku.produto.substring(0, 22) : 'Item'} ({sku.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Busca Rápida */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar SKU / Loja..."
                className="text-xs bg-transparent focus:outline-none font-medium text-slate-800 placeholder-slate-400 w-28 sm:w-36"
              />
              {busca && (
                <button type="button" onClick={() => setBusca('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BOTÃO PARA EXPANDIR CONFIGURAÇÃO DE DIAS DOS STATUS */}
            <button
              type="button"
              onClick={() => setMostrarConfigDias((prev) => !prev)}
              className={`h-9 px-2.5 text-xs font-bold rounded-lg border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                mostrarConfigDias
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Ajustar critério de dias para Crítico e No Prazo"
            >
              <Sliders className="w-3.5 h-3.5 text-rose-600" />
              <span>Critérios de Dias: {diasNoPrazo}d</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${mostrarConfigDias ? 'rotate-180' : ''}`} />
            </button>

            {temFiltroAtivo && (
              <button
                type="button"
                onClick={limparFiltros}
                className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE CAIXAS DE SELEÇÃO DE STATUS (MULTI-SELEÇÃO) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1 mr-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Status (Caixas de Seleção):</span>
            </span>

            {/* Checkbox: Vencidos */}
            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer select-none ${
                statusSelecionados.has('vencido')
                  ? 'bg-red-50 border-red-300 text-red-800 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={statusSelecionados.has('vencido')}
                onChange={() => alternarStatus('vencido')}
                className="w-3.5 h-3.5 text-red-600 rounded focus:ring-red-500 cursor-pointer accent-red-600"
              />
              <span>🔴 Vencidos (≤ 0d)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusSelecionados.has('vencido') ? 'bg-red-200 text-red-900 font-extrabold' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {contagemPorStatus.vencidos}
              </span>
            </label>

            {/* Checkbox: Críticos */}
            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer select-none ${
                statusSelecionados.has('critico')
                  ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={statusSelecionados.has('critico')}
                onChange={() => alternarStatus('critico')}
                className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer accent-amber-600"
              />
              <span>🟠 Críticos (≤ {diasCritico}d)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusSelecionados.has('critico') ? 'bg-amber-200 text-amber-900 font-extrabold' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {contagemPorStatus.criticos}
              </span>
            </label>

            {/* Checkbox: Atenção (quando aplicável) */}
            {diasNoPrazo > diasCritico && (
              <label
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer select-none ${
                  statusSelecionados.has('atencao')
                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={statusSelecionados.has('atencao')}
                  onChange={() => alternarStatus('atencao')}
                  className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
                <span>🔵 Atenção (&lt; {diasNoPrazo}d)</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    statusSelecionados.has('atencao') ? 'bg-blue-200 text-blue-900 font-extrabold' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {contagemPorStatus.atencao}
                </span>
              </label>
            )}

            {/* Checkbox: No Prazo */}
            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition cursor-pointer select-none ${
                statusSelecionados.has('no_prazo')
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={statusSelecionados.has('no_prazo')}
                onChange={() => alternarStatus('no_prazo')}
                className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600"
              />
              <span>🟢 No Prazo (≥ {diasNoPrazo}d)</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusSelecionados.has('no_prazo') ? 'bg-emerald-200 text-emerald-900 font-extrabold' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {contagemPorStatus.noPrazo}
              </span>
            </label>
          </div>

          {/* Atalhos Rápidos para Caixas de Seleção */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 mr-0.5 hidden sm:inline">Seleção rápida:</span>
            <button
              type="button"
              onClick={selecionarTodosStatus}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                statusSelecionados.size === (diasNoPrazo > diasCritico ? 4 : 3)
                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Marcar todos os status"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={selecionarApenasUrgentes}
              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                statusSelecionados.size === 2 && statusSelecionados.has('vencido') && statusSelecionados.has('critico')
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                  : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
              }`}
              title="Marcar apenas Vencidos e Críticos"
            >
              Vencidos + Críticos
            </button>
            <button
              type="button"
              onClick={limparStatus}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white text-slate-500 border border-slate-300 hover:bg-slate-50 transition cursor-pointer"
              title="Desmarcar todas as caixas de seleção"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* PAINEL DE CONFIGURAÇÃO INTERATIVA DOS CRITÉRIOS DE DIAS DE STATUS */}
        {mostrarConfigDias && (
          <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2.5 animate-fade-in text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-rose-100 text-rose-700 font-black">
                  <Settings className="w-3.5 h-3.5" />
                </span>
                <span className="font-extrabold text-slate-900">
                  Definir Critérios de Status por Quantidade de Dias:
                </span>
              </div>

              {/* Botões de Predefinição Rápida */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 mr-1">Atalhos rápidos:</span>
                <button
                  type="button"
                  onClick={() => {
                    handleMudarDiasCritico(7);
                    handleMudarDiasNoPrazo(20);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                    diasCritico === 7 && diasNoPrazo === 20
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  ✓ 20 Dias (Crítico ≤7d | No Prazo ≥20d)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleMudarDiasCritico(7);
                    handleMudarDiasNoPrazo(30);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                    diasCritico === 7 && diasNoPrazo === 30
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  30 Dias (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleMudarDiasCritico(5);
                    handleMudarDiasNoPrazo(15);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                    diasCritico === 5 && diasNoPrazo === 15
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  15 Dias (Crítico ≤5d | No Prazo ≥15d)
                </button>
              </div>
            </div>

            {/* Inputs Diretos de Dias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-amber-800 font-bold shrink-0">🟠 Critério para Crítico:</span>
                <span className="text-slate-500 text-[11px]">Vence em até</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={diasCritico}
                  onChange={(e) => handleMudarDiasCritico(Number(e.target.value))}
                  className="w-16 h-7 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                />
                <span className="text-slate-600 font-semibold">dias</span>
              </div>

              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-emerald-800 font-bold shrink-0">🟢 Critério para "No Prazo":</span>
                <span className="text-slate-500 text-[11px]">A partir de</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={diasNoPrazo}
                  onChange={(e) => handleMudarDiasNoPrazo(Number(e.target.value))}
                  className="w-16 h-7 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                />
                <span className="text-slate-600 font-semibold">dias</span>
              </div>
            </div>

            {/* Resumo da Régua Aplicada */}
            <div className="text-[11px] text-slate-600 pt-1 flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-800">Régua ativa no Relatório &amp; PDF:</span>
              <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-800 font-bold">
                🔴 Vencido: ≤ 0 dias
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">
                🟠 Crítico: 1 a {diasCritico} dias
              </span>
              {diasNoPrazo > diasCritico && (
                <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold">
                  🔵 Atenção: {diasCritico + 1} a {diasNoPrazo - 1} dias
                </span>
              )}
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                🟢 No Prazo: ≥ {diasNoPrazo} dias
              </span>
            </div>
          </div>
        )}

        {/* ALTERNADOR DE MODO DE RESUMO */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setModoResumo('detalhado')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                modoResumo === 'detalhado' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tabela Completa (Linha a Linha)
            </button>
            <button
              type="button"
              onClick={() => setModoResumo('por_coordenador')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                modoResumo === 'por_coordenador' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resumo por Coordenador / Vendedor
            </button>
            <button
              type="button"
              onClick={() => setModoResumo('por_industria')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                modoResumo === 'por_industria' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resumo por Indústria
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            {coordenadorSelecionado !== 'todos' || industriaSelecionada !== 'todas' ? (
              <span className="font-semibold text-indigo-700">
                Visualizando Resumo Individual ({coordenadorSelecionado !== 'todos' ? coordenadorSelecionado : 'Todos Coord.'} • {industriaSelecionada !== 'todas' ? industriaSelecionada : 'Todas Ind.'})
              </span>
            ) : (
              <span className="font-semibold text-slate-600">Visualizando Resumo Geral Consolidado</span>
            )}
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO E INDICADORES (TOTALIZADORES) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Itens Listados</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{resumo.totalLinhas}</div>
          <div className="text-[10px] text-slate-500">{resumo.lojasUnicas} lojas atendidas</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase">Qtd Total</div>
          <div className="text-xl font-black text-blue-900 mt-0.5">{resumo.qtdTotal} un</div>
          <div className="text-[10px] text-blue-600">{resumo.industriasUnicas} indústrias</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-red-200 shadow-2xs">
          <div className="text-[11px] font-bold text-red-700 uppercase">Vencidos (≤ 0d)</div>
          <div className="text-xl font-black text-red-700 mt-0.5">{resumo.vencidos}</div>
          <div className="text-[10px] text-red-600 font-bold">Ação Imediata</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase">Críticos (≤ {diasCritico}d)</div>
          <div className="text-xl font-black text-amber-700 mt-0.5">{resumo.criticos}</div>
          <div className="text-[10px] text-amber-600">Atenção Prioritária</div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-emerald-200 shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase">No Prazo (≥ {diasNoPrazo}d)</div>
          <div className="text-xl font-black text-emerald-700 mt-0.5">{resumo.noPrazo}</div>
          <div className="text-[10px] text-emerald-600">
            {resumo.atencao > 0 ? `+ ${resumo.atencao} em atenção` : 'Dentro do Prazo'}
          </div>
        </div>
      </div>

      {/* ÁREA DO DOCUMENTO / RELATÓRIO (FORMATO IMPRESSÃO & TELA) */}
      <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 space-y-4">
        {/* Cabeçalho Formal do Documento (Visível na impressão e na tela) */}
        <div className="border-b-2 border-slate-800 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
              {systemBranding?.systemName || 'Controle de Validade de Produtos'}
            </h2>
            <div className="text-xs font-bold text-blue-700 uppercase">
              Relatório de Validades por Vendedor / Loja / Indústria / SKU / Qtd / Vencimento
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span>
                Filtro Coordenador: <strong>{coordenadorSelecionado === 'todos' ? 'Todos (Geral)' : coordenadorSelecionado}</strong>
              </span>
              <span>•</span>
              <span>
                Filtro Indústria: <strong>{industriaSelecionada === 'todas' ? 'Todas (Geral)' : industriaSelecionada}</strong>
              </span>
              {lojaSelecionada !== 'todas' && (
                <>
                  <span>•</span>
                  <span>
                    Loja: <strong>{lojaSelecionada}</strong>
                  </span>
                </>
              )}
              {skuSelecionado !== 'todos' && (
                <>
                  <span>•</span>
                  <span>
                    SKU: <strong>{skuSelecionado}</strong>
                  </span>
                </>
              )}
              {statusSelecionados.size < totalStatusPossiveis && (
                <>
                  <span>•</span>
                  <span className="font-semibold text-rose-800">
                    Status: {Array.from(statusSelecionados)
                      .map((s) => (s === 'vencido' ? 'Vencidos' : s === 'critico' ? 'Críticos' : s === 'atencao' ? 'Atenção' : 'No Prazo'))
                      .join(' + ') || 'Nenhum selecionado'}
                  </span>
                </>
              )}
              <span>•</span>
              <span className="font-semibold text-rose-700">
                Critério: Crítico ≤ {diasCritico}d | No Prazo ≥ {diasNoPrazo}d
              </span>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500">
            <div>Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
            <div className="font-mono text-[10px] text-slate-400">
              {itensFiltrados.length} itens encontrados
            </div>
          </div>
        </div>

        {/* 1. MODO: RESUMO POR COORDENADOR / VENDEDOR */}
        {modoResumo === 'por_coordenador' ? (
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Resumo Consolidado por Vendedor / Coordenador</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resumoPorCoordenador.map((c) => (
                <div
                  key={c.responsavel}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 hover:border-indigo-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-sm text-slate-900">{c.responsavel}</div>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      {c.itensCount} {c.itensCount === 1 ? 'item' : 'itens'} ({c.qtdTotal} un)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>
                      Lojas: <strong>{c.lojas.size}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Indústrias: <strong>{c.industrias.size}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-bold">
                    {c.vencidos > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                        {c.vencidos} Vencido{c.vencidos > 1 ? 's' : ''}
                      </span>
                    )}
                    {c.criticos > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                        {c.criticos} Crítico{c.criticos > 1 ? 's' : ''} (≤{diasCritico}d)
                      </span>
                    )}
                    {c.atencao > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                        {c.atencao} Atenção (&lt;{diasNoPrazo}d)
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {c.noPrazo} No prazo (≥{diasNoPrazo}d)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : modoResumo === 'por_industria' ? (
          /* 2. MODO: RESUMO POR INDÚSTRIA */
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>Resumo Consolidado por Indústria</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resumoPorIndustria.map((ind) => (
                <div
                  key={ind.industria}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 hover:border-purple-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-sm text-slate-900">{ind.industria}</div>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                      {ind.itensCount} produtos ({ind.qtdTotal} un)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <span>
                      Lojas atendidas: <strong>{ind.lojas.size}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Coordenadores: <strong>{ind.coordenadores.size}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-bold">
                    {ind.vencidos > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                        {ind.vencidos} Vencido{ind.vencidos > 1 ? 's' : ''}
                      </span>
                    )}
                    {ind.criticos > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                        {ind.criticos} Crítico{ind.criticos > 1 ? 's' : ''} (≤{diasCritico}d)
                      </span>
                    )}
                    {ind.atencao > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-200">
                        {ind.atencao} Atenção (&lt;{diasNoPrazo}d)
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {ind.noPrazo} No prazo (≥{diasNoPrazo}d)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 3. TABELA DETALHADA: VENDEDOR / LOJA / INDUSTRIA / SKU / QTD / VENCIMENTO */}
        <div className="space-y-2">
          {modoResumo !== 'detalhado' && (
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider pt-2">
              Itens Detalhados do Relatório:
            </h3>
          )}

          {itensFiltrados.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              <FileText className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <p className="text-xs font-bold text-slate-600">Nenhum registro encontrado para estes filtros</p>
              <p className="text-[11px] text-slate-400">Ajuste os filtros de coordenador, indústria ou status acima.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-800 text-white font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider select-none">
                  <tr>
                    <th
                      onClick={() => alternarOrdenacao('responsavel')}
                      className="py-2.5 px-2.5 cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Vendedor / Coordenador (A-Z / Z-A)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Vendedor / Coord.</span>
                        {colunaOrdenacao === 'responsavel' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('loja')}
                      className="py-2.5 px-2.5 cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Loja / Filial"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Loja / Filial</span>
                        {colunaOrdenacao === 'loja' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('industria')}
                      className="py-2.5 px-2.5 cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Indústria"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Indústria</span>
                        {colunaOrdenacao === 'industria' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('sku')}
                      className="py-2.5 px-2.5 cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por SKU"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>SKU</span>
                        {colunaOrdenacao === 'sku' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('produto')}
                      className="py-2.5 px-2.5 cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Descrição do Produto"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Descrição do Produto</span>
                        {colunaOrdenacao === 'produto' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('quantidade')}
                      className="py-2.5 px-2.5 text-center cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Quantidade (Maior para Menor / Menor para Maior)"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Qtd</span>
                        {colunaOrdenacao === 'quantidade' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('vencimento')}
                      className="py-2.5 px-2.5 text-center cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Data de Vencimento"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Vencimento</span>
                        {colunaOrdenacao === 'vencimento' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('dias')}
                      className="py-2.5 px-2.5 text-center cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Dias para Vencer (Menor para Maior / Maior para Menor)"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Dias</span>
                        {colunaOrdenacao === 'dias' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>

                    <th
                      onClick={() => alternarOrdenacao('situacao')}
                      className="py-2.5 px-2.5 text-center cursor-pointer hover:bg-slate-700 transition-colors group"
                      title="Clique para ordenar por Situação / Status"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Situação ({diasNoPrazo}d)</span>
                        {colunaOrdenacao === 'situacao' ? (
                          direcaoOrdenacao === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 shrink-0" />
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {itensOrdenados.map((it, idx) => {
                    const statusObj = classificarStatus(it.data_vencimento);
                    const IconeStatus = statusObj.icone;
                    const dias = calcularDiasRestantes(it.data_vencimento);
                    const responsavel = (it.vendedor || it.coordenador || '-').trim();

                    return (
                      <tr
                        key={it.id || idx}
                        className={`hover:bg-slate-50 transition-colors ${
                          dias <= 0 ? 'bg-red-50/30' : dias <= diasCritico ? 'bg-amber-50/25' : ''
                        }`}
                      >
                        {/* Vendedor / Coordenador */}
                        <td className="py-2 px-2.5 font-bold text-slate-900 break-words leading-tight">
                          {responsavel}
                        </td>

                        {/* Loja / Filial */}
                        <td className="py-2 px-2.5 font-medium text-slate-800 break-words leading-tight">
                          {it.loja || 'Loja Principal'}
                          {it.estado && (
                            <span className="ml-1 text-[9px] font-mono font-bold text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              {it.estado}
                            </span>
                          )}
                        </td>

                        {/* Indústria */}
                        <td className="py-2 px-2.5 font-semibold text-purple-950 break-words leading-tight">
                          {it.industria || '-'}
                        </td>

                        {/* SKU */}
                        <td className="py-2 px-2.5 font-mono text-slate-600 text-[11px]">
                          {it.codigo || '-'}
                        </td>

                        {/* Produto */}
                        <td className="py-2 px-2.5 font-bold text-slate-900 break-words leading-tight">
                          {it.produto}
                        </td>

                        {/* Quantidade */}
                        <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-900">
                          {it.quantidade} <span className="text-[10px] text-slate-500 font-normal">{it.unidade || 'un'}</span>
                        </td>

                        {/* Data Vencimento */}
                        <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-800">
                          {formatarDataBR(it.data_vencimento)}
                        </td>

                        {/* Dias para Vencer */}
                        <td className="py-2 px-2.5 text-center font-mono font-bold text-[11px]">
                          {dias < 0 ? (
                            <span className="text-red-600">{dias}d</span>
                          ) : dias <= diasCritico ? (
                            <span className="text-amber-600">{dias}d</span>
                          ) : diasNoPrazo > diasCritico && dias < diasNoPrazo ? (
                            <span className="text-sky-600">{dias}d</span>
                          ) : (
                            <span className="text-emerald-700">{dias}d</span>
                          )}
                        </td>

                        {/* Situação */}
                        <td className="py-2 px-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusObj.classe}`}
                          >
                            <IconeStatus className="w-3 h-3 shrink-0" />
                            <span>{statusObj.texto}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Rodapé Totalizador */}
                <tfoot className="bg-slate-100 font-extrabold text-[11px] text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="py-2.5 px-2.5" colSpan={3}>
                      TOTAL CONSOLIDADO ({resumo.coordenadoresUnicos} coord. • {resumo.lojasUnicas} lojas • {resumo.industriasUnicas} ind.)
                    </td>
                    <td className="py-2.5 px-2.5" colSpan={2}>
                      {resumo.totalLinhas} produtos
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-mono font-black text-blue-900 bg-blue-100/40">
                      {resumo.qtdTotal} un
                    </td>
                    <td className="py-2.5 px-2.5 text-center" colSpan={2}>
                      -
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span className="text-red-700">{resumo.vencidos} venc.</span> /{' '}
                      <span className="text-amber-700">{resumo.criticos} crít.</span> /{' '}
                      {resumo.atencao > 0 && <span className="text-sky-700">{resumo.atencao} aten. / </span>}
                      <span className="text-emerald-700">{resumo.noPrazo} no prazo</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé do Relatório Impresso */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
          <span>Relatório oficial de controle de validades • Uso restrito da equipe comercial e operacional</span>
          <span>Emitido via {systemBranding?.systemName || 'Controle de Validade'}</span>
        </div>
      </div>

      {/* MODAL DE ENVIO DO RELATÓRIO PARA WHATSAPP */}
      {mostrarModalWhatsApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 space-y-4 animate-scale-up">
            {/* Cabeçalho do Modal */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-6 h-6 fill-white/20" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span>Enviar Relatório via WhatsApp</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Compartilhe o resumo executivo dos itens filtrados diretamente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalWhatsApp(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campo Opcional de Telefone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Número do WhatsApp <span className="text-slate-400 font-normal">(Opcional)</span>:
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={telefoneWhatsApp}
                  onChange={(e) => setTelefoneWhatsApp(e.target.value)}
                  placeholder="Ex: 11 99999-9999 (ou deixe vazio para escolher no app)"
                  className="w-full text-xs h-9.5 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                💡 Se deixar em branco, o WhatsApp abrirá com sua lista de conversas e grupos para você escolher o destinatário.
              </p>
            </div>

            {/* Prévia da Mensagem */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Prévia da Mensagem Formatada:
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {itensOrdenados.length} itens no filtro
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono max-h-52 overflow-y-auto whitespace-pre-wrap text-slate-700 select-all leading-relaxed">
                {gerarTextoWhatsApp()}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopiarTextoWhatsApp}
                  className={`h-9 px-3 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    copiadoFeedback
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs'
                  }`}
                  title="Copiar texto da mensagem para a área de transferência"
                >
                  {copiadoFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiadoFeedback ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>

                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleCompartilharWebShare}
                    className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Compartilhar via aplicativo do celular"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Compartilhar</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalWhatsApp(false)}
                  className="h-9 px-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleEnviarWhatsApp}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-4 h-4 fill-white/20" />
                  <span>Abrir no WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
