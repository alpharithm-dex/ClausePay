import { Scheduler } from '/vendor/bryntum/scheduler.module.js';

const day = 86400000;
const dateAt = value => new Date(value+'T00:00:00');
const shifted = (value,days) => {
  const date = dateAt(value);
  date.setDate(date.getDate()+days);
  return date;
};
const blankResources = [
  {id:'worker',name:'Contractor pay'},
  {id:'benefit',name:'Employer benefit'}
];

export function createSchedule(element, onInspect) {
  const scheduler = new Scheduler({
    appendTo:element,
    height:245,
    startDate:new Date(2026,10,10),
    endDate:new Date(2026,10,21),
    viewPreset:'dayAndWeek',
    rowHeight:60,
    barMargin:9,
    eventLayout:'pack',
    readOnly:true,
    resourceImagePath:'',
    columns:[{text:'PAYMENT LANES',field:'name',width:164}],
    resources:blankResources,
    features:{
      eventEdit:false,eventDrag:false,eventResize:false,eventTooltip:false,
      scheduleTooltip:false,timeRanges:{showHeaderElements:true,showCurrentTimeLine:false}
    },
    eventRenderer({eventRecord,renderData}) {
      renderData.eventColor=eventRecord.get('color');
      return eventRecord.name;
    },
    listeners:{eventClick:({eventRecord})=>onInspect(eventRecord.resourceId)}
  });

  let rangeKey = '';
  return {
    update({rows,today,results,state,amount}) {
      scheduler.resourceStore.data=blankResources.map(resource=>({...resource,
        name:rows.find(row=>row.kind===resource.id)?.payee || resource.name
      }));
      const dates = [today,...rows.flatMap(row=>[row.due,row.originalDue].filter(Boolean)),
        ...Object.values(results).map(result=>result.runDate).filter(Boolean)].sort();
      const firstDue=rows.map(row=>row.originalDue || row.due).sort()[0];
      const first = firstDue && Date.parse(firstDue)-Date.parse(dates[0])>14*day ? firstDue : dates[0];
      const last = dates.at(-1);
      const fitEnd=Date.parse(last)-Date.parse(first)<8*day ? shifted(first,9) : shifted(last,2);
      const key=first+'/'+fitEnd.getTime();
      if (rangeKey!==key) {
        scheduler.setTimeSpan(shifted(first,-1),fitEnd);
        rangeKey=key;
      }
      scheduler.eventStore.data=rows.flatMap(row=>{
        const marker=(id,name,date,color,days=1)=>({id:row.kind+'-'+id,name,resourceId:row.kind,
          startDate:dateAt(date),endDate:shifted(date,days),color});
        const events=[];
        if(row.originalDue && row.originalDue!==row.due) events.push(marker('original','Prior date',row.originalDue,'gray'));
        const result=results[row.kind];
        const label=state(row);
        events.push(marker('due',amount(row.cents)+' · '+(result && result.runDate!==row.due ? 'Due' : label),
          row.due,result ? ({SUCCESS:'green',FAILED:'red',RETURNED:'red'}[result.status]||'orange') : 'blue',2));
        if(result?.runDate && result.runDate!==row.due) {
          events.push(marker('run',label,result.runDate,result.status==='SUCCESS'?'green':'orange',2));
        }
        return events;
      });
      scheduler.timeRanges = [{id:'demo-clock',name:'Run date',startDate:dateAt(today),cls:'cp-clock-marker'}];
    },
    fit() { scheduler.zoomToFit({leftMargin:26,rightMargin:26}); }
  };
}
