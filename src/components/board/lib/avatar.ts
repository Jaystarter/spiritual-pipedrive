"use client";

/**
 * Client-side crop of an uploaded photo to a small square JPEG data URL
 * (the server validates size and mime). Moved verbatim from the legacy
 * board monolith.
 */
export function fileToAvatarDataUrl(file: File) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Choose an image file."));
  }

  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("Photo must be under 5 MB."));
  }

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const outputSize = 192;
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
      const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Could not prepare photo."));
        return;
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read photo."));
    };

    image.src = objectUrl;
  });
}
