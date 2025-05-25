# AI Gaming Club Backend

This is the backend service for the AI Gaming Club platform, built with Node.js, Express, and TypeScript.

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
