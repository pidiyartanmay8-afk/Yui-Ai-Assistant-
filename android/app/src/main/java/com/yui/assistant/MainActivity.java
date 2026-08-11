package com.yui.assistant;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(YuiNativePlugin.class);
        super.onCreate(savedInstanceState);

        // App khulte hi Phone screen par Microphone & Camera ka popup laane ke liye
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) 
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this, 
                new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA}, 
                101
            );
        }
    }
}
