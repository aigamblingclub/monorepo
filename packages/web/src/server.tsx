const server = Bun.serve({
  port: 3002,
  async fetch(request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Poker Agent Demo</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #root {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/client.js"></script>
</body>
</html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    if (url.pathname === '/client.js') {
      const result = await Bun.build({
        entrypoints: ['./src/index.tsx'],
        target: 'browser',
      });
      
      if (result.success && result.outputs.length > 0) {
        return new Response(result.outputs[0], {
          headers: { 'Content-Type': 'application/javascript' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  }
});

console.log(`Server running at http://localhost:${server.port}`);