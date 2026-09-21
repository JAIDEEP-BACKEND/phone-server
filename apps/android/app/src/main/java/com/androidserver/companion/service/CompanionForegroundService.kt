package com.androidserver.companion.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.androidserver.companion.utils.CapabilityDetector
import com.androidserver.companion.utils.DeviceInfoHelper
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CompanionForegroundService : Service() {

    companion object {
        var instance: CompanionForegroundService? = null
            private set

        const val CHANNEL_ID = "companion_service_channel"
        const val NOTIFICATION_ID = 2001

        var serverUrl = "ws://127.0.0.1:3001"
        var companionSecret = "companion-pairing-secret-key"
    }

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var statusJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification("Connecting to local NAS console..."))
        connectWebSocket()
        startPeriodicStatusSync()
    }

    private fun connectWebSocket() {
        val request = Request.Builder()
            .url(serverUrl)
            .addHeader("x-companion-secret", companionSecret)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                updateNotification("Linked to local server console")
                syncAllCapabilities()
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleServerCommand(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                updateNotification("Attempting reconnect to $serverUrl...")
                CoroutineScope(Dispatchers.IO).launch {
                    delay(5000)
                    connectWebSocket()
                }
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                updateNotification("Disconnected from server")
            }
        })
    }

    private fun handleServerCommand(message: String) {
        try {
            val json = JSONObject(message)
            val action = json.optString("action")

            when (action) {
                "device:touch_down", "device:touch_up" -> {
                    val x = json.optDouble("x", 0.5).toFloat()
                    val y = json.optDouble("y", 0.5).toFloat()
                    RemoteAccessibilityService.instance?.dispatchTap(x, y)
                }
                "device:gesture_swipe" -> {
                    val startX = json.optDouble("startX", 0.5).toFloat()
                    val startY = json.optDouble("startY", 0.8).toFloat()
                    val endX = json.optDouble("endX", 0.5).toFloat()
                    val endY = json.optDouble("endY", 0.2).toFloat()
                    val duration = json.optLong("durationMs", 300)
                    RemoteAccessibilityService.instance?.dispatchSwipe(startX, startY, endX, endY, duration)
                }
                "device:nav_action" -> {
                    when (json.optString("nav")) {
                        "back" -> RemoteAccessibilityService.instance?.performBack()
                        "home" -> RemoteAccessibilityService.instance?.performHome()
                        "recents" -> RemoteAccessibilityService.instance?.performRecents()
                        "lock" -> RemoteAccessibilityService.instance?.performLock()
                    }
                }
                "device:volume_action" -> {
                    val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
                    when (json.optString("volume")) {
                        "up" -> audioManager.adjustVolume(AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                        "down" -> audioManager.adjustVolume(AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                        "mute" -> audioManager.adjustVolume(AudioManager.ADJUST_TOGGLE_MUTE, AudioManager.FLAG_SHOW_UI)
                    }
                }
                "device:launch_app" -> {
                    val pkg = json.optString("packageName")
                    if (pkg.isNotEmpty()) {
                        val launchIntent = packageManager.getLaunchIntentForPackage(pkg)
                        if (launchIntent != null) {
                            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(launchIntent)
                        }
                    }
                }
                "device:set_clipboard" -> {
                    val text = json.optString("text")
                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("server", text))
                }
                "device:get_clipboard" -> {
                    val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = clipboard.primaryClip
                    if (clip != null && clip.itemCount > 0) {
                        val text = clip.getItemAt(0).text?.toString() ?: ""
                        sendClipboardText(text)
                    }
                }
            }
        } catch (_: Exception) {}
    }

    fun sendScreenFrame(base64Data: String, width: Int, height: Int) {
        val json = JSONObject()
        json.put("event", "companion:screen_frame")
        val data = JSONObject()
        data.put("data", base64Data)
        data.put("width", width)
        data.put("height", height)
        data.put("fps", 30)
        json.put("payload", data)
        webSocket?.send(json.toString())
    }

    fun sendNotificationsList(array: JSONArray) {
        val json = JSONObject()
        json.put("event", "companion:notifications")
        json.put("payload", array)
        webSocket?.send(json.toString())
    }

    private fun sendClipboardText(text: String) {
        val json = JSONObject()
        json.put("event", "companion:clipboard")
        json.put("payload", text)
        webSocket?.send(json.toString())
    }

    private fun syncAllCapabilities() {
        val caps = CapabilityDetector.getCapabilitiesJson(this, ScreenCaptureService.isRunning)
        val json = JSONObject()
        json.put("event", "companion:status")
        json.put("payload", caps)
        webSocket?.send(json.toString())

        // Send installed apps
        val apps = DeviceInfoHelper.getInstalledLaunchableApps(this)
        val appsJson = JSONObject()
        appsJson.put("event", "companion:installed_apps")
        appsJson.put("payload", apps)
        webSocket?.send(appsJson.toString())
    }

    private fun startPeriodicStatusSync() {
        statusJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                delay(3000)
                syncAllCapabilities()
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Companion Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(status: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("OPPO Server Companion Active")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(status: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, createNotification(status))
    }

    override fun onDestroy() {
        statusJob?.cancel()
        webSocket?.close(1000, "Service destroyed")
        instance = null
        super.onDestroy()
    }
}
