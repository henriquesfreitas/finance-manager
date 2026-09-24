import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { PieChart } from 'lucide-react';
import type { InvestmentListItem } from '@/types/investment';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const GROUPS = [
  { name: 'Renda Fixa', color: '#2563eb' },
  { name: 'FIIs', color: '#16a34a' },
  { name: 'ETF', color: '#ca8a04' },
  { name: 'BDRs', color: '#9333ea' },
  { name: 'Criptomoedas', color: '#ea580c' },
  { name: 'Stocks', color: '#64748b' },
] as const;

function investmentGroup(investment: InvestmentListItem): (typeof GROUPS)[number]['name'] {
  if (investment.type === 'TREASURY' || investment.sector === 'Renda Fixa') return 'Renda Fixa';
  if (investment.sector === 'FIIs' || investment.sector === 'Fiagros') return 'FIIs';
  if (investment.sector === 'ETFs') return 'ETF';
  if (investment.sector === 'BDRs') return 'BDRs';
  if (investment.sector === 'Criptomoedas') return 'Criptomoedas';
  return 'Stocks';
}

function positionValue(investment: InvestmentListItem): number {
  const quantity = Number(investment.position.quantity);
  const averagePrice = Number(investment.position.averagePrice);
  const currentPrice = investment.type === 'TREASURY'
    ? (investment.currentValue !== null ? Number(investment.currentValue) : null)
    : (investment.quote?.currentPrice ?? null);
  return currentPrice !== null ? quantity * currentPrice : quantity * averagePrice;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PortfolioAllocationDialog({ investments }: { investments: InvestmentListItem[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const allocation = useMemo(() => {
    const totals = new Map<string, number>(GROUPS.map(({ name }) => [name, 0]));
    for (const investment of investments) {
      const group = investmentGroup(investment);
      totals.set(group, (totals.get(group) ?? 0) + positionValue(investment));
    }
    return GROUPS.map((group) => ({ ...group, value: totals.get(group.name) ?? 0 }))
      .filter((group) => group.value > 0);
  }, [investments]);
  const total = allocation.reduce((sum, group) => sum + group.value, 0);
  let angle = 0;
  const gradient = allocation.map((group) => {
    const start = angle;
    angle += total > 0 ? (group.value / total) * 360 : 0;
    return `${group.color} ${start}deg ${angle}deg`;
  }).join(', ');

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PieChart className="mr-2 h-4 w-4" />
        Portfolio Allocation
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Portfolio Allocation</DialogTitle>
          </DialogHeader>
          {allocation.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No investment value available.</p>
          ) : (
            <div className="grid items-center gap-6 py-3 sm:grid-cols-[240px_1fr]">
              <div
                role="img"
                aria-label={`Portfolio allocation pie chart. Total ${formatCurrency(total)}`}
                className="mx-auto aspect-square w-56 rounded-full"
                style={{ background: `conic-gradient(${gradient})` } as CSSProperties}
              />
              <ul className="grid gap-3">
                {allocation.map((group) => (
                  <li key={group.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: group.color }} aria-hidden="true" />
                      {group.name}
                    </span>
                    <span className="text-right tabular-nums">
                      {formatCurrency(group.value)} <span className="text-muted-foreground">({(group.value / total * 100).toFixed(1)}%)</span>
                    </span>
                  </li>
                ))}
                <li className="mt-1 flex justify-between border-t pt-3 text-sm font-semibold">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </li>
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
