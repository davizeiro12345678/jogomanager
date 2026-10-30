export interface CanvasRecording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export function canExportVideo() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** Own recorder and stream together, including errors and abandoned recordings. */
export function recordCanvas(canvas: HTMLCanvasElement, fps = 30): CanvasRecording {
  const stream = canvas.captureStream(fps);
  const release = () => stream.getTracks().forEach((track) => track.stop());
  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder;
  try {
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined,
    );
  } catch (error) {
    release();
    throw error;
  }
  let result: Blob | undefined,
    failure: unknown,
    cancelled = false;
  let promise: Promise<Blob> | undefined;
  let resolve: ((blob: Blob) => void) | undefined, reject: ((error: unknown) => void) | undefined;
  recorder.ondataavailable = (event) => {
    if (!cancelled && event.data.size) chunks.push(event.data);
  };
  recorder.onerror = (event) => {
    failure = (event as Event & { error?: DOMException }).error ?? new Error("recording_failed");
    chunks.length = 0;
    release();
    reject?.(failure);
  };
  recorder.onstop = () => {
    release();
    if (cancelled || failure) {
      reject?.(failure ?? new DOMException("Recording cancelled", "AbortError"));
      chunks.length = 0;
      return;
    }
    result = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    chunks.length = 0;
    resolve?.(result);
  };
  try {
    recorder.start(250);
  } catch (error) {
    release();
    throw error;
  }
  return {
    stop() {
      if (promise) return promise;
      promise = new Promise<Blob>((done, fail) => {
        resolve = done;
        reject = fail;
        if (failure || cancelled)
          fail(failure ?? new DOMException("Recording cancelled", "AbortError"));
        else if (result) done(result);
        else
          try {
            recorder.stop();
          } catch (error) {
            release();
            fail(error);
          }
      });
      return promise;
    },
    cancel() {
      cancelled = true;
      chunks.length = 0;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        /* Already stopped. */
      } finally {
        release();
      }
    },
  };
}

export function replayVideoFile(blob: Blob, title: string) {
  const stem =
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "replay";
  return new File(
    [blob],
    `${stem.toLowerCase()}.${blob.type.startsWith("video/mp4") ? "mp4" : "webm"}`,
    { type: blob.type },
  );
}

/** Call directly from the share button to retain transient user activation. */
export async function shareReplayVideo(
  file: File,
  nav: Pick<Navigator, "canShare" | "share"> = navigator,
) {
  try {
    if (
      typeof nav.share !== "function" ||
      typeof nav.canShare !== "function" ||
      !nav.canShare({ files: [file] })
    )
      return "unsupported" as const;
    await nav.share({ files: [file], title: "Replay do JogoManager" });
    return "shared" as const;
  } catch (error) {
    return error instanceof Error && error.name === "AbortError"
      ? ("cancelled" as const)
      : ("unavailable" as const);
  }
}

export function downloadReplayVideo(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
