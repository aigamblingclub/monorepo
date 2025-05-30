import { PrismaClient } from '@/prisma';
import { PokerState } from '@/types/schemas';
import { getOnChainUsdcBalance } from './near';

const prisma = new PrismaClient();

export async function getUserBalance(userId: number) {
   try {
     // Get user's NEAR address
     const user = await prisma.user.findUnique({
       where: { id: userId },
     });
     if (!user) {
       throw new Error('User not found');
     }

     // Get on-chain USDC balance
     const contractId = process.env.AGC_CONTRACT_ID;
     if (!contractId) {
       throw new Error('AGC_CONTRACT_ID not configured');
     }

     const onchainBalance = await getOnChainUsdcBalance(contractId, user.nearImplicitAddress);

     const lastTable = await prisma.table.findFirst({
       orderBy: {
         id: 'desc',
       },
     });
     console.log('🔍 lastTable:', lastTable);
     console.log('🔍 userId:', userId);
     const userBalance = await prisma.userBalance.findFirst({
       where: { userId },
       select: { id: true, virtualBalance: true },
     });

     // last table in progress
     if (lastTable?.tableStatus === 'PLAYING' || !lastTable) {
       return {
         virtualBalance: userBalance?.virtualBalance || 0,
       };
     } else {
       const bets = await prisma.userBet.findMany({
         where: { userId, tableId: lastTable.tableId },
         select: { amount: true }, //, betStatus: true }
       });
       // virtual = onchain - bets[lost]
       if (bets.length > 0) {
         console.log('🔍 bets:', bets);
         const lostBets = bets.filter(bet => bet.amount < 0);
         const virtualBalance = onchainBalance - lostBets.reduce((acc, bet) => acc + bet.amount, 0);
         await prisma.userBalance.update({
           where: { id: userBalance?.id },
           data: { virtualBalance },
         });
         return {
           virtualBalance,
         };
       }
       console.log('🔍 userBalance?.virtualBalance:', userBalance);
       console.log('🔍 onchainBalance:', onchainBalance);
       if (userBalance?.virtualBalance !== onchainBalance) {
         await prisma.userBalance.upsert({
           where: { id: userBalance?.id },
           update: { virtualBalance: onchainBalance },
           create: { userId, onchainBalance, virtualBalance: onchainBalance },
         });
       }

       return { virtualBalance: userBalance?.virtualBalance || 0 };
     }
   } catch (error) {
      console.error('Get virtual balance error:', error);
      throw new Error('Internal server error');
    }
}

