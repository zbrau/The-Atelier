// --- IndexedDB Wrapper ---
const DB_NAME = "AtelierPDFDB";
const STORE_NAME = "pdfs";

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function savePDF(id, name, buffer) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ id, name, buffer, date: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function deletePDF(id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function updatePDFProgress(id, progress, page) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
            if (req.result) {
                const pdf = req.result;
                pdf.progress = progress;
                if (page !== undefined) pdf.lastPage = parseInt(page, 10);
                const putReq = store.put(pdf);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            } else resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

async function getAllPDFs() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            // Sort by date descending
            const results = request.result.sort((a, b) => b.date - a.date);
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const views = {
        dashboard: document.getElementById("view-dashboard"),
        library: document.getElementById("view-library"),
        viewer: document.getElementById("view-viewer"),
        settings: document.getElementById("view-settings")
    };

    const fileUploadInput = document.getElementById("file-upload");
    const libraryGrid = document.querySelector("#view-library .grid");

    // PDF.js State
    let currentPdfDoc = null;
    let currentPdfId = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.0;
    const canvas = document.getElementById("pdf-render");
    const ctx = canvas.getContext("2d");

    // UI Elements for PDF
    const pageNumDisplayList = document.querySelectorAll(".font-inter.text-xs.font-medium.uppercase.tracking-widest");

    function updatePageNumDisplay(current, total) {
        pageNumDisplayList.forEach(el => {
            if (el.textContent.includes("Page")) {
                el.textContent = `Page ${current} of ${total || '?'}`;
            }
        });
        
        // Update progress in DB
        if (current !== "..." && total && currentPdfId) {
            const progress = Math.round((current / total) * 100);
            updatePDFProgress(currentPdfId, progress, current).catch(e => console.error(e));
        }
    }

    function renderPage(num) {
        pageRendering = true;
        currentPdfDoc.getPage(num).then(function(page) {
            // Adjust scale based on container width if needed, but 1.5 is standard readable
            const viewport = page.getViewport({ scale: scale * 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            const renderTask = page.render(renderContext);

            renderTask.promise.then(function() {
                pageRendering = false;
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            }).catch(function(err) {
                console.error("Render Page Error:", err);
                pageRendering = false;
            });
        }).catch(function(err) {
            console.error("Get Page Error:", err);
            pageRendering = false;
        });
        updatePageNumDisplay(num, currentPdfDoc.numPages);
    }

    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function onPrevPage() {
        if (pageNum <= 1) return;
        pageNum--;
        queueRenderPage(pageNum);
    }

    function onNextPage() {
        if (pageNum >= currentPdfDoc.numPages) return;
        pageNum++;
        queueRenderPage(pageNum);
    }

    async function loadPdfIntoViewer(arrayBuffer, pdfName, pdfId) {
        showView("viewer");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updatePageNumDisplay("...", "...");

        const titleEl = document.getElementById("viewer-pdf-title");
        if (titleEl) {
            titleEl.textContent = pdfName || "The Curated Gallery";
        }

        try {
            const typedarray = new Uint8Array(arrayBuffer);
            const loadingTask = pdfjsLib.getDocument({ data: typedarray });
            currentPdfDoc = await loadingTask.promise;
            // Restore last saved page if available
            let startPage = 1;
            if (pdfId) {
                const db = await initDB();
                const record = await new Promise(r => {
                    const tx = db.transaction(STORE_NAME, "readonly");
                    tx.objectStore(STORE_NAME).get(pdfId).onsuccess = e => r(e.target.result);
                });
                if (record && record.lastPage && record.lastPage > 1) {
                    startPage = record.lastPage;
                }
            }
            pageNum = startPage;
            renderPage(pageNum);
        } catch (err) {
            console.error("Error loading PDF:", err);
            alert("Oops! No se pudo abrir este PDF. (Error: " + err.message + ")");
        }
    }

    function showView(viewName) {
        Object.values(views).forEach(view => {
            if (view) {
                view.classList.add("hidden");
                const m = view.querySelector("main");
                if (m) m.classList.remove("fade-in");
            }
        });
        
        if (views[viewName]) {
            views[viewName].classList.remove("hidden");
            const m = views[viewName].querySelector("main");
            if (m) {
                setTimeout(() => m.classList.add("fade-in"), 10);
            }
        }
    }

    function findElementsContainingText(selector, text) {
        return Array.from(document.querySelectorAll(selector)).filter(el => 
            el.textContent.includes(text) || el.innerText.includes(text)
        );
    }

    // --- Library Rendering ---
    async function refreshLibrary() {
        const pdfs = await getAllPDFs();
        
        // If empty, return to dashboard style
        if (pdfs.length === 0) {
            // Keep the static mock items if empty for show, or clear them out. 
            // We will clear them out to make it realistic.
            if(libraryGrid) libraryGrid.innerHTML = '';
            showView("dashboard");
            return;
        }

        if (libraryGrid) {
            libraryGrid.innerHTML = ''; // Clear existing static cards

            pdfs.forEach(pdf => {
                const dateStr = new Date(pdf.date).toLocaleDateString();
                const progress = pdf.progress || 0;
                const cardHTML = `
                <div class="group cursor-pointer">
                    <div class="bg-surface-container-lowest rounded-[1.5rem] p-4 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1">
                        <div class="aspect-[3/4] rounded-xl overflow-hidden mb-5 bg-surface-container relative flex items-center justify-center p-4">
                            <!-- Generate a simple text cover -->
                            <div class="w-full h-full bg-white border border-outline-variant/30 rounded shadow-sm flex flex-col justify-center items-center text-center p-2 group-hover:scale-105 transition-transform duration-500">
                                <span class="material-symbols-outlined text-4xl text-primary/50 mb-2">menu_book</span>
                                <span class="text-xs font-bold text-on-surface line-clamp-3">${pdf.name}</span>
                            </div>
                            <div class="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors"></div>
                            <div class="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" title="Open Document">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>
                            </div>
                            <div class="absolute top-4 left-4 bg-red-500/90 backdrop-blur-md p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 delete-btn text-white z-10 cursor-pointer shadow-md" title="Delete PDF">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </div>
                        </div>
                        <div class="px-2">
                            <h3 class="font-manrope font-bold text-on-surface truncate mb-1" title="${pdf.name}">${pdf.name}</h3>
                            <p class="text-xs text-on-surface-variant font-medium mb-4">Added ${dateStr}</p>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] uppercase tracking-widest font-bold text-primary">Progress</span>
                                <span class="text-[10px] font-bold text-on-surface-variant">${progress}%</span>
                            </div>
                            <div class="h-1 w-full bg-secondary-container rounded-full overflow-hidden">
                                <div class="h-full premium-gradient rounded-full" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                </div>`;
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cardHTML;
                const cardEl = tempDiv.firstElementChild;
                
                cardEl.addEventListener("click", () => {
                    currentPdfId = pdf.id;
                    loadPdfIntoViewer(pdf.buffer, pdf.name, pdf.id);
                });

                const deleteBtn = cardEl.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                        e.stopPropagation(); // prevent opening pdf
                        if (confirm('Are you sure you want to delete this PDF?')) {
                            await deletePDF(pdf.id);
                            await refreshLibrary();
                        }
                    });
                }

                libraryGrid.appendChild(cardEl);
            });
        }
    }

    // --- Upload Logic ---
    const uploadButtons = findElementsContainingText("button", "Upload PDF");
    // Also include add buttons (since dashboard uses id="add" or similar text)
    document.querySelectorAll("button").forEach(b => {
        if(b.innerHTML.includes("upload_file") || b.innerHTML.includes("add")) {
            if(!uploadButtons.includes(b)) uploadButtons.push(b);
        }
    });

    uploadButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            fileUploadInput.click();
        });
    });

    const dropZone = document.querySelector("#view-dashboard .group\\/box");
    if (dropZone) {
        dropZone.addEventListener("click", () => fileUploadInput.click());
    }

    fileUploadInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show uploading state on the main dashboard btn if visible
        const dbBtn = document.querySelector("#view-dashboard button[innerHTML*='upload_file']");
        let originalHTML = "";
        if(dbBtn && dbBtn.offsetParent !== null) {
            originalHTML = dbBtn.innerHTML;
            dbBtn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="animation: spin 1s linear infinite;">sync</span> Uploading...`;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const arrayBuffer = event.target.result;
            const id = 'pdf_' + Date.now();
            await savePDF(id, file.name, arrayBuffer);
            
            // Revert btn and refresh UI
            if(dbBtn && originalHTML) dbBtn.innerHTML = originalHTML;
            fileUploadInput.value = ""; // Reset input
            
            await refreshLibrary();
            showView("library");
        };
        reader.readAsArrayBuffer(file);
    });

    // --- Viewer Nav Logic ---
    document.querySelectorAll("#view-viewer button").forEach(btn => {
        if (btn.innerText.includes("Previous") || btn.innerHTML.includes("arrow_back_ios")) {
            btn.addEventListener("click", onPrevPage);
            // Additionally, if it's the top left back button, go to library
            if (btn.parentElement.classList.contains("pill-shaped") === false) {
                 btn.addEventListener("click", () => { showView("library"); });
            }
        }
        if (btn.innerText.includes("Next") || btn.innerHTML.includes("arrow_forward_ios")) {
            btn.addEventListener("click", onNextPage);
        }
        if (btn.innerHTML.includes("zoom_in") || btn.id === "btn-zoom-in") {
            btn.addEventListener("click", () => {
                if (scale < 3.0) {
                    scale += 0.2;
                    if(currentPdfDoc) queueRenderPage(pageNum);
                }
            });
        }
        if (btn.innerHTML.includes("zoom_out") || btn.id === "btn-zoom-out") {
            btn.addEventListener("click", () => {
                if (scale > 0.4) {
                    scale -= 0.2;
                    if(currentPdfDoc) queueRenderPage(pageNum);
                }
            });
        }
        // Top left back button explicit override
        if (btn.parentElement.classList.contains("bg-slate-900/70") === false && (btn.innerHTML.includes("arrow_back_ios") || btn.innerText.includes("Home"))) {
            // Need a clean way to find the top left button
             btn.addEventListener("click", () => { showView("library"); });
        }
    });

    // Sidebar specifically
    const viewerDocs = document.querySelectorAll("#view-viewer .flex-1.overflow-y-auto > div");
    viewerDocs.forEach(doc => {
        doc.addEventListener("click", () => {
            viewerDocs.forEach(d => {
                d.classList.remove("border-l-4", "border-primary", "bg-surface-container-lowest");
                d.classList.add("hover:bg-surface-container-low");
                const p = d.querySelector("p");
                if (p) {
                    p.classList.remove("font-semibold", "text-on-surface");
                    p.classList.add("font-medium", "text-on-surface-variant");
                }
            });

            doc.classList.add("border-l-4", "border-primary", "bg-surface-container-lowest");
            doc.classList.remove("hover:bg-surface-container-low");
            const p = doc.querySelector("p");
            if (p) {
                p.classList.remove("font-medium", "text-on-surface-variant");
                p.classList.add("font-semibold", "text-on-surface");
            }
        });
    });

    // Sidebar Navigation (cross-view)
    function bindSidebarNav() {
        const navHome = findElementsContainingText("nav a, nav div", "Home");
        navHome.forEach(nav => {
            nav.addEventListener("click", (e) => {
                if(nav.tagName === 'A') e.preventDefault();
                showView("dashboard");
            });
        });

        const navRecent = findElementsContainingText("nav a, nav div", "Recent");
        navRecent.forEach(nav => {
            nav.addEventListener("click", async (e) => {
                if(nav.tagName === 'A') e.preventDefault();
                await refreshLibrary();
                showView("library");
            });
        });

        const navSettings = findElementsContainingText("nav a, nav div", "Settings");
        navSettings.forEach(nav => {
            nav.addEventListener("click", async (e) => {
                if(nav.tagName === 'A') e.preventDefault();
                await openSettings();
                showView("settings");
            });
        });
    }

    // --- Settings Logic ---
    let darkModeEnabled = localStorage.getItem("darkMode") === "true";
    let defaultZoom = parseFloat(localStorage.getItem("defaultZoom") || "1.0");

    function applyDarkMode(enabled) {
        if (enabled) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        const btn = document.getElementById("toggle-dark-mode");
        const thumb = document.getElementById("dark-mode-thumb");
        if (btn && thumb) {
            btn.style.backgroundColor = enabled ? "#005ac2" : "";
            thumb.style.transform = enabled ? "translateX(24px)" : "translateX(0)";
        }
    }

    async function openSettings() {
        // Update storage info
        const pdfs = await getAllPDFs();
        const countBadge = document.getElementById("pdf-count-badge");
        if (countBadge) countBadge.textContent = `${pdfs.length} PDF${pdfs.length !== 1 ? "s" : ""}`;

        let totalBytes = 0;
        pdfs.forEach(p => { if (p.buffer) totalBytes += p.buffer.byteLength || 0; });
        const storageEl = document.getElementById("storage-info");
        if (storageEl) {
            const mb = (totalBytes / (1024 * 1024)).toFixed(2);
            storageEl.textContent = `${mb} MB used across ${pdfs.length} document${pdfs.length !== 1 ? "s" : ""}`;
        }

        // Sync dark mode toggle
        applyDarkMode(darkModeEnabled);

        // Sync zoom slider
        const slider = document.getElementById("default-zoom-slider");
        const zoomLabel = document.getElementById("zoom-value-label");
        if (slider) {
            slider.value = defaultZoom;
            if (zoomLabel) zoomLabel.textContent = `${defaultZoom.toFixed(1)}×`;
        }
    }

    // Wire Settings controls once DOM is ready
    const darkModeBtn = document.getElementById("toggle-dark-mode");
    if (darkModeBtn) {
        darkModeBtn.addEventListener("click", () => {
            darkModeEnabled = !darkModeEnabled;
            localStorage.setItem("darkMode", darkModeEnabled);
            applyDarkMode(darkModeEnabled);
        });
    }

    const zoomSlider = document.getElementById("default-zoom-slider");
    const zoomLabel = document.getElementById("zoom-value-label");
    if (zoomSlider) {
        zoomSlider.addEventListener("input", () => {
            defaultZoom = parseFloat(zoomSlider.value);
            localStorage.setItem("defaultZoom", defaultZoom);
            scale = defaultZoom;
            if (zoomLabel) zoomLabel.textContent = `${defaultZoom.toFixed(1)}×`;
        });
    }

    const btnClearLibrary = document.getElementById("btn-clear-library");
    if (btnClearLibrary) {
        btnClearLibrary.addEventListener("click", async () => {
            if (confirm("Are you sure you want to delete ALL your PDFs? This cannot be undone.")) {
                const db = await initDB();
                const tx = db.transaction(STORE_NAME, "readwrite");
                tx.objectStore(STORE_NAME).clear();
                await new Promise(r => tx.oncomplete = r);
                await openSettings();
                showView("dashboard");
            }
        });
    }

    const btnResetProgress = document.getElementById("btn-reset-progress");
    if (btnResetProgress) {
        btnResetProgress.addEventListener("click", async () => {
            if (confirm("Reset reading progress for all documents?")) {
                const pdfs = await getAllPDFs();
                for (const pdf of pdfs) {
                    await updatePDFProgress(pdf.id, 0);
                }
                alert("Progress reset for all documents.");
                await openSettings();
            }
        });
    }

    // Apply saved dark mode on start
    applyDarkMode(darkModeEnabled);
    // Apply saved zoom
    scale = defaultZoom;

    // ===================================================
    // FEATURE 1: FREE DRAW (PENCIL) with UNDO
    // ===================================================
    const drawCanvas = document.getElementById("draw-canvas");
    const drawCtx = drawCanvas ? drawCanvas.getContext("2d") : null;
    let pencilActive = false;
    let isDrawing = false;
    let strokes = []; // each stroke = array of {x, y}
    let currentStroke = [];

    function syncDrawCanvasSize() {
        if (!drawCanvas || !canvas) return;
        drawCanvas.width = canvas.width;
        drawCanvas.height = canvas.height;
        drawCanvas.style.width = canvas.style.width || canvas.width + "px";
        drawCanvas.style.height = canvas.style.height || canvas.height + "px";
        redrawStrokes();
    }

    function redrawStrokes() {
        if (!drawCtx) return;
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        drawCtx.strokeStyle = "rgba(99, 102, 241, 0.75)";
        drawCtx.lineWidth = 3;
        drawCtx.lineCap = "round";
        drawCtx.lineJoin = "round";
        strokes.forEach(stroke => {
            if (stroke.length < 2) return;
            drawCtx.beginPath();
            drawCtx.moveTo(stroke[0].x, stroke[0].y);
            stroke.slice(1).forEach(pt => drawCtx.lineTo(pt.x, pt.y));
            drawCtx.stroke();
        });
    }

    function getPos(e) {
        const rect = drawCanvas.getBoundingClientRect();
        const scaleX = drawCanvas.width / rect.width;
        const scaleY = drawCanvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    if (drawCanvas) {
        drawCanvas.addEventListener("mousedown", e => {
            if (!pencilActive) return;
            isDrawing = true;
            currentStroke = [getPos(e)];
        });
        drawCanvas.addEventListener("mousemove", e => {
            if (!isDrawing || !pencilActive) return;
            const pt = getPos(e);
            currentStroke.push(pt);
            // draw incrementally
            drawCtx.strokeStyle = "rgba(99, 102, 241, 0.75)";
            drawCtx.lineWidth = 3;
            drawCtx.lineCap = "round";
            drawCtx.lineJoin = "round";
            if (currentStroke.length >= 2) {
                drawCtx.beginPath();
                const prev = currentStroke[currentStroke.length - 2];
                drawCtx.moveTo(prev.x, prev.y);
                drawCtx.lineTo(pt.x, pt.y);
                drawCtx.stroke();
            }
        });
        drawCanvas.addEventListener("mouseup", () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentStroke.length > 1) strokes.push([...currentStroke]);
            currentStroke = [];
        });
        drawCanvas.addEventListener("mouseleave", () => {
            if (isDrawing && currentStroke.length > 1) strokes.push([...currentStroke]);
            isDrawing = false;
            currentStroke = [];
        });
    }

    const btnPencil = document.getElementById("btn-pencil");
    if (btnPencil) {
        btnPencil.addEventListener("click", () => {
            pencilActive = !pencilActive;
            if (drawCanvas) {
                drawCanvas.style.display = pencilActive ? "block" : "none";
                syncDrawCanvasSize();
            }
            btnPencil.style.backgroundColor = pencilActive ? "#e0e7ff" : "";
            btnPencil.style.color = pencilActive ? "#4f46e5" : "";
        });
    }

    const btnUndo = document.getElementById("btn-undo");
    if (btnUndo) {
        btnUndo.addEventListener("click", () => {
            if (strokes.length > 0) {
                strokes.pop();
                redrawStrokes();
            }
        });
    }

    // Sync draw canvas whenever a new PDF page renders
    const origRenderPage = renderPage;
    // We hook via a wrapper after renderPage finishes:
    // (the canvas size changes after rendering – sync after a short delay)
    function afterPageRender() {
        setTimeout(() => {
            strokes = []; // clear strokes on page change
            syncDrawCanvasSize();
        }, 300);
    }

    // ===================================================
    // FEATURE 2: TEXT-TO-SPEECH (TTS) in Spanish
    // ===================================================
    let ttsActive = false;
    const btnTts = document.getElementById("btn-tts");
    if (btnTts) {
        btnTts.addEventListener("click", async () => {
            if (ttsActive) {
                window.speechSynthesis.cancel();
                ttsActive = false;
                btnTts.style.backgroundColor = "";
                btnTts.style.color = "";
                return;
            }

            if (!currentPdfDoc) { alert("Abre un PDF primero."); return; }
            try {
                const page = await currentPdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(i => i.str).join(" ").trim();
                if (!text) { alert("No se detectó texto en esta página."); return; }

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = "es-ES";
                utterance.rate = 0.95;
                utterance.onend = () => {
                    ttsActive = false;
                    btnTts.style.backgroundColor = "";
                    btnTts.style.color = "";
                };
                ttsActive = true;
                btnTts.style.backgroundColor = "#dcfce7";
                btnTts.style.color = "#16a34a";
                window.speechSynthesis.speak(utterance);
            } catch(e) {
                console.error("TTS error", e);
                alert("No se pudo leer esta página.");
            }
        });
    }

    // Stop TTS when page changes
    function stopTTS() {
        if (ttsActive) {
            window.speechSynthesis.cancel();
            ttsActive = false;
            if (btnTts) { btnTts.style.backgroundColor = ""; btnTts.style.color = ""; }
        }
    }

    // ===================================================
    // FEATURE 3: NOTES PANEL (per page, stored in notes DB)
    // ===================================================
    const NOTES_DB = "AtelierNotesDB";
    const NOTES_STORE = "notes";

    function initNotesDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(NOTES_DB, 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(NOTES_STORE)) {
                    const store = db.createObjectStore(NOTES_STORE, { keyPath: "id", autoIncrement: true });
                    store.createIndex("pdfPage", ["pdfId", "page"], { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveNote(pdfId, page, text) {
        const db = await initNotesDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(NOTES_STORE, "readwrite");
            tx.objectStore(NOTES_STORE).add({ pdfId, page, text, date: Date.now() });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getNotesForPage(pdfId, page) {
        const db = await initNotesDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(NOTES_STORE, "readonly");
            const idx = tx.objectStore(NOTES_STORE).index("pdfPage");
            const req = idx.getAll([pdfId, page]);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteNote(id) {
        const db = await initNotesDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(NOTES_STORE, "readwrite");
            tx.objectStore(NOTES_STORE).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function renderNotesList() {
        const notesList = document.getElementById("notes-list");
        const panelTitle = document.getElementById("notes-panel-title");
        if (!notesList || !currentPdfId) return;
        if (panelTitle) panelTitle.textContent = `Notas — Pág. ${pageNum}`;
        const notes = await getNotesForPage(currentPdfId, pageNum);
        if (notes.length === 0) {
            notesList.innerHTML = `<p class="text-xs text-on-surface-variant text-center py-6 opacity-60">Sin notas en esta página.</p>`;
            return;
        }
        notesList.innerHTML = notes.map(n => `
            <div class="bg-surface-container rounded-xl p-3 text-xs text-on-surface relative group">
                <p class="leading-relaxed mb-1">${n.text.replace(/</g,"&lt;")}</p>
                <p class="text-on-surface-variant opacity-60">${new Date(n.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>
                <button class="delete-note-btn absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity" data-id="${n.id}">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>`).join("");
        notesList.querySelectorAll(".delete-note-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                await deleteNote(Number(btn.dataset.id));
                await renderNotesList();
            });
        });
    }

    const btnNotes = document.getElementById("btn-notes");
    const notesPanel = document.getElementById("notes-panel");
    const btnCloseNotes = document.getElementById("btn-close-notes");
    const btnAddNote = document.getElementById("btn-add-note");
    const noteInput = document.getElementById("note-input");

    if (btnNotes && notesPanel) {
        btnNotes.addEventListener("click", async () => {
            const isHidden = notesPanel.classList.contains("hidden");
            notesPanel.classList.toggle("hidden", !isHidden);
            if (isHidden) await renderNotesList();
        });
    }
    if (btnCloseNotes) {
        btnCloseNotes.addEventListener("click", () => notesPanel && notesPanel.classList.add("hidden"));
    }
    if (btnAddNote && noteInput) {
        btnAddNote.addEventListener("click", async () => {
            const text = noteInput.value.trim();
            if (!text || !currentPdfId) return;
            await saveNote(currentPdfId, pageNum, text);
            noteInput.value = "";
            await renderNotesList();
        });
        noteInput.addEventListener("keydown", async e => {
            if (e.key === "Enter" && e.ctrlKey) {
                const text = noteInput.value.trim();
                if (!text || !currentPdfId) return;
                await saveNote(currentPdfId, pageNum, text);
                noteInput.value = "";
                await renderNotesList();
            }
        });
    }

    // ===================================================
    // FEATURE 4: TEXT SELECTION → GOOGLE TRANSLATE POPUP
    // ===================================================
    const translatePopup = document.getElementById("translate-popup");
    let translateSelectedText = "";
    
    document.addEventListener("selectionchange", () => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : "";
        if (!translatePopup) return;
        if (text.length > 2 && document.getElementById("view-viewer") && !document.getElementById("view-viewer").classList.contains("hidden")) {
            translateSelectedText = text;
            const range = sel.getRangeAt(0).getBoundingClientRect();
            translatePopup.style.top = (range.bottom + window.scrollY + 8) + "px";
            translatePopup.style.left = (range.left + (range.width / 2) - 40) + "px";
            translatePopup.classList.remove("hidden");
        } else {
            translatePopup.classList.add("hidden");
        }
    });

    if (translatePopup) {
        translatePopup.addEventListener("click", () => {
            if (translateSelectedText) {
                const url = `https://translate.google.com/?sl=auto&tl=es&text=${encodeURIComponent(translateSelectedText)}&op=translate`;
                window.open(url, "_blank");
            }
            translatePopup.classList.add("hidden");
        });
    }

    // Patch queueRenderPage to hook afterPageRender and stopTTS
    const origQueueRenderPage = queueRenderPage;

    // We patch the renderPage itself to hook post-render actions
    const _origRenderPageFn = renderPage;
    // Cannot easily replace since JS closures are bound; use observer instead:
    // Use MutationObserver to detect canvas size changes (proxy for page render)
    if (canvas) {
        const sizeObserver = new MutationObserver(() => {
            afterPageRender();
            stopTTS();
            if (!notesPanel.classList.contains("hidden")) renderNotesList();
        });
        sizeObserver.observe(canvas, { attributes: true, attributeFilter: ["width","height"] });
    }

    bindSidebarNav();

    // Init
    refreshLibrary().then(() => {
        // Init view is set during refreshLibrary based on if PDFs exist
    });
});

const style = document.createElement('style');
style.innerHTML = `
@keyframes spin { 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);

