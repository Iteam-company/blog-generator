import { CronJob } from "cron";

export const job = CronJob.from({
  cronTime: "*/1 * * * * *",
  onTick: function () {
    console.log("You will see this message every second");
  },
  start: false,
  timeZone: "Europe/Kyiv",
});
