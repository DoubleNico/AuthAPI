import { createClient, RedisClientType } from 'redis'

/**
 * The RedisClient class provides methods to interact with a Redis database.
 */
export class RedisClient {
  private client: RedisClientType
  private url: string

  /**
   * Constructor for RedisClient.
   * @param url - The URL of the Redis server.
   */
  constructor(url: string) {
    this.url = url
    this.client = createClient({
      url: this.url,
    })

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err)
    })
  }

  /**
   * Connects to the Redis server.
   */
  public async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect()
      console.log(`Connected to Redis at ${this.url}`)
    }
  }

  /**
   * Disconnects from the Redis server.
   */
  public async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect()
      console.log('Disconnected from Redis')
    }
  }

  /**
   * Sets a key-value pair in Redis with an optional expiration time.
   * @param key - The key to set.
   * @param value - The value to set.
   * @param expiresInSeconds - Optional expiration time in seconds.
   */
  public async set(
    key: string,
    value: string,
    expiresInSeconds?: number
  ): Promise<void> {
    if (expiresInSeconds) {
      await this.client.set(key, value, { EX: expiresInSeconds })
    } else {
      await this.client.set(key, value)
    }
  }

  /**
   * Gets the value of a key from Redis.
   * @param key - The key to get.
   * @returns The value of the key, or null if the key does not exist.
   */
  public async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  /**
   * Deletes a key from Redis.
   * @param key - The key to delete.
   * @returns The number of keys that were removed.
   */
  public async del(key: string): Promise<number> {
    return this.client.del(key)
  }

  /**
   * Checks if a key exists in Redis.
   * @param key - The key to check.
   * @returns The number of keys that exist (0 or 1).
   */
  public async exists(key: string): Promise<number> {
    return this.client.exists(key)
  }
}
