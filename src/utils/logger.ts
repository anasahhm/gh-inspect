import chalk from "chalk";

export const logger = {
  info:    (msg: string) => console.log(chalk.dim("→"), chalk.white(msg)),
  success: (msg: string) => console.log(chalk.green("✓"), chalk.white(msg)),
  warn:    (msg: string) => console.log(chalk.yellow("!"), chalk.yellow(msg)),
  error:   (msg: string) => console.error(chalk.red("✗"), chalk.red(msg)),
  debug:   (msg: string) => { if (process.env["DEBUG"]) console.log(chalk.gray("·"), chalk.gray(msg)); },
  blank:   ()            => console.log(),
  dim:     (msg: string) => console.log(chalk.dim(msg)),
};