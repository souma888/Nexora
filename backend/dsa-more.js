const tab=(headers,rows,caption,active=[])=>({headers,rows,caption,active});
const sequence=(a,active=[],done=[],details=[])=>({type:'sequence',items:a.map((label,i)=>({label:label??'—',detail:details[i]??`index ${i}`,active:active.includes(i),done:done.includes(i)}))});

export function runDsaMore(id,input,definition){
  const frames=[],stats={comparisons:0,writes:0,visits:0};
  const show=(line,message,view,stateTable,state={})=>frames.push(structuredClone({line,message,view,stateTable,state,stats}));
  let result;
  if(['twopointers','slidingwindow','prefixrange','quickselect','nextgreater'].includes(id)){
    const a=[...input.values];let active=[],done=[],details=[],caption='Working array',rows=a.map((v,i)=>[i,v]),headers=['Index','Value'];
    const emit=(line,message,extra={})=>show(line,message,sequence(a,active,done,details),tab(headers,rows,caption),{array:a,...extra});
    emit(0,'Initial array; indexes are zero-based.');
    if(id==='twopointers'){
      const entries=a.map((value,index)=>({value,index})).sort((p,q)=>p.value-q.value||p.index-q.index);a.splice(0,a.length,...entries.map(p=>p.value));
      rows=entries.map((p,i)=>[i,p.value,p.index]);headers=['Sorted index','Value','Original index'];let l=0,r=a.length-1,pair=null;
      emit(0,'Sorted copy with original index mapping.');
      while(l<r){active=[l,r];stats.comparisons++;const sum=a[l]+a[r];emit(1,`${a[l]} + ${a[r]} = ${sum}; target ${input.target}.`);if(sum===input.target){pair={values:[a[l],a[r]],indexes:[entries[l].index,entries[r].index]};done=[l,r];break;}if(sum<input.target)l++;else r--;emit(2,'Discard an endpoint that cannot improve the sum in the required direction.');}
      result={pair,text:pair?`Pair [${pair.values.join(', ')}]; original indexes [${pair.indexes.join(', ')}].`:'No two distinct entries have the target sum.'};active=[];emit(3,result.text);
    }else if(id==='slidingwindow'){
      const k=input.k;let sum=a.slice(0,k).reduce((s,v)=>s+v,0),best=sum,start=0;const windows=[[0,k-1,sum]];
      active=Array.from({length:k},(_,i)=>i);caption=`Window sum ${sum}`;emit(0,`First ${k}-entry window sums to ${sum}.`);
      for(let end=k;end<a.length;end++){sum-=a[end-k];stats.writes++;caption=`Intermediate sum after removal: ${sum}`;emit(1,`Remove outgoing ${a[end-k]}; intermediate sum ${sum}.`);sum+=a[end];stats.writes++;stats.comparisons++;active=Array.from({length:k},(_,i)=>end-k+1+i);windows.push([end-k+1,end,sum]);if(sum>best){best=sum;start=end-k+1;}caption=`Current ${sum}; best ${best}`;emit(2,`Add incoming ${a[end]}; window sum ${sum}.`);}
      done=Array.from({length:k},(_,i)=>start+i);active=[];rows=windows;headers=['Start','End','Sum'];result={sum:best,left:start,right:start+k-1,values:a.slice(start,start+k),text:`Maximum fixed-window sum ${best}; inclusive indexes ${start}…${start+k-1}.`};emit(3,result.text);
    }else if(id==='prefixrange'){
      const original=[...a],prefix=[0];a.splice(0,a.length,0);details=['P[0]'];rows=[[0,0]];
      emit(0,'P[0]=0: no elements have been included.');
      original.forEach((value,i)=>{prefix.push(prefix.at(-1)+value);a.push(prefix.at(-1));details.push(`P[${i+1}]`);active=[i,i+1];stats.writes++;rows=prefix.map((v,j)=>[j,v]);emit(1,`P[${i+1}]=P[${i}]+${value}=${prefix.at(-1)}.`,{prefix});});
      active=[input.left,input.right+1];emit(2,`Read P[${input.right+1}]=${prefix[input.right+1]} and P[${input.left}]=${prefix[input.left]}.`,{prefix});const sum=prefix[input.right+1]-prefix[input.left];
      result={prefix,sum,text:`Inclusive range sum = ${prefix[input.right+1]} − ${prefix[input.left]} = ${sum}.`};emit(3,result.text,{prefix});
    }else if(id==='quickselect'){
      let lo=0,hi=a.length-1,target=input.k-1,value;
      const swap=(i,j)=>{if(i!==j){[a[i],a[j]]=[a[j],a[i]];stats.writes+=2;}rows=a.map((v,k)=>[k,v]);};
      while(lo<=hi){const pivot=a[hi];let boundary=lo;active=[hi];emit(0,`Active interval ${lo}…${hi}, pivot ${pivot}.`);
        for(let j=lo;j<hi;j++){stats.comparisons++;active=[j,hi];emit(1,`Compare ${a[j]} with pivot ${pivot}.`);if(a[j]<=pivot){swap(boundary,j);active=[boundary,j];emit(2,'Move the value into the left partition.');boundary++;}}
        swap(boundary,hi);done=[boundary];active=[boundary];emit(2,`Pivot is at zero-based rank ${boundary}.`);
        if(boundary===target){value=a[boundary];break;}if(boundary>target)hi=boundary-1;else lo=boundary+1;emit(3,`Keep interval ${lo}…${hi} for rank ${input.k}.`);
      }
      result={value,array:a,text:`Rank ${input.k} (one-based) has value ${value}; the working array is only partitioned.`};active=[];emit(3,result.text);
    }else{
      const stack=[],next=Array(a.length).fill(null),nextIndex=Array(a.length).fill(-1);
      const update=()=>{rows=a.map((v,i)=>[i,v,next[i]??'—',nextIndex[i]<0?'—':nextIndex[i]]);headers=['Index','Value','Next greater','Next index'];caption=`Unresolved stack: [${stack.join(', ')}] (top at right)`;};update();
      for(let i=0;i<a.length;i++){while(stack.length){stats.comparisons++;active=[i,stack.at(-1)];emit(1,`Compare ${a[i]} with unresolved ${a[stack.at(-1)]}.`);if(a[i]<=a[stack.at(-1)])break;const at=stack.pop();next[at]=a[i];nextIndex[at]=i;done.push(at);stats.writes++;update();emit(1,`Resolve index ${at}: next greater is ${a[i]} at ${i}.`);}stack.push(i);active=[i];stats.writes++;update();emit(2,`Push index ${i}.`);}
      active=[];result={next,nextIndex,text:`Next-greater values: [${next.map(v=>v??'none').join(', ')}].`};emit(3,result.text);
    }
  }else if(id==='huffman'){
    const nodes=input.weights.map((weight,id)=>({id,weight,symbol:String.fromCharCode(65+id),left:null,right:null})),queue=nodes.map(n=>n.id),codes=Array(input.weights.length).fill('');
    const emit=(line,message,active=[])=>show(line,message,{type:'tree',roots:[...queue],nodes:nodes.map(n=>({id:n.id,label:n.symbol?`${n.symbol}:${n.weight}`:n.weight,detail:n.symbol?codes[n.id]||'leaf':'',active:active.includes(n.id),done:Boolean(n.symbol&&codes[n.id])})),edges:nodes.flatMap(n=>n.left===null?[]:[[n.id,n.left,'0'],[n.id,n.right,'1']])},tab(['Symbol','Frequency','Code'],input.weights.map((w,i)=>[String.fromCharCode(65+i),w,codes[i]||'pending']),'Prefix codes; left edge 0, right edge 1'),{nodes,queue,codes});
    emit(0,'One independent leaf per frequency.');
    while(queue.length>1){queue.sort((a,b)=>nodes[a].weight-nodes[b].weight||a-b);const a=queue[0],b=queue[1];emit(1,`Select weights ${nodes[a].weight} and ${nodes[b].weight}.`,[a,b]);queue.splice(0,2);const node={id:nodes.length,weight:nodes[a].weight+nodes[b].weight,symbol:null,left:a,right:b};nodes.push(node);queue.push(node.id);stats.writes++;emit(2,`Merge them into weight ${node.weight}.`,[node.id]);}
    const walk=(at,code)=>{const n=nodes[at];if(n.symbol){codes[at]=code||'0';stats.visits++;emit(3,`${n.symbol} gets code ${codes[at]}.`,[at]);}else{walk(n.left,code+'0');walk(n.right,code+'1');}};walk(queue[0],'');
    const cost=input.weights.reduce((s,w,i)=>s+w*codes[i].length,0),total=input.weights.reduce((s,v)=>s+v,0);result={codes,cost,average:cost/total,nodes,text:`Weighted code length ${cost} bits for ${total} symbols; average ${(cost/total).toFixed(4)} bits/symbol.`};emit(3,result.text);
  }else if(id==='tarjan'){
    const adjacency=Array.from({length:6},()=>[]);input.edges.forEach(e=>adjacency[e.from].push(e.to));const index=Array(6).fill(null),low=Array(6).fill(null),onStack=Array(6).fill(false),stack=[],components=[],groups=Array(6).fill(null);let clock=0;
    const emit=(line,message,active=[])=>show(line,message,{type:'network',edges:input.edges,active,selected:[],visited:index.flatMap((v,i)=>v===null?[]:[i]),directed:true,groups},tab(['Node','Index','Low link','On stack','Component'],index.map((v,i)=>[i,v??'—',low[i]??'—',onStack[i]?'yes':'no',groups[i]===null?'pending':`C${groups[i]}`]),`Active stack [${stack.join(', ')}]`),{index,low,onStack,stack,components});
    const visit=v=>{index[v]=low[v]=clock++;stack.push(v);onStack[v]=true;stats.visits++;emit(0,`Discover ${v}: index=low=${index[v]}.`,[v]);for(const w of adjacency[v]){stats.comparisons++;if(index[w]===null){emit(1,`Recurse on ${v} → ${w}.`,[v,w]);visit(w);low[v]=Math.min(low[v],low[w]);}else if(onStack[w]){low[v]=Math.min(low[v],index[w]);}stats.writes++;emit(2,`After edge ${v} → ${w}, low[${v}]=${low[v]}.`,[v,w]);}if(low[v]===index[v]){const component=[];let w;do{w=stack.pop();onStack[w]=false;groups[w]=components.length;component.push(w);}while(w!==v);components.push(component);emit(3,`Complete component C${components.length-1}: {${component.join(', ')}}.`,component);}};
    emit(0,'Every vertex starts unvisited.');for(let v=0;v<6;v++)if(index[v]===null)visit(v);result={components,groups,text:`${components.length} strongly connected components: ${components.map(c=>`{${[...c].sort((a,b)=>a-b).join(', ')}}`).join(' · ')}.`};emit(3,result.text);
  }else if(id==='subsetsum'){
    const n=input.values.length,t=input.target,dp=Array.from({length:n+1},()=>Array(t+1).fill(false));dp[0][0]=true;
    const emit=(line,message,i=0,j=0)=>show(line,message,{type:'matrix',matrix:dp.map(r=>r.map(v=>v?'✓':'·')),rowLabels:Array.from({length:n+1},(_,k)=>k),columnLabels:Array.from({length:t+1},(_,k)=>k),cell:[i,j]},tab(['Items / sum',...Array.from({length:t+1},(_,k)=>k)],dp.map((r,k)=>[k,...r.map(v=>v?'yes':'no')]),'Reachability using each item at most once',[i,j+1]),{dp});
    emit(0,'Only sum zero is reachable with no items.');for(let i=1;i<=n;i++)for(let j=0;j<=t;j++){const exclude=dp[i-1][j],fits=input.values[i-1]<=j;dp[i][j]=exclude;if(fits){stats.comparisons++;dp[i][j]||=dp[i-1][j-input.values[i-1]];}stats.writes++;emit(fits?2:1,`Item ${i-1}, sum ${j}: exclude=${exclude}; ${fits?'also test inclusion from the previous row':'item does not fit'}. Reachable=${dp[i][j]}.`,i,j);}
    const chosen=[];let sum=t;if(dp[n][t])for(let i=n;i>0;i--)if(!dp[i-1][sum]){chosen.unshift(i-1);sum-=input.values[i-1];}
    result={reachable:dp[n][t],indexes:chosen,values:chosen.map(i=>input.values[i]),text:dp[n][t]?`Target ${t} is reachable with indexes [${chosen.join(', ')}], values [${chosen.map(i=>input.values[i]).join(', ')}].`:`Target ${t} is not reachable.`};emit(3,result.text,n,t);
  }else if(id==='matrixchain'){
    const d=input.dimensions,n=d.length-1,cost=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:Infinity)),split=Array.from({length:n},()=>Array(n).fill(null)),labels=Array.from({length:n},(_,i)=>`A${i+1}`);
    const emit=(line,message,i=0,j=0)=>show(line,message,{type:'matrix',matrix:cost.map((r,i)=>r.map((v,j)=>j<i?'—':v)),rowLabels:labels,columnLabels:labels,cell:[i,j]},tab(['First / last',...labels],cost.map((r,i)=>[labels[i],...r.map((v,j)=>j<i?'—':v)]),'Minimum scalar-multiplication costs',[i,j+1]),{cost,split});
    emit(0,'A single matrix requires no multiplication.');for(let length=2;length<=n;length++)for(let i=0;i+length<=n;i++){const j=i+length-1;emit(1,`Solve interval A${i+1}…A${j+1}.`,i,j);for(let k=i;k<j;k++){const candidate=cost[i][k]+cost[k+1][j]+d[i]*d[k+1]*d[j+1];stats.comparisons++;if(candidate<cost[i][j]){cost[i][j]=candidate;split[i][j]=k;stats.writes++;}emit(2,`Split after A${k+1}: cost ${candidate}, best ${cost[i][j]}.`,i,j);}}
    const parentheses=(i,j)=>i===j?`A${i+1}`:`(${parentheses(i,split[i][j])}${parentheses(split[i][j]+1,j)})`;result={cost:cost[0][n-1],parenthesization:parentheses(0,n-1),split,text:`Minimum cost ${cost[0][n-1]}; order ${parentheses(0,n-1)}.`};emit(3,result.text,0,n-1);
  }else if(id==='nqueens'){
    const n=input.size,columns=Array(n).fill(null);
    const emit=(line,message,row=0,column=0)=>{const board=columns.map(c=>Array.from({length:n},(_,j)=>c===j?'Q':'·'));show(line,message,{type:'matrix',matrix:board,rowLabels:Array.from({length:n},(_,i)=>i+1),columnLabels:Array.from({length:n},(_,i)=>String.fromCharCode(65+i)),cell:[Math.min(row,n-1),column]},tab(['Row','Queen column (zero-based)'],columns.map((c,i)=>[i,c??'unplaced']),'Actual partial board'),{columns});};
    const search=row=>{if(row===n)return true;for(let c=0;c<n;c++){emit(0,`Try row ${row}, column ${c}.`,row,c);let safe=true;for(let r=0;r<row;r++){stats.comparisons++;if(columns[r]===c||Math.abs(columns[r]-c)===row-r){safe=false;emit(1,`Reject: conflicts with queen in row ${r}.`,row,c);break;}}if(!safe)continue;columns[row]=c;stats.writes++;stats.visits++;emit(2,`Place queen at (${row},${c}).`,row,c);if(search(row+1))return true;columns[row]=null;stats.writes++;emit(2,`Backtrack: remove queen from row ${row}.`,row,c);}return false;};
    emit(0,'Empty board. Search stops at the first solution.');const solved=search(0);result={solved,columns:[...columns],text:solved?`First solution (zero-based columns): [${columns.join(', ')}].`:'No solution found.'};emit(3,result.text,n-1,columns[n-1]??0);
  }else throw Error(`Unknown additional DSA lab: ${id}`);
  return{model:id,version:definition.version,input,frames,result,stats};
}
