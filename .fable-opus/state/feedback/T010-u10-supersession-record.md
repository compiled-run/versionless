verify failed: node -e "const f=require('./evidence/trust/current/adapter-freeze.json');const z=f.freeze;if(String(z.composite).startsWith('27741d9c'))throw new Error('composite did not move');if(!f.supersedes||!String(f.supersedes.composite).startsWith('27741d9c'))throw new Error('supersedes does not carry 27741d9c');if((f.supersedes.chain||z.chain||[]).length<6&&(f.chain||[]).length<6)console.log('CHAIN-LENGTH-CHECK-DEFERRED-TO-SHAPE');const rs=(f.reopens||[]);const t=rs.find(r=>r.task==='T010');if(!t)throw new Error('no T010 reopen entry');if(t.reactSubtreeUnchanged!==false)throw new Error('reactSubtreeUnchanged must be false');console.log('SUPERSESSION-RECORDED composite='+String(z.composite).slice(0,8))" (exit 1)

Output tail:
[eval]:1
const f=require('./evidence/trust/current/adapter-freeze.json');const z=f.freeze;if(String(z.composite).startsWith('27741d9c'))throw new Error('composite did not move');if(!f.supersedes||!String(f.supersedes.composite).startsWith('27741d9c'))throw new Error('supersedes does not carry 27741d9c');if((f.supersedes.chain||z.chain||[]).length<6&&(f.chain||[]).length<6)console.log('CHAIN-LENGTH-CHECK-DEFERRED-TO-SHAPE');const rs=(f.reopens||[]);const t=rs.find(r=>r.task==='T010');if(!t)throw new Error('no T010 reopen entry');if(t.reactSubtreeUnchanged!==false)throw new Error('reactSubtreeUnchanged must be false');console.log('SUPERSESSION-RECORDED composite='+String(z.composite).slice(0,8))
^

Error: supersedes does not carry 27741d9c
at [eval]:1:249
at runScriptInThisContext (node:internal/vm:219:10)
at node:internal/process/execution:451:12
at [eval]-wrapper:6:24
at runScriptInContext (node:internal/process/execution:449:60)
at evalFunction (node:internal/process/execution:283:30)
at evalTypeScript (node:internal/process/execution:295:3)
at node:internal/main/eval_string:71:3

Node.js v24.15.0
