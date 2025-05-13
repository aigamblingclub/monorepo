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

// Override the workflow method with file logging
elizaLogger.workflow = (...args: Parameters<typeof originalWorkflow>) => {
    // Call original logger
    originalWorkflow.apply(elizaLogger, args);

    try {
        // Get current timestamp
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toISOString();

        // Generate log file path
        const logFile = path.join(logDir, `${date}.workflow.json`);

        // Format log entry as an object
        const logEntry = {
            timestamp: time,
            level: "workflow",
            message: JSON.parse(args[0]),
        };

        // Read existing logs or create new array
        let logs: any[] = [];
        if (fs.existsSync(logFile)) {
            try {
                const content = fs.readFileSync(logFile, 'utf8');
                logs = JSON.parse(content);
                if (!Array.isArray(logs)) {
                    logs = [];
                }
            } catch (err) {
                // If file exists but is invalid JSON, start fresh
                logs = [];
            }
        }

        // Add new entry
        logs.push(logEntry);

        // Write back to file with pretty formatting
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), { encoding: 'utf8' });
    } catch (error) {
        console.error('Failed to write workflow log to file:', error);
        // Call original error logger to ensure error is logged
        elizaLogger.error('Failed to write workflow log to file:', error);
    }
};

// Add text format logging for other levels
Object.keys(customLevels).forEach((level) => {
    if (level === 'workflow') return; // Skip workflow as it's handled above

    const originalMethod = (elizaLogger as any)[level];
    (elizaLogger as any)[level] = (...args: any[]) => {
        // Call original logger
        originalMethod.apply(elizaLogger, args);

        try {
            // Get current timestamp
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const time = now.toISOString().split('T')[1].split('.')[0];

            // Format message
            let message = '';
            if (typeof args[0] === 'string') {
                message = args.map(arg =>
                    typeof arg === 'string' ? arg :
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) :
                    String(arg)
                ).join(' ');
            } else {
                message = args.map(arg =>
                    typeof arg === 'string' ? arg :
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) :
                    String(arg)
                ).join('\n');
            }

            // Format log entry
            const logEntry = `[${date} ${time}] ${level.toUpperCase()}: ${message}\n`;

            // Generate log file path and append
            const logFile = path.join(logDir, `${date}.log`);
            fs.appendFileSync(logFile, logEntry, { encoding: 'utf8' });
        } catch (error) {
            console.error(`Failed to write ${level} log to file:`, error);
        }
    };
});

export default elizaLogger;
