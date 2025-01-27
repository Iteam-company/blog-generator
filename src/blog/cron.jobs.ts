import { CronJob } from "cron";
import { PostGenerator } from "./post.generator";

export class CronService {
  public cronJob: CronJob;
  public cronPattern: string;
  private cronStatus: string;
  private postGenerator: PostGenerator;

  constructor(cronPattern: string) {
    this.cronPattern = cronPattern;

    this.postGenerator = new PostGenerator();

    this.cronJob = CronJob.from({
      cronTime: this.cronPattern,
      onTick: async () => {
        await this.postGenerator.generateNewPost();
      },
      start: false,
      timeZone: "Europe/Kyiv",
    });

    this.cronStatus = "stopped";
  }

  cronStart() {
    this.cronJob.start();
    this.cronStatus = "working";
  }

  cronStop() {
    this.cronJob.stop();
    this.cronStatus = "stopped";
  }

  getCronStatus() {
    return { status: this.cronStatus, pattern: this.cronPattern };
  }

  // TODO
  setNewPattern(time: any) {
    this.cronJob.setTime(time);
  }
}
