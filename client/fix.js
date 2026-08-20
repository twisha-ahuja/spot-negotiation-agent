const fs = require('fs');
const content = fs.readFileSync('src/styles/Autocomplete.css', 'utf8');
const newContent = content.replace(/:global\(([^)]+)\)/g, '$1');
fs.writeFileSync('src/styles/Autocomplete.css', newContent);
