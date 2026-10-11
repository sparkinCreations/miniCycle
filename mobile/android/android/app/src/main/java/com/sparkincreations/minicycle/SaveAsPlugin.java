package com.sparkincreations.minicycle;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * "Save As" for the Android app: the system create-document dialog (Storage
 * Access Framework), so the user picks WHERE a file goes — any folder, Drive,
 * SD card — the way Chrome's "ask where to save" does. The WebView drops
 * <a download> clicks and the bundled Filesystem plugin can only write to fixed
 * directories, so without this the app could never ask.
 *
 * Reached from the web side through capacitorBridge.saveFileAsNative(); it
 * falls back to a Documents write (and then the share sheet) when this plugin
 * is unavailable, e.g. on iOS where it is not registered.
 *
 *   saveFile({ fileName, data, mimeType? }) ->
 *       { saved: true, uri }  the user chose a location and the text was written
 *       { cancelled: true }   the user backed out of the dialog
 *       rejects               the write itself failed
 */
@CapacitorPlugin(name = "SaveAs")
public class SaveAsPlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String data = call.getString("data");
        if (fileName == null || fileName.isEmpty() || data == null) {
            call.reject("fileName and data are required");
            return;
        }
        String mimeType = call.getString("mimeType", "application/json");

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        // The call is retained across the activity round-trip; the text to
        // write travels with it so the result handler has nothing to look up.
        startActivityForResult(call, intent, "onDocumentCreated");
    }

    @ActivityCallback
    private void onDocumentCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject out = new JSObject();
            out.put("cancelled", true);
            call.resolve(out);
            return;
        }
        Uri uri = result.getData().getData();
        String data = call.getString("data");
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (stream == null) {
                call.reject("Could not open the chosen location for writing");
                return;
            }
            stream.write(data.getBytes(StandardCharsets.UTF_8));
            stream.flush();
            JSObject out = new JSObject();
            out.put("saved", true);
            out.put("uri", uri.toString());
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Writing to the chosen location failed: " + e.getMessage(), e);
        }
    }
}
