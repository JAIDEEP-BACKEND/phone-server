package com.androidserver.companion.utils

import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.Environment
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils
import com.androidserver.companion.service.NotificationMonitorService
import com.androidserver.companion.service.RemoteAccessibilityService
import org.json.JSONObject
import java.io.File

object CapabilityDetector {

    fun isAccessibilityEnabled(context: Context): Boolean {
        val expectedComponentName = ComponentName(context, RemoteAccessibilityService::class.java)
        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false

        val colonSplitter = TextUtils.SimpleStringSplitter(':')
        colonSplitter.setString(enabledServices)

        while (colonSplitter.hasNext()) {
            val componentNameString = colonSplitter.next()
            val enabledComponent = ComponentName.unflattenFromString(componentNameString)
            if (enabledComponent != null && enabledComponent == expectedComponentName) {
                return true
            }
        }
        return false
    }

    fun isNotificationAccessGranted(context: Context): Boolean {
        val packageName = context.packageName
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
        return flat?.contains(packageName) == true
    }

    fun isStorageAccessGranted(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            Environment.getExternalStorageState() == Environment.MEDIA_MOUNTED
        }
    }

    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        return pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    fun hasRoot(): Boolean {
        val paths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        )
        return paths.any { File(it).exists() }
    }

    fun getCapabilitiesJson(context: Context, isScreenCaptureRunning: Boolean): JSONObject {
        val json = JSONObject()
        json.put("screenCapture", if (isScreenCaptureRunning) "READY" else "REQUIRED")
        json.put("accessibility", if (isAccessibilityEnabled(context)) "READY" else "REQUIRED")
        json.put("storage", if (isStorageAccessGranted()) "READY" else "REQUIRED")
        json.put("notifications", if (isNotificationAccessGranted(context)) "READY" else "REQUIRED")
        json.put("camera", "REQUIRED")
        json.put("microphone", "REQUIRED")
        json.put("root", if (hasRoot()) "READY" else "UNAVAILABLE")
        return json
    }
}
