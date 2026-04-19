/**
 * Utility: Logger with timestamps and context
 */
const logger = {
  info: (context, message) => {
    console.log(`[${new Date().toISOString()}] [INFO] [${context}] ${message}`);
  },
  error: (context, message, err) => {
    console.error(`[${new Date().toISOString()}] [ERROR] [${context}] ${message}`, err || '');
  },
  warn: (context, message) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [${context}] ${message}`);
  },
  time: (label) => console.time(label),
  timeEnd: (label) => console.timeEnd(label),
};

/**
 * Utility: Chunk an array into smaller batches for processing
 * Used to split 10,000 records into manageable chunks if needed
 */
const chunkArray = (array, size = 1000) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

/**
 * Utility: Simple async retry wrapper
 */
const retry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      logger.warn('Retry', `Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

module.exports = { logger, chunkArray, retry };
