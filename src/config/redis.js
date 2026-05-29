const { createClient } = require('redis');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
});

client.on('error', (err) => console.error('Redis error:', err.message));
client.on('connect', () => console.log('Redis connected successfully'));

// Connect when server starts
client.connect().catch((err) => {
  console.error('Redis connection failed:', err.message);
});

// get → parse JSON string back to object
const get = async (key) => {
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

// set → store object as JSON string with TTL in seconds
const set = async (key, value, ttlSeconds = 300) => {
  await client.setEx(key, ttlSeconds, JSON.stringify(value));
};

// del → delete one key
const del = async (key) => {
  await client.del(key);
};

// delByPattern → delete all keys matching a pattern
// Used for cache invalidation (clear all task cache for an org)
const delByPattern = async (pattern) => {
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(keys);
  }
};

module.exports = { get, set, del, delByPattern };
