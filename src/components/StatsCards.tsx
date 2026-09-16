import React from 'react';
import { AlertCircle, AlertTriangle, Building2, CalendarClock, CheckCircle2, Package } from 'lucide-react';
import { ItemValidade, FiltroStatus } from '../types';
import { calcularDiasRestantes } from '../lib/excel';

interface StatsCardsProps {
  items: ItemValidade[];
  filtroAtivo: FiltroStatus;
  aoMudarFiltro: (filtro: FiltroStatus) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  items,
  filtroAtivo,
  aoMudarFiltro,
}) => {
  let totalQuantidade = 0;
  let vencidos = 0;
  let criticos = 0;
  let atencao = 0;
  let regulares = 0;
  const industriasSet = new Set<string>();

  items.forEach((item) => {
    totalQuantidade += item.quantidade || 0;
    if (item.industria) industriasSet.add(item.industria.trim());

    const dias = calcularDiasRestantes(item.data_vencimento);
    if (dias < 0) {
      vencidos++;
    } else if (dias <= 7) {
      criticos++;
    } else if (dias <= 30) {
      atencao++;
    } else {
      regulares++;
    }
  });

  const cards = [
    {
      id: 'btn-filtro-todos',
      filtro: 'todos' as FiltroStatus,
      titulo: 'Total Cadastrado',
      valor: items.length,
      subtexto: `${totalQuantidade} unidades no total`,
      icone: Package,
      corIcone: 'text-slate-600 bg-slate-100',
      bordaAtiva: 'border-slate-800 ring-2 ring-slate-800/10',
    },
    {
      id: 'btn-filtro-vencidos',
      filtro: 'vencidos' as FiltroStatus,
      titulo: 'Vencidos',
      valor: vencidos,
      subtexto: vencidos > 0 ? 'Ação imediata necessária' : 'Nenhum vencido',
      icone: AlertCircle,
      corIcone: 'text-red-600 bg-red-50',
      bordaAtiva: 'border-red-600 ring-2 ring-red-600/20 bg-red-50/20',
      destaque: vencidos > 0 ? 'text-red-700' : 'text-slate-700',
    },
    {
      id: 'btn-filtro-critico',
      filtro: 'critico_7d' as FiltroStatus,
      titulo: 'Vencem em até 7 dias',
      valor: criticos,
      subtexto: 'Crítico / Fazer promoção',
      icone: AlertTriangle,
      corIcone: 'text-amber-600 bg-amber-50',
      bordaAtiva: 'border-amber-600 ring-2 ring-amber-600/20 bg-amber-50/20',
      destaque: criticos > 0 ? 'text-amber-700' : 'text-slate-700',
    },
    {
      id: 'btn-filtro-atencao',
      filtro: 'atencao_30d' as FiltroStatus,
      titulo: 'Vencem em 30 dias',
      valor: atencao,
      subtexto: 'Monitoramento semanal',
      icone: CalendarClock,
      corIcone: 'text-yellow-600 bg-yellow-50',
      bordaAtiva: 'border-yellow-600 ring-2 ring-yellow-600/20 bg-yellow-50/20',
      destaque: 'text-slate-800',
    },
    {
      id: 'btn-filtro-regular',
      filtro: 'regular' as FiltroStatus,
      titulo: 'No Prazo (>30 dias)',
      valor: regulares,
      subtexto: `${industriasSet.size} indústrias ativas`,
      icone: CheckCircle2,
      corIcone: 'text-emerald-600 bg-emerald-50',
      bordaAtiva: 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/20',
      destaque: 'text-emerald-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 my-4">
      {cards.map((c) => {
        const IconComponent = c.icone;
        const isSelected = filtroAtivo === c.filtro;

        return (
          <button
            key={c.filtro}
            id={c.id}
            type="button"
            onClick={() => aoMudarFiltro(c.filtro)}
            className={`text-left p-3.5 sm:p-4 rounded-xl border bg-white transition-all shadow-xs hover:shadow-md cursor-pointer ${
              isSelected ? c.bordaAtiva : 'border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500 line-clamp-1">{c.titulo}</span>
              <div className={`p-1.5 rounded-lg ${c.corIcone}`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl font-bold tracking-tight ${c.destaque || 'text-slate-900'}`}>
              {c.valor}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">{c.subtexto}</p>
          </button>
        );
      })}
    </div>
  );
};
