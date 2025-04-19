// declare module "@elizaos/core" {
//     export interface Client {
//         type: string;
//         start: (runtime?: IAgentRuntime) => Promise<any>;
//         stop: () => Promise<void>;
//     }

//     export interface IAgentRuntime {
//         character: {
//             name: string;
//             id?: string;
//             // Adicione outras propriedades conforme necessário
//         };
//         generateText: (options: {
//             systemPrompt: string;
//             prompt: string;
//             roomId: string;
//         }) => Promise<string>;
//         // Adicione outros métodos conforme necessário
//     }

//     export type UUID = string;

//     export const elizaLogger: {
//         log: (...args: any[]) => void;
//         debug: (...args: any[]) => void;
//         error: (...args: any[]) => void;
//         warn: (...args: any[]) => void;
//         info: (...args: any[]) => void;
//     };
// }
