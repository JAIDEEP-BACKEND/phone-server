package com.androidserver.companion.service

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

class NotificationMonitorService : NotificationListenerService() {

    companion object {
        var instance: NotificationMonitorService? = null
            private set
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
        syncNotifications()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        syncNotifications()
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        syncNotifications()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
    }

    fun syncNotifications() {
        try {
            val sbns = activeNotifications ?: return
            val array = JSONArray()

            for (sbn in sbns) {
                val extras = sbn.notification.extras
                val title = extras?.getCharSequence("android.title")?.toString() ?: ""
                val text = extras?.getCharSequence("android.text")?.toString() ?: ""

                if (title.isNotEmpty() || text.isNotEmpty()) {
                    val item = JSONObject()
                    item.put("id", sbn.id.toString())
                    item.put("key", sbn.key)
                    item.put("packageName", sbn.packageName)
                    item.put("title", title)
                    item.put("text", text)
                    item.put("postTime", sbn.postTime)
                    item.put("isClearable", sbn.isClearable)
                    array.put(item)
                }
            }

            CompanionForegroundService.instance?.sendNotificationsList(array)
        } catch (_: Exception) {}
    }
}
