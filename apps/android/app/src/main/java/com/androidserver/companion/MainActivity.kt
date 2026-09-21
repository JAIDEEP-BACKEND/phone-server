package com.androidserver.companion

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.androidserver.companion.service.CompanionForegroundService
import com.androidserver.companion.service.ScreenCaptureService
import com.androidserver.companion.utils.CapabilityDetector

class MainActivity : AppCompatActivity() {

    private lateinit var tvStatusAccessibility: TextView
    private lateinit var tvStatusScreen: TextView
    private lateinit var tvStatusStorage: TextView
    private lateinit var tvStatusNotification: TextView
    private lateinit var etServerUrl: EditText

    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
                action = ScreenCaptureService.ACTION_START
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.resultCode)
                putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, result.data)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            updateUiStatus()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatusAccessibility = findViewById(R.id.tvStatusAccessibility)
        tvStatusScreen = findViewById(R.id.tvStatusScreen)
        tvStatusStorage = findViewById(R.id.tvStatusStorage)
        tvStatusNotification = findViewById(R.id.tvStatusNotification)
        etServerUrl = findViewById(R.id.etServerUrl)

        findViewById<Button>(R.id.btnAccessibility).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        findViewById<Button>(R.id.btnScreenCapture).setOnClickListener {
            val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            screenCaptureLauncher.launch(mpm.createScreenCaptureIntent())
        }

        findViewById<Button>(R.id.btnStorage).setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            }
        }

        findViewById<Button>(R.id.btnNotification).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        findViewById<Button>(R.id.btnBattery).setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                startActivity(intent)
            }
        }

        findViewById<Button>(R.id.btnConnect).setOnClickListener {
            val url = etServerUrl.text.toString().trim()
            if (url.isNotEmpty()) {
                CompanionForegroundService.serverUrl = url
            }
            val intent = Intent(this, CompanionForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
            updateUiStatus()
        }
    }

    override fun onResume() {
        super.onResume()
        updateUiStatus()
    }

    private fun updateUiStatus() {
        val isA11y = CapabilityDetector.isAccessibilityEnabled(this)
        tvStatusAccessibility.text = if (isA11y) "ACTIVE" else "REQUIRED"
        tvStatusAccessibility.setTextColor(if (isA11y) 0xFF22C55E.toInt() else 0xFFEF4444.toInt())

        val isScreen = ScreenCaptureService.isRunning
        tvStatusScreen.text = if (isScreen) "STREAMING" else "IDLE"
        tvStatusScreen.setTextColor(if (isScreen) 0xFF22C55E.toInt() else 0xFF888888.toInt())

        val isStorage = CapabilityDetector.isStorageAccessGranted()
        tvStatusStorage.text = if (isStorage) "GRANTED" else "REQUIRED"
        tvStatusStorage.setTextColor(if (isStorage) 0xFF22C55E.toInt() else 0xFFEF4444.toInt())

        val isNotif = CapabilityDetector.isNotificationAccessGranted(this)
        tvStatusNotification.text = if (isNotif) "GRANTED" else "OPTIONAL"
        tvStatusNotification.setTextColor(if (isNotif) 0xFF22C55E.toInt() else 0xFF888888.toInt())
    }
}
