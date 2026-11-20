import {modules,moduleById,stages,content,taskCount,moduleCount,plural} from './course.js';
import {icon as I} from './icons.js';
import {read,write,mark,done,download,backup,restore,persistent,escapeText as E} from './state.js';
import {executePython} from '../runtime/client.js';

const main=document.querySelector('#main'), dialog=document.querySelector('#overlay');
const menu=[['home','Обзор','grid'],['program','Программа','book'],['practice','Практика','lab'],['projects','Проекты','folder'],['progress','Мой прогресс','chart']];
const packs={}, lookup=new Map();
let catalogue, route=[], openExercise, run=null, quizzes=new Map(), filter='', messageTimer, focusedBefore;
const codeId=(m,kind,i)=>m+'-'+kind+'-'+i;
const labPath=(m,kind,i)=>'#/learn/'+m+'/'+kind+'/'+i;
const button=(label,action,icon,cls='btn')=>'<button class="'+cls+'" type="button" data-action="'+action+'">'+(icon?I(icon,17):'')+label+'</button>';
const link=(text,href,cls='btn',symbol='')=>'<a class="'+cls+'" href="'+href+'">'+(symbol?I(symbol,17):'')+text+'</a>';
const badge=(text,style='')=>'<span class="tag '+style+'">'+E(text)+'</span>';
const nTasks=modules.reduce((n,m)=>n+m.count,0);
const fmt=n=>String(n).padStart(2,'0');
function unitKeys(m){
  return [...packs[m].lessons.map((_,i)=>codeId(m,'l',i)),...packs[m].tasks.map((_,i)=>codeId(m,'t',i)),m+'-quiz'];
}
function stats(m){const keys=unitKeys(m),passed=keys.filter(done).length;return {passed,total:keys.length,percent:Math.round(passed*100/keys.length)};}
function totals(){
  const all=modules.map(m=>stats(m.id)), completed=all.reduce((a,m)=>a+m.passed,0),total=all.reduce((a,m)=>a+m.total,0);
  const tasks=modules.reduce((a,m)=>a+packs[m.id].tasks.filter((_,i)=>done(codeId(m.id,'t',i))).length,0);
  return {completed,total,tasks,percent:Math.round(completed/total*100),modules:all.filter(m=>m.passed===m.total).length};
}
function nextUnit(id){
  const d=packs[id];
  const l=d.lessons.findIndex((_,i)=>!done(codeId(id,'l',i)));if(l>=0)return labPath(id,'l',l);
  const t=d.tasks.findIndex((_,i)=>!done(codeId(id,'t',i)));if(t>=0)return labPath(id,'t',t);
  return '#/quiz/'+id;
}
function resume(){
  const m=read('pref','module','m00'),last=read('pref','last','');
  if(lookup.has(last)&&!done(lookup.get(last).key))return last;
  if(moduleById[m]&&stats(m).percent<100)return nextUnit(m);
  const open=modules.find(x=>stats(x.id).percent<100);return open?nextUnit(open.id):'#/progress';
}
function toast(s){const el=document.querySelector('#toast');el.textContent=s;el.classList.add('show');clearTimeout(messageTimer);messageTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function dismiss(){if(dialog.open)dialog.close();}
function modal(title,body){
  const wasOpen=dialog.open;if(!wasOpen)focusedBefore=document.activeElement;
  dialog.innerHTML='<div class="modalhead"><h2>'+E(title)+'</h2><button class="iconbtn" data-action="close" aria-label="Закрыть">'+I('close')+'</button></div>'+body;
  if(!wasOpen)dialog.showModal();
}
dialog.addEventListener('close',()=>focusedBefore?.isConnected&&focusedBefore.focus());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}});
function setTheme(theme){
  document.documentElement.dataset.theme=theme==='dark'?'dark':'light';
  document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#14151b':'#f6f7fa';
}
setTheme(read('pref','theme','light'));
function sidebar(){
  const s=totals(),section=({module:'program',learn:'program',quiz:'program',lab:'practice',case:'practice',project:'projects'})[route[0]]||route[0];
  document.querySelector('#sidebar').innerHTML='<a class="brand" href="#/home"><img src="./assets/brand.svg" alt="" width="38" height="38"><span>Tensorium</span></a>'+
  '<div class="navlabel">Рабочее пространство</div><nav>'+menu.map(([id,title,sym])=>'<a '+(section===id?'class="active" aria-current="page"':'')+' href="#/'+id+'">'+I(sym)+'<span>'+title+'</span></a>').join('')+'</nav>'+
  '<div class="sidebottom"><a class="side-progress" href="#/progress"><span class="side-progress-title">'+I('target',17)+' Прогресс курса <b>'+s.percent+'%</b></span><span class="bar"><i style="width:'+s.percent+'%"></i></span></a><button class="profile" data-action="profile"><span class="avatar">'+I('user',18)+'</span><span><b>Мой профиль</b><small>На этом устройстве</small></span>'+I('chev',15)+'</button></div>';
}
function shell(){
  sidebar();
  let name=({module:'Программа',learn:'Урок',quiz:'Квиз',lab:'Лаборатория',case:'Практика',project:'Проект'})[route[0]]||menu.find(x=>x[0]===route[0])?.[1]||'Обзор';
  document.querySelector('#topbar').innerHTML='<button class="iconbtn mobile-menu" data-action="menu" aria-label="Открыть меню">'+I('menu')+'</button><div class="crumb"><a href="#/home">Рабочее пространство</a>'+I('chev',14)+'<span>'+E(name)+'</span></div><div class="bar-tools"><button class="searchbtn" data-action="search" aria-label="Открыть поиск по курсу">'+I('search',17)+'<span>Поиск по курсу</span><kbd>Ctrl K</kbd></button><button class="iconbtn theme" data-action="theme" aria-label="Переключить тему">'+I(document.documentElement.dataset.theme==='dark'?'sun':'moon',18)+'</button></div>';
  document.querySelector('#foot').innerHTML='<span>Tensorium</span><span>Python · Machine Learning</span>';
  if(!persistent())document.querySelector('#foot').insertAdjacentHTML('beforeend','<span>Хранилище браузера недоступно. Прогресс можно экспортировать.</span>');
}
function navState(open){document.body.classList.toggle('navopen',open);document.querySelector('#nav-scrim').hidden=!open;}
const back=(to,text)=>link(E(text),to,'backlink','back');
function heading(title,desc='',extra=''){return '<div class="heading"><div><h1>'+E(title)+'</h1>'+(desc?'<p>'+E(desc)+'</p>':'')+'</div>'+extra+'</div>';}
function section(title,action=''){return '<div class="sectionhead"><h2>'+E(title)+'</h2>'+action+'</div>';}
function bar(percent){return '<span class="bar"><i style="width:'+percent+'%"></i></span>';}
function stageCard(s,idx){
  const ms=modules.filter(m=>m.stage.id===s.id),amount=ms.reduce((n,m)=>n+m.count,0);
  return '<a class="track-card" href="#/program/'+s.id+'"><div class="track-art '+s.theme+'"><span>'+E(s.range)+'</span><img src="./assets/track-'+s.id+'.svg" alt="" width="400" height="145"></div><div class="track-info"><div class="eyebrow">ЭТАП '+fmt(idx+1)+'</div><h3>'+s.name+'</h3><p>'+s.detail+'</p><div class="cardmeta">'+I('layers',15)+moduleCount(ms.length)+'<span>·</span>'+taskCount(amount)+'</div></div></a>';
}
function moduleRow(m){
  const s=stats(m.id);return '<a class="module-row" href="#/module/'+m.id+'"><span class="module-code '+m.stage.theme+'">'+m.id.toUpperCase()+'</span><span class="rowcopy"><strong>'+E(m.title)+'</strong><small>'+E(m.desc)+'</small></span><span class="rowmeta">'+I('clock',15)+m.hours+' ч</span><span class="rowmeta rowcount">'+taskCount(m.count)+'</span><span class="rowstate">'+(s.passed?badge(s.percent+'%',s.percent===100?'mint':'purple'):'')+'</span>'+I('chev',17)+'</a>';
}
function home(){
  const s=totals(),cont=resume(),started=s.completed||read('pref','last','');
  return '<section class="hero"><div class="hero-art" aria-hidden="true"><img src="./assets/landscape.svg" alt=""><span>ПОВЕРХНОСТЬ ПОТЕРЬ <b>L(w₁, w₂)</b></span></div><div class="herocopy"><div class="hero-label"><span></span> ИНТЕРАКТИВНЫЙ КУРС</div><h1>Машинное обучение<br><em>на Python</em></h1><p>От первой строки кода до собственной нейросети.<br class="desktop"> Теория, эксперименты и задачи в браузере.</p>'+link(started?'Продолжить обучение':'Начать обучение',cont,'btn hero-btn','play')+'</div></section>'+
  '<div class="stats-strip">'+[['layers','18','модулей'],['code',nTasks,'практических задач'],['clock','461','час по программе']].map(([sym,n,l])=>'<div><span class="metric-icon">'+I(sym,21)+'</span><span><strong>'+n+'</strong><small>'+l+'</small></span></div>').join('')+'</div>'+
  section('Учебный маршрут',link('Вся программа','#/program','quietlink','book'))+'<div class="tracks">'+stages.map(stageCard).join('')+'</div>'+
  section(started?'Продолжить с модуля':'Первые модули')+'<div class="surface rows">'+(started?[moduleById[read('pref','module','m00')]||modules[0]]:modules.slice(0,3)).map(moduleRow).join('')+'</div>';
}
function program(){
  const stage=stages.some(s=>s.id===route[1])?route[1]:'all';
  const rows=modules.filter(m=>stage==='all'||m.stage.id===stage);
  return heading('Программа курса','18 модулей от основ Python до развёртывания модели.')+
  '<div class="tabs">'+[['all','Все модули'],...stages.map(s=>[s.id,s.name])].map(([id,label])=>link(label,'#/program/'+id,'tab '+(stage===id?'selected':''))).join('')+'</div>'+
  '<div class="surface rows">'+rows.map(moduleRow).join('')+'</div>';
}
function unitLink(m,kind,i,item){
  const key=codeId(m.id,kind,i),ok=done(key),sym=ok?'circleCheck':kind==='l'?'file':item.type==='code'?'code':'target';
  return '<a class="unit-row '+(ok?'finished':'')+'" href="'+labPath(m.id,kind,i)+'"><span class="unit-ico">'+I(sym,18)+'</span><span><small>'+(kind==='l'?'Урок':item.type==='code'?'Python':'Кейс')+' '+fmt(i+1)+'</small><b>'+E(unitName(item,i))+'</b></span>'+I('chev',16)+'</a>';
}
function modulePage(m){
  const d=packs[m.id],s=stats(m.id);
  return back('#/program/'+m.stage.id,'К программе')+'<section class="moduleintro surface"><div class="module-intro-art '+m.stage.theme+'"><img src="./assets/track-'+m.stage.id+'.svg" alt=""></div>'+badge(m.id.toUpperCase()+' · '+m.stage.name,m.stage.theme)+'<h1>'+E(m.title)+'</h1><p>'+E(m.desc)+'</p><div class="inline-meta">'+I('clock',16)+m.hours+' ч '+I('book',16)+d.lessons.length+' '+plural(d.lessons.length,['урок','урока','уроков'])+' '+I('code',16)+taskCount(d.tasks.length)+'</div>'+link(s.passed?'Продолжить модуль':'Начать модуль',nextUnit(m.id),'btn primary','play')+'</section>'+
  '<div class="two-col"><section>'+section('Уроки и примеры')+'<div class="surface rows">'+d.lessons.map((u,i)=>unitLink(m,'l',i,u)).join('')+'</div>'+section('Практика')+'<div class="surface rows">'+d.tasks.map((u,i)=>unitLink(m,'t',i,u)).join('')+'</div></section><aside class="context-panel surface"><h3>Результат модуля</h3><p>'+s.passed+' из '+s.total+' обязательных шагов</p>'+bar(s.percent)+'<p>Для зачёта завершите уроки, задачи и наберите 80% в квизе.</p>'+link('Открыть квиз','#/quiz/'+m.id,'btn light','target')+(m.deps.length?'<h4>Входные знания</h4>'+m.deps.map(i=>link(modules[i].title,'#/module/'+modules[i].id,'ref-link')).join(''):'')+'</aside></div>';
}
function lesson(m,i){
  const d=packs[m.id],u=d.lessons[i];if(!u)return missing();
  const key=codeId(m.id,'l',i);const href=i+1<d.lessons.length?labPath(m.id,'l',i+1):labPath(m.id,'t',0);
  const localOnly=u.example&&/^(?:from|import)\s+(?:torch|fastapi|transformers|mlflow|onnx|matplotlib|seaborn|catboost|torchvision)\b/m.test(u.example);
  return back('#/module/'+m.id,m.title)+'<div class="reading-layout"><article class="reading surface"><div class="eyebrow">'+m.id.toUpperCase()+' &nbsp;/&nbsp; УРОК '+fmt(i+1)+' ИЗ '+fmt(d.lessons.length)+'</div><h1>'+E(u.title)+'</h1>'+u.body.map(b=>'<p>'+E(b)+'</p>').join('')+(u.example?'<div class="codebox"><div class="codebar"><span>'+I('code',16)+' Python</span>'+button('Скачать .py','example-file','download','tinybtn')+'</div><pre><code>'+E(u.example)+'</code></pre></div>'+(localOnly?'<p class="note">Этот пример использует пакет для настольного Python. Скачайте файл или Jupyter-блокнот модуля для локального запуска.</p>':button('Открыть пример в лаборатории','example-run','terminal','btn light')):'')+'<div class="step-actions">'+button(done(key)?'Пройдено · дальше':'Прочитано, дальше','lesson-next','check','btn primary')+link('К модулю','#/module/'+m.id,'btn ghost')+'</div></article><aside class="context-panel surface"><h3>В этом модуле</h3>'+d.lessons.map((v,j)=>'<a class="lesson-nav '+(j===i?'current':'')+'" href="'+labPath(m.id,'l',j)+'"><span>'+fmt(j+1)+'</span>'+E(v.title)+'</a>').join('')+button('Скачать блокнот','notebook','download','btn light')+'</aside></div>';
}
function missing(){return heading('Страница не найдена')+link('Открыть программу','#/program','btn primary','book');}
const playgroundSeed='# Ваш первый эксперимент\nimport statistics\n\nminutes = [18, 24, 31, 27, 20]\nprint("Медианное время доставки:", statistics.median(minutes))\n';
function codePane(task,key,free=false){
  const val=read('draft',key,task.starter||'');
  return '<section class="workbench"><div class="editorbar"><span>'+I('terminal',16)+' solution.py</span><span id="save-label">Черновик на устройстве</span></div><textarea id="editor" aria-label="Исходный код Python" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="131072">'+E(val)+'</textarea><details class="stdin"><summary>Ввод для input()</summary><textarea id="stdin" aria-label="Стандартный ввод" placeholder="По одному значению на строку" rows="3">'+E(read('draft',key+'-stdin',''))+'</textarea></details><div class="work-actions">'+button('Запустить','run','play','btn run-btn')+(free?'':button('Проверить','check','check','btn primary'))+button('Остановить','stop','stop','btn stopbtn')+'<button class="iconbtn editor-action" title="Скачать код" aria-label="Скачать код" data-action="code-file">'+I('download',18)+'</button><button class="iconbtn editor-action" title="Вернуть начальный код" aria-label="Вернуть начальный код" data-action="reset-code">'+I('refresh',18)+'</button></div><div class="consolebox"><div class="console-head"><span>'+I('terminal',15)+' Вывод</span><small id="runstatus">Готов к запуску</small></div><div id="consoleout" role="log" aria-live="polite"><span class="console-placeholder">Результат появится здесь.</span></div></div></section>';
}
function choicePane(t,key){
  const last=read('attempt',key,null);
  return '<form id="choice-form" class="choiceform surface"><fieldset><legend>Выберите ответ</legend>'+t.options.map((v,j)=>'<label class="option"><input required type="radio" name="option" value="'+j+'" '+(last?.chosen===j?'checked':'')+'><span>'+E(v)+'</span></label>').join('')+'</fieldset><button class="btn primary" type="submit">'+I('check',17)+'Проверить ответ</button><div id="choice-feedback" aria-live="polite">'+(last?.chosen!=null?feedback(last.chosen===t.answer,t):'')+'</div></form>';
}
function feedback(ok,t){return '<div class="feedback '+(ok?'pass':'retry')+'"><b>'+(ok?'Верно':'Попробуйте ещё раз')+'</b><p>'+E(t.explanation)+'</p></div>';}
function exercise(task,key,caption,backTo,backText,next,summary=''){
  openExercise={task,key,next,free:false};
  const last=read('attempt',key,null);
  return back(backTo,backText)+'<div class="eyebrow">'+E(caption)+'</div>'+heading(task.title)+
    '<div class="exercise-grid"><article class="surface brief"><div class="brief-title">'+I('file',19)+' <h2>Задание</h2></div>'+(summary?'<p>'+E(summary)+'</p>':'')+'<p class="preserve">'+E(task.prompt)+'</p>'+
    (task.type==='code'?'<h3>Что проверяется</h3><ul class="checks">'+task.tests.map(t=>'<li>'+I('target',15)+E(t.label)+'</li>').join('')+'</ul><details class="hint"><summary>'+I('bulb',16)+' Подсказка</summary><p>'+E(task.hint)+'</p></details>':'')+
    (last?'<div class="attempt-note">Последняя попытка · '+(last.passed?'зачтено':'требует исправления')+'</div>':'')+'</article><div>'+ (task.type==='code'?codePane(task,key)+'<div id="attempts">'+attemptsPanel(last)+'</div>':choicePane(task,key))+'<div id="after-task">'+afterTask()+'</div></div></div>';
}
function attemptsPanel(record){
  if(!Array.isArray(record?.history)||!record.history.length)return '';
  const rows=record.history.map(attempt=>{
    const title=new Date(attempt.at).toLocaleString('ru-RU')+' · '+(attempt.passed?'Зачтено':'Требует исправления');
    return '<details class="attempt-detail"><summary>'+E(title)+'</summary><pre>'+E(attempt.code)+'</pre></details>';
  });
  return '<details class="solution"><summary>История проверок ('+rows.length+')</summary>'+rows.join('')+'</details>';
}
function recordCodeAttempt(key,passed,code){
  const at=Date.now();
  const history=[{passed,code,at},...(read('attempt',key)?.history||[])].slice(0,10);
  while(history.length>1&&JSON.stringify(history).length>200000)history.pop();
  const record={passed,at,history};
  write('attempt',key,record);
  return record;
}
function afterTask(){
  if(!openExercise||!done(openExercise.key))return '';
  const t=openExercise.task;
  return '<div class="after"><strong>'+I('circleCheck',18)+' Задача зачтена</strong>'+(openExercise.next?link('Дальше',openExercise.next,'btn light'):'')+'</div>'+(t.type==='code'?'<details class="solution"><summary>Разбор решения</summary><pre>'+E(t.solution)+'</pre></details>':'');
}
function practice(){
  const active=['missions','incidents','tasks'].includes(route[1])?route[1]:'missions';
  const tabs=[['missions','Миссии',catalogue.missions.length],['incidents','Полигон',catalogue.incidents.length],['tasks','Задачи курса',nTasks]];
  let body;
  if(active==='tasks'){
    const moduleId=moduleById[route[2]]?route[2]:'m00';
    const m=moduleById[moduleId];
    body='<label class="field-label">Модуль <select id="task-module">'+modules.map(mod=>'<option value="'+mod.id+'" '+(mod.id===moduleId?'selected':'')+'>'+mod.id.toUpperCase()+' · '+E(mod.title)+'</option>').join('')+'</select></label><div class="surface rows">'+packs[m.id].tasks.map((t,i)=>unitLink(m,'t',i,t)).join('')+'</div>';
  }else{
    body='<p class="list-caption">'+(active==='missions'?'Выполните рабочий тикет команды доставки и проверьте решение.':'Разберитесь в симптомах, найдите причину и исправьте эксперимент.')+'</p><div class="case-grid">'+catalogue[active].map(x=>'<a class="case-card surface" href="#/case/'+active+'/'+x.id+'"><div class="case-top">'+badge(x.module.toUpperCase(),moduleById[x.module].stage.theme)+I(done(x.id)?'circleCheck':active==='missions'?'flag':'wave',20)+'</div><h3>'+E(x.task.title)+'</h3><p>'+E(x.summary)+'</p><small>'+I(x.task.type==='code'?'code':'target',14)+(x.task.type==='code'?'Python':'Практический кейс')+'</small></a>').join('')+'</div>';
  }
  return heading('Практика','Рабочие задачи, диагностика ошибок и эксперименты на Python.',link('Свободная лаборатория','#/lab','btn primary','terminal'))+'<div class="tabs">'+tabs.map(([id,name,n])=>link(name+' <small>'+n+'</small>','#/practice/'+id,'tab '+(active===id?'selected':''))).join('')+'</div>'+body;
}
function playground(id,idx){
  const module=moduleById[id],sample=module && /^\d+$/.test(idx||'') && packs[id].lessons[Number(idx)]?.example;
  const key=sample?'example-'+id+'-'+idx:'playground';
  openExercise={task:{starter:sample||playgroundSeed},key,free:true};
  return back('#/practice','К практике')+heading('Лаборатория Python','Пишите и запускайте настоящий Python. NumPy и SQLite входят в учебную среду.')+codePane(openExercise.task,key,true);
}
function quiz(m){
  const q=packs[m.id].quiz,old=read('attempt',m.id+'-quiz',null);
  const answers=quizzes.get(m.id)||[];
  return back('#/module/'+m.id,m.title)+'<div class="eyebrow">'+m.id.toUpperCase()+' / КВИЗ</div>'+heading('Проверка знаний','Для зачёта нужно ответить правильно минимум на 80% вопросов.')+
    (old?'<div class="notice">Последний результат: '+E(old.score)+' из '+q.length+'. '+(done(m.id+'-quiz')?'Квиз зачтён.':'Можно пройти повторно.')+'</div>':'')+
    '<form id="quiz-form" class="quiz-stack">'+q.map((x,i)=>'<fieldset class="surface quiz-card"><legend class="sr-only">Вопрос '+(i+1)+'</legend><small class="eyebrow">ВОПРОС '+fmt(i+1)+'</small><h3>'+E(x.prompt)+'</h3>'+x.options.map((o,j)=>'<label class="option"><input type="radio" required name="q'+i+'" value="'+j+'" '+(answers[i]===j?'checked':'')+'><span>'+E(o)+'</span></label>').join('')+'<div data-quiz-feedback="'+i+'"></div></fieldset>').join('')+'<button class="btn primary" type="submit">'+I('check',17)+'Проверить квиз</button><div id="quiz-score" role="status"></div></form>';
}
function projects(){
  return heading('Выпускные проекты','Выберите направление, соберите доказательства готовности и оформите результат.')+'<div class="project-grid">'+catalogue.projects.map((p,i)=>'<a class="project-card surface" href="#/project/'+p.id+'"><div class="project-top"><span class="metric-icon">'+I(['clock','chip','layers','book'][i],23)+'</span>'+badge('Проект '+fmt(i+1))+'</div><h2>'+E(p.title)+'</h2><p>'+E(p.summary)+'</p><span class="quietlink">Открыть бриф '+I('chev',15)+'</span></a>').join('')+'</div>';
}
function project(p){
  const s=read('project',p.id,{})||{};
  return back('#/projects','К проектам')+heading(p.title,p.summary)+'<div class="reading-layout"><section class="reading surface"><h2>Стартовый набор</h2><p>Скачайте учебные данные, Jupyter-блокнот и инструкцию к первому эксперименту.</p><a class="btn light" href="./kits/'+p.id+'.zip" download>'+I('download',17)+'Скачать материалы проекта</a><h2>Материалы для сдачи</h2><div class="deliver-list">'+p.deliverables.map((v,i)=>'<label class="option"><input type="checkbox" data-item="'+i+'" '+(s.items?.[i]?'checked':'')+'><span>'+E(v)+'</span></label>').join('')+'</div><h3>Работа над проектом</h3><label class="field-label">Ссылка на репозиторий или коммит<input id="project-url" type="url" value="'+E(s.url||'')+'" placeholder="https://github.com/…"></label><label class="field-label">Отчёт и результаты<textarea id="project-notes" placeholder="Запишите метрику, ссылку на артефакты и выводы.">'+E(s.notes||'')+'</textarea></label><p class="note">Черновик сохраняется на устройстве. Экспортируйте его для передачи на ревью.</p>'+button('Скачать отчёт','project-export','download','btn primary')+'</section><aside class="context-panel surface"><h3>Критерии оценки</h3><ul>'+p.rubric.map(r=>'<li>'+E(r)+'</li>').join('')+'</ul></aside></div>';
}
function progress(){
  const s=totals();
  return heading('Мой прогресс','Зачёт учитывает уроки, практические задачи и итоговые квизы модулей.')+
    '<div class="progress-top surface"><span class="big-percent">'+s.percent+'<small>%</small></span><div><h2>Курс пройден</h2><p>'+s.completed+' из '+s.total+' обязательных шагов</p>'+bar(s.percent)+'</div></div><div class="stats-strip">'+[[s.modules+' / 18','модулей','layers'],[s.tasks+' / '+nTasks,'задач','code'],[modules.filter(m=>done(m.id+'-quiz')).length+' / 18','квизов','target']].map(([n,l,ic])=>'<div><span class="metric-icon">'+I(ic)+'</span><span><strong>'+n+'</strong><small>'+l+'</small></span></div>').join('')+'</div>'+
    section('По модулям')+'<div class="surface rows">'+modules.map(m=>{const t=stats(m.id);return '<a class="progress-row" href="#/module/'+m.id+'"><span class="module-code '+m.stage.theme+'">'+m.id.toUpperCase()+'</span><strong>'+E(m.title)+'</strong>'+bar(t.percent)+'<small>'+t.passed+' / '+t.total+'</small></a>';}).join('')+'</div>'+
    section('Перенос прогресса')+'<div class="surface transfer"><p>Сохраните черновики, результаты и отчёты в файл. Его можно открыть на другом устройстве.</p>'+button('Экспортировать JSON','export','download','btn light')+button('Импортировать','import','upload','btn ghost')+'</div>';
}
function remember(m,key){
  write('pref','module',m.id);write('pref','last',location.hash);
  write('visited',key,true);
}
function render(){
  if(run){run.abort();run=null;}
  openExercise=null;route=location.hash.replace(/^#\/?/,'').split('/');if(!route[0]||route[0]==='main')route=['home'];
  navState(false);dismiss();shell();let html;
  const [view,id,kind,raw]=route,m=moduleById[id],i=raw==null?NaN:Number(raw);
  switch(view){
    case 'home':html=home();break;
    case 'program':html=program();break;
    case 'module':html=m?modulePage(m):missing();break;
    case 'learn':
      if(!m||!Number.isInteger(i)||i<0){html=missing();break;}
      if(kind==='l'&&packs[id].lessons[i]){remember(m,codeId(id,'l',i));html=lesson(m,i);}
      else if(kind==='t'&&packs[id].tasks[i]){
        const key=codeId(id,'t',i),t=packs[id].tasks[i];remember(m,key);
        html=exercise(t,key,id.toUpperCase()+' / ЗАДАЧА '+fmt(i+1), '#/module/'+id,m.title,i+1<packs[id].tasks.length?labPath(id,'t',i+1):'#/quiz/'+id);
      }else html=missing();break;
    case 'quiz':if(m)remember(m,id+'-quiz');html=m?quiz(m):missing();break;
    case 'practice':html=practice();break;
    case 'lab':html=playground(id,kind);break;
    case 'case':{
      const c=['missions','incidents'].includes(id)?catalogue[id].find(x=>x.id===kind):null;
      html=c?exercise(c.task,c.id,(id==='missions'?'МИССИЯ':'ПОЛИГОН')+' / '+c.module.toUpperCase(),'#/practice/'+id,id==='missions'?'К миссиям':'На полигон','#/practice/'+id,c.summary):missing();break;}
    case 'projects':html=projects();break;
    case 'project':{const p=catalogue.projects.find(x=>x.id===id);html=p?project(p):missing();break;}
    case 'progress':html=progress();break;
    default:html=missing();
  }
  main.innerHTML=html;document.title=(main.querySelector('h1')?.innerText||'Обзор').replace(/\s+/g,' ')+' · Tensorium';
  window.scrollTo({top:0,behavior:'instant'});
}
function saveProject(){
  if(route[0]!=='project')return;
  write('project',route[1],{url:main.querySelector('#project-url')?.value||'',notes:main.querySelector('#project-notes')?.value||'',items:[...main.querySelectorAll('[data-item]')].map(x=>x.checked)});
}
function searchResults(text){
  const normalized=text.trim().toLocaleLowerCase('ru');const matches=[];
  for(const [href,u] of lookup){
    if(!normalized&&u.type!=='Модуль')continue;
    if((u.title+' '+u.module+' '+u.description).toLocaleLowerCase('ru').includes(normalized)){matches.push([href,u]);if(matches.length>=25)break;}
  }
  return matches.length?matches.map(([href,u])=>'<a class="search-result" href="'+href+'"><span class="unit-ico">'+I(u.type==='Модуль'?'layers':u.type==='Урок'?'file':'code',17)+'</span><span><b>'+E(u.title)+'</b><small>'+E(u.type)+' · '+E(u.module.toUpperCase())+'</small></span>'+I('chev',14)+'</a>').join(''):'<p class="note">По этому запросу ничего не найдено.</p>';
}
function openSearch(){
  modal('Поиск по курсу','<div class="search-field">'+I('search',20)+'<input id="search-input" type="search" placeholder="Python, градиент, регрессия…" aria-label="Запрос"></div><div id="search-results">'+searchResults('')+'</div>');
  dialog.querySelector('input').focus();
}
function renderConsole(r,checking){
  const el=main.querySelector('#consoleout');if(!el)return;
  el.innerHTML=(r.stdout?'<pre>'+E(r.stdout)+'</pre>':'')+(r.stderr?'<pre class="err">'+E(r.stderr)+'</pre>':'')+(r.error?'<p class="err">'+E(r.error)+'</p>':'')+(checking&&r.results.length?'<ul class="test-results">'+r.results.map(t=>'<li class="'+(t.passed?'ok':'err')+'">'+I(t.passed?'check':'close',15)+'<span>'+E(t.label)+(t.detail?' · '+E(t.detail):'')+'</span></li>').join('')+'</ul>':'')||'<span>Программа завершилась без вывода.</span>';
}
async function startRun(checking){
  if(!openExercise||run)return;
  const {task,key}=openExercise,editor=main.querySelector('#editor'),status=main.querySelector('#runstatus');
  const ctl=new AbortController();run=ctl;
  const workspace=main.querySelector('.workbench');workspace.classList.add('running');workspace.setAttribute('aria-busy','true');
  main.querySelector('#consoleout').textContent='';const snapshot=editor.value;
  try{
    const result=await executePython({code:snapshot,tests:checking?task.tests:[],stdin:main.querySelector('#stdin').value,signal:ctl.signal,onStatus:t=>{if(status.isConnected)status.textContent=t;}});
    if(!status.isConnected)return;renderConsole(result,checking);
    if(ctl.signal.aborted){status.textContent='Остановлено';return;}
    const pass=!result.error&&result.results.length>0&&result.results.every(x=>x.passed);
    status.textContent=result.error?'Ошибка запуска':checking?(pass?'Зачтено':'Есть ошибки'):'Выполнено';
    if(checking && (!result.error || result.stderr || /(?:Syntax|Indentation)Error/.test(result.error))){
      const record=recordCodeAttempt(key,pass,snapshot);
      main.querySelector('#attempts').innerHTML=attemptsPanel(record);
      if(pass){mark(key);sidebar();main.querySelector('#after-task').innerHTML=afterTask();toast('Задача зачтена');}
    }
  }catch(e){if(status.isConnected){status.textContent='Ошибка';main.querySelector('#consoleout').textContent=e.message||String(e);}}
  finally{if(run===ctl)run=null;workspace.classList.remove('running');workspace.removeAttribute('aria-busy');}
}
function exportNotebook(m){
  const cells=packs[m.id].lessons.flatMap(l=>{
    const result=[{cell_type:'markdown',metadata:{},source:['## '+l.title+'\n\n'+l.body.join('\n\n')]}];
    if(l.example) result.push({cell_type:'code',metadata:{},execution_count:null,outputs:[],source:[l.example]});
    return result;
  });
  download('Tensorium-'+m.id.toUpperCase()+'.ipynb',JSON.stringify({nbformat:4,nbformat_minor:4,metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'},language_info:{name:'python'}},cells},null,2),'application/x-ipynb+json');
}
function showProfile(){
  modal('Мой профиль','<p>Прогресс и черновики хранятся в этом браузере. Экспорт помогает перенести обучение на другое устройство.</p><div class="modal-actions">'+button('Скачать прогресс','export','download','btn primary')+button('Импортировать','import','upload','btn light')+'</div>');
}
function importFile(){
  const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';
  picker.onchange=async()=>{
    try{
      const file=picker.files[0];if(!file)return;
      if(file.size>5*1024*1024)throw Error('Файл превышает 5 МБ.');
      const count=restore(JSON.parse(await file.text()));setTheme(read('pref','theme','light'));render();toast('Обработано записей: '+count);
    }catch(e){toast(e.message||'Не удалось открыть файл.');}
  };picker.click();
}
document.addEventListener('click',e=>{
  const act=e.target.closest('[data-action]')?.dataset.action;
  if(!act){if(dialog.open&&e.target.closest('a[href^="#/"]'))dismiss();return;}
  switch(act){
    case 'close':dismiss();break;
    case 'menu':navState(!document.body.classList.contains('navopen'));break;
    case 'theme':{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';setTheme(theme);write('pref','theme',theme);shell();break;}
    case 'profile':showProfile();break;
    case 'search':openSearch();break;
    case 'export':download('Tensorium-progress.json',JSON.stringify(backup(),null,2),'application/json');break;
    case 'import':importFile();break;
    case 'lesson-next':{
      const m=moduleById[route[1]],i=Number(route[3]);mark(codeId(m.id,'l',i));location.hash=i+1<packs[m.id].lessons.length?labPath(m.id,'l',i+1):labPath(m.id,'t',0);break;
    }
    case 'notebook':exportNotebook(moduleById[route[1]]);break;
    case 'example-file':{const [_,id,,idx]=route;download(id+'-lesson-'+(Number(idx)+1)+'.py',packs[id].lessons[idx].example);break;}
    case 'example-run':{
      const [_,id,,idx]=route;const sample=packs[id].lessons[idx].example;
      if(read('draft','example-'+id+'-'+idx)===null)write('draft','example-'+id+'-'+idx,sample);location.hash='#/lab/'+id+'/'+idx;break;
    }
    case 'run':startRun(false);break;
    case 'check':startRun(true);break;
    case 'stop':run?.abort();break;
    case 'code-file':{const t=main.querySelector('#editor');if(t)download((openExercise.key||'solution')+'.py',t.value);break;}
    case 'reset-code':modal('Вернуть начальный код?','<p>Текущий текст в редакторе будет заменён заготовкой задания. Результаты проверок сохранятся.</p><div class="modal-actions">'+button('Вернуть заготовку','confirm-reset','refresh','btn primary')+button('Отмена','close','','btn light')+'</div>');break;
    case 'confirm-reset':{const el=main.querySelector('#editor');el.value=openExercise.task.starter||'';write('draft',openExercise.key,el.value);dismiss();el.focus();break;}
    case 'project-export':{
      saveProject();const p=catalogue.projects.find(p=>p.id===route[1]),s=read('project',p.id,{});
      const txt='# '+p.title+'\n\n'+p.summary+'\n\n## Материалы\n\n'+p.deliverables.map((v,i)=>'- ['+(s.items?.[i]?'x':' ')+'] '+v).join('\n')+'\n\n## Репозиторий\n\n'+(s.url||'')+'\n\n## Отчёт\n\n'+(s.notes||'')+'\n\n## Критерии оценки\n\n'+p.rubric.map(v=>'- '+v).join('\n')+'\n';
      download('Tensorium-'+p.id+'.md',txt,'text/markdown;charset=utf-8');break;
    }
  }
});
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.id==='search-input')document.querySelector('#search-results').innerHTML=searchResults(el.value);
  if((el.id==='editor'||el.id==='stdin')&&openExercise){
    const ok=write('draft',openExercise.key+(el.id==='stdin'?'-stdin':''),el.value);
    document.querySelector('#save-label').textContent=ok?'Сохранено на устройстве':'Только в этой сессии';
  }
  if(el.id==='project-url'||el.id==='project-notes'||el.hasAttribute('data-item'))saveProject();
});
document.addEventListener('change',e=>{
  if(e.target.id==='task-module')location.hash='#/practice/tasks/'+e.target.value;
  if(e.target.closest('#quiz-form')&&e.target.name?.startsWith('q')){
    const answers=quizzes.get(route[1])||[];answers[Number(e.target.name.slice(1))]=Number(e.target.value);quizzes.set(route[1],answers);
  }
});
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!['choice-form','quiz-form'].includes(form.id))return;e.preventDefault();
  const fields=new FormData(form);
  if(form.id==='choice-form'&&openExercise){
    const {task,key}=openExercise,chosen=Number(fields.get('option')),passed=chosen===task.answer;
    write('attempt',key,{chosen,passed,at:Date.now()});if(passed)mark(key);
    document.querySelector('#choice-feedback').innerHTML=feedback(passed,task);document.querySelector('#after-task').innerHTML=afterTask();sidebar();
  }else if(form.id==='quiz-form'){
    const id=route[1],questions=packs[id].quiz;let score=0;
    questions.forEach((q,i)=>{const ok=Number(fields.get('q'+i))===q.answer;if(ok)score++;form.querySelector('[data-quiz-feedback="'+i+'"]').innerHTML=feedback(ok,q);});
    const passed=score/questions.length>=.8;write('attempt',id+'-quiz',{score,passed,at:Date.now()});if(passed)mark(id+'-quiz');
    const box=document.querySelector('#quiz-score');box.innerHTML='<div class="feedback '+(passed?'pass':'retry')+'"><b>'+score+' / '+questions.length+' · '+(passed?'Квиз зачтён':'Можно попробовать ещё раз')+'</b></div>'+link('К модулю','#/module/'+id,'btn light');
    sidebar();toast(passed?'Квиз зачтён':'Результат сохранён');
  }
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.open)dismiss();else openSearch();return;}
  if(e.key==='Escape')navState(false);
  if(e.target.id==='editor'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();startRun(false);}
});
document.querySelector('.skip').addEventListener('click',event=>{
  event.preventDefault();main.focus();main.scrollIntoView({block:'start'});
});
document.querySelector('#nav-scrim').onclick=()=>navState(false);
window.addEventListener('hashchange',()=>{if(catalogue)render();});
window.addEventListener('storage',()=>{if(catalogue){sidebar();if(route[0]==='home'||route[0]==='progress')render();}});
async function boot(){
  try{
    const data=await Promise.all([...modules.map(m=>content(m.id)),content('catalogue')]);catalogue=data.pop();
    modules.forEach((m,i)=>{packs[m.id]=data[i];lookup.set('#/module/'+m.id,{key:'',title:m.title,description:m.desc,type:'Модуль',module:m.id});});
    for(const m of modules){
      for(const [kind,list] of [['l',packs[m.id].lessons],['t',packs[m.id].tasks]])list.forEach((u,i)=>{
        lookup.set(labPath(m.id,kind,i),{key:codeId(m.id,kind,i),title:u.title,description:kind==='l'?u.body.join(' '):u.prompt,type:kind==='l'?'Урок':'Задача',module:m.id});
      });
      lookup.set('#/quiz/'+m.id,{key:m.id+'-quiz',title:'Квиз · '+m.title,description:'',type:'Квиз',module:m.id});
    }
    render();
  }catch(e){main.innerHTML='<div class="notice"><h2>Не удалось открыть курс</h2><p>'+E(e.message)+'</p><button class="btn primary" id="retry">Повторить</button></div>';document.querySelector('#retry').onclick=boot;}
}
boot();
