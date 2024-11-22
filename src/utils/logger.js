const winston = require('winston');
const config = require('./config');

const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
        });
    })
);

const logger = winston.createLogger({
    level: config.environment === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'rate-limiter' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// In development, also log to a file
if (config.environment !== 'production') {
    logger.add(new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        dirname: 'logs'
    }));
    logger.add(new winston.transports.File({ 
        filename: 'logs/combined.log',
        dirname: 'logs' 
    }));
}

module.exports = logger;