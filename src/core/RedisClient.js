const Redis = require('ioredis');
const logger = require('../utils/logger');
const config = require('../utils/config');

class RedisClient {
    constructor() {
        this._client = null;
        this.isConnected = false;
        this.connect().catch(err => {
            logger.error('Redis initial connection failed', { error: err.message });
        });
    }

    async connect() {
        try {
            this._client = new Redis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password || undefined,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 100, 2000);
                    logger.info(`Redis retry attempt ${times}. Retrying in ${delay}ms`);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableOfflineQueue: true,
                lazyConnect: true
            });

            // Connection event handlers
            this._client.on('connect', () => {
                this.isConnected = true;
                logger.info('✅ Redis connected successfully');
            });

            this._client.on('error', (error) => {
                this.isConnected = false;
                logger.error('❌ Redis error', { error: error.message });
            });

            await this._client.connect();
            return true;

        } catch (error) {
            this.isConnected = false;
            logger.error('❌ Redis initialization failed', { error: error.message });
            return false;
        }
    }

    async getClient() {
        if (!this._client || !this.isConnected) {
            await this.connect();
        }
        return this._client;
    }

    async isReady() {
        return this.isConnected && this._client?.status === 'ready';
    }
}

module.exports = new RedisClient();