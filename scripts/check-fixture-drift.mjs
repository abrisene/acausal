/*
 # check-fixture-drift.mjs
 # Fail when the committed fixtures no longer equal what the code produces.
 #
 # Run AFTER `rm -rf fixtures && pnpm gen:fixtures`. The `rm -rf` matters: it
 # makes the regeneration the COMPLETE picture. Without it, a case deleted from
 # gen-fixtures.ts would survive on disk carrying stale expectations, and the
 # replay tests would happily keep asserting that ghost — green against a
 # snapshot the current code no longer produces.
 #
 # `git status --porcelain` (not `git diff`) is the check, because it catches
 # drift in all three directions: added (??), modified (M), and deleted (D).
 # `git diff` alone ignores untracked files.
 #
 # fixtures/meta.json is excluded. It records the Node build and V8 version that
 # did the recording, which legitimately differs between machines and is not
 # part of the replay contract. Its drift is reported, never fatal.
 */

import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

const contract = git('status', '--porcelain', '--', 'fixtures', ':(exclude)fixtures/meta.json').trim();
const provenance = git('status', '--porcelain', '--', 'fixtures/meta.json').trim();

if (provenance) {
  process.stdout.write('fixtures/meta.json changed (provenance only, not fatal):\n');
  process.stdout.write(`${git('--no-pager', 'diff', '--', 'fixtures/meta.json')}\n`);
}

if (contract) {
  process.stderr.write('fixtures drift from the TypeScript reference implementation:\n');
  process.stderr.write(`${git('status', '--short', '--', 'fixtures', ':(exclude)fixtures/meta.json')}\n`);
  process.stderr.write(git('--no-pager', 'diff', '--', 'fixtures', ':(exclude)fixtures/meta.json'));
  process.stderr.write('\nRegenerate intentionally and review the diff, or fix the regression.\n');
  process.exit(1);
}

process.stdout.write('fixtures are current with the reference implementation.\n');
