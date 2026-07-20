import React, { useState, useRef, useEffect } from 'react';

interface EditablePriceCellProps {
  /** Current stored value (null = not set). */
  value: number | null;
  /** Called with the new value when the user commits. Null means clear the target. */
  onSave: (value: number | null) => void;
  /** Whether a save is in-flight (disables input). */
  isPending?: boolean;
  /** Extra class names applied to the wrapper span when in display mode. */
  className?: string;
  /** Accessible label for the edit input, e.g. "Edit Target Sell Price for ITUB3". */
  ariaLabel?: string;
}

/** Formats a number as BRL currency for display. */
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Inline-editable price cell.
 * Shows formatted currency when idle, switches to a numeric input on click.
 * Saves on blur or Enter key; cancels on Escape.
 *
 * @example
 *   <EditablePriceCell value={35.5} onSave={(v) => mutate({ id, targetSellPrice: v })} />
 */
export function EditablePriceCell({
  value,
  onSave,
  isPending = false,
  className = '',
  ariaLabel = 'Edit price target',
}: EditablePriceCellProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  // Draft holds the raw string while the user types
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input as soon as it mounts
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing(): void {
    // Pre-fill with the current numeric value (no currency symbol)
    setDraft(value !== null ? String(value) : '');
    setEditing(true);
  }

  function commit(): void {
    setEditing(false);
    const trimmed = draft.trim();

    if (trimmed === '') {
      // Empty input → clear the target
      onSave(null);
      return;
    }

    const parsed = parseFloat(trimmed.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      // Invalid — revert without saving
      return;
    }
    onSave(parsed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        aria-label={ariaLabel}
        className="w-24 rounded border border-input bg-background px-1 py-0.5 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      onClick={startEditing}
      disabled={isPending}
      aria-label={ariaLabel}
      title="Click to set price target"
      className={`w-full cursor-text text-right text-sm hover:underline focus-visible:outline-none focus-visible:underline ${className}`}
    >
      {value !== null ? (
        formatCurrency(value)
      ) : (
        <span className="text-muted-foreground/40">—</span>
      )}
    </button>
  );
}
