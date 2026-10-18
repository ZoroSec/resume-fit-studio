# Resume Fit Studio

A browser-based resume editor. Upload a `.docx` file, adjust typography and margins, fit the content to a readable page, and export a PDF or editable Word document. When a readable one-page fit is not possible, export a multi-page PDF.

The Word file is processed in the browser and is not uploaded to a server. Complex layouts, images, and custom Word formatting may need touch-ups after import. The editable Word export may reflow, so check its page count in Word.

## GitHub Pages

This repository contains a static site and a GitHub Actions workflow that deploys it from `main`. In repository **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**. The workflow publishes the repository root; no build step is required.

