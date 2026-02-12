package com.team3.walkmate;

import android.content.Intent;
import android.location.Address;
import android.location.Geocoder;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "Navigation")
public class NavigationPlugin extends Plugin {

    private static final String TAG = "NavigationPlugin";

    @PluginMethod
    public void startNavigation(PluginCall call) {
        String destination = call.getString("destination");
        if (destination == null || destination.isEmpty()) {
            call.reject("Destination is required");
            return;
        }

        Geocoder geocoder = new Geocoder(getContext(), Locale.getDefault());
        try {
            List<Address> addresses = geocoder.getFromLocationName(destination, 1);
            if (addresses == null || addresses.isEmpty()) {
                call.reject("Could not find location for: " + destination);
                return;
            }

            Address address = addresses.get(0);
            double lat = address.getLatitude();
            double lng = address.getLongitude();

            Log.i(TAG, "Navigating to: " + destination + " (" + lat + ", " + lng + ")");

            // Google Maps Walking Navigation Intent
            Uri gmmIntentUri = Uri.parse("google.navigation:q=" + lat + "," + lng + "&mode=w");
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");

            if (mapIntent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(mapIntent);
                JSObject ret = new JSObject();
                ret.put("status", "launched");
                call.resolve(ret);
            } else {
                call.reject("Google Maps app is not installed");
            }

        } catch (IOException e) {
            Log.e(TAG, "Geocoder error", e);
            call.reject("Geocoder error: " + e.getMessage());
        }
    }
}
