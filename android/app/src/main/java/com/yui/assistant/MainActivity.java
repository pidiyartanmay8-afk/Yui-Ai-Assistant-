package com.yui.assistant;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugin for Yui Assistant native features
        registerPlugin(YuiNativePlugin.class);
        super.onCreate(savedInstanceState);

        // Configure WebView settings & WebChromeClient to grant web permissions contextually
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);

            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    // Grant audio and video permission requests initiated by the Render Web App contextually
                    runOnUiThread(() -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            String[] resources = request.getResources();
                            boolean needAudio = false;
                            boolean needVideo = false;

                            for (String res : resources) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) needAudio = true;
                                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) needVideo = true;
                            }

                            boolean audioOk = !needAudio || ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
                            boolean videoOk = !needVideo || ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;

                            if (!audioOk || !videoOk) {
                                java.util.List<String> toReq = new java.util.ArrayList<>();
                                if (needAudio && !audioOk) toReq.add(Manifest.permission.RECORD_AUDIO);
                                if (needVideo && !videoOk) toReq.add(Manifest.permission.CAMERA);
                                ActivityCompat.requestPermissions(MainActivity.this, toReq.toArray(new String[0]), 8001);
                            }

                            request.grant(resources);
                        }
                    });
                }
            });
        }
    }
}
