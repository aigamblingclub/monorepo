import { PrismaClient } from '../prisma';

const prisma = new PrismaClient();

interface TableWinningBets {
  tableId: string;
  tableVolume: number;
  tableStatus: string;
  totalWinningBets: number;
}

interface WinningBetGroup {
  tableId: string;
  _sum: {
    amount: number | null;
  };
}

// export async function getWinningBetsByTable(): Promise<TableWinningBets[]> {
//   const winningBets = await prisma.userBet.groupBy({
//     by: ['tableId'],
//     where: {
//       status: 'WON'
//     },
//     _sum: {
//       amount: true
//     }
//   });

//   const tables = await prisma.table.findMany({
//     where: {
//       tableId: {
//         in: winningBets.map(bet => bet.tableId)
//       }
//     },
//     select: {
//       tableId: true,
//       volume: true,
//       tableStatus: true
//     }
//   });

//   return winningBets.map(bet => {
//     const table = tables.find(t => t.tableId === bet.tableId);
//     const sum = bet._sum?.amount ?? 0;
//     return {
//       tableId: bet.tableId,
//       tableVolume: table?.volume ?? 0,
//       tableStatus: table?.tableStatus ?? '',
//       totalWinningBets: sum
//     };
//   });
// }
