import {parseLogLine, describeLog, ProbeJournal} from './probe-log.js';

const parsed = parseLogLine('{"kind":"log","message":"ready"}');
if (parsed) {
  const level: 'info' | 'warn' | 'error' = parsed.level;
  const message: string = parsed.message;
  const timestamp: number | undefined = parsed.at;
  const summary: string = describeLog(parsed);
  void [level, message, timestamp, summary];
}
parseLogLine(123);
parseLogLine(null);
const messageOnly: string = describeLog({message: 'x'});
const journal = new ProbeJournal(3);
const added = journal.push('line\n');
journal.push({toString(encoding: 'utf8') { const used: 'utf8' = encoding; void used; return 'other\n'; }});
for (const record of added) {
  const at: number = record.at;
  const bounded: string = journal.failureText(record);
  void [at, bounded];
}
const finished = journal.finish();
const count: number = journal.snapshot().count;
const errors: number = journal.snapshot().errors;
const first: string | null = journal.snapshot().firstError;
const last: string | null = journal.snapshot().last;
const messages: string[] = journal.snapshot().messages;
void [messageOnly, finished, count, errors, first, last, messages];
