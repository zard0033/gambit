import{k as c}from"./index-CEQVVdST.js";import{G as p,E as d}from"./chess-board-CDcNKt49.js";/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=c("lightbulb",[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]]);function m(o){let e=null,r=-1;function i(){const t=o.value,n=t==null?void 0:t.parentElement;if(!t||!n)return;const s=getComputedStyle(n),l=parseFloat(s.paddingLeft)+parseFloat(s.paddingRight),u=n.getBoundingClientRect().width-l,a=Math.floor(u/8)*8;a<=0||a===r||(r=a,t.style.width=`${a}px`,t.style.marginLeft="auto",t.style.marginRight="auto")}p(()=>{var n;const t=(n=o.value)==null?void 0:n.parentElement;t&&(e=new ResizeObserver(i),e.observe(t),i())}),d(()=>{e==null||e.disconnect(),e=null})}export{f as L,m as u};
