1. Open Chrome DevTools → Console
2. Paste this snippet:

```
const links = Array.from(document.images).map(img => img.src);
console.log(links.join('\n'));
```

3. Copy the list from the console into `urls.txt`.
4. Download them all with:

```
wget -P ./src/images -i ./src/images/urls.txt
```