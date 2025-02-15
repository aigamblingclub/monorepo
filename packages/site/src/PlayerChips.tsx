import { Chip } from "./Chip";

type PlayerChipsProps = {
  bet?: number;
  isDealer: boolean;
  isBigBlind: boolean;
  isSmallBlind: boolean;
  position: number; // Index 0-5 for position around table
};

export function PlayerChips({ bet, isDealer, isBigBlind, isSmallBlind, position }: PlayerChipsProps) {
  const angleInRadians = (position * (360 / 6) - 90) * (Math.PI / 180);

  const indicatorRadiusX = 44;
  const indicatorRadiusY = 36;

  // Adjust based on position
  const isDiagonal = position % 3 !== 0; // true for positions 1,2,4,5
  const isTopOrBottom = position % 3 === 0; // true for positions 0,3

  const betRadiusX = isDiagonal ? 30 : 35;
  const betRadiusY = 28;

  // Pull in the vertical radius for indicator chips on top/bottom positions
  const adjustedIndicatorRadiusY = isTopOrBottom ? 38 : indicatorRadiusY;

  const indicatorX = 50 + indicatorRadiusX * Math.cos(angleInRadians);
  const indicatorY = 50 + adjustedIndicatorRadiusY * Math.sin(angleInRadians);
  const betX = 50 + betRadiusX * Math.cos(angleInRadians);
  const betY = 50 + betRadiusY * Math.sin(angleInRadians);

  const getChipStackStyle = (position: number) => {
    // Top players (0)
    if (position === 0) return "flex-col";
    // Bottom players (3)
    if (position === 3) return "flex-col-reverse";
    // Right side players (1, 2)
    if (position === 1 || position === 2) return "flex-row-reverse";
    // Left side players (4, 5)
    return "flex-row";
  };

  const stackStyle = getChipStackStyle(position);
  const gap = stackStyle.includes('col') ? 'gap-1' : 'gap-2';

  return (
    <>
      {/* Bet chip */}
      {bet && bet > 0 && (
        <div
          className="absolute"
          style={{
            left: `${betX}%`,
            top: `${betY}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Chip type="bet" value={bet} />
        </div>
      )}

      {/* Indicator chips */}
      <div
        className={`absolute flex ${stackStyle} ${gap}`}
        style={{
          left: `${indicatorX}%`,
          top: `${indicatorY}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
        {isDealer && <Chip type="dealer" />}
        {isBigBlind && <Chip type="big-blind" />}
        {isSmallBlind && <Chip type="small-blind" />}
      </div>
    </>
  );
}
