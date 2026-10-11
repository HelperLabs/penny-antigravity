import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [platformArg,outArg]=process.argv.slice(2);
assert(outArg,'Usage: node scripts/download-host.mjs <linux-x64|darwin-arm64> <new-directory>');
const pins=JSON.parse(fs.readFileSync('release-toolchains.json','utf8'));
const artifact=pins.hostArtifacts[platformArg];assert(artifact,'Unsupported host artifact');
const out=path.resolve(outArg);fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out,{mode:0o700});
try{
 const response=await fetch(artifact.url,{signal:AbortSignal.timeout(120000)});assert(response.ok,'Official host download failed');
 const bytes=Buffer.from(await response.arrayBuffer());assert(bytes.length<200*1024*1024,'Host archive exceeds expected bound');
 assert.equal(createHash('sha512').update(bytes).digest('hex'),artifact.sha512,'Official host checksum mismatch');
 const archive=path.join(out,'host.tar.gz');fs.writeFileSync(archive,bytes,{mode:0o600});
 const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(entries,['antigravity'],'Unexpected host archive entries');
 execFileSync('tar',['-xzf',archive,'-C',out],{stdio:'pipe'});
 const binary=path.join(out,'antigravity');assert(fs.lstatSync(binary).isFile());
 assert.equal(execFileSync(binary,['--version'],{encoding:'utf8'}).trim(),pins.antigravity);
 console.log(JSON.stringify({version:pins.antigravity,platform:platformArg,checksumVerified:true,binary}));
}catch(error){fs.rmSync(out,{recursive:true,force:true});throw error;}
