export const terminal = new Set(['SUCCESS','FAILED','RETURNED','REFUNDED','REVERSED','DENIED']);
export const retryable = status => ['FAILED','RETURNED'].includes(status);

export function releaseable(rows, results, date, retryKind) {
  return rows.filter(row => row.due<=date && (retryKind
    ? row.kind===retryKind && retryable(results[row.kind]?.status)
    : !results[row.kind]?.id));
}

export function laneState(row,result,approved,date) {
  if(result?.status==='SUCCESS') return 'Cleared';
  if(result?.status) return result.status[0]+result.status.slice(1).toLowerCase().replaceAll('_',' ');
  if(!approved) return 'Review';
  return row.due<=date ? 'Due' : 'Scheduled';
}
