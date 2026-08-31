#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=dirname(fileURLToPath(import.meta.url));
const username=process.argv[2];
if(!username){ console.error('Usage: node configure.mjs <github-username>'); process.exit(1); }
const sitePath=join(ROOT,'content','site.json');
const site=JSON.parse(readFileSync(sitePath,'utf8'));
site.githubUsername=username;
site.siteUrl=`https://${username}.github.io`;
site.contact.github=`https://github.com/${username}`;
writeFileSync(sitePath,JSON.stringify(site,null,2)+'\n');
function walk(dir){ for(const name of readdirSync(dir)){ const p=join(dir,name); if(statSync(p).isDirectory()) walk(p); else if(p.endsWith('.json')){ let s=readFileSync(p,'utf8'); s=s.replaceAll('CHANGE_ME.github.io',`${username}.github.io`); writeFileSync(p,s); } } }
walk(join(ROOT,'content'));
console.log(`Configured GitHub username: ${username}`);
console.log(`Expected Pages URL: https://${username}.github.io`);
