/**
 * Phones send 4–12 MB photos. Downscale to ≤ 2000 px JPEG before upload; the server still
 * validates the actual bytes (magic number, dimensions, size) and never trusts this step.
 */
export async function compressImage(file: File, max = 2000, quality = 0.88): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error('Choose a JPEG, PNG or WebP image.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file could not be read as an image.'));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size < 2.5 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress the image.'))), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}
