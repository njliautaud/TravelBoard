package com.travelboard.app

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object Net {
    /** Quick reachability probe — true if the server answers within [timeoutMs]. */
    fun isReachable(baseUrl: String, timeoutMs: Int = 1500): Boolean {
        if (baseUrl.isEmpty()) return false
        return try {
            val conn = (URL("$baseUrl/api/auth/me").openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = timeoutMs
                readTimeout = timeoutMs
            }
            val code = conn.responseCode
            conn.disconnect()
            // Any HTTP response means the server is up (200 logged-out returns {user:null}).
            code in 200..599
        } catch (e: Exception) {
            false
        }
    }

    /**
     * POST a queued share to /api/drafts/ingest (same contract as the WhatsApp bot).
     * Returns true on a 2xx response.
     */
    fun ingest(baseUrl: String, ingestKey: String, username: String, text: String): Boolean {
        return try {
            val conn = (URL("$baseUrl/api/drafts/ingest").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 8000
                readTimeout = 8000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("X-Ingest-Key", ingestKey)
            }
            val body = JSONObject()
                .put("text", text)
                .put("username", username)
                .put("source", "android-share")
                .toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            false
        }
    }
}
