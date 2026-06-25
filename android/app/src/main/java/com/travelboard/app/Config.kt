package com.travelboard.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** App configuration backed by SharedPreferences. */
class Config(context: Context) {
    private val prefs = context.getSharedPreferences("travelboard", Context.MODE_PRIVATE)

    /** A saved server you can switch between (e.g. Home Wi-Fi vs Tailscale). */
    data class Server(val label: String, val url: String)

    var baseUrl: String
        get() = (prefs.getString(KEY_BASE_URL, "") ?: "").trimEnd('/')
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trim().trimEnd('/')).apply()

    var ingestKey: String
        get() = prefs.getString(KEY_INGEST_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_INGEST_KEY, value.trim()).apply()

    var username: String
        get() = prefs.getString(KEY_USERNAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_USERNAME, value.trim().lowercase()).apply()

    val isConfigured: Boolean
        get() = baseUrl.isNotEmpty() && ingestKey.isNotEmpty() && username.isNotEmpty()

    /**
     * Saved servers for quick switching. If none have been saved yet, seeds from
     * the current [baseUrl] so existing setups keep working after the upgrade.
     */
    var servers: List<Server>
        get() {
            val raw = prefs.getString(KEY_SERVERS, null)
            if (raw.isNullOrBlank()) {
                return if (baseUrl.isNotEmpty()) listOf(Server("Server", baseUrl)) else emptyList()
            }
            return runCatching {
                val arr = JSONArray(raw)
                (0 until arr.length()).map {
                    val o = arr.getJSONObject(it)
                    Server(o.optString("label"), o.optString("url").trimEnd('/'))
                }
            }.getOrDefault(emptyList())
        }
        set(value) {
            val arr = JSONArray()
            value.forEach { arr.put(JSONObject().put("label", it.label).put("url", it.url)) }
            prefs.edit().putString(KEY_SERVERS, arr.toString()).apply()
        }

    /** Add or update a server by label, and make it the active [baseUrl]. */
    fun saveServer(label: String, url: String) {
        val clean = url.trim().trimEnd('/')
        val name = label.trim().ifEmpty { clean }
        servers = servers.filterNot { it.label == name } + Server(name, clean)
        baseUrl = clean
    }

    fun deleteServer(label: String) {
        servers = servers.filterNot { it.label == label }
    }

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_INGEST_KEY = "ingest_key"
        private const val KEY_USERNAME = "username"
        private const val KEY_SERVERS = "servers"
    }
}
