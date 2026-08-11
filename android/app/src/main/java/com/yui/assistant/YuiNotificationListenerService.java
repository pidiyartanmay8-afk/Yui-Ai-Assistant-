package com.yui.assistant;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

/**
 * YuiNotificationListenerService
 * Native Android Notification Listener to read incoming WhatsApp and SMS messages.
 */
public class YuiNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "YuiNotificationService";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if ("com.whatsapp".equals(packageName) || "com.google.android.apps.messaging".equals(packageName)) {
            CharSequence title = sbn.getNotification().extras.getCharSequence("android.title");
            CharSequence text = sbn.getNotification().extras.getCharSequence("android.text");

            Log.d(TAG, "Incoming Message from " + packageName + " | Sender: " + title + " | Message: " + text);
            // Can trigger a local broadcast or Capacitor JS event here
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Notification dismissed
    }
}
