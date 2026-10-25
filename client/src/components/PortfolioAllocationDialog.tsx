import { useMemo, useState } from 'react';
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
  { name: 'Stocks', color: '#0891b2' },
] as const;

type AllocationGroupName = (typeof GROUPS)[number]['name'];

interface AllocationGroup {
  name: AllocationGroupName;
  color: string;
  value: number;
}

interface SectorAllocation {
  name: string;
  value: number;
}

interface Projection {
  allocation: AllocationGroup[];
  hasUnpricedPlans: boolean;
  impacts: Map<AllocationGroupName, InvestmentImpact[]>;
}

interface InvestmentImpact {
  ticker: string;
  value: number;
}

interface AllocationChange {
  value: number;
  impacts: InvestmentImpact[];
}

function investmentGroup(investment: InvestmentListItem): AllocationGroupName {
  if (investment.type === 'TREASURY' || investment.sector === 'Renda Fixa') return 'Renda Fixa';
  if (
    investment.sector === 'FIIs'
    || investment.sector?.startsWith('FIIs — ')
    || investment.sector === 'Fiagros'
  ) return 'FIIs';
  if (investment.sector === 'ETFs') return 'ETF';
  if (investment.sector === 'BDRs') return 'BDRs';
  if (investment.sector === 'Criptomoedas') return 'Criptomoedas';
  return 'Stocks';
}

function currentUnitPrice(investment: InvestmentListItem): number | null {
  const value = investment.type === 'TREASURY'
    ? (investment.currentValue !== null ? Number(investment.currentValue) : null)
    : (investment.quote?.currentPrice ?? null);
  return value !== null && Number.isFinite(value) ? value : null;
}

function positionValue(investment: InvestmentListItem): number {
  const quantity = Number(investment.position.quantity);
  const averagePrice = Number(investment.position.averagePrice);
  const currentPrice = currentUnitPrice(investment);
  return currentPrice !== null ? quantity * currentPrice : quantity * averagePrice;
}

function buildAllocation(totals: Map<AllocationGroupName, number>): AllocationGroup[] {
  return GROUPS.map((group) => ({ ...group, value: totals.get(group.name) ?? 0 }))
    .filter((group) => group.value > 0);
}

function createProjection(investments: InvestmentListItem[]): Projection {
  const totals = new Map<AllocationGroupName, number>(GROUPS.map(({ name }) => [name, 0]));
  const impacts = new Map<AllocationGroupName, InvestmentImpact[]>();
  let hasUnpricedPlans = false;

  for (const investment of investments) {
    const group = investmentGroup(investment);
    const quantity = Number(investment.position.quantity);
    const buyQuantity = Number(investment.targetBuyQuantity ?? 0);
    const sellQuantity = Number(investment.targetSellQuantity ?? 0);
    const hasBuyPlan = Number.isFinite(buyQuantity) && buyQuantity > 0;
    const hasSellPlan = Number.isFinite(sellQuantity) && sellQuantity > 0;
    const unitPrice = currentUnitPrice(investment);
    let value = positionValue(investment);
    let transactionImpact = 0;

    if (hasBuyPlan || hasSellPlan) {
      if (unitPrice === null) {
        hasUnpricedPlans = true;
      } else {
        if (hasBuyPlan) transactionImpact += buyQuantity * unitPrice;
        if (hasSellPlan) transactionImpact -= Math.min(sellQuantity, Math.max(0, quantity)) * unitPrice;
        value += transactionImpact;
      }
    }

    totals.set(group, (totals.get(group) ?? 0) + Math.max(0, value));
    if (transactionImpact !== 0) {
      impacts.set(group, [...(impacts.get(group) ?? []), { ticker: investment.ticker, value: transactionImpact }]);
    }
  }

  return { allocation: buildAllocation(totals), hasUnpricedPlans, impacts };
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatSignedCurrency(value: number): string {
  if (value === 0) return formatCurrency(0);
  return `${value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;
}

function changeColorClass(value: number): string {
  if (value > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (value < 0) return 'text-red-700 dark:text-red-300';
  return 'text-foreground';
}

function slicePath(startAngle: number, endAngle: number): string {
  const radius = 48;
  const pointAt = (angle: number): [number, number] => {
    const radians = (angle * Math.PI) / 180;
    return [50 + radius * Math.sin(radians), 50 - radius * Math.cos(radians)];
  };
  const [startX, startY] = pointAt(startAngle);
  const [endX, endY] = pointAt(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M 50 50 L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function PieGraphic({
  allocation,
  total,
  label,
  selectedGroup,
  onSelectGroup,
}: {
  allocation: AllocationGroup[];
  total: number;
  label: string;
  selectedGroup?: AllocationGroupName;
  onSelectGroup?: (group: AllocationGroupName) => void;
}): React.JSX.Element {
  let angle = 0;
  const slices = allocation.map((group) => {
    const start = angle;
    angle += total > 0 ? (group.value / total) * 360 : 0;
    return { ...group, start, end: angle };
  });

  return (
    <div className="relative grid aspect-square w-56 place-items-center">
      <svg
        viewBox="0 0 100 100"
        role="group"
        aria-label={`${label} pie chart. Total ${formatCurrency(total)}`}
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        {slices.map((slice) => (
          <path
            key={slice.name}
            d={slices.length === 1
              ? 'M 50 2 A 48 48 0 1 1 50 98 A 48 48 0 1 1 50 2 Z'
              : slicePath(slice.start, slice.end)}
            fill={slice.color}
            stroke={selectedGroup === slice.name ? 'var(--color-foreground)' : 'var(--color-card)'}
            strokeWidth={selectedGroup === slice.name ? 1.5 : 0.5}
            role={onSelectGroup ? 'button' : undefined}
            tabIndex={onSelectGroup ? 0 : undefined}
            aria-label={onSelectGroup
              ? `${slice.name}: ${formatCurrency(slice.value)}, ${(slice.value / total * 100).toFixed(1)}%. Show sector breakdown`
              : undefined}
            aria-pressed={onSelectGroup ? selectedGroup === slice.name : undefined}
            className={onSelectGroup ? 'cursor-pointer outline-none focus-visible:stroke-[3]' : undefined}
            onClick={onSelectGroup ? () => onSelectGroup(slice.name) : undefined}
            onKeyDown={onSelectGroup ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectGroup(slice.name);
              }
            } : undefined}
          />
        ))}
      </svg>
      <div className="pointer-events-none relative z-10 grid h-[62%] w-[62%] content-center justify-items-center rounded-full border bg-card text-center shadow-sm">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="mt-1 px-2 text-sm font-bold tabular-nums text-foreground">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function AllocationList({
  allocation,
  total,
  label,
  selectedGroup,
  onSelectGroup,
  changes,
  selectedChangeGroup,
  onSelectChange,
}: {
  allocation: AllocationGroup[];
  total: number;
  label: string;
  selectedGroup?: AllocationGroupName;
  onSelectGroup?: (group: AllocationGroupName) => void;
  changes?: Map<AllocationGroupName, AllocationChange>;
  selectedChangeGroup?: AllocationGroupName | null;
  onSelectChange?: (group: AllocationGroupName) => void;
}): React.JSX.Element {
  return (
    <ul aria-label={label} className="grid content-center gap-1">
      {allocation.map((group) => {
        const change = changes?.get(group.name);
        const valueClass = change ? changeColorClass(change.value) : 'text-foreground';
        const content = (
          <>
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm ring-2 ring-white"
                style={{ backgroundColor: group.color }}
                aria-label={`${group.name} color`}
                role="img"
              />
              <span className="font-medium">{group.name}</span>
            </span>
            <span className="text-right tabular-nums">
              {change && onSelectChange ? (
                <button
                  type="button"
                  aria-expanded={selectedChangeGroup === group.name}
                  aria-label={`${group.name} projected value ${formatCurrency(group.value)}, change ${formatSignedCurrency(change.value)}. Show changed tickers`}
                  onClick={() => onSelectChange(group.name)}
                  className={`rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${valueClass}`}
                >
                  {formatCurrency(group.value)} <span className="font-medium">({formatSignedCurrency(change.value)})</span>
                </button>
              ) : (
                <span className={`font-semibold ${valueClass}`}>{formatCurrency(group.value)}</span>
              )}{' '}
              <span className={change ? valueClass : 'text-muted-foreground'}>
                {(total > 0 ? group.value / total * 100 : 0).toFixed(1)}%
              </span>
            </span>
          </>
        );

        return (
          <li key={group.name} className="border-b last:border-0">
            {onSelectGroup ? (
              <button
                type="button"
                aria-pressed={selectedGroup === group.name}
                onClick={() => onSelectGroup(group.name)}
                className="flex w-full items-center justify-between gap-3 rounded-sm py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {content}
              </button>
            ) : (
              <div className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

interface PortfolioAllocationDialogProps {
  investments: InvestmentListItem[];
  inMenu?: boolean;
}

export function PortfolioAllocationDialog({ investments, inMenu = false }: PortfolioAllocationDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AllocationGroupName | null>(null);
  const [selectedChangeGroup, setSelectedChangeGroup] = useState<AllocationGroupName | null>(null);
  const allocation = useMemo(() => {
    const totals = new Map<AllocationGroupName, number>(GROUPS.map(({ name }) => [name, 0]));
    for (const investment of investments) {
      const group = investmentGroup(investment);
      totals.set(group, (totals.get(group) ?? 0) + positionValue(investment));
    }
    return buildAllocation(totals);
  }, [investments]);
  const currentTotal = allocation.reduce((sum, group) => sum + group.value, 0);
  const projection = useMemo(() => createProjection(investments), [investments]);
  const projectedTotal = projection.allocation.reduce((sum, group) => sum + group.value, 0);
  const currentValues = new Map<AllocationGroupName, number>(allocation.map((group) => [group.name, group.value]));
  const projectedValues = new Map<AllocationGroupName, number>(projection.allocation.map((group) => [group.name, group.value]));
  const projectedRows = GROUPS
    .map((group) => ({ ...group, value: projectedValues.get(group.name) ?? 0 }))
    .filter((group) => group.value > 0 || (currentValues.get(group.name) ?? 0) > 0);
  const allocationChanges = new Map<AllocationGroupName, AllocationChange>();
  for (const group of GROUPS) {
    const impacts = projection.impacts.get(group.name) ?? [];
    if (impacts.length > 0) {
      allocationChanges.set(group.name, {
        value: (projectedValues.get(group.name) ?? 0) - (currentValues.get(group.name) ?? 0),
        impacts,
      });
    }
  }
  const selectedChange = selectedChangeGroup ? allocationChanges.get(selectedChangeGroup) : undefined;
  const sectorAllocations = useMemo<SectorAllocation[]>(() => {
    if (!selectedGroup) return [];
    const totals = new Map<string, number>();
    for (const investment of investments) {
      if (investmentGroup(investment) !== selectedGroup) continue;
      const sector = investment.sector?.trim() || 'Unclassified';
      totals.set(sector, (totals.get(sector) ?? 0) + positionValue(investment));
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .filter((sector) => sector.value > 0)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }, [investments, selectedGroup]);
  const selectedGroupValue = allocation.find((group) => group.name === selectedGroup)?.value ?? 0;

  function handleGroupSelect(group: AllocationGroupName): void {
    setSelectedGroup((currentGroup) => currentGroup === group ? null : group);
  }

  function handleChangeSelect(group: AllocationGroupName): void {
    setSelectedChangeGroup((currentGroup) => currentGroup === group ? null : group);
  }

  return (
    <>
      <Button
        type="button"
        variant={inMenu ? 'ghost' : 'outline'}
        size="sm"
        className={inMenu
          ? 'w-full justify-start rounded-md px-3 py-2 text-left text-sm font-normal text-popover-foreground hover:bg-accent hover:text-accent-foreground'
          : 'border-white/40 bg-white/10 px-2 text-white hover:bg-white/20 hover:text-white sm:px-3'}
        onClick={() => setOpen(true)}
      >
        <PieChart className={`h-4 w-4 ${inMenu ? 'mr-2' : 'sm:mr-2'}`} />
        <span className={inMenu ? '' : 'sr-only sm:not-sr-only'}>Portfolio Allocation</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-primary">Portfolio Allocation</DialogTitle>
          </DialogHeader>

          <section aria-labelledby="current-allocation-heading" className="grid gap-4">
            <h2 id="current-allocation-heading" className="text-base font-semibold">Current allocation</h2>
            {allocation.length === 0 ? (
              <p className="rounded-xl border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                No investment value available.
              </p>
            ) : (
              <div className="grid gap-5 rounded-xl border bg-muted p-4 sm:grid-cols-[260px_1fr] sm:gap-7 sm:p-6">
                <div className="grid place-items-center">
                  <PieGraphic
                    allocation={allocation}
                    total={currentTotal}
                    label="Portfolio value"
                    selectedGroup={selectedGroup ?? undefined}
                    onSelectGroup={handleGroupSelect}
                  />
                </div>
                <AllocationList
                  allocation={allocation}
                  total={currentTotal}
                  label="Current allocation by asset type"
                  selectedGroup={selectedGroup ?? undefined}
                  onSelectGroup={handleGroupSelect}
                />
              </div>
            )}
            {selectedGroup && (
              <div aria-live="polite" className="rounded-xl border bg-card p-4">
                <h3 className="font-semibold">{selectedGroup} sectors</h3>
                {sectorAllocations.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No sector value available for this group.</p>
                ) : (
                  <ul aria-label={`${selectedGroup} sector allocation`} className="mt-2 grid gap-1">
                    {sectorAllocations.map((sector) => (
                      <li key={sector.name} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                        <span>{sector.name}</span>
                        <span className="text-right tabular-nums">
                          <span className="font-semibold">{formatCurrency(sector.value)}</span>{' '}
                          <span className="text-muted-foreground">{(sector.value / selectedGroupValue * 100).toFixed(1)}%</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="projected-allocation-heading" className="grid gap-3 border-t pt-5">
            <div>
              <h2 id="projected-allocation-heading" className="text-base font-semibold">Projected allocation after planned buys and sells</h2>
              {projection.hasUnpricedPlans && (
                <p role="status" className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  Partial projection: planned transactions without a current price are not included.
                </p>
              )}
            </div>
            {projectedRows.length === 0 ? (
              <p className="rounded-xl border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                No investment value available after planned buys and sells.
              </p>
            ) : (
              <div className={`grid gap-5 rounded-xl border bg-muted p-4 sm:gap-7 sm:p-6 ${projection.allocation.length > 0 ? 'sm:grid-cols-[260px_1fr]' : ''}`}>
                {projection.allocation.length > 0 ? (
                  <div className="grid place-items-center">
                    <PieGraphic
                      allocation={projection.allocation}
                      total={projectedTotal}
                      label="Projected value"
                    />
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground sm:col-span-2">
                    No investment value remains in the projected allocation.
                  </p>
                )}
                <div className="grid gap-3">
                  <AllocationList
                    allocation={projectedRows}
                    total={projectedTotal}
                    label="Projected allocation by asset type"
                    changes={allocationChanges}
                    selectedChangeGroup={selectedChangeGroup}
                    onSelectChange={handleChangeSelect}
                  />
                  {selectedChange && selectedChangeGroup && (
                    <div aria-live="polite" className="rounded-lg border bg-card p-3">
                      <h3 className="font-semibold">{selectedChangeGroup} changed tickers</h3>
                      <ul aria-label={`${selectedChangeGroup} changed tickers`} className="mt-2 grid gap-1">
                        {selectedChange.impacts.map((impact) => (
                          <li key={impact.ticker} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                            <span className="font-medium">{impact.ticker}</span>
                            <span className={`font-semibold tabular-nums ${changeColorClass(impact.value)}`}>
                              {formatSignedCurrency(impact.value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
