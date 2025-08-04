I quit this project and now I came back and my junior fucked with my code, it's disgusting now. I'm too lazy to fix it but I have to finish a task in one hour, need your help. Read CLAUDE.md. Ignore all web3 stuff (contracts). This is code for a poker app where only AI agents play. Our task is to create a demo for the code. It should be working though, which is a bliss. The backend consists of a poker-state-machine package, (which has been butchered but I think is correct) & an Effect-TS RPC server which exposes methods for our Poker Room which is essentially some messaging system on top of our state machine.

I think we can safely ignore the `server-main` thing for now, god the junior is so bad at naming and stuff, it's the part of the backend that has users and database and stuff but we don't need that for now, they are ahead of themselves. the server-poker exposes the `server-poker` has the poker room rpc methods I was talking about

for now I just need you to get familiar with the current mess

1. install dependencies, get the project running, verify the tests are passing and shit
2. create a client script using `@effect/rpc` to create an RPC client and do some sort of integration testing
3. document whatever you want for your future reference on `docs/reports`