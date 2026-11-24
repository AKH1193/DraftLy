package com.akh.draftly;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** DraftLy native helpers: printing through Android's print service and opening .docx files from other apps. */
@CapacitorPlugin(name = "DraftlyNative")
public class DraftlyPlugin extends Plugin {
    private JSObject pending;

    @Override
    public void load() {
        handleIntent(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleIntent(intent);
        if (pending != null) bridge.triggerWindowJSEvent("draftlyopenfile");
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action)) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(action)) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;
        try {
            pending = readUri(uri);
            intent.setAction(Intent.ACTION_MAIN);
        } catch (Exception e) {
            pending = null;
        }
    }

    private JSObject readUri(Uri uri) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        String name = "Document.docx";
        try (Cursor c = cr.query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (i >= 0 && c.getString(i) != null) name = c.getString(i);
            }
        } catch (Exception ignored) { }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (InputStream in = cr.openInputStream(uri)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        JSObject o = new JSObject();
        o.put("name", name);
        o.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
        return o;
    }

    @PluginMethod
    public void takePendingFile(PluginCall call) {
        JSObject r = pending != null ? pending : new JSObject();
        pending = null;
        call.resolve(r);
    }

    @PluginMethod
    public void print(PluginCall call) {
        final String name = call.getString("name", "DraftLy document");
        final String size = call.getString("size", "A4");
        final boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = bridge.getWebView().createPrintDocumentAdapter(name);
                PrintAttributes.MediaSize ms;
                switch (size) {
                    case "Letter": ms = PrintAttributes.MediaSize.NA_LETTER; break;
                    case "Legal": ms = PrintAttributes.MediaSize.NA_LEGAL; break;
                    case "A5": ms = PrintAttributes.MediaSize.ISO_A5; break;
                    case "Executive": ms = PrintAttributes.MediaSize.NA_LETTER; break;
                    default: ms = PrintAttributes.MediaSize.ISO_A4;
                }
                if (landscape) ms = ms.asLandscape();
                PrintAttributes attrs = new PrintAttributes.Builder()
                        .setMediaSize(ms)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                pm.print(name, adapter, attrs);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }
}
