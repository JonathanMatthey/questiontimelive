#!/usr/bin/env node
/**
 * Script to verify Redis connection
 * Run with: node scripts/verify-redis.js
 */

require('dotenv').config({ path: '.env.local' });

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.log('❌ Redis credentials not found in .env.local');
  console.log('\nPlease add:');
  console.log('  KV_REST_API_URL=https://your-redis-url.upstash.io');
  console.log('  KV_REST_API_TOKEN=your-redis-token');
  console.log('\nto your .env.local file');
  process.exit(1);
}

async function testConnection() {
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });

    // Test connection
    const result = await redis.ping();
    
    if (result === 'PONG') {
      console.log('✅ Redis connection successful!');
      
      // Count sessions
      const sessions = await redis.smembers('sessions');
      console.log(`📊 Found ${sessions.length} session(s) in database`);
      
      process.exit(0);
    } else {
      console.log('❌ Redis connection failed - unexpected response:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.error('\nPlease check:');
    console.error('  1. Your KV_REST_API_URL is correct');
    console.error('  2. Your KV_REST_API_TOKEN is correct');
    console.error('  3. Your Redis database is accessible');
    process.exit(1);
  }
}

testConnection();

