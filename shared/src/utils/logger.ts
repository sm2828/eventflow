// shared/src/utils/logger.ts

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service?: string;
  [key: string]: unknown;
}

class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      ...meta,
    };

    const output = JSON.stringify(entry);

    if (level === "error" || level === "warn") {
      process.stderr.write(output + "\n");
    } else {
      process.stdout.write(output + "\n");
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === "debug") {
      this.log("debug", message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log("error", message, meta);
  }

  child(bindings: Record<string, unknown>): Logger {
    const child = new Logger(this.service);
    const originalLog = child["log"].bind(child);
    child["log"] = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
      originalLog(level, message, { ...bindings, ...meta });
    };
    return child;
  }
}

export function createLogger(service: string): Logger {
  return new Logger(service);
}

export type { Logger };
