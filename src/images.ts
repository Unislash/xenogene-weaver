// Grab every image under src/assets (recursively)
const ctx = require.context(
  './images',
  true,
  /\.(png|jpe?g|gif|webp|svg)$/i
);

export const images = ctx.keys().map((key) => ({
  path: key,                  // e.g. "./icons/Gene_AwfulAnimals.png"
  src: ctx(key) as string,    // resolved URL from the bundler
  name: key.split('/').pop()!,// "Gene_AwfulAnimals.png"
}));