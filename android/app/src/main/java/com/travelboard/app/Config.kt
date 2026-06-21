package com.travelboard.app

import android.content.Context

/** App configuration backed by SharedPreferences. */
class Config(context: Context) {
    private val prefs = context.getSharedPreferences("travelboard", Context.MODE_PRIVATE)

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

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_INGEST_KEY = "ingest_key"
        private const val KEY_USERNAME = "username"
    }
}
