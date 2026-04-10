# The Atelier — Premium PDF Reader

The Atelier is an elegant, serverless PDF reader that runs entirely in the browser. No installation or account is required; all documents are stored locally on the device using IndexedDB.

---

## Features

| Feature | Description |
|---|---|
| Personal library | Upload and manage PDFs from a gallery-style interface |
| Built-in reader | High-quality rendering powered by PDF.js |
| Reading progress | Remembers the last page read and shows the completion percentage |
| Adjustable zoom | Control zoom level inside the viewer and set a default zoom |
| Free draw (Pencil) | Annotate directly on the page with stroke-by-stroke undo |
| Text-to-speech (TTS) | Reads the current page aloud using the browser's native speech synthesis |
| Per-page notes | Add, view, and delete notes linked to each page of a document |
| Dark mode | Persistent light/dark theme stored in `localStorage` |
| Document management | Delete individual PDFs or clear the entire library from Settings |
| Progress reset | Reset reading progress for all documents in one click |

---

## Getting started

### Requirements

A modern browser (Chrome, Edge, Firefox, Safari) is all you need. There are no dependencies to install.

### Run locally

1. Clone or download the repository:
   ```bash
   git clone https://github.com/zbrau/The-Atelier.git
   cd The-Atelier
   ```
2. Open `index.html` directly in your browser, or serve it with any static file server:
   ```bash
   # Python
   python -m http.server 8080

   # Node.js
   npx serve .
   ```
3. Visit `http://localhost:8080` in your browser.

### Upload a PDF

Click **Upload PDF** in the sidebar or drag a file onto the upload area on the Dashboard. The file is saved to the browser's local storage (IndexedDB) and is never sent to any server.

---

## Project structure

```
The-Atelier/
├── index.html   # HTML structure and Tailwind configuration
├── main.js      # Application logic (IndexedDB, PDF.js, TTS, notes, drawing)
└── style.css    # Custom styles and dark mode overrides
```

---

## Technologies

- **[PDF.js](https://mozilla.github.io/pdf.js/)** `v3.11.174` — canvas-based PDF rendering
- **[Tailwind CSS](https://tailwindcss.com/)** (CDN) — utility-first styles with a custom Material You theme
- **[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)** — native browser speech synthesis
- **IndexedDB** — local storage for documents and notes
- **Google Fonts** — Inter, Manrope, and Material Symbols

---

## Settings

Navigate to **Settings** from the sidebar to:

- Toggle **dark mode**
- Change the **default zoom** level for the viewer (0.5x – 3.0x)
- View the **storage used** by your documents
- **Clear the entire library**
- **Reset reading progress** for all documents

---

## License

This project is for personal use. Contact the author for other uses.
