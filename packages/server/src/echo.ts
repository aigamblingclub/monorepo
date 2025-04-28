Bun.serve({
    port: 3001,
    async fetch(req) {
        const requestJsonBody = await req.json()
        console.log({ requestJsonBody })
        const response = await fetch('http://localhost:3000/rpc', {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify(requestJsonBody),
        })
        const responseJsonBody = await response.json()
        console.log({ responseJsonBody })
        return response
    }
})
