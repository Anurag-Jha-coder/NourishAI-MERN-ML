/**
 * retrainQueue.js
 * ──────────────────────────────────────────────────────────────
 * Bull queue backed by Redis.  Gracefully degrades if Redis is
 * not available — feedback is still saved, retraining just won't
 * be triggered automatically.
 *
 * Windows users: install Redis via WSL2 or use a Windows port
 * (https://github.com/microsoftarchive/redis/releases).
 * The queue silently no-ops when Redis is unreachable.
 */

const axios    = require('axios');
const Feedback = require('../models/Feedback');
const Settings = require('../models/Settings');

const ML_URL        = `http://${process.env.ML_HOST || 'localhost'}:${process.env.ML_PORT || 5001}`;
const RETRAIN_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_SAMPLES   = 50;

let queue = null;

// ── Attempt to connect Bull / Redis ──────────────────────────
try {
  const Bull = require('bull');
  queue = new Bull('retrain-queue', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  });

  // ── Queue Processor ───────────────────────────────────────
  queue.process(async (job) => {
    console.log('[RetrainQueue] Job received:', job.id, job.data);

    try {
      // 1. Count total feedback docs
      const count = await Feedback.countDocuments();
      console.log(`[RetrainQueue] Feedback count: ${count}`);

      if (count < MIN_SAMPLES) {
        console.log(`[RetrainQueue] Not enough samples (${count}/${MIN_SAMPLES}). Skipping.`);
        return { skipped: true, reason: 'insufficient_samples', count };
      }

      // 2. Check cooldown: fetch Settings singleton
      const settings = await Settings.findOneAndUpdate(
        { key: 'global' },
        { $setOnInsert: { key: 'global', last_retrain_at: null } },
        { upsert: true, new: true }
      );

      const lastRetrain = settings.last_retrain_at;
      const now         = Date.now();

      if (lastRetrain && (now - new Date(lastRetrain).getTime()) < RETRAIN_COOLDOWN_MS) {
        const hoursLeft = ((RETRAIN_COOLDOWN_MS - (now - new Date(lastRetrain).getTime())) / 3600000).toFixed(1);
        console.log(`[RetrainQueue] Cooldown active — ${hoursLeft}h remaining. Skipping.`);
        return { skipped: true, reason: 'cooldown', hoursLeft };
      }

      // 3. POST to Flask /retrain
      console.log('[RetrainQueue] Triggering ML retrain…');
      const response = await axios.post(
        `${ML_URL}/retrain`,
        { min_samples: MIN_SAMPLES },
        { timeout: 5 * 60 * 1000 }  // 5 min timeout — training takes time
      );

      // 4. Update timestamp on success
      await Settings.findOneAndUpdate(
        { key: 'global' },
        { last_retrain_at: new Date() },
        { upsert: true }
      );

      console.log('[RetrainQueue] ✅ Retrain succeeded:', response.data);
      return { success: true, mlResponse: response.data };

    } catch (err) {
      // Errors inside the processor are caught per-job; they do NOT crash the server
      console.error('[RetrainQueue] ❌ Retrain job failed:', err.message);
      throw err; // Bull will mark the job as failed; won't crash the process
    }
  });

  // Global error listeners so unexpected Bull errors never crash the server
  queue.on('error',  (err) => console.error('[RetrainQueue] Queue error:', err.message));
  queue.on('failed', (job, err) => console.warn(`[RetrainQueue] Job ${job.id} failed: ${err.message}`));

  console.log('✅ RetrainQueue connected to Redis');

} catch (err) {
  // Bull package not installed or Redis connection failed at startup
  console.warn('[RetrainQueue] ⚠️  Could not initialise Bull queue:', err.message);
  console.warn('[RetrainQueue] Automatic retraining disabled. Install Redis + run: npm install bull');
  queue = null;
}

/**
 * addToQueue()
 * Adds a retrain job to the Bull queue.
 * Safe to call even when Redis is unavailable — it just logs a warning.
 *
 * @param {object} meta  – optional metadata attached to the job (e.g. { triggeredBy })
 */
async function addToQueue(meta = {}) {
  if (!queue) {
    console.warn('[RetrainQueue] Queue unavailable — skipping retrain trigger.');
    return;
  }
  try {
    const job = await queue.add(
      { triggeredAt: new Date().toISOString(), ...meta },
      {
        attempts: 3,
        backoff:  { type: 'exponential', delay: 30_000 },  // 30s → 60s → 120s
        removeOnComplete: 50,   // keep last 50 completed jobs
        removeOnFail:     20,
      }
    );
    console.log(`[RetrainQueue] Job ${job.id} queued.`);
    return job;
  } catch (err) {
    // Never crash the API call that triggered this
    console.error('[RetrainQueue] Failed to enqueue job:', err.message);
  }
}

module.exports = { addToQueue };
