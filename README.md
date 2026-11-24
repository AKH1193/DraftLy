# DraftLy

A full word processor that runs on your MacBook, iPhone, iPad and Android phone. It opens and saves real Microsoft Word (.docx) files, and syncs your documents across all of them in real time.

## What it does

| Area | Features |
|---|---|
| **Home** | Fonts and sizes, bold/italic/underline/strike, sub/superscript, highlight and font colour, change case, clear formatting, Format Painter, bullets, numbering (1. / (a) / (i) / A. / I. and more), multilevel lists, indents, alignment, line and paragraph spacing, shading, Styles gallery, Find & Replace, Dictate (voice typing) |
| **Insert** | Page break, tables, pictures (resize by dragging), horizontal line, links, comments, header, footer, page numbers (Page X of Y), date & time, signature line, symbols (₹ § ¶ etc.) |
| **Design** | Style sets (Default, Legal, Classic, Modern, Compact), document font, paragraph spacing presets, watermark (DRAFT, CONFIDENTIAL, WITHOUT PREJUDICE…), page colour |
| **Layout** | Margins (including court filing and letterhead presets), orientation, paper size (A4, Letter, Legal, A5, Executive), columns, breaks, exact indent and spacing |
| **References** | Table of contents (click to update), footnotes |
| **Review** | Spelling, word count, language, comments with replies and resolve, **Track Changes** with Accept/Reject (single or all), markup views (All / Simple / No Markup / Original), Reviewing pane, change user name, Restrict Editing |
| **View** | Read Mode, Print Layout (real pages), Web Layout, Focus, Full Screen, ruler, gridlines, navigation pane, zoom, dark mode, formatting marks |
| **File** | New from templates (your letterhead, legal notice, agreement, affidavit, letter, report), open .docx/.html/.txt/.md, save as .docx, **Save as PDF** (exact pages, searchable text), **convert any Word file to PDF**, export HTML/TXT, print, share, save folder, document info, recent documents, sync, options |

Word compatibility: tracked changes, comments, footnotes, headers/footers with page fields, watermark, tables (merged cells, shading), numbered lists (continuing numbering), images, TOC, page size and margins all survive the round trip to and from Microsoft Word.

Quick buttons in the title bar: Save, Undo, Redo, Print, Save as PDF.

Keyboard shortcuts (⌘ on Mac, Ctrl elsewhere): B/I/U, E/L/R/J alignment, K link, S save, Shift+S save as, O open, P print, F find, Shift+H replace, Z/Y undo/redo, Enter page break, Shift+> / < font size, Alt+1/2/3 headings, Shift+E track changes, Alt+M comment, Tab/Shift+Tab list levels and table cells.

## 1. Put it online (once, about 5 minutes)

1. On github.com, create a new repository named `draftly` (it can be private if you have GitHub Pro; otherwise public; your documents are **never** stored in the repository).
2. Upload everything in this folder (drag the files into "Add file › Upload files"). Make sure the hidden `.github` folder is included; on a Mac press ⌘⇧. in Finder to show it.
3. In the repository, open **Settings › Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for "Publish DraftLy" to finish (green tick). Your app is now at `https://akh1193.github.io/draftly/`.

## 2. Install it on each device

### MacBook (use Google Chrome, not Safari)
1. Open `https://akh1193.github.io/draftly/` in **Chrome** and click the **Install** icon at the right end of the address bar (or ⋮ › Cast, save and share › Install page as app). DraftLy gets its own Dock icon and window.
2. **Make DraftLy the default for Word files:** in Finder, select any `.docx` › **File › Get Info** (⌘I) › **Open with:** choose **DraftLy** › click **Change All…**. Double-clicking a .docx now opens it in DraftLy; the first time, Chrome asks once to allow DraftLy to open the file.
3. **Save folder:** the first time you Save (⌘S) or Save as PDF, choose your **Documents** folder (or a "DraftLy" folder inside it). From then on every .docx and PDF goes there automatically, and files you keep working on are kept up to date in that folder. You can change it in **File › Save**.
   A file you opened from Finder is saved back into the same file, as in Word.

(Safari's "Add to Dock" also works, but Apple doesn't let those apps become the default .docx opener or write into Documents; their files go to Downloads.)

### Android (Samsung S24 Ultra, OPPO)
Use the APK for the full experience: **GitHub › Actions › Build Android APK › Run workflow**, download **DraftLy-apk** from the finished run, and install it.
- **Default opener:** open any .docx from My Files, WhatsApp or Gmail, choose **DraftLy**, then **Always**.
- **Print:** uses Android's own print service (any printer or "Save as PDF").
- **Saved files** go to **Documents › DraftLy** on the phone.

### iPhone / iPad
Open the link in **Safari › Share › Add to Home Screen**.
- **Print:** DraftLy prepares the exact pages and opens the share sheet; tap **Print** there (Apple blocks the normal print button inside Home Screen apps).
- **Save / Save as PDF:** opens the share sheet; choose **Save to Files**.
- **Default opener:** Apple only allows App Store or Xcode-built apps to receive "Open in…" for .docx files. To open a .docx from Files or WhatsApp, share it to yourself and use **File › Open** in DraftLy. (A native iPhone/iPad build can be added later; it needs Xcode on your Mac and an Apple developer account for permanent installs.)

The app works offline once opened. Updates you push to GitHub reach every device automatically.

## 3. Turn on real-time sync (once, about 10 minutes)

DraftLy syncs through your own free Firebase project, so your documents stay in your Google account and nobody else can read them.

1. Go to <https://console.firebase.google.com>, **Create a project** named `draftly` (Analytics not needed).
2. **Build › Authentication › Get started › Email/Password › Enable › Save.**
3. **Build › Realtime Database › Create database**, location **Singapore**, start in **locked mode**.
4. In the database's **Rules** tab, paste this and **Publish**:
   ```json
   { "rules": { "users": { "$uid": {
     ".read": "auth != null && auth.uid === $uid",
     ".write": "auth != null && auth.uid === $uid" } } } }
   ```
5. Copy the database URL from the **Data** tab (looks like `https://draftly-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app`).
6. **Project settings (gear) › Your apps › Web (</>)**, register "DraftLy", copy the `apiKey`.
7. In DraftLy on your Mac: **File › Sync & Devices**, paste the API key and URL, enter your email and a password, tap **Create account**.
8. On the same page tap **Send setup link** and open it on your iPhone, iPad and Android. Each device then only needs your password.

Edits appear on your other open devices within a second or two. Offline edits are kept on the device and sync when you reconnect. If the same document is changed on two devices at the same moment, DraftLy keeps your version as a "conflict copy" so nothing is lost.

The free Firebase plan (1 GB stored, 10 GB downloaded per month) is plenty for documents. Documents with many large pictures use more.

## Limits to know

- Old binary `.doc` files can't be opened. Save them as `.docx` in Word or Google Docs first.
- Formatting-only changes (bold, font) are applied but not recorded as tracked changes. Paragraph splits/merges are not tracked. Insertions and deletions are.
- A very long single paragraph or a very long table row that is taller than a page is not split across pages on screen.
- Footnotes appear at the end of the document on screen and in print; in the exported .docx they are real Word footnotes at the bottom of each page.
- Watermarks export to Word; page colour exports; multi-column sections export as Word section columns.
- PDFs made with Save as PDF are exact page images with a hidden searchable text layer (you can search, select and copy). For a PDF whose text is drawn as vector type, use Print › "Save as PDF" in the Mac print dialog.

## Files

`index.html` app shell · `css/app.css` styles · `js/core.js` pages, layout, undo, storage · `js/ui.js` editing commands and dialogs · `js/ribbon.js` ribbon tabs · `js/review.js` track changes and comments · `js/docx-export.js` / `js/docx-import.js` Word file engine · `js/pdf.js` Save as PDF · `js/zip.js` zip reader/writer · `js/sync.js` real-time sync · `js/file.js` files, templates, backstage, startup · `sw.js` offline cache · `native/` Android printing and Open-with support · `.github/workflows` publishing and Android build.
