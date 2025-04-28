type ChipProps = {
  type: 'dealer' | 'big-blind' | 'small-blind' | 'bet';
  value?: number;  // For bet amounts
};

export function Chip({ type, value }: ChipProps) {
  const chipStyles = {
    'dealer': 'bg-white text-black border-gray-400',
    'big-blind': 'bg-red-600 text-white border-red-400',
    'small-blind': 'bg-blue-600 text-white border-blue-400',
    'bet': 'bg-green-600 text-white border-green-400',
  };

  const chipLabels = {
    'dealer': 'D',
    'big-blind': 'B',
    'small-blind': 'S',
    'bet': value ? `$${value}` : '',
  };

  const isBet = type === 'bet';

  return (
    <div className="relative">
      <div
        className={`
          w-14 h-14
          rounded-full
          ${chipStyles[type]}
          border-4
          flex items-center justify-center
          ${isBet ? 'text-sm' : 'text-base'} font-bold
          shadow-md
          relative
          before:content-['']
          before:absolute
          before:w-12 before:h-12
          before:border-2
          before:border-dashed
          before:rounded-full
          before:opacity-50
        `}
      >
        {chipLabels[type]}
      </div>
    </div>
  );
}
