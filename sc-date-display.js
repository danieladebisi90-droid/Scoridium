/* Display only: storage and input values remain ISO date strings. */
window.scoridiumFullDate=function(value,weekday=false){
 const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(!match)return value||'Date TBD';
 const d=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
 return new Intl.DateTimeFormat('en-US',{weekday:weekday?'long':undefined,month:'long',day:'numeric',year:'numeric'}).format(d);
};
