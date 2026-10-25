/** Grab the video's current frame as a small JPEG for the library card. */
export function captureFrame(video: HTMLVideoElement, width = 360): Promise<Blob | null> {
  if (!video.videoWidth) return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((video.videoHeight / video.videoWidth) * width)
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75))
}
