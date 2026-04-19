const redis = require('../config/redis');
const { logger } = require('../utils/helpers');
require('dotenv').config();

// Redis Queue Names
const QUEUE_INCOMING = 'incoming_transactions';
const QUEUE_RESULTS = 'processed_results';
const ANALYZE_CHUNK_SIZE = parseInt(process.env.ML_ANALYZE_CHUNK_SIZE || '500', 10);

/**
 * Push transaction batch into Redis Queue 1 (incoming_transactions).
 * The ML Microservice will consume from this queue.
 *
 * @param {Array} transactions - Array of transaction records
 */
const pushToQueue = async (transactions) => {
  const payload = JSON.stringify(transactions);

  // This stack currently processes one batch at a time, so clear any stale
  // results left behind by previous runs before enqueueing a new request.
  await redis.del(QUEUE_RESULTS);

  logger.info('MLService', `════════════════════════════════════════════════════`);
  logger.info('MLService', `📤 PUSHING ${transactions.length} RECORDS TO REDIS QUEUE`);
  logger.info('MLService', `   Queue: ${QUEUE_INCOMING}`);
  logger.info('MLService', `   Payload size: ${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(2)} MB`);
  logger.info('MLService', `   Sample record: ${JSON.stringify(transactions[0])}`);
  logger.info('MLService', `════════════════════════════════════════════════════`);

  await redis.lpush(QUEUE_INCOMING, payload);
  logger.info('MLService', `✅ Data pushed to Redis queue: ${QUEUE_INCOMING}`);
};

/**
 * Wait for ML results to appear on Redis Queue 2 (processed_results).
 * Uses BRPOP (blocking pop) to wait efficiently without polling.
 *
 * @param {number} timeoutSeconds - Max time to wait for results
 * @returns {Array} Array of fraud analysis results
 */
const waitForResults = async (expectedCount, timeoutSeconds = 120) => {
  logger.info('MLService', `⏳ Waiting for ML results on queue: ${QUEUE_RESULTS} (timeout: ${timeoutSeconds}s)`);

  const result = await redis.brpop(QUEUE_RESULTS, timeoutSeconds);

  if (!result) {
    throw new Error(`ML service did not respond within ${timeoutSeconds} seconds. Check if ml-service container is running.`);
  }

  // BRPOP returns [queueName, value]
  const [, rawData] = result;
  const parsedResults = JSON.parse(rawData);

  if (!Array.isArray(parsedResults)) {
    throw new Error('Invalid ML results format. Expected array.');
  }

  if (typeof expectedCount === 'number' && parsedResults.length !== expectedCount) {
    throw new Error(
      `ML result count mismatch. Expected ${expectedCount}, received ${parsedResults.length}.`
    );
  }

  // Log summary
  const high = parsedResults.filter(r => r.risk_score >= 80).length;
  const medium = parsedResults.filter(r => r.risk_score >= 50 && r.risk_score < 80).length;
  const low = parsedResults.filter(r => r.risk_score < 50).length;

  logger.info('MLService', `════════════════════════════════════════════════════`);
  logger.info('MLService', `✅ ML RESULTS RECEIVED FROM REDIS QUEUE`);
  logger.info('MLService', `   Queue: ${QUEUE_RESULTS}`);
  logger.info('MLService', `   Total results: ${parsedResults.length}`);
  logger.info('MLService', `   🔴 High risk (≥80): ${high}`);
  logger.info('MLService', `   🟡 Medium risk (50-79): ${medium}`);
  logger.info('MLService', `   🟢 Low risk (<50): ${low}`);
  logger.info('MLService', `   Sample result: ${JSON.stringify(parsedResults[0])}`);
  logger.info('MLService', `════════════════════════════════════════════════════`);

  return parsedResults;
};

/**
 * Full analysis pipeline using Redis as message broker:
 * 1. Push transactions to Queue 1
 * 2. Wait for ML results on Queue 2
 *
 * @param {Array} transactions - Array of transaction records
 * @returns {Array} Array of fraud analysis results
 */
const analyzeBatch = async (transactions) => {
  const aggregatedResults = [];

  for (let index = 0; index < transactions.length; index += ANALYZE_CHUNK_SIZE) {
    const chunk = transactions.slice(index, index + ANALYZE_CHUNK_SIZE);

    logger.info(
      'MLService',
      `🔹 Processing ML chunk ${Math.floor(index / ANALYZE_CHUNK_SIZE) + 1} (${chunk.length} records)`
    );

    // Step 1: Push one chunk to Redis Queue 1
    await pushToQueue(chunk);

    // Step 2: Block-wait for one matching chunk of results on Queue 2
    const chunkResults = await waitForResults(chunk.length, 120);
    aggregatedResults.push(...chunkResults);
  }

  return aggregatedResults;
};

module.exports = { analyzeBatch, pushToQueue, waitForResults };
