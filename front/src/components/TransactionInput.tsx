import { ChangeEvent, useState, useEffect } from 'react';
import { formatUSDCtoDisplay, parseInputToAtomic, isValidUSDCInput } from '../utils/currency';

interface TransactionInputProps {
  id: string;
  value: number;  // Value in atomic format
  onChange: (value: number) => void;  // Callback receives atomic value
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
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Only update display value when the atomic value changes and it's not during user input
    if (value === 0) {
      setDisplayValue('');
    } else if (!document.activeElement?.id?.includes(id)) {
      setDisplayValue(formatUSDCtoDisplay(value));
    }
  }, [value, id]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Update display value immediately for better UX
    setDisplayValue(inputValue);
    
    // Only process if input is valid
    if (isValidUSDCInput(inputValue)) {
      const atomicValue = parseInputToAtomic(inputValue);
      onChange(atomicValue);
    } else if (inputValue === '') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    // Format the value properly when the input loses focus
    if (value > 0) {
      setDisplayValue(formatUSDCtoDisplay(value));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <div className={id === 'deposit' ? 'mb-3' : ''}>
      <div>
        <div className='flex gap-2'>
          <input
            type='number'
            id={id}
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            min="0"
            step="0.01"  // Allow increments of 0.01
            className='w-44 bg-black border border-white rounded px-2 py-1 font-mono text-sm text-white placeholder-gray-400 focus:outline-none disabled:opacity-50 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]'
            placeholder='Enter amount'
            disabled={isLoading}
            autoComplete='off'
          />
          <button
            onClick={onAction}
            disabled={isDisabled || !value || value <= 0}  // Disable for invalid values
            className='w-24 py-1 bg-black border border-white rounded font-mono text-sm text-white hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white'
          >
            {isLoading ? '...' : actionLabel}
          </button>
        </div>
      </div>
      {error && (
        <div className='mt-2 p-2 text-xs text-red-400 border border-red-500 rounded bg-black font-mono'>
          {error}
        </div>
      )}
    </div>
  );
}
