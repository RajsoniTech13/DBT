const axios = require('axios');
const { logger, retry } = require('../utils/helpers');
require('dotenv').config();

const HADOOP_URL = process.env.HADOOP_URL || 'http://hadoop-namenode:9870';
const HDFS_DATA_PATH = process.env.HDFS_DATA_PATH || '/dbt-data/dbt_merged.csv';

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

/**
 * Fetch the full transaction dataset from Hadoop HDFS via WebHDFS REST API.
 *
 * WebHDFS flow:
 *   1. GET namenode:9870/webhdfs/v1/path?op=OPEN
 *   2. Namenode returns 307 redirect → datanode:9864/...
 *   3. Follow redirect to get actual file content
 *
 * Inside Docker network, both namenode and datanode are reachable,
 * so axios with maxRedirects handles it seamlessly.
 *
 * @returns {Array|Object} Parsed CSV row array or JSON payload
 */
const fetchFromHadoop = async () => {
  const url = `${HADOOP_URL}/webhdfs/v1${HDFS_DATA_PATH}?op=OPEN&user.name=root`;
  logger.info('HadoopService', `Fetching data from WebHDFS: ${url}`);

  return retry(async () => {
    const response = await axios.get(url, {
      maxRedirects: 5,          // Follow the namenode → datanode redirect
      timeout: 60000,           // 60s timeout for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Decompress if needed
      decompress: true,
    });

    const data = response.data;

    if (typeof data === 'string') {
      const trimmed = data.trim();

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsedJson = JSON.parse(trimmed);
          logger.info('HadoopService', `✅ Successfully fetched JSON data from HDFS`);
          return parsedJson;
        } catch (parseErr) {
          throw new Error('Failed to parse HDFS JSON response: ' + parseErr.message);
        }
      }

      try {
        const parsedCsv = parseCsv(trimmed);
        logger.info('HadoopService', `✅ Successfully fetched CSV data from HDFS (${parsedCsv.length} rows)`);
        return parsedCsv;
      } catch (parseErr) {
        throw new Error('Failed to parse HDFS response as CSV: ' + parseErr.message);
      }
    }

    logger.info('HadoopService', `✅ Successfully fetched data from HDFS`);
    return data;
  }, 3, 2000);
};

module.exports = { fetchFromHadoop };
