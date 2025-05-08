import pino, { type LogFn } from "pino";
import pretty from "pino-pretty";
import fs from "fs";
import path from "path";
import os from "os";

import { parseBooleanFromText } from "./parsing.ts";

const customLevels: Record<string, number> = {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    log: 29,
    progress: 28,
    success: 27,
    workflow: 25,
    debug: 20,
    trace: 10,
};

const raw = parseBooleanFromText(process?.env?.LOG_JSON_FORMAT) || false;

const createStream = () => {
    if (raw) {
        return undefined;
    }
    return pretty({
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss",
        ignore: "pid,hostname",
    });
};

const defaultLevel = process?.env?.DEFAULT_LOG_LEVEL || "info";

const options = {
    level: defaultLevel,
    customLevels,
    hooks: {
        logMethod(
            inputArgs: [string | Record<string, unknown>, ...unknown[]],
            method: LogFn
        ): void {
            const [arg1, ...rest] = inputArgs;

            if (typeof arg1 === "object") {
                const messageParts = rest.map((arg) =>
                    typeof arg === "string" ? arg : JSON.stringify(arg)
                );
                const message = messageParts.join(" ");
                method.apply(this, [arg1, message]);
            } else {
                const context = {};
                const messageParts = [arg1, ...rest].map((arg) =>
                    typeof arg === "string" ? arg : arg
                );
                const message = messageParts
                    .filter((part) => typeof part === "string")
                    .join(" ");
                const jsonParts = messageParts.filter(
                    (part) => typeof part === "object"
                );

                Object.assign(context, ...jsonParts);

                method.apply(this, [context, message]);
            }
        },
    },
};

export const elizaLogger = pino(options, createStream());

// Create logs directory if it doesn't exist
let logDir: string;
try {
    logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
} catch (error) {
    console.error("Failed to create logs directory:", error);
    // Fallback to OS temp directory
    logDir = path.join(os.tmpdir(), "eliza-logs");
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
}

const originalWorkflow = elizaLogger.workflow;

// Helper function to extract message from workflow log arguments
function extractWorkflowMessage(args: any[]): string {
    try {
        if (args.length === 0) return '';

        // If first argument is a string, join all arguments
        if (typeof args[0] === 'string') {
            return args.map(arg =>
                typeof arg === 'string' ? arg : JSON.stringify(arg)
            ).join(' ');
        }

        // If first argument is an object
        const obj = args[0];

        // If it's a simple object with a message property
        if (obj.msg) {
            return typeof obj.msg === 'string' ? obj.msg : JSON.stringify(obj.msg);
        }

        // If it has a content property with text
        if (obj.content?.text) {
            return obj.content.text;
        }

        // Fallback to stringifying the entire object
        return JSON.stringify(obj);
    } catch (error) {
        console.error('Error extracting workflow message:', error);
        return '[Error extracting message]';
    }
}

// Override the workflow method with file logging
elizaLogger.workflow = (...args: Parameters<typeof originalWorkflow>) => {
    // Call original logger
    originalWorkflow.apply(elizaLogger, args);

    try {
        // Get current timestamp
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toISOString().split('T')[1].split('.')[0];

        // Generate log file path
        const logFile = path.join(logDir, `${date}.workflow.log`);

        // Extract message
        const message = extractWorkflowMessage(args);

        // Format log entry
        const logEntry = `${date} ${time} - ${message}\n`;

        // Write to file synchronously
        fs.appendFileSync(logFile, logEntry, { encoding: 'utf8' });
    } catch (error) {
        console.error('Failed to write workflow log to file:', error);
        // Call original error logger to ensure error is logged
        elizaLogger.error('Failed to write workflow log to file:', error);
    }
};

export default elizaLogger;
