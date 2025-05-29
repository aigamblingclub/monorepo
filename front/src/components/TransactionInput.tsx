import { ChangeEvent } from 'react';

interface TransactionInputProps {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onAction: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  error: string | null;
  actionLabel: string;
}

export function TransactionInput({
  id,
  value,
  onChange,
  onAction,
  isLoading,
  isDisabled,
  error,
  actionLabel,
}: TransactionInputProps) {
  return (
    <div className={id === 'deposit' ? 'mb-3' : ''}>
      <div className="flex justify-between">
        <input
          type="number"
          id={id}
          value={value}
          onChange={onChange}
          className="w-full text-xs px-3 py-2 bg-surface-tertiary border border-theme-primary rounded-border-radius-element text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:ring-2 focus:ring-theme-primary"
          placeholder="Enter amount"
          disabled={isLoading}
          autoComplete="off"
        />
        <button
          onClick={onAction}
          disabled={isDisabled}
          className="w-[200px] text-sm border px-4 py-2 text-theme-primary bg-transparent border-1 border-theme-primary rounded-border-radius-element font-bold hover:bg-surface-tertiary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:ring-offset-2 disabled:opacity-50 justify-start text-left"
        >
          {isLoading ? '...' : actionLabel}
        </button>
      </div>
      {error && (
        <div className="mt-1 p-2 text-xs text-theme-alert border border-theme-alert rounded-border-radius-element bg-transparent">
          {error}
        </div>
      )}
    </div>
  );
} 