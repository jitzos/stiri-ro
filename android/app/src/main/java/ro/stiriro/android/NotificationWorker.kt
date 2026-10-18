package ro.stiriro.android

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalTime
import java.util.concurrent.TimeUnit

class NotificationWorker(context: Context, params: WorkerParameters): CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val p = applicationContext.getSharedPreferences("stiriro_android", Context.MODE_PRIVATE)
            if (!p.getBoolean("notificationsEnabled", true)) return@withContext Result.success()
            val (items, _) = NewsNetwork.fetchAll()
            val previous = p.getString("notificationKnown", null)
            val known = try {
                val array = JSONArray(previous ?: "[]")
                (0 until array.length()).map { array.optString(it) }.toSet()
            } catch (_: Exception) { emptySet<String>() }
            val latest = items.map { it.id }.take(2000)
            // Initial poll only creates the baseline; never send old headlines on first install.
            if (previous == null) {
                p.edit().putString("notificationKnown", JSONArray(latest).toString()).apply()
                return@withContext Result.success()
            }
            val hidden = parseWords(p.getString("hidden","[]"))
            val muted = parseWords(p.getString("muted","[]"))
            val pendingBefore = try {
                JSONArray(p.getString("notificationPending","[]") ?: "[]")
            } catch (_: Exception) { JSONArray() }
            val merged = linkedMapOf<String,String>()
            for (i in 0 until pendingBefore.length()) {
                val o = pendingBefore.optJSONObject(i) ?: continue
                val id = o.optString("id")
                if (id.isNotBlank()) merged[id] = o.optString("headline")
            }
            items.filter { it.id !in known && it.sourceID !in hidden && !NewsLogic.matches(it, muted) }
                .forEach { merged[it.id] = it.sourceName + ": " + it.title }
            val out = JSONArray()
            for ((id,headline) in merged.entries.toList().takeLast(5)) out.put(JSONObject().put("id",id).put("headline",headline))
            p.edit().putString("notificationKnown", JSONArray((latest + known).distinct().take(2000)).toString())
                .putString("notificationPending",out.toString()).apply()
            val now = System.currentTimeMillis()
            val sixHours = 6 * 3600_000L
            if (now - p.getLong("lastNotificationAt", 0) < sixHours || out.length() == 0) return@withContext Result.success()
            if (p.getBoolean("quietEnabled", false)) {
                val hour = LocalTime.now().hour
                val start = p.getInt("quietStart",22)
                val end = p.getInt("quietEnd",8)
                if (start == end || (start < end && hour in start until end) ||
                    (start > end && (hour >= start || hour < end))) return@withContext Result.success()
            }
            if (Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                return@withContext Result.success()

            val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(NotificationChannel("stiriro-digest", "Știri RO · la 6 ore", NotificationManager.IMPORTANCE_DEFAULT))
            val headlines = (0 until out.length()).map { out.getJSONObject(it).getString("headline") }.take(5)
            val intent = Intent(applicationContext, MainActivity::class.java)
            val pending = PendingIntent.getActivity(applicationContext, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val body = headlines.joinToString("\n")
            val notice = NotificationCompat.Builder(applicationContext, "stiriro-digest")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(if (headlines.size == 1) "Știre nouă" else headlines.size.toString() + " știri noi")
                .setContentText(headlines.first())
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pending)
                .build()
            manager.notify(108, notice)
            p.edit().putLong("lastNotificationAt", now).putString("notificationPending","[]").apply()
            Result.success()
        } catch (_: Exception) { Result.retry() }
    }

    private fun parseWords(text: String?): List<String> = try {
        val arr = JSONArray(text ?: "[]")
        (0 until arr.length()).map { arr.optString(it) }.filter { it.isNotBlank() }
    } catch (_: Exception) { emptyList() }

    companion object {
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<NotificationWorker>(6, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "stiriro-news-digest", ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}
