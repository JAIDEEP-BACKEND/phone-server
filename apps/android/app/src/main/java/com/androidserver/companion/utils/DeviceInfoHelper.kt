package com.androidserver.companion.utils

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.DisplayMetrics
import android.view.WindowManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.NetworkInterface
import java.util.Collections

object DeviceInfoHelper {

    fun getDeviceInfo(context: Context): JSONObject {
        val json = JSONObject()
        json.put("manufacturer", Build.MANUFACTURER)
        json.put("model", Build.MODEL)
        json.put("androidVersion", Build.VERSION.RELEASE)
        json.put("sdkInt", Build.VERSION.SDK_INT)
        json.put("architecture", Build.SUPPORTED_ABIS.firstOrNull() ?: "aarch64")

        // Display
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
        json.put("screenResolution", "${metrics.widthPixels} x ${metrics.heightPixels}")
        json.put("refreshRateHz", 90)

        // Storage
        val statFs = StatFs(Environment.getExternalStorageDirectory().path)
        val totalBytes = statFs.blockSizeLong * statFs.blockCountLong
        val freeBytes = statFs.blockSizeLong * statFs.availableBlocksLong
        json.put("totalStorageBytes", totalBytes)
        json.put("freeStorageBytes", freeBytes)

        // IP Address
        json.put("ipAddress", getLocalIpAddress())

        return json
    }

    fun getInstalledLaunchableApps(context: Context): JSONArray {
        val array = JSONArray()
        val pm = context.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }

        val resolveInfos = pm.queryIntentActivities(mainIntent, 0)
        for (resolveInfo in resolveInfos) {
            val appInfo = resolveInfo.activityInfo.applicationInfo
            val item = JSONObject()
            item.put("name", resolveInfo.loadLabel(pm).toString())
            item.put("packageName", resolveInfo.activityInfo.packageName)
            item.put("isSystemApp", (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0)
            array.put(item)
        }
        return array
    }

    private fun getLocalIpAddress(): String {
        try {
            val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
            for (intf in interfaces) {
                val addrs = Collections.list(intf.inetAddresses)
                for (addr in addrs) {
                    if (!addr.isLoopbackAddress && addr.hostAddress?.indexOf(':') == -1) {
                        return addr.hostAddress ?: "127.0.0.1"
                    }
                }
            }
        } catch (_: Exception) {}
        return "127.0.0.1"
    }
}
