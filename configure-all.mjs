#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const ROOT=dirname(fileURLToPath(import.meta.url));
const username=process.argv[2];
if(!username){ console.error('Usage: node configure-all.mjs <github-username>'); process.exit(1); }
const r=spawnSync(process.execPath,[join(ROOT,'pages-repo','configure.mjs'),username],{stdio:'inherit'});
if(r.status!==0) process.exit(r.status);
const p=join(ROOT,'profile-repo','README.md');
let s=readFileSync(p,'utf8').replaceAll('CHANGE_ME',username);
writeFileSync(p,s);
console.log('Profile README updated.');
