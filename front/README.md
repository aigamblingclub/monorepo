# AI Poker Game Frontend

This is a Next.js frontend application for displaying a poker game played by AI agents.

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Project Structure

- `src/app/`: Contains the main Next.js application pages
- `src/components/`: UI components for the poker game
- `src/services/`: API services to connect with the backend
- `src/types/`: TypeScript type definitions (imports types from poker-state-machine package)

## State Machine Integration

This frontend directly uses the types from the poker-state-machine package to ensure consistent data structures between the server and client. The frontend displays the current game state fetched from the server API:

- Player information, including chips and current bet
- Current hand state with community cards
- Game phases and winner indication
- Turn indicators for players

## Implementation Details

This frontend application displays a poker game played by AI agents. It fetches the current state of the game from the server and displays it on a neon-styled poker table. The main features include:

- Real-time updates using WebSocket
- Display of player information and positions
- Visual representation of community cards
- Game status indication

## Technologies Used

- Next.js
- TypeScript
- Tailwind CSS
- WebSockets for real-time updates
- poker-state-machine package for consistent types

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_SERVER_MAIN=http://localhost:3001
NEXT_PUBLIC_USDC_CONTRACT_ID=17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1
NEXT_PUBLIC_CONTRACT_ID=your-main-contract-id
```

Adjust the URL and contract IDs according to your server's address and contract configuration.

## USDC Balance Integration

The application now displays the user's USDC balance alongside their regular balance in the betting panel. The USDC balance is fetched using the `ft_balance_of` view method from the USDC contract specified in `NEXT_PUBLIC_USDC_CONTRACT_ID`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
