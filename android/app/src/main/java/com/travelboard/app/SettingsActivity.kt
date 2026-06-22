package com.travelboard.app

import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/** First-run / editable config: saved servers, username, ingest key. */
class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val config = Config(this)
        val picker = findViewById<AutoCompleteTextView>(R.id.server_picker)
        val label = findViewById<EditText>(R.id.server_label)
        val baseUrl = findViewById<EditText>(R.id.base_url)
        val username = findViewById<EditText>(R.id.username)
        val ingestKey = findViewById<EditText>(R.id.ingest_key)
        val save = findViewById<Button>(R.id.save)
        val delete = findViewById<Button>(R.id.delete)

        username.setText(config.username)
        ingestKey.setText(config.ingestKey)
        baseUrl.setText(config.baseUrl)
        label.setText(config.servers.firstOrNull { it.url == config.baseUrl }?.label ?: "")

        // Populate the dropdown; picking an entry fills the label + URL fields.
        fun refreshPicker() {
            val servers = config.servers
            picker.setAdapter(
                ArrayAdapter(
                    this,
                    android.R.layout.simple_list_item_1,
                    servers.map { "${it.label} — ${it.url}" },
                )
            )
            picker.setOnItemClickListener { _, _, pos, _ ->
                label.setText(servers[pos].label)
                baseUrl.setText(servers[pos].url)
            }
        }
        refreshPicker()

        save.setOnClickListener {
            val url = baseUrl.text.toString().trim()
            val user = username.text.toString().trim()
            val key = ingestKey.text.toString().trim()
            if (url.isEmpty() || user.isEmpty() || key.isEmpty()) {
                Toast.makeText(this, "Server URL, username and key are required", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            config.saveServer(label.text.toString(), url)
            config.username = user
            config.ingestKey = key
            Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show()
            startActivity(
                Intent(this, MainActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            )
            finish()
        }

        delete.setOnClickListener {
            val name = label.text.toString().trim()
            if (name.isEmpty() || config.servers.none { it.label == name }) {
                Toast.makeText(this, "Pick a saved server to delete", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            config.deleteServer(name)
            label.text.clear()
            picker.text.clear()
            refreshPicker()
            Toast.makeText(this, "Removed $name", Toast.LENGTH_SHORT).show()
        }
    }
}
