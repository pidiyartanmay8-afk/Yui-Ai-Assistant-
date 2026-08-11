package com.yui.assistant;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.util.ArrayList;
import java.util.List;

/**
 * YuiNotificationListenerService
 * Native Android Notification Listener to read incoming WhatsApp and SMS messages.
 */
public class YuiNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "YuiNotificationService";
    private static final List<JSObject> notificationHistory = new ArrayList<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if ("com.whatsapp".equals(packageName) || "com.google.android.apps.messaging".equals(packageName) || "com.instagram.android".equals(packageName)) {
            CharSequence title = sbn.getNotification().extras.getCharSequence("android.title");
            CharSequence text = sbn.getNotification().extras.getCharSequence("android.text");

            if (title != null && text != null) {
                JSObject item = new JSObject();
                item.put("packageName", packageName);
                item.put("sender", title.toString());
                item.put("text", text.toString());
                item.put("timestamp", System.currentTimeMillis());

                synchronized (notificationHistory) {
                    notificationHistory.add(0, item);
                    if (notificationHistory.size() > 50) {
                        notificationHistory.remove(notificationHistory.size() - 1);
                    }
                }

                Log.d(TAG, "Notification received from " + packageName + " | Sender: " + title + " | Message: " + text);
            }
        }
    }

    public static JSArray getRecentNotifications() {
        JSArray arr = new JSArray();
        synchronized (notificationHistory) {
            for (JSObject obj : notificationHistory) {
                arr.put(obj);
            }
        }
        return arr;
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Notification dismissed
    }
}
