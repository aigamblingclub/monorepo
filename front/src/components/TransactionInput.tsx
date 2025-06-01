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
      <div>
        <div className="flex gap-2">
          <input
            type="number"
            id={id}
            value={value}
            onChange={onChange}
            className="w-44 bg-black border border-white rounded px-2 py-1 font-mono text-sm text-white placeholder-gray-400 focus:outline-none disabled:opacity-50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            placeholder="Enter amount"
            disabled={isLoading}
            autoComplete="off"
          />
          <button
            onClick={onAction}
            disabled={isDisabled}
            className="w-24 py-1 bg-black border border-white rounded font-mono text-sm text-white hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white"
          >
            {isLoading ? '...' : actionLabel}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-2 p-2 text-xs text-red-400 border border-red-500 rounded bg-black font-mono">
          {error}
        </div>
      )}
    </div>
  );
} 