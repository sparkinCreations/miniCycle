package com.sparkincreations.minicycle;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins register BEFORE super.onCreate(), which is when the
        // bridge collects them. SaveAs: the system "Save As" dialog (see
        // SaveAsPlugin.java) — Capacitor's bundled plugins have no way to ask
        // the user where a file should go.
        registerPlugin(SaveAsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
