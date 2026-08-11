package com.yui.assistant;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom Capacitor plugin for Yui Assistant native features
        registerPlugin(YuiNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
