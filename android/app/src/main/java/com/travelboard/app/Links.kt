package com.travelboard.app

/** URL extraction mirroring src/lib/extractUrl.ts (URL_RE) on the server. */
object Links {
    private val URL_RE = Regex(
        "https?://(?:www\\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)",
        RegexOption.IGNORE_CASE,
    )

    /** First http(s) URL found in [text], or null. */
    fun firstUrl(text: String?): String? {
        if (text.isNullOrBlank()) return null
        return URL_RE.find(text)?.value
    }
}
