import {test} from 'node:test';
import assert from 'node:assert/strict';
import {financialPeriod} from '../src/features/finances/period.ts';
import {scopeFinancialData} from '../src/features/finances/scope.ts';
import {buildFinancialDashboard} from '../src/features/finances/dashboard.ts';
test('períodos respeitam ano bissexto, dia e ano completo',()=>{
  assert.equal(financialPeriod('month','2028-02').end,'2028-02-29');
  assert.equal(financialPeriod('day','2026-11-18').start,financialPeriod('day','2026-11-18').end);
  assert.equal(financialPeriod('year','2026').end,'2026-12-31');
  for(const [kind,value] of [['day','2026-02-30'],['month','2026-13'],['year','abc'],['bad','2026']]) assert.equal(financialPeriod(kind,value),null);
});

const payload = {receivables:[], periodPayments:[], cashParents:[], cashPayments:[], paidExpenses:[], cashReversals:[], professionals:[{id:'a',user_id:'u'}], profiles:[{id:'u',display_name:'Ester'}], clients:[], procedures:[], openReceivables:[], openExpenses:[], reversibleEntries:[], reopenableEntries:[], expenseCategories:[], expenseRecurrences:[], expenses:[
  {id:'1',description:'Individual',amount_cents:100,competence_date:'2026-01-15',paid_at:null,responsibility:'individual',professional_id:'a',status:'pending'},
  {id:'2',description:'Clínica',amount_cents:200,competence_date:'2026-02-15',paid_at:null,responsibility:'shared',professional_id:null,status:'pending'},
]};
test('ano separa meses e dia usa uma única posição no gráfico',()=>{
 const annual = buildFinancialDashboard(payload,'competence','2026-12-31','year');
 assert.equal(annual.daily.length,12);
 assert.equal(annual.daily[0].expense,100);
 assert.equal(annual.daily[1].expense,200);
 const daily = buildFinancialDashboard({...payload,expenses:[payload.expenses[0]]},'competence','2026-01-15','day');
 assert.equal(daily.daily.length,1);
 assert.equal(daily.daily[0].expense,100);
});
test('gastos compartilhados ficam na clínica e no consolidado, sem rateio individual',()=>{
 const individual = buildFinancialDashboard(scopeFinancialData(payload,'a'),'competence','2026-12-31','year');
 const clinic = buildFinancialDashboard(scopeFinancialData(payload,'clinic'),'competence','2026-12-31','year');
 assert.equal(individual.metrics.competenceResult,-100);
 assert.equal(clinic.metrics.competenceResult,-200);
 assert.equal(buildFinancialDashboard(payload,'competence','2026-12-31','year').metrics.competenceResult,-300);
 assert.equal(payload.expenses.length,2);
});
