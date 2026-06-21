package com.travelboard.app

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/** First-run / editable config: server URL, username, ingest key. */
class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val config = Config(this)
        val baseUrl = findViewById<EditText>(R.id.base_url)
        val username = findViewById<EditText>(R.id.username)
        val ingestKey = findViewById<EditText>(R.id.ingest_key)
        val save = findViewById<Button>(R.id.save)

        baseUrl.setText(config.baseUrl)
        username.setText(config.username)
        ingestKey.setText(config.ingestKey)

        save.setOnClickListener {
            val url = baseUrl.text.toString().trim()
            val user = username.text.toString().trim()
            val key = ingestKey.text.toString().trim()
            if (url.isEmpty() || user.isEmpty() || key.isEmpty()) {
                Toast.makeText(this, "All fields are required", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            config.baseUrl = url
            config.username = user
            config.ingestKey = key
            Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show()
            startActivity(
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            )
            finish()
        }
    }
}
