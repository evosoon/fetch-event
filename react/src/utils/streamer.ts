export type StreamJob = {
  text: string;
  onUpdate: (partial: string, done: boolean) => void;
  signal?: AbortSignal;
};

export class StreamQueue {
  private queue: StreamJob[] = [];
  private current: StreamJob | null = null;
  private offset = 0;
  private acc = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chunkSize: number;
  private interval: number;
  private paused = false;

  constructor(opts?: { chunkSize?: number; interval?: number }) {
    this.chunkSize = opts?.chunkSize ?? 3;
    this.interval = opts?.interval ?? 30;
  }

  enqueue(
    text: string,
    onUpdate: (partial: string, done: boolean) => void,
    signal?: AbortSignal
  ) {
    const job: StreamJob = { text, onUpdate, signal };
    this.queue.push(job);
    this.kick();
    return () => this.cancel(job);
  }

  setSpeed(opts: { chunkSize?: number; interval?: number }) {
    if (opts.chunkSize != null)
      this.chunkSize = Math.max(1, Math.floor(opts.chunkSize));
    if (opts.interval != null)
      this.interval = Math.max(0, Math.floor(opts.interval));
  }

  pause() {
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.kick();
  }

  cancel(job?: StreamJob) {
    if (job) {
      if (this.current === job) {
        this.finishCurrent(true);
      } else {
        this.queue = this.queue.filter((j) => j !== job);
      }
      return;
    }
    this.queue = [];
    this.finishCurrent(true);
  }

  private kick() {
    if (this.timer || this.paused) return;
    if (!this.current) {
      this.current = this.queue.shift() || null;
      this.offset = 0;
      this.acc = "";
      if (!this.current) return;
    }
    this.schedule();
  }

  private schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick();
    }, this.interval);
  }

  private tick() {
    const job = this.current;
    if (!job) {
      this.kick();
      return;
    }

    if (job.signal?.aborted) {
      this.finishCurrent(true);
      return;
    }

    const end = Math.min(job.text.length, this.offset + this.chunkSize);
    const chunk = job.text.slice(this.offset, end);
    this.offset = end;
    this.acc += chunk;

    try {
      job.onUpdate(this.acc, this.offset >= job.text.length);
    } catch (e) {
      console.error("[StreamQueue] onUpdate error", e);
    }

    if (this.offset >= job.text.length) {
      this.finishCurrent(false);
    }

    this.kick();
  }

  private finishCurrent(_cancelled: boolean) {
    this.current = null;
    this.offset = 0;
    this.acc = "";
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

