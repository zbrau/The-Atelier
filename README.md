# The Atelier — Premium PDF Reader

**The Atelier** es un lector de PDFs elegante y sin servidor que corre directamente en tu navegador. No necesita instalación ni cuenta: todos tus documentos se guardan localmente en el dispositivo usando IndexedDB.

---

## ✨ Características

| Función | Descripción |
|---|---|
| 📂 **Biblioteca personal** | Sube y gestiona todos tus PDFs desde una interfaz estilo galería |
| 📖 **Lector integrado** | Renderizado de alta calidad con PDF.js |
| 🔖 **Progreso de lectura** | Recuerda la última página leída y muestra el porcentaje completado |
| 🔍 **Zoom ajustable** | Controla el nivel de zoom dentro del visor y configura un zoom por defecto |
| ✏️ **Dibujo libre (Pencil)** | Anota directamente sobre la página; incluye deshacer trazo a trazo |
| 🔊 **Texto a voz (TTS)** | Lee en voz alta el texto de la página actual (voz en español) |
| 📝 **Notas por página** | Agrega, visualiza y elimina notas vinculadas a cada página del documento |
| 🌙 **Modo oscuro** | Tema claro/oscuro persistente guardado en `localStorage` |
| 🗑️ **Gestión de documentos** | Elimina PDFs individuales o borra toda la biblioteca desde Ajustes |
| 🔄 **Reseteo de progreso** | Reinicia el avance de lectura de todos los documentos de un solo clic |

---

## 🚀 Cómo usar

### Requisitos
Solo necesitas un navegador moderno (Chrome, Edge, Firefox, Safari). No hay dependencias que instalar.

### Ejecutar localmente
1. Clona o descarga el repositorio:
   ```bash
   git clone https://github.com/zbrau/The-Atelier.git
   cd The-Atelier
   ```
2. Abre `index.html` directamente en tu navegador, o sírvelo con cualquier servidor estático:
   ```bash
   # Con Python
   python -m http.server 8080

   # Con Node.js (npx)
   npx serve .
   ```
3. Visita `http://localhost:8080` en tu navegador.

### Subir un PDF
- Haz clic en **Upload PDF** en la barra lateral o en el área de arrastre del Dashboard.
- El archivo se guarda en el almacenamiento local del navegador (IndexedDB); nunca se envía a ningún servidor.

---

## 🗂️ Estructura del proyecto

```
The-Atelier/
├── index.html   # Estructura HTML y configuración de Tailwind
├── main.js      # Lógica de la aplicación (IndexedDB, PDF.js, TTS, notas, dibujo)
└── style.css    # Estilos personalizados y overrides del modo oscuro
```

---

## 🛠️ Tecnologías

- **[PDF.js](https://mozilla.github.io/pdf.js/)** `v3.11.174` — renderizado de PDFs en canvas
- **[Tailwind CSS](https://tailwindcss.com/)** (CDN) — estilos utilitarios con tema personalizado Material You
- **[Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)** — síntesis de voz nativa del navegador
- **IndexedDB** — almacenamiento local de documentos y notas
- **Google Fonts** — Inter, Manrope y Material Symbols

---

## ⚙️ Ajustes disponibles

Navega a **Settings** desde la barra lateral para:

- Activar / desactivar el **modo oscuro**
- Cambiar el **zoom por defecto** del visor (0.5× – 3.0×)
- Ver el **espacio usado** por tus documentos
- **Eliminar toda la biblioteca**
- **Resetear el progreso** de lectura de todos los documentos

---

## 📄 Licencia

Este proyecto es de uso personal. Consulta al autor para otros usos.
