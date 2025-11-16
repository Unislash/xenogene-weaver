const ctx = require.context('./images', true, /\.(png|jpe?g|gif|webp|svg)$/i);

type ImageMap = Record<string, string>;

const buildImageMap = () => {
  const map: ImageMap = {};
  ctx.keys().forEach(key => {
    const src = ctx(key) as string;
    const name = key.split('/').pop();
    if (name) map[name] = src;
  });
  return map;
};

const imageMap = buildImageMap();

export const getGeneImage = (fileName?: string | null) => {
  if (!fileName) return undefined;
  return imageMap[fileName];
};

export const allImages = imageMap;
