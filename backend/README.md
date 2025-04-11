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

The API is documented using Swagger/OpenAPI. You can access the interactive API documentation at:

```
http://localhost:3000/api-docs
```

### API Implementation Guidelines

When adding new endpoints to the API, follow these guidelines:

1. **Route Organization**:

   - Create new route files in the `src/routes` directory
   - Group related endpoints in the same file
   - Use meaningful file names that reflect the resource (e.g., `auth.ts`, `users.ts`)

2. **Documentation**:

   - Add Swagger documentation for each endpoint using JSDoc comments
   - Include:
     - Endpoint summary
     - Request parameters/body schema
     - Response schemas
     - Authentication requirements
     - Possible error responses

3. **Authentication**:

   - Use the `validateApiKey` middleware for protected routes
   - Document authentication requirements in Swagger using the `ApiKeyAuth` security scheme

4. **Error Handling**:

   - Use consistent error response formats
   - Include appropriate HTTP status codes
   - Provide meaningful error messages

5. **Rate Limiting**:
   - Apply appropriate rate limiting middleware based on the endpoint's usage pattern
   - Use existing rate limiters or create new ones as needed

Example of documenting a new endpoint:

```typescript
/**
 * @swagger
 * /api/resource:
 *   post:
 *     summary: Create a new resource
 *     tags: [Resource]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - field1
 *               - field2
 *             properties:
 *               field1:
 *                 type: string
 *               field2:
 *                 type: number
 *     responses:
 *       200:
 *         description: Resource created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
```

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Run tests to ensure everything works
4. Submit a pull request

## License

This project is proprietary and confidential.
