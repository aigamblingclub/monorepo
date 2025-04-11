# AI Gaming Club Backend

This is the backend service for the AI Gaming Club platform, built with Node.js, Express, and TypeScript.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager
- SQLite (for local development)

## Project Structure

```
backend/
├── src/
│   ├── middleware/    # Express middleware
│   ├── prisma/        # Database schema and migrations
│   ├── routes/        # API route handlers
│   ├── tests/         # Test files
│   ├── types/         # TypeScript type definitions
│   └── index.ts       # Application entry point
├── .env               # Environment variables
├── .env.example       # Example environment variables
├── package.json       # Project dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your configuration values.

3. Generate Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Run database migrations:

   ```bash
   npm run prisma:migrate:dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot-reload
- `npm run build` - Build the TypeScript code
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate:dev` - Run database migrations in development
- `npm run prisma:migrate:deploy` - Run database migrations in production
- `npm run prisma:studio` - Open Prisma Studio for database management

## Security Features

- Rate limiting
- XSS protection
- HTTP Parameter Pollution protection
- Environment variable configuration
- SQL injection protection (via Prisma)

## Testing

The project uses Jest for testing. Tests are located in the `src/tests` directory.

## Database

The project uses Prisma as the ORM with SQLite as the database. The schema is defined in `src/prisma/schema.prisma`.

## API Documentation

API documentation will be added as the endpoints are developed.

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Run tests to ensure everything works
4. Submit a pull request

## License

This project is proprietary and confidential.
