package com.team3.walkmate;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NpuTflitePlugin.class);
        super.onCreate(savedInstanceState);
    }
}