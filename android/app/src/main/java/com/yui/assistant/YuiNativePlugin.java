package com.yui.assistant;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraManager;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "YuiNative")
public class YuiNativePlugin extends Plugin {

    private String activeCameraId = null;

    /**
     * Launch target app by package name or common app key
     */
    @PluginMethod
    public void openApp(PluginCall call) {
        String appName = call.getString("appName", "").toLowerCase();
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        Intent launchIntent = null;

        if (appName.contains("whatsapp")) {
            launchIntent = pm.getLaunchIntentForPackage("com.whatsapp");
        } else if (appName.contains("youtube")) {
            launchIntent = pm.getLaunchIntentForPackage("com.google.android.youtube");
        } else if (appName.contains("instagram")) {
            launchIntent = pm.getLaunchIntentForPackage("com.instagram.android");
        } else {
            String packageName = call.getString("packageName", "");
            if (!packageName.isEmpty()) {
                launchIntent = pm.getLaunchIntentForPackage(packageName);
            }
        }

        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(launchIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "App launched successfully");
            call.resolve(ret);
        } else {
            call.reject("App not installed or launch intent unavailable");
        }
    }

    /**
     * Send direct WhatsApp message via API intent
     */
    @PluginMethod
    public void sendWhatsAppMessage(PluginCall call) {
        String phone = call.getString("phoneNumber", "");
        String message = call.getString("message", "");
        Context context = getContext();

        try {
            String cleanPhone = phone.replaceAll("[^0-9]", "");
            Intent intent = new Intent(Intent.ACTION_VIEW);
            String url = "https://api.whatsapp.com/send?phone=" + cleanPhone + "&text=" + Uri.encode(message);
            intent.setData(Uri.parse(url));
            intent.setPackage("com.whatsapp");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "WhatsApp message intent opened");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open WhatsApp: " + e.getMessage());
        }
    }

    /**
     * Start Background Foreground Service to prevent OS kill
     */
    @PluginMethod
    public void startForegroundService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, YuiForegroundService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Foreground service started");
        call.resolve(ret);
    }

    /**
     * Stop Background Foreground Service
     */
    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, YuiForegroundService.class);
        context.stopService(intent);
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("message", "Foreground service stopped");
        call.resolve(ret);
    }

    /**
     * Retrieve recent incoming notifications stored by NotificationListener
     */
    @PluginMethod
    public void getRecentNotifications(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("notifications", YuiNotificationListenerService.getRecentNotifications());
        call.resolve(ret);
    }

    /**
     * Make direct phone call
     */
    @PluginMethod
    public void makePhoneCall(PluginCall call) {
        String number = call.getString("phoneNumber", "");
        Context context = getContext();
        try {
            Intent callIntent = new Intent(Intent.ACTION_CALL);
            callIntent.setData(Uri.parse("tel:" + number.replaceAll("[^0-9+]", "")));
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(callIntent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to place call: " + e.getMessage());
        }
    }

    /**
     * Toggle hardware camera flashlight
     */
    @PluginMethod
    public void toggleFlashlight(PluginCall call) {
        boolean enable = call.getBoolean("enable", true);
        Context context = getContext();
        CameraManager cameraManager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);

        try {
            if (activeCameraId == null && cameraManager != null) {
                String[] cameraIds = cameraManager.getCameraIdList();
                if (cameraIds.length > 0) {
                    activeCameraId = cameraIds[0];
                }
            }

            if (cameraManager != null && activeCameraId != null) {
                cameraManager.setTorchMode(activeCameraId, enable);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("enabled", enable);
                call.resolve(ret);
            } else {
                call.reject("Camera manager or camera ID unavailable");
            }
        } catch (CameraAccessException e) {
            call.reject("Camera access error: " + e.getMessage());
        }
    }
}
