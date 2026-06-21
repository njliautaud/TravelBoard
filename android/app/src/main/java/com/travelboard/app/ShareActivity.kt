package com.travelboard.app

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * No-UI router for the Android share sheet. Online → open the prefilled New Wish
 * form in MainActivity. Offline → queue the link and post it to the Inbox later.
 */
class ShareActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val shared = readSharedText(intent)
        if (shared.isNullOrBlank()) {
            toast("Nothing to share")
            finish()
            return
        }

        val config = Config(this)
        if (!config.isConfigured) {
            toast("Set up TravelBoard first")
            startActivity(
                Intent(this, SettingsActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            finish()
            return
        }

        lifecycleScope.launch {
            val reachable = withContext(Dispatchers.IO) { Net.isReachable(config.baseUrl) }
            val url = Links.firstUrl(shared)
            if (reachable) {
                startActivity(
                    Intent(this@ShareActivity, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        .putExtra(MainActivity.EXTRA_SHARE_URL, url ?: shared)
                        .putExtra(MainActivity.EXTRA_SHARE_TEXT, shared)
                )
            } else {
                Outbox(this@ShareActivity).add(shared, url)
                SyncWorker.enqueue(this@ShareActivity)
                toast("Saved — will add to your Inbox when you're home")
            }
            finish()
        }
    }

    private fun readSharedText(intent: Intent?): String? {
        if (intent?.action != Intent.ACTION_SEND) return null
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
        return listOfNotNull(text, subject).joinToString("\n").ifBlank { null }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}
