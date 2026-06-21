package com.travelboard.app

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Append-only queue of shares awaiting delivery while the server is unreachable
 * (e.g. phone away from the home Wi-Fi). Stored as JSON lines in app storage.
 */
class Outbox(context: Context) {
    private val file = File(context.filesDir, "outbox.jsonl")

    @Synchronized
    fun add(text: String, url: String?) {
        val obj = JSONObject()
            .put("text", text)
            .put("url", url ?: JSONObject.NULL)
            .put("ts", System.currentTimeMillis())
        file.appendText(obj.toString() + "\n")
    }

    @Synchronized
    fun readAll(): List<JSONObject> {
        if (!file.exists()) return emptyList()
        return file.readLines()
            .filter { it.isNotBlank() }
            .mapNotNull { runCatching { JSONObject(it) }.getOrNull() }
    }

    /** Replace the queue with [remaining] (items that still need delivery). */
    @Synchronized
    fun rewrite(remaining: List<JSONObject>) {
        if (remaining.isEmpty()) {
            file.delete()
        } else {
            file.writeText(remaining.joinToString("\n") { it.toString() } + "\n")
        }
    }
}
