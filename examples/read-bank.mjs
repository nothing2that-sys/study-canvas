import {loadBank} from '../scripts/bank.mjs';
const rows=loadBank({subject:'korean'});
console.log('Korean questions:',rows.length);
console.log(JSON.stringify(rows.slice(0,2),null,2));
