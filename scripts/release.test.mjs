import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'penny-release-inputs-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const file of ['package.json','package-lock.json','plugin.json','release-toolchains.json'])fs.copyFileSync(path.join(root,file),path.join(dir,file));
 fs.copyFileSync(path.join(root,'scripts/dependency-manifest.mjs'),path.join(dir,'manifest.mjs'));
 fs.writeFileSync(path.join(dir,'.gitignore'),'node_modules/\n.live/\n');
 execFileSync('git',['init','-b','main'],{cwd:dir,stdio:'pipe'});
 execFileSync('git',['add','.'],{cwd:dir,stdio:'pipe'});
 execFileSync('git',['-c','user.name=Release Fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic release inputs'],{cwd:dir,stdio:'pipe'});
 fs.mkdirSync(path.join(dir,'.live'));
 return dir;
}
const generate=dir=>spawnSync(process.execPath,['manifest.mjs','.live/manifest.json'],{cwd:dir,encoding:'utf8',timeout:15000});
test('clean committed inputs generate identical manifests',t=>{
 const dir=fixture(t);const first=generate(dir);assert.equal(first.status,0,first.stderr);
 const bytes=fs.readFileSync(path.join(dir,'.live/manifest.json'));
 assert.equal(generate(dir).status,0);
 assert.deepEqual(fs.readFileSync(path.join(dir,'.live/manifest.json')),bytes);
 const proof=JSON.parse(bytes);assert.deepEqual(proof.runtimeDependencies,[]);assert.deepEqual(proof.buildDependencies,[]);
});
test('dirty tracked inputs are rejected',t=>{
 const dir=fixture(t);fs.appendFileSync(path.join(dir,'plugin.json'),'\n');
 const result=generate(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/committed and clean/);
});
test('untracked release input is rejected',t=>{
 const dir=fixture(t);fs.writeFileSync(path.join(dir,'unexpected.txt'),'synthetic');
 const result=generate(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/committed and clean/);
});
test('an extraneous installed dependency is rejected',t=>{
 const dir=fixture(t);const dependency=path.join(dir,'node_modules/unexpected-package');fs.mkdirSync(dependency,{recursive:true});
 fs.writeFileSync(path.join(dependency,'package.json'),JSON.stringify({name:'unexpected-package',version:'1.0.0'}));
 assert.notEqual(generate(dir).status,0);
});
test('a committed symlink release input is rejected',t=>{
 const dir=fixture(t);fs.symlinkSync('plugin.json',path.join(dir,'alias.json'));
 execFileSync('git',['add','alias.json'],{cwd:dir,stdio:'pipe'});
 execFileSync('git',['-c','user.name=Release Fixture','-c','user.email=fixture@example.invalid','commit','-m','Synthetic symlink'],{cwd:dir,stdio:'pipe'});
 const result=generate(dir);assert.notEqual(result.status,0);assert.match(result.stderr,/regular file/);
});
