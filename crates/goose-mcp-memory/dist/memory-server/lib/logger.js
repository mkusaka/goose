import winston from 'winston';
import path from 'path';
import os from 'os';
export const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
    })),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: path.join(os.homedir(), '.mcp-memory-server.log')
        })
    ]
});
//# sourceMappingURL=logger.js.map