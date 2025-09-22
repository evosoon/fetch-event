import { useCallback, useEffect, useRef } from 'react';

export type UseStreamOptions = {
  chunkSize?: number;
  interval?: number;
};

type StreamJob = {
  text: string;
  onUpdate: (delta: string, fullText: string, done: boolean) => void;
  signal?: AbortSignal;
};

export function useStream(opts?: UseStreamOptions) {
  const chunkSizeRef = useRef<number>(opts?.chunkSize ?? 3);
  const intervalRef = useRef<number>(opts?.interval ?? 30);

  const queueRef = useRef<StreamJob[]>([]);
  const currentJobRef = useRef<StreamJob | null>(null);
  const posRef = useRef<number>(0);
  const textRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef<boolean>(false);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      queueRef.current = [];
      currentJobRef.current = null;
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetCurrentJob = () => {
    currentJobRef.current = null;
    posRef.current = 0;
    textRef.current = "";
    stopTimer();
  };

  const loadNextJob = () => {
    currentJobRef.current = queueRef.current.shift() || null;
    posRef.current = 0;
    textRef.current = "";
  };

  const scheduleNextTick = () => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      processCurrentJob();
    }, intervalRef.current);
  };

  const startProcessing = () => {
    if (timerRef.current || pausedRef.current) return;
    if (!currentJobRef.current) {
      loadNextJob();
      if (!currentJobRef.current) return;
    }
    scheduleNextTick();
  };

const processCurrentJob = () => {
  if (pausedRef.current) return;

  const job = currentJobRef.current;
  if (!job) {
    startProcessing();
    return;
  }
  if (job.signal?.aborted) {
    resetCurrentJob();
    return;
  }

  const end = Math.min(job.text.length, posRef.current + chunkSizeRef.current);
  const chunk = job.text.slice(posRef.current, end);
  posRef.current = end;
  textRef.current += chunk;

  const done = posRef.current >= job.text.length;
  try {
    job.onUpdate(chunk, textRef.current, done);
  } catch (e) {
    console.error('[useStream] onUpdate error', e);
  }

  if (done) {
    resetCurrentJob();
  }
  if (!pausedRef.current) {
    startProcessing();
  }
};


  const enqueue = useCallback(
    (
      text: string,
      onUpdate: (delta: string, fullText: string, done: boolean) => void,
      signal?: AbortSignal
    ) => {
      const job: StreamJob = { text, onUpdate, signal };
      queueRef.current.push(job);
      startProcessing();
      return () => {
        if (currentJobRef.current === job) {
          resetCurrentJob();
        } else {
          queueRef.current = queueRef.current.filter(j => j !== job);
        }
      };
    },
    []
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
    stopTimer();
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    startProcessing();
  }, []);

  const cancel = useCallback(() => {
    queueRef.current = [];
    resetCurrentJob();
  }, []);

  return {
    enqueue,
    pause,
    resume,
    cancel,
  } as const;
}
