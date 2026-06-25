package com.travelboard.app

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * No-UI router for the Android share sheet. Opens the prefilled "Add a place"
 * form in MainActivity so the user can finish the details and save it as a wish.
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

        val url = Links.firstUrl(shared)
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(MainActivity.EXTRA_SHARE_URL, url ?: shared)
                .putExtra(MainActivity.EXTRA_SHARE_TEXT, shared)
        )
        finish()
    }

    private fun readSharedText(intent: Intent?): String? {
        if (intent?.action != Intent.ACTION_SEND) return null
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
        return listOfNotNull(text, subject).joinToString("\n").ifBlank { null }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
}
