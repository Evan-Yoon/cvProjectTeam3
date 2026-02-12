package com.team3.walkmate;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.team3.walkmate.NpuTflitePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NpuTflitePlugin.class);
        registerPlugin(NavigationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}