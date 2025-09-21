export type StreamJob = {
  text: string;
  onUpdate: (partial: string, done: boolean) => void;
  signal?: AbortSignal;
};

export class StreamQueue {
  private queue: StreamJob[] = [];
  private currentJob: StreamJob | null = null;
  private currentPosition = 0;
  private currentText = "";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chunkSize: number;
  private interval: number;
  private isPaused = false;

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
    this.startProcessing();
    return () => this.cancelJob(job);
  }

  setSpeed(opts: { chunkSize?: number; interval?: number }) {
    if (opts.chunkSize != null) {
      this.chunkSize = Math.max(1, Math.floor(opts.chunkSize));
    }
    if (opts.interval != null) {
      this.interval = Math.max(0, Math.floor(opts.interval));
    }
  }

  pause() {
    this.isPaused = true;
    this.stopTimer();
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.startProcessing();
  }

  cancel() {
    this.queue = [];
    this.resetCurrentJob();
  }

  private cancelJob(job: StreamJob) {
    if (this.currentJob === job) {
      this.resetCurrentJob();
    } else {
      this.queue = this.queue.filter(j => j !== job);
    }
  }

  private startProcessing() {
    if (this.timer || this.isPaused) return;
    
    if (!this.currentJob) {
      this.loadNextJob();
      if (!this.currentJob) return;
    }
    
    this.scheduleNextTick();
  }

  private loadNextJob() {
    this.currentJob = this.queue.shift() || null;
    this.currentPosition = 0;
    this.currentText = "";
  }

  private scheduleNextTick() {
    if (this.timer) return;
    
    this.timer = setTimeout(() => {
      this.timer = null;
      this.processCurrentJob();
    }, this.interval);
  }

  private processCurrentJob() {
    if (!this.currentJob) {
      this.startProcessing();
      return;
    }

    if (this.currentJob.signal?.aborted) {
      this.resetCurrentJob();
      return;
    }

    // 计算这次要添加的文本块
    const endPosition = Math.min(
      this.currentJob.text.length, 
      this.currentPosition + this.chunkSize
    );
    const chunk = this.currentJob.text.slice(this.currentPosition, endPosition);
    
    // 更新状态
    this.currentPosition = endPosition;
    this.currentText += chunk;
    
    // 通知更新
    const isComplete = this.currentPosition >= this.currentJob.text.length;
    try {
      this.currentJob.onUpdate(this.currentText, isComplete);
    } catch (e) {
      console.error("[StreamQueue] onUpdate error", e);
    }

    // 处理完成或继续
    if (isComplete) {
      this.resetCurrentJob();
    }
    
    this.startProcessing();
  }

  private resetCurrentJob() {
    this.currentJob = null;
    this.currentPosition = 0;
    this.currentText = "";
    this.stopTimer();
  }

  private stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
