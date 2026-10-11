import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,realpathSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const run=(name,args)=>execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
assert.equal(realpathSync(run('git',['rev-parse','--show-toplevel'])),realpathSync(process.cwd()));
assert.equal(run('git',['status','--porcelain','--untracked-files=all']),'','Release inputs must be committed and clean');
const pins=JSON.parse(readFileSync('release-toolchains.json','utf8'));
assert.equal(process.versions.node,pins.node);
assert.equal(run('npm',['--version']),pins.npm);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(pkg.repository.url,'https://github.com/HelperLabs/penny-antigravity.git');
assert.equal(pkg.author,'HelperLabs');
assert.equal(pkg.version,'0.1.0');
assert.deepEqual(pkg.dependencies??{},{});
assert.deepEqual(pkg.devDependencies??{},{});
const plugin=JSON.parse(readFileSync('plugin.json','utf8'));
assert.equal(plugin.name,pkg.name);
const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
assert.equal(lock.packages[''].version,pkg.version);
assert.deepEqual(Object.keys(lock.packages),['']);
const tree=JSON.parse(run('npm',['ls','--all','--json']));
const validate=p=>{assert(!p.extraneous&&!p.invalid&&!p.missing&&!p.problems?.length,'Installed dependency tree must match its lock');for(const child of Object.values(p.dependencies??{}))validate(child);};
validate(tree);
for(const artifact of Object.values(pins.hostArtifacts)){
 assert(artifact.url.startsWith('https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.3-5524738307653632/'));
 assert.match(artifact.sha512,/^[a-f0-9]{128}$/);
}
const files=run('git',['ls-files']).split('\n');
const inputs=Object.fromEntries(files.map(file=>{
 const stat=lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink(),'Release input must be a regular file');
 return [file,createHash('sha256').update(readFileSync(file)).digest('hex')];
}));
const proof={schemaVersion:1,package:{name:plugin.name,version:pkg.version,publisher:'HelperLabs',repository:pkg.repository.url},release:{ref:`v${pkg.version}`,commit:run('git',['rev-parse','HEAD'])},toolchains:{node:pins.node,npm:pins.npm,antigravity:pins.antigravity},hostArtifacts:pins.hostArtifacts,runtimeDependencies:[],buildDependencies:[],inputs};
writeFileSync(process.argv[2]??'release-dependencies.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({commit:proof.release.commit,dependencyCount:0,runtimeDependencyCount:0}));
