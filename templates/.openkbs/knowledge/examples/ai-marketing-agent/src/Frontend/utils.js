export const getFullHtml = (editor, originalHtml) => {
    const parser = new DOMParser();

    // Parse the original HTML
    const dom = parser.parseFromString(originalHtml, 'text/html');

    // Get the head and body elements
    const head = dom.head;
    const body = dom.body;

    // Remove existing <style> tags from the head
    const styleElements = head.querySelectorAll('style');
    styleElements.forEach(el => el.parentNode.removeChild(el));

    // Ensure UTF-8 charset is set
    let charsetMeta = head.querySelector('meta[charset]');
    if (!charsetMeta) {
        charsetMeta = dom.createElement('meta');
        charsetMeta.setAttribute('charset', 'UTF-8');
        head.insertBefore(charsetMeta, head.firstChild);
    } else {
        charsetMeta.setAttribute('charset', 'UTF-8');
    }

    // Get updated content from the editor
    const updatedHtmlContent = editor.getHtml();
    const updatedCssContent = editor.getCss();
    const updatedJsContent = editor.getJs();

    // Parse updatedHtmlContent to ensure we don't include extra <html>, <head>, <body> tags
    const updatedDom = parser.parseFromString(updatedHtmlContent, 'text/html');

    // Replace the body content with updated content
    body.innerHTML = updatedDom.body.innerHTML;

    // Append updated CSS in a <style> tag in the head
    if (updatedCssContent.trim()) {
        const styleEl = dom.createElement('style');
        styleEl.textContent = updatedCssContent;
        head.appendChild(styleEl);
    }

    // Append updated JS in a <script> tag in the body
    if (updatedJsContent.trim()) {
        const scriptEl = dom.createElement('script');
        scriptEl.textContent = updatedJsContent;
        body.appendChild(scriptEl);
    }

    // Serialize the DOM back to HTML using outerHTML to prevent character encoding issues
    const doctype = '<!DOCTYPE html>\n';
    const fullHtml = doctype + dom.documentElement.outerHTML;

    // Return the formatted HTML code block
    return '```html\n' + fullHtml.trim() + '\n```';
};

export function getBaseURL(KB) {
    return `https://web.openkbs.com/${KB?.kbId}/`;
}

export const formatDate = (timestamp) => {
    if (!timestamp) return timestamp;
    const date = new Date(timestamp);
    return date.toLocaleString('en-US');
};

export function generateFilename(html) {
    const title = new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelector('title')?.textContent || 'untitled.html';
    return title.trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + '.html';
}

export function extractHTMLContent(content) {
    if (!content) return null;
    const languageDetected = /```(?<language>\w+)/g.exec(content)?.groups?.language;
    const htmlMatch = content.match(/<html[^>]*>[\s\S]*<\/html>/);
    if (htmlMatch && (!languageDetected || languageDetected === 'html')) {
        return htmlMatch[0];
    }
    return null;
}

export function isContentHTML(content) {
    if (!content) return content;
    const languageDetected = /```(?<language>\w+)/g.exec(content)?.groups?.language;
    return content?.match?.(/<html[^>]*>[\s\S]*<\/html>/) &&
        (!languageDetected || languageDetected === 'html');
}
