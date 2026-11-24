"""Run after `npx cap add android`: adds DraftLy's native plugin, .docx file opening and the Capacitor JS runtime."""
import glob, os, re, shutil, sys

root = os.path.dirname(os.path.abspath(__file__))
proj = os.path.join(root, '..')

# 1. native plugin + register it in MainActivity
main = glob.glob(os.path.join(proj, 'android/app/src/main/java/**/MainActivity.java'), recursive=True)
if not main:
    sys.exit('MainActivity.java not found')
main = main[0]
shutil.copy(os.path.join(root, 'android/DraftlyPlugin.java'), os.path.join(os.path.dirname(main), 'DraftlyPlugin.java'))
src = open(main).read()
pkg = re.search(r'package\s+([\w.]+);', src).group(1)
open(main, 'w').write(f'''package {pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {{
    @Override
    public void onCreate(Bundle savedInstanceState) {{
        registerPlugin(DraftlyPlugin.class);
        super.onCreate(savedInstanceState);
    }}
}}
''')
plugin = os.path.join(os.path.dirname(main), 'DraftlyPlugin.java')
p = open(plugin).read().replace('package com.akh.draftly;', f'package {pkg};')
open(plugin, 'w').write(p)

# 2. "Open with DraftLy" for Word documents
mf = os.path.join(proj, 'android/app/src/main/AndroidManifest.xml')
m = open(mf).read()
docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
filters = f'''
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="content" android:mimeType="{docx}" />
                <data android:scheme="file" android:mimeType="{docx}" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="{docx}" />
            </intent-filter>
'''
if docx not in m:
    i = m.index('</activity>')
    m = m[:i] + filters + '        ' + m[i:]
    open(mf, 'w').write(m)

# 3. Capacitor JS runtime so the web code can call native plugins
core = os.path.join(proj, 'node_modules/@capacitor/core/dist/capacitor.js')
www = os.path.join(proj, 'android/app/src/main/assets/public')
if os.path.exists(core) and os.path.isdir(www):
    shutil.copy(core, os.path.join(www, 'js/capacitor.js'))
    idx = os.path.join(www, 'index.html')
    h = open(idx).read()
    if 'js/capacitor.js' not in h:
        h = h.replace('<script src="js/icons.js"></script>', '<script src="js/capacitor.js"></script>\n<script src="js/icons.js"></script>')
        open(idx, 'w').write(h)
print('Android project patched for DraftLy')
