export type WMLNode = {
  tag: string;
  attributes: Record<string, string>;
  children: WMLNode[];
};

export class WMLParser {
  static parse(text: string): WMLNode {
    const root: WMLNode = { tag: 'root', attributes: {}, children: [] };
    const stack: WMLNode[] = [root];
    
    // Remove comments and normalize newlines
    const cleanText = text
      .replace(/#.*$/gm, '') // Remove comments
      .replace(/\r\n/g, '\n');

    let currentAttrKey = '';
    let currentAttrValue = '';
    let inQuotes = false;
    let inTag = false;
    let currentTag = '';
    let isClosingTag = false;

    // A simple line-by-line parser is often easier for WML
    const lines = cleanText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // Handle multi-line strings
      if (inQuotes) {
        // Find end quote
        const endQuoteIdx = line.indexOf('"');
        if (endQuoteIdx !== -1) {
          currentAttrValue += '\n' + line.substring(0, endQuoteIdx);
          const top = stack[stack.length - 1];
          top.attributes[currentAttrKey] = currentAttrValue;
          inQuotes = false;
          
          // Process rest of line
          line = line.substring(endQuoteIdx + 1).trim();
          if (!line) continue;
        } else {
          currentAttrValue += '\n' + line;
          continue;
        }
      }

      // Check for tags
      if (line.startsWith('[')) {
        const endIdx = line.indexOf(']');
        if (endIdx !== -1) {
          const tagContent = line.substring(1, endIdx).trim();
          if (tagContent.startsWith('/')) {
            // Closing tag
            stack.pop();
          } else {
            // Opening tag
            const newNode: WMLNode = { tag: tagContent, attributes: {}, children: [] };
            stack[stack.length - 1].children.push(newNode);
            stack.push(newNode);
          }
          // Process rest of line if any
          line = line.substring(endIdx + 1).trim();
          if (!line) continue;
        }
      }

      // Check for attributes: key=value
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1 && !line.startsWith('[')) {
        currentAttrKey = line.substring(0, eqIdx).trim();
        let val = line.substring(eqIdx + 1).trim();
        
        if (val.startsWith('"')) {
          if (val.endsWith('"') && val.length > 1) {
            // Single line string
            stack[stack.length - 1].attributes[currentAttrKey] = val.substring(1, val.length - 1);
          } else {
            // Multi-line string starts
            inQuotes = true;
            currentAttrValue = val.substring(1);
          }
        } else {
          // Simple value
          stack[stack.length - 1].attributes[currentAttrKey] = val;
        }
      }
    }

    return root;
  }
}
