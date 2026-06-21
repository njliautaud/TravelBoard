package com.travelboard.app

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Flushes the offline [Outbox] to /api/drafts/ingest. Runs on app open and on a
 * ~15-minute schedule, both gated on network connectivity. Because "connected"
 * doesn't guarantee the LAN server is reachable, delivery success is decided by
 * the actual POST — failures are kept and retried with backoff.
 */
class SyncWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val config = Config(applicationContext)
        if (!config.isConfigured) return@withContext Result.success()

        val outbox = Outbox(applicationContext)
        val items = outbox.readAll()
        if (items.isEmpty()) return@withContext Result.success()

        if (!Net.isReachable(config.baseUrl)) return@withContext Result.retry()

        // Keep the items that failed to deliver; drop the ones that succeeded.
        val remaining = items.filter { item ->
            val text = item.optString("text")
            val delivered = Net.ingest(config.baseUrl, config.ingestKey, config.username, text)
            !delivered
        }
        outbox.rewrite(remaining)
        if (remaining.isEmpty()) Result.success() else Result.retry()
    }

    companion object {
        private const val WORK_ONESHOT = "travelboard-sync-now"
        private const val WORK_PERIODIC = "travelboard-sync-periodic"

        private fun connectedConstraints() = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        /** Flush as soon as possible (called on app open / after queuing a share). */
        fun enqueue(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(connectedConstraints())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_ONESHOT, ExistingWorkPolicy.REPLACE, request)
        }

        /** Background heartbeat so queued shares land even if the app isn't reopened. */
        fun schedulePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(connectedConstraints())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(WORK_PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request)
        }
    }
}
