const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, 'app.jsonl'); // .jsonl = JSON Lines format

// Helper function to format log entry
function formatLogEntry(type, message, error = null) {
    const entry = {
        timestamp: new Date().toISOString(),
        type,
        message
    };

    if (type === 'ERROR' && error) {
        entry.stack = error.stack || error.toString();
    }

    return JSON.stringify(entry) + '\n';
}

const logger = {
    log: (message) => {
        const logEntry = formatLogEntry('INFO', message);
        fs.appendFileSync(logFile, logEntry);
        // console.log(`ℹ️ [INFO]: ${message}`);
    },

    error: (message, error) => {
        const logEntry = formatLogEntry('ERROR', message, error);
        fs.appendFileSync(logFile, logEntry);
        // console.error(`❌ [ERROR]: ${message}`, error);
    }
};

module.exports = logger;
